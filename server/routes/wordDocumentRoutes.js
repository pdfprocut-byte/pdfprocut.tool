import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { optionalAuth, protect } from '../middleware/authMiddleware.js';
import { requireAuthCsrf } from '../middleware/authCsrf.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as c from '../controllers/wordDocumentController.js';

const router = Router();
const writeLimiter = rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false });
router.use(optionalAuth, protect);
router.get('/', asyncHandler(c.listDocuments));
router.post('/', writeLimiter, requireAuthCsrf, asyncHandler(c.createDocument));
router.post('/import', writeLimiter, requireAuthCsrf, c.importDocx);
router.get('/:id/export/docx', asyncHandler(c.exportDocx));
router.get('/:id', asyncHandler(c.getDocument));
router.put('/:id', writeLimiter, requireAuthCsrf, asyncHandler(c.updateDocument));
router.delete('/:id', writeLimiter, requireAuthCsrf, asyncHandler(c.deleteDocument));

export default router;
