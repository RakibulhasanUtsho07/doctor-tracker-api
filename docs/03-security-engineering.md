# Security Engineering Standard
## Identity and sessions
Use maintained password hashing and no hard-coded admin password. Use generic login failures and rate limits. Define admin provisioning and recovery before release. If JWTs are used, validate signature, algorithm allowlist, expiry, issuer and audience. Define logout, revocation and secret rotation.
## Authorization
Deny by default. Protect each non-public route and require admin authorization for management calls. Enforce resource access on the server. Use explicit mutation DTOs; clients must not set roles, timestamps or audit fields.
## API and browser
Validate format, length, enum, date range, query, and page limits. Never pass raw client objects to MongoDB. Use Helmet, restrictive CORS, body/time limits, and appropriate rate limits. Escape UI text; avoid unsafe HTML. Public errors must not expose stack traces or database internals.
## Data and secrets
Use least-privilege DB credentials and restrict network access. Commit placeholders only; ignore real environment files. Use synthetic test data. Redact passwords, tokens, database URIs and patient details from logs. Define backup encryption, retention and restore checks.
## Release gate
Authentication and cross-record negative tests pass, dependency review is complete, no unaccepted critical/high issue remains, and deployed secrets/config are reviewed. Documentation alone does not implement a control.
