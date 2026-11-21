import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import AnalyticsEvent from '../models/AnalyticsEvent.js';
import ProcessingJob from '../models/ProcessingJob.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { sendEmailVerificationCode, verifyEmailCode } from '../services/emailVerificationService.js';

const googleClient = new OAuth2Client();
const token = (user) => jwt.sign({ id: user._id, sessionVersion: user.sessionVersion || 0 }, env.jwtSecret, {
  algorithm: 'HS256',
  expiresIn: '7d',
  issuer: 'pdfprocut-api',
  audience: 'pdfprocut-web'
});
const safe = (user) => ({ id: user._id, name: user.name, email: user.email, phone: user.phone || '', profession: user.profession || '', age: user.age ?? null, country: user.country || '', profilePhoto: user.profilePhoto || '', role: user.role, emailVerified: user.emailVerified, createdAt: user.createdAt });
const cookieOptions = { httpOnly: true, sameSite: env.nodeEnv === 'production' ? 'none' : 'lax', secure: env.nodeEnv === 'production', path: '/' };
const sessionCookieName = env.nodeEnv === 'production' ? '__Host-pdfpro_session' : 'token';
const setSession = (res, user) => res.cookie(sessionCookieName, token(user), { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const otpFields = '+emailOtpHash +emailOtpExpiresAt +emailOtpLastSentAt +emailOtpWindowStartedAt +emailOtpSentCount +emailOtpAttemptCount';

export const register = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  if (!name || name.length > 80 || !email || typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new ApiError(400, 'Name, valid email, and a password of 8–128 characters are required.');
  }
  if (await User.exists({ email })) throw new ApiError(409, 'Email is already registered. Sign in or request a new verification code.');

  let user;
  try {
    user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), emailVerified: false });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'Email is already registered. Sign in or request a new verification code.');
    throw error;
  }

  try {
    await sendEmailVerificationCode(user);
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }
  res.status(201).json({ success: true, data: { requiresEmailVerification: true, email } });
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: normalizeEmail(req.body.email) }).select('+passwordHash +sessionVersion');
  if (!user?.passwordHash || !await bcrypt.compare(req.body.password || '', user.passwordHash)) {
    throw new ApiError(401, 'Invalid email or password.');
  }
  if (!user.emailVerified) throw new ApiError(403, 'Verify your email before signing in.', 'EMAIL_NOT_VERIFIED');
  if (user.blockedAt) throw new ApiError(403, 'Your account is blocked.');
  setSession(res, user);
  res.json({ success: true, data: { user: safe(user) } });
});

export const adminLogin = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: normalizeEmail(req.body.email) }).select('+passwordHash +sessionVersion');
  if (!user?.passwordHash || !await bcrypt.compare(req.body.password || '', user.passwordHash)) {
    throw new ApiError(401, 'Invalid administrator credentials.');
  }
  if (!user.emailVerified) throw new ApiError(403, 'Verify your email before signing in.', 'EMAIL_NOT_VERIFIED');
  if (user.role !== 'admin' || user.blockedAt) throw new ApiError(403, 'This account does not have administrator access.');
  setSession(res, user);
  res.json({ success: true, data: { user: safe(user) } });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: normalizeEmail(req.body.email) }).select(`+sessionVersion ${otpFields}`);
  if (!user) throw new ApiError(400, 'That verification code is invalid or expired.', 'OTP_INVALID');
  if (user.blockedAt) throw new ApiError(403, 'Your account is blocked.');
  await verifyEmailCode(user, String(req.body.code));
  setSession(res, user);
  res.json({ success: true, data: { user: safe(user) } });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const user = await User.findOne({ email }).select(otpFields);
  if (user && !user.emailVerified) await sendEmailVerificationCode(user);
  res.json({ success: true, data: { message: 'If this account needs verification, a code has been sent.' } });
});

