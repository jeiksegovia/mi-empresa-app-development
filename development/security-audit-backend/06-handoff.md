# Handoff: security-audit-backend

**Cycle complete** 2026-09-16. Team team-security (`sec-*`). Report + remediation plan only; no
code/infra changed. Staging read-only; prod by parity.

## Deliverables

| Artifact | Path | Shareable? |
|---|---|---|
| Full audit report (25 findings, ranked) | `development/security-audit-backend/security-audit-report.md` | yes (redacted) |
| Client distillation | `context/implementation-plan/security-audit-backend-findings.md` | yes (redacted) |
| Plan pointer | `context/implementation-plan/security-audit-backend-plan.md` | yes |
| Final-severity SSOT | `orchestration-ctx/decisions/02-infra-integrated-verdicts.md` | internal |
| Static verdicts | `orchestration-ctx/decisions/01-static-verdicts-prelim.md` | internal |
| Raw evidence (47 files) | `development/security-audit-backend/evidence/**` | NO — gitignored (live secrets/IPs) |

## Result

- **4 HIGH**: CH-1 cross-env escalation chain (→CRITICAL until prod parity scoped), F-05 cross-env
  IAM wildcards, F-02 secrets as SSM String plaintext, F-03 KMS `key/*` wildcard.
- **7 MEDIUM**: F-01 SSH open/no allow-list, S2 download-url presigns any key, S4 file-size cap
  unenforced, F-04 bootstrap key 75d unrotated, F-09 active scanner, S3 unvalidated folder, S11 deps.
- **8 LOW (+1 PLAUSIBLE)**, **6 INFO**. Plus `DEV_USERS_ENABLED=true` on staging (verify prod=false).
- **Clean**: DB not exposed, S3 PAB on, IMDSv2, STS temp creds, TLSv1.3, x-origin-verify enforced,
  no RBAC bypass, clean token storage, no XSS sinks.

## Remediation roadmap (next cycle)

9 quick-wins, 7 same-cycle, 3 sprint-level, 8 must-verify-prod. See report §4. Fixes validate on
staging then port to prod (staging == prod copy).

## Not validated / gaps

- Prod resources never probed (out of scope). A prod read-only parity pass is the recommended next
  cycle: prod IAM scoping, prod secret types, prod `DEV_USERS_ENABLED`, prod CORS, prod NODE_ENV.
- Amplify prod/staging response headers (CSP) not collected — S7 is PLAUSIBLE only.

## Workers

- sec-devops-1 (pt-devops-infra): #1,#2 — SHUTDOWN clean.
- sec-code-1 (pt-research-arch): #3,#4 + reused for #5 — report done, reaped.

## Next actions for the developer

1. Decide whether to open a fix cycle (`/planify-team`) for the HIGH items — CH-1/F-05/F-02/F-03 are
   the priority and are cheap IaC/SSM changes.
2. Authorize a prod read-only parity pass if you want the prod-side confirmed.
