import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function AdminMessages() {
  useDocumentMeta({ title: 'Messages', canonical: window.location.origin + '/admin/messages' });

  const { showToast } = useToast();
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = async (resolved) => {
    setLoading(true);
    try {
      const query = resolved === 'all' ? '' : `?resolved=${resolved === 'resolved' ? 1 : 0}`;
      const data = await apiFetch(`/api/admin/messages${query}`);
      setMessages(data.messages || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(filter); }, [filter]);

  const handleResolve = async (id) => {
    try {
      await apiFetch(`/api/admin/messages/${id}`, { method: 'PUT' });
      showToast('Message marked as resolved', 'success');
      load(filter);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await apiFetch(`/api/admin/messages/${id}`, { method: 'DELETE' });
      showToast('Message deleted', 'success');
      load(filter);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <AdminLayout title="Contact Messages">
      <div className="admin-toolbar">
        <div className="filter-tabs">
          <button className={filter === 'all' ? 'btn btn-outline active' : 'btn btn-outline'} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'unresolved' ? 'btn btn-outline active' : 'btn btn-outline'} onClick={() => setFilter('unresolved')}>Unresolved</button>
          <button className={filter === 'resolved' ? 'btn btn-outline active' : 'btn btn-outline'} onClick={() => setFilter('resolved')}>Resolved</button>
        </div>
      </div>

      {loading ? <Loader /> : messages.length === 0 ? (
        <EmptyState title="No messages" message="Messages sent through the contact form will appear here." />
      ) : (
        <div className="message-list">
          {messages.map(msg => (
            <div key={msg.id} className={`message-card ${msg.resolved ? 'message-resolved' : ''}`}>
              <div className="message-header">
                <strong>{msg.name}</strong>
                <span className="message-email">{msg.email}</span>
                <span className="message-date">{new Date(msg.createdAt).toLocaleString()}</span>
                {msg.resolved && <span className="badge badge-success">Resolved</span>}
              </div>
              <p className="message-body">{msg.message}</p>
              <div className="message-actions">
                {!msg.resolved && (
                  <button className="btn btn-outline btn-sm" onClick={() => handleResolve(msg.id)}>Mark Resolved</button>
                )}
                <button className="link-danger" onClick={() => handleDelete(msg.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminMessages;