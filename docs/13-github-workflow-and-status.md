# GitHub Workflow and Project Status
## Repositories
API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api
Frontend: https://github.com/RakibulhasanUtsho07/doctor-tracker-frontend
## Branch policy
main = release; dev = integration; rakibul-hasan = working branch. Promotion is PR-only: rakibul-hasan → dev → verified release PR to main.
## Verified status (2026-10-27)
- Documentation baseline merged to dev in both repositories.
- Backend API Step 1 PRs [#7–#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pulls) are merged. [CI #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 tests and build.
- Backend API Step 2 PR [#11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11) is merged to dev at merge commit `62fb9b25bad3b2f13b20f6b73655a5ee11ab8ba1`. [CI #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed lint, typecheck, 15/15 HTTP/auth tests, 1/1 MongoDB session integration test and production build on tested PR head `1404b8fd8b6502a79c491dff2bb1782a9e0a7c7d`.
- Authentication/session baseline is verified. Doctor/patient CRUD and dashboard aggregation are not implemented.
- Frontend `app/page.tsx` remains the default Next.js starter; functional UI, API integration, tests and deployment are not verified complete.
## Progress
Documentation/workflow: merged to dev. API foundation Step 1: PASS. Auth/session Step 2: PASS. Doctor API: NOT STARTED. Patient API: NOT STARTED. Dashboard: NOT STARTED. Frontend features: NOT STARTED. Deployment: NOT STARTED.
## Next
Implement [Step 3 doctor schema/indexes/CRUD/search/filter/pagination](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/4), then patient and dashboard APIs. Develop frontend shell/screens against stable contracts; complete E2E/security/performance and deployment before release.
