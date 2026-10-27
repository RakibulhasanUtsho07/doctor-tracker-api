# Doctor Tracker API

Secure REST API for the Doctor Tracker assignment. Stack: Node.js, Express 5, TypeScript, Mongoose and MongoDB.

## Current scope
Step 1 established config validation, Express security middleware, health checks, request IDs, error envelopes, request timeouts and CI. Step 2 adds database-backed administrator sessions, password hashing, login/logout/current-user, CSRF validation, login throttling and one-time administrator bootstrap. Doctor/patient CRUD and dashboard analytics remain future steps.

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
PowerShell: `Copy-Item .env.example .env`. Configure the MongoDB URI locally; the server will fail closed if the database cannot be reached. Do not commit `.env` or real secrets.

## Create the first administrator
There is no public registration endpoint and no default password. Set `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (14–128 characters) through a secure one-time environment injection, then run:
```bash
pnpm bootstrap:admin
```
The command refuses to overwrite an existing account. Remove the two bootstrap variables immediately afterward; they are not runtime settings. Do not place real credentials in source files, PRs or shell transcripts.

## API routes
- `GET /api/v1/health` — process liveness.
- `GET /api/v1/ready` — database readiness.
- `POST /api/v1/auth/login` — verifies an admin and sets an opaque HttpOnly session cookie; returns the CSRF token in the JSON response.
- `GET /api/v1/auth/me` — returns the active admin and the current CSRF token for a page reload.
- `POST /api/v1/auth/logout` — requires the session cookie and `X-CSRF-Token`; revokes the session and clears the cookie.

Browser requests must use credentials (for example, `fetch(..., { credentials: "include" })`). Keep the returned CSRF token in application memory and send it as `X-CSRF-Token` for state-changing operations. Never put the session token in localStorage.

## Session and deployment notes
Sessions live in MongoDB; only a SHA-256 digest of the random session bearer is stored. Session lifetime is 8 hours; expired sessions are rejected server-side and the collection has a TTL index. Passwords are hashed with Node's scrypt (random salt and 64-byte derived key). Login throttling is currently per API process; use a shared rate-limit store before scaling to multiple API instances.
Development cookies use `SameSite=Strict`; production cookies use `Secure; SameSite=None` to support a cross-origin UI. Browsers may block third-party cookies when Vercel and Render hostnames are unrelated sites. Prefer frontend/API custom domains under the same registrable domain and verify cookies in target browsers before release. Configure exact production origins in `FRONTEND_ORIGINS`.

## Commands
- `pnpm dev` — watch-mode server.
- `pnpm lint` — repository source-hygiene check; this is not a full ESLint replacement.
- `pnpm typecheck` — checks source, tests and scripts.
- `pnpm test` — HTTP/config/auth tests using a fake repository.
- `pnpm test:integration` — MongoDB-backed authentication/session integration test (requires a disposable database with a name containing `test`).
- `pnpm build` — compile production source.
- `pnpm check` — lint, typecheck, unit tests and build.

## Engineering documents
- [SRS](docs/01-srs.md) · [Architecture](docs/02-architecture.md) · [Security](docs/03-security-engineering.md) · [Threat Model](docs/04-threat-model.md)
- [Database](docs/05-database-engineering.md) · [API contract](docs/06-api-contract.md) · [OpenAPI](api/openapi.yaml)
- [Status](docs/PROJECT-STATUS.md) · [Roadmap](docs/ROADMAP.md) · [Traceability](docs/11-traceability-and-acceptance.md)
