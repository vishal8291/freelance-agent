/**
 * LinkedIn Bot — Phase 7
 *
 * ⚠️  BAN-RISK MODULE — read constraints before modifying:
 *   - Never scrape LinkedIn aggressively — always use delays + human-like behavior
 *   - Max LINKEDIN_MAX_CONNECTS_PER_DAY connects/day (default 15)
 *   - Max LINKEDIN_MAX_DMS_PER_DAY DMs/day (default 8)
 *   - 48h cooldown per profile before re-contact
 *   - Business hours only: 10am–6pm IST
 *   - Random jitter between every action (3–12 seconds)
 *   - Session saved in data/linkedin-session.json (cookies + localStorage)
 *   - Human review queue: every action goes through queue before execution
 *
 * Flow:
 *   1. searchProfiles(query)    → array of { profileUrl, name, headline, company }
 *   2. draftConnectionNote()    → personalised note via Claude
 *   3. addToQueue('connect')    → Vishal approves in dashboard
 *   4. executeQueue()           → sends approved items
 *   5. After acceptance → addToQueue('dm') → Vishal approves → sends
 *
 * Setup (one-time):
 *   1. Run: node scrapers/linkedinBot.js --login
 *   2. Log in manually in the opened browser window
 *   3. Press Enter in terminal — session saved automatically
 *   4. Dashboard can now drive the bot headlessly
 */

import { chromium } from 'playwright';
import fs            from 'fs';
import path          from 'path';
import { fileURLToPath } from 'url';

import {
  addToQueue, getQueue, markSent, getDailyCount, isOnCooldown,
} from './linkedinQueue.js';
import { draftConnectionNote, draftFollowUpDM, getSearchQueries } from './linkedinMessages.js';
import 'dotenv/config';

const __dirname      = path.dirname(fileURLToPath(import.meta.url));
const SESSION_FILE   = path.join(__dirname, '..', 'data', 'linkedin-session.json');

// ── Rate limits ───────────────────────────────────────────────────────────────

const MAX_CONNECTS = parseInt(process.env.LINKEDIN_MAX_CONNECTS_PER_DAY || '15');
const MAX_DMS      = parseInt(process.env.LINKEDIN_MAX_DMS_PER_DAY      || '8');

// ── IST business-hours check ─────────────────────────────────────────────────

function isBusinessHoursIST() {
  const now  = new Date();
  const ist  = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000); // UTC+5:30
  const hour = ist.getUTCHours();
  const day  = ist.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0 && hour >= 10 && hour < 18;
}

// ── Random human-like delay ──────────────────────────────────────────────────

function humanDelay(minMs = 3000, maxMs = 12000) {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise(r => setTimeout(r, ms));
}

// ── Browser launch with stealth settings ─────────────────────────────────────

async function launchBrowser(headless = true) {
  const browser = await chromium.launch({
    headless,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1366,768',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport:  { width: 1366, height: 768 },
    locale:    'en-IN',
    timezoneId: 'Asia/Kolkata',
    // Disable webdriver flag
    javaScriptEnabled: true,
  });

  // Spoof navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });

  return { browser, context };
}

// ── Session helpers ───────────────────────────────────────────────────────────

export function isSessionSaved() {
  return fs.existsSync(SESSION_FILE);
}

async function loadSession(context) {
  if (!fs.existsSync(SESSION_FILE)) return false;
  try {
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf-8'));
    await context.addCookies(saved.cookies || []);
    console.log('[LI] Session loaded from file');
    return true;
  } catch (err) {
    console.error('[LI] Failed to load session:', err.message);
    return false;
  }
}

async function saveSession(context) {
  const cookies = await context.cookies();
  fs.writeFileSync(SESSION_FILE, JSON.stringify({ cookies, savedAt: new Date().toISOString() }, null, 2));
  console.log('[LI] Session saved to', SESSION_FILE);
}

// ── Login flow (interactive, run once) ───────────────────────────────────────

export async function loginInteractive() {
  console.log('[LI] Opening LinkedIn for manual login…');
  const { browser, context } = await launchBrowser(false); // visible browser
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  console.log('[LI] Please log in to LinkedIn in the browser window.');
  console.log('[LI] Press Enter here once you are fully logged in and see the feed…');

  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });

  await saveSession(context);
  await browser.close();
  console.log('[LI] Login session saved. You can now run the bot headlessly.');
}

// ── Check if still logged in ─────────────────────────────────────────────────

async function isLoggedIn(page) {
  try {
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await humanDelay(2000, 4000);
    const url = page.url();
    return !url.includes('/login') && !url.includes('/checkpoint');
  } catch {
    return false;
  }
}

// ── Profile search ────────────────────────────────────────────────────────────

/**
 * Search LinkedIn for profiles matching a query.
 * Returns up to `limit` profile objects.
 */
