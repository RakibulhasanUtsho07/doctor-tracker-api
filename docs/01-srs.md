# Software Requirements Specification
## Purpose
Doctor Tracker is a secure admin web application for managing doctors and corresponding patients, with dashboard analytics and efficient record discovery.
## Actors and assumptions
Administrator: authenticated user allowed to manage records and dashboard. Unauthenticated visitors can access only explicitly public sign-in and health routes. The app is not an appointment, prescription, billing or clinical decision-support system.
## Functional requirements
- AUTH-01: secure sign-in; generic invalid-credential response and rate limiting.
- AUTH-02: dashboard, doctors, patients and data APIs are protected.
- AUTH-03: server enforces admin permissions for each operation.
- DOC-01: create doctor with name, specialization, hospital, phone and email.
- DOC-02: list/view doctors with search, date and relevant filters, and pagination.
- DOC-03: view associated patients, add patients under a doctor, remove patients from the doctor's list.
- PAT-01: dedicated paginated patient list; edit and delete patients.
- PAT-02: patient search, date filters and condition/relevant filters.
- DASH-01: total doctors, total patients, patients per doctor and date-based statistics.
- DASH-02: charts/graphs built from database-backed server aggregates.
- UX-01: clear dashboard/doctors/patients navigation and responsive desktop/mobile UI.
- DOCS-01: README elevator pitch, setup, .env.example, architecture/data flow, two technical decisions, and desktop/mobile screenshots.
- DEPLOY-01: separate frontend/backend deployment; submission includes repository links and live URLs.
## Non-functional requirements
Security: deny-by-default routes, validated data, secret management and negative tests.
Performance: indexed query patterns, bounded pagination and measured search/aggregate latency.
Reliability: consistent errors, health check and redacted operational logging.
Accessibility: keyboard navigation, visible focus, labels, sufficient contrast and reduced-motion support.
Maintainability: modular code, reusable UI, tests, README and ADRs.
Privacy: minimum necessary data, synthetic tests/demo and no patient details in logs.
## Recorded implementation decisions for the current scope
- Patient fields are limited to doctorId, name, optional condition and system timestamps, matching the existing API contract. No extra demographics, contact fields or clinical fields are added.
- The assignment supplies no controlled condition vocabulary. condition therefore remains bounded free text (maximum 100 characters), not an invented enumeration.
- A patient can be assigned to zero or one doctor. Removing from a doctor's list detaches the association and preserves the patient record; DELETE /patients/{patientId} permanently deletes the patient.
- Patient creation and reassignment validate that the target doctor exists. Doctor association changes and destructive mutations require an active admin session and CSRF token.
- Admin provisioning uses the existing one-time bootstrap flow; there is no public registration endpoint.

## Dashboard aggregation semantics
- GET /dashboard/summary reports current all-time doctor and patient totals, linked patient counts for every doctor (including zero counts), and daily doctor/patient creation counts.
- The optional from/to range uses inclusive UTC calendar dates, defaults to the last 30 UTC calendar days including today, rejects future dates, and is limited to 366 days. Daily results include zero-count days.
- Date-range filters affect only daily creation statistics, not all-time totals or current patient-to-doctor counts. Detached patients remain in total patients but are not counted under a doctor.
- Server-side MongoDB aggregates and projections are used; no full collections are sent to the browser.

The implementation does not infer a controlled clinical taxonomy or introduce features outside the assignment. Any future soft-delete/retention policy or controlled condition vocabulary needs an explicit product/privacy decision.
