# System Architecture
## Proposed topology
Frontend repository: Next.js App Router and responsive admin UI. Backend repository: Node.js/Express REST API for auth, validation, business rules, analytics and persistence. Database: MongoDB through Mongoose. Hosting: frontend Vercel/Netlify, API Render or equivalent, and managed MongoDB with TLS and separate secrets.
## Request flow
Browser → REST API → security middleware → authentication/authorization → validation/business service → Mongoose queries/aggregations → documented response → UI state.
The frontend is not a security boundary. Browser code must never access MongoDB directly. Aggregation should return only fields used by charts. OpenAPI is the planned contract, not proof that endpoints exist.
## Session architecture
Choose and record the exact auth approach before implementing login. If cookies authenticate API calls, use Secure/HttpOnly/SameSite appropriately, restrictive CORS and CSRF protection. Never store long-lived credentials in localStorage.
## Repo boundaries
The repositories stay separate as required for submission. Mirror shared requirements; sync document changes in the same delivery step to prevent drift.
