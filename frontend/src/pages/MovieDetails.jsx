import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, API_URL } from '../utils/api';
import { getMediaAccessUrl } from '../utils/mediaAccess';
import { useDocumentMeta, formatDuration } from '../utils/helpers';
import Loader from '../components/Loader';
import MovieCard from '../components/MovieCard';
import PaymentModal from '../components/PaymentModal';
import { getCustomerReference } from '../utils/customerReference';

function formatPrice(price) {
  return Number(price || 0).toLocaleString();
}

function MovieDetails() {
  const { slug } = useParams();
  const [movie, setMovie] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [paymentModal, setPaymentModal] = useState(null);
  const [unlocked, setUnlocked] = useState({ watch: false, download: false });
  const [downloadUrl, setDownloadUrl] = useState(null);

  const customerReference = getCustomerReference();

  useDocumentMeta({
    title: movie ? movie.title : 'Movie',
    description: movie?.description?.slice(0, 160) || 'Watch this movie on EdFilms',
    canonical: window.location.origin + `/movie/${slug}`,
    image: movie?.poster ? `${API_URL}/api/posters/${movie.poster}` : undefined,
    type: 'video.movie'
  });

  useEffect(() => {
    const apiUrl = `/api/movies/slug/${encodeURIComponent(slug)}`;
    if (import.meta.env.DEV) {
      console.log('[MovieDetails] requested slug:', slug);
      console.log('[MovieDetails] API URL:', `${API_URL}${apiUrl}`);
    }
    setLoading(true);
    setError(null);
    apiFetch(apiUrl)
      .then(movie => {
        if (import.meta.env.DEV) {
          console.log('[MovieDetails] returned movie:', { id: movie.id, title: movie.title, slug: movie.slug });
        }
        setMovie(movie);
      })
      .catch(err => {
        if (import.meta.env.DEV) console.log('[MovieDetails] fetch error:', err.status || '', err.message);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [slug, reloadKey]);

  useEffect(() => {
    if (movie && movie.genre) {
      apiFetch(`/api/movies?genre=${encodeURIComponent(movie.genre)}&limit=10`)
        .then(data => setRelated((data.movies || []).filter(m => m.id !== movie.id)))
        .catch(() => setRelated([]));
    }
  }, [movie]);

  useEffect(() => {
    if (movie && movie.access_type && movie.access_type !== 'FREE') {
      const checkAccess = async () => {
        const [w, d] = await Promise.all([
          apiFetch(`/api/movies/${movie.id}/access-token`, { method: 'POST', body: { customerReference, purpose: 'watch' } })
            .then(() => true)
            .catch(() => false),
          apiFetch(`/api/movies/${movie.id}/access-token`, { method: 'POST', body: { customerReference, purpose: 'download' } })
            .then(() => true)
            .catch(() => false)
        ]);
        setUnlocked({ watch: w, download: d });
        if (d) {
          getMediaAccessUrl(movie, 'download').then(setDownloadUrl).catch(() => {});
        } else {
          setDownloadUrl(null);
        }
      };
      checkAccess();
    }
  }, [movie]);

  if (loading) return <Loader />;

  if (error || !movie) {
    const isNotFound = !movie || error.status === 404;
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>{isNotFound ? 'Movie not found' : 'Something went wrong'}</h3>
          <p>
            {isNotFound
              ? (error && error.message) || 'This movie does not exist or is unavailable.'
              : `${error.message || 'Failed to load this movie.'} Please try again later.`}
          </p>
          <div className="movie-details-actions" style={{ justifyContent: 'center' }}>
            {!isNotFound && (
              <button className="btn btn-outline" onClick={() => setReloadKey(k => k + 1)}>Retry</button>
            )}
            <Link to="/movies" className="btn btn-primary">Browse Movies</Link>
          </div>
        </div>
      </div>
    );
  }

  const posterUrl = movie.poster ? `${API_URL}/api/posters/${movie.poster}` : null;
  const accessType = movie.access_type || 'FREE';
  const downloadAccess = movie.download_access || 'FREE';
  const price = movie.price_rwf || 0;
  const isPremium = accessType === 'PREMIUM';
  const watchFree = accessType !== 'PREMIUM';
  const downloadPaid = downloadAccess === 'PAID';
  const fullyFree = watchFree && !downloadPaid;
  const watchUnlocked = watchFree || unlocked.watch;
  const downloadUnlocked = !downloadPaid || unlocked.download;

  const accessLabel = fullyFree
    ? 'FREE'
    : isPremium
      ? `PAID • ${formatPrice(price)} RWF`
      : `WATCH FREE • DOWNLOAD ${formatPrice(price)} RWF`;

  const renderActions = () => {
    if (fullyFree) {
      return (
        <>
          <Link to={`/watch/${movie.slug}`} className="btn btn-primary btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Watch Now
          </Link>
          {movie.allowDownload && (
            <a href={downloadUrl || `${API_URL}/api/movies/${movie.id}/download`} className="btn btn-outline btn-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Download
            </a>
          )}
        </>
      );
    }

    if (watchFree) {
      return (
        <>
          <Link to={`/watch/${movie.slug}`} className="btn btn-primary btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Watch Now
          </Link>
          {downloadUnlocked ? (
            <a href={downloadUrl || `${API_URL}/api/movies/${movie.id}/download`} className="btn btn-outline btn-lg">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              Download
            </a>
          ) : (
            <button
              className="btn btn-gold btn-lg"
              onClick={() => setPaymentModal({ action: 'download' })}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
              PAY {formatPrice(price)} RWF TO DOWNLOAD
            </button>
          )}
        </>
      );
    }

    const bothUnlocked = watchUnlocked && downloadUnlocked;
    if (bothUnlocked) {
      return (
        <>
          <Link to={`/watch/${movie.slug}`} className="btn btn-primary btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            Watch Now
          </Link>
          <a href={downloadUrl || `${API_URL}/api/movies/${movie.id}/download`} className="btn btn-outline btn-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="M7 10l5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Download
          </a>
        </>
      );
    }
    return (
      <>
        <button
          className="btn btn-gold btn-lg"
          onClick={() => setPaymentModal({ action: 'watch' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
          PAY {formatPrice(price)} RWF TO WATCH
        </button>
        <button
          className="btn btn-outline btn-lg"
          onClick={() => setPaymentModal({ action: 'download' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5 5 5-5" />
            <path d="M12 15V3" />
          </svg>
          PAY {formatPrice(price)} RWF TO DOWNLOAD
        </button>
      </>
    );
  };

  return (
    <div className="movie-details-page">
      <div className="movie-details-hero">
        <div className="container movie-details-layout">
          <div className="movie-poster-large">
            {posterUrl
              ? <img src={posterUrl} alt={movie.title} />
              : <div className="poster-placeholder">No Poster</div>}
          </div>

          <div className="movie-details-info">
            <h1>{movie.title}</h1>

            <div className="movie-details-meta">
              {movie.year && <span>{movie.year}</span>}
              {movie.language && <span>{movie.language}</span>}
              {movie.duration > 0 && <span>{formatDuration(movie.duration)}</span>}
              {movie.rating > 0 && <span>★ {movie.rating.toFixed(1)}</span>}
              <span>{movie.views.toLocaleString()} views</span>
              {movie.downloads > 0 && <span>{movie.downloads.toLocaleString()} downloads</span>}
            </div>

            {!fullyFree && (
              <div className={`access-badge ${isPremium ? 'access-paid' : 'access-mixed'}`}>
                {accessLabel}
              </div>
            )}

            {movie.genre && <p className="movie-genre"><strong>Genre:</strong> {movie.genre}</p>}

            {movie.categories && movie.categories.length > 0 && (
              <div className="movie-categories-tags">
                {movie.categories.map(cat => (
                  <Link key={cat.id} to={`/category/${cat.slug}`} className="category-tag">{cat.name}</Link>
                ))}
              </div>
            )}

            <p className="movie-details-description">{movie.description}</p>

            <div className="movie-details-actions">
              {renderActions()}
            </div>
          </div>
        </div>
      </div>

      {related.length > 0 && (
        <div className="container home-section">
          <div className="section-header">
            <h2>Related Movies</h2>
          </div>
          <div className="movie-grid">
            {related.map(m => <MovieCard key={m.id} movie={m} />)}
          </div>
        </div>
      )}

      {paymentModal && (
        <PaymentModal
          movie={movie}
          action={paymentModal.action}
          onClose={() => setPaymentModal(null)}
          onSuccess={() => {
            if (isPremium) setUnlocked({ watch: true, download: true });
            else if (accessType === 'WATCH_FREE_DOWNLOAD_PAID') setUnlocked({ watch: true, download: true });
          }}
        />
      )}
    </div>
  );
}

export default MovieDetails;