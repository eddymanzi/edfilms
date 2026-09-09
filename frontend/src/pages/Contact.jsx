import React, { useState } from 'react';
import { apiFetch } from '../utils/api';
import { useDocumentMeta } from '../utils/helpers';
import { useToast } from '../context/ToastContext';

function Contact() {
  useDocumentMeta({
    title: 'Contact EdFilms',
    description: 'Get in touch with the EdFilms team. Send us a message and we will get back to you.',
    canonical: window.location.origin + '/contact'
  });

  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: form
      });
      showToast('Message sent successfully!', 'success');
      setForm({ name: '', email: '', message: '' });
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container contact-page">
      <div className="page-header">
        <h1>Contact Us</h1>
        <p>We would love to hear from you</p>
      </div>

      <div className="contact-layout">
        <div className="contact-info">
          <h2>Get in Touch</h2>
          <p>Have a question, request, or feedback? Send us a message and the EdFilms team will get back to you as soon as possible.</p>

          <div className="contact-social">
            <h3>Follow EdFilms</h3>
            <div className="social-links">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"><span>Facebook</span></a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"><span>Twitter</span></a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"><span>Instagram</span></a>
              <a href="https://whatsapp.com" target="_blank" rel="noopener noreferrer"><span>WhatsApp</span></a>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="contact-form">
          <div className="form-group">
            <label htmlFor="name">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength="100"
              value={form.name}
              onChange={handleChange}
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              required
              rows="6"
              maxLength="2000"
              value={form.message}
              onChange={handleChange}
              placeholder="Write your message..."
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Contact;