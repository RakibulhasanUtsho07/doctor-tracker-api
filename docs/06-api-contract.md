# REST API Contract
Base path: `/api/v1`. Keep `api/openapi.yaml` synchronized with implementation.
## Health and authentication
- `GET /health`: liveness only.
- `GET /ready`: 200 only when MongoDB is connected; otherwise 503.
- `POST /auth/login`: accepts only email/password. Uses a generic 401 for incorrect credentials and returns a session cookie plus CSRF token.
- `GET /auth/me`: requires the session cookie and returns the current active admin, CSRF token and session expiry.
- `POST /auth/logout`: requires the session cookie and matching `X-CSRF-Token`; revokes the server-side session and clears the cookie.
The browser must use credentialed fetch requests. Development cookie is `dt_session`; production cookie is `__Host-dt_session`. Do not store the bearer session token in localStorage.
## Planned domain routes
Dashboard: GET /dashboard/summary.
Doctors: GET /doctors with search/filter/page; POST /doctors; GET/PATCH /doctors/{doctorId}; GET /doctors/{doctorId}/patients.
Patients: GET/POST /patients; GET/PATCH/DELETE /patients/{patientId}. Agree relationship-removal semantics before implementing destructive endpoints.
## Rules
Bound and validate page/limit, search, dates, condition and doctor filters. Allowlist sorts and reject unknown mutation fields. Use stable success envelopes; list responses include pagination metadata. Error envelope: safe code/message and requestId, no stacks or database internals.
## Status codes
200 read/update/authenticated; 201 create; 204 no-content delete/logout; 400 malformed input; 401 unauthenticated or invalid credentials; 403 unauthorized/CSRF failed; 404 missing/hidden; 409 conflict; 422 semantic error if adopted consistently; 429 throttled; 500 generic internal error; 503 not ready.
The documented domain endpoints remain planned until implemented and tested.
