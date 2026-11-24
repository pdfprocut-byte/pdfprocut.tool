import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaSearch, FaTimes } from 'react-icons/fa';
import ToolGrid from '../components/tools/ToolGrid.jsx';
import { useProfile } from '../context/ProfileContext.jsx';
import { useScrollReveal } from '../lib/useScrollReveal.js';
import { tools } from '../tools.js';
import '../styles/toolsPage.css';

const featuredSlugs = ['merge-pdf', 'split-pdf', 'compress-files', 'kerala-psc-photo-resizer', 'ssc-photo-resizer', 'passport-size-photo-maker', 'pdf-to-document', 'pdf-to-powerpoint', 'pdf-to-excel', 'document-kb-compressor', 'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'edit-pdf'];
const toolRanks = new Map(featuredSlugs.map((slug, index) => [slug, index]));
const orderedTools = [...tools].sort((a, b) => (toolRanks.get(a.slug) ?? featuredSlugs.length) - (toolRanks.get(b.slug) ?? featuredSlugs.length));
const sections = [
  { name: 'Government', description: 'Prepare application photos, signatures, scans, and supporting files using the current notice.' },
  { name: 'Documents', description: 'Work with PDFs, images, and Office files.' },
  { name: 'Social Media', description: 'Resize profile photos, feed posts, stories, and reels with starting sizes you can customize.' }
];

export default function ToolsPage() {
  const { pendingToolFile } = useProfile();
  const toolsSectionRef = useScrollReveal('.tool-card');
  const [query, setQuery] = useState('');
  const [activeSection, setActiveSection] = useState('Government');
  const searchTerm = query.trim().toLowerCase();
  const visibleTools = orderedTools.filter((tool) =>
    tool.section === activeSection &&
    `${tool.name} ${tool.description} ${tool.category} ${tool.section}`.toLowerCase().includes(searchTerm)
  );

  const clearSearch = () => setQuery('');

  return <main className="tools-directory">
    <section className="tools-directory-hero">
      <div className="container">
        <nav className="tools-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link><span aria-hidden="true">/</span><span aria-current="page">Tools</span>
        </nav>
        <h1>Online <em>file tools.</em></h1>
        <p>Choose a government, document, or social media tool and start with editable size presets.</p>
        <div className="tools-search-wrap">
          <FaSearch aria-hidden="true"/>
          <input
            type="search"
            aria-label={`Search ${activeSection.toLowerCase()}`}
            placeholder={`Search ${activeSection.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><FaTimes aria-hidden="true"/></button>}
        </div>
      </div>
    </section>

    <section ref={toolsSectionRef} className="tools-directory-content container" aria-label="Tool directory">
      {pendingToolFile && <div className="profile-tool-launch-banner" role="status"><strong>{pendingToolFile.name}</strong> is ready from your profile. Choose a tool below and it will load automatically.</div>}
      <div className="tools-filter-row" id="tools-directory-results">
        <div className="tools-category-filters tools-section-filters" role="group" aria-label="Choose a tool section">
          {sections.map(({ name }) => <button type="button" key={name} aria-pressed={activeSection === name} onClick={() => { setActiveSection(name); setQuery(''); }}>
            {name}<span className="tools-section-count">{tools.filter((tool) => tool.section === name).length}</span>
          </button>)}
        </div>
        <p className="tools-result-count" role="status">{visibleTools.length} {visibleTools.length === 1 ? 'tool' : 'tools'}</p>
      </div>
      <header className="tools-section-heading">
        <span className="pdfpro-info-eyebrow">TOOL SECTION</span>
        <h2>{activeSection}</h2>
        <p>{sections.find(({ name }) => name === activeSection)?.description}</p>
      </header>
      {activeSection === 'Government' && <section className="government-tools-overview" aria-label="Government image tool features">
        <div>
          <span className="pdfpro-info-eyebrow">APPLICATION IMAGE TOOLS</span>
          <h3>Start with researched dimensions</h3>
          <p>Where an agency publishes a size, the tool loads it by default. Requirements can change by service and application cycle, so the preset stays editable.</p>
        </div>
        <ul>
          <li>Pixel size and aspect-ratio presets</li>
          <li>Editable width and height</li>
          <li>File-size targets where published</li>
          <li>Browser-based preview and download</li>
        </ul>
      </section>}
      {activeSection === 'Social Media' && <section className="government-tools-overview" aria-label="Social media image tool features">
        <div>
          <span className="pdfpro-info-eyebrow">SOCIAL IMAGE TOOLS</span>
          <h3>Start with a preset, then make it yours</h3>
          <p>Choose a profile, feed, or vertical content size. The output dimensions and image settings remain editable before download.</p>
        </div>
        <ul>
          <li>Profile photo platform presets</li>
          <li>Square, portrait, and landscape feed sizes</li>
          <li>Vertical story and reel presets</li>
          <li>Custom dimensions and frame handling</li>
        </ul>
      </section>}
      {visibleTools.length ? <ToolGrid tools={visibleTools}/> : <div className="tools-empty-state">
        <FaSearch aria-hidden="true"/>
        <h2>No matching tools</h2>
        <p>Try a different search or choose another category.</p>
        <button className="btn btn-primary" type="button" onClick={clearSearch}>Clear search</button>
      </div>}
      <div className="tools-help-card">
        <h2>Need help choosing a tool?</h2>
        <Link to="/guides">Read the tool guides <FaArrowRight aria-hidden="true"/></Link>
      </div>
    </section>
  </main>;
}
