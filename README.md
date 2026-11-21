# PDF Pro Cut

PDF Pro Cut is a MERN PDF utility platform. It includes a React/Vite interface and an Express API with memory-limited uploads, secure headers, restricted CORS, rate limits, centralized errors, email-verified password accounts, Google sign-in, HttpOnly JWT sessions, CSRF protection, and real PDF processing. The Contact page delivers messages to the admin inbox.

## Available tools

- Merge PDF, split/extract pages, remove pages, rotate PDF
- Add a text watermark and page numbers
- Convert JPG/PNG scans into PDF and convert plain text to PDF

## Start

1. Copy `server/.env.example` to `server/.env` and set `JWT_SECRET`.
2. Configure MongoDB and SMTP in `server/.env` to enable accounts and email verification. Set the Google OAuth client ID in both server and client env files to enable Google sign-in.
3. Run `npm install`.
4. Run `npm run dev`.

Run `npm run build` for the frontend production build and `npm test` for server tests.

See [setup documentation](docs/SETUP.md) and [PDF dependency documentation](docs/PDF_DEPENDENCIES.md). Operations that need system software or third-party services are deliberately unavailable until their required isolated integration is configured; no fake success responses are returned.
