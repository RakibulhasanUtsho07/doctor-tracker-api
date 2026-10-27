# Threat Model
## Assets and boundaries
Assets: admin credential hashes, sessions, doctor/patient records, database credentials and dashboard integrity. Boundaries: browser/API, public internet/hosting, API/MongoDB, developer/CI/source control and runtime secrets.
## Authentication threats and controls
- Credential abuse: generic failures, scrypt hashing, dummy hash for unknown accounts and login throttling. Throttling is per-process; use shared state before scaling horizontally.
- Session theft: random opaque cookie, HttpOnly, Secure in production, server-side expiry and hashed bearer storage; never expose bearer in JSON or localStorage.
- CSRF: unpredictable CSRF token returned in auth response and checked in a header for state-changing auth routes.
- Stale/disabled account: validate active status and role at every protected request; remove expired/invalid sessions.
- Unauthorized account creation: no public signup; one-time bootstrap refuses overwriting an existing admin.
- CORS/cookie mismatch: explicit origin allowlist with credentials; production SameSite=None/Secure; verify browser cookie behaviour under deployed domains.
- Database exposure: least-privilege access, password hashes excluded from normal user reads, session bearer stored hashed, sensitive logging avoided.
## Remaining threats
Account recovery/password reset, security audit events, distributed rate limiting, full dependency review and production cookie verification are not complete. Review whenever authentication, patient fields, APIs, hosting or third-party integrations change.
