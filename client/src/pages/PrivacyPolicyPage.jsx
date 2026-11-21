import { Link } from 'react-router-dom';
import '../styles/contentPages.css';

const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;

export default function PrivacyPolicyPage() {
  return <main className="content-page policy-page">
    <div className="container content-reading-width">
      <header className="content-page-header">
        <span className="pdfpro-info-eyebrow">PDF PRO CUT POLICIES</span>
        <h1>Privacy Policy</h1>
        <p>Last updated: November 20, 2026</p>
        <p>This notice explains what PDF Pro Cut processes when you use its document tools, create an account, or sign in. The services and providers enabled by a particular deployment can affect how information is handled.</p>
      </header>

      <section><h2>Files and text you submit</h2>
        <p>When you use a document tool, the selected files and the options or text you provide are sent to the PDF Pro Cut API to produce the requested result. Standard PDF and image uploads are held in server memory while the request is processed; the API returns the output in the response. The app does not publish uploaded documents as public files.</p>
        <p>Word, Excel, and PowerPoint to PDF conversion uses a separate LibreOffice worker when that feature is configured. That worker writes each job into a temporary directory and removes the directory when the job ends. Do not submit a document unless you are authorized to process it and are comfortable with the hosting environment used by the site.</p>
      </section>

      <section><h2>App assistant messages</h2>
        <p>The app assistant sends your question and up to eight recent chat messages to the PDF Pro Cut API. The API matches the question and up to two recent user questions against the built-in tool list and guides. It does not send chat messages to an external AI provider or receive uploaded files. The app does not save chat history. Do not include passwords or private document contents.</p>
      </section>

      <section><h2>Account and sign-in information</h2>
        <p>If you register, the service processes your name, email address, password hash, verification state, and account timestamps. Passwords are stored as hashes, not as plain text. Email verification codes are sent through the email provider configured for the deployment; code verification data is stored in hashed form with an expiry.</p>
        <p>If Google sign-in is enabled, Google provides sign-in information such as your name, email address, and account identifier so the server can verify the sign-in and link the account. The app uses session and CSRF cookies for authentication and request protection. The session cookie is HttpOnly and expires after seven days.</p>
      </section>

      <section><h2>Local profile and work history</h2>
        <p>The optional Profile page stores your profile name, email address, phone number, resized profile photo, completed-tool history, and generated output files in this browser only. Profile details and history are encrypted in local storage; generated file contents are encrypted in IndexedDB. They are not sent to the PDF Pro Cut server or synced to another device. Generated output files are automatically removed from this browser after 30 minutes; files larger than 50 MB are not added to the local archive. Download a copy if you need to keep a file longer. The passcode cannot be recovered. If you forget it, you can erase the local profile and create a new one.</p>
        <p>Work history records the tool used, output filename, and completion time. Saved files can be downloaded, renamed, removed, or opened in the available tools from the Profile page. Anyone with access to an unlocked profile in this browser can view its details. Clearing browser site data also removes the local profile and files.</p>
      </section>

      <section><h2>Cookies, analytics, and advertising</h2>
        <p>Authentication uses a session cookie and a CSRF cookie. The current application code does not include an analytics tag or Google advertising tag. If advertising is enabled on this site, Google and other advertising providers may use cookies, web beacons, IP addresses, or similar identifiers to deliver and measure ads, including ads based on visits to this or other sites. You can manage Google's personalized advertising choices in <a href="https://adssettings.google.com/" target="_blank" rel="noreferrer">Google Ads Settings</a>.</p>
        <p>Where a deployment enables advertising or analytics, its operator must configure the relevant notices, consent choices, and provider settings for the regions it serves.</p>
      </section>

      <section><h2>Service providers and security</h2>
        <p>Information is processed by the hosting and database providers selected by the site operator. Account email is handled by the configured email provider. Google processes information when Google sign-in is used. These providers receive information needed to perform their services and may handle it under their own privacy terms.</p>
        <p>If you send a message from the Contact page, the service stores your name, email address, selected topic, message, and submission time in its database. Site administrators can open these messages in the admin inbox and use your email address to respond.</p>
        <p>The server applies upload limits, request rate limits, security headers, and restricted cross-origin access. Operational hosting providers may process connection and security logs. No internet service can promise that transmission or storage is risk-free.</p>
      </section>

      <section><h2>Retention and your choices</h2>
        <p>Uploaded files are processed for the requested operation and are not kept by the standard API as public downloads. Account information remains in the configured database while the account is maintained. Email providers may retain verification messages according to their own settings. Hosting providers may retain routine logs according to the deployment's configuration.</p>
        <p>You can sign out from your account. For questions or requests about account information, use the <Link to="/contact">Contact page</Link>{supportEmail ? <> or email <a href={`mailto:${supportEmail}`}>{supportEmail}</a></> : ''}.</p>
      </section>

      <section><h2>Children and policy changes</h2>
        <p>PDF Pro Cut is a general document utility and is not designed to collect information from children. The operator may update this notice when the service or its providers change. The latest version will be published on this page.</p>
      </section>

      <p className="content-page-note">This policy describes the application code and configurable integrations in this repository. The site operator should review it against the final hosting, email, sign-in, analytics, and advertising setup before launch.</p>
    </div>
  </main>;
}
