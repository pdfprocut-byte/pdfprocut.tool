import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  visitorId: { type: String, trim: true, maxlength: 100, index: true },
  visitId: { type: String, trim: true, maxlength: 100, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type: { type: String, enum: ['page_view', 'tool_used', 'session'], default: 'page_view', index: true },
  path: { type: String, trim: true, maxlength: 240, default: '/' },
  tool: { type: String, trim: true, maxlength: 80 },
  country: { type: String, trim: true, uppercase: true, maxlength: 2, default: 'UN' },
  source: { type: String, trim: true, maxlength: 80, default: 'direct' },
  durationSeconds: { type: Number, min: 0, max: 86400, default: 0 }
}, { timestamps: true });

export default mongoose.model('AnalyticsEvent', schema);
