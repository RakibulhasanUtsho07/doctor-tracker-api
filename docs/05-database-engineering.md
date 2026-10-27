# Database Engineering
## Collections
- users: normalized unique email, passwordHash excluded from normal projections, ADMIN role, active flag and timestamps. Never store plaintext passwords.
- authsessions: unique hash of the opaque session token, userId reference, CSRF token, createdAt and expiresAt; TTL index on expiresAt. Code also checks expiry on every request, because TTL deletion is asynchronous.
- doctors: name/normalized search, specialization, hospital, phone, normalized email and timestamps.
- patients: doctorId ObjectId reference, name/normalized search, approved minimum condition/category and timestamps. The assignment does not specify the full patient field list or condition taxonomy; confirm before schema freeze.
## Relationships and deletion
One doctor may have many patients. Validate doctor existence when creating/updating a patient. Clarify whether removing from a doctor's list deletes the patient or detaches the relationship before implementing the endpoint.
## Index candidates
- users: unique emailNormalized.
- authsessions: unique tokenHash; userId lookup index; TTL index on expiresAt.
- doctors: createdAt and actual approved search/filter/sort combinations.
- patients: doctorId + createdAt and actual approved filter combinations.
Use explain plans on representative synthetic data; unnecessary indexes increase write/storage cost.
## Query rules
Bound page size, use stable sort and allowlisted fields, projections, UTC timestamps and documented date boundary semantics. Use server-side aggregation for dashboard metrics. Avoid N+1 loops, raw client query objects and arbitrary regex.
## Evidence
Auth session persistence/revocation integration tests, schema/index initialization, duplicate account behaviour, invalid reference tests, pagination bounds, aggregation reconciliation, explain plans and measured latency.
