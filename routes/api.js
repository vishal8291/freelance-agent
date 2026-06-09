import express from 'express';
import { getAllLeads, getStats, updateLeadStatus, getLead } from '../agent/crm.js';
import { processInbox } from '../agent/emailLoop.js';
import { getAuthUrl, exchangeCode } from '../agent/gmail.js';
import { generateProposalContent } from '../agent/proposalGenerator.js';
import { generateProposalPDF } from '../agent/proposalPDF.js';
import { saveProposal, getProposal, getAllProposals, getProposalsByLead } from '../agent/proposalStore.js';
import { fireHotLeadAlert, getAlerts, HOT_THRESHOLD } from '../agent/alerter.js';
import { getFreeSlots, createMeeting, getUpcomingMeetings } from '../agent/calendar.js';
import { getBookings, logBooking } from '../agent/bookingBot.js';
import { parseWebhook, processWhatsAppMessage, sendWhatsAppMessage, verifyTwilioSignature } from '../agent/whatsappBot.js';
import {
  runDiscovery, searchProfiles, executeApprovedQueue, isSessionSaved,
} from '../scrapers/linkedinBot.js';
import {
  addToQueue, getQueue, approveItem, rejectItem, getQueueStats, getLog,
} from '../scrapers/linkedinQueue.js';

const router = express.Router();

router.get('/stats', (req, res) => {
  res.json(getStats());
});

router.get('/leads', (req, res) => {
  const leads = getAllLeads();
  res.json(leads);
});

router.patch('/leads/:email/status', (req, res) => {
  const { email } = req.params;
  const { status } = req.body;
  const lead = updateLeadStatus(decodeURIComponent(email), status);
  res.json(lead);
});