export async function searchProfiles(query, limit = 10) {
  if (!isSessionSaved()) {
    throw new Error('LinkedIn session not found. Run: node scrapers/linkedinBot.js --login');
  }

  const { browser, context } = await launchBrowser(true);
  const profiles = [];

  try {
    await loadSession(context);
    const page = await context.newPage();

    if (!(await isLoggedIn(page))) {
      throw new Error('LinkedIn session expired. Run: node scrapers/linkedinBot.js --login');
    }

    // Navigate to People search
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}&origin=GLOBAL_SEARCH_HEADER`;
    console.log(`[LI:search] Searching: "${query}"`);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(3000, 6000);

    // Extract profile cards
    const cards = await page.$$eval('.entity-result__item, .search-result__info', items =>
      items.slice(0, 15).map(el => {
        const nameEl    = el.querySelector('.entity-result__title-text a, .actor-name');
        const headlineEl= el.querySelector('.entity-result__primary-subtitle, .search-result__truncate');
        const companyEl = el.querySelector('.entity-result__secondary-subtitle');
        const linkEl    = el.querySelector('.app-aware-link[href*="/in/"], a[href*="/in/"]');

        if (!linkEl) return null;

        const href = linkEl.href || '';
        const profileUrl = href.split('?')[0];
        if (!profileUrl.includes('/in/')) return null;

        return {
          profileUrl,
          name:     nameEl?.innerText?.trim()    || 'Unknown',
          headline: headlineEl?.innerText?.trim() || '',
          company:  companyEl?.innerText?.trim()  || '',
        };
      }).filter(Boolean)
    );

    for (const card of cards.slice(0, limit)) {
      if (card.profileUrl && !isOnCooldown(card.profileUrl)) {
        profiles.push(card);
      }
    }

    console.log(`[LI:search] Found ${profiles.length} new profiles for "${query}"`);
  } catch (err) {
    console.error('[LI:search] Error:', err.message);
  } finally {
    await browser.close();
  }

  return profiles;
}

// ── Send connection request ───────────────────────────────────────────────────

async function sendConnectionRequest(context, profileUrl, note) {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(4000, 8000);

    // Click Connect button
    const connectBtn = await page.$('button[aria-label*="Connect"], button.pv-s-profile-actions__overflow-action')
      || await page.$('button:has-text("Connect")');

    if (!connectBtn) {
      // Try the "More" dropdown
      const moreBtn = await page.$('button[aria-label*="More actions"]');
      if (moreBtn) {
        await moreBtn.click();
        await humanDelay(1500, 3000);
        const menuConnect = await page.$('div[aria-label*="Connect"], span:has-text("Connect")');
        if (menuConnect) await menuConnect.click();
      } else {
        throw new Error('Connect button not found — already connected or not a 2nd/3rd degree connection');
      }
    } else {
      await connectBtn.click();
    }

    await humanDelay(1500, 3000);

    // If modal asks "Add a note?" click "Add a note"
    const addNoteBtn = await page.$('button[aria-label="Add a note"]');
    if (addNoteBtn) {
      await addNoteBtn.click();
      await humanDelay(1000, 2000);

      const noteField = await page.$('textarea[name="message"], #custom-message');
      if (noteField && note) {
        await noteField.click();
        // Type note one character at a time with random delays (human-like)
        for (const char of note.slice(0, 300)) {
          await noteField.type(char, { delay: 30 + Math.random() * 70 });
        }
        await humanDelay(1000, 2000);
      }
    }

    // Click Send / Done
    const sendBtn = await page.$('button[aria-label="Send invitation"], button:has-text("Send")');
    if (sendBtn) {
      await sendBtn.click();
      await humanDelay(2000, 4000);
      console.log(`[LI:connect] ✓ Connection request sent to ${profileUrl}`);
      return { success: true };
    } else {
      throw new Error('Send button not found after modal interaction');
    }
  } finally {
    await page.close();
  }
}

// ── Send DM ───────────────────────────────────────────────────────────────────

async function sendDirectMessage(context, profileUrl, message) {
  const page = await context.newPage();
  try {
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded' });
    await humanDelay(4000, 8000);

    // Click Message button
    const msgBtn = await page.$('button[aria-label*="Message"], button:has-text("Message")');
    if (!msgBtn) throw new Error('Message button not found — not connected or messaging disabled');

    await msgBtn.click();
    await humanDelay(2000, 4000);

    // Type in message box
    const msgBox = await page.$('.msg-form__contenteditable, div[role="textbox"][aria-label*="Write a message"]');
    if (!msgBox) throw new Error('Message input not found');

    await msgBox.click();
    for (const char of message) {
      await msgBox.type(char, { delay: 20 + Math.random() * 60 });
    }
    await humanDelay(1500, 3000);

    // Send
    const sendBtn = await page.$('button.msg-form__send-button, button[type="submit"][aria-label*="Send"]');
    if (!sendBtn) throw new Error('Send button not found in DM modal');

    await sendBtn.click();
    await humanDelay(2000, 4000);
    console.log(`[LI:dm] ✓ DM sent to ${profileUrl}`);
    return { success: true };
  } finally {
    await page.close();
  }
}

// ── Execute approved queue items ──────────────────────────────────────────────

/**
 * Execute all approved queue items.
 * Respects daily rate limits and business hours.
 * Returns { executed, skipped, errors }
 */
export async function executeApprovedQueue() {
  if (!isSessionSaved()) {
    return { error: 'LinkedIn session not found. Run login first.' };
  }

  if (!isBusinessHoursIST()) {
    console.log('[LI:exec] Outside business hours IST — skipping execution');
    return { skipped: 'outside_business_hours' };
  }

  const approvedItems = getQueue('approved');
  if (!approvedItems.length) {
    console.log('[LI:exec] No approved items in queue');
    return { executed: 0, skipped: 0, errors: 0 };
  }

  let executed = 0;
  let skipped  = 0;
  let errors   = 0;

  const { browser, context } = await launchBrowser(true);

  try {
    await loadSession(context);
    const testPage = await context.newPage();
    if (!(await isLoggedIn(testPage))) {
      await browser.close();
      return { error: 'LinkedIn session expired. Run login again.' };
    }
    await testPage.close();

    for (const item of approvedItems) {
      try {
        // Check daily limits
        if (item.type === 'connect' && getDailyCount('connect') >= MAX_CONNECTS) {
          console.log(`[LI:exec] Daily connect limit (${MAX_CONNECTS}) reached — stopping`);
          break;
        }
        if (item.type === 'dm' && getDailyCount('dm') >= MAX_DMS) {
          console.log(`[LI:exec] Daily DM limit (${MAX_DMS}) reached — stopping`);
          break;
        }

        // Check cooldown
        if (isOnCooldown(item.profileUrl)) {
          console.log(`[LI:exec] ${item.name} is on cooldown — skipping`);
          skipped++;
          continue;
        }

        // Execute
        console.log(`[LI:exec] Executing ${item.type} for ${item.name}…`);

        if (item.type === 'connect') {
          await sendConnectionRequest(context, item.profileUrl, item.connectionNote);
        } else if (item.type === 'dm') {
          await sendDirectMessage(context, item.profileUrl, item.message);
        }

        markSent(item.id, true);
        executed++;

        // Human-like delay between actions (60-180 seconds between connections)
        const delayMs = item.type === 'connect'
          ? 60000 + Math.random() * 120000  // 1-3 min between connects
          : 30000 + Math.random() * 60000;  // 30-90 sec between DMs

        console.log(`[LI:exec] Waiting ${Math.round(delayMs / 1000)}s before next action…`);
        await new Promise(r => setTimeout(r, delayMs));

      } catch (err) {
        console.error(`[LI:exec] Error on ${item.id}:`, err.message);
        markSent(item.id, false, err.message);
        errors++;
        await humanDelay(5000, 10000); // brief pause on error
      }
    }

    // Save updated session cookies
    await saveSession(context);

  } finally {
    await browser.close();
  }

  console.log(`[LI:exec] Done: ${executed} executed, ${skipped} skipped, ${errors} errors`);
  return { executed, skipped, errors };
}

// ── Discovery run (search → draft → queue) ───────────────────────────────────

/**
 * Run one discovery cycle:
 *   - Pick a random search query
 *   - Find profiles
 *   - Draft connection notes
 *   - Add to queue (pending approval)
 *
 * Returns array of queued items.
 */
export async function runDiscovery(queryOverride = null) {
  const queries   = getSearchQueries();
  const query     = queryOverride || queries[Math.floor(Math.random() * queries.length)];
  const profiles  = await searchProfiles(query, 8);

  const queued = [];
  for (const profile of profiles) {
    // Skip if already in queue
    const existing = getQueue().find(q => q.profileUrl === profile.profileUrl);
    if (existing) continue;

    const connectionNote = await draftConnectionNote(profile);
    const followUpDM     = await draftFollowUpDM(profile);
    await humanDelay(1000, 3000); // pace Claude calls

    const item = addToQueue({
      type:           'connect',
      profileUrl:     profile.profileUrl,
      name:           profile.name,
      headline:       profile.headline,
      company:        profile.company,
      connectionNote,
      message:        followUpDM, // stored for later when connection accepted
    });
    queued.push(item);
  }

  console.log(`[LI:discovery] Queued ${queued.length} items from query: "${query}"`);
  return queued;
}

// ── CLI (login mode) ──────────────────────────────────────────────────────────

if (process.argv[2] === '--login') {
  loginInteractive().catch(console.error);
}