export const googleLogin = asyncHandler(async (req, res) => {
  if (!env.googleClientId) throw new ApiError(503, 'Google sign-in is not configured on the server.');
  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: env.googleClientId });
    payload = ticket.getPayload();
  } catch {
    throw new ApiError(401, 'Google sign-in could not be verified.', 'GOOGLE_TOKEN_INVALID');
  }
  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new ApiError(401, 'Google did not provide a verified email address.', 'GOOGLE_EMAIL_UNVERIFIED');
  }

  const email = normalizeEmail(payload.email);
  const authoritativeGoogleEmail = email.endsWith('@gmail.com') || Boolean(payload.hd);
  let user = await User.findOne({ googleId: payload.sub }).select(`+googleId +sessionVersion ${otpFields}`);
  let created = false;
  let emailChanged = false;
  if (user && user.email !== email) {
    const emailOwner = await User.findOne({ email }).select('+googleId +sessionVersion');
    if (emailOwner && String(emailOwner._id) !== String(user._id)) throw new ApiError(409, 'This Google email is already linked to another account.');
    user.email = email;
    emailChanged = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpLastSentAt = undefined;
    user.emailOtpWindowStartedAt = undefined;
    user.emailOtpSentCount = 0;
    user.emailOtpAttemptCount = 0;
  }
  if (!user) user = await User.findOne({ email }).select(`+googleId +sessionVersion ${otpFields}`);
  if (user?.googleId && user.googleId !== payload.sub) throw new ApiError(409, 'This email is linked to a different Google account.');
  if (user?.blockedAt) throw new ApiError(403, 'Your account is blocked.');

  if (!user) {
    try {
      user = await User.create({
        name: String(payload.name || email.split('@')[0]).trim().slice(0, 80),
        email,
        googleId: payload.sub,
        emailVerified: authoritativeGoogleEmail
      });
      created = true;
      if (!authoritativeGoogleEmail) user = await User.findById(user._id).select(`+googleId +sessionVersion ${otpFields}`);
    } catch (error) {
      if (error.code === 11000) throw new ApiError(409, 'This email is already registered. Try signing in with your password.');
      throw error;
    }
  } else {
    user.googleId = payload.sub;
    if (!user.name) user.name = String(payload.name || email.split('@')[0]).trim().slice(0, 80);
    if (authoritativeGoogleEmail || emailChanged) {
      user.emailVerified = authoritativeGoogleEmail;
      if (authoritativeGoogleEmail) {
        user.emailOtpHash = undefined;
        user.emailOtpExpiresAt = undefined;
        user.emailOtpLastSentAt = undefined;
        user.emailOtpWindowStartedAt = undefined;
        user.emailOtpSentCount = 0;
        user.emailOtpAttemptCount = 0;
      }
    }
    await user.save();
  }

  if (!user.emailVerified) {
    const activeCode = user.emailOtpHash && user.emailOtpExpiresAt?.getTime() > Date.now();
    try {
      if (!activeCode) await sendEmailVerificationCode(user);
    } catch (error) {
      if (created) await User.deleteOne({ _id: user._id });
      throw error;
    }
    res.json({ success: true, data: { requiresEmailVerification: true, email } });
    return;
  }

  await user.save();
  setSession(res, user);
  res.json({ success: true, data: { user: safe(user) } });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user) await User.updateOne({ _id: req.user._id }, { $inc: { sessionVersion: 1 } });
  res.clearCookie(sessionCookieName, cookieOptions);
  res.json({ success: true });
});

export const session = (req, res) => {
  res.set('Cache-Control', 'no-store').json({
    success: true,
    data: { user: req.user ? safe(req.user) : null }
  });
};

export const me = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, 'Authentication required.');
  return session(req, res);
});

export const updateProfile = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const profession = String(req.body.profession || '').trim();
  const country = String(req.body.country || '').trim();
  const ageValue = req.body.age === '' || req.body.age === null || req.body.age === undefined ? null : Number(req.body.age);
  const profilePhoto = String(req.body.profilePhoto || '');
  if (!name || name.length > 80) throw new ApiError(400, 'Enter a name with 1 to 80 characters.');
  if (phone.length > 30 || profession.length > 100 || country.length > 80) throw new ApiError(400, 'One or more profile fields are too long.');
  if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 1 || ageValue > 120)) throw new ApiError(400, 'Enter an age between 1 and 120.');
  if (profilePhoto.length > 600000 || (profilePhoto && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(profilePhoto))) {
    throw new ApiError(400, 'Choose a smaller JPEG profile photo.');
  }
  const user = await User.findByIdAndUpdate(req.user._id, { name, phone, profession, age: ageValue, country, profilePhoto }, { new: true, runValidators: true });
  if (!user) throw new ApiError(404, 'Account not found.');
  res.json({ success: true, data: { user: safe(user) } });
});

export const accountActivity = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [jobs, totalJobs, tools] = await Promise.all([
    ProcessingJob.find({ userId }).select('jobId toolName status createdAt completedAt errorMessage durationSeconds inputFileMetadata outputFileMetadata').sort({ createdAt: -1 }).limit(100).lean(),
    ProcessingJob.countDocuments({ userId }),
    AnalyticsEvent.aggregate([
      { $match: { userId, type: 'tool_used', source: 'pdf-api' } },
      { $group: { _id: '$tool', uses: { $sum: 1 }, lastUsedAt: { $max: '$createdAt' } } },
      { $sort: { uses: -1 } }
    ])
  ]);
  res.json({ success: true, data: { user: safe(req.user), jobs, totalJobs, tools } });
});
