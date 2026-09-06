# Поток · MVP
## Product flow
ChatGPT sign-in provisions a local user on first authorized request. Import CSV/XLSX → server validation and parsing → deterministic detection → editable candidates → explicit confirmation → dashboard. Manual CRUD is a fallback.
## Modules and invariants
- lib/domain: pure types, normalization, calendar prediction, money, analytics and recommendations.
- lib/server: authorization, prepared D1 queries and atomic batches, import orchestration.
- app/api: authenticated JSON endpoints; same-origin mutations.
- components/product and app: responsive screens.
- db/schema.ts and generated drizzle/: schema and migrations, never runtime DDL.
- Money is integer minor units; division uses BigInt rounding. Supported currencies use 2 minor digits. Never sum currencies together.
- Every database operation is scoped by authenticated user ID. Source statement bytes exist only during parsing. No transaction bodies in logs; authenticated responses are not cached.
- Candidate confirmation is separate from detection. Cancelled/paused expenses are excluded from forecasts and recommendations.
- Predictions are calendar based. Unknown merchants are supported; confidence is a heuristic, not a calibrated probability.
## Routes
/ overview/onboarding; /import; /detected; /expenses; /expenses/[id]; /recommendations; /settings.
## Hosting
Vinext/React, Cloudflare Workers and D1, Sites dispatch-owned ChatGPT authentication. Private by default. Password registration and banking integrations are outside this deployment model.
## Delivery sequence
1. Model, schema, routing, UI shell.
2. Authentication and CRUD.
3. CSV/XLSX server import.
4. Recurring detection and forecasts.
5. Candidate confirmation and transaction linking.
6. Dashboard analytics.
7. Rule-based recommendations.
8. Cancellation strategies and user confirmation.
9. PWA, responsive completion, security and integration tests.

## PDF support
PDF is the primary upload option (5 MB, 30 pages, 1,000 reviewed rows); CSV/XLSX remain available (2 MB, 10,000 rows). Server-side unpdf/PDF.js reads text and coordinates. The user reviews extracted dates, descriptions, amounts and direction before any PDF operation is persisted. Unknown direction is unselected and requires clarification. Only confirmed expense-direction rows enter the common import validation and detection pipeline. Scans, password-protected PDFs, and layouts without recognizable rows return explicit errors; OCR is not included. No universal bank-layout compatibility is claimed without a real statement fixture.

## Local development
Node 24+ recommended. Windows development uses the same SQL through node:sqlite at .local/potok.sqlite because the sandbox's native Workers runtime cannot start. This adapter is a Vite serve-only alias and is excluded from the hosted Worker. Generated Drizzle migrations are applied to local SQLite on startup. Authentication uses the starter's localhost-only test sign-in, never a production bypass.

## Validation
Pure business tests cover money, date drift, month end, four periods, variability, refunds, duplicates, PDF text/table extraction, XLSX limits, recommendations, cancellation and user-scoped deletion. HTTP smoke scripts cover authentication, CRUD, import, confirmation idempotency, PDF review and routes. Browser UI interaction/visual testing has not been performed. WebMCP read tool is feature-detected; a supported live WebMCP validation context was unavailable.
