import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FaLock } from 'react-icons/fa';
import { authRequest } from '../lib/authApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import '../styles/admin.css';

export default function AdminLoginPage() {
  const { user, loading, setUser } = useAuth();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  if (loading) return <main className="admin-loading">Loading…</main>;
  if (user?.role === 'admin') return <Navigate to="/admin" replace/>;
  const submit = async (event) => { event.preventDefault(); setBusy(true); setError(''); try { const data = await authRequest('admin/login', { method: 'POST', body: { email, password } }); setUser(data.user); navigate('/admin', { replace: true }); } catch (requestError) { setError(requestError.message); } finally { setBusy(false); } };
  return <main className="admin-login"><form className="admin-login-card" onSubmit={submit}><div className="admin-login-mark"><FaLock/></div><span>PDF PRO CUT ADMIN</span><h1>Administrator sign in</h1><p>Use an authorized administrator account to continue.</p>{error && <div className="admin-login-error" role="alert">{error}</div>}<label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password"/></label><button className="admin-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button><Link to="/">← Return to website</Link></form></main>;
}
