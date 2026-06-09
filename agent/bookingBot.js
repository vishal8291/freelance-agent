/**
 * Booking Bot — Phase 5
 *
 * Three-step flow per email thread:
 *   1. detectBookingIntent(message)          → boolean
 *   2. handleSlotOffer(lead)                 → reply string offering 3 slots
 *   3. detectSlotConfirmation(message, slots) → slot object or null
 *      └─ on match → createMeeting + handleBookingConfirmed reply
 *
 * All Claude calls fall back to template text when API key is missing.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFreeSlots, createMeeting, formatSlot } from './calendar.js';
import 'dotenv/config';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const BOOK_DB    = path.join(__dirname, '..', 'data', 'bookings.json');

const isMockAI   = () => {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.startsWith('your_');
};
const claude     = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Bookings store ────────────────────────────────────────────────────────────

function loadBookings() {
  if (!fs.existsSync(BOOK_DB)) fs.writeFileSync(BOOK_DB, JSON.stringify({ bookings: [] }, null, 2));
  return JSON.parse(fs.readFileSync(BOOK_DB, 'utf-8'));
}
function saveBookings(data) { fs.writeFileSync(BOOK_DB, JSON.stringify(data, null, 2)); }

export function logBooking(lead, slot, event) {
  const db = loadBookings();
  db.bookings.unshift({
    id:        `book_${Date.now()}`,
    leadEmail: lead.email,
    leadName:  lead.name || lead.email,
    slot:      { start: slot.start, end: slot.end, label: slot.label },
    eventId:   event.eventId,
    meetLink:  event.meetLink,
    htmlLink:  event.htmlLink,
    mock:      event.mock || false,
    status:    'confirmed',
    bookedAt:  new Date().toISOString(),
  });
  saveBookings(db);
}

export function getBookings() { return loadBookings().bookings; }

// ── Intent detection ──────────────────────────────────────────────────────────

const BOOKING_KEYWORDS = [
  'schedule', 'book', 'meeting', 'call', 'connect', 'chat', 'talk',
  'zoom', 'meet', 'google meet', 'video call', 'hop on', 'catch up',
  'available', 'free slot', 'appointment', 'discuss', 'sync',
];

/**
 * Returns true if the message is requesting to schedule a call/meeting.
 * Uses keyword pre-filter first (fast), then Claude for ambiguous cases.
 */
export async function detectBookingIntent(message) {
  const lower = message.toLowerCase();
  const hasKeyword = BOOKING_KEYWORDS.some(kw => lower.includes(kw));
  if (!hasKeyword) return false;

  // Fast positive patterns — no LLM needed
  const strongPatterns = [
    /can we (schedule|book|set up|arrange|hop on|jump on|have|do).{0,30}(call|meeting|chat|talk)/i,
    /let('s| us) (hop on|jump on|get on|do|have).{0,20}(call|meeting|chat)/i,
    /are you (free|available).{0,30}(call|meet|chat|talk)/i,
    /would (love|like) to (talk|chat|connect|meet|discuss)/i,
    /book.{0,15}(slot|time|appointment|session)/i,
    /(zoom|google meet|teams|video call).{0,20}(call|meet|chat)?/i,
    /schedule.{0,20}(meeting|call|session|demo)/i,
    /(hop|jump) on.{0,20}(call|meeting|chat)/i,
    /quick (call|chat|meeting|sync|talk)/i,
    /catch up (over|on).{0,15}(call|zoom|meet)/i,
    /(call|meet|chat|talk|connect) with you/i,
  ];
  if (strongPatterns.some(p => p.test(message))) return true;

  // Use Claude for edge cases (only if API key is set)
  if (isMockAI()) return false;

  try {
    const res = await claude.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `Does this email request scheduling a call or meeting? Reply only YES or NO.\n\n"${message.slice(0, 400)}"`,
      }],
    });
    return res.content[0].text.trim().toUpperCase().startsWith('YES');
  } catch {
    return false;
  }
}

// ── Slot offer reply ──────────────────────────────────────────────────────────

/**
 * Generates a reply offering 3 free slots.
 * Returns { reply: string, slots: Slot[] }
 */
