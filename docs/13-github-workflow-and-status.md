# GitHub Workflow and Project Status
## Repositories
API: https://github.com/RakibulhasanUtsho07/doctor-tracker-api
Frontend: https://github.com/RakibulhasanUtsho07/doctor-tracker-frontend
## Branch policy
main is release, dev is integration, rakibul-hasan is the working branch. Promote via PRs only: rakibul-hasan → dev → tested PR to main. Each medium-sized work item gets an issue with requirement IDs, acceptance checklist, tests, dependencies and evidence links.
## Verified baseline (2026-10-27)
- Repository access verified.
- dev and rakibul-hasan branches created from main in both repositories.
- API package manifest contains Express/Mongoose; its test script is a placeholder that exits non-zero.
- Frontend app/page.tsx still contains default Next.js starter content.
- Engineering docs are being committed to rakibul-hasan.
- Feature tests, CI, auth, CRUD, analytics, security verification, performance and deployment are not verified complete.
## Progress
Documentation/workflow baseline: in progress. Implemented assignment features: 0% verified. Testing/CI: not configured or not verified. Deployment: not started; URLs not verified.
## Next work
1. Review documentation PR to dev.
2. Implement API foundation with env validation, health, middleware, error contract and tests.
3. Implement authentication/authorization.
4. Implement doctor API, patient API and dashboard aggregates in separate work items.
5. Build the frontend shell and functional screens against the API contract.
6. Run E2E/security/performance checks, deploy, verify URLs and record evidence.
