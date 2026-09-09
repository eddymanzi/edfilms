import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';

function AdminSettings() {
  useDocumentMeta({ title: 'Settings', canonical: window.location.origin + '/admin/settings' });

  const { showToast } = useToast();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/settings')
      .then(setSettings)
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', { method: 'PUT', body: settings });
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <AdminLayout title="Settings">
      <form onSubmit={handleSave} className="settings-form">
        <div className="form-section">
          <h2>Payment Configuration</h2>

          <div className="payment-status-card">
            <div className="payment-status-row">
              <span>Payment Provider</span>
              <strong>{(settings.payment?.provider || 'momo').toUpperCase()}</strong>
            </div>
            <div className="payment-status-row">
              <span>Payment Mode</span>
              <strong>{settings.payment?.mock ? 'MOCK (development only)' : (settings.payment?.mode || 'live')}</strong>
            </div>
            <div className="payment-status-row">
              <span>Currency</span>
              <strong>{settings.payment?.currency || 'RWF'}</strong>
            </div>
            <div className="payment-status-row">
              <span>Payment Status</span>
              {settings.payment?.configured
                ? <span className="badge badge-success">Configured</span>
                : <span className="badge badge-muted">Not Configured</span>}
            </div>
          </div>

          {!settings.payment?.configured && !settings.payment?.mock && (
            <p className="hint">
              Live MoMo is not configured. Add real MTN MoMo credentials to the backend <code>.env</code> file
              (MOMO_API_BASE_URL, MOMO_API_KEY, MOMO_API_SECRET, MOMO_SUBSCRIPTION_KEY, MOMO_TARGET_ENVIRONMENT)
              to enable live payments. Credentials are never displayed here.
            </p>
          )}
          {settings.payment?.mock && (
            <p className="hint warning-hint">
              ⚠ Mock payment mode is active for local development only. Never present mock payments as real payments.
            </p>
          )}
        </div>

        <div className="form-section">
          <h2>Site Settings</h2>

          <div className="form-group">
            <label>Site Name</label>
            <input
              value={settings.siteName || ''}
              onChange={(e) => handleChange('siteName', e.target.value)}
              placeholder="EdFilms"
            />
          </div>

          <div className="form-group">
            <label>Site Tagline</label>
            <input
              value={settings.siteTagline || ''}
              onChange={(e) => handleChange('siteTagline', e.target.value)}
              placeholder="Watch movies online"
            />
          </div>

          <div className="form-group">
            <label>Site Description</label>
            <textarea
              rows="4"
              value={settings.siteDescription || ''}
              onChange={(e) => handleChange('siteDescription', e.target.value)}
              placeholder="Brief description of your site for SEO"
            />
          </div>

          <div className="form-group">
            <label>Facebook URL</label>
            <input
              value={settings.facebookUrl || ''}
              onChange={(e) => handleChange('facebookUrl', e.target.value)}
              placeholder="https://facebook.com"
            />
          </div>

          <div className="form-group">
            <label>Twitter / X URL</label>
            <input
              value={settings.twitterUrl || ''}
              onChange={(e) => handleChange('twitterUrl', e.target.value)}
              placeholder="https://twitter.com"
            />
          </div>

          <div className="form-group">
            <label>Instagram URL</label>
            <input
              value={settings.instagramUrl || ''}
              onChange={(e) => handleChange('instagramUrl', e.target.value)}
              placeholder="https://instagram.com"
            />
          </div>

          <div className="form-group">
            <label>WhatsApp Number</label>
            <input
              value={settings.whatsappNumber || ''}
              onChange={(e) => handleChange('whatsappNumber', e.target.value)}
              placeholder="+1 234 567 8900"
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}

export default AdminSettings;