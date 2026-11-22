import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { sendPasswordResetEmail } from './emailService.js';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_SENDS = 5;
const OTP_MAX_ATTEMPTS = 5;
const INVALID_CODE_MESSAGE = 'That reset code is invalid or expired. Request a new one and try again.';

function hashCode(email, code) {
  return createHmac('sha256', env.jwtSecret).update(`password-reset:${email}:${code}`).digest('hex');
}

function clearCode(user) {
  user.passwordResetOtpHash = undefined;
  user.passwordResetOtpExpiresAt = undefined;
  user.passwordResetOtpAttemptCount = 0;
}

export async function sendPasswordResetCode(user) {
  const now = Date.now();
  if (user.passwordResetOtpLastSentAt && now - user.passwordResetOtpLastSentAt.getTime() < OTP_COOLDOWN_MS) {
    throw new ApiError(429, 'Password reset code cooldown is active.', 'OTP_COOLDOWN');
  }

  const withinWindow = user.passwordResetOtpWindowStartedAt && now - user.passwordResetOtpWindowStartedAt.getTime() < OTP_WINDOW_MS;
  const sentCount = withinWindow ? Number(user.passwordResetOtpSentCount || 0) : 0;
  if (sentCount >= OTP_MAX_SENDS) throw new ApiError(429, 'Password reset email rate limit reached.', 'OTP_RATE_LIMIT');

  const code = String(randomInt(100000, 1000000));
  user.passwordResetOtpHash = hashCode(user.email, code);
  user.passwordResetOtpExpiresAt = new Date(now + OTP_LIFETIME_MS);
  user.passwordResetOtpLastSentAt = new Date(now);
  user.passwordResetOtpWindowStartedAt = withinWindow ? user.passwordResetOtpWindowStartedAt : new Date(now);
  user.passwordResetOtpSentCount = sentCount + 1;
  user.passwordResetOtpAttemptCount = 0;
  await user.save();

  try {
    await sendPasswordResetEmail({ name: user.name, email: user.email, code });
  } catch (error) {
    clearCode(user);
    user.passwordResetOtpLastSentAt = undefined;
    user.passwordResetOtpSentCount = sentCount;
    if (!withinWindow) user.passwordResetOtpWindowStartedAt = undefined;
    await user.save();
    throw error;
  }
}

export async function resetPasswordWithCode(user, code, password) {
  if (!user.passwordResetOtpHash || !user.passwordResetOtpExpiresAt || user.passwordResetOtpExpiresAt.getTime() <= Date.now()) {
    clearCode(user);
    await user.save();
    throw new ApiError(400, INVALID_CODE_MESSAGE, 'PASSWORD_RESET_CODE_INVALID');
  }
  if (user.passwordResetOtpAttemptCount >= OTP_MAX_ATTEMPTS) {
    clearCode(user);
    await user.save();
    throw new ApiError(400, INVALID_CODE_MESSAGE, 'PASSWORD_RESET_CODE_INVALID');
  }

  const expected = Buffer.from(user.passwordResetOtpHash, 'hex');
  const submitted = Buffer.from(hashCode(user.email, code), 'hex');
  if (expected.length !== submitted.length || !timingSafeEqual(expected, submitted)) {
    user.passwordResetOtpAttemptCount += 1;
    const attemptsExceeded = user.passwordResetOtpAttemptCount >= OTP_MAX_ATTEMPTS;
    if (attemptsExceeded) clearCode(user);
    await user.save();
    throw new ApiError(400, INVALID_CODE_MESSAGE, 'PASSWORD_RESET_CODE_INVALID');
  }

  user.passwordHash = await bcrypt.hash(password, 12);
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  clearCode(user);
  user.passwordResetOtpLastSentAt = undefined;
  user.passwordResetOtpWindowStartedAt = undefined;
  user.passwordResetOtpSentCount = 0;
  await user.save();
  return user;
}
