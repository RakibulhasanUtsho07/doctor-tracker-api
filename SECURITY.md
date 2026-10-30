# Security Policy
Doctor Tracker contains doctor records and sensitive patient-related information. Use synthetic data for development, tests, screenshots and issues.
## Required controls
- Server-side authentication and authorization for every protected request.
- Validate types, lengths, enums, dates, filters and pagination; reject unknown mutation fields.
- Use maintained password hashing, generic login failures and rate limits.
- Define secure session/token lifecycle; never keep long-lived credentials in localStorage. If cookies authenticate state-changing calls, implement CSRF protection.
- Use TLS in deployment, restrictive CORS, security headers, request-size limits and rate limits.
- Store real secrets only in hosting secret stores. Use placeholders in .env.example.
- Redact credentials, tokens, connection strings and patient details from logs.
- Test unauthenticated access, object-level access, injection, mass assignment, excessive data exposure and throttling.
Report suspected vulnerabilities privately through GitHub private vulnerability reporting if enabled, or directly to the maintainer. Do not publish personal data or live exploit details. This policy is not a compliance certification.
