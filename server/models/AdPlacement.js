import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  placement: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  adSlot: { type: String, trim: true, maxlength: 80, default: '' },
  enabled: { type: Boolean, default: false },
  format: { type: String, trim: true, maxlength: 40, default: 'auto' }
}, { timestamps: true });

export default mongoose.model('AdPlacement', schema);
