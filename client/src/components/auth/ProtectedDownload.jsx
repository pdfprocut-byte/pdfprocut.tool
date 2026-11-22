import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import GoogleSignInButton from './GoogleSignInButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { authRequest } from '../../lib/authApi.js';
import '../../styles/protectedDownload.css';

export default function ProtectedDownload({ href, download, className, children, onDownloaded }) {
  const { user, setUser, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const downloadTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(downloadTimer.current), []);

  const downloadFile = () => {
    if (downloadTimer.current) return;
    const link = document.createElement('a');
    link.href = href;
    link.download = download;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setIsOpen(false);
    downloadTimer.current = window.setTimeout(() => {
      downloadTimer.current = null;
      onDownloaded?.();
    }, 160);
  };

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('login', { method: 'POST', body: { email, password } });
      setUser(data.user);
      setIsSignedIn(true);
    } catch (requestError) {
      if (requestError.code === 'EMAIL_NOT_VERIFIED') {
        const normalizedEmail = email.trim().toLowerCase();
        sessionStorage.setItem('pendingVerificationEmail', normalizedEmail);
        setEmail(normalizedEmail);
        setMode('verify');
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
    setNotice('');
    try {
      const data = await authRequest('google', { method: 'POST', body: { credential } });
      if (data.requiresEmailVerification) {
        sessionStorage.setItem('pendingVerificationEmail', data.email);
        setEmail(data.email);
        setMode('verify');
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

  const register = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await authRequest('register', { method: 'POST', body: { name, email, password } });
      const normalizedEmail = String(data.email || email).trim().toLowerCase();
      sessionStorage.setItem('pendingVerificationEmail', normalizedEmail);
      setEmail(normalizedEmail);
      setMode('verify');
      setNotice('Enter the verification code sent to your email.');
    } catch (requestError) {
      setError(requestError.message || 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verifyEmail = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('verify-email', { method: 'POST', body: { email, code: verificationCode } });
      sessionStorage.removeItem('pendingVerificationEmail');
      setUser(data.user);
      setIsSignedIn(true);
    } catch (requestError) {
      setError(requestError.message || 'Could not verify your email. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('resend-verification', { method: 'POST', body: { email } });
      setNotice(data.message || 'A new verification code was sent.');
    } catch (requestError) {
      setError(requestError.message || 'Could not resend the verification code.');
    } finally {
      setBusy(false);
    }
  };

  if (user && !isOpen) return <button className={className} type="button" onClick={downloadFile}>{children}</button>;

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
        </> : mode === 'verify' ? <>
          <span className="download-auth-kicker">EMAIL VERIFICATION</span>
          <h2 id="download-auth-title">Verify your email</h2>
          <p>Enter the 6 digit code sent to {email}. Your file will stay ready while you verify.</p>
          {error && <p className="download-auth-error" role="alert">{error}</p>}
          {notice && <p className="download-auth-notice" role="status">{notice}</p>}
          <form className="download-auth-form" onSubmit={verifyEmail}>
            <label>Verification code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"/></label>
            <button className="btn btn-primary download-auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying...' : 'Verify email'}</button>
          </form>
          <p className="download-auth-register"><button type="button" disabled={busy} onClick={resendVerification}>Resend code</button><span> · </span><button type="button" disabled={busy} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Back to sign in</button></p>
        </> : <>
          <span className="download-auth-kicker">ACCOUNT REQUIRED</span>
          <h2 id="download-auth-title">{mode === 'register' ? 'Create an account' : 'Sign in to download'}</h2>
          <p>Your processed file will stay here while you sign in or create an account.</p>
          {error && <p className="download-auth-error" role="alert">{error}</p>}
          {notice && <p className="download-auth-notice" role="status">{notice}</p>}
          <form className="download-auth-form" onSubmit={mode === 'register' ? register : signIn}>
            {mode === 'register' && <label>Name<input type="text" autoComplete="name" required minLength={1} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name"/></label>}
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
            <label>Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={mode === 'register' ? 8 : undefined} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}/></label>
            {mode === 'register' && <label>Confirm password<input type="password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter password"/></label>}
            <button className="btn btn-primary download-auth-submit" type="submit" disabled={busy}>{busy ? (mode === 'register' ? 'Creating account...' : 'Signing in...') : (mode === 'register' ? 'Create account' : 'Sign in')}</button>
          </form>
          <div className="download-auth-divider"><span>or</span></div>
          <GoogleSignInButton onCredential={signInWithGoogle} onError={(signInError) => setError(signInError.message)}/>
          <p className="download-auth-register">{mode === 'register' ? <>Already registered? <button type="button" onClick={() => { setMode('signin'); setError(''); }}>Sign in</button></> : <>Need an account? <button type="button" onClick={() => { setMode('register'); setError(''); setNotice(''); }}>Create one</button></>}</p>
        </>}
      </section>
    </div>, document.body)}
  </>;
}
