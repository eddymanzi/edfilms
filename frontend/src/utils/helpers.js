import { useEffect } from 'react';

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content || '');
}

export function useDocumentMeta({ title, description, canonical, image, type = 'website' } = {}) {
  useEffect(() => {
    const baseTitle = 'EdFilms';
    document.title = title ? `${title} | ${baseTitle}` : baseTitle;

    if (description) {
      upsertMeta('name', 'description', description);
      upsertMeta('property', 'og:description', description);
    }
    if (title) {
      upsertMeta('property', 'og:title', title);
      upsertMeta('name', 'twitter:title', title);
    }
    if (canonical) {
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonical);
    }
    if (image) {
      upsertMeta('property', 'og:image', image);
      upsertMeta('name', 'twitter:image', image);
    }

    upsertMeta('property', 'og:type', type);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('property', 'og:site_name', 'EdFilms');
  }, [title, description, canonical, image, type]);
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function formatDuration(minutes) {
  if (!minutes) return 'Unknown';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}