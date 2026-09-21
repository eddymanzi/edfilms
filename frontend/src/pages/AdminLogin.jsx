import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';

const STORAGE_KEY = 'edfilms_admin_credentials';

function loadSavedCredentials() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.username && parsed.password) return parsed;
    return null;
  } catch (error) {
    return null;
  }
}

function AdminLogin() {
  useDocumentMeta({
    title: 'Admin Login',
    description: 'EdFilms admin login.',
    canonical: window.location.origin + '/admin/login'
  });

  const { login, admin } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const autoLoginTried = useRef(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (usernameValue, passwordValue) => {
    setSubmitting(true);
    try {
      await login(usernameValue, passwordValue);
      if (rememberMe) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ username: usernameValue, password: passwordValue }));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      showToast('Welcome back!', 'success');
      navigate('/admin');
      return true;
    } catch (error) {
      showToast(error.message || 'Login failed', 'error');
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    const saved = loadSavedCredentials();
    if (!saved) return;
    setUsername(saved.username);
    setPassword(saved.password);
    setRememberMe(true);
    if (autoLoginTried.current) return;
    autoLoginTried.current = true;
    handleSubmit(saved.username, saved.password);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (admin) {
    navigate('/admin', { replace: true });
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">ED</span>
          <span className="brand-text">EdFilms Admin</span>
        </div>
        <h1>Administrator Login</h1>
        <p className="auth-subtitle">Restricted area - administrators only</p>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(username, password); }} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username or Email</label>
            <input
              id="username"
              type="text"
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="form-group remember-group">
            <label className="remember-label">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me on this PC
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="auth-subtitle" style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link to="/admin/forgot-password">Forgot password?</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default AdminLogin;