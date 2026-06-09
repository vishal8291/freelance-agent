import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MOCK_PROPOSAL = {
  clientName: 'Demo Client',
  projectTitle: 'Full Stack Web Application',
  projectUnderstanding: 'You need a modern web application with user authentication, dashboard, and REST API backend. The system should be scalable, mobile-responsive, and delivered within your timeline.',
  deliverables: [
    { item: 'Frontend React application with responsive UI', included: true },
    { item: 'Node.js + Express REST API backend', included: true },
    { item: 'MongoDB database schema + integration', included: true },
    { item: 'JWT authentication & user roles', included: true },
    { item: 'Deployment to Vercel / Railway', included: true },
    { item: 'Source code + GitHub repo access', included: true },
    { item: 'Mobile app (React Native)', included: false },
    { item: 'Third-party payment integration', included: false },
  ],
  timeline: [
    { phase: 'Discovery & Setup', duration: '2 days', description: 'Project kickoff, DB schema, API design' },
    { phase: 'Core Backend', duration: '4 days', description: 'REST API, auth, database models' },
    { phase: 'Frontend Development', duration: '5 days', description: 'UI components, API integration' },
    { phase: 'Testing & Deployment', duration: '2 days', description: 'Bug fixes, QA, live deployment' },
  ],
  totalDays: 13,
  price: {
    currency: 'USD',
    symbol: '$',
    amount: 650,
    breakdown: [
      { label: 'Backend development (40h × $8)', amount: 320 },
      { label: 'Frontend development (30h × $8)', amount: 240 },
      { label: 'Deployment & setup', amount: 90 },
    ],
    upfront: 325,
    onDelivery: 325,
  },
  terms: [
    '50% payment upfront before work begins',
    '50% on final delivery and handover',
    '7-day bug fix period after delivery (free)',
    'Daily progress updates via WhatsApp/email',
    'Source code ownership transfers 100% to client on final payment',
    'Additional features billed at agreed hourly rate',
  ],
  validDays: 7,
};

export async function generateProposalContent(lead) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.startsWith('your_')) {
    return { ...MOCK_PROPOSAL, clientName: lead.name || 'Valued Client', mock: true };
  }

  const qualification = lead.qualification || {};
  const conversation = (lead.conversation || [])
    .slice(-8)
    .map(m => `${m.role === 'user' ? 'Client' : 'Agent'}: ${m.content}`)
    .join('\n');

  const isInternational = lead.email?.includes('.com') || lead.currency === 'USD';
  const currency = isInternational ? { code: 'USD', symbol: '$', hourRate: 10 } : { code: 'INR', symbol: '₹', hourRate: 400 };

  const prompt = `You are writing a professional freelance proposal for Vishal, a Full Stack Developer from Mumbai.

Client info:
- Name: ${lead.name || 'the client'}
- Email: ${lead.email}
- Project type: ${qualification.projectType || 'web/mobile application'}
- Budget mentioned: ${qualification.budget || 'not specified'}
- Timeline: ${qualification.timeline || 'flexible'}
- Score: ${qualification.score || 5}/10

Recent conversation:
${conversation || 'No conversation history available.'}

Vishal's rates: ${currency.symbol}${currency.hourRate}/hour. Preferred: 50% upfront, 50% on delivery.
Never go below ${currency.symbol}${isInternational ? 8 : 300}/hour.

Generate a detailed, professional proposal. Return ONLY valid JSON with this exact structure:
{
  "clientName": "string",
  "projectTitle": "string (specific, not generic)",
  "projectUnderstanding": "2-3 sentences showing you understood their exact need",
  "deliverables": [
    { "item": "string", "included": true/false }
  ],
  "timeline": [
    { "phase": "string", "duration": "X days", "description": "string" }
  ],
  "totalDays": number,
  "price": {
    "currency": "${currency.code}",
    "symbol": "${currency.symbol}",
    "amount": number,
    "breakdown": [
      { "label": "string", "amount": number }
    ],
    "upfront": number,
    "onDelivery": number
  },
  "terms": ["string"],
  "validDays": 7
}

Rules:
- Include 5-7 deliverables (some true, 1-2 false to show scope boundaries)
- Timeline: 3-5 phases that add up to totalDays
- Price must be reasonable for the project scope
- Terms must include payment split, bug fix period, daily updates`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude did not return valid JSON');

  return JSON.parse(jsonMatch[0]);
}
