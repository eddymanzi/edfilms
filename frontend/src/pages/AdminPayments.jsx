import React, { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';

const FILTERS = ['ALL', 'SUCCESS', 'PENDING', 'FAILED', 'CANCELLED'];

function maskPhone(phone) {
  if (!phone) return '-';
  return phone.slice(0, 2) + '•'.repeat(Math.max(0, phone.length - 4)) + phone.slice(-2);
}

function shortRef(ref) {
  if (!ref) return '-';
  return ref.slice(0, 8) + '…' + ref.slice(-6);
}

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value + (value.includes(' ') ? 'Z' : '')).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return value;
  }
}

const STATUS_BADGE = {
  SUCCESS: 'badge-success',
  PENDING: 'badge-warning',
  FAILED: 'badge-danger',
  CANCELLED: 'badge-muted',
  EXPIRED: 'badge-muted'
};

function AdminPayments() {
  useDocumentMeta({ title: 'Payments', canonical: window.location.origin + '/admin/payments' });

  const { showToast } = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/payments?page=${page}&limit=15&status=${filter}`);
      setData(res);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    apiFetch('/api/admin/stats')
      .then(s => setStats(s))
      .catch(() => {});
  }, []);

  if (loading && !data) return <Loader />;

  const payments = data?.payments || [];
  const pagination = data?.pagination || { page: 1, total: 0, pages: 1 };

  const statCards = [
    { label: 'Total Revenue (RWF)', value: Number(stats?.payments?.totalRevenueRwf || 0).toLocaleString(), icon: '💰' },
    { label: 'Successful Payments', value: stats?.payments?.successfulPayments || 0, icon: '✅' },
    { label: 'Pending Payments', value: stats?.payments?.pendingPayments || 0, icon: '⏳' },
    { label: 'Failed Payments', value: stats?.payments?.failedPayments || 0, icon: '⚠️' }
  ];

  return (
    <AdminLayout title="Payments">
      <div className="stat-grid">
        {statCards.map((card, i) => (
          <div key={i} className="stat-card" style={{ background: 'rgba(108, 92, 231, 0.08)' }}>
            <span className="stat-icon">{card.icon}</span>
            <div>
              <h3>{card.value}</h3>
              <p>{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-panel">
        <div className="filter-tabs" style={{ marginBottom: '1.25rem' }}>
          {FILTERS.map(f => (
            <button
              key={f}
              className={`btn btn-admin ${filter === f ? 'active' : ''}`}
              onClick={() => { setFilter(f); setPage(1); }}
            >
              {f}
            </button>
          ))}
        </div>

        {payments.length === 0 ? (
          <p>No payments found.</p>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payment ID</th>
                  <th>Movie</th>
                  <th>Customer Ref</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Provider</th>
                  <th>Transaction ID</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Paid At</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>#{p.id}</td>
                    <td>{p.movie_title || '-'}</td>
                    <td title={p.customer_reference}>{shortRef(p.customer_reference)}</td>
                    <td>{maskPhone(p.phone_number)}</td>
                    <td>{Number(p.amount_rwf).toLocaleString()} {p.currency}</td>
                    <td>{p.provider || '-'}</td>
                    <td title={p.provider_transaction_id}>{p.provider_transaction_id ? shortRef(p.provider_transaction_id) : '-'}</td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status] || 'badge-muted'}`}>{p.status || '-'}</span>
                    </td>
                    <td>{formatDate(p.created_at)}</td>
                    <td>{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="btn btn-admin" disabled={page <= 1} onClick={() => setPage(page - 1)}>Prev</button>
            <span className="pagination-info">Page {page} of {pagination.pages} ({pagination.total} total)</span>
            <button className="btn btn-admin" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

export default AdminPayments;