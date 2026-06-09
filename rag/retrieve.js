import { QdrantClient } from '@qdrant/js-client-rest';
import 'dotenv/config';
import { COLLECTION } from './ingest.js';

const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY
});

// Cohere embedding for query (input_type: search_query)
async function embedQuery(text) {
  const res = await fetch('https://api.cohere.com/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      texts: [text],
      model: 'embed-english-light-v3.0',
      input_type: 'search_query',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cohere embed error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.embeddings[0];
}

export async function retrieveContext(query, topK = 4) {
  const queryVector = await embedQuery(query);

  const results = await qdrant.search(COLLECTION, {
    vector: queryVector,
    limit: topK,
    with_payload: true,
    score_threshold: 0.4,
  });

  if (!results.length) return null;

  return results
    .map(r => `[${r.payload.source}]\n${r.payload.text}`)
    .join('\n\n---\n\n');
}
