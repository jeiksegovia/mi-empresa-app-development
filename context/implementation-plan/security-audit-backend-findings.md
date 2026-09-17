# Security audit (backend + infra + comms + frontend) — findings distillation

> Cycle: `security-audit-backend` · team **team-security** (`sec-*` workers) · completed 2026-09-16.
> Full report (definitive): **`development/security-audit-backend/security-audit-report.md`**.
> This file is the grep-friendly distillation per
> `development/orchestration-conventions.md` §Mapping.

## Executive summary (one paragraph)

Staging↔prod isolation is broken. The staging Lightsail host's IAM role grants cross-env
S3/SSM/KMS via wildcards, AND the staging host is internet-exposed (SSH 22 + origin :3001
open to `0.0.0.0/0`, active scanner + SSH brute-force). A staging-host compromise therefore
reaches prod data: SSM prod params (DB creds, prod JWT_SECRET), S3 prod uploads (cédulas,
hojas de vida, contratos), and KMS decryption. This is the headline CH-1 finding
(HIGH → CRITICAL until prod IAM/secret parity is scoped). Four HIGH items (CH-1, F-05, F-02,
F-03) compound; seven MEDIUM items mostly cluster around S3 presign weak validation
(S2/S3/S4) and staging-internet exposure (F-01/F-09). Eight LOW + one PLAUSIBLE items are
defense-in-depth. App-layer code is clean: no exploitable RBAC bypass, token storage is
httpOnly cookie + in-memory Pinia, no `v-html` / `eval` / `new Function`. Staging ==
prod copy — fixes validated on staging then ported to prod.

## Counts (final_severity)

| Severity | Count | IDs |
|---|---|---|
| HIGH | 4 | CH-1, F-05, F-02, F-03 |
| MEDIUM | 7 | F-01, S2, S4, F-04, F-09, S3, S11 |
| LOW | 9 (incl. 1 PLAUSIBLE) | F-07, F-06, F-10, F-11, S1, S5, S6, S8, S7 |
| INFO | 6 | NEW-1, F-08, F-12, S9, S10, NEW-2 |

Total: 25 findings (1 composite CH-1 + 12 W1 infra/log + 11 W2 static + 2 NEW from Wave-2).

## Findings table (final_severity-ordered, contract-format compressed)

| ID | Domain | Severity | Location | Title |
|---|---|---|---|---|
| CH-1 | iam-least-priv | HIGH | evidence/infra/16 + 04 + logs/04,05 | Cross-env escalation chain |
| F-05 | iam-least-priv | HIGH | evidence/infra/16:14-19,33 | IAM S3+SSM ARNs span prod via `*` |
| F-02 | secrets | HIGH | evidence/infra/25:49-73 | JWT/SESSION/ORIGIN_VERIFY stored as SSM `String` (plaintext) |
| F-03 | iam-least-priv | HIGH | evidence/infra/16:52-61 | KMS `Decrypt` on `key/*` |
| F-01 | ssh-firewall | MEDIUM | evidence/infra/04 | SSH 22 open to 0.0.0.0/0 |
| S2 | file-upload | MEDIUM | backend/src/routes/uploads.routes.ts:64-86 | `/uploads/download-url?key=` presigns ANY key |
| S4 | file-upload | MEDIUM | backend/src/config/env.ts:36-39; services/s3Service.ts:171-187 | `MAX_FILE_SIZE_MB` unused; presign no `ContentLengthRange` |
| F-04 | iam-least-priv | MEDIUM | evidence/infra/20 | Bootstrap access key 75d, no rotation |
| F-09 | logs-intrusion | MEDIUM | evidence/logs/04,07,10 | Active external scanner probing staging |
| S3 | file-upload | MEDIUM | backend/src/routes/uploads.routes.ts:8-12,45 | presignedUrlSchema doesn't validate `folder`/`filename` |
| S11 | deps | MEDIUM | evidence/code-map/09-npm-audit.md | npm audit 0c / 8h / 3m / 1l transitive |
| F-07 | ssh-firewall | LOW | evidence/infra/04,31,34 | Direct origin :3001 open (mitigated by x-origin-verify) |
| F-06 | cors-headers | LOW | evidence/infra/27 | S3 CORS `AllowedHeaders: ['*']` |
| F-10 | ssh-firewall | LOW | evidence/logs/05,07 | SSH brute-force noise (no compromise) |
| F-11 | logs-intrusion | LOW | backend/src/app.ts:49 | Access logs missing client source IP |
| S1 | secrets | LOW | backend/src/config/env.ts:16 | JWT_SECRET code fallback `'dev-secret-change-me'` |
| S5 | cors-headers | LOW | backend/src/app.ts:24 | x-origin-verify uses `===` not `timingSafeEqual` |
| S6 | xss | LOW (latent HIGH) | frontend/app/plugins/access-denied.client.ts:25 | innerHTML fed by 403 detail (trusted string today) |
| S8 | error-leak | LOW | backend/src/middleware/errorHandler.ts:13-15 | P2002 leaks `meta.target` |
| S7 | xss | LOW (PLAUSIBLE) | backend/src/app.ts:16; frontend/nuxt.config.ts:62-68 | No CSP (backend + SPA shell) |
| NEW-1 | authz | INFO | evidence/infra/25:274-280 | `DEV_USERS_ENABLED=true` on staging |
| F-08 | cors-headers | INFO | evidence/infra/27 | S3 CORS includes localhost (dev/staging intentional) |
| F-12 | logs-intrusion | INFO | evidence/logs/02 | Stale `ERR_MODULE_NOT_FOUND` in pm2 log |
| S9 | error-leak | INFO (resolved) | backend/src/middleware/errorHandler.ts:49 | `err.message` leak (NODE_ENV=production on staging) |
| S10 | authz | INFO | backend/src/middleware/domainAccess.ts:160-163 | AUDITOR/OPERADOR bypass requireDomain |
| NEW-2 | logs-intrusion | INFO | evidence/infra/25:112-118 | `LOG_LEVEL=debug` on staging |

