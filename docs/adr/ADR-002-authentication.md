# ADR-002: Administrator authentication and sessions

- Status: Accepted and implemented in API PR #11; CI run #28 passed.
- Context: The assignment requires secure login and protected routes but does not prescribe the mechanism or initial-admin provisioning.
- Decision:
  - Hash passwords with Node.js scrypt using a random 16-byte salt, N=32768, r=8, p=1 and a 64-byte derived key. Enforce 14–128 characters during administrator provisioning.
  - Use random opaque 256-bit session bearers in HttpOnly cookies; store only SHA-256 digests in MongoDB. Sessions expire after 8 hours and can be revoked at logout.
  - Use HttpOnly, Path=/ cookies, Strict SameSite in development and Secure/SameSite=None in production. Production uses a __Host-prefixed cookie with no Domain attribute.
  - Return a separate random CSRF token in the auth JSON response; require X-CSRF-Token for logout and future state-changing routes.
  - Deny unauthenticated access by default. No public signup. Provision the first administrator via a one-time command and strong injected environment variables.
  - Limit login attempts to five per 15-minute window per observed client IP. The limiter is per process; a shared store is required before multi-instance scaling.
- Consequences: Sessions are server-side and revocable, so MongoDB is required at runtime. Frontend requests must include credentials. Cross-site cookie restrictions differ by browser; production should prefer related custom domains and test actual cookie delivery.
- Alternatives: Browser-persisted bearer tokens were rejected to avoid storing a long-lived session secret in localStorage. Public registration was rejected because this assignment is an admin tracker.
