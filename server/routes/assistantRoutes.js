import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { chatWithAssistant } from '../controllers/assistantController.js';
import { requireAuthCsrf } from '../middleware/authCsrf.js';

// The assistant resolves questions from the local tool catalog and guides.
const router = Router();
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'You have reached the chat limit. Please try again in a few minutes.' }
});

router.post('/chat', requireAuthCsrf, chatLimiter, chatWithAssistant);

export default router;
