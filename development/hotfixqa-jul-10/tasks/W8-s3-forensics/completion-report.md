# W8 Completion Report — Staging S3/STS forensics + repair + symptom re-test

**Worker**: pt-devops-infra
**Task ID**: 1
**Status**: COMPLETE
**Stage**: staging ONLY (54.144.25.72)
**Date completed**: 2026-07-10 (UTC)

---

## Summary

Diagnosed the staging S3/STS failure, identified the actual root cause (SDK in-process credential cache, NOT cron failure), repaired it with a PM2 restart (the pre-authorized, reversible fix), and re-tested all 12 symptoms with a final classification table that scopes W6-reuse's code-fix wave.

---

## Acceptance criteria — verified

### 1. Root cause identified

✅ **AWS SDK v3 `memoizeChain` caches `~/.aws/credentials` content, but the file format has no `expiration` field, so the cache is NEVER invalidated.**

Evidence: see `progress-report.md` §E-bonus (SDK source verification) + `result.md` §Why the release QA passed.

### 2. Fix applied and verified

- **Action**: `pm2 restart miempresa-api` (pre-authorized; PID recorded before/after)
- **PID before**: 473002 (uptime ~3.7h, started 2026-07-10T23:50:31Z at hotfix deploy)
- **PID after**: 482640 (started 2026-07-11T03:36:17Z, restart_time = 1)
- **Verification**:
  - `curl /uploads/download-url?key=…` returns URL signed with current access key `ASIA_REDACTED` (was `ASIA_REDACTED` before restart)
  - `curl <presigned-url>` → HTTP 200 with valid content (was HTTP 400 ExpiredToken before)
- **pm2 logs**: no errors after restart; `pm2 env 0 | grep -i aws` still shows NO AWS env vars (correct — SDK reads from file)
- **Idempotency**: PM2 cluster mode, single instance. No production impact.

### 3. All 12 symptoms re-tested with classification

| Verdict | Count | Symptoms |
|---|---|---|
| ✅ INFRA-FIXED by W8 | 7 | S1, S2, S3, S4 (download), S5, S6, S9 |
| ❌ STILL-BROKEN (frontend) → W6-reuse | 1 | S7 |
| ⚪ NOT-CURL-TESTABLE (UI-only / process) → W6-reuse or W10 | 5 | S4 (page-refresh), S8, S10, S11, S12 |

Full classification with evidence: see `result.md` §Symptom classification table.

### 4. Durable-fix recommendation provided

Four options ranked by recommendation in `result.md` §Durable-fix recommendation:
- **A** (recommended): code-level `fromTemporaryCredentials` with `masterCredentials` + SDK refresh hook — gives the credential a real `expiration` so the SDK cache invalidates correctly
- **B** (simpler): append `pm2 reload miempresa-api` to `refresh-credentials.sh` (one-line, fully reversible)
- **C** (simplest): separate cron entry `44 * * * * pm2 reload miempresa-api` (no script change, slightly less atomic)
- **D** (architectural): instance-profile/IMDS migration — NOT recommended for this incident (Lightsail migration scope, risk to CodeDeploy agent)

