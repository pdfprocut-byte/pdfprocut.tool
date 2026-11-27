# API

Additional PDF-processing routes:

| Method | Route | File fields | Other fields |
|---|---|---|---|
| POST | `/api/pdf/html-to-pdf` | none | `html` with basic text formatting |
| POST | `/api/pdf/office-to-pdf` | `files` DOC/DOCX/XLS/XLSX/PPT/PPTX | XLS/XLSX require Adobe PDF Services; DOC/DOCX/PPT/PPTX use Adobe when configured or the isolated LibreOffice worker otherwise |
| POST | `/api/pdf/pdf-to-powerpoint` | `files` PDF | returns image-based `PDFPro.pptx` |
| POST | `/api/pdf/pdf-to-pdfa` | `files` PDF | rasterized PDF/A-1b output |
| POST | `/api/pdf/repair-pdf` | `files` PDF | repair/normalize a readable PDF |
| POST | `/api/pdf/crop-pdf` | `files` PDF | optional `left`, `right`, `top`, `bottom`, `pages` margins |
| POST | `/api/pdf/edit-pdf` | `files` PDF | `text`, `page`, `x`, `y`, `size`, `font`, `color` |
| POST | `/api/pdf/sign-pdf` | `files` PDF and `signature` PNG/JPG | `page`, `position`, `widthPercent` |
| POST | `/api/pdf/unlock-pdf` | `files` encrypted PDF | `password` |
| POST | `/api/pdf/redact-pdf` | `files` PDF | `terms` separated by commas; output is rasterized |
| POST | `/api/pdf/form-fields` | `files` PDF | returns fillable field names and options |
| POST | `/api/pdf/fill-form` | `files` PDF | `values` JSON object keyed by field name |
| POST | `/api/pdf/to-jpg` | `files` PDF | optional JPG `quality`; returns `PDFPro.zip` |
| POST | `/api/pdf/to-markdown` | `files` PDF | returns `PDFPro.md` |
| POST | `/api/pdf/to-excel` | `files` PDF | returns a page/text `.xlsx` export |
| POST | `/api/pdf/summarize` | `files` PDF | returns a local extractive summary as JSON |
| POST | `/api/pdf/compare` | `files` (2) PDFs | returns page-level selectable-text differences as JSON |
| GET | `/api/pdf/ocr-pdf/languages` | none | returns supported model codes, names, and the selection limit |
| POST | `/api/pdf/ocr-pdf` | `files` PDF, PNG, or JPG | optional `languages`, for example `mal+eng`. Defaults to `eng` |

All JSON responses have a `success` boolean. Processing responses stream an attachment and include `X-Job-Id`.

| Method | Route | Files | Fields |
|---|---|---|---|
| POST | `/api/pdf/merge` | `files` (2+) PDFs | — |
| POST | `/api/pdf/split` | `files` PDF | `pages` such as `1-3,5` |
| POST | `/api/pdf/extract-pages` | `files` PDF | `pages` |
| POST | `/api/pdf/remove-pages` | `files` PDF | `pages` |
| POST | `/api/pdf/rotate` | `files` PDF | `angle`, optional `pages` |
| POST | `/api/pdf/add-watermark` | `files` PDF | `text`, optional `opacity` |
| POST | `/api/pdf/add-page-numbers` | `files` PDF | optional `start` |
| POST | `/api/pdf/scan-to-pdf` | `files` JPG/PNG | — |
| POST | `/api/pdf/convert-to-pdf` | `files` JPG/PNG/text | — |

| POST | `/api/pdf/pdf-to-document` | `files` PDF | DOCX; selectable text, up to 100 pages |
| POST | `/api/pdf/pdf-to-document/text` | `files` PDF | JSON with extracted text for editing |

| POST | `/api/pdf/compress` | `files` PDF or modern Word/Excel/PowerPoint OOXML | `targetSizeMb` between 1/1024 and 25 (1 KB to 25 MB); optional `quality`: `clear`, `balanced`, or `smallest` |
| POST | `/api/image/compress` | `files` JPG or PNG | `targetSizeMb` between 1/1024 and 1024 (1 KB to 1 GB); optional `quality`: `clear`, `balanced`, or `smallest` |

Authentication routes are `/api/auth/csrf`, `/register`, `/login`, `/google`, `/verify-email`, `/resend-verification`, `/logout`, and `/me` under `/api/auth`. Mutating routes require the CSRF token returned by `/csrf` in the `X-CSRF-Token` header. Sessions use an HttpOnly JWT cookie. Local registrations require email OTP verification before a session is created. Google login accepts an ID token in `credential` and verifies it server-side.

`POST /api/contact` accepts `name`, `email`, `topic`, and `message` as JSON. Visitors can submit without signing in by using the CSRF cookie and matching `X-CSRF-Token` header. `GET /api/admin/messages?page=1` requires an administrator session and lists stored messages 20 at a time, newest first.

`POST /api/assistant/chat` accepts `question`, optional recent `history`, and `currentPath` as JSON. It is available without signing in, requires the CSRF cookie and matching `X-CSRF-Token` header, and is limited to 12 requests per 15 minutes per client IP. Answers are matched locally against the built-in tool catalog and guides; no external AI provider is called and chat history is not stored by this app.
