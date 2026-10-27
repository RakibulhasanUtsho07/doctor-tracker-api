# Traceability and Acceptance
Statuses: NOT STARTED, IN PROGRESS, PASS, FAIL, PARTIAL, BLOCKED. PASS requires evidence tied to the exact tested commit.
| Requirement / work item | Evidence required | Status |
|---|---|---|
| Documentation baseline | SRS/security/database/API/UI/QA/ops docs reviewed and PR merged | PASS — API PR #1 merged to dev |
| API foundation; baseline portion of NFR-REL-01 | Config validation, health, CORS/security headers, request IDs, body limit, timeouts, error envelope; [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) on `f2ddcd4c6ecabde37bca71a689f94758d2eb9614` | PASS — lint, typecheck, 9/9 tests, build; PRs #7–#9 merged to dev |
| AUTH-01 login and session lifecycle | Generic invalid credentials; scrypt hashes; session creation/lookup/revocation; expiry; login throttle; [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) on tested PR head `1404b8fd8b6502a79c491dff2bb1782a9e0a7c7d` | PASS — 15/15 unit/HTTP tests and 1/1 MongoDB integration test; PR #11 merged to dev |
| AUTH-02..03 protection of all domain routes | Server-side active-admin/session check and CSRF middleware exist; direct-route/role/object-level negative tests for doctor/patient/dashboard routes | PARTIAL — domain routes are not implemented yet, so per-resource authorization remains to be verified with issues #4–#6 |
| DOC-01..03 | Doctor CRUD/search/filter/pagination integration tests | NOT STARTED |
| PAT-01..02 | Patient CRUD, filters, relationship and deletion tests | NOT STARTED |
| DASH-01..02 | Aggregate reconciliation tests with synthetic fixtures | NOT STARTED |
| UX-01 / NFR-A11Y-01 | Responsive, keyboard, reduced-motion and screenshot evidence | NOT STARTED |
| Full NFR-SEC-01 | Negative tests, configuration review, dependency assessment and deployed cookie verification | PARTIAL — auth controls baseline tested; broader security/release review remains |
| NFR-PERF-01 | Explain plans and measured benchmark | NOT STARTED |
| README requirements | Setup, .env.example, architecture, two technical decisions and screenshots | PARTIAL — setup/docs exist; finished UI screenshots remain |
| Deployment | Live HTTPS frontend/API URLs and smoke evidence | NOT STARTED |
## Evidence record template
Requirement IDs, commit/PR, CI link and commit SHA, commands and pass/fail counts, manual/browser evidence, open limitations, reviewer/date. Presence of code alone is not acceptance evidence.
