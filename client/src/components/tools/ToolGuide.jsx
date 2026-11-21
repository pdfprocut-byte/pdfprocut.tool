import { Link } from 'react-router-dom';
import { toolGuides } from '../../content/toolGuides.js';
import '../../styles/contentPages.css';

export default function ToolGuide({ tool }) {
  const guide = toolGuides[tool.slug];
  if (!guide) return null;

  return <article className="tool-guide" id="guide" aria-labelledby="tool-guide-title">
    <div className="tool-guide-heading">
      <span className="pdfpro-info-eyebrow">{tool.category} GUIDE</span>
      <h2 id="tool-guide-title">How to use {tool.name}</h2>
      <p>{guide.overview}</p>
    </div>
    <div className="tool-guide-grid">
      <section><h3>When to use it</h3><p>{guide.bestFor}</p></section>
      <section><h3>Steps</h3><ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
      <section><h3>Example</h3><p>{guide.example}</p></section>
      <section><h3>Limits and things to check</h3><p>{guide.limits}</p></section>
    </div>
    {guide.faqs?.length > 0 && <section className="tool-guide-faq" aria-labelledby="tool-guide-faq-title">
      <h3 id="tool-guide-faq-title">{tool.name} FAQ</h3>
      {guide.faqs.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
    </section>}
    <Link className="tool-guide-directory-link" to="/guides">Browse all tool guides</Link>
  </article>;
}
