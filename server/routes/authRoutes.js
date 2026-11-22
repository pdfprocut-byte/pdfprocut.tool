import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import * as c from '../controllers/authController.js';
import { issueCsrfToken, requireAuthCsrf } from '../middleware/authCsrf.js';
import { optionalAuth, protect } from '../middleware/authMiddleware.js';
import { ApiError } from '../utils/ApiError.js';

const r = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const registrationLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const otpSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const otpVerifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const passwordResetSendLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });
const passwordResetLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const googleLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return next(new ApiError(400, errors.array()[0].msg));
  next();
};
const email = () => body('email').trim().isEmail().withMessage('Enter a valid email address.').isLength({ max: 254 }).withMessage('Email address is too long.');

r.get('/csrf', issueCsrfToken);
r.post('/register', registrationLimiter, requireAuthCsrf, body('name').isString().trim().isLength({ min: 1, max: 80 }).withMessage('Enter your name.'), email(), body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters.'), validate, c.register);
r.post('/login', loginLimiter, requireAuthCsrf, email(), body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Enter a valid password.'), validate, c.login);
r.post('/admin/login', loginLimiter, requireAuthCsrf, email(), body('password').isString().isLength({ min: 1, max: 128 }).withMessage('Enter a valid password.'), validate, c.adminLogin);
r.post('/verify-email', otpVerifyLimiter, requireAuthCsrf, email(), body('code').isString().matches(/^\d{6}$/).withMessage('Enter the 6 digit code.'), validate, c.verifyEmail);
r.post('/resend-verification', otpSendLimiter, requireAuthCsrf, email(), validate, c.resendVerification);
r.post('/forgot-password', passwordResetSendLimiter, requireAuthCsrf, email(), validate, c.forgotPassword);
r.post('/reset-password', passwordResetLimiter, requireAuthCsrf, email(), body('code').isString().matches(/^\d{6}$/).withMessage('Enter the 6 digit code.'), body('password').isString().isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters.'), validate, c.resetPassword);
r.post('/google', googleLimiter, requireAuthCsrf, body('credential').isString().isLength({ min: 100, max: 5000 }).withMessage('Google sign-in credential is invalid.'), validate, c.googleLogin);
r.post('/logout', optionalAuth, requireAuthCsrf, c.logout);
r.get('/session', optionalAuth, c.session);
r.get('/me', optionalAuth, c.me);
r.put('/profile', optionalAuth, protect, requireAuthCsrf, c.updateProfile);
r.get('/activity', optionalAuth, protect, c.accountActivity);

export default r;
