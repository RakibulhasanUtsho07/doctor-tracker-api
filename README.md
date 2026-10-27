# Doctor Tracker API

Secure REST API for the Doctor Tracker assignment. Stack: Node.js, Express 5, TypeScript, Mongoose and MongoDB.

## Verified milestones
- Step 1 API foundation is merged to `dev` via [PRs #7–#9](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pulls). [CI run #13](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40477435393) passed source hygiene lint, typecheck, 9/9 tests and build.
- Step 2 admin authentication is merged to `dev` via [PR #11](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/pull/11). [CI run #28](https://github.com/RakibulhasanUtsho07/doctor-tracker-api/actions/runs/40479777698) passed lint, typecheck, 15/15 HTTP/auth tests, 1/1 MongoDB-backed session integration test and production build.
- Doctor/patient CRUD and dashboard analytics are not implemented yet.

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

Browser requests must use credentials (e.g. `fetch(url, { credentials: "include" })`). Keep the CSRF token in application memory and send it as `X-CSRF-Token` for state-changing operations. Never put the session bearer in localStorage.

## Session and deployment notes
Sessions live in MongoDB; only a SHA-256 digest of the random session bearer is stored. Sessions last 8 hours, are checked on each protected auth request and can be revoked at logout. Passwords use Node's scrypt with a random salt and 64-byte derived key. Login throttling is currently per API process; use a shared rate-limit store before deploying multiple API replicas.

Development cookies use `SameSite=Strict`; production cookies use `Secure; SameSite=None` for cross-origin UI/API requests. Browsers can block third-party cookies when Vercel and Render hostnames are unrelated sites. Prefer related custom domains under the same registrable domain and verify cookie delivery in target browsers before release. Set exact production origins in `FRONTEND_ORIGINS`.

## Commands
- `pnpm dev` — watch-mode server.
- `pnpm lint` — repository source-hygiene check; this is not a full ESLint replacement.
- `pnpm typecheck` — checks source, tests and scripts.
- `pnpm test` — HTTP/config/auth tests using a fake repository.
- `pnpm test:integration` — MongoDB-backed authentication/session test (requires a disposable DB whose name contains `test`).
- `pnpm build` — production compile.
- `pnpm check` — lint, typecheck, unit tests and build.

## Engineering documents
- [SRS](docs/01-srs.md) · [Architecture](docs/02-architecture.md) · [Security](docs/03-security-engineering.md) · [Threat Model](docs/04-threat-model.md)
- [Database](docs/05-database-engineering.md) · [API contract](docs/06-api-contract.md) · [OpenAPI](api/openapi.yaml)
- [Status](docs/PROJECT-STATUS.md) · [Roadmap](docs/ROADMAP.md) · [Traceability](docs/11-traceability-and-acceptance.md)
