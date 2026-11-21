import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import ToolPage from './pages/ToolPage.jsx';
import AboutPage from './pages/AboutPage.jsx';
import ContactPage from './pages/ContactPage.jsx';
import GuidesPage from './pages/GuidesPage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';
import TermsPage from './pages/TermsPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProfileProvider } from './context/ProfileContext.jsx';
import AccountProfilePage from './pages/AccountProfilePage.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import { fetchWithCredentials, apiBaseUrl } from './lib/authApi.js';
import { useAuth } from './context/AuthContext.jsx';
import AssistantChat from './components/AssistantChat.jsx';

const Placeholder = ({ title }) => <main className="container py-5"><h2>{title}</h2><p>The page you requested could not be found.</p></main>;
const WordEditorPage = lazy(() => import('./pages/WordEditorPage.jsx'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const frame = window.requestAnimationFrame(() => document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { loading } = useAuth();
  const visitorKey = 'pdfprocut_visitor_id';
  const sourceKey = 'pdfprocut_traffic_source';
  const lastPageViewKey = useRef('');
  const lastReportedAt = useRef(Date.now());
  useEffect(() => {
    if (loading || pathname.startsWith('/admin')) return;
    let visitorId = sessionStorage.getItem(visitorKey);
    if (!visitorId) { visitorId = crypto.randomUUID(); sessionStorage.setItem(visitorKey, visitorId); }
    const pageViewKey = `${visitorId}:${pathname}`;
    if (lastPageViewKey.current === pageViewKey) return;
    lastPageViewKey.current = pageViewKey;
    let source = sessionStorage.getItem(sourceKey);
    if (!source) {
      const campaignSource = new URL(window.location.href).searchParams.get('utm_source')?.trim();
      const referrer = document.referrer ? new URL(document.referrer) : null;
      source = campaignSource || (referrer && referrer.origin !== window.location.origin ? referrer.hostname : 'direct');
      sessionStorage.setItem(sourceKey, source);
    }
    fetchWithCredentials(`${apiBaseUrl}/analytics/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId, type: 'page_view', path: pathname, source }) }).catch(() => {});
  }, [pathname, loading]);
  useEffect(() => {
    const recordSession = () => {
      if (window.location.pathname.startsWith('/admin')) {
        lastReportedAt.current = Date.now();
        return;
      }
      if (document.visibilityState === 'hidden' && !navigator.sendBeacon) return;
      const visitorId = sessionStorage.getItem(visitorKey);
      const durationSeconds = Math.round((Date.now() - lastReportedAt.current) / 1000);
      if (!visitorId || durationSeconds < 1) return;
      lastReportedAt.current = Date.now();
      fetchWithCredentials(`${apiBaseUrl}/analytics/events`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorId, type: 'session', path: window.location.pathname, durationSeconds }) }).catch(() => {});
    };
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') recordSession(); }, 30_000);
    window.addEventListener('pagehide', recordSession);
    return () => { window.clearInterval(interval); window.removeEventListener('pagehide', recordSession); };
  }, []);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAuthPage = ['/login', '/register'].includes(location.pathname);
  const isAdminPage = location.pathname.startsWith('/admin');

  return <AuthProvider>
    <ProfileProvider>
      <div className={`app${isAuthPage ? ' app-auth-page' : ''}${isAdminPage ? ' app-admin-page' : ''}`}>
        <ScrollToTop/>
        <AnalyticsTracker/>
        {!isAdminPage && <Navbar/>}
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/tools" element={<ToolsPage/>}/>
          <Route path="/tools/:slug" element={<ToolPage/>}/>
          <Route path="/about" element={<AboutPage/>}/>
          <Route path="/contact" element={<ContactPage/>}/>
          <Route path="/guides" element={<GuidesPage/>}/>
          <Route path="/privacy-policy" element={<PrivacyPolicyPage/>}/>
          <Route path="/terms" element={<TermsPage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="/verify-email" element={<VerifyEmailPage/>}/>
          <Route path="/profile" element={<AccountProfilePage/>}/>
          <Route path="/word-editor" element={<Suspense fallback={<main className="container py-5">Opening the Word Editor…</main>}><WordEditorPage/></Suspense>}/>
          <Route path="/admin" element={<AdminDashboard/>}/>
          <Route path="/admin/login" element={<LoginPage/>}/>
          <Route path="*" element={<Placeholder title="Page not found"/>}/>
        </Routes>
        {!isAdminPage && <AssistantChat/>}
        {!isAdminPage && <Footer/>}
      </div>
    </ProfileProvider>
  </AuthProvider>;
}
