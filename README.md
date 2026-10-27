# Doctor Tracker API

Secure REST API for the Doctor Tracker assignment. Stack: Node.js, Express 5, TypeScript, Mongoose and MongoDB.

## Verified milestones
- Step 1 API foundation is merged to `dev` via [PRs #7–#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pulls). [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 tests and build.
- Step 2 admin authentication is merged to `dev` via [PR #11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11). [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed lint, typecheck, 15/15 HTTP/auth tests, 1/1 MongoDB-backed session integration test and production build.
- Step 3 Doctor API merged to `dev` via [PR #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/13). [CI run #36](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40492089848) passed lint, typecheck, 18/18 HTTP/unit tests, 2/2 MongoDB integration tests and production build on tested head `57554f0ad604acd9acf2e63bb7e6a1adeca5ae70`.
- Step 4 Patient API merged to `dev` via [PR #15](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/15). [CI run #42](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40493600732) passed lint, typecheck, 21/21 HTTP/unit tests, 3/3 MongoDB integration tests and production build on tested head `feeaf432337dfad0d8544dab4f78c9d83a4204eb`.
- Step 5 dashboard aggregation merged to `dev` via [PR #17](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/17). [CI run #50](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40494982241) passed lint, typecheck, 24/24 HTTP/unit tests, 4/4 MongoDB integration tests and build on tested head `f03dfd18a16f0b5d3ccbe0f18b443524880a1619`.
- Frontend functional UI is not implemented yet.

## Requirements
- Node.js 22+
- pnpm 11.x
- Local/disposable MongoDB
- Exact frontend origin(s) in `FRONTEND_ORIGINS`

## Local setup
```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```
PowerShell: `Copy-Item .env.example .env`. Configure MongoDB locally; the server fails closed if the database cannot be reached. Never commit `.env` or real secrets.

## Create the first administrator
There is no public registration endpoint and no default password. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (14–128 characters) through a secure one-time environment injection, then run:
```bash
pnpm bootstrap:admin
```
The command refuses to overwrite an existing account. Remove the two bootstrap variables immediately afterwards; they are not runtime settings. Never put real credentials into source files, PRs or issue comments.

## Implemented API routes
- `GET /api/v1/health` — process liveness.
- `GET /api/v1/ready` — MongoDB readiness.
- `POST /api/v1/auth/login` — verifies an admin and sets an opaque HttpOnly session cookie; returns the CSRF token in JSON.
- `GET /api/v1/auth/me` — returns the active admin and CSRF token for page reload.
- `POST /api/v1/auth/logout` — requires the session cookie and `X-CSRF-Token`; revokes the session and clears the cookie.
- `GET /api/v1/doctors` — admin-only search, specialization/hospital filters, UTC date filters and bounded pagination.
- `POST /api/v1/doctors` — admin-only create; requires CSRF and enforces normalized-email uniqueness.
- `GET /api/v1/doctors/:doctorId` — admin-only detail.
- `PATCH /api/v1/doctors/:doctorId` — admin-only allowlisted partial update; requires CSRF.
- `GET /api/v1/doctors/:doctorId/patients` — paginated patients associated with a doctor.
- `DELETE /api/v1/doctors/:doctorId/patients/:patientId` — CSRF-protected detach; preserves the patient record.
- `GET /api/v1/patients` — paginated patient search/filter list.
- `POST /api/v1/patients` — create patient under an existing doctor; CSRF-protected.
- `GET /api/v1/patients/:patientId` — patient detail.
- `PATCH /api/v1/patients/:patientId` — CSRF-protected edit/reassign to an existing doctor.
- `DELETE /api/v1/patients/:patientId` — CSRF-protected permanent delete.
- `GET /api/v1/dashboard/summary` — admin-only all-time totals, current linked patients per doctor, and daily UTC creation counts. Optional `from`/`to` dates are inclusive; default last 30 UTC days, max 366 days.

Browser requests must use credentials (e.g. `fetch(url, { credentials: "include" })`). Keep the CSRF token in application memory and send it as `X-CSRF-Token` for state-changing operations. Never put the session bearer in localStorage.

## Session and deployment notes
Sessions live in MongoDB; only a SHA-256 digest of the random session bearer is stored. Sessions last 8 hours, are checked on each protected auth request and can be revoked at logout. Passwords use Node's scrypt with a random salt and 64-byte derived key. Login throttling is currently per API process; use a shared rate-limit store before deploying multiple API replicas.

Development cookies use `SameSite=Strict`; production cookies use `Secure; SameSite=None` for cross-origin UI/API requests. Browsers can block third-party cookies when Vercel and Render hostnames are unrelated sites. Prefer related custom domains under the same registrable domain and verify cookie delivery in target browsers before release. Set exact production origins in `FRONTEND_ORIGINS`.

## Commands
- `pnpm dev` — watch-mode server.
- `pnpm lint` — repository source-hygiene check; this is not a full ESLint replacement.
- `pnpm typecheck` — checks source, tests and scripts.
- `pnpm test` — HTTP/config/auth/doctor/patient/dashboard tests using fake repositories (24 tests at Step 5 acceptance).
- `pnpm test:integration` — MongoDB-backed auth/session, doctor, patient and dashboard API tests. Synthetic tests seed 300 doctors, 150 patients, plus isolated dashboard fixtures (303 doctors/154 patients) and emit query-plan evidence; requires a disposable DB whose name contains `test`.
- `pnpm build` — production compile.
- `pnpm check` — lint, typecheck, unit tests and build.

## Engineering documents
- [SRS](docs/01-srs.md) · [Architecture](docs/02-architecture.md) · [Security](docs/03-security-engineering.md) · [Threat Model](docs/04-threat-model.md)
- [Database](docs/05-database-engineering.md) · [API contract](docs/06-api-contract.md) · [OpenAPI](api/openapi.yaml)
- [Status](docs/PROJECT-STATUS.md) · [Roadmap](docs/ROADMAP.md) · [Traceability](docs/11-traceability-and-acceptance.md)
