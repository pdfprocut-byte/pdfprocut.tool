import { Link } from 'react-router-dom';
import { FaArrowRight, FaLock } from 'react-icons/fa';
import BrandLogo from './BrandLogo.jsx';

export default function Footer() {
  return <footer className="pdfpro-footer">
    <div className="container">
      <div className="pdfpro-footer-main">
        <div className="pdfpro-footer-brand"><Link to="/" className="pdfpro-footer-logo" aria-label="PDF Pro Cut home"><BrandLogo inverse/></Link><p>Tools for PDFs, Office files, and images.</p><div className="pdfpro-footer-trust"><FaLock/> Your files stay private</div></div>
        <div className="pdfpro-footer-links"><div><b>Explore</b><Link to="/tools">All tools</Link><Link to="/guides">Tool guides</Link><Link to="/tools/merge-pdf">Merge PDF</Link><Link to="/tools/add-watermark">Add watermark</Link></div><div><b>PDF Pro Cut</b><Link to="/about">About us</Link><Link to="/contact">Contact</Link><Link to="/privacy-policy">Privacy policy</Link><Link to="/terms">Terms of use</Link><Link to="/login">Log in <FaArrowRight/></Link></div></div>
      </div>
      <div className="pdfpro-footer-bottom"><small>© {new Date().getFullYear()} PDF Pro Cut. Made for simpler document work.</small><small>Files are processed temporarily and are not published.</small></div>
    </div>
  </footer>;
}
