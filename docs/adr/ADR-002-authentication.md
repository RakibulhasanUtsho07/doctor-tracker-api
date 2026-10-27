# ADR-002: Authentication
Status: Proposed; implementation not started.
The assignment requires secure login but does not prescribe tokens, cookies or initial admin provisioning. Choose maintained password hashing and a secure session lifecycle. If cookies authenticate writes, add CSRF protections and restrict CORS. If JWTs are selected, validate signature, algorithm, issuer, audience and expiry. Never store long-lived credentials in localStorage. Record final design before coding login.
