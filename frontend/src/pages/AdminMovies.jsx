import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function AdminMovies() {
  useDocumentMeta({ title: 'Manage Movies', canonical: window.location.origin + '/admin/movies' });

  const { showToast } = useToast();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async (query = '') => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/admin/movies?limit=50${query ? `&search=${encodeURIComponent(query)}` : ''}`);
      setMovies(data.movies || []);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    load(search);
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/movies/${id}`, { method: 'DELETE' });
      showToast('Movie deleted', 'success');
      load(search);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const togglePublish = async (movie) => {
    try {
      const updated = await apiFetch(`/api/admin/movies/${movie.id}`, {
        method: 'PUT',
        body: JSON.stringify({ published: !movie.published })
      });
      showToast(updated.published ? 'Movie published' : 'Movie unpublished', 'success');
      load(search);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <AdminLayout title="Manage Movies">
      <div className="admin-toolbar">
        <form onSubmit={handleSearch} className="admin-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movies..."
          />
          <button type="submit" className="btn btn-outline">Search</button>
        </form>
        <Link to="/admin/movies/new" className="btn btn-primary">+ Add Movie</Link>
      </div>

      {loading ? <Loader /> : movies.length === 0 ? (
        <EmptyState title="No movies" message="Upload your first movie to get started." />
      ) : (
        <div className="admin-panel">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Year</th>
                  <th>Genre</th>
                  <th>Views</th>
                  <th>Downloads</th>
                  <th>Featured</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {movies.map(movie => (
                  <tr key={movie.id}>
                    <td>{movie.title}</td>
                    <td>{movie.year || '-'}</td>
                    <td>{movie.genre || '-'}</td>
                    <td>{movie.views.toLocaleString()}</td>
                    <td>{movie.downloads.toLocaleString()}</td>
                    <td>{movie.featured ? '⭐' : '-'}</td>
                    <td>
                      <button
                        className={`badge ${movie.published ? 'badge-success' : 'badge-muted'} badge-button`}
                        onClick={() => togglePublish(movie)}
                      >
                        {movie.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="row-actions">
                      <Link to={`/movie/${movie.slug}`} target="_blank">View</Link>
                      <Link to={`/admin/movies/${movie.id}/edit`}>Edit</Link>
                      <button onClick={() => handleDelete(movie.id, movie.title)} className="link-danger">Delete</button>
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

export default AdminMovies;