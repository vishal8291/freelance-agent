import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  plan: { type: String, enum: ['trial', 'starter', 'pro'], default: 'trial' },
  trialEndsAt: { type: Date, default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
  createdAt: { type: Date, default: Date.now },
});

// Never send the hash back in API responses
userSchema.methods.toJSON = function toSafeJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.models.User || mongoose.model('User', userSchema);
