import Anthropic from '@anthropic-ai/sdk';
import { retrieveContext } from '../rag/retrieve.js';
import 'dotenv/config';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BASE_SYSTEM = `You are a professional sales assistant replying to potential 
clients on behalf of Vishal, a Full Stack Developer based in Mumbai, India.

Your job:
- Reply warmly and professionally as Vishal
- Qualify the lead (understand budget, timeline, project scope)
- Handle objections confidently
- Move every conversation toward a next step (requirements call, proposal, test task)
- Never reveal you are an AI

Style:
- Friendly but professional Indian English
- Concise — under 120 words per reply
- Always end with ONE clear next step or question
- Sign off as "Vishal" naturally

Hard rules:
- Never quote below Rs 300/hour or $8/hour
- Never accept equity-only deals
- Never promise unrealistic timelines
- If project is completely outside skillset, say so honestly`;

export async function generateReply(message, conversationHistory = [], metadata = {}) {
  const context = await retrieveContext(message);

  const contextBlock = context
    ? `\n\nRelevant information about Vishal for this conversation:\n${context}`
    : '';

  const metaBlock = metadata.senderName
    ? `\n\nClient name: ${metadata.senderName}`
    : '';

  const system = BASE_SYSTEM + contextBlock + metaBlock;

  const messages = [
    ...conversationHistory.slice(-10),
    { role: 'user', content: message },
  ];

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system,
    messages,
  });

  return response.content[0].text;
}

export async function qualifyLead(conversation) {
  const transcript = conversation
    .map(m => `${m.role === 'user' ? 'Client' : 'Agent'}: ${m.content}`)
    .join('\n');

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    system: 'You are a sales qualification analyst. Analyze this conversation and return ONLY valid JSON.',
    messages: [{
      role: 'user',
      content: `Analyze this client conversation and extract a lead qualification summary.
Return ONLY valid JSON with these fields:
{
  "score": 1-10,
  "projectType": "string or null",
  "budget": "string or null",
  "timeline": "string or null",
  "readiness": "hot|warm|cold",
  "nextAction": "string",
  "summary": "one sentence summary"
}

Conversation:
${transcript}`,
    }],
  });

  try {
    return JSON.parse(response.content[0].text);
  } catch {
    return { score: 5, readiness: 'warm', summary: 'Could not parse lead data', nextAction: 'Follow up' };
  }
}
