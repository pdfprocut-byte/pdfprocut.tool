import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, default: '', maxlength: 100000 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  publishedAt: Date
}, { timestamps: true });

export default mongoose.model('ContentPage', schema);
