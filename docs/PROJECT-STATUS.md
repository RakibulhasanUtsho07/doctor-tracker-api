# Project Status
Last verified: 2026-10-27

## Completed and merged to dev
- Documentation baseline merged via [PR #1](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/1).
- API Step 1 foundation merged via [PRs #7–#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pulls). [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 tests and build.
- API Step 2 authentication merged via [PR #11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11). [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed source hygiene lint, TypeScript typecheck, 15/15 HTTP/auth unit tests, 1/1 MongoDB-backed session integration test and production build. Tested PR head: `1404b8fd8b6502a79c491dff2bb1782a9e0a7c7d`; merge commit: `62fb9b25bad3b2f13b20f6b73655a5ee11ab8ba1`.
- API Step 3 Doctor CRUD/search/filter/pagination merged via [PR #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/13). [CI run #36](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40492089848) passed lint, typecheck, 18/18 HTTP/unit tests, 2/2 MongoDB integration tests and production build on tested head `57554f0ad604acd9acf2e63bb7e6a1adeca5ae70`; merge commit: `afea5abf74689abc025579ae7b5707f2337dda42`.

## Implemented
- Step 1: validated configuration; Express bootstrap; `GET /api/v1/health` liveness; Helmet; exact CORS allowlist; request IDs; 100kb JSON limit; HTTP timeouts; stable error envelopes; CI.
- Step 2: MongoDB User/AuthSession models; scrypt password hashing; one-time admin bootstrap; login/me/logout; opaque HttpOnly session cookies; eight-hour expiry; session revocation; CSRF validation; generic credential errors; login rate limit; MongoDB readiness endpoint.
- Step 3: strict Doctor model; unique normalized email; query-shaped indexes; protected create/detail/update/list; CSRF-protected writes; prefix search; specialization/hospital and UTC date filters; bounded pagination; OpenAPI and contract update; synthetic explain-plan verification.

## Known limitations
- Login rate limiting is per process; shared storage is required before multi-instance scaling.
- Production cross-origin cookie delivery must be verified in target browsers; unrelated Vercel/Render hostnames can trigger third-party-cookie restrictions.
- The source hygiene lint is a small repository guard, not a full ESLint replacement.
- No password recovery, patient CRUD, doctor-patient relationship endpoint or dashboard analytics yet.
- The doctor query-plan measurement is from 300 synthetic records in CI, not a production-scale benchmark or SLO. Login throttling remains per-process and production cookie delivery still requires browser verification.

## Current progress
- Documentation/workflow baseline: PASS, merged to dev.
- API foundation Step 1: PASS, merged to dev.
- Admin authentication/session foundation Step 2: PASS, merged to dev.
- Doctor schema/CRUD/search/filter/pagination: PASS, merged to dev via PR #13.
- Patient API: NOT STARTED.
- Dashboard API: NOT STARTED.
- Frontend functional UI: NOT STARTED; the reviewed starter page still needs its planned shell/screens.
- Broader security, E2E, performance and deployment acceptance: NOT STARTED.

## Next task
[Step 4 — patient CRUD, filters and doctor relationship/deletion semantics](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/issues/5).
