import React, { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function AdminCategories() {
  useDocumentMeta({ title: 'Manage Categories', canonical: window.location.origin + '/admin/categories' });

  const { showToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setCategories(await apiFetch('/api/admin/categories'));
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await apiFetch('/api/admin/categories', { method: 'POST', body: { name: name.trim() } });
      showToast('Category created', 'success');
      setName('');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const startEdit = (cat) => {
    setEditingId(cat.id);
    setEditName(cat.name);
  };

  const handleSave = async (id) => {
    try {
      await apiFetch(`/api/admin/categories/${id}`, { method: 'PUT', body: { name: editName.trim() } });
      showToast('Category updated', 'success');
      setEditingId(null);
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete category "${name}"? Movies will remain but lose this category.`)) return;
    try {
      await apiFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      showToast('Category deleted', 'success');
      load();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <AdminLayout title="Manage Categories">
      <form onSubmit={handleAdd} className="admin-toolbar">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category name"
        />
        <button type="submit" className="btn btn-primary">Add Category</button>
      </form>

      {loading ? <Loader /> : categories.length === 0 ? (
        <EmptyState title="No categories" message="Add your first category." />
      ) : (
        <div className="admin-panel">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id}>
                    <td>
                      {editingId === cat.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                        />
                      ) : cat.name}
                    </td>
                    <td>/category/{cat.slug}</td>
                    <td>{new Date(cat.createdAt).toLocaleDateString()}</td>
                    <td className="row-actions">
                      {editingId === cat.id ? (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => handleSave(cat.id)}>Save</button>
                          <button className="btn btn-outline btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => startEdit(cat)}>Edit</button>
                          <button className="link-danger" onClick={() => handleDelete(cat.id, cat.name)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

export default AdminCategories;