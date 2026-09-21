import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';

function AdminForgotPassword() {
  useDocumentMeta({
    title: 'Forgot Password',
    description: 'Request an admin password reset email.',
    canonical: window.location.origin + '/admin/forgot-password'
  });

  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/forgot-password', {
        method: 'POST',
        body: { email }
      });
      setSent(true);
    } catch (error) {
      showToast(error.message || 'Request failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">ED</span>
          <span className="brand-text">EdFilms Admin</span>
        </div>
        <h1>Forgot Password</h1>

        {sent ? (
          <div className="auth-message-box" role="status">
            <p>
              If an account with that email exists, a password reset link has been sent.
              Check your inbox (and spam folder) within 30 minutes.
            </p>
            <Link to="/admin/login" className="btn btn-primary btn-block">Back to Login</Link>
          </div>
        ) : (
          <>
            <p className="auth-subtitle">
              Enter the email of your admin account and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="auth-subtitle" style={{ textAlign: 'center', marginTop: '1rem' }}>
              <Link to="/admin/login">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default AdminForgotPassword;