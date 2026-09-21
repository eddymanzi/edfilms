const { Pool } = require('pg');

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required environment variable: DATABASE_URL');
  }
  return 'postgresql://postgres:password@localhost:5432/edfilms';
}

const DATABASE_URL = resolveDatabaseUrl();

let pool = null;

function getDb() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000
    });
  }
  return pool;
}

async function query(text, params) {
  const client = getDb();
  const result = await client.query(text, params);
  return result;
}

async function initializeDatabase() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000
    });
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE admins ADD COLUMN IF NOT EXISTS email TEXT DEFAULT NULL;

    CREATE TABLE IF NOT EXISTS admin_reset_tokens (
      id SERIAL PRIMARY KEY,
      "adminId" INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("adminId") REFERENCES admins(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movies (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      poster TEXT DEFAULT '',
      video TEXT DEFAULT '',
      year INTEGER,
      language TEXT DEFAULT 'English',
      duration INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      genre TEXT DEFAULT '',
      featured INTEGER DEFAULT 0,
      published INTEGER DEFAULT 0,
      "allowDownload" INTEGER DEFAULT 1,
      views INTEGER DEFAULT 0,
      downloads INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      access_type TEXT NOT NULL DEFAULT 'FREE',
      download_access TEXT NOT NULL DEFAULT 'FREE',
      price_rwf INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS movie_categories (
      "movieId" INTEGER NOT NULL,
      "categoryId" INTEGER NOT NULL,
      PRIMARY KEY ("movieId", "categoryId"),
      FOREIGN KEY ("movieId") REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY ("categoryId") REFERENCES categories(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS views (
      id SERIAL PRIMARY KEY,
      "movieId" INTEGER NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("movieId") REFERENCES movies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS downloads (
      id SERIAL PRIMARY KEY,
      "movieId" INTEGER NOT NULL,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("movieId") REFERENCES movies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      resolved INTEGER DEFAULT 0,
      "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER NOT NULL,
      customer_reference TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      amount_rwf INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'RWF',
      provider TEXT NOT NULL DEFAULT 'momo',
      provider_transaction_id TEXT UNIQUE,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMPTZ,
      metadata TEXT,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS movie_entitlements (
      id SERIAL PRIMARY KEY,
      movie_id INTEGER NOT NULL,
      payment_id INTEGER NOT NULL,
      customer_reference TEXT NOT NULL,
      access_type TEXT NOT NULL DEFAULT 'FREE',
      created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMPTZ,
      UNIQUE (movie_id, customer_reference, access_type),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_movies_slug ON movies(slug);
    CREATE INDEX IF NOT EXISTS idx_movies_published ON movies(published);
    CREATE INDEX IF NOT EXISTS idx_movies_featured ON movies(featured);
    CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
    CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
    CREATE INDEX IF NOT EXISTS idx_movies_language ON movies(language);
    CREATE INDEX IF NOT EXISTS idx_movies_genre ON movies(genre);
    CREATE INDEX IF NOT EXISTS idx_movies_createdAt ON movies("createdAt");
    CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
    CREATE INDEX IF NOT EXISTS idx_views_movieId ON views("movieId");
    CREATE INDEX IF NOT EXISTS idx_downloads_movieId ON downloads("movieId");
    CREATE INDEX IF NOT EXISTS idx_contact_messages_resolved ON contact_messages(resolved);
    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    CREATE INDEX IF NOT EXISTS idx_payments_movie_id ON payments(movie_id);
    CREATE INDEX IF NOT EXISTS idx_payments_customer_reference ON payments(customer_reference);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at);
    CREATE INDEX IF NOT EXISTS idx_payments_provider_transaction_id ON payments(provider_transaction_id);
    CREATE INDEX IF NOT EXISTS idx_entitlements_movie_id ON movie_entitlements(movie_id);
    CREATE INDEX IF NOT EXISTS idx_entitlements_customer_reference ON movie_entitlements(customer_reference);
    CREATE INDEX IF NOT EXISTS idx_entitlements_access_type ON movie_entitlements(access_type);
    CREATE INDEX IF NOT EXISTS idx_admin_reset_tokens_token_hash ON admin_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_admin_reset_tokens_adminId ON admin_reset_tokens("adminId");
  `);

  const slugify = (title) => String(title || 'movie')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const backfillResult = await pool.query("SELECT id, title FROM movies WHERE slug IS NULL OR slug = ''");
  if (backfillResult.rows.length > 0) {
    for (const m of backfillResult.rows) {
      let slug = slugify(m.title) || 'movie';
      let original = slug;
      let counter = 1;
      let existing = await pool.query('SELECT id FROM movies WHERE slug = $1 AND id != $2', [slug, m.id]);
      while (existing.rows.length > 0) {
        slug = `${original}-${counter}`;
        counter++;
        existing = await pool.query('SELECT id FROM movies WHERE slug = $1 AND id != $2', [slug, m.id]);
      }
      await pool.query('UPDATE movies SET slug = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $2', [slug, m.id]);
      console.log(`[migration] Backfilled slug for movie #${m.id}: "${slug}"`);
    }
  }

  const categories = [
    { name: 'Action', slug: 'action' },
    { name: 'Comedy', slug: 'comedy' },
    { name: 'Drama', slug: 'drama' },
    { name: 'Romance', slug: 'romance' },
    { name: 'Animation', slug: 'animation' },
    { name: 'Documentary', slug: 'documentary' },
    { name: 'Adventure', slug: 'adventure' },
    { name: 'Horror', slug: 'horror' },
    { name: 'Sci-Fi', slug: 'sci-fi' },
    { name: 'Thriller', slug: 'thriller' }
  ];

  for (const cat of categories) {
    await pool.query(
      'INSERT INTO categories (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING',
      [cat.name, cat.slug]
    );
  }

  return pool;
}

module.exports = { getDb, initializeDatabase, query, DATABASE_URL };
