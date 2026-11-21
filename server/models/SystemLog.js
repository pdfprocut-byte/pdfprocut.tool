import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true, trim: true, maxlength: 120, index: true },
  target: { type: String, trim: true, maxlength: 200, default: '' },
  details: { type: String, trim: true, maxlength: 1000, default: '' },
  severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' }
}, { timestamps: true });

export default mongoose.model('SystemLog', schema);
