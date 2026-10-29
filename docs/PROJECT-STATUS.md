# Project Status
Last verified: 2026-10-30

## Vercel Express runtime incident — remediation candidate

Production Runtime Logs on 2026-10-30 reported: `Invalid export found in module "/var/task/src/app.js". The default export must be a function or server.` The API's `src/app.ts` exposed only the named `createApp()` factory, so Vercel's Express entrypoint discovery had no default application to invoke. The remediation candidate exports a default Express application, initializes its runtime configuration lazily, shares a retryable Mongoose connection initializer, and returns a sanitized `503 DATABASE_UNAVAILABLE` response when MongoDB cannot be reached. The liveness endpoint remains independent of MongoDB.

**Acceptance remains BLOCKED** until the candidate's exact-head API CI passes, a new Vercel Production deployment responds successfully at `/api/v1/health`, `/api/v1/ready` reports database readiness, and deployed frontend CORS/session-cookie acceptance succeeds. A Vercel deployment marked `Ready` alone is not runtime acceptance.

## Current scope decision — public signup removed (2026-10-29)

Initial administrator creation is operator-only through `pnpm bootstrap:admin`, with `ADMIN_EMAIL` and `ADMIN_PASSWORD` securely injected for the one-time command. Public `/auth/registration-status`, `/auth/register`, and browser `/signup` are not part of the product and are being removed from the current development scope. The durable initial-admin setup marker and guarded recovery command remain to protect CLI bootstrap from overwrite and concurrent claims. Login/session and doctor/patient/dashboard endpoints remain unchanged. No `main` branch is being updated by this work.

Older signup notes, if encountered in historical PRs or dated records, describe prior implementation only and do not represent current intended routes.

Last verified: 2026-10-27

## Completed and merged to dev
- Documentation baseline merged via [PR #1](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/1).
- API Step 1 foundation merged via [PRs #7–#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pulls). [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 tests and build.
- API Step 2 authentication merged via [PR #11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11). [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed source hygiene lint, TypeScript typecheck, 15/15 HTTP/auth unit tests, 1/1 MongoDB-backed session integration test and production build. Tested PR head: `1404b8fd8b6502a79c491dff2bb1782a9e0a7c7d`; merge commit: `62fb9b25bad3b2f13b20f6b73655a5ee11ab8ba1`.
- API Step 3 Doctor CRUD/search/filter/pagination merged via [PR #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/13). [CI run #36](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40492089848) passed lint, typecheck, 18/18 HTTP/unit tests, 2/2 MongoDB integration tests and production build on tested head `57554f0ad604acd9acf2e63bb7e6a1adeca5ae70`; merge commit: `afea5abf74689abc025579ae7b5707f2337dda42`.
- API Step 4 Patient CRUD/filters/relationship semantics merged via [PR #15](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/15). [CI run #42](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40493600732) passed lint, typecheck, 21/21 HTTP/unit tests, 3/3 MongoDB integration tests and production build on tested head `feeaf432337dfad0d8544dab4f78c9d83a4204eb`; merge commit: `f29963ecb769e702c27c734233ad6c63ad117e7e`.
- API Step 5 Dashboard aggregation merged via [PR #17](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/17). [CI run #50](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40494982241) passed lint, typecheck, 24/24 HTTP/unit tests, 4/4 MongoDB integration tests and production build on tested head `f03dfd18a16f0b5d3ccbe0f18b443524880a1619`; merge commit: `fd9f133b42914a51d3a4d0460e178a66888a0327`.

## Implemented
- Step 1: validated configuration; Express bootstrap; `GET /api/v1/health` liveness; Helmet; exact CORS allowlist; request IDs; 100kb JSON limit; HTTP timeouts; stable error envelopes; CI.
- Step 2: MongoDB User/AuthSession models; scrypt password hashing; one-time admin bootstrap; login/me/logout; opaque HttpOnly session cookies; eight-hour expiry; session revocation; CSRF validation; generic credential errors; login rate limit; MongoDB readiness endpoint.
- Step 3: strict Doctor model; unique normalized email; query-shaped indexes; protected create/detail/update/list; CSRF-protected writes; prefix search; specialization/hospital and UTC date filters; bounded pagination; OpenAPI and contract update; synthetic explain-plan verification.
- Step 4: minimal Patient model (`doctorId`, `name`, optional free-text `condition`), reference checks, protected patient CRUD/list filters, doctor-associated patient listing, CSRF-protected detach/delete/reassignment, explicit detach-versus-delete behavior, patient indexes and synthetic query-plan evidence.
- Step 5: session-protected dashboard summary with all-time totals, linked patients per doctor, inclusive UTC date filters, a zero-filled daily creation series, a 366-day range cap, server-side aggregations, and explain-plan evidence for date and patient lookup indexes.

## Known limitations
- Login rate limiting is per process; shared storage is required before multi-instance scaling.
- Production cross-origin cookie delivery must be verified in target browsers; unrelated Vercel/Render hostnames can trigger third-party-cookie restrictions.
- The source hygiene lint is a small repository guard, not a full ESLint replacement.
- No password recovery. Dashboard API exists; frontend screens, production-scale performance/SLO and deployment remain unverified. Patient `condition` remains free text until product requirements specify a taxonomy.
- The doctor query-plan measurement is from 300 synthetic records in CI, not a production-scale benchmark or SLO. Login throttling remains per-process and production cookie delivery still requires browser verification.

## Current progress
- Documentation/workflow baseline: PASS, merged to dev.
- API foundation Step 1: PASS, merged to dev.
- Admin authentication/session foundation Step 2: PASS, merged to dev.
- Doctor schema/CRUD/search/filter/pagination: PASS, merged to dev via PR #13.
- Patient schema/CRUD/filtering and doctor relationship semantics: PASS, merged to dev via PR #15.
- Dashboard summary/statistics: PASS, merged to dev via PR #17.
- Frontend functional UI: NOT STARTED; the reviewed starter page still needs its planned shell/screens.
- Broader security, E2E, performance and deployment acceptance: NOT STARTED.

## Next task
[Step 6 — responsive frontend shell and accessible motion](https://github.com/RakibulhasanUtsho07/doctor-tracker-frontend/issues/2).
