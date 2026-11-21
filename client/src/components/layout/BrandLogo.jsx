export default function BrandLogo({ inverse = false }) {
  return <span className={`pdfpro-brand-logo${inverse ? ' pdfpro-brand-logo-inverse' : ''}`} role="img" aria-label="PDF Pro Cut">
    <svg className="pdfpro-brand-mark" viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false">
      <g stroke="var(--brand-word-accent, #6537ce)" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="14" cy="16" r="6"/>
        <circle cx="14" cy="40" r="6"/>
        <path d="M19 20 45 44M19 36 45 12"/>
        <circle cx="28" cy="28" r="1.8" fill="var(--brand-word-accent, #6537ce)" stroke="none"/>
      </g>
    </svg>
    <span className="pdfpro-brand-wordmark" aria-hidden="true"><span className="pdfpro-brand-pdf">PDF</span><span className="pdfpro-brand-pro">Pro</span><span className="pdfpro-brand-cut">Cut</span></span>
  </span>;
}
