# Security boundaries and verification

- Only a verified Google subject creates a login identity. Email is not an identity key. Login requests no Gmail scope.
- Opaque 256-bit session cookies: HttpOnly, SameSite=Lax, Secure and __Host prefix under HTTPS. Database stores hashes. Expiration is checked server-side on every authenticated operation. Logout deletes the session.
- OAuth uses random state bound to HttpOnly cookie, nonce, PKCE, short expiration and single-use DELETE RETURNING. Google ID token signature/audience/issuer are verified. Gmail consent is bound to the same logged-in subject.
- OAuth token encryption uses AES-GCM with per-value nonce and user-bound additional authenticated data. Tokens, email bodies and bank files are not logged or exposed through APIs.
- Personal repositories always scope by user_id. API operations authorize independently of public page access. Guest provider never writes its synthetic entities to the database.
- Same-origin deployment: mutation Origin validation, backend port private to Compose network, trusted forwarding configured at Caddy, no wildcard CORS. Request rate and streaming upload size limits apply. Development does not pretend to provide proxy/TLS hardening.
- Parameterized PostgreSQL queries and transactional batches. Migration checksums and advisory lock prevent concurrent schema changes. Database credentials must not be exposed outside the backend.
- Uploads validate size, MIME, format signature and parsed structure, then discard original bytes. No public upload directory. CSV/XLSX/PDF row limits and decompression restrictions are also in parser modules.
- Email HTML is converted to sanitized text, never rendered raw. Only extracted financial metadata persists. AI outputs cannot modify expenses without validation and user confirmation; no AI provider is currently enabled.
- Unhandled API errors return generic text and a code. Structured logs exclude query strings, cookies, tokens and payloads. /health exposes availability only.
- Deletion APIs support bank-derived data, Gmail-derived data, individual expenses and whole-account cascade deletion. Account deletion first attempts Gmail disconnect/revoke.

## Pending deployment verification

The local environment denied npm registry access and Docker configuration access. Consequently driver installation, live PostgreSQL API tests, container startup, HTTPS forwarding and live Google/Gmail consent still require execution in the deployment/test environment. Do not infer those checks from a passing TypeScript build. Run `scripts/test-postgres.mjs` against an isolated database, then manual Google test-user consent flows before public use.

## Current operational limits

Rate limits are process-local and the intended deployment is one backend process. Service catalog is versioned source metadata, seeded into PostgreSQL; editing catalog tables alone does not hot-reload matching rules. No independent background worker or automatic revoked-account purge schedule is provided. Users can delete their own account explicitly.
