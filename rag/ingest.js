import { QdrantClient } from '@qdrant/js-client-rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

export const COLLECTION = 'vishal_knowledge';
export const VECTOR_SIZE = 384; // Cohere embed-english-light-v3.0
const CHUNK_SIZE = 400;
const CHUNK_OVERLAP = 80;

// Cohere embedding (free tier — 1000 calls/month at dashboard.cohere.com)
async function embed(text) {
  const res = await fetch('https://api.cohere.com/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-english-light-v3.0',
      input_type: 'search_document',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cohere embed error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.embeddings[0];
}

function chunkText(text, source) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const para of paragraphs) {
    const candidate = current ? current + '\n\n' + para : para;
    if (candidate.length > CHUNK_SIZE && current) {
      chunks.push({ text: current.trim(), source });
      const words = current.split(' ');
      current = words.slice(-CHUNK_OVERLAP / 5).join(' ') + '\n\n' + para;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) chunks.push({ text: current.trim(), source });
  return chunks;
}

export async function ingestKnowledge() {
  console.log('Setting up Qdrant collection...');

  const collections = await qdrant.getCollections();
  const exists = collections.collections.some(c => c.name === COLLECTION);
  if (exists) {
    await qdrant.deleteCollection(COLLECTION);
  }

  await qdrant.createCollection(COLLECTION, {
    vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
  });

  const knowledgeDir = path.join(__dirname, '..', 'knowledge');
  const files = fs.readdirSync(knowledgeDir).filter(f => f.endsWith('.md'));

  let pointId = 1;
  let totalChunks = 0;

  for (const file of files) {
    const text = fs.readFileSync(path.join(knowledgeDir, file), 'utf-8');
    const chunks = chunkText(text, file);
    console.log(`  ${file} → ${chunks.length} chunks`);

    for (const chunk of chunks) {
      const vector = await embed(chunk.text);
      await qdrant.upsert(COLLECTION, {
        points: [{
          id: pointId++,
          vector,
          payload: { text: chunk.text, source: chunk.source },
        }],
      });
      totalChunks++;
    }
  }

  console.log(`\nDone. ${totalChunks} chunks stored in Qdrant collection "${COLLECTION}".`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  ingestKnowledge().catch(console.error);
}
