# Potok

PWA for subscriptions and recurring expenses. Existing React/Vinext UI, Node SSR and REST backend, PostgreSQL, same-origin Caddy reverse proxy with automatic HTTPS.

## Start here

- [Deployment, environment, Google Console, backup and restore](DEPLOYMENT.md)
- [Initial feature/mock audit](AUDIT.md)
- [Security boundaries and pending verification](SECURITY.md)
- [Architecture](ARCHITECTURE.md)

## Local development

Node 22.13+ and Docker Compose v2:

```sh
cp .env.example .env
# Set database password and matching DATABASE_URL.
npm ci
npm install --prefix backend
docker compose -f docker-compose.dev.yml up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Guest mode works without Google credentials. Personal data requires PostgreSQL and configured Google OAuth. Google login and Gmail readonly consent are separate. No GPT/OpenAI identity provider and no active LLM provider exist.

## Production

```sh
cp .env.example .env
# Set APP_DOMAIN, POSTGRES_PASSWORD, Google credentials and encryption key.
docker compose build
docker compose up -d --wait
```

Caddy serves the configured domain over HTTPS and proxies to Node. The frontend uses server rendering, so it cannot be replaced by an nginx static export without changing the current architecture. Migrations and reference-catalog seed run before the backend starts. No personal fixtures are seeded. A named PostgreSQL volume persists data.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Real database/API verification: `RUN_POSTGRES_E2E=yes node --env-file=.env scripts/test-postgres.mjs` against an isolated test database and running configured test app. Live Google login and Gmail consent require external credentials and test-user authorization; the test runner seeds only its own test sessions.

## Important status

The previous app already had real Google/Gmail/import/detection code backed by D1/SQLite. It has been adapted for Node/PostgreSQL. Guest data remains deliberately synthetic and separate. The Docker/PostgreSQL runtime has not yet been executed in this restricted environment: npm registry and Docker config access were denied. Follow the verification steps before treating this as a validated production release. Existing D1/SQLite data is not automatically migrated.
