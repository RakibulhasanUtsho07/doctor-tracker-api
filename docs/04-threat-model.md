# Threat Model
## Assets and boundaries
Assets: admin credentials/session, doctor and patient records, database credentials, backups and analytics integrity. Boundaries: browser/API, public internet/hosting, API/MongoDB, developer/CI/source control, runtime secrets.
## Threats and mitigations
- Credential stuffing/session theft: password hashing, rate limits and secure session lifecycle.
- Broken object-level authorization: server-side resource checks and cross-record tests.
- MongoDB injection: typed DTOs, allowlists and no raw query objects.
- Mass assignment/data overexposure: explicit mutation and response schemas.
- CSRF/CORS errors: coherent cookie/CSRF design and explicit origin allowlist.
- XSS: escaped rendering and no untrusted HTML.
- Data leakage: log redaction and synthetic test/screenshot data.
- Denial of service: bounded pages, controlled search, size/time limits.
- Vulnerable dependencies or secret leaks: audit, scanning, credential rotation and incident response.
- Data loss: limited destructive privileges, backup and restore rehearsal.
Review when auth, patient fields, APIs, deployment or integrations change. Each mitigation needs code and test evidence.
