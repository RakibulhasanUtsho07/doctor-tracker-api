# Database Engineering

## Collections
- users: normalized unique email, passwordHash excluded from normal projections, ADMIN role, active flag and timestamps. Never store plaintext passwords.
- authsessions: unique hash of the opaque session token, userId reference, CSRF token, createdAt and expiresAt; TTL index on expiresAt. Code also checks expiry on every request, because TTL deletion is asynchronous.
- doctors: name, normalized name/specialization/hospital fields used for case-insensitive prefix search, phone, normalized email and timestamps. Email is the approved unique identity key; uniqueness is case-insensitive after NFKC normalization and lowercase. Phone is not unique.
- patients: minimum documented fields are doctorId, name and optional condition, plus timestamps. condition is free text up to 100 characters because no controlled vocabulary is specified. No additional demographics, contact details or clinical fields are introduced. Each patient is associated with at most one doctor; null doctorId represents a detached but preserved patient.

## Relationships and deletion
Patient create/reassignment validates that the target doctor exists. A patient belongs to zero or one doctor.
- DELETE /doctors/{doctorId}/patients/{patientId} removes the association by setting doctorId to null and preserves the patient record.
- DELETE /patients/{patientId} permanently deletes the patient record (204); a missing patient returns 404.
This separates the reversible relationship action from the destructive patient-delete operation. Patient record retention/soft-delete requirements beyond the current assignment remain a product/privacy decision.

## Doctor indexes and query evidence
- doctor_email_unique: unique emailNormalized.
- doctor_name_created_idx: nameNormalized, createdAt descending, _id descending.
- doctor_specialization_created_idx: specializationNormalized, createdAt descending, _id descending.
- doctor_hospital_created_idx: hospitalNormalized, createdAt descending, _id descending.
- doctor_created_desc_idx: createdAt descending, _id descending.

## Patient indexes and query evidence
- patient_doctor_created_idx: doctorId, createdAt descending, _id descending; serves doctor lists and stable pagination.
- patient_name_created_idx: nameNormalized, createdAt descending, _id descending.
- patient_condition_created_idx: conditionNormalized, createdAt descending, _id descending.
- patient_created_desc_idx: createdAt descending, _id descending.

The MongoDB integration test seeds synthetic patients for a doctor and emits PATIENT_EXPLAIN_EVIDENCE with the winning-plan index name (if selected), executionTimeMillis, totalDocsExamined and nReturned. It also verifies that the doctor-association query can use patient_doctor_created_idx and that a 20-record page examines no more than 20 documents under that index. CI measurements are evidence for the tested commit, not production latency/SLO guarantees.

## Query rules
Patient list queries use an allowlist of search, doctorId, condition, from, to, page and limit. Search is a normalized escaped literal prefix over name and condition; condition filtering is exact after normalization; date bounds are inclusive UTC calendar days on createdAt. Page size is capped at 100, with maximum offset 100,000. Client-supplied MongoDB operators and arbitrary sort fields are rejected. Responses omit normalized internal fields, and patient information is not written to request logs.

## Query rules for doctors
Doctor list requests use allowlisted filters, normalized and escaped prefix search, inclusive UTC calendar-day from/to bounds on createdAt, stable descending sort, a maximum page size of 100, and a maximum offset of 100,000 records. Client-supplied MongoDB query operators and arbitrary sort fields are not accepted. Filters are not passed through directly from query parameters.

The MongoDB doctor integration test seeds 300 synthetic records and logs explain-plan metrics. Inspect DOCTOR_EXPLAIN_EVIDENCE for tested-commit statistics; they do not establish production performance SLOs.

## General evidence
Authentication/session persistence, schema/index initialization, doctor duplicate email behaviour, patient reference checks, patient detach-versus-delete semantics, pagination bounds, aggregate reconciliation, explain plans and measured latency are covered by integration evidence as implemented.
