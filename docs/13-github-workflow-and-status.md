# GitHub Workflow and Project Status
## Repositories
API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api
Frontend: https://github.com/RakibulhasanUtsho07/doctor-tracker-frontend
## Branch policy
main = release; dev = integration; rakibul-hasan = working branch. Promotion is PR-only: rakibul-hasan → dev → tested release PR to main.
## Verified status (2026-10-27)
- Documentation baseline merged to dev in both repositories.
- Backend API Step 1 PRs [#7](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/7), [#8](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/8), and [#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/9) are merged to dev.
- [API CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 HTTP/config tests and production build on `f2ddcd4c6ecabde37bca71a689f94758d2eb9614`.
- API test baseline is runnable. Current tests cover configuration, health, security headers, CORS, error envelopes, malformed JSON and body limit; they do not cover auth or database CRUD.
- Authentication, doctor/patient CRUD, dashboard aggregates, full security/performance testing and deployment remain incomplete.
- Frontend functional implementation remains NOT STARTED; the starter page still needs the planned shell/screens.
## Progress
Documentation and workflow: merged to dev. API foundation: Step 1 PASS on dev. Core product features: NOT STARTED. Frontend: NOT STARTED. Deployment: NOT STARTED.
## Next
Implement [Step 2 authentication/authorization](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/3), then doctor API, patient API and dashboard aggregation. Implement the frontend after backend contracts stabilize; complete E2E/security/performance and deployment before release.