import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch, API_URL } from '../utils/api';
import { getMediaAccessUrl } from '../utils/mediaAccess';
import { useDocumentMeta } from '../utils/helpers';
import Loader from '../components/Loader';
import PaymentModal from '../components/PaymentModal';

function Watch() {
  const { slug } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [streamUrl, setStreamUrl] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [paymentRequired, setPaymentRequired] = useState(false);
  const [paymentUnlockDownload, setPaymentUnlockDownload] = useState(false);
  const [paidFor, setPaidFor] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const videoRef = useRef(null);
  const viewRecorded = useRef(false);

  useDocumentMeta({
    title: movie ? `Now Watching: ${movie.title}` : 'Watch',
    description: movie?.description?.slice(0, 160) || 'Watch this movie on EdFilms',
    canonical: window.location.origin + `/watch/${slug}`
  });

  useEffect(() => {
    const apiUrl = `/api/movies/slug/${encodeURIComponent(slug)}`;
    if (import.meta.env.DEV) {
      console.log('[Watch] requested slug:', slug);
      console.log('[Watch] API URL:', `${API_URL}${apiUrl}`);
    }
    setLoading(true);
    setError(null);
    apiFetch(apiUrl)
      .then(movie => {
        if (import.meta.env.DEV) {
          console.log('[Watch] returned movie:', { id: movie.id, title: movie.title, slug: movie.slug });
        }
        setMovie(movie);
      })
      .catch(err => {
        if (import.meta.env.DEV) console.log('[Watch] fetch error:', err.status || '', err.message);
        setError(err);
      })
      .finally(() => setLoading(false));
  }, [slug, reloadKey]);

  useEffect(() => {
    if (movie) {
      const resolveAccess = async () => {
        try {
          const url = await getMediaAccessUrl(movie, 'watch');
          setStreamUrl(url);
          setPaymentRequired(false);
        } catch (err) {
          if (err.status === 402 || err.code === 'PAYMENT_REQUIRED') {
            setPaymentRequired(true);
            setPaymentUnlockDownload(false);
          } else {
            setError(err.message);
          }
        }

        try {
          const url = await getMediaAccessUrl(movie, 'download');
          setDownloadUrl(url);
        } catch {
          setDownloadUrl(null);
        }
      };
      resolveAccess();
    }
  }, [movie, paidFor]);

  useEffect(() => {
    if (movie && !viewRecorded.current) {
      viewRecorded.current = true;
      apiFetch(`/api/movies/${movie.id}/view`, { method: 'POST' })
        .catch(() => {});
    }
  }, [movie]);

  const handlePaidSuccess = () => {
    setPaidFor(true);
    setShowPayment(false);
  };

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

  if (!movie.video) {
    return (
      <div className="page-container">
        <div className="empty-state">
          <h3>Video unavailable</h3>
          <p>A video file has not been uploaded for this movie yet.</p>
          <Link to={`/movie/${movie.slug}`} className="btn btn-primary">Back to Details</Link>
        </div>
      </div>
    );
  }

  if (paymentRequired && !streamUrl) {
    const price = movie.price_rwf || 0;
    return (
      <div className="page-container">
        <div className="empty-state">
          <div className="empty-icon">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h3>This movie requires payment</h3>
          <p>Pay {Number(price || 0).toLocaleString()} RWF with MoMo to unlock this movie on EdFilms.</p>
          <div className="movie-details-actions" style={{ justifyContent: 'center' }}>
            <button className="btn btn-gold btn-lg" onClick={() => setShowPayment(true)}>
              PAY {Number(price || 0).toLocaleString()} RWF TO WATCH
            </button>
            <Link to={`/movie/${movie.slug}`} className="btn btn-outline btn-lg">Movie Details</Link>
          </div>
        </div>
        {showPayment && (
          <PaymentModal movie={movie} action="watch" onClose={() => setShowPayment(false)} onSuccess={handlePaidSuccess} />
        )}
      </div>
    );
  }

  return (
    <div className="watch-page container">
      <div className="video-player-wrap">
        <video
          ref={videoRef}
          controls
          controlsList="nodownload"
          autoPlay
          playsInline
          className="video-player"
          src={streamUrl}
        >
          Your browser does not support HTML5 video.
        </video>
      </div>

      <div className="watch-info">
        <h1>{movie.title}</h1>
        <div className="movie-details-meta">
          {movie.year && <span>{movie.year}</span>}
          {movie.genre && <span>{movie.genre}</span>}
          {movie.language && <span>{movie.language}</span>}
          {movie.rating > 0 && <span>★ {movie.rating.toFixed(1)}</span>}
          <span>{movie.views.toLocaleString()} views</span>
        </div>
        {movie.description && <p className="movie-details-description">{movie.description}</p>}
        <div className="watch-actions">
          <Link to={`/movie/${movie.slug}`} className="btn btn-outline">Movie Details</Link>
          {downloadUrl ? (
            <a href={downloadUrl} className="btn btn-outline">Download</a>
          ) : (
            <button className="btn btn-gold" onClick={() => setShowPayment(true)}>
              PAY {Number(movie.price_rwf || 0).toLocaleString()} RWF TO DOWNLOAD
            </button>
          )}
        </div>
      </div>

      {showPayment && (
        <PaymentModal
          movie={movie}
          action={downloadUrl ? 'watch' : 'download'}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaidSuccess}
        />
      )}
    </div>
  );
}

export default Watch;