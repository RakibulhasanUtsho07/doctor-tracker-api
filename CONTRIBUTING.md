# Contributing
## Branch flow
main is release-ready; dev is integration; rakibul-hasan is the active work branch. Promote by PR: rakibul-hasan → dev → verified release PR to main. Do not commit directly to main.
## Per-work-item rules
Keep each change medium-sized. Link issue and requirement IDs in every PR. Add tests and docs; run lint, typecheck, tests and build. Update project status and traceability with evidence tied to the exact commit. Review the diff for secrets, patient data, generated files and accidental dependencies. Use meaningful commits, e.g. feat(api): add doctor list filters.
## Definition of done
Acceptance criteria, automated checks, security review, docs and evidence must be complete. No evidence means NOT STARTED, IN PROGRESS or PARTIAL, never PASS.
