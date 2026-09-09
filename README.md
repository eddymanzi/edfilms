# EdFilms

Kinyarwanda movie streaming platform. Express + PostgreSQL backend, React + Vite frontend.

## Stack

- **Backend**: Node.js, Express, PostgreSQL (`pg`), JWT auth, multer uploads, MTN MoMo payments
- **Frontend**: React 18, Vite, react-router
- **Database**: PostgreSQL (tables: movies, categories, movie_categories, views, downloads,
  payments, movie_entitlements, contact_messages, settings, admins)

## Local development

```bash
# requirements: Node 18+, PostgreSQL running locally

cd backend
cp .env.example .env         # then set DATABASE_URL, JWT_SECRET, MOMO_*
npm install
npm run init-db              # creates schema + seeds defaults (idempotent)
npm run create-admin         # create your admin account
npm run dev                  # backend on :5000

# in a second terminal
cd frontend
npm install
npm run dev                  # frontend on :5173 (proxies /api to :5000)
```

## Environment

See `.env.example` (root) and `backend/.env.example`. Never commit real `.env` files.
In production the backend refuses to start if `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`,
`CORS_ORIGINS`, or the `MOMO_*` vars (when live) are missing.

## Tests

```bash
cd backend
npm test
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). Docker Compose (VPS) and Render blueprint are both provided.
Deploy artifacts do **not** change the database schema.