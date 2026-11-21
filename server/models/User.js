import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true, maxlength: 30, default: '' },
  profession: { type: String, trim: true, maxlength: 100, default: '' },
  age: { type: Number, min: 1, max: 120, default: null },
  country: { type: String, trim: true, maxlength: 80, default: '' },
  profilePhoto: { type: String, maxlength: 600000, default: '' },
  passwordHash: { type: String, select: false },
  sessionVersion: { type: Number, default: 0, select: false },
  googleId: { type: String, unique: true, sparse: true, select: false },
  emailVerified: { type: Boolean, default: false },
  emailOtpHash: { type: String, select: false },
  emailOtpExpiresAt: { type: Date, select: false },
  emailOtpLastSentAt: { type: Date, select: false },
  emailOtpWindowStartedAt: { type: Date, select: false },
  emailOtpSentCount: { type: Number, default: 0, select: false },
  emailOtpAttemptCount: { type: Number, default: 0, select: false },
  role: { type: String, default: 'user', enum: ['user', 'admin', 'editor', 'support'] },
  blockedAt: Date,
  blockedReason: { type: String, trim: true, maxlength: 240 },
  permissions: [{ type: String, trim: true }],
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false }
}, { timestamps: true });
export default mongoose.model('User', schema);
