import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import MovieCard from '../components/MovieCard';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

function CategoryPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [category, setCategory] = useState(null);
  const [movies, setMovies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const page = searchParams.get('page') || '1';

  useDocumentMeta({
    title: category ? `${category.name} Movies` : 'Category',
    description: `Browse ${category?.name || ''} movies on EdFilms`,
    canonical: window.location.origin + `/category/${slug}`
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/categories/${slug}?page=${page}&limit=20`);
      setCategory(data.category);
      setMovies(data.movies || []);
      setPagination(data.pagination || { page: 1, total: 0, pages: 1 });
      setNotFound(false);
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug, page]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader />;

  if (notFound || !category) {
    return <EmptyState title="Category not found" message="This category does not exist." />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>{category.name}</h1>
        <p>{category.description || `${pagination.total} movies in this category`}</p>
      </div>

      {movies.length === 0 ? (
        <EmptyState title="No movies in this category" message="Check back soon!" />
      ) : (
        <>
          <div className="movie-grid">
            {movies.map(movie => <MovieCard key={movie.id} movie={movie} />)}
          </div>
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setSearchParams(new URLSearchParams({ page: String(pagination.page - 1) }))}
                className="btn btn-outline"
              >Prev</button>
              <span>Page {pagination.page} of {pagination.pages}</span>
              <button
                disabled={pagination.page >= pagination.pages}
                onClick={() => setSearchParams(new URLSearchParams({ page: String(pagination.page + 1) }))}
                className="btn btn-outline"
              >Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CategoryPage;