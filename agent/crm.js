import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'leads.json');

function loadDB() {
  if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ leads: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

export function upsertLead(email, updates) {
  const db = loadDB();
  const idx = db.leads.findIndex(l => l.email === email);

  if (idx === -1) {
    db.leads.unshift({
      id: Date.now().toString(),
      email,
      createdAt: new Date().toISOString(),
      status: 'new',
      conversation: [],
      ...updates,
    });
  } else {
    db.leads[idx] = { ...db.leads[idx], ...updates, updatedAt: new Date().toISOString() };
  }

  saveDB(db);
  return db.leads.find(l => l.email === email);
}

export function getLead(email) {
  const db = loadDB();
  return db.leads.find(l => l.email === email) || null;
}

export function getAllLeads() {
  return loadDB().leads;
}

export function addMessage(email, role, content) {
  const db = loadDB();
  const lead = db.leads.find(l => l.email === email);
  if (!lead) return;

  if (!lead.conversation) lead.conversation = [];
  lead.conversation.push({ role, content, at: new Date().toISOString() });
  lead.updatedAt = new Date().toISOString();
  saveDB(db);
}

export function updateLeadStatus(email, status, qualification = null) {
  const updates = { status };
  if (qualification) updates.qualification = qualification;
  return upsertLead(email, updates);
}

export function getStats() {
  const leads = getAllLeads();
  return {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    active: leads.filter(l => l.status === 'active').length,
    hot: leads.filter(l => l.qualification?.readiness === 'hot').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };
}
