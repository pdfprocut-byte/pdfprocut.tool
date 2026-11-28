import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Footer from './components/layout/Footer.jsx';
import HomePage from './pages/HomePage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ProfileProvider } from './context/ProfileContext.jsx';
import { fetchWithCredentials, apiBaseUrl } from './lib/authApi.js';
import { AnalyticsSessionTracker, TRAFFIC_SOURCE_KEY } from './lib/analyticsTracking.js';
import { useAuth } from './context/AuthContext.jsx';
import { toolCatalog } from '../../shared/toolCatalog.mjs';
import { homeSeo, pageSeo } from '../../shared/pageSeo.mjs';
import './tool-hover.css';

const Placeholder = ({ title }) => <main className="container py-5"><h2>{title}</h2><p>The page you requested could not be found.</p></main>;
const ToolPage = lazy(() => import('./pages/ToolPage.jsx'));
const WordEditorPage = lazy(() => import('./pages/WordEditorPage.jsx'));
const AboutPage = lazy(() => import('./pages/AboutPage.jsx'));
const ContactPage = lazy(() => import('./pages/ContactPage.jsx'));
const GuidesPage = lazy(() => import('./pages/GuidesPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const AccountProfilePage = lazy(() => import('./pages/AccountProfilePage.jsx'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard.jsx'));
const AssistantChat = lazy(() => import('./components/AssistantChat.jsx'));
const LazyPage = ({ component: Component }) => <Suspense fallback={<main className="container py-5"><p role="status">Loading page…</p></main>}><Component/></Suspense>;
const noIndexPaths = new Set(['/login', '/register', '/verify-email', '/forgot-password', '/profile', '/word-editor']);

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(selector.startsWith('meta') ? 'meta' : 'link');
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
}

function SeoMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
    const toolSlug = path.match(/^\/tools\/([a-z0-9-]+)$/i)?.[1]?.toLowerCase();
    const tool = toolSlug ? toolCatalog.find((item) => item.slug === toolSlug) : null;
    const metadata = tool
      ? {
        title: `${tool.name}${tool.comingSoon ? ' Coming Soon' : ' Online'} | PDF Pro Cut`,
        description: tool.comingSoon ? `${tool.name} is coming soon to PDF Pro Cut.` : tool.description
      }
      : pageSeo[path] || homeSeo;
    const canonicalUrl = `https://pdfprocut.com${path}`;
    const robots = noIndexPaths.has(path) || path.startsWith('/admin') ? 'noindex,nofollow' : 'index,follow';

    document.title = metadata.title;
    setMeta('meta[name="description"]', 'content', metadata.description);
    setMeta('meta[name="robots"]', 'content', robots);
    setMeta('meta[property="og:title"]', 'content', metadata.title);
    setMeta('meta[property="og:description"]', 'content', metadata.description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('link[rel="canonical"]', 'href', canonicalUrl);
  }, [pathname]);

  return null;
}

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

function sendAnalyticsEvent(event, keepalive = false) {
  if (!event) return;
  fetchWithCredentials(`${apiBaseUrl}/analytics/events`, {
    method: 'POST',
    keepalive,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event)
  }).catch(() => {});
}

function getTrafficSource() {
  let source = sessionStorage.getItem(TRAFFIC_SOURCE_KEY);
  if (source) return source;
  try {
    const campaignSource = new URL(window.location.href).searchParams.get('utm_source')?.trim();
    const referrer = document.referrer ? new URL(document.referrer) : null;
    source = campaignSource || (referrer && referrer.origin !== window.location.origin ? referrer.hostname : 'direct');
  } catch {
    source = 'direct';
  }
  sessionStorage.setItem(TRAFFIC_SOURCE_KEY, source);
  return source;
}

