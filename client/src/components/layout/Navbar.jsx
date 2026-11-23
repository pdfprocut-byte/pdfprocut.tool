import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { FaChevronDown, FaRegUser } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext.jsx';
import { getToolCategoryClass, getToolCategoryLabel, tools } from '../../tools.js';
import BrandLogo from './BrandLogo.jsx';
import '../../styles/navbar.css';

const categoryOrder = ['Organize PDF', 'Optimize PDF', 'Convert to PDF', 'Convert from PDF', 'Convert to Document', 'Edit PDF', 'PDF Security', 'Analyze PDF', 'Compress'];
const orderedCategories = [...categoryOrder, ...new Set(tools.map((tool) => tool.category))]
  .filter((category, index, categories) => categories.indexOf(category) === index);
const toolGroups = orderedCategories
  .map((category) => [category, tools.filter((tool) => tool.category === category)])
  .filter(([, categoryTools]) => categoryTools.length > 0);

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const navRef = useRef(null);
  const menuToggleRef = useRef(null);
  const toolsToggleRef = useRef(null);
  const location = useLocation();
  const { user, logout } = useAuth();

  useEffect(() => {
    setMenuOpen(false);
    setToolsOpen(false);
  }, [location.pathname]);

  const closeMenus = () => {
    setMenuOpen(false);
    setToolsOpen(false);
  };

  useEffect(() => {
    if (!menuOpen && !toolsOpen) return undefined;
    const dismissOutside = (event) => {
      if (!navRef.current?.contains(event.target)) closeMenus();
    };
    const dismissOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      if (toolsOpen) {
        setToolsOpen(false);
        toolsToggleRef.current?.focus();
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
  }, [menuOpen, toolsOpen]);

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
      <button ref={menuToggleRef} className="navbar-toggler pdfpro-navbar-toggler" type="button" aria-controls="pdfpro-nav-content" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'} onClick={() => { if (menuOpen) setToolsOpen(false); setMenuOpen(!menuOpen); }}>
        <span className="navbar-toggler-icon"/>
      </button>
      <div id="pdfpro-nav-content" className={`pdfpro-nav-content${menuOpen ? ' is-open' : ''}`}>
        <div className="navbar-nav pdfpro-primary-nav gap-lg-2 align-items-lg-center">
          <NavLink className="nav-link" to="/" end onClick={closeMenus}>Home</NavLink>
          <div className="pdfpro-tools-item">
            <div className="pdfpro-tools-trigger-row">
              <NavLink className="nav-link" to="/tools" onClick={closeMenus}>Tools</NavLink>
              <button ref={toolsToggleRef} className="pdfpro-tools-dropdown-toggle" type="button" aria-label={toolsOpen ? 'Hide file tools' : 'Show all file tools'} aria-controls="pdfpro-tools-dropdown" aria-expanded={toolsOpen} onClick={() => setToolsOpen((open) => !open)}>
                <FaChevronDown aria-hidden="true"/>
              </button>
            </div>
            <div id="pdfpro-tools-dropdown" className={`pdfpro-tools-dropdown${toolsOpen ? ' is-open' : ''}`}>
              <div className="pdfpro-tools-dropdown-inner container">
                {toolGroups.map(([category, categoryTools]) => <section className={`pdfpro-tools-category ${getToolCategoryClass(category)}`} key={category} aria-label={category}>
                  <h2>{getToolCategoryLabel(category)}</h2>
                  {categoryTools.map((tool) => <Link className="pdfpro-tool-option" key={tool.slug} to={`/tools/${tool.slug}`} onClick={closeMenus}>
                    <span className="pdfpro-tool-icon"><tool.icon aria-hidden="true"/></span><span>{tool.name}</span>
                  </Link>)}
                </section>)}
                <Link className="pdfpro-all-tools-link" to="/tools" onClick={closeMenus}>Browse all tools</Link>
              </div>
            </div>
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
