import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiFetch, API_URL } from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useDocumentMeta } from '../utils/helpers';
import AdminLayout from '../components/AdminLayout';
import Loader from '../components/Loader';

const GENRES = ['Action', 'Comedy', 'Drama', 'Romance', 'Animation', 'Documentary', 'Adventure', 'Horror', 'Sci-Fi', 'Thriller'];
const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Arabic', 'Japanese', 'Korean', 'Chinese', 'Portuguese', 'Russian'];

const MAX_VIDEO_SIZE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const MAX_POSTER_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'mov'];
const ACCEPTED_POSTER_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(0) + ' GB';
  return Math.round(bytes / (1024 * 1024)) + ' MB';
}

function getFileExtension(filename) {
  return filename.toLowerCase().split('.').pop() || '';
}

const EMPTY_FORM = {
  title: '',
  description: '',
  year: '',
  language: 'English',
  duration: '',
  rating: '',
  genre: '',
  categories: [],
  featured: false,
  published: false,
  allowDownload: true,
  accessType: 'FREE',
  downloadAccess: 'FREE',
  priceRwf: ''
};

const ACCESS_PRESETS = [
  {
    id: 'FREE',
    label: 'FREE',
    description: 'Everything is free to watch and download.',
    watch: 'FREE',
    download: 'FREE'
  },
  {
    id: 'WATCH_FREE_DOWNLOAD_PAID',
    label: 'WATCH FREE / DOWNLOAD PAID',
    description: 'Watch free, pay to download.',
    watch: 'FREE',
    download: 'PAID'
  },
  {
    id: 'PREMIUM',
    label: 'PREMIUM',
    description: 'Pay to watch and to download.',
    watch: 'PAID',
    download: 'PAID'
  }
];