## Remediation roadmap (quick-win → larger, mapped to IDs)

**Quick wins (≤ 1 day)**: S8, S6, S5, S1, F-12, F-06, NEW-2, F-11, S7.
**Same-cycle (1-3 days)**: S2, S3, S4, S11, F-04, F-01, F-07.
**Sprint-level**: CH-1 / F-05 / F-03 (IAM re-architecture), F-02 (SecureString + rotation), F-09 (WAF).
**Must-verify before prod**: NEW-1, F-08, F-02, F-03, F-05, S7, S9, NEW-2.

See full report §4 for exact files + IaC surfaces.

## Controls verified CLEAN (state)

DB not externally exposed (firewall + `listen_addresses=localhost` + loopback pg_hba); S3
public access fully blocked (PAB x4 + AES256); IMDSv2 required; STS temp creds on instance
(45-min refresh); TLSv1.3 via CloudFront ACM; x-origin-verify enforced BEFORE route matching;
no RBAC bypass in EMPLEADO matrix; token storage clean (httpOnly cookie + Pinia memory);
no `v-html`/`eval`/`new Function`.

## Evidence gaps (state)

Prod probing was out of scope this round — see "Must-verify before prod" items above for the
prod read-only pass in a later cycle. Amplify response headers (CSP) not collected — S7 is
PLAUSIBLE, not CONFIRMED.

## Grep hook

```
security-audit-backend-2026-09 CH-1 HIGH F-02 F-03 F-05 S2 S3 S4 F-01 F-04 F-09 S11
```

## Cross-references

- Plan pointer: `context/implementation-plan/security-audit-backend-plan.md`
- Full report: `development/security-audit-backend/security-audit-report.md`
- Wave-2 verdicts: `development/security-audit-backend/orchestration-ctx/decisions/02-infra-integrated-verdicts.md`
- Findings contract: `development/security-audit-backend/orchestration-ctx/decisions/00-findings-contract.md`
- W1 (infra + logs): `development/security-audit-backend/tasks/W1-sec-devops-1/completion-report.md`
- W2 (static): `development/security-audit-backend/tasks/W2-sec-code-1/completion-report.md`
- W3 (this consolidation): `development/security-audit-backend/tasks/W3-sec-consolidate/completion-report.md`
- Evidence index: `development/security-audit-backend/evidence/index.md`