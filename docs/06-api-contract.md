# REST API Contract
Base path: /api/v1. Keep api/openapi.yaml synchronized with implementation.

## Health and authentication
- GET /health: liveness only.
- GET /ready: 200 only when MongoDB is connected; otherwise 503.
- POST /auth/login: accepts only email/password. Uses a generic 401 for incorrect credentials and returns a session cookie plus CSRF token.
- GET /auth/me: requires the session cookie and returns the current active admin, CSRF token and session expiry.
- POST /auth/logout: requires the session cookie and matching X-CSRF-Token; revokes the server-side session and clears the cookie.
The browser must use credentialed fetch requests. Development cookie is dt_session; production cookie is __Host-dt_session. Do not store the bearer session token in localStorage.

## Implemented doctor routes
Every doctor endpoint requires an active administrator session. POST and PATCH also require the matching X-CSRF-Token.
- GET /doctors: search and list doctors, with pagination metadata at meta.pagination.
- POST /doctors: create a doctor.
- GET /doctors/{doctorId}: read one doctor.
- PATCH /doctors/{doctorId}: update only the submitted doctor fields.

Doctor fields: name (2–120 characters), specialization (2–120), hospital (2–160), phone (5–30) and email (valid email up to 254 characters). Unknown fields are rejected. Normalized email is unique case-insensitively; duplicate create/update returns 409. Phone numbers are not unique.

List query parameters:
- search: 1–100 characters; case-insensitive literal prefix search across name, specialization, hospital and email. Regex metacharacters are escaped.
- specialization: exact case-insensitive normalized filter, maximum 100 characters.
- hospital: exact case-insensitive normalized filter, maximum 160 characters.
- from, to: real YYYY-MM-DD UTC dates applied inclusively to the record's createdAt. If both are supplied, from must not be after to.
- page: integer starting at 1, default 1.
- limit: integer from 1 to 100, default 20. Deep page offsets above 100,000 are rejected.

List responses are stable-sorted by createdAt descending then _id descending and include page, limit, total, and totalPages. The response never exposes normalized internal fields.

## Planned domain routes
Dashboard: GET /dashboard/summary.
Doctors: GET /doctors/{doctorId}/patients.
Patients: GET/POST /patients; GET/PATCH/DELETE /patients/{patientId}. Agree relationship-removal semantics before implementing destructive endpoints.

## Rules and status codes
Use stable success envelopes: list data is data.doctors; create/detail/update is data.doctor; metadata contains requestId and, for lists, pagination. Error envelope contains a safe code/message and requestId, never stacks or database internals.
200 read/update/authenticated; 201 create; 204 no-content delete/logout; 400 malformed/invalid input; 401 unauthenticated or invalid credentials; 403 disallowed origin/authorization/CSRF failure; 404 missing; 409 duplicate doctor email; 422 only if adopted consistently; 429 throttled; 500 generic internal error; 503 not ready.
