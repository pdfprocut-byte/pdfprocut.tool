import 'dotenv/config';
const nodeEnv = process.env.NODE_ENV || 'development';
const required = ['JWT_SECRET'];
if (process.env.NODE_ENV === 'production') required.push('MONGODB_URI');
for (const key of required) if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const maxFileSizeMb = Number(process.env.MAX_FILE_SIZE_MB || 25);
const maxTotalUploadMb = Number(process.env.MAX_TOTAL_UPLOAD_MB || 50);
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
const maxConcurrentUploads = Number(process.env.MAX_CONCURRENT_UPLOADS || 4);
if (!Number.isFinite(maxFileSizeMb) || maxFileSizeMb < 1 || maxFileSizeMb > 100) throw new Error('MAX_FILE_SIZE_MB must be between 1 and 100');
if (!Number.isFinite(maxTotalUploadMb) || maxTotalUploadMb < maxFileSizeMb || maxTotalUploadMb > 200) throw new Error('MAX_TOTAL_UPLOAD_MB must be at least MAX_FILE_SIZE_MB and no more than 200');
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 5) throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 5');
if (!Number.isInteger(maxConcurrentUploads) || maxConcurrentUploads < 1 || maxConcurrentUploads > 20) throw new Error('MAX_CONCURRENT_UPLOADS must be an integer between 1 and 20');
const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
let clientOrigin;
try {
  const parsedClientUrl = new URL(clientUrl);
  if (parsedClientUrl.origin !== clientUrl) throw new Error();
  clientOrigin = parsedClientUrl;
} catch {
  throw new Error('CLIENT_URL must be a valid origin without a path');
}
if (nodeEnv === 'production' && clientOrigin.protocol !== 'https:') throw new Error('CLIENT_URL must use HTTPS in production');
export const env = {
  nodeEnv,
  devOtpLogging: nodeEnv === 'development' && /^(true|1)$/i.test(process.env.DEV_EMAIL_OTP || ''),
  port: Number(process.env.PORT || 5000), mongoUri: process.env.MONGODB_URI,
  trustProxyHops,
  maxConcurrentUploads,
  officeConverterUrl: (process.env.OFFICE_CONVERTER_URL || 'http://127.0.0.1:3101').replace(/\/+$/, ''),
  adobePdfServicesClientId: process.env.PDF_SERVICES_CLIENT_ID || '',
  adobePdfServicesClientSecret: process.env.PDF_SERVICES_CLIENT_SECRET || '',
  jwtSecret: process.env.JWT_SECRET, clientUrl,
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || ''
  },
  smtp: {
    host: process.env.SMTP_HOST || '', port: Number(process.env.SMTP_PORT || 587),
    secure: /^(true|1)$/i.test(process.env.SMTP_SECURE || ''), user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '', from: process.env.SMTP_FROM || ''
  },
  maxFileSize: maxFileSizeMb * 1024 * 1024,
  maxTotalUploadMb,
  maxTotalUploadSize: maxTotalUploadMb * 1024 * 1024,
  ttlMinutes: Number(process.env.TEMP_FILE_TTL_MINUTES || 60)
};
