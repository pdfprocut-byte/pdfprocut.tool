import { Link } from 'react-router-dom';
import '../styles/contentPages.css';

export default function TermsPage() {
  return <main className="content-page policy-page">
    <div className="container content-reading-width">
      <header className="content-page-header">
        <span className="pdfpro-info-eyebrow">PDF PRO CUT POLICIES</span>
        <h1>Terms of Use</h1>
        <p>Last updated: November 20, 2026</p>
        <p>By using PDF Pro Cut, you agree to use the site and its document tools responsibly. If you do not agree to these terms, do not use the service.</p>
      </header>

      <section><h2>Using the tools</h2>
        <p>You may use the tools only for lawful purposes and only with files you own or are authorized to process. Do not use the service to violate another person's rights, bypass access controls without permission, distribute harmful code, or interfere with the site or its users.</p>
        <p>You are responsible for checking that the input files and the generated output are appropriate for your intended use. Keep an original copy of important documents and verify converted or edited results before relying on them.</p>
      </section>

      <section><h2>Your files and content</h2>
        <p>You retain your rights to files and content you submit. You give the service permission to process them only as needed to perform the tool operation you request and return its result. You confirm that you have the rights and permissions needed to submit that content.</p>
      </section>

      <section><h2>Availability and results</h2>
        <p>PDF Pro Cut is provided as an online utility. Tool availability can depend on the deployment's configuration and supporting services. The service may change, pause, or remove a feature. Conversion accuracy, formatting preservation, and uninterrupted availability are not guaranteed.</p>
        <p>Some tools have technical limits or can change searchable text, page layout, or image quality. Read the instructions and limits shown on each <Link to="/guides">tool guide</Link>, and review the output before sharing or using it for an important decision.</p>
      </section>

      <section><h2>Accounts and security</h2>
        <p>Keep your sign-in credentials and any PDF passwords secure. You are responsible for activity performed through your account. Tell the site operator if you believe someone has used your account without permission.</p>
      </section>

      <section><h2>Third-party services</h2>
        <p>Some features may rely on services configured by the site operator, including Google sign-in, email delivery, database hosting, or an isolated document-conversion worker. Those services may have their own terms and privacy notices.</p>
      </section>

      <section><h2>Changes and contact</h2>
        <p>The operator may update these terms as the service changes. Continued use after an update means you accept the updated terms. For questions about these terms, use the <Link to="/contact">Contact page</Link> or the support contact published for this deployment.</p>
      </section>
      <p className="content-page-note">These general terms should be reviewed by the site operator for the laws and service details that apply to the live deployment.</p>
    </div>
  </main>;
}
