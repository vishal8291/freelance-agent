import Lead from '../models/Lead.js';

export async function upsertLead(userId, email, updates) {
  const normalizedEmail = email.toLowerCase();
  const lead = await Lead.findOneAndUpdate(
    { userId, email: normalizedEmail },
    {
      $set: { ...updates, updatedAt: new Date() },
      $setOnInsert: { userId, email: normalizedEmail, createdAt: new Date() },
    },
    { new: true, upsert: true },
  );
  return lead;
}

export async function getLead(userId, email) {
  return Lead.findOne({ userId, email: email.toLowerCase() });
}

export async function getAllLeads(userId) {
  return Lead.find({ userId }).sort({ createdAt: -1 });
}

export async function addMessage(userId, email, role, content) {
  return Lead.findOneAndUpdate(
    { userId, email: email.toLowerCase() },
    { $push: { conversation: { role, content, at: new Date() } }, $set: { updatedAt: new Date() } },
    { new: true },
  );
}

export async function updateLeadStatus(userId, email, status, qualification = null) {
  const updates = { status };
  if (qualification) updates.qualification = qualification;
  return upsertLead(userId, email, updates);
}

export async function getStats(userId) {
  const leads = await getAllLeads(userId);
  return {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    active: leads.filter(l => l.status === 'active').length,
    hot: leads.filter(l => l.qualification?.readiness === 'hot').length,
    converted: leads.filter(l => l.status === 'converted').length,
  };
}
