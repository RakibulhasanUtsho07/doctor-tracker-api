# Deployment and Operations
Keep local, CI/test, preview and production config/databases separate. Use least-privilege MongoDB users and restricted network access.
Backend configuration includes NODE_ENV, PORT, MONGODB_URI, allowed frontend origins and auth/session secrets. Frontend uses NEXT_PUBLIC_API_BASE_URL only; NEXT_PUBLIC values are browser-visible, never secrets.
Deployment sequence: test exact commit; configure runtime secrets; deploy API and verify safe health route; set frontend API URL; deploy frontend; verify CORS/session and core smoke flow; record public URLs and deployed commit.
Log request ID, route template, status, duration and error category. Do not log tokens, passwords, request bodies or patient data. Monitor health, 5xx, latency, auth abuse and DB errors.
Define backup frequency, retention, encryption and owner. Test restore; configured but untested backup is not proven. Document database/index compatibility and rollback plan.
Free hosting can sleep or have limits. Verify cold starts and URLs; do not claim an SLA or recovery targets without evidence.
