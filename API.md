# REST API

All endpoints are same-origin. JSON errors use `{ "error": "human-readable message", "code": "HTTP_400" }` (or INTERNAL_ERROR). This retains the existing frontend response contract. `lib/api/client.ts` handles connection failures and expired-session prompts. Do not retry mutations automatically.

| Method | Route | Access/purpose |
|---|---|---|
| GET | /health | Process/database readiness, no private data |
| GET | /api/me | User or guest mode and preferences |
| PATCH | /api/me | Session; baseCurrency preference |
| GET | /auth/google/start | Google identity consent |
| GET | /auth/google/callback | Single-use OAuth completion |
| POST | /auth/logout | Same-origin; revoke session |
| GET, POST | /api/expenses | Session; list/create |
| GET, PATCH, DELETE | /api/expenses/:id | Session + ownership; details/update/delete |
| GET | /api/dashboard | Session; calculated projections by currency |
| GET | /api/recommendations | Session; current rule-based observations |
| GET, POST | /api/imports | Session; history/upload, PDF review when required |
| POST | /api/demo-import | Guest preview only; no database write |
| GET, POST | /api/candidates | Session; review and confirm/reject/edit |
| POST | /auth/gmail/start | Session + explicit gmail-readonly consent |
| GET | /auth/gmail/callback | Additional consent completion |
| GET, DELETE | /api/gmail/connection | Session; status/disconnect |
| POST | /api/gmail/sync | Session; bounded incremental sync |
| GET, POST | /api/gmail/receipts | Session; suggestions and decisions |
| POST | /api/gmail/events | Session; financial event decisions (events rendered by server) |
| DELETE | /api/gmail/data | Session; delete extracted Gmail data |
| DELETE | /api/data | Session; delete imported bank data |
| DELETE | /api/account | Session; `{ "confirm": "delete-account" }` |

Bank candidate decision body: `{ "ids": ["candidate-id"], "decision": "confirmed" }`; edit/rejected use the same existing route. Financial amounts returned by API are integer minor units. Expense forms submit a decimal string `amount`, validated and converted by the backend. PDF, CSV and XLSX uploads are multipart with `file`, `currency`, optional `mapping`; PDF review uses the existing `pdfReviewed`/`pdfRows` contract.

Server-rendered pages use the same domain services directly, including the explicit guest provider. This avoids calling the public HTTP endpoint from the same Node process while preserving one backend business-logic source.
