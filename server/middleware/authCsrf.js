import { randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const csrfCookieName = env.nodeEnv === 'production' ? '__Host-pdfpro_csrf' : 'csrfToken';

export const issueCsrfToken = (req, res) => {
  const token = randomBytes(32).toString('hex');
  res.set('Cache-Control', 'no-store');
  res.cookie(csrfCookieName, token, {
    httpOnly: false,
    sameSite: env.nodeEnv === 'production' ? 'none' : 'lax',
    secure: env.nodeEnv === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
  res.json({ success: true, data: { csrfToken: token } });
};

export const requireAuthCsrf = (req, res, next) => {
  const origin = req.get('origin');
  if (origin && origin !== new URL(env.clientUrl).origin) return next(new ApiError(403, 'Request origin is not allowed'));

  const cookieToken = req.cookies?.[csrfCookieName];
  const headerToken = req.get('x-csrf-token');
  if (!cookieToken || !headerToken) return next(new ApiError(403, 'Refresh the page and try again'));

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);
  if (cookieBuffer.length !== headerBuffer.length || !timingSafeEqual(cookieBuffer, headerBuffer)) {
    return next(new ApiError(403, 'Refresh the page and try again'));
  }
  next();
};
