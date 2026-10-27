# Doctor Tracker API

Secure REST API for the Doctor Tracker assignment. Stack: Node.js, Express, TypeScript, Mongoose and MongoDB.

## Current status
API foundation is in progress on `rakibul-hasan`. This step adds environment validation, a liveness endpoint, security middleware, request IDs, a consistent error envelope and automated HTTP/config tests. Authentication and domain CRUD endpoints are separate planned steps.

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
- `pnpm typecheck` — TypeScript validation.
- `pnpm test` — automated HTTP/config tests.
- `pnpm build` — compile to `dist/`.
- `pnpm check` — typecheck, tests and build.

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
