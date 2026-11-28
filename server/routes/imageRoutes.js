import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { upload, uploadLimiter, uploadConcurrencyLimiter, resetUploadByteCount } from '../middleware/uploadMiddleware.js';
import { optionalAuth, protect } from '../middleware/authMiddleware.js';
import { requireAuthCsrf } from '../middleware/authCsrf.js';
import * as controller from '../controllers/imageController.js';

const router = Router();
const photoRoomLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI background requests. Please wait before trying again.' }
});

router.get('/background-status', controller.backgroundStatus);
router.post('/background', optionalAuth, protect, requireAuthCsrf, photoRoomLimiter, uploadLimiter, uploadConcurrencyLimiter, resetUploadByteCount, upload.single('image_file'), controller.removeBackground);
router.post('/compress', optionalAuth, uploadLimiter, uploadConcurrencyLimiter, resetUploadByteCount, upload.array('files', 1), controller.compress);

export default router;
