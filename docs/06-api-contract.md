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

## Implemented dashboard route
- GET /dashboard/summary: admin-only database-backed aggregates. Query accepts only from/to dates in YYYY-MM-DD form. Both are inclusive UTC calendar days; omitted range defaults to the latest 30 UTC calendar days including today. A range is at most 366 days, future days are rejected, and all days are returned even when their counts are zero.
- data.totals.doctors and data.totals.patients are all-time current record totals, independent of the selected date range.
- data.patientsPerDoctor includes every doctor (including zero-count doctors) and counts only currently associated patient records. Detached patients still count toward total patients but not toward any doctor.
- data.dateStatistics contains one daily bucket per requested UTC day; doctorsCreated and patientsCreated count records by createdAt.

## Implemented patient and doctor relationship routes
All patient and doctor-patient endpoints require an active administrator session. POST, PATCH and DELETE requests require the matching X-CSRF-Token.
- GET /patients: paginated patient list; supports search, doctorId, condition, from/to, page and limit.
- POST /patients: create a patient under an existing doctor; doctorId and name are required, condition is optional.
- GET /patients/{patientId}: read one patient.
- PATCH /patients/{patientId}: update name/condition or move the patient to another existing doctor.
- DELETE /patients/{patientId}: permanently delete the patient record.
- GET /doctors/{doctorId}/patients: list only the patients associated with an existing doctor, with the same supported filters except doctorId is taken from the path.
- DELETE /doctors/{doctorId}/patients/{patientId}: detach the patient from that doctor by setting doctorId to null; patient record and its other fields remain.

Patient field decision: the schema is intentionally limited to doctorId, name and optional condition, plus timestamps. No condition taxonomy was specified, so condition is bounded free text rather than an invented enum. No extra patient PII fields are added. A patient can be assigned to at most one doctor at a time; creating or reassigning validates the doctor reference. Detaching preserves the patient, while explicit patient DELETE is destructive.

Patient list query rules:
- search: case-insensitive escaped literal prefix across name and condition.
- doctorId: a 24-hex-character doctor identifier.
- condition: exact normalized free-text filter up to 100 characters.
- from/to: real YYYY-MM-DD UTC calendar days applied inclusively to createdAt.
- page defaults to 1 and limit defaults to 20; limit is 1–100 and offsets above 100,000 are rejected.
Responses include requestId and pagination metadata; response payloads omit normalized internal fields. Patient details are not logged.

## Status codes
200 read/update/authenticated; 201 create; 204 no-content delete/logout/detach; 400 malformed or invalid input; 401 unauthenticated or invalid credentials; 403 disallowed origin/authorization/CSRF failure; 404 missing patient/doctor; 409 duplicate doctor email; 429 throttled; 500 generic internal error; 503 not ready.
