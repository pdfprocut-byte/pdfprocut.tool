import { Router } from 'express';
import { upload, uploadLimiter, uploadConcurrencyLimiter, resetUploadByteCount } from '../middleware/uploadMiddleware.js';
import { optionalAuth } from '../middleware/authMiddleware.js';
import * as controller from '../controllers/imageController.js';

const router = Router();
router.post('/compress', optionalAuth, uploadLimiter, uploadConcurrencyLimiter, resetUploadByteCount, upload.array('files', 1), controller.compress);

export default router;
