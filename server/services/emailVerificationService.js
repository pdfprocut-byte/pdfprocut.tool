import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { sendVerificationEmail } from './emailService.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_SENDS = 5;
const OTP_MAX_ATTEMPTS = 5;

function hashCode(email, code) {
  return createHmac('sha256', env.jwtSecret).update(`${email}:${code}`).digest('hex');
}

function clearCode(user) {
  user.emailOtpHash = undefined;
  user.emailOtpExpiresAt = undefined;
  user.emailOtpAttemptCount = 0;
}

export async function sendEmailVerificationCode(user) {
  const now = Date.now();
  if (user.emailOtpLastSentAt && now - user.emailOtpLastSentAt.getTime() < OTP_COOLDOWN_MS) {
    throw new ApiError(429, 'Wait one minute before requesting another code.', 'OTP_COOLDOWN');
  }

  const withinWindow = user.emailOtpWindowStartedAt && now - user.emailOtpWindowStartedAt.getTime() < OTP_WINDOW_MS;
  const sentCount = withinWindow ? Number(user.emailOtpSentCount || 0) : 0;
  if (sentCount >= OTP_MAX_SENDS) throw new ApiError(429, 'Too many codes requested. Try again in an hour.', 'OTP_RATE_LIMIT');

  const code = String(randomInt(100000, 1000000));
  user.emailOtpHash = hashCode(user.email, code);
  user.emailOtpExpiresAt = new Date(now + OTP_LIFETIME_MS);
  user.emailOtpLastSentAt = new Date(now);
  user.emailOtpWindowStartedAt = withinWindow ? user.emailOtpWindowStartedAt : new Date(now);
  user.emailOtpSentCount = sentCount + 1;
  user.emailOtpAttemptCount = 0;
  await user.save();

  try {
    await sendVerificationEmail({ name: user.name, email: user.email, code });
  } catch (error) {
    clearCode(user);
    user.emailOtpLastSentAt = undefined;
    user.emailOtpSentCount = Math.max(0, sentCount);
    if (!withinWindow) user.emailOtpWindowStartedAt = undefined;
    await user.save();
    throw error;
  }
}

export async function verifyEmailCode(user, code) {
  if (user.emailVerified) return user;
  if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() <= Date.now()) {
    throw new ApiError(400, 'That code has expired. Request a new one.', 'OTP_EXPIRED');
  }
  if (user.emailOtpAttemptCount >= OTP_MAX_ATTEMPTS) {
    clearCode(user);
    await user.save();
    throw new ApiError(429, 'Too many incorrect codes. Request a new one.', 'OTP_ATTEMPTS_EXCEEDED');
  }

  const expected = Buffer.from(user.emailOtpHash, 'hex');
  const submitted = Buffer.from(hashCode(user.email, code), 'hex');
  if (expected.length !== submitted.length || !timingSafeEqual(expected, submitted)) {
    user.emailOtpAttemptCount += 1;
    const attemptsExceeded = user.emailOtpAttemptCount >= OTP_MAX_ATTEMPTS;
    if (attemptsExceeded) clearCode(user);
    await user.save();
    throw new ApiError(attemptsExceeded ? 429 : 400, attemptsExceeded ? 'Too many incorrect codes. Request a new one.' : 'That code is incorrect.', attemptsExceeded ? 'OTP_ATTEMPTS_EXCEEDED' : 'OTP_INVALID');
  }

  user.emailVerified = true;
  clearCode(user);
  user.emailOtpLastSentAt = undefined;
  user.emailOtpWindowStartedAt = undefined;
  user.emailOtpSentCount = 0;
  await user.save();
  return user;
}
