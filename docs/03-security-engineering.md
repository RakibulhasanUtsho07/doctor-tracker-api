# Security Engineering Standard
## Identity and sessions
- Passwords use Node.js scrypt with a random salt and fixed parameters; never store plaintext or use a default administrator password.
- The first administrator is provisioned by a one-time command. There is no public registration route and bootstrap refuses to overwrite an existing account.
- Session bearers are random opaque values delivered only in an HttpOnly cookie. MongoDB stores a SHA-256 digest, user reference, CSRF token and expiry. Sessions are revoked on logout, checked on each protected request and expire after 8 hours.
- Login returns generic invalid-credential errors and applies a limit of five attempts per client IP per 15-minute window. The in-memory login limiter requires a shared store before multi-instance scaling.
- Initial administrator provisioning is CLI-only. The bootstrap command validates the operator-provided email/password, hashes the password, claims a durable singleton setup marker before creating the first ADMIN, and refuses to overwrite an existing user. There is no public signup endpoint or setup token. The guarded stale-marker recovery command is available only after every API/bootstrap process is stopped and it verifies that no user exists; it never deletes accounts.
- If a process is forcibly terminated after claiming the initial-admin marker but before creating the first user, setup fails closed. Recovery is an explicit operator command that requires all API/bootstrap instances to be stopped, an empty user collection, a marker still incomplete and at least 15 minutes old, a confirmation environment flag, and a compare-and-delete filter. It never deletes users or completed setup markers.
- Development cookie policy is SameSite=Strict. Production cookie policy is Secure and SameSite=None for cross-origin frontend/API requests, with a __Host-prefixed cookie name.
- Production startup rejects `FRONTEND_ORIGINS` entries that use plain HTTP; local HTTP origins are permitted only in development/test configuration. Keep the production allowlist limited to the exact deployed HTTPS frontend origins.
- Production MongoDB connections must use TLS: `mongodb+srv://` uses TLS by default unless explicitly disabled, while `mongodb://` must include `tls=true` or `ssl=true`. Configuration rejects explicit non-true TLS options before the application starts. Keep local non-TLS MongoDB URIs confined to development/test.
- The frontend keeps the separate CSRF token in memory and sends X-CSRF-Token on state-changing calls. Never store session bearers in localStorage.
## Authorization
Deny by default. Require an active ADMIN and a server-side session check for protected endpoints. Future doctor/patient routes must authorize every operation server-side. Use explicit mutation allowlists; clients must not set roles, timestamps or audit fields.
## API and browser
Validate request types, lengths, formats and unknown fields. Use Helmet, exact CORS allowlists with credentials, body limits and request/header timeouts. Escape UI data and avoid unsafe HTML. Public errors must not expose stacks, database internals, credentials or patient details.
## Data and secrets
Use least-privilege DB credentials and restrict network access. Commit placeholders only. Bootstrap credentials must be injected temporarily and removed afterward. Redact passwords, tokens, database URIs and patient details from logs.
## Release gate
Auth/session/CSRF/invalid-credential/rate-limit tests pass; MongoDB integration verifies session persistence/revocation; dependency/config review is complete; cookies are verified on actual deployment domains. This checklist is not compliance certification.
