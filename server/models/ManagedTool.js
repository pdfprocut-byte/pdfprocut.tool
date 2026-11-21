import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true, match: /^[a-z0-9-]+$/ },
  endpoint: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
  category: { type: String, trim: true, maxlength: 80, default: 'General' },
  enabled: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

export default mongoose.model('ManagedTool', schema);
