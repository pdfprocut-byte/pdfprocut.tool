import mongoose from 'mongoose';
const file = { name: String, size: Number, mimeType: String, path: String };
const schema = new mongoose.Schema({ jobId: { type: String, required: true, unique: true, index: true }, userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }, toolName: { type: String, required: true }, inputFileMetadata: [file], outputFileMetadata: [file], status: { type: String, enum: ['pending','processing','completed','failed','expired'], default: 'pending', index: true }, errorMessage: String, durationSeconds: { type: Number, min: 0, max: 86400, default: 0 }, completedAt: Date, expiresAt: { type: Date, required: true, index: { expires: 0 } } }, { timestamps: true });
export default mongoose.model('ProcessingJob', schema);
