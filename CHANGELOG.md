# Changelog

## Unreleased
- API Step 1 foundation merged to dev: validated runtime config, Express app, liveness, security headers, CORS allowlist, request IDs, JSON limit, HTTP timeouts and consistent error envelopes.
- API Step 1 PRs #7, #8 and #9 merged; [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 HTTP/config tests and build.
- API Step 2 admin authentication merged to dev via [PR #11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11); [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed lint, typecheck, 15/15 unit/HTTP tests, 1/1 MongoDB integration test and build.
- Step 3 doctor API merged to `dev` via [PR #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/13). [CI run #36](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40492089848) passed lint, typecheck, 18/18 HTTP/unit tests, 2/2 MongoDB integration tests and build on tested head `57554f0ad604acd9acf2e63bb7e6a1adeca5ae70`. The synthetic 300-record explain evidence reported `doctor_specialization_created_idx`, 20 documents examined/returned and 0 ms measured in CI.
- Patient CRUD, doctor-patient relationship handling, dashboard analytics, production-scale performance/SLO validation, broader security review, frontend implementation and deployment remain planned.
