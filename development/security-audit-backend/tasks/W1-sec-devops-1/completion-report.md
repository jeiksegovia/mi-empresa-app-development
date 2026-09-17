# W1 (sec-devops-1) Completion Report

**Worker**: sec-devops-1 (team-security, pt-devops-infra)
**Worker prefix**: `sec-` · **Orchs**: `team-lead`
**Cycle**: security-audit-backend (Tasks #1 + #2)
**Scope**: staging only (54.144.25.72 / miempresa-backend-staging), AWS profile `disruptive`, region `us-east-1`, read-only
**Approved plan**: `tasks/W1-sec-devops-1/proposed-plan.md` (approved 2026-09-16)

---

## Summary

Read-only evidence collection from the STAGING environment for the miempresa project. Every command was state-free (`describe`, `get`, `list`, `ss`, `ls`, `cat`, `head`, `tail`, `utmpdump`, `journalctl`, `grep`, `curl -sI`). No mutations; no `pkill`/`kill`/`delete`/`put`/`create`/`deploy`. SSH session reused across all on-instance commands. No `--with-decryption` on SSM (default of `get-parameters-by-path` is true — flagged in F-02).

Twelve candidate findings recorded; the strongest are **F-02 (HIGH — JWT/SESSION/ORIGIN_VERIFY secrets at rest as plaintext SSM String)**, **F-03 (HIGH — KMS Decrypt on `key/*`)** and **F-04 (MEDIUM — bootstrap access key 75d old, no rotation)**. Multiple controls verified clean (DB not externally exposed; S3 public access fully blocked; TLS via CloudFront ACM cert; x-origin-verify enforced before route matching; STS temporary credentials in use on the instance; refresh cycle on schedule).

---

## Acceptance criteria mapping

| AC | Status | Evidence |
|---|---|---|
| 1. `proposed-plan.md` written and APPROVED before any live command | DONE | `tasks/W1-sec-devops-1/proposed-plan.md`; `APPROVED:` received from team-lead (msg_id 0048ae53) |
| 2. `evidence/infra/` contains verbatim output for R11-R15 (or explicit GAP notes) | DONE | 35 files in `evidence/infra/`; no GAP notes needed — every check succeeded. |
| 3. `evidence/logs/` contains pulled logs + a triage note stating the window and signals | DONE | 11 files in `evidence/logs/`; window stated in `evidence/findings-task2.md` (77-day range). |
| 4. `evidence/index.md` has one line per evidence file: what it proves | DONE | `evidence/index.md` (extended with infra/logs/findings tables — preserved W2 entries) |
| 5. Candidate findings recorded in contract format with evidence paths | DONE | `evidence/findings/findings-task1.md` (F-01..F-08), `evidence/findings/findings-task2.md` (F-09..F-12) |

---

## Findings index (candidate_severity set by worker; final by orchestrator)

| ID | Domain | Title | candidate_severity |
|---|---|---|---|
| F-01 | ssh-firewall | SSH (22) open to 0.0.0.0/0 (no IP allow-list) | LOW |
| F-02 | secrets | JWT_SECRET / SESSION_SECRET / ORIGIN_VERIFY_SECRET stored as String (plaintext at rest) | HIGH |
| F-03 | iam-least-priv | KMS Decrypt/DescribeKey allowed on `key/*` wildcard | HIGH |
| F-04 | iam-least-priv | Bootstrap IAM user access key 75d old, no rotation evidence | MEDIUM |
| F-05 | iam-least-priv | S3 + SSM resource ARNs span prod+staging+dev via wildcards | MEDIUM |
| F-06 | cors-headers | S3 uploads CORS `AllowedHeaders: ['*']` | LOW |
| F-07 | ssh-firewall | Direct origin :3001 open to 0.0.0.0/0 at Lightsail firewall | LOW |
| F-08 | cors-headers | S3 CORS defaults include localhost 3100/3101/3102 (intentional, dev/staging only) | INFO |
| F-09 | logs-intrusion | Active external scanner probing staging API for common secrets/config files | MEDIUM |
| F-10 | ssh-firewall | SSH brute-force on public IP — no compromise, constant noise | LOW |
| F-11 | logs-intrusion | Access logs do not capture client source IP | LOW |
| F-12 | logs-intrusion | pm2 error log retains unresolved `ERR_MODULE_NOT_FOUND` (Prisma client) from initial deploy | INFO |

---

## Controls that PASSED (no finding)

- **R11 — Database not externally exposed**: Lightsail firewall does NOT open 5432; on-instance `listen_addresses = 'localhost'`; `pg_hba.conf` loopback-only (md5 / peer). All three controls agree.
- **R12 — 5432 NOT in Lightsail firewall**: Only 22 and 3001 exposed (and 22 has no allow-list — see F-01).
- **R14 — S3 public access fully blocked**: All 4 PAB flags on; no bucket policy (implicit deny); AES256 SSE on all 3 staging buckets (uploads, artifacts, backups).
- **R14 — IMDSv2 enforced**: `httpTokens: required` on the instance metadata options.
- **R13 — STS temporary credentials on instance**: `aws sts get-caller-identity` on-instance returns `arn:aws:sts::540657241795:assumed-role/CodeDeployInstanceRole/miempresa-backend-staging` — no static key on the host. Refresh every 45 min via cron, 15-min margin before STS expiry.
- **R15 — TLS via CloudFront**: TLSv1.3 with valid ACM cert `Amazon RSA 2048 M04`, valid 2026-07-02 → 2027-01-15.
- **R15 — x-origin-verify enforced**: middleware at `dist/app.js:17-26` runs BEFORE routes; direct origin without header returns 403; even non-existent routes return 403 (no info leak about route existence).

---

## Deliverables (all on disk)

| Artifact | Path |
|---|---|
| Approved plan | `development/security-audit-backend/tasks/W1-sec-devops-1/proposed-plan.md` |
| Per-step progress | `development/security-audit-backend/tasks/W1-sec-devops-1/progress-report.md` |
| **This report** | `development/security-audit-backend/tasks/W1-sec-devops-1/completion-report.md` |
| Infra evidence (R11-R15) | `development/security-audit-backend/evidence/infra/*` (35 files) |
| Log evidence (R16) | `development/security-audit-backend/evidence/logs/*` (11 files) |
| Evidence index | `development/security-audit-backend/evidence/index.md` (extended) |
| Task #1 findings | `development/security-audit-backend/evidence/findings/findings-task1.md` |
| Task #2 findings | `development/security-audit-backend/evidence/findings/findings-task2.md` |

---

## Resource names / ARNs / IDs (recorded for orchestrator + W3 cross-reference)

- Account: `540657241795`
- Region: `us-east-1`
- Lightsail instance: `miempresa-backend-staging` (arn `arn:aws:lightsail:us-east-1:540657241795:Instance/a3db6728-cfba-46ab-81b0-694643a5f20e`)
- Lightsail static IP: `miempresa-ip-staging` (`54.144.25.72`, attached)
- IAM role: `CodeDeployInstanceRole` (`arn:aws:iam::540657241795:role/CodeDeployInstanceRole`)
- IAM inline policy: `CodeDeployInstancePolicy` (single; see evidence for statement details)
- IAM user (bootstrap): `miempresa-bootstrap` (1 active access key, created 2026-07-02)
- S3 buckets: `miempresa-{uploads,artifacts,backups}-540657241795-staging`
- CloudFront distribution: serves `miempresa-api-stg.disruptiveexp.com` → origin `miempresa-api-origin-stg.disruptiveexp.com` (54.144.25.72:3001, x-origin-verify enforced)
- SSM prefix: `/miempresa/staging/*` (42 parameters)

---

## What I did NOT do (per scope rules)

- No prod probing (`44.195.227.44` / `miempresa-backend-prod`).
- No AWS mutating commands (`put`, `create`, `delete`, `deploy`, `update`).
- No instance mutations (`pkill`, `kill`, service restart, file write, Prisma migrate).
- No `--with-decryption` on SSM (default of `get-parameters-by-path` is true — recorded as F-02 risk).
- No `npm audit` / source code reading (W2's scope).
- No enumeration outside the `miempresa-*` project.

---

## Open questions for orchestrator (no action required from worker)

1. **F-02 severity rationale**: worker assigned HIGH because the secrets enable JWT forgery (auth bypass). Orchestrator may downgrade to MEDIUM if prod SSM is partitioned / cross-env blast radius is contained (mitigates F-05 partly).
2. **F-03 scope creep**: KMS Decrypt on `key/*` is HIGH for the EC2 role specifically. Other IAM identities in the account are out of this worker's scope.
3. **F-08**: included for documentation; if prod CORS is verified to use the prod-only override, the finding can be marked RESOLVED on that axis.

---

**Ready for orchestrator Wave-2 verdict + W3 consolidation.**
