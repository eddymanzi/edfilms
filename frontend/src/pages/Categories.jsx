import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import Loader from '../components/Loader';
import EmptyState from '../components/EmptyState';

const CATEGORY_ICONS = ['🎬', '🎭', '😂', '💔', '🌟', '📺', '😱', '🚀', '🔍', '🎭'];

function Categories() {
  useDocumentMeta({
    title: 'Browse Categories',
    description: 'Explore movies by category on EdFilms - Action, Comedy, Drama, Romance and more.',
    canonical: window.location.origin + '/categories'
  });

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [movieCounts, setMovieCounts] = useState({});

  useEffect(() => {
    apiFetch('/api/categories')
      .then(async (cats) => {
        setCategories(cats);
        const counts = {};
        await Promise.all(cats.map(async (cat) => {
          try {
            const data = await apiFetch(`/api/categories/${cat.slug}?limit=1`);
            counts[cat.id] = data.pagination?.total || 0;
          } catch { counts[cat.id] = 0; }
        }));
        setMovieCounts(counts);
      })
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Categories</h1>
        <p>Explore movies by category</p>
      </div>

      {categories.length === 0 ? (
        <EmptyState title="No categories available" />
      ) : (
        <div className="categories-grid">
          {categories.map((cat, idx) => (
            <Link key={cat.id} to={`/category/${cat.slug}`} className="category-card" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div className="category-card-icon">{CATEGORY_ICONS[idx % CATEGORY_ICONS.length]}</div>
              <h3>{cat.name}</h3>
              <p>{movieCounts[cat.id] || 0} movies</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Categories;