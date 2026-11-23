import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaSearch, FaTimes } from 'react-icons/fa';
import ToolGrid from '../components/tools/ToolGrid.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useScrollReveal } from '../lib/useScrollReveal.js';
import { getToolCategoryClass, getToolCategoryLabel, tools } from '../tools.js';
import '../styles/toolsPage.css';

const categories = [...new Set(tools.map((tool) => tool.category))];
const featuredSlugs = ['merge-pdf', 'split-pdf', 'compress-files', 'kerala-psc-photo-resizer', 'ssc-photo-resizer', 'passport-size-photo-maker', 'pdf-to-document', 'pdf-to-powerpoint', 'pdf-to-excel', 'document-kb-compressor', 'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'edit-pdf'];
const toolRanks = new Map(featuredSlugs.map((slug, index) => [slug, index]));
const orderedTools = [...tools].sort((a, b) => (toolRanks.get(a.slug) ?? featuredSlugs.length) - (toolRanks.get(b.slug) ?? featuredSlugs.length));

export default function ToolsPage() {
  const { pendingToolFile } = useProfile();
  const toolsSectionRef = useScrollReveal('.tool-card');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const searchTerm = query.trim().toLowerCase();
  const visibleTools = orderedTools.filter((tool) =>
    (!activeCategory || tool.category === activeCategory) &&
    `${tool.name} ${tool.description} ${tool.category}`.toLowerCase().includes(searchTerm)
  );

  const showAllTools = () => {
    setQuery('');
    setActiveCategory('');
  };

  return <main className="tools-directory">
    <section className="tools-directory-hero">
      <div className="container">
        <nav className="tools-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Tools</span>
        </nav>
        <h1>Online <em>file tools.</em></h1>
        <p>Prepare government application photos, signatures, and documents, or edit PDFs and Office files.</p>
        <div className="tools-search-wrap">
          <FaSearch aria-hidden="true"/>
          <input
            type="search"
            aria-label="Search document tools"
            placeholder="Search tools"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><FaTimes aria-hidden="true"/></button>}
        </div>
      </div>
    </section>

    <section className="government-tools-overview container" aria-labelledby="government-tools-title">
      <div>
        <span className="pdfpro-info-eyebrow">APPLICATION IMAGE TOOLS</span>
        <h2 id="government-tools-title">Prepare photos and documents for applications</h2>
        <p>Choose dimensions and file-size targets from the current application notice, preview the result, then download a copy to check before submitting.</p>
      </div>
      <ul>
        <li>Automatic photo and signature resizing</li>
        <li>Width, height, and aspect-ratio controls</li>
        <li>KB compression and DPI metadata</li>
        <li>White backgrounds and signature cropping</li>
        <li>Live preview, instant download, and mobile-friendly layouts</li>
      </ul>
    </section>

    <section ref={toolsSectionRef} className="tools-directory-content container" aria-label="Tool directory">
      {pendingToolFile && <div className="profile-tool-launch-banner" role="status"><strong>{pendingToolFile.name}</strong> is ready from your profile. Choose a tool below and it will load automatically.</div>}
      <div className="tools-filter-row" id="tools-directory-results">
        <div className="tools-category-filters" role="group" aria-label="Filter tools by category">
          <button type="button" aria-pressed={!activeCategory} onClick={() => setActiveCategory('')}>All tools</button>
          {categories.map((category) => <button type="button" key={category} className={getToolCategoryClass(category)} aria-pressed={activeCategory === category} onClick={() => setActiveCategory(category)}>
            <span aria-hidden="true"/>{getToolCategoryLabel(category)}
          </button>)}
        </div>
        <p className="tools-result-count" role="status">{visibleTools.length} {visibleTools.length === 1 ? 'tool' : 'tools'}</p>
      </div>
      {visibleTools.length ? <ToolGrid tools={visibleTools}/> : <div className="tools-empty-state">
        <FaSearch aria-hidden="true"/>
        <h2>No matching tools</h2>
        <p>Try a different search or choose another category.</p>
        <button className="btn btn-primary" type="button" onClick={showAllTools}>Show all tools</button>
      </div>}
      <div className="tools-help-card">
        <h2>Need help choosing a tool?</h2>
        <Link to="/guides">Read the tool guides <FaArrowRight aria-hidden="true"/></Link>
      </div>
    </section>
  </main>;
}
