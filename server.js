import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import 'dotenv/config';
import apiRouter from './routes/api.js';
import { processInbox } from './agent/emailLoop.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api', apiRouter);

app.get('/', (req, res) => {
  res.json({
    status: 'Agent running',
    time: new Date().toISOString(),
    endpoints: {
      stats:              'GET  /api/stats',
      leads:              'GET  /api/leads',
      runNow:             'POST /api/run-now',
      gmailAuth:          'GET  /api/auth/gmail',
      generateProposal:   'POST /api/proposals/generate  { email }',
      downloadProposalPDF:'GET  /api/proposals/:id/pdf',
      listProposals:      'GET  /api/proposals',
    },
  });
});

// Check inbox every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    await processInbox();
  } catch (err) {
    console.error('Cron job failed:', err.message);
  }
});

app.listen(PORT, () => {
  console.log(`\nFreelance AI Agent running on http://localhost:${PORT}`);
  console.log('Checking inbox every 5 minutes...\n');
  console.log('Quick start:');
  console.log('  1. Visit http://localhost:3001/api/auth/gmail to connect Gmail');
  console.log('  2. Run: node rag/ingest.js to load your knowledge base');
  console.log('  3. POST /api/run-now to process inbox immediately\n');
});
