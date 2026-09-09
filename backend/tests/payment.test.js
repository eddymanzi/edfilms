require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const { Pool } = require('pg');

const BACKEND_DIR = path.join(__dirname, '..');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/edfilms';
const TEST_PORT = 5566;
const BASE = `http://localhost:${TEST_PORT}`;
const EXISTING_VIDEO = '0505edd06fe2ad2beb2877e1d5b38c26.mp4';
const TEST_PREFIX = '__TEST__';

let server;
let pool;
let results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function makeRef() {
  return 'edfilms_' + require('crypto').randomBytes(16).toString('hex');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function api(method, pathname, body, headers = {}) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-json */ }
  return { status: res.status, data };
}

function jsonHasSecret(value, pathName = 'root') {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (/momo_api_key|momo_api_secret|momo_subscription_key|password|pin|otp|secret/.test(lower)) {
      return true;
    }
    return false;
  }
  if (Array.isArray(value)) {
    return value.some(v => jsonHasSecret(v, pathName));
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.toLowerCase().includes('password') || k.toLowerCase().includes('secret') || k.toLowerCase().includes('pin') || k.toLowerCase().includes('otp')) return true;
      if (jsonHasSecret(v, `${pathName}.${k}`)) return true;
    }
  }
  return false;
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, ['src/server.js'], {
      cwd: BACKEND_DIR,
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        DATABASE_URL,
        PAYMENT_PROVIDER: 'momo',
        PAYMENT_MODE: 'mock',
        PAYMENT_CURRENCY: 'RWF',
        MOCK_SETTLE_SECONDS: '1',
        MOCK_FAILURE_PHONES: '0700000000'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    server.stdout.on('data', d => process.env.DEBUG_TEST && process.stdout.write(`[server] ${d}`));
    server.stderr.on('data', d => process.env.DEBUG_TEST && process.stderr.write(`[server-err] ${d}`));

    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 15000);

    const poll = async () => {
      try {
        const res = await fetch(`${BASE}/health`);
        const data = await res.json();
        if (data && data.status === 'ok') {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(poll, 300);
        }
      } catch {
        setTimeout(poll, 300);
      }
    };
    poll();
  });
}

async function insertTestMovies() {
  const insert = (title, slug, video, published, accessType, downloadAccess, priceRwf) => pool.query(`
    INSERT INTO movies (title, slug, description, poster, video, year, language, duration, rating, genre,
      featured, published, "allowDownload", access_type, download_access, price_rwf)
    VALUES ($1, $2, '', '', $3, 2026, 'English', 90, 7.5, 'Drama', 0, $4, 1, $5, $6, $7)
    RETURNING id
  `, [title, slug, video, published, accessType, downloadAccess, priceRwf]);

  const premium = await insert(`${TEST_PREFIX}PREMIUM`, `test-premium-${Date.now()}`, EXISTING_VIDEO, 1, 'PREMIUM', 'PAID', 1000);
  const watchFree = await insert(`${TEST_PREFIX}WATCHFREE`, `test-watchfree-${Date.now()}`, '', 1, 'WATCH_FREE_DOWNLOAD_PAID', 'PAID', 500);
  const unpublished = await insert(`${TEST_PREFIX}UNPUBLISHED`, `test-unpublished-${Date.now()}`, '', 0, 'PREMIUM', 'PAID', 1000);
  const zeroPrice = await insert(`${TEST_PREFIX}ZEROPRICE`, `test-zeroprice-${Date.now()}`, '', 1, 'PREMIUM', 'PAID', 0);
  const free = await insert(`${TEST_PREFIX}FREE`, `test-free-${Date.now()}`, EXISTING_VIDEO, 1, 'FREE', 'FREE', 0);

  return {
    premiumId: premium.rows[0].id,
    watchFreeId: watchFree.rows[0].id,
    unpublishedId: unpublished.rows[0].id,
    zeroPriceId: zeroPrice.rows[0].id,
    freeId: free.rows[0].id
  };
}

async function cleanupTestMovies(ids) {
  for (const id of Object.values(ids || {})) {
    await pool.query('DELETE FROM movies WHERE id = $1', [id]);
  }
  console.log('Cleaned up test movies.');
}

async function paymentByMovieId(movieId, status = null) {
  const sql = status
    ? 'SELECT * FROM payments WHERE movie_id = $1 AND status = $2 ORDER BY id DESC LIMIT 1'
    : 'SELECT * FROM payments WHERE movie_id = $1 ORDER BY id DESC LIMIT 1';
  const res = status ? await pool.query(sql, [movieId, status]) : await pool.query(sql, [movieId]);
  return res.rows[0];
}

async function entitlementCount(movieId, ref) {
  const res = await pool.query('SELECT COUNT(*)::int as c FROM movie_entitlements WHERE movie_id = $1 AND customer_reference = $2', [movieId, ref]);
  return res.rows[0].c;
}

