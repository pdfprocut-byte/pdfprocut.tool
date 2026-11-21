# Setup

Copy `server/.env.example` to `server/.env`, set a long random `JWT_SECRET`, and configure `MONGODB_URI`.

Email verification can use Resend or SMTP. For Resend, set `RESEND_API_KEY` and `RESEND_FROM` in `server/.env`. Create a sending-only API key and keep it in the server environment only; never put it in a `VITE_` variable or client code. `RESEND_FROM` must use an address from a domain verified in Resend. Resend's API sends the verification email from the backend. Alternatively, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` for an SMTP provider. Registration fails closed if the selected provider is not configured or cannot send the code.

For local development without an email domain, set `DEV_EMAIL_OTP=true` while `NODE_ENV=development`. When neither email provider can send, the OTP is printed in the backend terminal so the signup and verification flow can be tested. This option is ignored outside development and does not deliver real email.

Google sign-in requires a Google OAuth **Web application** client ID. In Google Cloud Console, add the exact frontend origin (for local development, `http://localhost:5173`) to its authorized JavaScript origins. Put the same client ID in both `server/.env` as `GOOGLE_CLIENT_ID` and `client/.env` as `VITE_GOOGLE_CLIENT_ID`. Restart both dev servers after changing environment files. Google ID tokens are verified by the server; the browser token is never trusted on its own.

The in-app assistant uses the built-in tool catalog and guides to match questions to relevant instructions. Include the action and file types, such as "PDF to Word" or "compress an image". Ambiguous questions ask for clarification; previous questions and the current page are used only for follow-ups. It does not need an external AI API key, and chat history is not saved.

Copy `client/.env.example` to `client/.env`. The Contact form saves submitted messages to MongoDB. Sign in as an administrator and open **Messages** in the admin dashboard to view them. `VITE_SUPPORT_EMAIL` adds an optional email address to the privacy page.

If the frontend host uses a Content Security Policy, allow Google's Identity Services script and sign-in frame (`https://accounts.google.com`).

Google-authoritative Gmail and Workspace addresses can be verified by Google. Google accounts that use a third-party email address receive the PDF Pro Cut email OTP as a second verification step. Local password registrations always require the email OTP.

Run `npm install`, then `npm run dev`. The web app runs on port 5173 and the API runs on port 5000.

MongoDB is required for accounts, contact messages, and job history. Core anonymous file processing works without persistent file storage. Do not expose the temporary processing directory as a static web directory.
