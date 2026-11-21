import { Link } from 'react-router-dom';
import { getToolCategoryClass, tools } from '../tools.js';
import { guideFaqs } from '../content/toolGuides.js';
import '../styles/contentPages.css';

export default function GuidesPage() {
  const groupedTools = [...new Set(tools.map((tool) => tool.category))].map((category) => ({
    category,
    entries: tools.filter((tool) => tool.category === category)
  }));

  return <main className="content-page guides-page">
    <div className="container">
      <header className="content-page-header">
        <span className="pdfpro-info-eyebrow">PDF PRO CUT HELP</span>
        <h1>Tool guides</h1>
        <p>Step-by-step instructions, practical examples, and known limits for the document tools in PDF Pro Cut. Choose a guide to open the tool and its full instructions.</p>
      </header>
      {groupedTools.map(({ category, entries }) => <section className={`guide-directory-section ${getToolCategoryClass(category)}`} key={category}>
        <h2>{category}</h2>
        <div className="guide-directory-grid">
          {entries.map((tool) => <article className="guide-directory-card" key={tool.slug}>
            <h3><Link to={`/tools/${tool.slug}#guide`}>{tool.name}</Link></h3>
            <p>{tool.description}</p>
            <Link className="guide-card-link" to={`/tools/${tool.slug}#guide`}>Read guide <span aria-hidden="true">→</span></Link>
          </article>)}
        </div>
      </section>)}
      <section className="content-faq-section" aria-labelledby="guides-faq-title">
        <span className="pdfpro-info-eyebrow">COMMON QUESTIONS</span>
        <h2 id="guides-faq-title">Using PDF Pro Cut tools</h2>
        {guideFaqs.map(({ question, answer }) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}
      </section>
      <p className="content-page-related">Read how files and account information are handled in our <Link to="/privacy-policy">Privacy Policy</Link>, or review the <Link to="/terms">Terms of Use</Link>.</p>
    </div>
  </main>;
}
