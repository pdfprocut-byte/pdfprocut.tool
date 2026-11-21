import mongoose from 'mongoose';
export const connectDb = async (uri) => { if (uri) await mongoose.connect(uri); };
