import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function Search() {
  useDocumentMeta({
    title: 'Search Movies',
    description: 'Search the EdFilms movie catalog by title, genre, year and language.',
    canonical: window.location.origin + '/search'
  });

  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [input, setInput] = useState(searchParams.get('q') || '');
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/movies?search=${encodeURIComponent(q)}&limit=30`);
      setMovies(data.movies || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) runSearch(query);
  }, [query, runSearch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setQuery(input);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Search Movies</h1>
        <p>Find your next favorite film</p>
      </div>

      <form onSubmit={handleSubmit} className="search-hero-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Search by title, genre, year, language..."
          className="search-hero-input"
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {loading ? <Loader /> : (
        query ? (
          movies.length === 0 ? (
            <EmptyState title="No results" message={`No movies matched "${query}". Try a different search.`} />
          ) : (
            <>
              <p className="results-count">{movies.length} result{movies.length !== 1 ? 's' : ''} for "{query}"</p>
              <div className="movie-grid">
                {movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}
              </div>
            </>
          )
        ) : (
          <EmptyState title="Start searching" message="Type a movie title, genre, year, or language above." />
        )
      )}
    </div>
  );
}

export default Search;