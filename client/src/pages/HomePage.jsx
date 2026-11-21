import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaCheck, FaCloudUploadAlt, FaLayerGroup, FaLock, FaSlidersH, FaSyncAlt } from 'react-icons/fa';
import ToolGrid from '../components/tools/ToolGrid.jsx';
import { resetTilt, trackTilt } from '../lib/tiltMotion.js';
import { useScrollReveal } from '../lib/useScrollReveal.js';
import { tools } from '../tools.js';
import '../styles/homePage.css';

const descriptionWords = 'Edit PDFs and Word documents, convert Office files, and compress images in one workspace.'.split(' ');
const popularSlugs = ['merge-pdf', 'remove-pages', 'add-watermark', 'add-page-numbers', 'text-to-pdf', 'text-to-document'];
const popularTools = popularSlugs.map((slug) => tools.find((tool) => tool.slug === slug));
const recentToolSlugs = ['flatten-pdf', 'extract-images-pdf', 'pdf-to-png', 'pdf-metadata-cleaner'];
const recentTools = recentToolSlugs.map((slug) => tools.find((tool) => tool.slug === slug)).filter(Boolean);

const taskCards = [
  { title: 'Organize pages', detail: 'Merge PDFs or remove pages you do not need.', slug: 'merge-pdf', Icon: FaLayerGroup, tone: 'violet' },
  { title: 'Convert files', detail: 'Turn PDFs into images or office documents.', slug: 'pdf-to-png', Icon: FaSyncAlt, tone: 'blue' },
  { title: 'Flatten forms', detail: 'Make form fields and annotations part of the page.', slug: 'flatten-pdf', Icon: FaSlidersH, tone: 'coral' },
  { title: 'Clean PDF details', detail: 'Remove document properties before sharing.', slug: 'pdf-metadata-cleaner', Icon: FaLock, tone: 'lime' }
];

const workflow = [
  { title: 'Choose a tool', detail: 'Pick a tool and upload your file.', Icon: FaCloudUploadAlt, color: 'lilac' },
  { title: 'Make your changes', detail: 'Arrange pages or adjust the settings you need.', Icon: FaSlidersH, color: 'coral' },
  { title: 'Download your file', detail: 'Save the finished document when it’s ready.', Icon: FaCheck, color: 'lime' },
];

const documentFormats = [
  { format: 'TXT', name: 'Text' },
  { format: 'DOCX', name: 'Word' },
  { format: 'JPG', name: 'Image' },
  { format: 'PDF', name: 'PDF' },
  { format: 'PPTX', name: 'PowerPoint' },
  { format: 'XLSX', name: 'Excel' },
];

function DocumentIllustration() {
  return <div className="home-illustration" aria-hidden="true" onPointerMove={trackTilt} onPointerLeave={resetTilt}>
    <div className="home-art-grid"/>
    <div className="home-art-orbit home-art-orbit-outer"/>
    <div className="home-art-orbit home-art-orbit-inner"/>
    <div className="home-art-spark home-art-spark-lime"/>
    <div className="home-art-spark home-art-spark-white"/>
    <div className="home-art-depth">
      <div className="home-doc-stack">
        {documentFormats.map(({ format, name }, index) => <div
          className={`home-doc home-doc-back home-doc-${format.toLowerCase()}`}
          key={format}
          style={{ '--sheet-depth': documentFormats.length - index - 1 }}
        >
          <span className="home-doc-back-label"><strong>{name}</strong><small>{format}</small></span>
          <div className="home-doc-back-lines"/>
        </div>)}
        <div className="home-doc home-doc-front">
          <div className="home-doc-paper">
            <span className="home-doc-fold"/>
            <span className="home-doc-format">PDF</span>
            <div className="home-doc-title-line"/>
            <div className="home-doc-lines"><i/><i/><i/><i/></div>
            <div className="home-doc-table"/>
            <div className="home-doc-footer"/>
          </div>
        </div>
      </div>
      <span className="home-art-chip home-art-chip-convert"><FaSyncAlt/> Convert</span>
      <span className="home-art-chip home-art-chip-merge"><FaLayerGroup/> Merge</span>
    </div>
  </div>;
}

export default function HomePage() {
  const toolsSectionRef = useScrollReveal('.home-section-heading, .home-task-card, .tool-card');

  return <main ref={toolsSectionRef} className="home-page">
    <section className="home-hero">
      <div className="container home-hero-inner">
        <div className="home-hero-copy">
          <h1>Your files.<br/><em>Under control.</em></h1>
          <p className="home-hero-description">
            {descriptionWords.map((word, index) => <Fragment key={index}>
              <span style={{ '--word-index': index }}>{word}</span>
              {index < descriptionWords.length - 1 ? ' ' : null}
            </Fragment>)}
          </p>
          <div className="home-hero-actions">
            <Link className="home-primary-button" to="/tools">Explore all tools <FaArrowRight aria-hidden="true"/></Link>
            <Link className="home-secondary-button" to="/tools/merge-pdf">Try Merge PDF</Link>
          </div>
          <div className="home-privacy"><FaLock aria-hidden="true"/> Files are processed privately</div>
        </div>
        <DocumentIllustration/>
      </div>
    </section>

    <section className="home-tools-section" id="tools" aria-labelledby="home-tools-title">
      <div className="container">
        <div className="home-section-heading">
          <div><h2 id="home-tools-title">Popular tools</h2><p>Start with one of these everyday document tasks.</p></div>
          <Link className="home-text-link" to="/tools">View all tools <FaArrowRight aria-hidden="true"/></Link>
        </div>
        <ToolGrid tools={popularTools}/>
      </div>
    </section>

    <section className="home-task-section" aria-labelledby="home-task-title">
      <div className="container">
        <div className="home-section-heading">
          <div><h2 id="home-task-title">What do you need to do?</h2><p>Start with a task and open the tool that fits.</p></div>
        </div>
        <div className="home-task-grid">
          {taskCards.map(({ title, detail, slug, Icon, tone }) => <Link className={`home-task-card home-task-${tone}`} to={`/tools/${slug}`} key={slug}>
            <span className="home-task-icon"><Icon aria-hidden="true"/></span>
            <span className="home-task-copy"><strong>{title}</strong><small>{detail}</small></span>
            <FaArrowRight className="home-task-arrow" aria-hidden="true"/>
          </Link>)}
        </div>
      </div>
    </section>

    <section className="home-tools-section home-new-tools-section" aria-labelledby="home-new-tools-title">
      <div className="container">
        <div className="home-section-heading">
          <div><h2 id="home-new-tools-title">More PDF tools</h2><p>Flatten, extract, convert, or clean up your PDF.</p></div>
          <Link className="home-text-link" to="/tools">Browse every tool <FaArrowRight aria-hidden="true"/></Link>
        </div>
        <ToolGrid tools={recentTools}/>
      </div>
    </section>

    <section className="home-workflow-section" id="how-it-works" aria-labelledby="home-workflow-title">
      <div className="container">
        <div className="home-workflow">
          <div className="home-workflow-intro">
            <h2 id="home-workflow-title">From file to<br/><em>finished.</em></h2>
            <Link className="home-text-link" to="/guides">Read the tool guides <FaArrowRight aria-hidden="true"/></Link>
          </div>
          <div className="home-workflow-steps">
            {workflow.map(({ title, detail, Icon, color }) => <article key={title}>
              <span className={`home-step-icon home-step-${color}`}><Icon aria-hidden="true"/></span>
              <h3>{title}</h3><p>{detail}</p>
            </article>)}
          </div>
        </div>
      </div>
    </section>
  </main>;
}
