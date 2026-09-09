import React from 'react';
import { Link } from 'react-router-dom';
import { API_URL } from '../utils/api';

function MovieCard({ movie }) {
  const posterUrl = movie.poster
    ? `${API_URL}/api/posters/${movie.poster}`
    : null;

  const fallbackPoster = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="300" height="450">
      <rect width="300" height="450" fill="#171a33"/>
      <text x="150" y="225" fill="#6f7694" font-family="Arial" font-size="20" text-anchor="middle">No Poster</text>
    </svg>
  `);

  return (
    <Link to={`/movie/${movie.slug}`} className="movie-card">
      <div className="movie-poster">
        <img
          src={posterUrl || fallbackPoster}
          alt={movie.title}
          loading="lazy"
          onError={(e) => { e.currentTarget.src = fallbackPoster; }}
        />
        {movie.featured && <span className="badge-featured">Featured</span>}
        {(movie.access_type === 'PREMIUM' || (movie.access_type === 'WATCH_FREE_DOWNLOAD_PAID')) && (
          <span className="badge-price">
            {Number(movie.price_rwf || 0).toLocaleString()} RWF
          </span>
        )}
        {movie.rating > 0 && (
          <span className="badge-rating">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
            {movie.rating.toFixed(1)}
          </span>
        )}
      </div>
      <div className="movie-card-info">
        <h3 className="movie-card-title">{movie.title}</h3>
        <div className="movie-card-meta">
          <span>{movie.year || 'Unknown'}</span>
          <span className="dot">•</span>
          <span>{movie.language}</span>
        </div>
        {movie.genre && <span className="genre-tag">{movie.genre}</span>}
      </div>
    </Link>
  );
}

export default MovieCard;