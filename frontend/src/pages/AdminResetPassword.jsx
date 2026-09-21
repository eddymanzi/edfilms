import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';

function AdminResetPassword() {
  useDocumentMeta({
    title: 'Reset Password',
    description: 'Choose a new admin password.',
    canonical: window.location.origin + '/admin/reset-password'
  });

  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/reset-password', {
        method: 'POST',
        body: { token, newPassword }
      });
      showToast('Password updated. You can now log in.', 'success');
      navigate('/admin/login');
    } catch (error) {
      showToast(error.message || 'Reset failed', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="brand-icon">ED</span>
            <span className="brand-text">EdFilms Admin</span>
          </div>
          <h1>Invalid Link</h1>
          <p className="auth-subtitle">
            This password reset link is missing its token. Request a new one below.
          </p>
          <Link to="/admin/forgot-password" className="btn btn-primary btn-block">Request Reset</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-icon">ED</span>
          <span className="brand-text">EdFilms Admin</span>
        </div>
        <h1>Reset Password</h1>
        <p className="auth-subtitle">Choose a new password for your admin account.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat the new password"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="auth-subtitle" style={{ textAlign: 'center', marginTop: '1rem' }}>
          <Link to="/admin/login">Back to Login</Link>
        </p>
      </div>
    </div>
  );
}

export default AdminResetPassword;