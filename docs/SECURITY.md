# Security notes

- Uploads are held in memory with a configurable size and file-count limit; client filenames are never used as paths.
- Helmet, restrictive CORS, request body limits, and rate limiting are enabled by default.
- Passwords use bcrypt with 12 rounds. Password hashes, OTP hashes, Google subject IDs, and JWT secrets are never returned.
- Local registrations remain unverified until a short-lived email OTP is entered. OTP hashes are HMAC-protected, expire after 10 minutes, allow five attempts, and have resend cooldown and rate limits.
- Google sign-in ID tokens are validated server-side against the configured OAuth client ID. Google `sub` identifies the linked account. Third-party email addresses still receive the email OTP.
- State-changing authentication requests require a matching double-submit CSRF token and an allowed `Origin`.
- Assistant chat requests require CSRF, are rate limited, and bound question/history sizes. Replies are matched locally against app guides; questions and uploaded files are not sent to a third-party AI provider.
- Deploy PDF/office/OCR worker processes in an isolated account or container. Apply CPU, memory, execution time, and outbound network limits.
- Set `CLIENT_URL` to the exact deployed frontend origin and use HTTPS. Production JWT cookies require `secure` and `SameSite=None`; browsers may restrict cookies if the frontend and API are on unrelated sites.
- The starter does not serve uploads as public static files.
