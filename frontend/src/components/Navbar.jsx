import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { admin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          <span className="brand-icon">ED</span>
          <span className="brand-text">EdFilms</span>
        </Link>

        <div className="navbar-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
          <Link to="/movies" className={location.pathname.startsWith('/movies') || location.pathname.startsWith('/movie') ? 'active' : ''}>Movies</Link>
          <Link to="/categories" className={location.pathname.startsWith('/categories') || location.pathname.startsWith('/category') ? 'active' : ''}>Categories</Link>
          <Link to="/contact" className={location.pathname === '/contact' ? 'active' : ''}>Contact</Link>
        </div>

        <div className="navbar-actions">
          {searchOpen ? (
            <form onSubmit={handleSearch} className="search-form">
              <input
                type="text"
                placeholder="Search movies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <button type="submit" aria-label="Search">Go</button>
            </form>
          ) : (
            <button className="nav-icon-button" onClick={() => setSearchOpen(true)} aria-label="Search">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
          )}

          {admin ? (
            <Link to="/admin" className="btn btn-admin">Dashboard</Link>
          ) : null}

          <button className="nav-icon-button menu-toggle" onClick={() => setOpen(!open)} aria-label="Menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {open
                ? <path d="M6 6l12 12M18 6L6 18" />
                : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="mobile-menu">
          <Link to="/">Home</Link>
          <Link to="/movies">Movies</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/search">Search</Link>
          <Link to="/contact">Contact</Link>
          {admin && <Link to="/admin">Admin Dashboard</Link>}
        </div>
      )}
    </nav>
  );
}

export default Navbar;