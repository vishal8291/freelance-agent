# Freelance AI Agent — Setup Guide

## What this does
- Checks your Gmail inbox every 5 minutes
- Reads client emails, generates intelligent replies using Claude AI + your knowledge base
- Sends replies automatically as you
- Qualifies leads and tracks them in a CRM
- React dashboard to monitor everything

---

## Step 1 — Install dependencies

```bash
cd freelance-agent
npm install
```

## Step 2 — Start Qdrant (vector database)

```bash
docker run -d -p 6333:6333 qdrant/qdrant
```

## Step 3 — Set up environment variables

```bash
cp .env.example .env
# Fill in your API keys in .env
```

Required keys:
- ANTHROPIC_API_KEY → from console.anthropic.com
- OPENAI_API_KEY → from platform.openai.com (for embeddings only, cheap)
- Gmail OAuth2 → see Step 4

## Step 4 — Connect Gmail

1. Go to console.cloud.google.com
2. Create a new project
3. Enable Gmail API
4. Create OAuth2 credentials (Desktop app type)
5. Copy Client ID and Secret to .env
6. Start the server: `npm start`
7. Visit: http://localhost:3001/api/auth/gmail
8. Authorize your Gmail account
9. Copy the refresh_token shown to your .env

## Step 5 — Load your knowledge base

```bash
node rag/ingest.js
```

You should see:
```
vishal_profile.md → 4 chunks
objection_handling.md → 6 chunks
services_faq.md → 5 chunks
Done. 15 chunks stored in Qdrant.
```

## Step 6 — Run the agent

```bash
npm start
```

## Step 7 — Test it

```bash
curl -X POST http://localhost:3001/api/run-now
```

Or visit http://localhost:3001/api/leads to see your CRM.

---

## Dashboard Setup (React)

```bash
cd dashboard
npm create vite@latest . -- --template react
npm install
# Replace src/App.jsx content with Dashboard.jsx
npm run dev
```

---

## Adding more knowledge

Add any .md file to the knowledge/ folder, then re-run:
```bash
node rag/ingest.js
```

Good things to add:
- Successful proposals (with what won the client)
- FAQ from past client conversations
- Your portfolio case studies
- Market rates for different project types

---

## Deployment (free)

Backend: Deploy to Railway.app (free tier)
Qdrant: Railway also hosts Qdrant for free
Dashboard: Deploy to Vercel for free

Remember: SEBI regulations require a static IP for API trading from April 2026.
For this agent, no special IP requirements — regular hosting works fine.
