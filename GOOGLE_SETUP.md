# Google OAuth and optional Gmail

See DEPLOYMENT.md for the complete Linux/Docker procedure. Configure a Google Cloud Web application client, Gmail API, consent screen, test users and your verified domain.

Redirects (replace app.example.com with APP_DOMAIN):

- https://app.example.com/auth/google/callback
- https://app.example.com/auth/gmail/callback

For local development add the equivalent http://localhost:3000 URLs. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and OAUTH_TOKEN_ENCRYPTION_KEY in server environment. APP_ORIGIN must exactly match the public origin; production Compose derives it from APP_DOMAIN.

Google login uses openid/email/profile only, creates a user by Google subject, and issues an opaque HttpOnly server session. Gmail requires a separate authenticated consent with https://www.googleapis.com/auth/gmail.readonly. Refresh tokens are encrypted server-side and never returned to the frontend.

The application itself has no Sites/ChatGPT access gate in this Node deployment. All main pages are accessible as a guest. Personal operations require a Google session. No OpenAI identity provider exists.

Production Gmail restricted-scope verification and applicable security assessment must be completed as required by Google. Prepare real operator contact details, privacy policy and terms for the production domain; the included policy text needs owner review. Missing credentials leave guest mode usable and Google login unavailable.

Manual verification: sign in without Gmail consent, verify an empty personal dashboard, upload/confirm a statement, connect Gmail separately, synchronize, review structured receipts, verify bank reconciliation, disconnect and revoke, delete derived data, log out, and confirm guest mode returns.

No LLM integration is enabled. Unknown email layouts may remain unrecognized. Gmail sync runs while the application is open; no unattended scheduling is included.

Official references:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/openid-connect/openid-connect
- https://developers.google.com/workspace/gmail/api/auth/scopes
- https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification
