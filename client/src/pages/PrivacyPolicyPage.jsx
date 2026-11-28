import { Link } from 'react-router-dom';
import { contactEmail } from '../../../shared/contact.mjs';
import '../styles/contentPages.css';

export default function PrivacyPolicyPage() {
  return <main className="content-page policy-page">
    <div className="container content-reading-width">
      <header className="content-page-header">
        <span className="pdfpro-info-eyebrow">PDF PRO CUT POLICIES</span>
        <h1>Privacy Policy</h1>
        <p>Last updated: November 28, 2026</p>
        <p>This policy explains how PDF Pro Cut handles information when you use its document tools, create an account, contact support, or save work in your browser. The service is developed by Arun S.L. in Kerala, India.</p>
      </header>

      <section><h2>Files and text you submit</h2>
        <p>Government photo, signature, background, and DPI tools process images in your browser. Other tools send the selected files and the options or text you provide to the PDF Pro Cut API so it can perform the requested operation. Uploaded content is handled for that request; the standard API does not publish your documents as public files. The service may keep file names, file sizes, file types, tool name, result details, and processing status as described under Retention.</p>
        <p>Office document to PDF conversion uses Adobe PDF Services when configured, or a separate conversion worker when Adobe is not configured. PDF to Word conversion can also send the PDF to Adobe when that option is selected and configured. Adobe receives the file to perform the conversion and handles it under Adobe's terms. Other document operations are processed by the PDF Pro Cut API. Please do not submit documents unless you are authorized to use them with the selected service.</p>
      </section>

      <section><h2>App assistant</h2>
        <p>The assistant sends your question and up to eight recent chat messages to the PDF Pro Cut API. It matches the question against the app's built-in tool list and guides. It does not send messages to an external AI provider, receive uploaded files, or save chat history.</p>
      </section>

      <section><h2>Accounts and sign-in</h2>
        <p>When you register or maintain an account, the service stores your name, email address, password hash, email verification state, and account timestamps. Depending on the details you add, it may also store your phone number, profession, age, country, and profile photo. Passwords are stored as hashes. Verification and password-reset codes are stored in hashed form with an expiry and are sent by the configured email provider, either Resend or SMTP.</p>
        <p>If Google sign-in is enabled, Google shares the sign-in details needed to verify your identity and connect your account, such as your name, email address, and Google account identifier. Sign-in uses a session cookie that expires after seven days. A separate CSRF cookie helps protect account actions.</p>
      </section>

      <section><h2>Profile and saved files in your browser</h2>
        <p>The browser archive saves work history and output files, and the Profile page can also save your name, email, phone number, and resized profile photo. This information is kept in this browser using local storage and IndexedDB. It is not uploaded to the PDF Pro Cut server or synced to another device by the Profile feature. It is not encrypted by the app, so anyone with access to your browser profile may be able to view it. The app checks for saved output files older than 30 minutes and removes them while the site is open; if you close the browser first, cleanup waits until a later visit. Up to 100 history items are kept. Clearing this site's browser data also removes the local profile and saved files.</p>
      </section>

      <section><h2>Analytics and cookies</h2>
        <p>PDF Pro Cut uses first-party analytics to understand site use. It records page paths, a random browser identifier stored in local storage to recognize return visits, a visit identifier also stored in local storage and renewed after 30 minutes of inactivity, the referring website or campaign source, and time spent in the app. Successful document operations also record the tool, request path, duration, and an approximate country code when the hosting proxy provides one. Analytics is stored in the service database and may be associated with your account when you are signed in. The app's analytics records do not contain document contents.</p>
        <p>The session and CSRF cookies support sign-in and account security. The analytics identifier remains in local storage between visits so the same browser is counted once per local day; clearing this site's browser data creates a new identifier. The administrator can save advertising placement settings, but this version of the app does not load an advertising script.</p>
      </section>

      <section><h2>Messages and service providers</h2>
        <p>If you send a Contact page message, the service stores your name, email address, selected topic, message, and submission time. Authorized administrators can read messages to respond and manage support requests.</p>
        <p>PDF Pro Cut relies on its configured hosting and database providers. Resend or an SMTP provider handles account emails when configured. Adobe receives files only for the conversions described above when that service is enabled and used. A configured local conversion worker may process Office files. These providers handle information under their own service terms and privacy notices. Hosting providers may also process connection and security logs.</p>
      </section>

      <section><h2>Retention and your choices</h2>
        <p>Document contents are processed to create your result and are not stored as public downloads by the standard API. The service stores operation metadata, including input and output file details, in the database for a default of 60 minutes; this period can be changed by the service configuration. The browser archive checks for saved output files older than 30 minutes and removes them while the site is open; if the browser is closed, cleanup waits until a later visit. Account records, contact messages, and analytics records do not have an automatic expiry set by this app and may remain in the database until an administrator removes them.</p>
        <p>You can sign out of your account, remove locally saved files from your Profile page, or clear this site's browser data. For questions or to request access, correction, or deletion of account information, email <a href={`mailto:${contactEmail}`}>{contactEmail}</a> or use the <Link to="/contact">Contact page</Link>.</p>
      </section>

      <section><h2>Children and policy updates</h2>
        <p>PDF Pro Cut is a general document utility and is not designed to collect information from children. This policy may be updated when the app's features or data practices change. The current version and update date will appear on this page.</p>
      </section>
    </div>
  </main>;
}
