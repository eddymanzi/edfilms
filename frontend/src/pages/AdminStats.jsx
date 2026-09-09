import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';

function AdminStats() {
  useDocumentMeta({ title: 'Statistics', canonical: window.location.origin + '/admin/stats' });

  const { showToast } = useToast();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/admin/stats')
      .then(setStats)
      .catch(err => showToast(err.message, 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  const publishedPct = stats.totalMovies > 0 ? Math.round((stats.publishedMovies / stats.totalMovies) * 100) : 0;
  const viewsPerMovie = stats.totalMovies > 0 ? Math.round(stats.totalViews / stats.totalMovies) : 0;
  const downloadsPerMovie = stats.totalMovies > 0 ? Math.round(stats.totalDownloads / stats.totalMovies) : 0;
  const freePct = stats.totalMovies > 0 ? Math.round((stats.freeMovies / stats.totalMovies) * 100) : 0;
  const paidPct = stats.totalMovies > 0 ? Math.round((stats.paidMovies / stats.totalMovies) * 100) : 0;

  return (
    <AdminLayout title="Statistics">
      <div className="admin-panel">
        <h2>Overview</h2>
        <div className="stat-grid">
          <div className="stat-card" style={{ background: 'rgba(108, 92, 231, 0.12)' }}>
            <span className="stat-icon">🎬</span>
            <div><h3>{stats.totalMovies}</h3><p>Total Movies</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(38, 222, 129, 0.12)' }}>
            <span className="stat-icon">✓</span>
            <div><h3>{stats.publishedMovies} ({publishedPct}%)</h3><p>Published</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(247, 183, 49, 0.12)' }}>
            <span className="stat-icon">⏸</span>
            <div><h3>{stats.unpublishedMovies}</h3><p>Unpublished</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(74, 144, 226, 0.12)' }}>
            <span className="stat-icon">👁</span>
            <div><h3>{stats.totalViews.toLocaleString()}</h3><p>Total Views</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(252, 92, 101, 0.12)' }}>
            <span className="stat-icon">⬇</span>
            <div><h3>{stats.totalDownloads.toLocaleString()}</h3><p>Total Downloads</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(162, 155, 254, 0.12)' }}>
            <span className="stat-icon">✉</span>
            <div><h3>{stats.totalMessages}</h3><p>Contact Messages</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(108, 92, 231, 0.06)' }}>
            <span className="stat-icon">📈</span>
            <div><h3>{viewsPerMovie.toLocaleString()}</h3><p>Avg Views / Movie</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(108, 92, 231, 0.06)' }}>
            <span className="stat-icon">📊</span>
            <div><h3>{downloadsPerMovie.toLocaleString()}</h3><p>Avg Downloads / Movie</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(38, 222, 129, 0.1)' }}>
            <span className="stat-icon">🆓</span>
            <div><h3>{stats.freeMovies} ({freePct}%)</h3><p>Free Movies</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(252, 92, 101, 0.1)' }}>
            <span className="stat-icon">💳</span>
            <div><h3>{stats.paidMovies} ({paidPct}%)</h3><p>Paid Movies</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(74, 144, 226, 0.1)' }}>
            <span className="stat-icon">✅</span>
            <div><h3>{stats.payments?.successfulPayments || 0}</h3><p>Successful Payments</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(38, 222, 129, 0.12)' }}>
            <span className="stat-icon">💰</span>
            <div><h3>{Number(stats.payments?.totalRevenueRwf || 0).toLocaleString()}</h3><p>Total Revenue (RWF)</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(252, 92, 101, 0.06)' }}>
            <span className="stat-icon">⬇️</span>
            <div><h3>{stats.freeDownloads}</h3><p>Free Download Movies</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(247, 183, 49, 0.08)' }}>
            <span className="stat-icon">🔒</span>
            <div><h3>{stats.paidDownloads}</h3><p>Paid Download Movies</p></div>
          </div>
          <div className="stat-card" style={{ background: 'rgba(162, 155, 254, 0.1)' }}>
            <span className="stat-icon">🔓</span>
            <div><h3>{stats.payments?.paidUnlocks || 0}</h3><p>Paid Unlocks</p></div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <h2>Top Viewed Movies</h2>
        <div className="table-responsive">
          {stats.recentMovies.length === 0 ? (
            <p>No movies yet.</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr><th>Movie</th><th>Views</th><th>Downloads</th><th>Status</th></tr>
              </thead>
              <tbody>
                {[...stats.recentMovies].sort((a, b) => b.views - a.views).map(movie => (
                  <tr key={movie.id}>
                    <td>{movie.title}</td>
                    <td>{movie.views.toLocaleString()}</td>
                    <td>{movie.downloads.toLocaleString()}</td>
                    <td>{movie.published ? <span className="badge badge-success">Published</span> : <span className="badge badge-muted">Draft</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminStats;