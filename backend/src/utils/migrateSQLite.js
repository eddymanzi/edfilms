require('dotenv').config();
const path = require('path');
const Database = require('better-sqlite3');
const { Pool } = require('pg');

const SQLITE_PATH = path.join(__dirname, '..', '..', 'data', 'edfilms.sqlite');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edfilms';

async function main() {
  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  const pg = new Pool({ connectionString: DATABASE_URL });

  console.log('=== Migrating SQLite -> PostgreSQL ===\n');

  // 1. Categories (map by slug)
  const catBySlug = new Map();
  const pgCats = await pg.query('SELECT id, slug FROM categories');
  for (const c of pgCats.rows) catBySlug.set(c.slug, c.id);

  const catMap = new Map();
  const sqliteCats = sqlite.prepare('SELECT * FROM categories ORDER BY id').all();
  for (const cat of sqliteCats) {
    if (catBySlug.has(cat.slug)) {
      catMap.set(cat.id, catBySlug.get(cat.slug));
      continue;
    }
    const res = await pg.query(
      'INSERT INTO categories (name, slug, description, "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id',
      [cat.name, cat.slug, cat.description || '', cat.createdAt || new Date()]
    );
    catMap.set(cat.id, res.rows[0].id);
  }
  console.log(`Categories migrated: ${sqliteCats.length}`);

  // 2. Admins (preserve password hash)
  const admins = sqlite.prepare('SELECT * FROM admins ORDER BY id').all();
  for (const admin of admins) {
    await pg.query(
      'INSERT INTO admins (id, username, password, "createdAt") VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING',
      [admin.id, admin.username, admin.password, admin.createdAt || new Date()]
    );
  }
  console.log(`Admins migrated: ${admins.length}`);

  // 3. Movies (preserve IDs)
  const movieRows = sqlite.prepare('SELECT * FROM movies ORDER BY id').all();
  const movieMap = new Map();
  for (const m of movieRows) {
    await pg.query(`
      INSERT INTO movies
        (id, title, slug, description, poster, video, year, language, duration, rating, genre,
         featured, published, "allowDownload", views, downloads, "createdAt", "updatedAt",
         access_type, download_access, price_rwf)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
      ON CONFLICT (id) DO NOTHING
    `, [
      m.id, m.title, m.slug, m.description || '', m.poster || '', m.video || '',
      m.year, m.language || 'English', m.duration || 0, m.rating || 0, m.genre || '',
      m.featured ?? 0, m.published ?? 0, m.allowDownload ?? 1,
      m.views ?? 0, m.downloads ?? 0, m.createdAt || new Date(), m.updatedAt || new Date(),
      m.access_type || 'FREE', m.download_access || 'FREE', m.price_rwf ?? 0
    ]);
    movieMap.set(m.id, m.id);
  }
  console.log(`Movies migrated: ${movieRows.length}`);

  // 4. movie_categories
  const mcs = sqlite.prepare('SELECT * FROM movie_categories').all();
  for (const mc of mcs) {
    const mid = movieMap.get(mc.movieId);
    const cid = catMap.get(mc.categoryId);
    if (!mid || !cid) continue;
    await pg.query('INSERT INTO movie_categories ("movieId", "categoryId") VALUES ($1, $2) ON CONFLICT DO NOTHING', [mid, cid]);
  }
  console.log(`Movie-category links migrated: ${mcs.length}`);

  // 5. views
  const views = sqlite.prepare('SELECT * FROM views ORDER BY id').all();
  for (const v of views) {
    const mid = movieMap.get(v.movieId);
    if (!mid) continue;
    await pg.query(
      'INSERT INTO views (id, "movieId", "ipAddress", "userAgent", "createdAt") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [v.id, mid, v.ipAddress || '', v.userAgent || '', v.createdAt || new Date()]
    );
  }
  console.log(`Views migrated: ${views.length}`);

  // 6. downloads
  const downloads = sqlite.prepare('SELECT * FROM downloads ORDER BY id').all();
  for (const d of downloads) {
    const mid = movieMap.get(d.movieId);
    if (!mid) continue;
    await pg.query(
      'INSERT INTO downloads (id, "movieId", "ipAddress", "userAgent", "createdAt") VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
      [d.id, mid, d.ipAddress || '', d.userAgent || '', d.createdAt || new Date()]
    );
  }
  console.log(`Downloads migrated: ${downloads.length}`);

  // 7. contact_messages
  const messages = sqlite.prepare('SELECT * FROM contact_messages ORDER BY id').all();
  for (const msg of messages) {
    await pg.query(
      'INSERT INTO contact_messages (id, name, email, message, resolved, "createdAt") VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
      [msg.id, msg.name, msg.email, msg.message, msg.resolved ?? 0, msg.createdAt || new Date()]
    );
  }
  console.log(`Contact messages migrated: ${messages.length}`);

  // 8. settings
  const settings = sqlite.prepare('SELECT * FROM settings').all();
  for (const s of settings) {
    await pg.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [s.key, s.value]
    );
  }
  console.log(`Settings migrated: ${settings.length}`);

  // 9. payments
  const payments = sqlite.prepare('SELECT * FROM payments ORDER BY id').all();
  const paymentMap = new Map();
  for (const p of payments) {
    const mid = movieMap.get(p.movie_id);
    if (!mid) continue;
    const res = await pg.query(`
      INSERT INTO payments
        (id, movie_id, customer_reference, phone_number, amount_rwf, currency, provider,
         provider_transaction_id, status, created_at, updated_at, paid_at, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `, [
      p.id, mid, p.customer_reference, p.phone_number, p.amount_rwf || 0, p.currency || 'RWF',
      p.provider || 'momo', p.provider_transaction_id, p.status || 'PENDING',
      p.created_at || new Date(), p.updated_at || new Date(), p.paid_at, p.metadata
    ]);
    if (res.rows[0]) paymentMap.set(p.id, res.rows[0].id);
  }
  console.log(`Payments migrated: ${payments.length}`);

  // 10. movie_entitlements
  const ents = sqlite.prepare('SELECT * FROM movie_entitlements').all();
  for (const e of ents) {
    const mid = movieMap.get(e.movie_id);
    const pid = paymentMap.get(e.payment_id);
    if (!mid || !pid) continue;
    await pg.query(
      'INSERT INTO movie_entitlements (movie_id, payment_id, customer_reference, access_type, created_at, expires_at) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (movie_id, customer_reference, access_type) DO NOTHING',
      [mid, pid, e.customer_reference, e.access_type || 'FREE', e.created_at || new Date(), e.expires_at]
    );
  }
  console.log(`Entitlements migrated: ${ents.length}`);

  // Reset sequences after explicit-id inserts
  const seqTables = ['categories', 'admins', 'movies', 'views', 'downloads', 'contact_messages', 'payments', 'movie_entitlements'];
  for (const t of seqTables) {
    await pg.query(`
      SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST(COALESCE(MAX(id), 0) + 1, 1), false) FROM ${t}
    `);
  }

  console.log('\n=== Migration complete ===');
  await pg.end();
  sqlite.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});