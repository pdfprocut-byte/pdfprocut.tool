import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { authRequest } from '../lib/authApi.js';
import '../styles/auth.css';

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState(location.state?.email || sessionStorage.getItem('pendingVerificationEmail') || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const verify = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('verify-email', { method: 'POST', body: { email, code } });
      sessionStorage.removeItem('pendingVerificationEmail');
      setUser(data.user);
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('resend-verification', { method: 'POST', body: { email } });
      setNotice(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page">
    <section className="auth-card auth-card-verify" aria-labelledby="verify-title">
      <Link className="auth-brand" to="/">PDF <span>Pro Cut</span></Link>
      <span className="auth-eyebrow">EMAIL VERIFICATION</span>
      <h2 id="verify-title">Check your inbox</h2>
      <p className="auth-intro">Enter the 6 digit code we sent to your email. The code expires in 10 minutes.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <form className="auth-form" onSubmit={verify}>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <label>Verification code<input className="auth-otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"/></label>
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify email'}</button>
      </form>
      <button className="auth-resend" type="button" onClick={resend} disabled={busy || !email.trim()}>Resend code</button>
      <p className="auth-switch"><Link to="/login">Back to sign in</Link></p>
    </section>
  </main>;
}