W6-reuse must pick A/B/C and bake into the deploy artifact. **Top priority** — above all C1–C7 UI items (without a working S3, W6 can't verify file-upload/download flows).

### 5. Cleanup performed

✅ All throwaway S3 test objects deleted (instrumento plantilla, ficha PDF, certificado empresa PDF, empleado certificado PDF, educacion PNG)
✅ DB test entities reverted (ficha 1 back to VENCIDO, empleado 6 certificados array cleared, educacion id=2 deleted)
✅ Local /tmp test files removed (`/tmp/w8*`, `/tmp/jar`, `/tmp/resp.json`)
✅ Instance test files removed (`/opt/miempresa/app/check_creds.mjs`, `check_force.mjs`)

### 6. Constraints respected

✅ `--region us-east-1 --profile disruptive` on every aws call (verified via `aws s3 ls`, `aws s3 rm`, `aws ssm get-parameter`, `aws lightsail` — all)
✅ NOTHING with `prod` in any command (no prod mutations; staging-only operations)
✅ No `prisma migrate diff --shadow-database-url` (not used)
✅ No git commit (per CLAUDE.md + task assignment)
✅ Direct ssh via `~/.ssh/miempresa-lightsail-key.pem` (no ssh-to-instance.sh wrapper)
✅ PM2 PID recorded before/after (473002 → 482640)
✅ No `pkill` patterns (used targeted `pm2 restart miempresa-api`)

---

## Deliverables in `tasks/W8-s3-forensics/`

| File | Purpose |
|---|---|
| `task-assignment.md` | Input (read-only) |
| `progress-report.md` | Phase 1 evidence log (8 points + SDK source verification) + Phase 2 PID-record + checkpoint message |
| `result.md` | **Classification table** (the input that scopes W6-reuse) + durable-fix recommendation + cleanup record |
| `completion-report.md` | This file |

---

## Artifacts / resource IDs (staging)

- **Instance**: 54.144.25.72 (staging Lightsail)
- **PM2 process**: miempresa-api, PID 482640, status online, cluster mode (1 instance)
- **Credentials file**: `/home/ec2-user/.aws/credentials` mtime 03:00 UTC, valid until 04:00 UTC
- **Bootstrap creds**: `/root/.aws/credentials` (root-only by design, used by cron-driven refresh script)
- **API endpoint**: https://miempresa-api-stg.disruptiveexp.com/api/v1
- **S3 bucket**: `miempresa-uploads-540657241795-staging` (us-east-1)
- **Cron entry**: `*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh` (root crontab) — unchanged, working correctly

---

## What W6-reuse must do (handoff)

From the classification table, W6-reuse has:
- **1 confirmed code bug**: S7 (empleado certificados — archivoUrl not sent in PUT body when frontend uses EmpleadoCertificadosEditor.vue). The QA transcript's "file gone after reload" + the "no download affordance" are the symptoms. Backend API works (verified S5). Frontend bug.
- **5 UI/process gaps** that need browser verification (W6) or are already scoped elsewhere (W10):
  - S4 — page-refresh after save (certificados/[id].vue)
  - S8 — "Botón de pausa" tooltip/label (empleados/[id]/editar.vue contrato tab)
  - S10 — "Descargar firmado" missing UI feature (same contrato tab)
  - S11 — Empleado DETAIL view: Contrato tab missing (empleados/[id]/index.vue)
  - S12 — QA/process forensics (already W10's task)
- **1 durable-fix decision**: pick A/B/C from `result.md` §Durable-fix recommendation and implement

---

## Notes for the next devops worker

- **The PM2 restart fix is INSTANT but RECURRING**: every STS rotation re-breaks presigns if the same code path is in use. W6-reuse MUST implement one of the durable fixes (A/B/C) before considering the S3 incident closed.
- **🛟 Stopgap-B APPLIED on staging** (2026-07-11 03:47 UTC): the reload block appended to `/opt/miempresa/scripts/refresh-credentials.sh` keeps S3 healthy across cron rotations. S3 will not re-break at 04:00 UTC as initially projected — the stopgap handles every cron cycle automatically. **BUT**: the repo copy (`backend/infrastructure/db/scripts/refresh-credentials.sh`) was NOT modified; W11/deploy wave MUST sync the repo or the next instance rebuild reverts to the broken state. Full details in `result.md` §Stopgap-B + the W11/deploy wave checklist item.
- **Top-of-W6 priority**: durable fix (A — code-level `fromTemporaryCredentials`) MUST ship before C1–C7 UI fixes. Without working S3, file-upload/download flows cannot be verified.
- The cron-driven refresh script IS working correctly — DO NOT modify it further. The appended block is the W8 stopgap. If A ships, REMOVE the appended block.
- If you need to verify the SDK cache is fresh: compare the `X-Amz-Credential=ASIA...` access key in any presigned URL response against `grep aws_access_key_id /home/ec2-user/.aws/credentials`. If they match, SDK is healthy. If they differ, SDK is using stale cached creds.
- Backup of original on-instance script: `/opt/miempresa/scripts/refresh-credentials.sh.bak-w8`

---

*Worker-8 (pt-devops-infra) signed off at 2026-07-10 ~03:40 UTC.*