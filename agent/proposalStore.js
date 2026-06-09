import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'proposals.json');

function load() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ proposals: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function save(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function saveProposal(leadEmail, content) {
  const db = load();
  const id = `prop_${Date.now()}`;
  const proposal = {
    id,
    leadEmail,
    createdAt: new Date().toISOString(),
    content,
  };
  db.proposals.unshift(proposal);
  save(db);
  return proposal;
}

export function getProposal(id) {
  return load().proposals.find(p => p.id === id) || null;
}

export function getAllProposals() {
  return load().proposals;
}

export function getProposalsByLead(email) {
  return load().proposals.filter(p => p.leadEmail === email);
}
