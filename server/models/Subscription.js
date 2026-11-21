import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  plan: { type: String, trim: true, maxlength: 60, default: 'Free' },
  status: { type: String, enum: ['active', 'cancelled', 'past_due', 'expired'], default: 'active', index: true },
  amount: { type: Number, min: 0, default: 0 },
  currency: { type: String, trim: true, uppercase: true, maxlength: 3, default: 'USD' },
  renewalAt: Date
}, { timestamps: true });

export default mongoose.model('Subscription', schema);
