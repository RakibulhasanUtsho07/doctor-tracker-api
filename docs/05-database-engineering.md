# Database Engineering

## Collections
- users: normalized unique email, passwordHash excluded from normal projections, ADMIN role, active flag and timestamps. Never store plaintext passwords.
- authsessions: unique hash of the opaque session token, userId reference, CSRF token, createdAt and expiresAt; TTL index on expiresAt. Code also checks expiry on every request, because TTL deletion is asynchronous.
- doctors: name, normalized name/specialization/hospital fields used for case-insensitive prefix search, phone, normalized email and timestamps. Email is the approved unique identity key; uniqueness is case-insensitive after NFKC normalization and lowercase. Phone is not unique.
- patients: doctorId ObjectId reference, name/normalized search, approved minimum condition/category and timestamps. The assignment does not specify the full patient field list or condition taxonomy; confirm before schema freeze.

## Relationships and deletion
One doctor may have many patients. Validate doctor existence when creating/updating a patient. Clarify whether removing from a doctor's list deletes the patient or detaches the relationship before implementing the endpoint.

## Doctor indexes and query evidence
- doctor_email_unique: unique emailNormalized.
- doctor_name_created_idx: nameNormalized, createdAt descending, _id descending.
- doctor_specialization_created_idx: specializationNormalized, createdAt descending, _id descending.
- doctor_hospital_created_idx: hospitalNormalized, createdAt descending, _id descending.
- doctor_created_desc_idx: createdAt descending, _id descending.

Doctor list requests use allowlisted filters, normalized and escaped prefix search, inclusive UTC calendar-day from/to bounds on createdAt, stable descending sort, a maximum page size of 100, and a maximum offset of 100,000 records. Client-supplied MongoDB query operators and arbitrary sort fields are not accepted. Filters are not passed through directly from query parameters.

The MongoDB integration test seeds 300 synthetic doctors and logs the unhinted explain-plan summary (winning-plan index name if selected, executionTimeMillis, totalDocsExamined, and nReturned). It also checks that the specialization/sort query can use doctor_specialization_created_idx and examines no more than the requested 20 results under that index. Values are CI-run evidence, not a production latency/SLO guarantee; inspect the log emitted as DOCTOR_EXPLAIN_EVIDENCE for the tested commit.

## Patient index candidates
- patients: doctorId + createdAt and actual approved filter combinations. Create indexes after patient query shapes and condition semantics are finalized.

## Query rules
Bound page size, use stable sort and allowlisted fields, projections, UTC timestamps and documented date boundary semantics. Use server-side aggregation for dashboard metrics. Avoid N+1 loops, raw client query objects and arbitrary regex.

## Evidence
Auth session persistence/revocation integration tests, schema/index initialization, duplicate account behaviour, invalid reference tests, pagination bounds, aggregation reconciliation, explain plans and measured latency.
