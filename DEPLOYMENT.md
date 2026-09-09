# EdFilms Deployment Guide

This project is ready for production hosting. **Nothing here deploys anything** — it only
prepares the code and config. The existing database schema is **not changed** by any of this.

## Architecture

- **Backend**: Express + PostgreSQL (Node 22, `pg`). Runs on port `5000`.
- **Frontend**: React + Vite, built to static files, served by nginx. Runs on port `80`.
- **Database**: PostgreSQL 16.
- **Media storage**: local disk directory (`STORAGE_DIR`), mounted as a **persistent volume**.
  Videos/posters are streamed/downloaded through the backend.

```text
Browser -> nginx (port 80) -> /api -> backend (node, 5000) -> PostgreSQL
          static SPA files
```

## Option 1 (recommended): Docker Compose on a VPS

Cheapest stable option (~€4-6/mo, e.g. Hetzner CX22). Everything runs on one box.

### Steps

1. Copy the repo to the server (git clone, or rsync).
2. Copy the example env and fill in real secrets:

   ```bash
   cp .env.example .env
   # set POSTGRES_PASSWORD (strong), JWT_SECRET (openssl rand -hex 32),
   # FRONTEND_URL, SITE_URL, CORS_ORIGINS to your domain
   ```

   The compose file defaults `PAYMENT_MODE=mock` so the stack starts without MTN
   credentials. Switch to `PAYMENT_MODE=live` in `.env` and fill the `MOMO_*`
   variables once you have real MTN credentials.

3. Copy your existing media into the bind mount (first time only):

   ```bash
   # on the local machine
   scp -r backend/storage/* user@server:project/backend/storage/
   ```

4. Migrate your existing data if the server DB is fresh

   The container runs `src/server.js` which auto-creates tables/indexes (idempotent, schema is
   unchanged). Existing rows must be migrated once from your old SQLite or old PG dump:

   ```bash
   # e.g. restore a pg_dump of the existing 'edfilms' database
   docker compose exec -T db psql -U edfilms -d edfilms < edfilms_pg_dump.sql
   ```

5. Start:

   ```bash
   docker compose up -d --build
   ```

6. Point your domain A-record(s) at the VPS IP and (recommended) terminate TLS with Caddy/nginx.

### Backups

```bash
docker compose exec -T db pg_dump -U edfilms -d edfilms > edfilms_$(date +%F).sql
# plus: rsync backend/storage (the media volume) to offsite/object storage
```

## Option 2: Render.com blueprint (fully managed, free tier)

Files prepared: `render.yaml`. It creates:

- `edfilms-backend` (Node web service, free) with a **persistent disk** mounted at `/data/storage`
  for media, and `DATABASE_URL` wired to the Render Postgres instance.
- `edfilms-frontend` (static site, free) with `VITE_API_URL` auto-pointed at the backend.
- `edfilms-db` (managed Postgres, free).

In the Render dashboard: **New + → Blueprint** → point at this repo. After first deploy:

- Create the tables with the same idempotent initializer: `npm run init-db` (run once against the
  Render `DATABASE_URL`).
- Migrate existing rows from your current database (pg_dump of `edfilms`, then restore into the
  Render DB).
- The blueprint deploys in `PAYMENT_MODE=mock` so it works without MTN credentials. When you have
  real MTN credentials: set `PAYMENT_MODE=live` and the `MOMO_*` variables in the backend service
  dashboard. (In `live` mode the backend refuses to start until all `MOMO_*` vars are set.)

## Environment variables

See `.env.example`. In **production** the backend **refuses to start** unless:

- `DATABASE_URL` is set
- `JWT_SECRET` is ≥ 32 chars
- `FRONTEND_URL` and `CORS_ORIGINS` are set (comma-separated
  list of allowed frontend origins)
- all `MOMO_*` variables are set when `PAYMENT_MODE=live`

## Media storage: moving to object storage (R2 / Backblaze B2)

Current storage driver writes to local disk (`MOVIES_DIR`, `POSTERS_DIR`). For high-traffic /
multi-instance setups, migrate to object storage:

- Backend: replace the disk read/write helpers in `routes/movies.js`, `routes/posters.js`,
  `routes/adminMovies.js` and `services/movieService.js` with an S3-compatible client
  (Cloudflare R2 and B2 both expose S3 APIs; `@aws-sdk/client-s3`).
- Keep serving videos/poster URLs through the backend (signed URLs + the JWT-gated `movies.js`
  stream route) so entitlements still apply.
- nginx `/api/` proxy already disables buffering and enables `proxy_force_ranges` for byte-range
  streaming; it works for object storage too when the backend proxy streams.

This migration is intentionally **not** done yet — it has no effect on the current DB schema and
is safe to do later without touching the data model.

## Health / ops

- `GET /health` → `{ status: "ok", service: "EdFilms Backend", database: "connected" }`
- Backend handles `SIGTERM`/`SIGINT` gracefully (drains connections, closes the pool).
- In production, 5xx responses are generic; real errors are logged server-side only.