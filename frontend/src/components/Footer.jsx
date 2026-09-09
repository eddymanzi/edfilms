import React from 'react';
import { Link } from 'react-router-dom';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <span className="brand-icon">ED</span>
          <span className="brand-text">EdFilms</span>
          <p className="footer-tagline">
            Your cinematic destination. Stream and download movies legally.
          </p>
          <p className="footer-note">
            This website is intended only for content that the site owner has legal permission to distribute.
          </p>
        </div>

        <div className="footer-links">
          <h4>Explore</h4>
          <Link to="/">Home</Link>
          <Link to="/movies">Movies</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/search">Search</Link>
        </div>

        <div className="footer-links">
          <h4>Support</h4>
          <Link to="/contact">Contact</Link>
        </div>

        <div className="footer-social">
          <h4>Follow</h4>
          <div className="social-links">
            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><span>Facebook</span></a>
            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"><span>Twitter</span></a>
            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><span>Instagram</span></a>
            <a href="https://whatsapp.com" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span></a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} EdFilms. All rights reserved.</p>
      </div>
    </footer>
  );
}

export default Footer;