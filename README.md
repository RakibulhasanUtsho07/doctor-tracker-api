# Doctor Tracker API

Secure REST API for the Doctor Tracker assignment. Stack: Node.js, Express, TypeScript, Mongoose and MongoDB.

## Current status
The API foundation has passed CI and was merged into `dev` via PR #7 (foundation) and PR #8 (server timeouts/OpenAPI errors). The merged scope includes environment validation, liveness, security middleware, request IDs, bounded HTTP timeouts, consistent error envelopes, and configuration/HTTP tests. Authentication and domain CRUD endpoints are subsequent steps.

## Prerequisites
- Node.js 22 or another supported LTS runtime.
- The pnpm version declared by the repository.
- A local/disposable MongoDB URI in `.env`. Step 1 validates the URI but does not connect to MongoDB; database connectivity is introduced with the schema work.

## Local setup
```bash
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```
In PowerShell, use `Copy-Item .env.example .env`. Edit local values only and never commit secrets. The API defaults to `http://localhost:4000`; liveness endpoint: `GET /api/v1/health`.

## Commands
- `pnpm dev` — watch-mode development server.
- `pnpm lint` — project-local source hygiene checks (trailing whitespace, final newline, tabs at line start, debug logging and debugger statements). This is a small repository guard, not a full ESLint replacement.
- `pnpm typecheck` — TypeScript validation.
- `pnpm test` — automated HTTP/config tests.
- `pnpm build` — compile to `dist/`.
- `pnpm check` — lint, typecheck, tests and build.

## Environment
See `.env.example`. `MONGODB_URI` and `FRONTEND_ORIGINS` are required. Configure real production values in the hosting secret store.

## Engineering documents
- [SRS](docs/01-srs.md)
- [Architecture](docs/02-architecture.md)
- [Security Engineering](docs/03-security-engineering.md)
- [Database Engineering](docs/05-database-engineering.md)
- [API Contract](docs/06-api-contract.md)
- [OpenAPI](api/openapi.yaml)
- [Project Status](docs/PROJECT-STATUS.md)
- [Roadmap](docs/ROADMAP.md)
