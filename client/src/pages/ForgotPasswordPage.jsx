import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import PasswordField from '../components/auth/PasswordField.jsx';
import { authRequest } from '../lib/authApi.js';

const genericRequestNotice = 'If a verified account exists for this email, a reset code has been sent. The code expires in 10 minutes.';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const requestCode = async (event) => {
    event?.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await authRequest('forgot-password', { method: 'POST', body: { email } });
      setEmail(email.trim().toLowerCase());
      setStep('reset');
      setNotice(data.message || genericRequestNotice);
    } catch (requestError) {
      setError(requestError.message || 'Could not request a reset code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const data = await authRequest('reset-password', { method: 'POST', body: { email, code, password } });
      setStep('done');
      setNotice(data.message || 'Password updated. Sign in with your new password.');
    } catch (requestError) {
      setError(requestError.message || 'Could not reset your password. Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  const title = step === 'done' ? 'Password updated' : step === 'reset' ? 'Choose a new password' : 'Forgot your password?';
  const intro = step === 'done'
    ? 'Your account is ready to use with the new password.'
    : step === 'reset'
      ? `Enter the reset code sent to ${email} and choose a new password.`
      : 'Enter your account email and we will send a password reset code if it is registered.';

  return <AuthLayout variant="forgot-password" title={title} intro={intro}>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {step === 'email' && <form className="auth-form" onSubmit={requestCode}>
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/></label>
      <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Sending code...' : 'Send reset code'}</button>
    </form>}
    {step === 'reset' && <>
      <form className="auth-form" onSubmit={resetPassword}>
        <label>6 digit reset code<input className="auth-otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000"/></label>
        <PasswordField label="New password" autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters"/>
        <PasswordField label="Confirm new password" autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Re-enter your password"/>
        <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Updating password...' : 'Reset password'}</button>
      </form>
      <div className="auth-reset-actions">
        <button className="auth-text-button" type="button" onClick={() => requestCode()} disabled={busy}>Resend code</button>
        <button className="auth-text-button" type="button" onClick={() => { setStep('email'); setCode(''); setNotice(''); setError(''); }} disabled={busy}>Change email</button>
      </div>
    </>}
    {step === 'done' && <Link className="auth-submit auth-reset-signin" to="/login">Back to sign in</Link>}
    {step !== 'done' && <p className="auth-switch">Remembered your password? <Link to="/login">Sign in</Link></p>}
  </AuthLayout>;
}
