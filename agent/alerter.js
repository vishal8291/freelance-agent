/**
 * Hot Lead Alerter — Phase 4
 *
 * Fires when a lead scores 8+/10.
 * Channels: Email (Gmail direct send) + WhatsApp (Twilio REST API)
 * Cooldown: 1 alert per lead per 24 hours — no spam.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendDirectEmail } from './gmail.js';
import 'dotenv/config';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ALERT_LOG  = path.join(__dirname, '..', 'data', 'alerts.json');
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
const HOT_THRESHOLD = 8;

// ── Alert log helpers ──────────────────────────────────────────────────────

function loadLog() {
  if (!fs.existsSync(ALERT_LOG)) {
    fs.writeFileSync(ALERT_LOG, JSON.stringify({ alerts: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(ALERT_LOG, 'utf-8'));
}

function saveLog(data) {
  fs.writeFileSync(ALERT_LOG, JSON.stringify(data, null, 2));
}

function logAlert(leadEmail, lead, qualification, channels) {
  const data = loadLog();
  data.alerts.unshift({
    id:         `alert_${Date.now()}`,
    leadEmail,
    leadName:   lead.name || leadEmail,
    score:      qualification.score,
    readiness:  qualification.readiness,
    projectType:qualification.projectType || null,
    budget:     qualification.budget      || null,
    timeline:   qualification.timeline    || null,
    summary:    qualification.summary     || null,
    channels,
    firedAt:    new Date().toISOString(),
  });
  saveLog(data);
}

function isOnCooldown(leadEmail) {
  const { alerts } = loadLog();
  const last = alerts.find(a => a.leadEmail === leadEmail);
  if (!last) return false;
  return Date.now() - new Date(last.firedAt).getTime() < COOLDOWN_MS;
}

export function getAlerts() {
  return loadLog().alerts;
}

// ── Email alert ────────────────────────────────────────────────────────────

async function sendEmailAlert(lead, qualification) {
  const to        = process.env.ALERT_EMAIL || process.env.GMAIL_ADDRESS;
  const gmailReady = process.env.GMAIL_CLIENT_ID && !process.env.GMAIL_CLIENT_ID.includes('your_');
  const isMock    = !to || to.includes('youremail') || !gmailReady;

  const subject = `🔥 Hot lead: ${lead.name || lead.email} scored ${qualification.score}/10`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e5e5e5; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 0 auto; padding: 32px 16px; }
    .card { background: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a; overflow: hidden; }
    .header { background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 24px; }
    .header h1 { margin: 0; font-size: 22px; color: #fff; }
    .header p  { margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.7); }
    .body  { padding: 24px; }
    .score-ring { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 50%; background: #f97316; color: #fff; font-size: 20px; font-weight: 800; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .cell { background: #242424; border-radius: 10px; padding: 12px; }
    .cell .label { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #666; margin-bottom: 4px; }
    .cell .value { font-size: 14px; font-weight: 600; color: #fff; }
    .summary { background: #1e1040; border: 1px solid #4f46e5; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; color: #a78bfa; line-height: 1.5; }
    .action { background: #7c3aed; color: #fff; border-radius: 10px; padding: 14px 20px; text-align: center; text-decoration: none; display: block; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { padding: 16px 24px; border-top: 1px solid #2a2a2a; font-size: 11px; color: #555; text-align: center; }
  </style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="header">
      <h1>🔥 Hot Lead Alert</h1>
      <p>Your FreelanceAI agent flagged a high-value prospect</p>
    </div>
    <div class="body">
      <div class="score-ring">${qualification.score}</div>
      <h2 style="margin:0 0 4px;font-size:18px;color:#fff">${lead.name || 'Unknown'}</h2>
      <p style="margin:0;font-size:13px;color:#888">${lead.email}</p>

      <div class="grid">
        <div class="cell">
          <div class="label">Readiness</div>
          <div class="value" style="color:${qualification.readiness === 'hot' ? '#f97316' : '#eab308'}">${(qualification.readiness || '—').toUpperCase()}</div>
        </div>
        <div class="cell">
          <div class="label">Score</div>
          <div class="value">${qualification.score} / 10</div>
        </div>
        <div class="cell">
          <div class="label">Budget</div>
          <div class="value">${qualification.budget || '—'}</div>
        </div>
        <div class="cell">
          <div class="label">Timeline</div>
          <div class="value">${qualification.timeline || '—'}</div>
        </div>
      </div>

      ${qualification.projectType ? `<div class="cell" style="margin-bottom:0"><div class="label">Project</div><div class="value">${qualification.projectType}</div></div>` : ''}

      ${qualification.summary ? `<div class="summary">"${qualification.summary}"</div>` : ''}

      <div class="cell" style="margin-top:16px">
        <div class="label">Recommended next action</div>
        <div class="value" style="color:#34d399">${qualification.nextAction || 'Follow up immediately'}</div>
      </div>

      <a class="action" href="mailto:${lead.email}">Reply to ${lead.name || 'this lead'} now →</a>
    </div>
    <div class="footer">FreelanceAI Agent · vishal.buildss@gmail.com · Mumbai, India</div>
  </div>
</div>
</body>
</html>`;

  if (isMock) {
    console.log(`[ALERT:email] MOCK — would send to ${to || 'no address set'}`);
    console.log(`  Subject: ${subject}`);
    return { channel: 'email', status: 'mock', to };
  }

  try {
    await sendDirectEmail(to, subject, html);
    console.log(`[ALERT:email] ✓ Sent to ${to}`);
    return { channel: 'email', status: 'sent', to };
  } catch (err) {
    console.error(`[ALERT:email] ✗ Failed:`, err.message);
    return { channel: 'email', status: 'error', error: err.message };
  }
}

// ── WhatsApp alert (Twilio REST) ───────────────────────────────────────────

async function sendWhatsAppAlert(lead, qualification) {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const from   = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'; // Twilio sandbox default
  const to     = process.env.ALERT_WHATSAPP_TO;
  const isMock = !sid || !token || sid.startsWith('AC_your') || !to;

  const stars  = '⭐'.repeat(Math.min(qualification.score, 5));
  const body   = [
    `🔥 *HOT LEAD ALERT* — Score: ${qualification.score}/10 ${stars}`,
    ``,
    `👤 *${lead.name || 'Unknown'}*`,
    `📧 ${lead.email}`,
    ``,
    `💰 Budget: ${qualification.budget || 'Not specified'}`,
    `📅 Timeline: ${qualification.timeline || 'Not specified'}`,
    `🚀 Project: ${qualification.projectType || 'Not specified'}`,
    ``,
    `📊 Readiness: ${(qualification.readiness || 'warm').toUpperCase()}`,
    ``,
    `💬 "${qualification.summary || 'High-value prospect — act now'}"`,
    ``,
    `→ Reply to them: ${lead.email}`,
    ``,
    `_FreelanceAI Agent_`,
  ].join('\n');

  if (isMock) {
    console.log(`[ALERT:whatsapp] MOCK — would send to ${to || 'no number set'}`);
    console.log(`  Message preview: ${body.slice(0, 80)}…`);
    return { channel: 'whatsapp', status: 'mock', to };
  }

  try {
    const url  = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');

    const params = new URLSearchParams({
      From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
      To:   to.startsWith('whatsapp:')   ? to   : `whatsapp:${to}`,
      Body: body,
    });

    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    });

    const data = await res.json();
    if (data.error_code) throw new Error(`Twilio error ${data.error_code}: ${data.message}`);

    console.log(`[ALERT:whatsapp] ✓ Sent to ${to} (SID: ${data.sid})`);
    return { channel: 'whatsapp', status: 'sent', sid: data.sid, to };
  } catch (err) {
    console.error(`[ALERT:whatsapp] ✗ Failed:`, err.message);
    return { channel: 'whatsapp', status: 'error', error: err.message };
  }
}

// ── Main entry point ───────────────────────────────────────────────────────

export async function fireHotLeadAlert(lead, qualification) {
  if (!qualification || qualification.score < HOT_THRESHOLD) return null;

  if (isOnCooldown(lead.email)) {
    console.log(`[ALERT] Cooldown active for ${lead.email} — skipping`);
    return null;
  }

  console.log(`\n🔥 HOT LEAD DETECTED: ${lead.name || lead.email} — score ${qualification.score}/10`);

  const [emailResult, waResult] = await Promise.allSettled([
    sendEmailAlert(lead, qualification),
    sendWhatsAppAlert(lead, qualification),
  ]);

  const channels = [
    emailResult.status === 'fulfilled' ? emailResult.value : { channel: 'email', status: 'error', error: emailResult.reason?.message },
    waResult.status   === 'fulfilled' ? waResult.value   : { channel: 'whatsapp', status: 'error', error: waResult.reason?.message },
  ];

  logAlert(lead.email, lead, qualification, channels);
  return channels;
}

export { HOT_THRESHOLD };
