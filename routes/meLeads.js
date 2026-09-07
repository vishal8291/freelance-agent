import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getAllLeads, upsertLead, updateLeadStatus, getStats } from '../agent/crmDb.js';

const router = express.Router();
router.use(requireAuth);

router.get('/stats', async (req, res) => {
  try {
    res.json(await getStats(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leads', async (req, res) => {
  try {
    res.json(await getAllLeads(req.userId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/leads', async (req, res) => {
  try {
    const { email, ...updates } = req.body;
    if (!email) return res.status(400).json({ error: 'email is required' });
    const lead = await upsertLead(req.userId, email, updates);
    res.status(201).json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/leads/:email/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const lead = await updateLeadStatus(req.userId, decodeURIComponent(req.params.email), status);
    res.json(lead);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