router.post('/run-now', async (req, res) => {
  try {
    const result = await processInbox();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/auth/gmail', (req, res) => {
  res.redirect(getAuthUrl());
});

router.get('/auth/gmail/callback', async (req, res) => {
  try {
    const tokens = await exchangeCode(req.query.code);
    res.json({
      message: 'Copy this refresh_token to your .env file',
      refresh_token: tokens.refresh_token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── WhatsApp Bot ─────────────────────────────────────────────────

/**
 * Twilio webhook — receives incoming WhatsApp messages.
 * Set this URL in Twilio console → Messaging → Sandbox settings → "When a message comes in"
 *   https://YOUR-NGROK-URL/api/whatsapp/webhook
 */
router.post('/whatsapp/webhook', async (req, res) => {
  // Optional signature check (skipped in mock/dev mode)
  if (!verifyTwilioSignature(req)) {
    console.warn('[WA] Invalid Twilio signature — rejecting');
    return res.status(403).send('<Response></Response>');
  }

  const parsed = parseWebhook(req.body);
  console.log(`[WA:in] From ${parsed.from} (${parsed.name || 'unknown'}): "${parsed.message.slice(0, 60)}"`);

  // Process async — respond with empty TwiML immediately to avoid timeout
  // then send reply via REST API separately
  res.set('Content-Type', 'text/xml');
  res.send('<Response></Response>');

  // Non-blocking process + outbound reply
  setImmediate(async () => {
    try {
      const replyText = await processWhatsAppMessage(parsed);
      await sendWhatsAppMessage(parsed.from, replyText);
      console.log(`[WA:out] → ${parsed.from}: "${replyText.slice(0, 60)}…"`);
    } catch (err) {
      console.error('[WA] Processing error:', err.message);
    }
  });
});

// Manual outbound send from dashboard
router.post('/whatsapp/send', async (req, res) => {
  try {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message required' });
    const result = await sendWhatsAppMessage(to, message);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get WhatsApp leads (source: whatsapp)
router.get('/whatsapp/leads', (req, res) => {
  const waLeads = getAllLeads().filter(l => l.source === 'whatsapp');
  res.json(waLeads);
});

// ── Calendar / Bookings ──────────────────────────────────────────

// Get free slots (for dashboard manual booking)
router.get('/calendar/slots', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 3;
    const slots = await getFreeSlots(count);
    res.json(slots.map(s => ({ ...s, start: s.start.toISOString(), end: s.end.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get upcoming calendar meetings
router.get('/calendar/upcoming', async (req, res) => {
  try {
    const meetings = await getUpcomingMeetings();
    res.json(meetings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manually book a call for a lead (from dashboard)
router.post('/calendar/book', async (req, res) => {
  try {
    const { email, slotStart, slotEnd, slotLabel, notes } = req.body;
    if (!email || !slotStart) return res.status(400).json({ error: 'email and slotStart required' });

    const lead = getLead(email);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const slot = {
      start: new Date(slotStart),
      end:   slotEnd ? new Date(slotEnd) : new Date(new Date(slotStart).getTime() + 30 * 60 * 1000),
      label: slotLabel || slotStart,
    };

    const event = await createMeeting(lead, slot, notes || '');
    logBooking(lead, slot, event);

    res.json({ success: true, event, booking: { leadEmail: email, slot, event } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// List all bookings
router.get('/bookings', (req, res) => {
  res.json(getBookings());
});

// ── Alerts ───────────────────────────────────────────────────────

// Get alert history
router.get('/alerts', (req, res) => {
  res.json(getAlerts());
});

// Manually fire a test alert for a specific lead
router.post('/alerts/test', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'email required' });

    const lead = getLead(email);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Use existing qualification or build a test one
    const qualification = lead.qualification || {
      score: HOT_THRESHOLD,
      readiness: 'hot',
      projectType: lead.projectType || 'Web application',
      budget: null,
      timeline: null,
      summary: 'Test alert fired manually from dashboard',
      nextAction: 'Follow up immediately',
    };

    // Force fire by temporarily bypassing cooldown — clone with forced high score
    const testQualification = { ...qualification, score: Math.max(qualification.score, HOT_THRESHOLD) };
    const channels = await fireHotLeadAlert(lead, testQualification);

    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fire alert for any arbitrary payload (used from dashboard's "test" flow)
router.post('/alerts/fire', async (req, res) => {
  try {
    const { lead, qualification } = req.body;
    if (!lead || !qualification) return res.status(400).json({ error: 'lead and qualification required' });
    const channels = await fireHotLeadAlert(lead, qualification);
    res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Proposals ────────────────────────────────────────────────────

// Generate proposal for a lead (returns JSON + saves it)
router.post('/proposals/generate', async (req, res) => {
  try {
    const { email, leadData } = req.body;
    if (!email && !leadData) {
      return res.status(400).json({ error: 'email or leadData required' });
    }

    const lead = leadData || getLead(email) || { email, conversation: [], qualification: {} };
    const content = await generateProposalContent(lead);
    const proposal = saveProposal(lead.email || email, content);

    res.json({ success: true, proposalId: proposal.id, proposal: proposal.content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download proposal as PDF
router.get('/proposals/:id/pdf', async (req, res) => {
  try {
    const proposal = getProposal(req.params.id);
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    const pdfBuffer = await generateProposalPDF(proposal.content);

    const filename = `proposal-${proposal.content.clientName.replace(/\s+/g, '-')}-${proposal.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all proposals
router.get('/proposals', (req, res) => {
  const { email } = req.query;
  const proposals = email ? getProposalsByLead(email) : getAllProposals();
  res.json(proposals.map(p => ({
    id: p.id,
    leadEmail: p.leadEmail,
    createdAt: p.createdAt,
    projectTitle: p.content.projectTitle,
    clientName: p.content.clientName,
    amount: p.content.price.amount,
    currency: p.content.price.currency,
    mock: p.content.mock || false,
  })));
});

// Preview proposal JSON (for dashboard rendering)
router.get('/proposals/:id', (req, res) => {
  const proposal = getProposal(req.params.id);
  if (!proposal) return res.status(404).json({ error: 'Proposal not found' });
  res.json(proposal);
});

// ── LinkedIn DM Bot (Phase 7) ────────────────────────────────────────────────

// Queue stats + status
router.get('/linkedin/status', (req, res) => {
  res.json({
    sessionSaved: isSessionSaved(),
    stats: getQueueStats(),
  });
});

// Get queue items (all or by status)
router.get('/linkedin/queue', (req, res) => {
  const { status } = req.query;
  res.json(getQueue(status || null));
});

// Get audit log
router.get('/linkedin/log', (req, res) => {
  res.json(getLog());
});

// Run discovery: search → draft → queue (non-blocking)
router.post('/linkedin/discover', async (req, res) => {
  try {
    const { query } = req.body;
    if (!isSessionSaved()) {
      return res.status(400).json({
        error: 'LinkedIn session not found. Run: node scrapers/linkedinBot.js --login',
        setupRequired: true,
      });
    }
    // Run async — respond immediately with job started
    res.json({ success: true, message: 'Discovery started — check /linkedin/queue for results' });
    setImmediate(async () => {
      try {
        const items = await runDiscovery(query || null);
        console.log(`[LI:api] Discovery queued ${items.length} items`);
      } catch (err) {
        console.error('[LI:api] Discovery error:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve a queue item
router.post('/linkedin/queue/:id/approve', (req, res) => {
  try {
    const item = approveItem(req.params.id);
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Reject a queue item
router.post('/linkedin/queue/:id/reject', (req, res) => {
  try {
    const item = rejectItem(req.params.id);
    res.json({ success: true, item });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// Execute all approved items (headless)
router.post('/linkedin/execute', async (req, res) => {
  try {
    if (!isSessionSaved()) {
      return res.status(400).json({
        error: 'LinkedIn session not found. Run login first.',
        setupRequired: true,
      });
    }
    // Non-blocking — execution can take minutes
    res.json({ success: true, message: 'Execution started — results will appear in /linkedin/log' });
    setImmediate(async () => {
      try {
        const result = await executeApprovedQueue();
        console.log('[LI:api] Execution result:', result);
      } catch (err) {
        console.error('[LI:api] Execution error:', err.message);
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual add to queue (e.g., paste a LinkedIn URL from dashboard)
router.post('/linkedin/queue/add', async (req, res) => {
  try {
    const { profileUrl, name, headline, company, type = 'connect' } = req.body;
    if (!profileUrl) return res.status(400).json({ error: 'profileUrl required' });

    // Import message drafters lazily
    const { draftConnectionNote, draftFollowUpDM } = await import('../scrapers/linkedinMessages.js');
    const profile = { name: name || 'Unknown', headline: headline || '', company: company || '' };

    const connectionNote = await draftConnectionNote(profile);
    const followUpDM     = await draftFollowUpDM(profile);

    const item = addToQueue({
      type,
      profileUrl,
      name:  profile.name,
      headline: profile.headline,
      company:  profile.company,
      connectionNote,
      message: followUpDM,
    });
    res.json({ success: true, item });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
