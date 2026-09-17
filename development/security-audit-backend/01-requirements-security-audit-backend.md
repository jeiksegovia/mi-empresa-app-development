# Requirements: security-audit-backend

Atomic, verifiable audit requirements. Each maps to evidence a worker collects and a verdict the
orchestrator adjudicates. "Acceptance" = the artifact/answer that proves the requirement was
covered, not that the system is secure.

## Functional requirements

| ID | Requirement | Acceptance criterion |
|---|---|---|
| R1 | Enumerate every route and its full middleware chain | Table: method + path → [auth, role/domain guard, validation schema] for all 13 route groups |
| R2 | Verify authN on every non-public route | List of routes lacking `authenticate`; each classified expected-public vs gap |
| R3 | Verify authZ / RBAC enforcement | For each role-guarded route, the guard is present AND matches `DOMAIN_ACCESS`; list mismatches (e.g. create-only bypass) |
| R4 | Injection surface (SQL/NoSQL) | Every Prisma raw / `$queryRaw` / string-built query located file:line; each classified parameterized vs interpolated |
| R5 | Command / path injection & file handling | `uploads.routes.ts` + any `child_process`/`fs` path use located; validate filename/path sanitization, content-type, size limits, storage location |
| R6 | Input validation coverage | Which routes use `validate.ts`/zod vs accept raw body; list unvalidated inputs reaching services/DB |
| R7 | XSS (frontend) | All `v-html` / `innerHTML` / raw-HTML render sinks located file:line; each classified trusted vs user-controlled |
| R8 | Credential & secret handling | No secrets committed in code/env samples; SSM usage; how the app reads DB creds; token signing secret source; `accounts-prod.md` gitignore intact |
| R9 | CORS + security headers | Allowed origins (IaC + app), credentials flag, helmet/CSP/HSTS/X-Frame presence; `x-origin-verify` enforcement on origin |
| R10 | Error / response leakage | `errorHandler.ts` does not leak stack traces / SQL / secrets to clients in prod mode |
| R11 | DB exposure (Lightsail) | Postgres bind address + port 5432 firewall state; is DB reachable from internet; auth method |
| R12 | SSH / firewall allow-list | Lightsail firewall rules: is SSH (22) restricted to an allow-list of IPs or open 0.0.0.0/0; which ports are open |
| R13 | Least-privilege temp credentials | The on-prem CodeDeploy/instance IAM role + credential-refresh cron: what actions/resources it can touch; is it scoped or over-permissioned; STS session lifetime |
| R14 | S3 / SSM access scope | Bucket policies (public? scoped?), SSM param path access from the instance role |
| R15 | FE ↔ origin transport security | CloudFront→origin uses the verify header; origin returns 403 without it; TLS enforced end to end |
| R16 | Log intrusion triage (staging) | pm2/nginx/system logs scanned for RCE attempts, injection probes, auth brute-force, anomalous IPs; findings or "none observed in window X" |
| R17 | Dependency surface (light pass) | `npm audit` high/critical count + any obviously abandoned security-relevant deps; not a full CVE dive |

## Non-functional requirements

- Every finding carries: id, title, severity, location (file:line or resource/log ref), exploit
  scenario, evidence pointer, remediation, prod-parity note. (Contract in
  `orchestration-ctx/decisions/00-findings-contract.md`.)
- Evidence is reproducible: verbatim command + output stored under `evidence/`.
- Severity assigned by the orchestrator, not the collecting worker (workers mark CANDIDATE severity).
- Read-only guarantee: no mutating command runs against any environment.

## Out of scope

- Fixing findings, DoS/load testing, full third-party pen-test, exhaustive CVE remediation, prod
  live probing.
