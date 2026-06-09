import { fetchUnreadEmails, sendReply, markAsRead } from './gmail.js';
import { generateReply, qualifyLead } from './brain.js';
import { upsertLead, getLead, addMessage, updateLeadStatus } from './crm.js';
import { fireHotLeadAlert, HOT_THRESHOLD } from './alerter.js';
import { handleBookingFlow } from './bookingBot.js';

const IGNORED_SENDERS = ['noreply', 'no-reply', 'mailer-daemon', 'notifications'];

export async function processInbox() {
  console.log(`[${new Date().toLocaleTimeString()}] Checking inbox...`);

  let emails;
  try {
    emails = await fetchUnreadEmails(5);
  } catch (err) {
    console.error('Gmail fetch failed:', err.message);
    return { processed: 0, error: err.message };
  }

  if (!emails.length) {
    console.log('  No unread emails.');
    return { processed: 0 };
  }

  let processed = 0;

  for (const email of emails) {
    try {
      if (IGNORED_SENDERS.some(s => email.from.toLowerCase().includes(s))) {
        await markAsRead(email.id);
        continue;
      }

      console.log(`  Processing email from ${email.senderName} <${email.senderEmail}>`);

      const existingLead = getLead(email.senderEmail);
      const history = existingLead?.conversation?.map(m => ({
        role: m.role, content: m.content,
      })) || [];

      upsertLead(email.senderEmail, {
        name:   email.senderName,
        subject: email.subject,
        source: 'gmail',
        status: existingLead ? existingLead.status : 'new',
      });

      addMessage(email.senderEmail, 'user', email.body);

      // ── Phase 5: booking flow check (runs before regular reply) ─────────────
      const lead         = getLead(email.senderEmail);
      const bookingResult = await handleBookingFlow(email.body, lead);

      let replyText;

      if (bookingResult?.type === 'booking_confirmed') {
        replyText = bookingResult.reply;
        // Clear the pending offer, mark lead as booked
        upsertLead(email.senderEmail, {
          bookingOffer: null,
          status: 'active',
          lastBooking: bookingResult.booking,
        });
        console.log(`  ✓ Booking confirmed for ${email.senderEmail} at ${bookingResult.booking.slot.label}`);

      } else if (bookingResult?.type === 'slots_offered') {
        replyText = bookingResult.reply;
        // Persist the offered slots so next email can match a confirmation
        upsertLead(email.senderEmail, {
          bookingOffer: {
            slots:     bookingResult.slots,
            offeredAt: new Date().toISOString(),
          },
        });
        console.log(`  ✓ Offered ${bookingResult.slots.length} slots to ${email.senderEmail}`);

      } else {
        // Regular AI reply
        replyText = await generateReply(email.body, history, { senderName: email.senderName });
      }

      await sendReply(email.threadId, email.senderEmail, email.subject, replyText);
      addMessage(email.senderEmail, 'assistant', replyText);

      // ── Lead qualification (every 4+ messages) ────────────────────────────
      const updatedLead  = getLead(email.senderEmail);
      const fullHistory  = updatedLead?.conversation?.map(m => ({
        role: m.role, content: m.content,
      })) || [];

      if (fullHistory.length >= 4) {
        const qualification = await qualifyLead(fullHistory);
        const newStatus = qualification.score >= HOT_THRESHOLD ? 'hot' : 'active';
        updateLeadStatus(email.senderEmail, newStatus, qualification);
        console.log(`  Lead qualified: score=${qualification.score} readiness=${qualification.readiness} status=${newStatus}`);

        if (qualification.score >= HOT_THRESHOLD) {
          const freshLead = getLead(email.senderEmail);
          fireHotLeadAlert(freshLead, qualification).catch(err =>
            console.error('  Alert failed (non-fatal):', err.message)
          );
        }
      }

      await markAsRead(email.id);
      processed++;
      console.log(`  Replied to ${email.senderEmail}`);

    } catch (err) {
      console.error(`  Failed to process email from ${email.senderEmail}:`, err.message);
    }
  }

  return { processed };
}
