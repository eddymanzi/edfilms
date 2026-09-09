import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';
import { API_URL } from '../utils/api';

function Home() {
  useDocumentMeta({
    title: 'Watch Movies Online',
    description: 'EdFilms - Stream and download movies. Browse the latest films by genre, category, year and language online for free.',
    canonical: window.location.origin
  });

  const [featured, setFeatured] = useState([]);
  const [latest, setLatest] = useState([]);
  const [popular, setPopular] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [featuredRes, latestRes, popularRes, categoriesRes] = await Promise.all([
          apiFetch('/api/movies/featured').catch(() => []),
          apiFetch('/api/movies/latest?limit=10').catch(() => ({ movies: [] })),
          apiFetch('/api/movies/popular?limit=10').catch(() => []),
          apiFetch('/api/categories').catch(() => [])
        ]);
        setFeatured(featuredRes);
        setLatest(latestRes.movies || latestRes);
        setPopular(popularRes);
        setCategories(categoriesRes);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <Loader />;

  const heroMovie = featured[0] || latest[0];

  return (
    <div className="home-page">
      {heroMovie && (
        <section className="hero" style={{
          backgroundImage: heroMovie.poster
            ? `linear-gradient(to right, rgba(10,10,25,0.95) 0%, rgba(10,10,25,0.7) 50%, rgba(10,10,25,0.4) 100%), url(${API_URL}/api/posters/${heroMovie.poster})`
            : 'none'
        }}>
          <div className="hero-content">
            <span className="hero-kicker">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: '-2px' }}>
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Featured Film
            </span>
            <h1>{heroMovie.title}</h1>
            <div className="hero-meta">
              {heroMovie.year && <span>{heroMovie.year}</span>}
              {heroMovie.genre && <span>{heroMovie.genre}</span>}
              {heroMovie.language && <span>{heroMovie.language}</span>}
              {heroMovie.rating > 0 && <span>★ {heroMovie.rating.toFixed(1)}</span>}
              <span>{heroMovie.views?.toLocaleString() || 0} views</span>
            </div>
            <p className="hero-description">{heroMovie.description?.slice(0, 220)}{heroMovie.description?.length > 220 ? '...' : ''}</p>
            <div className="hero-actions">
              <Link to={`/watch/${heroMovie.slug}`} className="btn btn-primary btn-lg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                Watch Now
              </Link>
              <Link to={`/movie/${heroMovie.slug}`} className="btn btn-outline btn-lg">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                Details
              </Link>
            </div>
          </div>
        </section>
      )}

      <div className="container">
        {featured.length > 0 && (
          <section className="home-section">
            <div className="section-header">
              <h2>Featured Movies</h2>
              <Link to="/movies" className="section-link">View all</Link>
            </div>
            <div className="movie-grid">
              {featured.map(movie => <MovieCard key={movie.id} movie={movie} />)}
            </div>
          </section>
        )}

        {latest.length > 0 && (
          <section className="home-section">
            <div className="section-header">
              <h2>Latest Movies</h2>
              <Link to="/movies" className="section-link">View all</Link>
            </div>
            <div className="movie-grid">
              {latest.map(movie => <MovieCard key={movie.id} movie={movie} />)}
            </div>
          </section>
        )}

        {categories.length > 0 && (
          <section className="home-section">
            <div className="section-header">
              <h2>Browse Categories</h2>
              <Link to="/categories" className="section-link">View all</Link>
            </div>
            <div className="category-chip-grid">
              {categories.map(cat => (
                <Link key={cat.id} to={`/category/${cat.slug}`} className="category-chip">
                  {cat.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {popular.length > 0 && (
          <section className="home-section">
            <div className="section-header">
              <h2>Popular Now</h2>
              <Link to="/movies" className="section-link">View all</Link>
            </div>
            <div className="movie-grid">
              {popular.map(movie => <MovieCard key={movie.id} movie={movie} />)}
            </div>
          </section>
        )}

        {!loading && featured.length === 0 && latest.length === 0 && (
          <EmptyState title="No movies available" message="Check back soon for new releases!" />
        )}
      </div>
    </div>
  );
}

export default Home;