# Completion Report — W12 Staging Release of fixes-jul17-2

**Task ID**: #38 · **Worker**: pt-devops-infra (worker-12)
**Plan slug**: fixes-jul17-2 · **Stage**: staging only (prod hard-refused per protocol)
**Profile**: `disruptive` · **Region**: `us-east-1`
**Result**: ✅ ALL GREEN — release deployed + QA-verified end-to-end
**Runbook**: `context/implementation-plan/staging-release-jul17-2-runbook.md`
**Progress report**: `development/fixes-jul17-2/tasks/W12-staging-release/progress-report.md`

---

## Acceptance criteria — every box is evidence-linked

### Pre-flight (R0)
- [x] Git HEAD = `a169460b5d468d7b973a82f6ed8b5fc76ac38392` — verified via `git rev-parse HEAD`
- [x] Working tree dirty with 22 files / +1636/-1027 — verified via `git diff --stat HEAD -- backend/`
- [x] Local migrations = 22 — verified via `npx prisma migrate status | grep "migrations found"` → `"22 migrations found in prisma/migrations"`
- [x] On-instance migrations = 21 (no drift; 1 pending) — verified via SSH `npx prisma migrate status` → `"21 migrations found in prisma/migrations"`
- [x] New migration risk = ADDITIVE — verified via `cat migration.sql` → only `ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS'`
- [x] Lightsail staging @ 54.144.25.72 running — verified via `aws lightsail get-instances`
- [x] API health 200 — verified via `curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → `HTTP=200 {"status":"ok",...}`
- [x] Uploads bucket = 0 objects — verified via `aws s3 ls s3://miempresa-uploads-540657241795-staging --recursive --summarize` → `Total Objects: 0`
- [x] Backups bucket reachable — verified via `aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/`
- [x] Amplify app `d1nsxjyualdzdu` — verified via `aws amplify list-apps`
- [x] CodeDeploy groups: `miempresa-staging` + `miempresa-prod` (will use ONLY staging) — verified via `aws deploy list-deployment-groups`
- [x] SSM `qa-*` profiles NOT YET present (only legacy `QA_USER_*`) — verified via `aws ssm get-parameters-by-path`
- [x] 6 v1 instrument templates present in `backend/prisma/instrument-templates/` — verified via `ls`

### Backup (R1)
- [x] Pre-release dump at `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` — verified via `aws s3 ls`
  - Size: 25,265 bytes (24.7 KiB on S3)
  - SHA256: `2cf7cea216dd3003285994b3ade65bfc026dadd100218853d1c8c7df8846861d`
- [x] Uploads byte-sync: SKIPPED (bucket empty, verified count=0)

### Destructive reset (R2, developer pre-authorized)
- [x] Typed confirmation `reset staging` piped via stdin — recorded verbatim
- [x] Pre-reset dump at `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260717-152735.sql.gz` (25.2 KiB)
- [x] Schema dropped + recreated (`DROP SCHEMA public CASCADE` → 70 cascades → `CREATE SCHEMA public`)
- [x] Migrations replayed: 22 of 22 — verified via `npx prisma migrate status | grep "migrations found"` → `"22 migrations found in prisma/migrations"`
- [x] Canonical seed: 4 users + 1 empresa + 3 legacy + 6 dynamic + 6 active v1 + 7 cargos — verified via tunnel `psql` queries
- [x] Post-reset row counts: empresas=1 cargos=7 contratos=0 notas=0 fichas=0 usuarios=4 instrumentos=9 — verbatim from `psql`

### Seed-qa first real run (R3)
- [x] 3 SSM pairs created (names only — passwords SecureString):
  - `/miempresa/staging/qa/qa-admin/EMAIL` = `qa-admin@miempresa.com`
  - `/miempresa/staging/qa/qa-admin/PASSWORD` (SecureString, generated)
  - `/miempresa/staging/qa/qa-gerontologa/EMAIL` = `qa-gerontologa@miempresa.com`
  - `/miempresa/staging/qa/qa-gerontologa/PASSWORD` (SecureString, generated)
  - `/miempresa/staging/qa/qa-contratos/EMAIL` = `qa-contratos@miempresa.com`
  - `/miempresa/staging/qa/qa-contratos/PASSWORD` (SecureString, generated)
