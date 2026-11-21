import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  pageSize: { type: String, enum: ['a4', 'letter'], default: 'a4' },
  orientation: { type: String, enum: ['portrait', 'landscape'], default: 'portrait' },
  margins: {
    top: { type: Number, min: 5, max: 60, default: 20 },
    right: { type: Number, min: 5, max: 60, default: 20 },
    bottom: { type: Number, min: 5, max: 60, default: 20 },
    left: { type: Number, min: 5, max: 60, default: 20 }
  },
  header: { type: String, maxlength: 1000, default: '' },
  footer: { type: String, maxlength: 1000, default: '' },
  pageNumbers: { type: Boolean, default: true },
  pageColor: { type: String, match: /^#[\da-fA-F]{6}$/, default: '#ffffff' }
}, { _id: false });

const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 1, maxlength: 180 },
  content: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    default: () => ({ type: 'doc', content: [{ type: 'paragraph' }] })
  },
  settings: { type: settingsSchema, default: () => ({}) }
}, { timestamps: true });

schema.index({ ownerId: 1, updatedAt: -1 });

export default mongoose.model('WordDocument', schema);
