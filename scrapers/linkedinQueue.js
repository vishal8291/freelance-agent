/**
 * LinkedIn Queue — Phase 7
 *
 * Human-review queue for LinkedIn actions.
 * Every connect request and DM is drafted + queued here first.
 * Vishal approves from the dashboard before anything is sent.
 *
 * Also maintains an audit log of all executed actions.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = path.join(__dirname, '..', 'data', 'linkedin-queue.json');
const LOG_FILE   = path.join(__dirname, '..', 'data', 'linkedin-log.json');

// ── Persist helpers ──────────────────────────────────────────────────────────

function loadQueue() {
  if (!fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ items: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf-8'));
}
function saveQueue(data) { fs.writeFileSync(QUEUE_FILE, JSON.stringify(data, null, 2)); }

function loadLog() {
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ entries: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8'));
}
function saveLog(data) { fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2)); }

// ── Queue management ─────────────────────────────────────────────────────────

/**
 * Add a pending LinkedIn action to the review queue.
 * @param {object} item — { type:'connect'|'dm', profileUrl, name, headline, message, connectionNote }
 */
export function addToQueue(item) {
  const db = loadQueue();
  const entry = {
    id:         `li_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type:       item.type,        // 'connect' or 'dm'
    profileUrl: item.profileUrl,
    name:       item.name       || 'Unknown',
    headline:   item.headline   || '',
    company:    item.company    || '',
    message:    item.message,     // DM text (for type='dm')
    connectionNote: item.connectionNote || '', // Note for connect requests (≤300 chars)
    status:     'pending',        // pending → approved → sent / failed
    addedAt:    new Date().toISOString(),
    approvedAt: null,
    sentAt:     null,
    error:      null,
  };
  db.items.unshift(entry);
  saveQueue(db);
  console.log(`[LI:queue] Added ${entry.type} action for ${entry.name} (${entry.id})`);
  return entry;
}

/** Get all queue items, optionally filtered by status */
export function getQueue(status = null) {
  const db = loadQueue();
  if (status) return db.items.filter(i => i.status === status);
  return db.items;
}

/** Mark a queue item as approved */
export function approveItem(id) {
  const db = loadQueue();
  const item = db.items.find(i => i.id === id);
  if (!item) throw new Error(`Queue item ${id} not found`);
  if (item.status !== 'pending') throw new Error(`Item ${id} is already ${item.status}`);
  item.status     = 'approved';
  item.approvedAt = new Date().toISOString();
  saveQueue(db);
  return item;
}

/** Mark a queue item as rejected */
export function rejectItem(id) {
  const db = loadQueue();
  const item = db.items.find(i => i.id === id);
  if (!item) throw new Error(`Queue item ${id} not found`);
  item.status = 'rejected';
  saveQueue(db);
  return item;
}

/** Update item after send attempt */
export function markSent(id, success, errorMsg = null) {
  const db = loadQueue();
  const item = db.items.find(i => i.id === id);
  if (!item) return;
  item.status = success ? 'sent' : 'failed';
  item.sentAt  = new Date().toISOString();
  item.error   = errorMsg;
  saveQueue(db);

  // Also log to audit trail
  const log = loadLog();
  log.entries.unshift({
    ...item,
    loggedAt: new Date().toISOString(),
  });
  saveLog(log);
}

// ── Daily rate limit helpers ─────────────────────────────────────────────────

/** Count how many connects/DMs were sent today */
export function getDailyCount(type) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const db = loadQueue();
  return db.items.filter(
    i => i.type === type && i.status === 'sent' && new Date(i.sentAt) >= todayStart
  ).length;
}

/** Has this profile URL been contacted in the last N hours? */
export function isOnCooldown(profileUrl, hours = 48) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const db     = loadQueue();
  return db.items.some(
    i => i.profileUrl === profileUrl &&
         ['approved', 'sent'].includes(i.status) &&
         new Date(i.addedAt) > cutoff
  );
}

/** Get audit log entries */
export function getLog() {
  return loadLog().entries;
}

/** Stats summary */
export function getQueueStats() {
  const db    = loadQueue();
  const items = db.items;
  return {
    pending:   items.filter(i => i.status === 'pending').length,
    approved:  items.filter(i => i.status === 'approved').length,
    sent:      items.filter(i => i.status === 'sent').length,
    failed:    items.filter(i => i.status === 'failed').length,
    rejected:  items.filter(i => i.status === 'rejected').length,
    todayConnects: getDailyCount('connect'),
    todayDMs:      getDailyCount('dm'),
  };
}