export async function buildSlotOfferReply(lead, clientMessage) {
  const slots = await getFreeSlots(3);

  const slotList = slots
    .map((s, i) => `Option ${i + 1}: ${s.label}`)
    .join('\n');

  if (isMockAI()) {
    const reply = `Hi ${lead.name?.split(' ')[0] || 'there'},

Thanks for reaching out! I'd love to connect and discuss your project in more detail.

Here are three slots that work for me (IST):

${slotList}

Please reply with which option works for you, and I'll send a Google Meet invite right away.

Looking forward to speaking with you!

Vishal`;
    return { reply, slots };
  }

  try {
    const res = await claude.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are replying as Vishal, a Full Stack Developer from Mumbai.

The client sent this: "${clientMessage.slice(0, 300)}"

They want to schedule a discovery call. Offer these exact 3 time slots in your reply:
${slotList}

Write a warm, brief reply (under 80 words) that:
- Acknowledges their interest
- Lists the 3 slots clearly
- Asks them to pick one
- Says you'll send a Google Meet invite immediately
- Signs off as "Vishal"

Do NOT add any extra slots or change the times.`,
      }],
    });
    return { reply: res.content[0].text.trim(), slots };
  } catch {
    // Fallback to template
    const reply = `Hi ${lead.name?.split(' ')[0] || 'there'},

Happy to connect! Here are three slots that work for a quick discovery call (IST):

${slotList}

Just reply with your preferred option and I'll shoot over a Google Meet link.

Vishal`;
    return { reply, slots };
  }
}

// ── Slot confirmation detection ───────────────────────────────────────────────

/**
 * Given the client's reply and the previously offered slots,
 * returns the confirmed Slot or null.
 */
export async function detectSlotConfirmation(message, offeredSlots) {
  if (!offeredSlots?.length) return null;

  const lower = message.toLowerCase();

  // Check for "option 1/2/3" or ordinal patterns
  const optionMatch = lower.match(/option\s*([123])|([123])(st|nd|rd)|first|second|third/i);
  if (optionMatch) {
    const idx =
      (optionMatch[1] ? parseInt(optionMatch[1]) - 1 : null) ??
      (optionMatch[2] ? parseInt(optionMatch[2]) - 1 : null) ??
      (['first','second','third'].findIndex(w => lower.includes(w)));
    if (idx >= 0 && idx < offeredSlots.length) return offeredSlots[idx];
  }

  // Check if any slot label fragment appears in message
  for (const slot of offeredSlots) {
    const parts = slot.label.split('·').map(p => p.trim().toLowerCase());
    if (parts.some(p => lower.includes(p))) return slot;
  }

  // Day-of-week matching (e.g. "Monday works", "Tuesday is fine")
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  for (const slot of offeredSlots) {
    const slotDay = days[new Date(slot.start).getDay()].toLowerCase();
    if (lower.includes(slotDay)) return slot;
  }

  // Use Claude for natural language ("the second one", "works for me", etc.)
  if (isMockAI() || offeredSlots.length === 0) return null;

  try {
    const slotDescriptions = offeredSlots
      .map((s, i) => `Slot ${i + 1}: ${s.label}`)
      .join('\n');

    const res = await claude.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 10,
      messages: [{
        role: 'user',
        content: `The client was offered these meeting slots:\n${slotDescriptions}\n\nClient replied: "${message.slice(0, 300)}"\n\nWhich slot number did they confirm? Reply ONLY with 1, 2, 3, or NONE.`,
      }],
    });
    const txt = res.content[0].text.trim();
    const n   = parseInt(txt);
    if (!isNaN(n) && n >= 1 && n <= offeredSlots.length) return offeredSlots[n - 1];
  } catch { /* fall through */ }

  return null;
}

// ── Booking confirmation reply ────────────────────────────────────────────────

export async function buildConfirmationReply(lead, slot, event) {
  const slotLabel = slot.label;
  const meetLink  = event.meetLink || '(Meet link will follow)';
  const firstName = lead.name?.split(' ')[0] || 'there';

  if (isMockAI()) {
    return `Hi ${firstName},

Confirmed! I've booked our discovery call for ${slotLabel}.

${event.mock ? '🔗 Google Meet link: https://meet.google.com/xxx-yyyy-zzz (mock)' : `🔗 Join here: ${meetLink}`}

You should receive a calendar invite shortly. Looking forward to understanding your project and discussing how I can help!

See you then,
Vishal`;
  }

  try {
    const res = await claude.messages.create({
      model: 'claude-haiku-4-20250514',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Write a booking confirmation reply as Vishal (Full Stack Developer, Mumbai).

Confirmed slot: ${slotLabel}
Google Meet link: ${meetLink}
Client name: ${firstName}

Keep it under 60 words. Be warm and professional. Include the Meet link. Sign as "Vishal".`,
      }],
    });
    return res.content[0].text.trim();
  } catch {
    return `Hi ${firstName},\n\nGreat — confirmed for ${slotLabel}!\n\n🔗 Join here: ${meetLink}\n\nCalendar invite on its way. Talk soon!\n\nVishal`;
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Called from emailLoop BEFORE the regular reply.
 *
 * Returns one of:
 *   null                              → no booking action, proceed with normal reply
 *   { type: 'slots_offered',  reply, slots }   → use this reply, store slots on lead
 *   { type: 'booking_confirmed', reply, booking } → use this reply, booking created
 */
export async function handleBookingFlow(message, lead) {
  // ── Case 1: lead already has offered slots → check if this is a confirmation
  if (lead.bookingOffer?.slots?.length) {
    const offeredSlots = lead.bookingOffer.slots.map(s => ({
      ...s,
      start: new Date(s.start),
      end:   new Date(s.end),
    }));

    const confirmedSlot = await detectSlotConfirmation(message, offeredSlots);
    if (confirmedSlot) {
      const event = await createMeeting(lead, confirmedSlot, lead.qualification?.projectType || '');
      logBooking(lead, confirmedSlot, event);
      const reply = await buildConfirmationReply(lead, confirmedSlot, event);
      return {
        type:    'booking_confirmed',
        reply,
        booking: { slot: confirmedSlot, event },
      };
    }
  }

  // ── Case 2: message requests a meeting → offer slots
  const wantsToBook = await detectBookingIntent(message);
  if (wantsToBook) {
    const { reply, slots } = await buildSlotOfferReply(lead, message);
    return { type: 'slots_offered', reply, slots };
  }

  return null;
}
