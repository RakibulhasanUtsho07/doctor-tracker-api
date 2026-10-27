# Traceability and Acceptance
Statuses: NOT STARTED, IN PROGRESS, PASS, FAIL, PARTIAL, BLOCKED. PASS requires evidence tied to the exact tested commit.
| Requirement / work item | Evidence required | Status |
|---|---|---|
| Documentation baseline | SRS/security/database/API/UI/QA/ops docs reviewed and PR merged | PASS — API PR #1 merged to dev |
| API foundation; baseline portion of NFR-REL-01 | Config validation, health, CORS/security headers, request IDs, body limit, timeouts, error envelope; [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) on `f2ddcd4c6ecabde37bca71a689f94758d2eb9614` | PASS — lint, typecheck, 9/9 tests, build; PRs #7–#9 merged to dev |
| AUTH-01..03 | Login/session, protected routes and cross-record negative tests | NOT STARTED |
| DOC-01..03 | Doctor CRUD/search/filter/pagination integration tests | NOT STARTED |
| PAT-01..02 | Patient CRUD, filters, relationship and deletion tests | NOT STARTED |
| DASH-01..02 | Aggregate reconciliation tests with synthetic fixtures | NOT STARTED |
| UX-01 / NFR-A11Y-01 | Responsive, keyboard, reduced-motion and screenshot evidence | NOT STARTED |
| Full NFR-SEC-01 | Security negative tests, configuration review and dependency assessment | NOT STARTED |
| NFR-PERF-01 | Explain plans and measured benchmark | NOT STARTED |
| README requirements | Setup, .env.example, architecture, two technical decisions and screenshots | PARTIAL — baseline setup exists; screenshots and decisions evidence remain |
| Deployment | Live HTTPS frontend/API URLs and smoke evidence | NOT STARTED |
## Evidence record template
Requirement IDs, commit/PR, CI link and commit SHA, commands and pass/fail counts, manual/browser evidence, open limitations, reviewer/date. Presence of code alone is not acceptance evidence.