function AdminMovieEdit() {
  useDocumentMeta({
    title: 'Add / Edit Movie',
    canonical: window.location.origin + '/admin/movies'
  });

  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const isEdit = Boolean(id);

  const [form, setForm] = useState(EMPTY_FORM);
  const [categories, setCategories] = useState([]);
  const [existingMovie, setExistingMovie] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [posterFile, setPosterFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  useEffect(() => {
    apiFetch('/api/categories').then(cats => {
      setCategories(cats);
      if (cats.length > 0 && !form.genre) {
        setForm(f => ({ ...f, genre: f.genre || cats[0]?.name || '' }));
      }
    }).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (isEdit) {
      apiFetch(`/api/movies/${id}`)
        .then(movie => {
          setExistingMovie(movie);
          const accessType = movie.access_type || 'FREE';
          const downloadAccess = movie.download_access || 'FREE';
          setForm({
            title: movie.title,
            description: movie.description,
            year: movie.year || '',
            language: movie.language,
            duration: movie.duration || '',
            rating: movie.rating || '',
            genre: movie.genre,
            categories: movie.categories?.map(c => c.id) || [],
            featured: Boolean(movie.featured),
            published: Boolean(movie.published),
            allowDownload: Boolean(movie.allowDownload),
            accessType,
            downloadAccess,
            priceRwf: movie.price_rwf || ''
          });
        })
        .catch(err => showToast(err.message, 'error'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleCategoryToggle = (categoryId) => {
    setForm(f => {
      const has = f.categories.includes(categoryId);
      return {
        ...f,
        categories: has ? f.categories.filter(c => c !== categoryId) : [...f.categories, categoryId]
      };
    });
  };

  const applyPreset = (presetId) => {
    const preset = ACCESS_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setForm(f => ({
      ...f,
      accessType: preset.id,
      downloadAccess: preset.download,
      priceRwf: preset.id === 'FREE' ? '' : (f.priceRwf === '' ? '1000' : f.priceRwf)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!form.title.trim()) {
      showToast('Title is required', 'error');
      setSubmitting(false);
      return;
    }
    if (!videoFile && !existingMovie?.video) {
      showToast('A video file is required', 'error');
      setSubmitting(false);
      return;
    }

    const isPaid = form.accessType !== 'FREE' || form.downloadAccess === 'PAID';
    const priceRwf = parseInt(form.priceRwf, 10);
    if (isPaid && (!priceRwf || priceRwf <= 0)) {
      showToast('Price (RWF) must be greater than 0 when anything is paid.', 'error');
      setSubmitting(false);
      return;
    }

    if (videoFile && videoFile.size > MAX_VIDEO_SIZE_BYTES) {
      showToast(`Video file is too large. Maximum allowed size is ${formatBytes(MAX_VIDEO_SIZE_BYTES)}.`, 'error');
      setSubmitting(false);
      return;
    }
    if (posterFile && posterFile.size > MAX_POSTER_SIZE_BYTES) {
      showToast(`Poster file is too large. Maximum allowed size is ${formatBytes(MAX_POSTER_SIZE_BYTES)}.`, 'error');
      setSubmitting(false);
      return;
    }

    const formData = new FormData();
    formData.append('title', form.title.trim());
    formData.append('description', form.description);
    formData.append('year', form.year);
    formData.append('language', form.language);
    formData.append('duration', form.duration);
    formData.append('rating', form.rating);
    formData.append('genre', form.genre);
    formData.append('categories', JSON.stringify(form.categories));
    formData.append('featured', String(form.featured));
    formData.append('published', String(form.published));
    formData.append('allowDownload', String(form.allowDownload));
    formData.append('accessType', form.accessType);
    formData.append('downloadAccess', form.downloadAccess);
    formData.append('priceRwf', isPaid ? (parseInt(form.priceRwf, 10) || 0) : '0');
    if (posterFile) formData.append('poster', posterFile);
    if (videoFile) formData.append('video', videoFile);

    try {
      const url = isEdit ? `/api/admin/movies/${id}` : '/api/admin/movies';
      const method = isEdit ? 'PUT' : 'POST';

      setShowUploadProgress(true);
      setUploadProgress(0);

      try {
        const result = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open(method, `${API_URL}${url}`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = (ev) => {
            if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
            else {
              let error = new Error('Upload failed');
              try {
                const parsed = JSON.parse(xhr.responseText);
                error = new Error(parsed?.message || parsed?.error || 'Upload failed');
              } catch { /* keep default error */ }
              error.status = xhr.status;
              reject(error);
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(formData);
        });

        setUploadProgress(100);
        showToast(isEdit ? 'Movie updated successfully' : 'Movie uploaded successfully', 'success');
        navigate('/admin/movies');
      } catch (err) {
        setShowUploadProgress(false);
        showToast(err.message, 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <AdminLayout title={isEdit ? 'Edit Movie' : 'Upload Movie'}>
      <form onSubmit={handleSubmit} className="movie-form">
        <div className="form-section">
          <h2>Movie Details</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Title *</label>
              <input name="title" value={form.title} onChange={handleChange} required placeholder="Movie title" />
            </div>

            <div className="form-group">
              <label>Genre</label>
              <select name="genre" value={form.genre} onChange={handleChange}>
                <option value="">Select genre</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Year</label>
              <input name="year" type="number" min="1900" max="2100" value={form.year} onChange={handleChange} placeholder="2024" />
            </div>

            <div className="form-group">
              <label>Language</label>
              <select name="language" value={form.language} onChange={handleChange}>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Duration (minutes)</label>
              <input name="duration" type="number" min="0" value={form.duration} onChange={handleChange} placeholder="120" />
            </div>

            <div className="form-group">
              <label>Rating (0-10)</label>
              <input name="rating" type="number" min="0" max="10" step="0.1" value={form.rating} onChange={handleChange} placeholder="8.5" />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea name="description" rows="5" value={form.description} onChange={handleChange} placeholder="Movie description..." />
          </div>
        </div>

        <div className="form-section">
          <h2>Categories</h2>
          <div className="category-checkboxes">
            {categories.map(cat => (
              <label key={cat.id} className={`cat-checkbox ${form.categories.includes(cat.id) ? 'checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={form.categories.includes(cat.id)}
                  onChange={() => handleCategoryToggle(cat.id)}
                />
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section">
          <h2>Access &amp; Monetization</h2>

          <div className="access-presets">
            {ACCESS_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                className={`access-preset ${form.accessType === preset.id ? 'active' : ''}`}
                onClick={() => applyPreset(preset.id)}
              >
                <strong>{preset.label}</strong>
                <span>{preset.description}</span>
                <small>Watch: {preset.watch} • Download: {preset.download}</small>
              </button>
            ))}
          </div>

          <div className="access-summary">
            <div className="access-summary-row">
              <div className="form-group">
                <label>Access Type</label>
                <div className="access-readonly-value">{form.accessType}</div>
              </div>
              <div className="form-group">
                <label>Download Access</label>
                <div className="access-readonly-value">{form.downloadAccess}</div>
              </div>
              <div className="form-group">
                <label>Price (RWF)</label>
                <input
                  name="priceRwf"
                  type="number"
                  min="0"
                  step="1"
                  value={form.priceRwf}
                  onChange={handleChange}
                  placeholder="1000"
                  disabled={form.accessType === 'FREE'}
                />
              </div>
            </div>
            <p className="hint">
              {form.accessType === 'FREE'
                ? 'Everything is free: price must be 0 RWF.'
                : `Price must be greater than 0 RWF. Customers pay with MoMo.`}
            </p>
          </div>
        </div>

        <div className="form-section">
          <h2>Movie Files</h2>

          <div className="form-grid">
            <div className="form-group">
              <label>Poster Image</label>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const ext = getFileExtension(file.name);
                    if (!ACCEPTED_POSTER_EXTENSIONS.includes(ext)) {
                      showToast('Poster must be a .jpg, .jpeg, .png, or .webp image.', 'error');
                      e.target.value = '';
                      return;
                    }
                    if (file.size > MAX_POSTER_SIZE_BYTES) {
                      showToast(`Poster file is too large. Maximum allowed size is ${formatBytes(MAX_POSTER_SIZE_BYTES)}.`, 'error');
                      e.target.value = '';
                      return;
                    }
                  }
                  setPosterFile(file);
                }}
              />
              <p className="hint">Allowed: JPG, JPEG, PNG, WEBP. Max {formatBytes(MAX_POSTER_SIZE_BYTES)}.</p>
              {existingMovie?.poster && (
                <div className="file-preview">
                  <img src={`${API_URL}/api/posters/${existingMovie.poster}`} alt="Current poster" width="80" />
                  <span>Current poster {posterFile ? 'will be replaced' : ''}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Video File *</label>
              <input
                type="file"
                accept=".mp4,.webm,.mkv,.mov,video/mp4,video/webm,video/x-matroska,video/quicktime"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const ext = getFileExtension(file.name);
                    if (!ACCEPTED_VIDEO_EXTENSIONS.includes(ext)) {
                      showToast('Video must be a .mp4, .webm, .mkv, or .mov file.', 'error');
                      e.target.value = '';
                      return;
                    }
                    if (file.size > MAX_VIDEO_SIZE_BYTES) {
                      showToast(`Video file is too large. Maximum allowed size is ${formatBytes(MAX_VIDEO_SIZE_BYTES)}.`, 'error');
                      e.target.value = '';
                      return;
                    }
                  }
                  setVideoFile(file);
                }}
              />
              <p className="hint">Allowed: MP4, WEBM, MKV, MOV. Max {formatBytes(MAX_VIDEO_SIZE_BYTES)}.</p>
              {existingMovie?.video && (
                <p className="hint">
                  {videoFile ? 'New video will replace the current file.' : `Current video: ${existingMovie.video}`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="form-section">
          <h2>Visibility & Publishing</h2>

          <div className="form-checkboxes">
            <label className="toggle-label">
              <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} />
              <span>Featured movie</span>
            </label>
            <label className="toggle-label">
              <input type="checkbox" name="published" checked={form.published} onChange={handleChange} />
              <span>Published (visible to visitors)</span>
            </label>
            <label className="toggle-label">
              <input type="checkbox" name="allowDownload" checked={form.allowDownload} onChange={handleChange} />
              <span>Allow download</span>
            </label>
          </div>
        </div>

        {showUploadProgress && (
          <div className="upload-progress">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, uploadProgress))}%` }}></div>
            </div>
            <p>Uploading... {Math.round(Math.max(0, Math.min(100, uploadProgress)))}%</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Uploading...' : isEdit ? 'Save Changes' : 'Upload Movie'}
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/movies')}>
            Cancel
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}

export default AdminMovieEdit;