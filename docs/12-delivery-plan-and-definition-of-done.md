# Delivery Plan and Definition of Done
| Step | Work package | Exit criteria | Status |
|---|---|---|---|
| 0 | Docs/workflow | Baseline docs and branch/PR rules in both repos | PASS — docs PRs merged to dev |
| 1 | API foundation | Config validation, Express bootstrap, health, errors, middleware, timeouts and tests | PASS — PRs #7–#9 merged; [CI #13 green](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393), 9/9 tests |
| 2 | Authentication | Secure admin login, session cookie, CSRF, active-admin checks, bootstrap, unit and MongoDB integration tests | PASS — [PR #11 merged](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11); [CI #28 green](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698), 15/15 unit tests + 1/1 MongoDB integration test |
| 3 | Doctor API | Schema/indexes, CRUD/search/filter/pagination tests | NOT STARTED — [issue #4](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/4) |
| 4 | Patient API | CRUD, relationship/deletion policy, filters and tests | NOT STARTED |
| 5 | Dashboard API | Server aggregates and reconciliation tests | NOT STARTED |
| 6 | Frontend shell | Responsive layout, navigation, tokens and accessible motion | NOT STARTED |
| 7 | Functional UI | Auth, charts and doctor/patient workflows integrated | NOT STARTED |
| 8 | Quality hardening | E2E/security/accessibility/performance evidence | NOT STARTED |
| 9 | Deployment | Live URLs, smoke test, README screenshots and release notes | NOT STARTED |
A step is done only when acceptance criteria and required automated checks pass, security/accessibility are reviewed, docs/traceability are updated, evidence is linked, and the PR is reviewed. Promote via rakibul-hasan → dev → main only after verification.
