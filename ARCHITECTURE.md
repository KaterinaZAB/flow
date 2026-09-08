# Architecture

## Runtime

Caddy (frontend HTTPS/reverse proxy) -> Node/Vinext (React Server Components + REST) -> PostgreSQL.

The existing App Router and components remain intact. SSR reads the same server services as REST routes without a redundant loopback HTTP request. Client mutations use `lib/api/client.ts`; authenticated REST never returns guest fixtures. `lib/server/product-data.ts` is the centralized server data-provider boundary. Guest data lives only in `lib/demo` and tests/examples.

## Modules

- Auth: `lib/google` and `app/auth`; verified Google subject, server sessions, separate Gmail consent.
- Persistence: `lib/server/postgres.ts`; pool and parameterized repository boundary, atomic batches. Drizzle schema in `db/schema.ts`; generated migrations in `migrations/postgres`.
- Users: `/api/me` profile and preferences; `/api/account` deletion.
- Expenses/transactions: `lib/server/expenses.ts`; owner-scoped CRUD and provider enrichment.
- Imports: `lib/import` parsers, MIME/body limits; `lib/server/imports.ts` persistence.
- Detection/confirmation: `lib/domain/detection.ts` and `lib/server/candidates.ts`.
- Analytics: server `projections.ts`; `/api/dashboard`; client renders prepared results.
- Recommendations: server rule engine, `/api/recommendations` and server-rendered page.
- Gmail: candidate search, MIME preprocessing, rules/schema validation, reconciliation and incremental sync in `lib/gmail` + `lib/server/gmail.ts`.
- Catalog: versioned matching metadata in `lib/domain/catalog.ts`, seeded reference services and aliases in PostgreSQL.

## Public and personal data

Public routes display demo expenses and actual demo analytics. A null user is normal. Protected mutations validate sessions and Origin server-side. Guest upload parses real supplied bytes and returns preview candidates without persisting. Saving after login currently requires re-upload; personal data is not silently copied from the demo dataset.

## Database

users, google_identities, auth_sessions, oauth_states, gmail_connections, recurring_expenses, transactions, transaction_imports, detection_candidates, gmail_receipts, expense_evidence, gmail_events, provider_enrichments, integration_locks, integration_audit, services, service_aliases. Financial amounts and epoch times use bigint where appropriate; adapter rejects unsafe numeric conversion. Existing ISO date strings preserve current domain contracts. No float monetary storage.

Legacy SQLite migration files remain for existing regression tests and data migration reference, but production runs PostgreSQL migrations only. No automatic D1-to-PostgreSQL data transfer is performed.

## Operations

Single backend process, bounded synchronous imports/Gmail batches, process-local rate limits, hashed cookie sessions, encrypted Gmail credentials. No Redis, Kubernetes or message queue. See DEPLOYMENT.md and SECURITY.md for operational setup and unverified external dependencies.
