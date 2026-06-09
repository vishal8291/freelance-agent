/**
 * WhatsApp Bot — Phase 6
 *
 * Receives Twilio WhatsApp webhook → runs the same pipeline as emailLoop:
 *   booking intent → handleBookingFlow
 *   otherwise      → generateReply (Claude brain + RAG)
 *   4+ messages    → qualifyLead
 *   score ≥ 8      → fireHotLeadAlert
 *
 * Outbound: Twilio WhatsApp REST API (same client as Phase 4 alerter)
 * CRM key : "whatsapp:+91XXXXXXXXXX"  (source: 'whatsapp')
 */

import 'dotenv/config';
import crypto from 'crypto';
import { upsertLead, getLead, addMessage, updateLeadStatus } from './crm.js';
import { generateReply, qualifyLead }  from './brain.js';
import { fireHotLeadAlert, HOT_THRESHOLD } from './alerter.js';
import { handleBookingFlow } from './bookingBot.js';

// ── Env helpers ───────────────────────────────────────────────────────────────

const isTwilioReady = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  return sid && !sid.startsWith('AC_your');
};

const isMockAI = () => {
  const k = process.env.ANTHROPIC_API_KEY;
  return !k || k.startsWith('your_');
};

// ── Twilio outbound sender ────────────────────────────────────────────────────

export async function sendWhatsAppMessage(to, body) {
  const sid    = process.env.TWILIO_ACCOUNT_SID;
  const token  = process.env.TWILIO_AUTH_TOKEN;
  const from   = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

  // Normalise the to number
  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  if (!isTwilioReady()) {
    console.log(`[WA:out] MOCK → ${toWa}`);
    console.log(`[WA:out] "${body.slice(0, 80)}…"`);
    return { mock: true };
  }

  const url    = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth   = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ From: from, To: toWa, Body: body });

  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  const data = await res.json();
  if (data.error_code) throw new Error(`Twilio ${data.error_code}: ${data.message}`);
  return { sid: data.sid, mock: false };
}

// ── Twilio webhook signature verification (optional but recommended) ──────────

export function verifyTwilioSignature(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || token.startsWith('your_')) return true; // skip in mock mode

  const twilioSig = req.headers['x-twilio-signature'];
  if (!twilioSig) return false;

  // Build the URL (must match exactly what Twilio used — use env webhook URL)
  const url    = process.env.WHATSAPP_WEBHOOK_URL || `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body;

  // Sort params and append key+value pairs to URL
  const sortedKeys = Object.keys(params).sort();
  const paramStr   = sortedKeys.reduce((acc, k) => acc + k + params[k], url);

  const expected = crypto
    .createHmac('sha1', token)
    .update(paramStr)
    .digest('base64');

  return expected === twilioSig;
}

// ── Parse Twilio webhook body ─────────────────────────────────────────────────

export function parseWebhook(body) {
  const from    = body.From   || '';       // "whatsapp:+919876543210"
  const to      = body.To     || '';       // "whatsapp:+14155238886"
  const message = (body.Body  || '').trim();
  const waId    = body.WaId   || from.replace('whatsapp:', ''); // "+919876543210"
  const name    = body.ProfileName || body.ContactName || null;
  const msgSid  = body.MessageSid || '';

  return { from, to, message, waId, name, msgSid };
}

// ── Format reply for WhatsApp ─────────────────────────────────────────────────
// WhatsApp supports *bold*, _italic_, ~strikethrough~, but not markdown headers

function formatForWhatsApp(text) {
  return text
    .replace(/^#+\s+/gm, '*')          // ## heading → *heading
    .replace(/\*\*(.*?)\*\*/g, '*$1*') // **bold** → *bold*
    .replace(/__(.*?)__/g, '_$1_')     // __italic__ → _italic_
    .replace(/`(.*?)`/g, '`$1`')       // keep code
    .trim();
}

// ── Mock reply when AI not configured ────────────────────────────────────────

function mockReply(name) {
  return `Hi ${name || 'there'}! 👋 Thanks for reaching out to Vishal.

He's a Full Stack Developer based in Mumbai — React, Node.js, React Native, MongoDB.

Could you tell me a bit about your project? What are you looking to build?

— Vishal's assistant`;
}

// ── Core message processor ────────────────────────────────────────────────────

export async function processWhatsAppMessage(parsed) {
  const { from, message, waId, name } = parsed;

  // CRM key for WhatsApp leads
  const crmKey = `whatsapp:${waId}`;

  // Upsert lead
  const existing = getLead(crmKey);
  upsertLead(crmKey, {
    name:    name || existing?.name || waId,
    phone:   waId,
    source:  'whatsapp',
    status:  existing ? existing.status : 'new',
    channel: 'whatsapp',
  });

  addMessage(crmKey, 'user', message);

  const lead    = getLead(crmKey);
  const history = (lead.conversation || [])
    .slice(-10)
    .map(m => ({ role: m.role, content: m.content }));

  let replyText;

  // ── Phase 5: booking flow ─────────────────────────────────────────────────
  const bookingResult = await handleBookingFlow(message, lead);

  if (bookingResult?.type === 'booking_confirmed') {
    replyText = bookingResult.reply;
    upsertLead(crmKey, {
      bookingOffer: null,
      status:       'active',
      lastBooking:  bookingResult.booking,
    });
    console.log(`[WA] ✓ Booking confirmed for ${crmKey} at ${bookingResult.booking.slot.label}`);

  } else if (bookingResult?.type === 'slots_offered') {
    replyText = bookingResult.reply;
    upsertLead(crmKey, {
      bookingOffer: { slots: bookingResult.slots, offeredAt: new Date().toISOString() },
    });
    console.log(`[WA] ✓ Offered ${bookingResult.slots.length} slots to ${crmKey}`);

  } else if (isMockAI()) {
    replyText = mockReply(name);

  } else {
    // Regular AI reply via brain
    try {
      replyText = await generateReply(message, history.slice(0, -1), { senderName: name });
    } catch (err) {
      console.error('[WA] Brain error:', err.message);
      replyText = mockReply(name);
    }
  }

  // WhatsApp formatting pass
  replyText = formatForWhatsApp(replyText);

  // Store agent reply
  addMessage(crmKey, 'assistant', replyText);

  // ── Qualification after 4+ exchanges ─────────────────────────────────────
  const updated     = getLead(crmKey);
  const fullHistory = (updated?.conversation || []).map(m => ({ role: m.role, content: m.content }));

  if (fullHistory.length >= 4 && !isMockAI()) {
    try {
      const qualification = await qualifyLead(fullHistory);
      const newStatus     = qualification.score >= HOT_THRESHOLD ? 'hot' : 'active';
      updateLeadStatus(crmKey, newStatus, qualification);
      console.log(`[WA] Lead qualified: score=${qualification.score} status=${newStatus}`);

      if (qualification.score >= HOT_THRESHOLD) {
        const freshLead = getLead(crmKey);
        fireHotLeadAlert(freshLead, qualification).catch(err =>
          console.error('[WA] Alert error (non-fatal):', err.message)
        );
      }
    } catch (err) {
      console.error('[WA] Qualification error (non-fatal):', err.message);
    }
  }

  return replyText;
}
