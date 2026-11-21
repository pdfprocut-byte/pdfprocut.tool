import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authRequest } from '../../lib/authApi.js';
import '../../styles/protectedDownload.css';

export default function ProtectedDownload({ href, download, className, children }) {
  const { user, setUser, loading } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const downloadFile = () => {
    const link = document.createElement('a');
    link.href = href;
    link.download = download;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setIsOpen(false);
  };

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('login', { method: 'POST', body: { email, password } });
      setUser(data.user);
      setIsSignedIn(true);
    } catch (requestError) {
      if (requestError.code === 'EMAIL_NOT_VERIFIED') {
        const normalizedEmail = email.trim().toLowerCase();
        sessionStorage.setItem('pendingVerificationEmail', normalizedEmail);
        navigate('/verify-email', { state: { email: normalizedEmail } });
      } else {
        setError(requestError.message || 'Could not sign in. Try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithGoogle = async (credential) => {
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('google', { method: 'POST', body: { credential } });
      if (data.requiresEmailVerification) {
        sessionStorage.setItem('pendingVerificationEmail', data.email);
        navigate('/verify-email', { state: { email: data.email } });
        return;
      }
      setUser(data.user);
      setIsSignedIn(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in with Google. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (user && !isOpen) return <a className={className} href={href} download={download}>{children}</a>;

  return <>
    <button className={className} type="button" disabled={loading} aria-haspopup="dialog" onClick={() => { setIsOpen(true); setIsSignedIn(false); setError(''); }}>
      {children}
    </button>
    {isOpen && createPortal(<div className="download-auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setIsOpen(false); }}>
      <section className="download-auth-dialog" role="dialog" aria-modal="true" aria-labelledby="download-auth-title">
        <button className="download-auth-close" type="button" aria-label="Close sign-in dialog" disabled={busy} onClick={() => setIsOpen(false)}>×</button>
        {isSignedIn ? <>
          <span className="download-auth-kicker">SIGNED IN</span>
          <h2 id="download-auth-title">Your file is ready</h2>
          <p>Continue to download the processed file.</p>
          <button className="btn btn-success download-auth-submit" type="button" onClick={downloadFile}>Download now</button>
        </> : <>
          <span className="download-auth-kicker">ACCOUNT REQUIRED</span>
          <h2 id="download-auth-title">Sign in to download</h2>
          <p>Your processed file will stay here while you sign in.</p>
          {error && <p className="download-auth-error" role="alert">{error}</p>}
          <form className="download-auth-form" onSubmit={signIn}>
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password"/></label>
            <button className="btn btn-primary download-auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
          <div className="download-auth-divider"><span>or</span></div>
          <GoogleSignInButton onCredential={signInWithGoogle} onError={(signInError) => setError(signInError.message)}/>
          <p className="download-auth-register">Need an account? <Link to="/register" onClick={() => setIsOpen(false)}>Create one</Link>. After verifying, run the tool again.</p>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
