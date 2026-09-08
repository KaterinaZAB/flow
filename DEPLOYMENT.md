# Linux deployment

This is a Node SSR + REST application, not a static SPA. `frontend` is Caddy (HTTPS and same-origin reverse proxy), `backend` serves the existing React Server Components, static assets and REST API, and `postgres` stores personal data. The Node process has no exposed host port. No Sites account or Cloudflare binding is required.

## Requirements

Linux server with Docker Engine + Compose v2, DNS A/AAAA record for `app.example.com`, ports 80 and 443 reachable, outbound HTTPS to Google. Remove an incorrect AAAA record if IPv6 is unavailable. Caddy obtains and renews TLS certificates automatically. No separate API domain is needed.

## First deployment

From the repository directory:

```sh
cp .env.example .env
openssl rand -hex 32
openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'
```

Put the first generated value in `POSTGRES_PASSWORD`, the second in `OAUTH_TOKEN_ENCRYPTION_KEY`. Set `APP_DOMAIN`, Google client ID and secret. Never paste secrets into public issues or Git. Use a hex PostgreSQL password to avoid URL escaping in Compose. The production Compose file derives `APP_ORIGIN` and `DATABASE_URL`; `.env` versions of those two are for local development.

```sh
chmod 600 .env
docker compose config --quiet
docker compose build
docker compose up -d --wait
docker compose ps
curl --fail https://app.example.com/health
```

On backend startup, migrations run under a PostgreSQL advisory lock with checksums and transactions, then the service catalog is seeded. No guest/user financial fixtures are seeded. A failed migration prevents startup. PostgreSQL data survives container recreation in `postgres_data`. Never run `docker compose down -v` unless intentionally deleting the database.

## Google Console

Enable Gmail API. Configure the consent screen, test users during Testing, verified domain, privacy policy and terms. Create a Web application OAuth client with these exact redirect URIs:

```text
https://app.example.com/auth/google/callback
https://app.example.com/auth/gmail/callback
```

Login requests `openid email profile`; Gmail connection is a separate consent with `gmail.readonly`. Production Gmail access may require Google restricted-scope verification and applicable security assessment. App credentials alone do not constitute verification. Without credentials, guest mode remains available and login displays setup status.

Sessions are random opaque cookies; only their SHA-256 hashes are stored in PostgreSQL. Gmail tokens are encrypted with AES-GCM and never sent to the browser. Keep the encryption key stable across restarts and backup/restore. There is no OpenAI login or currently active LLM provider, so `OPENAI_API_KEY` is not required.

## Updating and migrations

Back up first, pull/copy the new source, then run `sh scripts/deploy.sh`. The existing source's database schema is in `db/schema.ts`, generated PostgreSQL migrations in `migrations/postgres`. Generate new migrations with `npm run db:generate`; review SQL before deploying. Applied migrations must never be edited. Legacy `drizzle/*.sql` files are SQLite test fixtures/reference, not production migrations.

Existing SQLite/D1 accounts are not automatically transferred. This deployment creates a new PostgreSQL database. Transfer existing personal data only through an explicit, verified export/import migration; changing DATABASE_URL does not migrate data.

## Backup

The dump contains private financial data. Keep it encrypted and access-restricted, separately from the server. Save `.env` and the encryption key securely too.

```sh
mkdir -p backups
chmod 700 backups
docker compose exec -T postgres pg_dump -U potok -d potok -Fc > backups/potok.dump
chmod 600 backups/potok.dump
```

## Restore

This replaces the selected database's data. Verify the dump and destination first. Stop the application while restoring:

```sh
docker compose stop backend frontend
docker compose exec -T postgres pg_restore -U potok -d potok --clean --if-exists --no-owner < backups/potok.dump
docker compose up -d --wait
```

## Local development (Node 22.13+)

```sh
cp .env.example .env
# Set matching POSTGRES_PASSWORD and DATABASE_URL in .env.
npm ci
npm install --prefix backend
docker compose -f docker-compose.dev.yml up -d --wait
npm run db:migrate
npm run db:seed
npm run dev
```

Add `http://localhost:3000/auth/google/callback` and `http://localhost:3000/auth/gmail/callback` to the development Google client. Production must use HTTPS. Cookies are same-origin; no permissive CORS policy is needed. Caddy overwrites forwarding headers. Do not expose the backend directly to the internet or put an untrusted proxy in front of it.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

For real PostgreSQL/API end-to-end tests, use a separate disposable test database with migrations and a running app whose Google configuration is populated. The runner creates isolated fixture identities/sessions directly in that test DB; it does not simulate a successful live Google consent:

```sh
RUN_POSTGRES_E2E=yes node --env-file=.env scripts/test-postgres.mjs
```

Actual Google login, logout and Gmail consent must also be tested using an authorized Google test user. The fixture runner cannot verify Google's live consent screen.

## Operational limits

- Gmail sync is bounded and incremental, triggered while the app is open. No unattended background scheduler is included.
- Imports run synchronously: PDF 5 MB, CSV/XLSX 2 MB, up to 10,000 operations per file. Scanned/password-protected PDF is unsupported.
- Guest import previews are not persisted; after login the file must be uploaded again to save it. Guest demo entities are never inserted into PostgreSQL.
- Rule-based parsing and recommendations are real; unknown email formats can remain unrecognized. No LLM fallback is currently configured.
- Provider cancellation remains an external/manual action; changing status in Potok does not cancel a service with the provider.
- One application process, in-memory request rate limits. Scale-out requires shared limits and a reviewed concurrency strategy.
- The backend driver is pinned in `backend/package.json`; its install must complete before database-backed execution. Network access was blocked in the development sandbox, so a backend lockfile and Docker/PostgreSQL execution verification are still pending.
