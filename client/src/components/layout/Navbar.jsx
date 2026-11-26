import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FaChevronDown, FaRegUser } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { getToolCategoryClass, getToolCategoryLabel, tools } from '../../tools.js';
import BrandLogo from './BrandLogo.jsx';
import '../../styles/navbar.css';

const toolSectionNames = ['Public Service', 'Documents', 'Social Media'];

function groupToolsByCategory(sectionTools) {
  const groups = new Map();
  sectionTools.forEach((tool) => {
    if (!groups.has(tool.category)) groups.set(tool.category, []);
    groups.get(tool.category).push(tool);
  });
  return [...groups.entries()].sort(([, firstTools], [, secondTools]) => secondTools.length - firstTools.length);
}

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openToolSection, setOpenToolSection] = useState(null);
  const navRef = useRef(null);
  const menuToggleRef = useRef(null);
  const sectionToggleRefs = useRef({});
  const location = useLocation();
  const { user, logout } = useAuth();
  const activeToolSection = new URLSearchParams(location.search).get('section') || 'Public Service';

  useEffect(() => {
    setMenuOpen(false);
    setOpenToolSection(null);
  }, [location.pathname]);

  const closeMenus = () => {
    setMenuOpen(false);
    setOpenToolSection(null);
  };

  useEffect(() => {
    if (!menuOpen && !openToolSection) return undefined;
    const dismissOutside = (event) => {
      if (!navRef.current?.contains(event.target)) closeMenus();
    };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (openToolSection) {
        setOpenToolSection(null);
        sectionToggleRefs.current[openToolSection]?.focus();
      } else {
        setMenuOpen(false);
        menuToggleRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
    };
  }, [menuOpen, openToolSection]);

  const handleLogout = async () => {
    try {
      await logout();
      closeMenus();
      toast.success('Signed out');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return <nav ref={navRef} className="navbar navbar-expand-lg navbar-light bg-white border-bottom sticky-top pdfpro-navbar" aria-label="Main navigation">
    <div className="container py-2 pdfpro-navbar-container">
      <Link className="navbar-brand fw-bold fs-4" to="/" onClick={closeMenus} aria-label="PDF Pro Cut home"><BrandLogo/></Link>
      <button ref={menuToggleRef} className="navbar-toggler pdfpro-navbar-toggler" type="button" aria-controls="pdfpro-nav-content" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => { if (menuOpen) setOpenToolSection(null); setMenuOpen(!menuOpen); }}>
        <span className="navbar-toggler-icon"/>
      </button>
      <div id="pdfpro-nav-content" className={`pdfpro-nav-content${menuOpen ? ' is-open' : ''}`}>
        <div className="navbar-nav pdfpro-primary-nav gap-lg-2 align-items-lg-center">
          <NavLink className="nav-link" to="/" end onClick={closeMenus}>Home</NavLink>
          <NavLink className="nav-link" to="/tools" onClick={closeMenus}>Tools</NavLink>
          <div className="pdfpro-tool-section-nav" role="group" aria-label="Tool sections">
            {toolSectionNames.map((section) => {
              const active = location.pathname === '/tools' && activeToolSection === section;
              const isOpen = openToolSection === section;
              const sectionSlug = section.toLowerCase().replaceAll(' ', '-');
              const sectionCategories = groupToolsByCategory(tools.filter((tool) => tool.section === section));
              const dropdownId = `pdfpro-${sectionSlug}-dropdown`;
              return <div className={`pdfpro-section-menu pdfpro-section-menu-${sectionSlug}${isOpen ? ' is-open' : ''}`} key={section}>
                <div className="pdfpro-tools-trigger-row pdfpro-section-trigger-row">
                  <Link
                    className={`nav-link pdfpro-section-link${active ? ' active' : ''}`}
                    to={`/tools?section=${encodeURIComponent(section)}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={closeMenus}
                  >{section}</Link>
                  <button
                    ref={(element) => { sectionToggleRefs.current[section] = element; }}
                    className="pdfpro-tools-dropdown-toggle"
                    type="button"
                    aria-label={`${isOpen ? 'Hide' : 'Show'} ${section} tools`}
                    aria-controls={dropdownId}
                    aria-expanded={isOpen}
                    onClick={() => setOpenToolSection((current) => current === section ? null : section)}
                  ><FaChevronDown aria-hidden="true"/></button>
                </div>
                <div id={dropdownId} className={`pdfpro-section-dropdown${isOpen ? ' is-open' : ''}`} aria-hidden={!isOpen}>
                  <div className="pdfpro-section-dropdown-heading">
                    <h2>{section}</h2>
                    <Link to={`/tools?section=${encodeURIComponent(section)}`} onClick={closeMenus}>View all</Link>
                  </div>
                  <div className="pdfpro-section-categories-grid">
                    {sectionCategories.map(([category, categoryTools]) => <section className={`pdfpro-section-category-card ${getToolCategoryClass(category)}`} key={category}>
                      <h3>{section === 'Documents' ? getToolCategoryLabel(category) : category}</h3>
                      <div className="pdfpro-section-tool-list">
                        {categoryTools.map((tool) => <Link className="pdfpro-section-tool-option" key={tool.slug} to={`/tools/${tool.slug}`} onClick={closeMenus}>
                          <span className="pdfpro-tool-icon"><tool.icon aria-hidden="true"/></span><span>{tool.name}</span>
                        </Link>)}
                      </div>
                    </section>)}
                  </div>
                </div>
              </div>;
            })}
          </div>
          <NavLink className="nav-link" to="/contact" onClick={closeMenus}>Contact</NavLink>
          <NavLink className="nav-link" to="/guides" onClick={closeMenus}>Guides</NavLink>
          <NavLink className="nav-link" to="/about" onClick={closeMenus}>About</NavLink>
        </div>
        <div className="navbar-nav pdfpro-account-nav align-items-lg-center">
          {user ? <>
            <Link className="pdfpro-user-greeting" to="/profile" onClick={closeMenus} aria-label="Open your profile"><FaRegUser aria-hidden="true"/><span>{user.name.split(/\s+/)[0]}</span></Link>
            <button className="btn btn-outline-secondary pdfpro-logout-button" type="button" onClick={handleLogout}>Log out</button>
          </> : <>
            <NavLink className="nav-link pdfpro-account-link" to="/login" onClick={closeMenus}>Log in</NavLink>
            <NavLink className="btn btn-primary pdfpro-register-link" to="/register" onClick={closeMenus}>Get started</NavLink>
          </>}
        </div>
      </div>
    </div>
  </nav>;
}
