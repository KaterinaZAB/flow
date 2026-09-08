# Current state audit — 2026-09-08

| Feature | Source before migration | Status | Required work |
|---|---|---|---|
| Guest dashboard/list/details | lib/demo/data.ts | DEMO, intentional | Centralize guest provider |
| Authenticated expenses | Server repositories, D1/SQLite | REAL | PostgreSQL runtime |
| Authentication | Google OAuth, PKCE/state/nonce, hashed server sessions | REAL code, external setup pending | Node environment and deployment |
| Gmail | Gmail API search, MIME processing, validated receipts, reconciliation | REAL code, external setup pending | PostgreSQL compatibility |
| Bank import | Server PDF/CSV/XLSX parsers and persisted transactions | REAL | Validation parity and Docker |
| Guest import | Server parser, count-only preview | PARTIAL | Actual candidate preview |
| Detection | Calendar-aware server algorithm | REAL | PostgreSQL integration tests |
| Dashboard/recommendations | Real rules in client components | PARTIAL architecture | Server projections |
| Cancellation | Real status PATCH; provider cancellation is external/manual | REAL | Preserve semantics |
| Docker/Linux | No deployment configuration | MISSING | Node SSR/API, proxy, PostgreSQL |

No financial localStorage/sessionStorage persistence or fabricated API arrays were found in authenticated routes. setTimeout in GmailAutoSync schedules real requests. Input placeholders are form hints. Tests and example CSV intentionally contain synthetic fixtures. Service catalog is deterministic reference metadata, not user financial state. No OpenAI login or active LLM integration exists.

The existing React Server Components require a Node rendering process: nginx cannot replace SSR with a static export without rewriting the frontend. Keep one Node process for SSR and REST, behind a same-origin frontend reverse proxy. PostgreSQL is the sole production persistence layer. Legacy SQLite migrations remain only for regression fixtures and explicit data-export reference; they are never run by the production entrypoint.