- [x] Legacy alias mirrored: `/miempresa/staging/qa/QA_USER_EMAIL` = `qa-admin@miempresa.com` (was stale `qa@miempresa.com` from yesterday)
- [x] 3 QA user rows upserted via tunnel — verified via `psql`:
  - id=5 qa-admin@miempresa.com rol=ADMIN tipoEmpleado=null
  - id=6 qa-gerontologa@miempresa.com rol=EMPLEADO tipoEmpleado=GERONTOLOGA
  - id=7 qa-contratos@miempresa.com rol=EMPLEADO tipoEmpleado=CONTRATOS
- [x] `get-qa-creds.sh` prints all 3 profiles — verified

### Backend deploy (R4)
- [x] CodeDeploy deploymentId = `d-8E7JTGNMK` — verified via `aws deploy get-deployment`
- [x] deploymentGroupName = `miempresa-staging` (NEVER `miempresa-prod`)
- [x] Status = `Succeeded` — verified via `aws deploy get-deployment | jq .deploymentInfo.status`
- [x] On-instance migrations = 22 (G1's additive CONTRATOS enum + all 21 prior) — verified via SSH `npx prisma migrate status`
- [x] pm2 new PID = 881793, online, restarts=0 — verified via SSH `pm2 jlist`
- [x] `/api/v1/health` = HTTP 200 — verified via curl
- [x] Credential architecture intact:
  - `awsCredentials.ts` P0 provider evidence present (line 24) — verified via `grep`
  - cron (root) `*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh` — verified via SSH `sudo crontab -l`
  - `.env` mode 600 — verified via SSH `ls -la /opt/miempresa/app/.env`
  - ownership `ec2-user:ec2-user` — verified via SSH `stat`
- [x] qa-admin smoke: login=200, GET /instruments=200 — verified via curl
- [x] qa-contratos smoke: login=200, GET /instruments → **HTTP 403 `{"code":"DOMAIN_FORBIDDEN",...}`** — verified via curl
- [x] qa-contratos smoke: DELETE /patients/1 → **HTTP 403 `{"code":"DOMAIN_FORBIDDEN",...}`** — verified via curl
- [x] qa-contratos allowed domains sanity: employees/certificates/nomina/auth/me all 200 — verified via curl
- [x] 500-window CLOSED

### Frontend deploy (R5)
- [x] Amplify job ID = `9` — verified via `aws amplify get-job`
- [x] Amplify job status = `SUCCEED` — verified via `aws amplify get-job --query 'job.summary.status'`
- [x] DEPLOY step: SUCCEED (2026-07-17T15:35:14 → 15:35:29, 15.4 s) — verified
- [x] VERIFY step: SUCCEED (15:35:29.624 → 15:35:29.645, 21 ms) — verified
- [x] Custom domain `https://miempresa-stg.disruptiveexp.com` → HTTP 200 — verified via curl
- [x] Amplify default domain `https://staging.d1nsxjyualdzdu.amplifyapp.com` → HTTP 200 — verified via curl
- [x] API base embedded in bundle = `miempresa-api-stg.disruptiveexp.com/api/v1` — verified via `curl + grep`

### Browser QA (R6)
- [x] **Tier 1 — RBAC live-profiles (9/9 PASS)** — verified via `playwright test tests/rbac/live-profiles.spec.ts`
- [x] **Tier 2 — RBAC nav-gating (5/5 PASS)** — verified via `playwright test tests/rbac/nav-gating.spec.ts`
- [x] **Tier 3 — Audit + dry-run (3/3 PASS)** — verified via `playwright test tests/instruments-dynamic/audit-dryrun.spec.ts`
- [x] **Tier 4 — Crear-from-template (3/3 PASS)** — verified via `playwright test tests/instruments-dynamic/crear-template.spec.ts`
- [x] **Tier 5 — Live crear-from-template + fill + score** (PASS):
  - POST /instruments (templateCodigo=BARTHEL) → HTTP 201, id=10, activeVersion id=7
  - POST /patients/1/fichas (instrumentoId=10) → HTTP 201, ficha id=1, **puntajeTotal=75, clasificacion='Dependencia moderada', subtotales={'abvd': 75}, instrumentoVersionId=7, versionRegistro='v1'** (exact match for the 10-item chosen sum=75)
  - GET /patients/1/fichas/1 → HTTP 200, same fields (no regression)
- [x] **Soft-delete test instrument**: PUT /instruments/10 `{"estado":"INACTIVO"}` → HTTP 200, estado=INACTIVO
- [x] **Legacy admin canary**: POST /auth/login `{admin@miempresa.com, <redacted>}` → HTTP 200; 8/8 domain GETs (auth/me, instruments, employees, patients, certificates, nomina, users, empresa) → HTTP 200

**Total R6 result**: 20 playwright specs + 1 live flow + 1 soft-delete + 1 legacy canary = **23/23 PASS**

---

## Failure classification (R6)

| Test | Result | Notes |
|---|---|---|
| All 9 RBAC live-profiles | ✓ PASS | Required seed patient id=1 (created via qa-admin API; not a regression — data preparation) |
| All 5 RBAC nav-gating | ✓ PASS | MOCKED — sidebar nav gating per matrix |
| All 3 audit + dry-run | ✓ PASS | MOCKED — audit view + dry-run correct |
| All 3 crear-from-template | ✓ PASS | MOCKED — selector + flow |
| Live crear-from-template + fill + score | ✓ PASS | Server-scored puntaje=75 / 'Dependencia moderada' exact match |
| Soft-delete via PUT | ✓ PASS | id=10 estado=INACTIVO |
| Legacy admin canary | ✓ PASS | DEV_USERS_ENABLED still works |

**Zero unclassified failures.**

---

## Bugs ledger (continues B27-B33 from yesterday)

| # | Phase | Issue | Mitigation applied (orchestration-layer — script NOT patched per W9 frozen-deliverable rule) | Future fix |
|---|---|---|---|---|
| **B34** | R3 | `backend/prisma/test-db/seed-qa-staging.sh` line 67 uses `declare -A` (associative array) — requires bash 4+. macOS system bash is 3.2.57 (last GPLv2 release); Homebrew ships bash 5.x at `/opt/homebrew/bin/bash`. Script as shipped is broken on every fresh macOS workstation without manual `brew install bash`. | Installed bash 5.3.15 via Homebrew; ran script with explicit `/opt/homebrew/bin/bash`. | Change the script to use parallel arrays (`EMAILS_ADMIN`, `EMAILS_GERONTOLOGA`, `EMAILS_CONTRATOS`) or use a single flat env-var-driven path; OR change shebang to `#!$(brew --prefix bash)/bin/bash` and document the brew dep. |
| **B35** | R3 | `put_param` helper in `seed-qa-staging.sh` (line 57-60) omits `--overwrite` on the `aws ssm put-parameter` call. SSM `put-parameter` defaults to `Overwrite=false`, so when ANY of the legacy alias params (`/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}`) already exist, the script aborts BEFORE running the tunnel + seed-qa.ts (the 3 main SSM pairs are created before the alias write fails; but the DB user upsert never happens). Re-running the script after a successful first run also fails for the same reason → script is non-idempotent across environments that already have the legacy alias. | Mirrored legacy alias with `aws ssm put-parameter --overwrite` (orchestration layer); ran `npx tsx prisma/test-db/seed-qa.ts` directly with the 6 env vars from SSM. | Add `--overwrite` to the `put_param` helper, OR use `aws ssm get-parameter` first and skip the put if the value already matches. |

Both bugs affect the script's correctness on every environment — not just staging. **Follow-up to be raised in a separate fix-up wave** (per team-lead instruction in PROCEED R4 message).

---

## Self-fixes during execution (orchestration-layer only — NO source changes)

| # | Phase | Issue | Fix |
|---|---|---|---|
| S1 | R1 | `pg_dump` with URI form `postgresql://...` fell back to Unix socket | Switched to conninfo form (`-h localhost -p PORT -U USER -d DB`) with `PGPASSWORD` env |
| S2 | R2 | `reset-staging-db.sh` internal `aws s3 cp` does NOT honor `--profile`; relied on `AWS_PROFILE` env | Added `AWS_PROFILE=disruptive` to the script invocation env |
| S3 | R3 | macOS system bash 3.2.57 doesn't support `declare -A` | `brew install bash 5.3.15` (local tool only); ran script with `/opt/homebrew/bin/bash` |
| S4 | R3 | script's `put_param` lacks `--overwrite` → non-idempotent | Manual mirror with `--overwrite`; ran `npx tsx prisma/test-db/seed-qa.ts` directly |
| S5 | R6 | First live-profiles run failed test 6 (no seed patient after canonical reset) | Created seed patient id=1 via qa-admin API; re-run = 9/9 PASS |
| S6 | R6 | `PATCH /instruments/:id` returns 404 (route is PUT, not PATCH) | Used `PUT /instruments/10` with `{"estado":"INACTIVO"}` body |

---

## Resource summary

| Resource | Value |
|---|---|
| Backend artifact | `s3://miempresa-artifacts-540657241795-staging/deployments/jul17-2-20260717-153212.zip` (336,426 bytes) |
| CodeDeploy deploymentId | `d-8E7JTGNMK` |
| Frontend artifact | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260717-153511.zip` (2.1 M) |
| Amplify job ID | `9` |
| Pre-release DB dump | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` (25,265 bytes, SHA256 2cf7cea2…) |
| Reset-script internal dump | `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260717-152735.sql.gz` (25.2 KiB) |
| On-instance pm2 PID | `881793` |
| Migrations applied | 22 / 22 |
| Active v1 versions | 7 (6 seed + 1 new BARTHEL_R6_TEST) |
| QA users (id) | qa-admin=5, qa-gerontologa=6, qa-contratos=7 |
| SSM `qa-*` pairs | `/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/{EMAIL,PASSWORD}` (6 params) + legacy alias mirrored |

---

## Final release summary

| Layer | State |
|---|---|
| DB schema | 22/22 migrations applied (incl new additive `20260717120000_jul17_tipo_empleado_contratos`) |
| Seed | 4 canonical users + 1 empresa + 3 legacy + 6 dynamic instruments + 6 active v1 + 7 cargos |
| DB backup | `pre-releases/pre-jul17-2.sql.gz` (25,265 B, SHA256 2cf7cea2…) + `pre-resets/pre-reset-staging-20260717-152735.sql.gz` (25.2 KiB) |
| QA users | 3 profiles (qa-admin/qa-gerontologa/qa-contratos) seeded via tunnel; SSM pairs created; legacy alias mirrored |
| Backend code | CodeDeploy `d-8E7JTGNMK` to `miempresa-app/miempresa-staging`; Succeeded; pm2 pid=881793; `/api/v1/health` 200 |
| Frontend | Amplify job 9 SUCCEED; both staging domains 200; canonical-API base baked |
| RBAC live smokes | qa-admin full; qa-gerontologa restricted; qa-contratos restricted (live 403 DOMAIN_FORBIDDEN); all RBAC tests PASS |
| Crear-from-template | Live flow: POST → fill → server-scored puntaje=75 / 'Dependencia moderada' / v1 persisted; soft-delete via PUT |
| Credential architecture | cron (root, */45min) + P0 awsCredentials.ts + .env 600 + ownership ALL INTACT |
| R6 QA | 23/23 PASS (20 playwright + 1 live flow + 1 soft-delete + 1 legacy canary); zero unclassified failures |

---

## Rollback plan (only on explicit orchestrator instruction)

| Layer | How |
|---|---|
| **Database** | Restore R1 dump (`pre-releases/pre-jul17-2.sql.gz`) via tunnel; replay `npx prisma migrate deploy`; re-run seed-qa-staging.sh. |
| **S3 uploads** | No rollback needed (bucket was empty pre-deploy). |
| **Backend code** | Redeploy prior CodeDeploy revision (`d-XIPRCXIMK` from jul-17 release; pre-jul17-2 artifacts in `s3://miempresa-artifacts-540657241795-staging/deployments/`). |
| **Frontend** | Re-run Amplify job 8 (yesterday's release) by uploading `releases/20260717-104226.zip` again. |
| **CFN stacks** | No rollback needed (no IaC changes this release). |
| **QA users / SSM** | Delete 3 `qa-*` SSM pairs and remove 3 `qa-*@miempresa.com` user rows via SQL `DELETE FROM usuarios WHERE email LIKE 'qa-%@miempresa.com'`. |

---

## Grep hooks (for fast retrieval)

`staging-release-jul17-2 fixes-jul17-2 RBAC matrix qa-admin qa-gerontologa qa-contratos CONTRATOS sub-role 22-migrations 20260717120000-jul17-tipo-empleado-contratos additive ALTER-TYPE destructive-reset pre-jul17-2.sql.gz d-8E7JTGNMK miempresa-staging-only amplify-job-9 jul17-2-20260717-153212.zip jul17-2-20260717-153511.zip pre-jul17-2 pre-reset-staging-20260717-152735 B34 B35 declare-A bash-4 put-param overwrite associative-arrays 23-of-23 RBAC-matrix-live-profiles nav-gating audit-dryrun crear-template seed-qa-staging.sh get-qa-creds.sh seed-qa.ts DOMAIN_FORBIDDEN live-403 miempresa-staging-only`