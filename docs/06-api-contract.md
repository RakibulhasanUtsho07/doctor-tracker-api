# REST API Contract
Base path proposed: /api/v1. Keep api/openapi.yaml aligned with actual implementation.
## Planned routes
GET /health; POST /auth/login; POST /auth/logout; GET /auth/me; GET /dashboard/summary.
Doctors: GET /doctors with search/filter/page; POST /doctors; GET/PATCH /doctors/{doctorId}; GET /doctors/{doctorId}/patients.
Patients: GET/POST /patients; GET/PATCH/DELETE /patients/{patientId}. Agree relationship-removal semantics before adding a destructive endpoint.
## Rules
Bound and validate page/limit, search, dates, condition and doctor filters. Allowlist sorts and reject unknown mutation fields. Use stable success envelopes; list responses include pagination metadata. Error envelope should contain safe code/message and requestId. Do not expose stack traces or database internals.
## Status codes
200 read/update; 201 create; 204 no-content delete/logout; 400 malformed input; 401 unauthenticated; 403 unauthorized; 404 missing/hidden; 409 conflict; 422 semantic error if used consistently; 429 throttled; 500 generic internal error.
All protected routes require server-side authentication and role checks. Contract is planning, not implementation evidence.
