/**
 * LinkedIn Messages — Phase 7
 *
 * Uses Claude to draft personalised connection notes and follow-up DMs.
 * Falls back to template messages when API key is not configured.
 *
 * Rules (hard-coded into prompts):
 *  - Connection note: ≤ 300 chars (LinkedIn hard limit)
 *  - DM: 30-60 words, one clear ask, sign as Vishal
 *  - Never promise unrealistic timelines
 *  - Never undercut minimum rate (Rs 300/hr or $8/hr)
 *  - No generic copy-paste vibes — must reference profile-specific detail
 */

import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const isMockAI = () => {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.startsWith('your_');
};

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Connection note (≤ 300 chars) ────────────────────────────────────────────

/**
 * Draft a personalised LinkedIn connection note.
 * @param {object} profile — { name, headline, company, postSnippet? }
 * @returns {string} Note ≤ 300 chars
 */
export async function draftConnectionNote(profile) {
  const { name, headline = '', company = '', postSnippet = '' } = profile;
  const firstName = name?.split(' ')[0] || 'there';

  if (isMockAI()) {
    // Deterministic template fallback
    const context = headline
      ? `I noticed your profile — ${headline.slice(0, 60)}`
      : company
        ? `I came across your company ${company}`
        : 'I came across your post';

    const note = `Hi ${firstName}, ${context}. I'm Vishal, a Full Stack Dev (React/Node.js/React Native) from Mumbai. Would love to connect and see if I can be useful to you or your team!`;
    return note.slice(0, 300);
  }

  try {
    const contextClue = postSnippet
      ? `Their recent post: "${postSnippet.slice(0, 200)}"`
      : `Their headline: "${headline}" at ${company}`;

    const res = await claude.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Write a LinkedIn connection note as Vishal, a Full Stack Developer from Mumbai (React, Node.js, React Native, MongoDB).

Target: ${name}
${contextClue}

Rules:
- Strictly ≤ 300 characters (COUNT carefully)
- Personal — reference something specific about them
- Warm but professional tone
- Mention Vishal is a Full Stack Dev
- End with a clear reason to connect (help them / collaboration / project)
- Do NOT use generic openers like "I saw your profile"
- Do NOT mention salary/rates
- No emojis

Output the note text ONLY. No quotes, no explanation.`,
      }],
    });

    const note = res.content[0].text.trim();
    return note.slice(0, 300); // hard limit safety
  } catch (err) {
    console.error('[LI:msg] Connection note error:', err.message);
    return `Hi ${firstName}, I came across your profile and I'm impressed by your work. I'm Vishal, a Full Stack Dev (React/Node.js) from Mumbai. Would love to connect!`.slice(0, 300);
  }
}

// ── Follow-up DM (after connection accepted) ─────────────────────────────────

/**
 * Draft a short follow-up DM for a newly connected profile.
 * @param {object} profile — { name, headline, company, postSnippet? }
 * @returns {string} DM text (30-60 words)
 */
export async function draftFollowUpDM(profile) {
  const { name, headline = '', company = '', postSnippet = '' } = profile;
  const firstName = name?.split(' ')[0] || 'there';

  if (isMockAI()) {
    return `Hi ${firstName}! Thanks for connecting. I'm Vishal — Full Stack Developer based in Mumbai. I specialise in React, Node.js, and React Native apps.

If you ever need help shipping a web or mobile product, I'd love to chat. What are you currently working on?

— Vishal`;
  }

  try {
    const contextClue = postSnippet
      ? `Their recent post/activity: "${postSnippet.slice(0, 200)}"`
      : `Their headline: "${headline}"${company ? ` at ${company}` : ''}`;

    const res = await claude.messages.create({
      model:      'claude-haiku-4-20250514',
      max_tokens: 160,
      messages: [{
        role: 'user',
        content: `Write a LinkedIn follow-up DM as Vishal, a Full Stack Developer from Mumbai (React, Node.js, React Native, MongoDB, 5+ years).

Target: ${firstName}
${contextClue}

Rules:
- 30-60 words total
- Reference something specific about them (why you're reaching out)
- One clear ask: either offer to help or ask what they're working on
- Warm and human — NOT salesy, NOT generic
- Sign as "— Vishal"
- Do NOT mention rates or pricing
- No emojis, no bullet points

Output the DM text ONLY.`,
      }],
    });

    return res.content[0].text.trim();
  } catch (err) {
    console.error('[LI:msg] Follow-up DM error:', err.message);
    return `Hi ${firstName}! Thanks for connecting. I'm Vishal — Full Stack Developer from Mumbai specialising in React, Node.js, and React Native. If you're working on any web or mobile projects, I'd love to see how I can help. What are you building?

— Vishal`;
  }
}

// ── Search query generator ───────────────────────────────────────────────────

/**
 * Generate LinkedIn search queries likely to surface hiring/project posts.
 * Returns an array of search strings.
 */
export function getSearchQueries() {
  return [
    'looking for react developer freelance',
    'need nodejs developer project',
    'hiring react native developer',
    'looking for full stack developer india',
    'need web developer urgent',
    'freelance developer needed react',
    'looking for mobile app developer',
    'need nextjs developer',
    'hiring frontend developer remote',
    'looking for mern stack developer',
  ];
}
