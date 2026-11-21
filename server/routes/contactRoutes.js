import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';
import { contactLimits, contactTopics } from '../../shared/contact.mjs';
import { submitContactMessage } from '../controllers/contactController.js';
import { requireAuthCsrf } from '../middleware/authCsrf.js';

const router = Router();
const messageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many messages. Please wait before trying again.' }
});

router.post('/', requireAuthCsrf, messageLimiter, [
  body('name').isString().bail().trim().isLength({ min: 1, max: contactLimits.name }).withMessage('Enter a valid name.'),
  body('email').isString().bail().trim().isLength({ max: contactLimits.email }).bail().isEmail().withMessage('Enter a valid email address.'),
  body('topic').isString().bail().isIn(contactTopics).withMessage('Choose a topic.'),
  body('message').isString().bail().trim().isLength({ min: 1, max: contactLimits.message }).withMessage(`Enter a message of up to ${contactLimits.message} characters.`)
], submitContactMessage);

export default router;
