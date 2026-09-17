# Intake: security-audit-backend

## Objective

Comprehensive, evidence-backed security audit of the mi-empresa backend application and its
runtime footprint. Produce a severity-ranked findings report plus a prioritized remediation plan.
No code or infra changes this cycle. Staging is treated as an exact copy of prod, so approved fixes
port forward to prod in a later cycle.

## Scope (confirmed with developer 2026-09-16)

In scope:
- **Backend app**: request handlers (13 route groups), middleware chain (auth, domainAccess,
  validate, forbidLegacy, errorHandler), injection surfaces (Prisma/SQL, shell exec, path/file
  handling in uploads), authN/authZ + RBAC enforcement, credential/secret handling, CORS + security
  headers, error/response leakage.
- **Lightsail infra**: how the DB is set up (bind address, exposure, auth), firewall rules (SSH
  restricted to an allow-list of IPs? port 5432 closed?), how the instance obtains and refreshes
  temporary credentials with least privilege (credential-refresh cron, on-prem CodeDeploy IAM role,
  SSM param access scope, S3 bucket policy).
- **FE ↔ origin communication**: CloudFront → Lightsail origin path, `x-origin-verify` secret
  header enforcement, TLS, CORS allowed origins, auth token transport.
- **Frontend client-side**: XSS sinks (`v-html`/`innerHTML`/raw render), token storage, CSP/headers.
- **Staging runtime logs**: pm2 / nginx / system logs triaged for suspicious activity or remote
  code execution attempts.

Out of scope this cycle:
- Applying fixes (report + plan only).
- Live probing of prod (audited by IaC/config parity only).
- DoS / load testing, third-party pen-test, dependency CVE deep-dive beyond a surface pass.

## Confirmed decisions (2026-09-16)

1. **Evidence access**: a `pt-devops-infra` worker runs read-only SSH + AWS `describe` itself, using
   profile `disruptive`, against **staging only** (`54.144.25.72`). Every AWS/SSH command is
   read-only; no mutations.
2. **Scope**: backend + infra + comms + frontend client-side.
3. **Remediation depth**: report + prioritized plan only. Zero code/infra changes.
4. **Live target**: staging only. Prod (`44.195.227.44`) via IaC parity. Staging == prod copy →
   fixes deploy to prod in a following phase once staging is clean.

## Assumptions

- The `disruptive` AWS profile has read-only describe access to the relevant Lightsail / IAM / SSM /
  S3 resources. If a describe call is denied, the worker logs it as an evidence gap, not a failure.
- SSH key for staging is available locally (see `backend/infrastructure/db/utilities/`).
- The audit reads code as-is on the current working tree (HEAD `6cba342` + dirty tree per git).

## Known constraints (hard rules)

- AWS: profile `disruptive`, region `us-east-1`, state every command before running, read-only only,
  never spray/guess profiles. No prod probing.
- Never run `prisma migrate diff --shadow-database-url`; no blanket `pkill`/`kill -9`; do not touch
  the prod bun service on :4142.
- Orchestrator does the selective delicate analysis (validation + severity verdicts); workers do the
  token-heavy evidence collection and static mapping.
- No `§` or em dash in chat output.

## Input source

- `/planify-team` invocation 2026-09-16 (this cycle).
- Existing IaC + scripts under `backend/infrastructure/db/`.
- Prod-release context: `context/implementation-plan/prod-release/summary-2026-09-16-resume.md`.

## Fast-track

Not fast-tracked — new cycle, no pre-existing plan. Runs 0.5 (requirements) → 0.9 (plan) → approval.
