import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  role: { type: String, required: true },
  content: { type: String, required: true },
  at: { type: Date, default: Date.now },
}, { _id: false });

const leadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  status: { type: String, default: 'new' },
  source: { type: String, default: 'email' },
  projectType: String,
  qualification: {
    score: Number,
    readiness: String,
    projectType: String,
    budget: String,
    timeline: String,
    summary: String,
    nextAction: String,
  },
  conversation: [messageSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// A lead's email only needs to be unique within one user's pipeline, not globally
leadSchema.index({ userId: 1, email: 1 }, { unique: true });

export default mongoose.models.Lead || mongoose.model('Lead', leadSchema);
