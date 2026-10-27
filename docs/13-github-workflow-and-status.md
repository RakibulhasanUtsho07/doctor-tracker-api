# GitHub Workflow and Project Status
## Repositories
API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api
Frontend: https://github.com/RakibulhasanUtsho07/doctor-tracker-frontend
## Branch policy
main = release; dev = integration; rakibul-hasan = working branch. Promote via PR only: rakibul-hasan → dev → verified release PR to main. Each medium-sized work item gets an issue with requirement IDs, acceptance checklist, tests, dependencies and evidence.
## Current GitHub records
- Documentation PR #1 (draft, open): https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/1
- Immediate next task, Step 1 API foundation: https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/2
- Step 2 authentication: https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/3
- Step 3 doctor API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/4
- Step 4 patient API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/5
- Step 5 dashboard aggregation: https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/6
## Verified baseline (2026-10-27)
- dev and rakibul-hasan were created from main in both repos.
- API manifest contains Express/Mongoose; test script remains a placeholder that exits non-zero.
- Docs are committed on rakibul-hasan; documentation PR is open and not merged.
- Auth, CRUD, analytics, security verification, automated CI, performance and deployment are not verified complete.
## Progress
Documentation baseline: committed to work branch; review pending. Assignment feature implementation: 0% verified. Test/CI status: not configured or not verified. Deployment: not started; live URLs not verified.
## Next
1. Review documentation PR #1 and incorporate feedback.
2. Complete issue #2: config validation, health, central errors, security middleware and tests.
3. Implement authentication, doctor API, patient API and dashboard in separate issues, with evidence before promotion.
4. Integrate frontend, run E2E/security/performance, deploy and verify release URLs.
