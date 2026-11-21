import mongoose from 'mongoose';
import { contactLimits, contactTopics } from '../../shared/contact.mjs';

const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: contactLimits.name },
  email: { type: String, required: true, trim: true, maxlength: contactLimits.email },
  topic: { type: String, required: true, enum: contactTopics },
  message: { type: String, required: true, trim: true, maxlength: contactLimits.message }
}, { timestamps: { createdAt: true, updatedAt: false } });

contactMessageSchema.index({ createdAt: -1, _id: -1 });

export default mongoose.model('ContactMessage', contactMessageSchema);
