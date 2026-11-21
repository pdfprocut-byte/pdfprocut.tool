import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleSignInButton, { isGoogleSignInEnabled } from '../components/auth/GoogleSignInButton.jsx';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { authRequest } from '../lib/authApi.js';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const continueWithGoogle = async (credential) => {
    setBusy(true);
    setError('');
    try {
      const data = await authRequest('google', { method: 'POST', body: { credential } });
      if (data.requiresEmailVerification) {
        sessionStorage.setItem('pendingVerificationEmail', data.email);
        navigate('/verify-email', { state: { email: data.email } });
      } else {
        setUser(data.user);
        navigate('/', { replace: true });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await authRequest('register', { method: 'POST', body: { name, email, password } });
      sessionStorage.setItem('pendingVerificationEmail', data.email);
      navigate('/verify-email', { state: { email: data.email } });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <AuthLayout variant="register" title="Create your account" intro="We will send a verification code to your email.">
      {error && <p className="auth-error" role="alert">{error}</p>}
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>Name<input type="text" autoComplete="name" required minLength={1} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name"/></label>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
        <PasswordField label="Password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters"/>
        <PasswordField label="Confirm password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter password"/>
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
      </form>
      {isGoogleSignInEnabled && <>
        <div className="auth-divider"><span>or</span></div>
        <GoogleSignInButton onCredential={continueWithGoogle} onError={(googleError) => setError(googleError.message)}/>
      </>}
      <p className="auth-switch">Already registered? <Link to="/login">Sign in</Link></p>
  </AuthLayout>;
}
