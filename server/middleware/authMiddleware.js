import jwt from 'jsonwebtoken'; import { env } from '../config/env.js'; import User from '../models/User.js'; import { ApiError } from '../utils/ApiError.js';
export const optionalAuth = async (req, res, next) => {
  try {
    const cookieName = env.nodeEnv === 'production' ? '__Host-pdfpro_session' : 'token';
    const token = req.cookies?.[cookieName] || req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (token) {
      const claims = jwt.verify(token, env.jwtSecret, {
        algorithms: ['HS256'],
        issuer: 'pdfprocut-api',
        audience: 'pdfprocut-web'
      });
      const user = await User.findById(claims.id).select('+sessionVersion');
      if (user?.emailVerified && !user.blockedAt && Number(claims.sessionVersion || 0) === Number(user.sessionVersion || 0)) req.user = user;
    }
    next();
  } catch { next(); }
};
export const protect = (req, res, next) => req.user ? next() : next(new ApiError(401, 'Authentication required'));
export const requireAdmin = (req, res, next) => {
  if (!req.user) return next(new ApiError(401, 'Authentication required'));
  if (req.user.blockedAt) return next(new ApiError(403, 'Your account is blocked.'));
  if (req.user.role !== 'admin') return next(new ApiError(403, 'Administrator access is required.'));
  next();
};
