# Test and Quality Plan
## Layers
1. Static: lint, typecheck, build and dependency audit.
2. Unit: validators, normalizers, service rules, filter parsing and UI state.
3. Integration: API routes, auth middleware, Mongoose constraints, filters/pagination and error envelopes.
4. UI components: forms, loading/empty/error, confirmations, chart labels and reduced motion.
5. E2E: sign in → dashboard → create/search doctor → add patient → edit/filter/delete patient → reconcile analytics.
6. Security negative tests: missing/invalid/expired credentials, role bypass, cross-record access, injection, mass assignment, CORS/CSRF as applicable, rate limits and log redaction.
7. Performance: documented synthetic data, measured latency, explain plans and runtime configuration.
8. Release smoke: deployed HTTPS, frontend/API connectivity, health, auth and CRUD using synthetic data.
## Test isolation and evidence
Use deterministic synthetic data and disposable test DB. Assert tests cannot target production. Record commit SHA, command, CI URL, pass/fail counts, environment and gaps. If CI is absent, state NOT CONFIGURED, not PASS.
## Merge gates
Relevant tests and quality checks pass; critical/high issues are addressed or formally accepted; traceability updated; no secrets or patient data committed; PR records requirement IDs and evidence.
