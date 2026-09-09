import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';

function AdminDashboard() {
  useDocumentMeta({
    title: 'Admin Dashboard',
    canonical: window.location.origin + '/admin'
  });

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

  const statCards = stats ? [
    { label: 'Total Movies', value: stats.totalMovies, icon: '🎬', link: '/admin/movies', gradient: 'rgba(108, 92, 231, 0.15)' },
    { label: 'Published Movies', value: stats.publishedMovies, icon: '✓', link: '/admin/movies', gradient: 'rgba(38, 222, 129, 0.15)' },
    { label: 'Unpublished Movies', value: stats.unpublishedMovies, icon: '⏸', link: '/admin/movies', gradient: 'rgba(247, 183, 49, 0.15)' },
    { label: 'Total Views', value: stats.totalViews.toLocaleString(), icon: '👁', link: '/admin/stats', gradient: 'rgba(74, 144, 226, 0.15)' },
    { label: 'Total Downloads', value: stats.totalDownloads.toLocaleString(), icon: '⬇', link: '/admin/stats', gradient: 'rgba(252, 92, 101, 0.15)' },
    { label: 'Contact Messages', value: stats.totalMessages, icon: '✉', link: '/admin/messages', gradient: 'rgba(162, 155, 254, 0.15)' },
    { label: 'Revenue (RWF)', value: Number(stats.payments?.totalRevenueRwf || 0).toLocaleString(), icon: '💰', link: '/admin/payments', gradient: 'rgba(38, 222, 129, 0.1)' },
    { label: 'Successful Payments', value: stats.payments?.successfulPayments || 0, icon: '✅', link: '/admin/payments', gradient: 'rgba(74, 144, 226, 0.1)' }
  ] : [];

  return (
    <AdminLayout title="Dashboard">
      <div className="stat-grid">
        {statCards.map((card, i) => (
          <Link to={card.link} key={i} className="stat-card" style={{ background: card.gradient }}>
            <span className="stat-icon">{card.icon}</span>
            <div>
              <h3>{card.value}</h3>
              <p>{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {stats?.recentMovies?.length > 0 && (
        <div className="admin-panel">
          <h2>Recent Movies</h2>
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Views</th>
                  <th>Downloads</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentMovies.map(movie => (
                  <tr key={movie.id}>
                    <td><strong>{movie.title}</strong></td>
                    <td>{movie.year || '-'}</td>
                    <td>{movie.views.toLocaleString()}</td>
                    <td>{movie.downloads.toLocaleString()}</td>
                    <td>
                      {movie.published
                        ? <span className="badge badge-success">Published</span>
                        : <span className="badge badge-muted">Draft</span>}
                    </td>
                    <td className="row-actions">
                      <Link to={`/movie/${movie.slug}`} target="_blank">View</Link>
                      <Link to={`/admin/movies/${movie.id}/edit`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-panel">
        <h2>Quick Actions</h2>
        <div className="quick-actions">
          <Link to="/admin/movies/new" className="btn btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 8v8M8 12h8"/>
            </svg>
            Upload Movie
          </Link>
          <Link to="/admin/categories" className="btn btn-outline">Manage Categories</Link>
          <Link to="/admin/messages" className="btn btn-outline">View Messages</Link>
        </div>
      </div>
    </AdminLayout>
  );
}

export default AdminDashboard;
