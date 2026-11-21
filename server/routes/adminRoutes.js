import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, requireAdmin } from '../middleware/authMiddleware.js';
import { requireAuthCsrf } from '../middleware/authCsrf.js';
import * as admin from '../controllers/adminController.js';
import { listContactMessages } from '../controllers/contactController.js';

const router = Router();
const writeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const guarded = [optionalAuth, requireAdmin];
const write = [...guarded, writeLimiter, requireAuthCsrf];

router.get('/dashboard', ...guarded, admin.dashboard);
router.get('/messages', ...guarded, listContactMessages);
router.get('/users', ...guarded, admin.listUsers); router.get('/users/:id/activity', ...guarded, admin.userActivity); router.patch('/users/:id', ...write, admin.updateUser); router.delete('/users/:id', ...write, admin.deleteUser);
router.get('/visits', ...guarded, admin.listVisits);
router.get('/visitors', ...guarded, admin.listVisitVisitors);
router.get('/tools', ...guarded, admin.listTools); router.post('/tools', ...write, admin.saveTool); router.put('/tools/:id', ...write, admin.saveTool); router.delete('/tools/:id', ...write, admin.deleteTool);
router.get('/settings', ...guarded, admin.getSettings); router.put('/settings/:section', ...write, admin.saveSettings);
router.post('/ads', ...write, admin.saveAd); router.put('/ads/:id', ...write, admin.saveAd); router.delete('/ads/:id', ...write, admin.deleteAd);
router.get('/content', ...guarded, admin.listContent); router.post('/content', ...write, admin.saveContent); router.put('/content/:id', ...write, admin.saveContent); router.delete('/content/:id', ...write, admin.deleteContent);
router.get('/subscriptions', ...guarded, admin.subscriptions); router.post('/subscriptions', ...write, admin.saveSubscription); router.put('/subscriptions/:id', ...write, admin.saveSubscription);
router.get('/analytics', ...guarded, admin.analytics); router.get('/logs', ...guarded, admin.logs);
router.post('/maintenance/cleanup', ...write, admin.cleanupTemporaryFiles); router.get('/maintenance/backup', ...guarded, admin.backup);

export const publicAnalyticsRouter = Router();
publicAnalyticsRouter.post('/events', optionalAuth, rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), admin.trackAnalytics);
export default router;
