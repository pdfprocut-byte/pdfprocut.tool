import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  eventId: { type: String, trim: true, maxlength: 100 },
  jobId: { type: String, trim: true, maxlength: 100 },
  visitorId: { type: String, trim: true, maxlength: 100 },
  visitId: { type: String, trim: true, maxlength: 100 },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: ['page_view', 'tool_used', 'session'], default: 'page_view' },
  path: { type: String, trim: true, maxlength: 240, default: '/' },
  tool: { type: String, trim: true, maxlength: 80 },
  country: { type: String, trim: true, uppercase: true, maxlength: 2, default: 'UN' },
  source: { type: String, trim: true, maxlength: 80, default: 'direct' },
  durationSeconds: { type: Number, min: 0, max: 86400, default: 0 }
}, { timestamps: true });

// Every date-filtered report starts by narrowing on event type and createdAt.
schema.index({ type: 1, createdAt: -1 }, { name: 'analytics_type_createdAt' });
// Supports visitor association and date-filtered distinct visitor reports.
schema.index({ visitorId: 1, createdAt: -1 }, { name: 'analytics_visitor_createdAt' });
// Supports account activity and successful PDF tool reports.
schema.index({ userId: 1, type: 1, source: 1, createdAt: -1 }, { name: 'analytics_user_type_source_createdAt' });
schema.index({ type: 1, source: 1, createdAt: -1 }, { name: 'analytics_type_source_createdAt' });
// These indexes apply only to new events; older production records have no IDs and remain untouched.
schema.index({ eventId: 1 }, { unique: true, partialFilterExpression: { eventId: { $type: 'string' } }, name: 'analytics_eventId_unique' });
schema.index({ jobId: 1 }, { unique: true, partialFilterExpression: { jobId: { $type: 'string' } }, name: 'analytics_jobId_unique' });

export default mongoose.model('AnalyticsEvent', schema);
