import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GoogleSignInButton, { isGoogleSignInEnabled } from '../components/auth/GoogleSignInButton.jsx';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authRequest } from '../lib/authApi.js';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const finishLogin = (user) => {
    setUser(user);
    const isAdminLogin = location.pathname.startsWith('/admin');
    navigate(location.state?.from || (user.role === 'admin' ? '/admin' : isAdminLogin ? '/' : '/'), { replace: true });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('login', { method: 'POST', body: { email, password } });
      finishLogin(data.user);
    } catch (requestError) {
      if (requestError.code === 'EMAIL_NOT_VERIFIED') {
        sessionStorage.setItem('pendingVerificationEmail', email.trim().toLowerCase());
        navigate('/verify-email', { state: { email: email.trim().toLowerCase() } });
      } else {
        setError(requestError.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('google', { method: 'POST', body: { credential } });
      if (data.requiresEmailVerification) {
        sessionStorage.setItem('pendingVerificationEmail', data.email);
        navigate('/verify-email', { state: { email: data.email } });
        return;
      }
      finishLogin(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthLayout variant="login" title="Sign in" intro="Enter your verified email and password.">
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <PasswordField label="Password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password"/>
        <p className="auth-forgot-password"><Link to="/forgot-password">Forgot password?</Link></p>
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {isGoogleSignInEnabled && <>
        <div className="auth-divider"><span>or</span></div>
        <GoogleSignInButton onCredential={handleGoogleCredential} onError={(googleError) => setError(googleError.message)}/>
      </>}
      <p className="auth-switch">New to PDF Pro Cut? <Link to="/register">Create an account</Link></p>
  </AuthLayout>;
}
