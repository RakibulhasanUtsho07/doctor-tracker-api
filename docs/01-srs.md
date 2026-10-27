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
## Open decisions
Assignment does not specify exact patient fields/condition vocabulary, admin provisioning, hard-vs-soft delete, or whether removing a patient from a doctor's list means deleting the patient or detaching the relationship. Resolve these before implementation. Extra features require explicit approval.
