require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { validateEnv } = require('./config/env');
const { initializeDatabase, getDb, DATABASE_URL } = require('./config/database');
const { ensureStorageDirs } = require('./config/storage');
const { bootstrapAdmin } = require('./utils/bootstrapAdmin');
const { errorHandler } = require('./middleware/errorHandler');

const adminRouter = require('./routes/admin');
const adminMoviesRouter = require('./routes/adminMovies');
const adminCategoriesRouter = require('./routes/adminCategories');
const adminMessagesRouter = require('./routes/adminMessages');
const adminSettingsRouter = require('./routes/adminSettings');
const adminStatsRouter = require('./routes/adminStats');
const adminPaymentsRouter = require('./routes/adminPayments');
const publicPostersRouter = require('./routes/posters');
const publicMoviesRouter = require('./routes/movies');
const publicCategoriesRouter = require('./routes/categories');
const publicContactRouter = require('./routes/contact');
const publicPaymentsRouter = require('./routes/payments');

validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function buildCorsOrigins() {
  const raw = process.env.CORS_ORIGINS || FRONTEND_URL;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function startServer() {
  await initializeDatabase();
  ensureStorageDirs();
  await bootstrapAdmin();

  const db = getDb();
  const allowedOrigins = new Set(buildCorsOrigins());

  app.set('trust proxy', 1);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  app.get('/health', async (req, res) => {
    try {
      const result = await db.query('SELECT 1 as ok');
      const ok = result.rows[0]?.ok;
      if (Number(ok) !== 1) {
        return res.status(503).json({ status: 'error', service: 'EdFilms Backend', database: 'unavailable' });
      }
      res.json({ status: 'ok', service: 'EdFilms Backend', database: 'connected' });
    } catch (error) {
      res.status(503).json({ status: 'error', service: 'EdFilms Backend', database: 'unavailable' });
    }
  });

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send('User-agent: *\nAllow: /\n');
  });

  app.get('/sitemap.xml', async (req, res) => {
    try {
      const moviesResult = await db.query('SELECT slug FROM movies WHERE published = 1');
      const movies = moviesResult.rows;
      const baseUrl = (process.env.SITE_URL || FRONTEND_URL).replace(/\/$/, '');
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      xml += `  <url><loc>${baseUrl}/</loc></url>\n`;
      xml += `  <url><loc>${baseUrl}/movies</loc></url>\n`;
      xml += `  <url><loc>${baseUrl}/categories</loc></url>\n`;
      xml += `  <url><loc>${baseUrl}/search</loc></url>\n`;
      xml += `  <url><loc>${baseUrl}/contact</loc></url>\n`;
      for (const movie of movies) {
        xml += `  <url><loc>${baseUrl}/movie/${movie.slug}</loc></url>\n`;
      }
      xml += '</urlset>';
      res.type('application/xml').send(xml);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api/admin', adminRouter);
  app.use('/api/admin/movies', adminMoviesRouter);
  app.use('/api/admin/categories', adminCategoriesRouter);
  app.use('/api/admin/messages', adminMessagesRouter);
  app.use('/api/admin/settings', adminSettingsRouter);
  app.use('/api/admin/stats', adminStatsRouter);
  app.use('/api/admin/payments', adminPaymentsRouter);

  app.use('/api/movies', publicMoviesRouter);
  app.use('/api/categories', publicCategoriesRouter);
  app.use('/api/posters', publicPostersRouter);
  app.use('/api/contact', publicContactRouter);
  app.use('/api/payments', publicPaymentsRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  app.use(errorHandler);

  const server = app.listen(PORT, () => {
    console.log(`EdFilms backend running on http://localhost:${PORT}`);
  });

  function shutdown(signal) {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      try {
        await db.end();
      } finally {
        process.exit(0);
      }
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

module.exports = { app, startServer };

if (require.main === module) {
  startServer().catch((error) => {
    console.error('Failed to start EdFilms backend:', error.message);
    process.exit(1);
  });
}