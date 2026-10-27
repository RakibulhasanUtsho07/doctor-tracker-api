# Database Engineering
## Proposed collections
users: normalized unique email, passwordHash, role, active flag, timestamps. Never store plaintext passwords.
doctors: name and normalized search field, specialization, hospital, phone, normalized email, timestamps. Soft deletion only if approved.
patients: doctorId ObjectId reference, name, normalized search field, agreed condition/category and minimum approved fields, timestamps. The assignment does not define patient fields or condition vocabulary; confirm them before schema finalization.
## Relationship and deletion
One doctor may have many patients. Validate doctor existence when creating/updating a patient. Clarify whether removal from a doctor's list means deletion or detachment, and record the decision in an ADR.
## Candidate indexes
- users: unique emailNormalized.
- doctors: createdAt and approved specialization/search/sort combinations.
- patients: doctorId + createdAt; createdAt; condition/date combinations only when query plans justify them.
Use explain plans on synthetic representative data; every index has write/storage cost.
## Query rules
Bound page size (proposed max 100), stable sort with unique tie-breaker, allowlisted sort fields, projection, UTC timestamps and documented date boundaries. Use server aggregation for dashboard metrics. Avoid N+1 loops, raw client query objects and arbitrary regex. Record query latency.
## Acceptance evidence
Schema/validation tests, duplicate/index tests, invalid reference tests, pagination bounds, aggregate reconciliation, explain plans and measured latency. Request validation is still required even with Mongoose validators.
