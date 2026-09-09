import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function Movies() {
  useDocumentMeta({
    title: 'Browse Movies',
    description: 'Browse all movies on EdFilms. Filter by genre, year, language and category.',
    canonical: window.location.origin + '/movies'
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [movies, setMovies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);

  const filters = {
    page: searchParams.get('page') || '1',
    search: searchParams.get('search') || '',
    genre: searchParams.get('genre') || '',
    year: searchParams.get('year') || '',
    language: searchParams.get('language') || '',
    category: searchParams.get('category') || ''
  };

  const loadMovies = useCallback(async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ page: filters.page, limit: '20' });
      if (filters.search) query.set('search', filters.search);
      if (filters.genre) query.set('genre', filters.genre);
      if (filters.year) query.set('year', filters.year);
      if (filters.language) query.set('language', filters.language);
      if (filters.category) query.set('category', filters.category);

      const data = await apiFetch(`/api/movies?${query.toString()}`);
      setMovies(data.movies || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
    } catch (error) {
      console.error('Failed to load movies:', error);
    } finally {
      setLoading(false);
    }
  }, [filters.page, filters.search, filters.genre, filters.year, filters.language, filters.category]);

  useEffect(() => {
    loadMovies();
  }, [loadMovies]);

  useEffect(() => {
    apiFetch('/api/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  const setFilter = (key, value) => {
    const params = new URLSearchParams(searchParams);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  const years = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 1980; y--) years.push(y);

  const languages = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Arabic', 'Japanese', 'Korean', 'Chinese', 'Portuguese', 'Russian'];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Movies</h1>
        <p>Browse the complete EdFilms catalog</p>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search..."
            defaultValue={filters.search}
            onKeyDown={(e) => { if (e.key === 'Enter') setFilter('search', e.target.value); }}
          />
          <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
          <select value={filters.genre} onChange={(e) => setFilter('genre', e.target.value)}>
            <option value="">All Genres</option>
            <option value="Action">Action</option>
            <option value="Comedy">Comedy</option>
            <option value="Drama">Drama</option>
            <option value="Romance">Romance</option>
            <option value="Animation">Animation</option>
            <option value="Documentary">Documentary</option>
            <option value="Adventure">Adventure</option>
            <option value="Horror">Horror</option>
            <option value="Sci-Fi">Sci-Fi</option>
            <option value="Thriller">Thriller</option>
          </select>
          <select value={filters.year} onChange={(e) => setFilter('year', e.target.value)}>
            <option value="">All Years</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={filters.language} onChange={(e) => setFilter('language', e.target.value)}>
            <option value="">All Languages</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <Loader />
      ) : movies.length === 0 ? (
        <EmptyState
          title="No movies found"
          message="Try adjusting your filters or search query."
        />
      ) : (
        <>
          <div className="movie-grid">
            {movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setFilter('page', String(pagination.page - 1))}
                className="btn btn-outline"
              >
                Prev
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setFilter('page', String(pagination.page + 1))}
                className="btn btn-outline"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Movies;