async function main() {
  console.log('Starting EdFilms backend for payment tests...');
  await startServer();
  console.log('Server healthy.');

  pool = new Pool({ connectionString: DATABASE_URL });

  const beforeCounts = {
    movies: (await pool.query('SELECT COUNT(*)::int as c FROM movies')).rows[0].c,
    categories: (await pool.query('SELECT COUNT(*)::int as c FROM categories')).rows[0].c
  };

  const existingMovie = (await pool.query('SELECT * FROM movies WHERE title = $1', ['BACK IN ACTION 2(Agasobanuye)'])).rows[0];
  record('TEST 1: Existing movie remains FREE', existingMovie && existingMovie.access_type === 'FREE' && existingMovie.price_rwf === 0, JSON.stringify({ access_type: existingMovie?.access_type, price_rwf: existingMovie?.price_rwf }));

  const ids = await insertTestMovies();
  const ref = makeRef();
  const failedRef = makeRef();

  try {
    // TEST 2: Existing movie streams
    {
      const res = await fetch(`${BASE}/api/movies/${ids.freeId}/stream`, { headers: { Range: 'bytes=0-1023' } });
      const ct = res.headers.get('content-type') || '';
      const cr = res.headers.get('content-range') || '';
      const ar = res.headers.get('accept-ranges') || '';
      const isStream = [200, 206].includes(res.status) && ct.includes('video/') && ar === 'bytes';
      record('TEST 2: Free movie streams (HTTP Range supported)', isStream, `status=${res.status} ct=${ct} range=${cr} accept-ranges=${ar}`);
      await res.body?.cancel?.();
    }

    // TEST 3: Existing movie downloads
    {
      const res = await fetch(`${BASE}/api/movies/${ids.freeId}/download`);
      const cd = res.headers.get('content-disposition') || '';
      record('TEST 3: Free movie downloads', res.status === 200 && cd.includes('attachment'), `status=${res.status} cd=${cd.slice(0, 40)}`);
      await res.body?.cancel?.();
    }

    // TEST 4: Paid movie cannot stream without entitlement — expect 402
    {
      const res = await api('GET', `/api/movies/${ids.premiumId}/stream`);
      const code = res.data?.error?.code;
      record('TEST 4: Paid movie cannot stream without entitlement (402)', res.status === 402 && code === 'PAYMENT_REQUIRED', `status=${res.status} code=${code}`);
    }

    // TEST 5: Paid movie cannot download without entitlement — expect 402
    {
      const res = await api('GET', `/api/movies/${ids.premiumId}/download`);
      record('TEST 5: Paid movie cannot download without entitlement (402)', res.status === 402, `status=${res.status}`);
    }

    // TEST 15: Unpublished movie cannot be purchased
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: ids.unpublishedId, customerReference: ref, phoneNumber: '0781234567' });
      record('TEST 15: Unpublished movie cannot be purchased', res.status === 403, `status=${res.status}`);
    }

    // TEST 14: Invalid amount rejected (premium movie with price 0)
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: ids.zeroPriceId, customerReference: ref, phoneNumber: '0781234567' });
      record('TEST 14: Invalid amount rejected', res.status === 400, `status=${res.status} code=${res.data?.error?.code}`);
    }

    // TEST 12: Invalid movie rejected
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: 999999, customerReference: ref, phoneNumber: '0781234567' });
      record('TEST 12: Invalid movie rejected', res.status === 404, `status=${res.status}`);
    }

    // TEST 13: Invalid phone rejected
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: ids.premiumId, customerReference: ref, phoneNumber: '123456' });
      record('TEST 13: Invalid phone rejected', res.status === 400, `status=${res.status}`);
    }

    // Invalid customer reference rejected
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: ids.premiumId, customerReference: 'bogus-ref', phoneNumber: '0781234567' });
      record('EXTRA: Invalid customer reference rejected', res.status === 400, `status=${res.status}`);
    }

    // TEST 6/7: Initiate payment — PENDING status + frontend cannot change amount
    let providerTx = null;
    {
      const res = await api('POST', '/api/payments/initiate', { movieId: ids.premiumId, customerReference: ref, phoneNumber: '0781234567', priceRwf: 1 });
      const payment = res.data?.data;
      const row = await paymentByMovieId(ids.premiumId, 'PENDING');
      record('TEST 6: Payment creates PENDING status', res.status === 201 && payment?.status === 'PENDING', `status=${res.status} payStatus=${payment?.status}`);
      record('TEST 7: Frontend cannot change payment amount', row && row.amount_rwf === 1000, `amount=${row?.amount_rwf} (sent priceRwf=1)`);
      if (row) providerTx = row.provider_transaction_id;
    }

    // TEST 11: PENDING payment does not unlock movie
    {
      const res = await api('POST', `/api/movies/${ids.premiumId}/access-token`, { customerReference: ref, purpose: 'watch' });
      record('TEST 11: PENDING payment does not unlock movie', res.status === 402, `status=${res.status}`);
    }

    // Wait for mock settlement, then verify SUCCESS + entitlement
    await sleep(1500);
    let payId = null;
    {
      const pending = await paymentByMovieId(ids.premiumId, 'PENDING');
      const res = await api('GET', `/api/payments/${pending?.id || 0}/status`);
      const row = await paymentByMovieId(ids.premiumId, 'SUCCESS');
      payId = row?.id;
      record('TEST 8a: Successful verified payment → SUCCESS', row && row.status === 'SUCCESS', `payStatus=${row?.status}`);
    }

    // TEST 8b: entitlement created on success
    {
      const count = await entitlementCount(ids.premiumId, ref);
      record('TEST 8b: Successful payment creates entitlement', count === 2, `entitlements=${count} (watch+download)`);
    }

    // Unlock works: access-token + stream with token
    {
      const res = await api('POST', `/api/movies/${ids.premiumId}/access-token`, { customerReference: ref, purpose: 'watch' });
      const token = res.data?.data?.token;
      record('EXTRA: Watch access-token granted after payment', res.status === 200 && Boolean(token), `status=${res.status} hasToken=${Boolean(token)}`);
      if (token) {
        const sres = await fetch(`${BASE}/api/movies/${ids.premiumId}/stream?token=${encodeURIComponent(token)}`, { headers: { Range: 'bytes=0-1023' } });
        record('EXTRA: Paid movie streams after entitlement (with token)', [200, 206].includes(sres.status), `status=${sres.status} range=${sres.headers.get('content-range')}`);
        await sres.body?.cancel?.();
      }
    }

    // TEST 9: Duplicate callback does not create duplicate entitlement
    if (providerTx && payId) {
      await api('POST', '/api/payments/momo/callback', { referenceId: providerTx, status: 'SUCCESS' });
      await api('POST', '/api/payments/momo/callback', { referenceId: providerTx, status: 'SUCCESS' });
      const count = await entitlementCount(ids.premiumId, ref);
      const paymentCount = (await pool.query('SELECT COUNT(*)::int as c FROM payments WHERE movie_id = $1', [ids.premiumId])).rows[0].c;
      record('TEST 9: Duplicate callback does not create duplicate entitlement', count === 2 && paymentCount === 1, `entitlements=${count} payments=${paymentCount}`);
    }

    // TEST 10/12: Failed payment does not unlock movie
    {
      const init = await api('POST', '/api/payments/initiate', { movieId: ids.premiumId, customerReference: failedRef, phoneNumber: '0700000000' });
      const pid = init.data?.data?.id;
      await sleep(1500);
      const statusRes = await api('GET', `/api/payments/${pid}/status`);
      const failedRow = await paymentByMovieId(ids.premiumId, 'FAILED');
      record('TEST 10: Failed payment recorded', failedRow && failedRow.customer_reference === failedRef, `status=${statusRes.data?.data?.status}`);
      const entCount = await entitlementCount(ids.premiumId, failedRef);
      record('TEST 10b: Failed payment does not unlock movie', entCount === 0, `entitlements=${entCount}`);
      const streamRes = await api('GET', `/api/movies/${ids.premiumId}/stream`);
      record('TEST 10c: Failed payment movie still blocked (402)', streamRes.status === 402, `status=${streamRes.status}`);
    }

    // TEST 16: Secrets never returned
    {
      const statusRes = await api('GET', `/api/payments/${payId || 0}/status`);
      const initUserRes = await fetch(`${BASE}/api/movies/${ids.premiumId}/access-token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerReference: ref, purpose: 'watch' })
      });
      const initData = await initUserRes.json();
      const leaked = jsonHasSecret(statusRes.data) || jsonHasSecret(initData);
      record('TEST 16: Secrets never returned', !leaked, leaked ? 'LEAKED' : 'clean');
    }

    // TEST 17: Migration did not delete existing data
    {
      const after = {
        movies: (await pool.query('SELECT COUNT(*)::int as c FROM movies')).rows[0].c,
        categories: (await pool.query('SELECT COUNT(*)::int as c FROM categories')).rows[0].c
      };
      const movieStillThere = (await pool.query('SELECT access_type FROM movies WHERE title = $1', ['BACK IN ACTION 2(Agasobanuye)'])).rows[0];
      record('TEST 17: Migration did not delete existing data',
        movieStillThere?.access_type === 'FREE' &&
        after.movies >= beforeCounts.movies &&
        after.categories === beforeCounts.categories,
        `movies before=${beforeCounts.movies} after=${after.movies}, categories before=${beforeCounts.categories} after=${after.categories}`);
    }
  } finally {
    await cleanupTestMovies(ids);
    await pool.end();
    if (server) server.kill();
  }

  console.log('\n====================================');
  console.log(`RESULTS: ${results.length - failures} passed, ${failures} failed`);
  if (failures > 0) process.exit(1);
}

main().catch(async err => {
  console.error('Test runner crashed:', err);
  if (pool) await pool.end().catch(() => {});
  if (server) server.kill();
  process.exit(1);
});