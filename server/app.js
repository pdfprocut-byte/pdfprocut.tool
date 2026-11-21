import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import pdfRoutes from './routes/pdfRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import adminRoutes, { publicAnalyticsRouter } from './routes/adminRoutes.js';
import contactRoutes from './routes/contactRoutes.js';
import wordDocumentRoutes from './routes/wordDocumentRoutes.js';
import assistantRoutes from './routes/assistantRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import { requireEnabledTool } from './middleware/toolAvailability.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', env.trustProxyHops);
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: env.clientUrl,
  credentials: true,
  exposedHeaders: ['X-Job-Id', 'X-Original-Size', 'X-Output-Size', 'X-Target-Size', 'X-Target-Met', 'X-Output-Width', 'X-Output-Height', 'X-PDF-Rasterized', 'X-PDF-Word-Mode']
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: '10mb', strict: true }));
app.use(cookieParser());
app.get('/api/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.get('/', (_req, res) => res.json({ success: true, data: { service: 'PDF Pro Cut API', frontend: env.clientUrl } }));
app.use('/api/auth', authRoutes);
app.use('/api/documents', wordDocumentRoutes);
app.use('/api/pdf', requireEnabledTool, pdfRoutes);
app.use('/api/image', imageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/analytics', publicAnalyticsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;
