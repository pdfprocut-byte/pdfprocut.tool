import { Link } from 'react-router-dom';
import { FaArrowRight, FaBolt, FaLayerGroup, FaLock, FaMagic } from 'react-icons/fa';
import '../styles/infoPages.css';

export default function AboutPage() {
  return <main className="about-page">
    <section className="about-hero"><div className="container about-hero-inner">
      <div className="about-copy"><span className="pdfpro-info-eyebrow">ABOUT PDF PRO CUT</span><h2>Thoughtful tools for <em>everyday documents.</em></h2><p>PDF Pro Cut brings the essential ways to organize, edit, and convert files into one focused workspace—so every task feels clear and under control.</p><Link className="about-primary-button" to="/tools">Explore all tools <FaArrowRight/></Link></div>
      <div className="about-art" aria-label="PDF Pro Cut document workspace illustration"><div className="about-art-back"/><div className="about-art-card"><div className="about-art-top"><span><i/> PDF Pro Cut</span><b>•••</b></div><div className="about-art-document"><span className="about-pdf-badge">PDF</span><div><small>READY TO WORK</small><b>Your documents,<br/>made simple.</b></div></div><div className="about-art-lines"><i/><i/><i/></div><div className="about-art-done">✓ <span>Everything in one place</span></div></div><div className="about-art-float"><FaMagic/><span><b>Simple by design</b><small>Tools that stay out of your way</small></span></div></div>
    </div></section>

    <section className="about-values"><div className="container"><div className="about-section-heading"><span className="pdfpro-info-eyebrow">WHY PDF PRO CUT</span><h2>Built around the way<br/>you already work.</h2></div><div className="about-value-grid"><article><span className="about-value-icon"><FaLayerGroup/></span><h3>Everything together</h3><p>Organize, edit, convert, and create without bouncing between different apps.</p></article><article><span className="about-value-icon"><FaBolt/></span><h3>Less friction</h3><p>Clear tools and focused options help you finish the task without the clutter.</p></article><article><span className="about-value-icon"><FaLock/></span><h3>Work with confidence</h3><p>Your document workflow stays simple, private, and easy to understand.</p></article></div></div></section>

    <section className="about-tools-highlight"><div className="container about-tools-highlight-inner"><div><span className="pdfpro-info-eyebrow">MADE FOR THE EVERYDAY</span><h2>One place for every<br/><em>important file.</em></h2></div><p>Merge files, manage pages, add watermarks and page numbers, create PDFs from text or images, and make scanned pages searchable.</p><Link to="/tools" className="about-text-link">Find the right tool <FaArrowRight/></Link></div></section>
  </main>;
}
