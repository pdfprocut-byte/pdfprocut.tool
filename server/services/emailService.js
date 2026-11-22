import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

let transporter;

function getTransporter() {
  if (!env.smtp.host || !env.smtp.from) {
    throw new ApiError(
      503,
      'Email verification is not configured. Set RESEND_API_KEY and RESEND_FROM, or configure SMTP_HOST and SMTP_FROM in server/.env, then restart the server.'
    );
  }
  if (!transporter) {
    const auth = env.smtp.user && env.smtp.pass ? { user: env.smtp.user, pass: env.smtp.pass } : undefined;
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      ...(auth ? { auth } : {})
    });
  }
  return transporter;
}

const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);

function logDevelopmentOtp(email, code) {
  console.info(`[PDFPro development only] OTP for ${email}: ${code}`);
}

export async function sendVerificationEmail({ name, email, code }) {
  const recipientName = escapeHtml(name || 'there');
  const verificationUrl = new URL('/verify-email', env.clientUrl).toString();
  const subject = 'Your PDF Pro Cut verification code';
  const text = `Hi ${name || 'there'},\n\nYour PDF Pro Cut verification code is ${code}. It expires in 10 minutes.\n\nIf you did not request this code, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><h1 style="font-size:22px">Verify your email</h1><p>Hi ${recipientName},</p><p>Use this code to finish setting up your PDF Pro Cut account:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700;color:#d9273d">${code}</p><p>This code expires in 10 minutes.</p><p>If you did not request this code, you can ignore this email.</p><a href="${escapeHtml(verificationUrl)}">Open PDF Pro Cut</a></div>`;

  if (env.resend.apiKey || env.resend.from) {
    if (!env.resend.apiKey || !env.resend.from) {
      if (env.devOtpLogging) {
        logDevelopmentOtp(email, code);
        return;
      }
      throw new ApiError(503, 'Resend needs both RESEND_API_KEY and RESEND_FROM in server/.env. Use a sender address from a verified Resend domain.');
    }

    let response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resend.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: env.resend.from, to: [email], subject, text, html })
      });
    } catch {
      throw new ApiError(502, 'Could not connect to Resend. Check the server network connection and try again.', 'EMAIL_PROVIDER_UNAVAILABLE');
    }

    if (!response.ok) {
      throw new ApiError(502, `Resend rejected the email (HTTP ${response.status}). Check the API key, verified sender domain, and Resend account limits.`, 'EMAIL_DELIVERY_FAILED');
    }
    return;
  }

  if (!env.smtp.host || !env.smtp.from) {
    if (env.devOtpLogging) {
      logDevelopmentOtp(email, code);
      return;
    }
    throw new ApiError(503, 'Email verification is not configured. Set RESEND_API_KEY and RESEND_FROM, or configure SMTP_HOST and SMTP_FROM in server/.env, then restart the server.');
  }

  await getTransporter().sendMail({ from: env.smtp.from, to: email, subject, text, html });
}

export async function sendPasswordResetEmail({ name, email, code }) {
  const recipientName = escapeHtml(name || 'there');
  const subject = 'Reset your PDF Pro Cut password';
  const text = `Hi ${name || 'there'},\n\nYour PDF Pro Cut password reset code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#172033"><h1 style="font-size:22px">Reset your password</h1><p>Hi ${recipientName},</p><p>Use this code to choose a new password for your PDF Pro Cut account:</p><p style="font-size:30px;letter-spacing:8px;font-weight:700;color:#d9273d">${code}</p><p>This code expires in 10 minutes.</p><p>If you did not request this, you can ignore this email.</p></div>`;

  if (env.resend.apiKey || env.resend.from) {
    if (!env.resend.apiKey || !env.resend.from) {
      if (env.devOtpLogging) {
        logDevelopmentOtp(email, code);
        return;
      }
      throw new ApiError(503, 'Password reset email is not configured correctly.');
    }

    let response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.resend.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ from: env.resend.from, to: [email], subject, text, html })
      });
    } catch {
      throw new ApiError(502, 'Could not send the password reset email.', 'EMAIL_PROVIDER_UNAVAILABLE');
    }

    if (!response.ok) throw new ApiError(502, 'Could not send the password reset email.', 'EMAIL_DELIVERY_FAILED');
    return;
  }

  if (!env.smtp.host || !env.smtp.from) {
    if (env.devOtpLogging) {
      logDevelopmentOtp(email, code);
      return;
    }
    throw new ApiError(503, 'Password reset email is not configured.');
  }

  await getTransporter().sendMail({ from: env.smtp.from, to: email, subject, text, html });
}