function AnalyticsTracker() {
  const { pathname } = useLocation();
  const { loading } = useAuth();
  const trackerRef = useRef(null);
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  if (!trackerRef.current) trackerRef.current = new AnalyticsSessionTracker();
  const tracker = trackerRef.current;

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      tracker.lastHeartbeatAt = Date.now();
      return;
    }
    if (loading) return;
    sendAnalyticsEvent(tracker.pageView(pathname, getTrafficSource()));
  }, [pathname, loading]);

  useEffect(() => {
    const isTrackedPage = () => !currentPath.current.startsWith('/admin');
    const isForeground = () => document.visibilityState === 'visible' && document.hasFocus();
    const resetBaseline = (now = Date.now()) => { tracker.lastHeartbeatAt = now; };
    const heartbeat = () => {
      if (!isTrackedPage()) return resetBaseline();
      sendAnalyticsEvent(tracker.heartbeat({ path: currentPath.current, visible: isForeground() }), true);
    };
    const pageHide = () => {
      if (!isTrackedPage()) return resetBaseline();
      sendAnalyticsEvent(tracker.pageHide({ path: currentPath.current, visible: isForeground() }), true);
    };
    const visibilityChange = () => {
      if (!isTrackedPage()) {
        tracker.visibilityChange(isForeground());
        return;
      }
      sendAnalyticsEvent(tracker.visibilityChange(isForeground(), Date.now(), currentPath.current), true);
    };
    const windowBlur = () => {
      if (!isTrackedPage()) return resetBaseline();
      sendAnalyticsEvent(tracker.visibilityChange(false, Date.now(), currentPath.current), true);
    };
    const windowFocus = () => tracker.visibilityChange(isForeground(), Date.now(), currentPath.current);
    let lastInputAt = 0;
    const userActivity = () => {
      if (!isTrackedPage() || !isForeground()) return;
      const now = Date.now();
      if (now - lastInputAt < 1000) return;
      lastInputAt = now;
      tracker.markActivity(now);
    };
    const interval = window.setInterval(heartbeat, 15_000);
    window.addEventListener('pagehide', pageHide);
    document.addEventListener('visibilitychange', visibilityChange);
    window.addEventListener('blur', windowBlur);
    window.addEventListener('focus', windowFocus);
    window.addEventListener('pointerdown', userActivity, { passive: true });
    window.addEventListener('keydown', userActivity);
    window.addEventListener('scroll', userActivity, { passive: true });
    window.addEventListener('touchstart', userActivity, { passive: true });
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('pagehide', pageHide);
      document.removeEventListener('visibilitychange', visibilityChange);
      window.removeEventListener('blur', windowBlur);
      window.removeEventListener('focus', windowFocus);
      window.removeEventListener('pointerdown', userActivity);
      window.removeEventListener('keydown', userActivity);
      window.removeEventListener('scroll', userActivity);
      window.removeEventListener('touchstart', userActivity);
      resetBaseline();
    };
  }, []);
  return null;
}

export default function App() {
  const location = useLocation();
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isAdminPage = location.pathname.startsWith('/admin');

  return <AuthProvider>
    <ProfileProvider>
      <div className={`app${isAuthPage ? ' app-auth-page' : ''}${isAdminPage ? ' app-admin-page' : ''}`}>
        <ScrollToTop/>
        <SeoMetadata/>
        <AnalyticsTracker/>
        {!isAdminPage && <Navbar/>}
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/tools" element={<ToolsPage/>}/>
          <Route path="/tools/:slug" element={<Suspense fallback={<main className="container py-5"><p role="status">Opening tool…</p></main>}><ToolPage/></Suspense>}/>
          <Route path="/about" element={<LazyPage component={AboutPage}/>}/>
          <Route path="/contact" element={<LazyPage component={ContactPage}/>}/>
          <Route path="/guides" element={<LazyPage component={GuidesPage}/>}/>
          <Route path="/privacy-policy" element={<LazyPage component={PrivacyPolicyPage}/>}/>
          <Route path="/terms" element={<LazyPage component={TermsPage}/>}/>
          <Route path="/login" element={<LazyPage component={LoginPage}/>}/>
          <Route path="/register" element={<LazyPage component={RegisterPage}/>}/>
          <Route path="/verify-email" element={<LazyPage component={VerifyEmailPage}/>}/>
          <Route path="/forgot-password" element={<LazyPage component={ForgotPasswordPage}/>}/>
          <Route path="/profile" element={<LazyPage component={AccountProfilePage}/>}/>
          <Route path="/word-editor" element={<Suspense fallback={<main className="container py-5">Opening the Word Editor…</main>}><WordEditorPage/></Suspense>}/>
          <Route path="/admin" element={<LazyPage component={AdminDashboard}/>}/>
          <Route path="/admin/login" element={<LazyPage component={LoginPage}/>}/>
          <Route path="*" element={<Placeholder title="Page not found"/>}/>
        </Routes>
        {!isAdminPage && <Suspense fallback={null}><AssistantChat/></Suspense>}
        {!isAdminPage && <Footer/>}
      </div>
    </ProfileProvider>
  </AuthProvider>;
}
