# Progress Report — Staging release jul-9

**Task ID**: 41 · **Started**: 2026-07-09 · **Baseline HEAD**: `48029efc0b46306d396f4763e0f4bef7644e4363`
**Profile / region**: `disruptive` / `us-east-1`
**Runbook**: `context/implementation-plan/staging-release-jul9-runbook.md`

---

## R0 — Local + read-only staging sanity ✅ (sent CHECKPOINT)

### Local state
- HEAD = `48029efc0b46306d396f4763e0f4bef7644e4363` (matches expected `48029ef*`) ✓
- Working tree dirty only in plan/context files (no app-code drift) ✓
- Local Prisma: **14 migrations in `prisma/migrations/`**, schema up to date (`Database schema is up to date!`) ✓
- Local backend health `http://localhost:3101/api/v1/health` → **200** ✓
- Local backend `tsc --noEmit` → clean ✓
- 10 jul-8 spec files present under `frontend/tests/local-qa/` (cert-updates, instrumentos, fichas-VENCIDO, nomina-filter, etc.) ✓

### Staging state (read-only)
- Lightsail `miempresa-backend-staging` @ **`54.144.25.72`** (running, `us-east-1`) ✓ — IP unchanged from jul-5
- `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → **200** ✓
- On-instance `prisma migrate status`: **13 migrations applied** (last = `20260705000500_jul4_nomina_foundation`), schema up to date ✓
- New migration `20260709025844_add_certificado_update` is NOT yet in `prisma/migrations/` on the instance NOR in `_prisma_migrations` — will be deployed by R3 CodeDeploy via `after-install.sh` ✓
- New table `public.certificados_empresa_updates` does NOT exist on staging (`to_regclass` = empty row) — confirmed greenfield ✓
- **Migration-risk gate**: `SELECT count(*) FROM certificados_empresa;` = **0** (only the previous two applied migrations touch this table; the new migration only removes a `DEFAULT` on `certificados_empleado.updated_at` — non-destructive) ✓

### CFN stacks (read-only)
- `miempresa-s3-staging` → `UPDATE_COMPLETE` (reconciled 2026-07-05) ✓
- `miempresa-edge-staging` → **`CREATE_COMPLETE`** ✓ (already deployed to staging — NO new edge-stack deploy needed)
- `miempresa-codedeploy` → `CREATE_COMPLETE` ✓
- `miempresa-ssm-staging` → `CREATE_COMPLETE` ✓
- `miempresa-iam` → `CREATE_COMPLETE` ✓
- `miempresa-frontend-staging` (Amplify) → `CREATE_COMPLETE` ✓
- No prod resources touched or read.

### CORS on staging uploads bucket
- `https://miempresa-stg.disruptiveexp.com`, `http://localhost:3100`, `http://localhost:3101`, `http://localhost:3102` — correct & unchanged.

### CodeDeploy application name correction
- The task assignment referenced `miempresa-api-staging` as the CodeDeploy application name.
- **Reality**: the application is named **`miempresa-app`** (matches jul-5 runbook: `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging`).
- Deployment groups: `miempresa-staging` (target) and `miempresa-prod` (DO NOT touch).
- Will use `miempresa-app` for R3 deployment.

### Key facts to record (ready for R1)
- **Migration risk**: **0 rows** in `certificados_empresa` on staging → zero risk from the new `updated_at DEFAULT` removal.
- **Edge-stack status**: exists (`CREATE_COMPLETE`) → no R1 deploy needed for edge-stack.yml.
- **Pending migrations**: only `20260709025844_add_certificado_update` (the jul-9 delta).
- **Staging IP**: `54.144.25.72` ✓
- **CORS state**: already correct, no change needed.

### Checkpoint sent to main
> CHECKPOINT: R0 sanity done. Migration risk: 0 rows in certificados_empresa (greenfield). Edge stack: exists (CREATE_COMPLETE) — no R1 new-stack deploy needed. Pending migrations: only 20260709025844_add_certificado_update. Staging IP: 54.144.25.72. CORS: 4 origins already correct. CodeDeploy app name: miempresa-app (NOT miempresa-api-staging — corrected). Ready for R1.

**Waiting for**: `PROCEED PHASE R1:` from main.

---

## R1 — IaC idempotent no-op ✅ (sent CHECKPOINT for R1+R2)

### Actions
- `aws cloudformation validate-template --template-body file://s3-stack.yml` → template valid ✓
- `aws cloudformation deploy --template-file s3-stack.yml --stack-name miempresa-s3-staging --parameter-overrides Environment=staging "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102"` →
  - `Waiting for changeset to be created..`
  - `No changes to deploy. Stack miempresa-s3-staging is up to date` ✓ (idempotent)
- `describe-stacks` → `UPDATE_COMPLETE`, `LastUpdated: 2026-07-05T19:41:19.171Z` (no drift)
- CORS unchanged. **No mutation occurred.**

### Outcome
- `miempresa-s3-staging`: no drift. No-op is the verification.
- `miempresa-edge-staging` continues to exist with `CREATE_COMPLETE`; no new stack created this release.
- **Staging prod group untouched** (`miempresa-prod` deployment group in CodeDeploy was NOT enumerated against).

---

## R2 — DB safety backup ✅ (sent CHECKPOINT for R1+R2)

### Actions (one chained ssh to instance)
```bash
sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul9-migration.sql.gz && \
  ls -la /tmp/pre-jul9-migration.sql.gz && \
  sha256sum /tmp/pre-jul9-migration.sql.gz && \
  aws s3 cp /tmp/pre-jul9-migration.sql.gz \
    s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz && \
  aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/
```
- Dump size: **14,694 bytes** (14.3 KiB) — > 5 KiB threshold ✓
- Instance-side SHA256: `ba4f8abd71062172b8d5c6c78525dea501c5e6766122efedf33d069a5cadf649`
- S3 ETag: `da753809c3a37cfe898243a46a013da2`
- `LastModified: 2026-07-09T06:05:22+00:00`
- `ServerSideEncryption: AES256` ✓
- Benign warning `could not change directory to "/home/ec2-user": Permission denied` (L17 from jul-5).

### Outcome
- Backup object exists: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz` ✓
- Staging DB is mostly empty (only QA/dev users + reference data) — 14.3 KiB is comparable to jul-5's 11.9 KiB.
- Restore path documented in the runbook's Rollback plan section.

---

## ⏸ STOPPED — waiting for `PROCEED PHASE R3:`

Per team-lead instruction: after R2 completes, **do NOT auto-progress to R3**. R3 is the point of no easy return (deploys the backend artifact, runs `prisma migrate deploy` which applies the new migration, restarts the `miempresa-api` PM2 process). Explicit approval required.

**Checkpoint sent**:
> R1 done — `No changes to deploy` for `miempresa-s3-staging` (stack `UPDATE_COMPLETE` since 2026-07-05, no drift). R2 done — staging backup `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz` uploaded: 14,694 bytes, SHA256 `ba4f8abd…`, ETag `da753809…`, SSE-AES256, LastModified 2026-07-09T06:05:22Z. STOPPED per instruction. Ready for R3 (`PROCEED PHASE R3:`) on explicit approval.

---

## R3 — Backend deploy ✅ (CodeDeploy d-M8XBER0HK, 1m 8s)

### Artifact
- Built locally: `cd backend && npm ci && npm run build` → `dist/server.js`, 209 files in zip
- Zip: `/tmp/miempresa-staging-jul9.zip` (235,550 bytes; appspec.yml at root; no `dist/generated` per L4)
- Uploaded to: `s3://miempresa-artifacts-540657241795-staging/deployments/jul9-20260709-011123.zip`
- CodeDeploy create with **corrected app+group** names: `--application-name miempresa-app --deployment-group-name miempresa-staging`

### Deployment
- DEPLOY_ID = `d-M8XBER0HK`
- `aws deploy wait deployment-successful` → exited 0 (silent success)
- `get-deployment` → `Succeeded`, `Succeeded=1, Failed=0, Pending=0`
- Previous revision: `releases/manual-jul5.zip` (jul-5 baseline); new revision: `deployments/jul9-20260709-011123.zip`
- Duration: 2026-07-09T01:11:33 → 01:12:41 (1m 8s)

### Verification
- `prisma migrate status`: **14 migrations** found, **up to date** (was 13 pre-R3) ✓
- `_prisma_migrations` top row: `20260709025844_add_certificado_update | t` ✓
- `to_regclass('public.certificados_empresa_updates')` → `certificados_empresa_updates` (table now exists) ✓
- `count(*) FROM certificados_empresa_updates` → **0** rows ✓ (greenfield)
- PM2: `miempresa-api` → `online`, `restarts: 0` ✓
- `after-install.log`: `✓ Database migrations applied`, `✓ All artifacts present`, `✓ Permissions set`, `AfterInstall completed successfully`
- `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → **200** `{"status":"ok","timestamp":"2026-07-09T06:13:26.874Z"}` (new build answering)

---

## R4 — Frontend deploy ✅ (Amplify Job 3)

### Build + deploy
- `./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`
- API_BASE = `https://miempresa-api-stg.disruptiveexp.com/api/v1` (from SSM `/miempresa/staging/frontend/API_BASE`)
- Build: 12M, Zip: 2.0M
- Uploaded to: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260709-011350.zip`
- **Amplify Job ID: 3** → `✓ Deployment SUCCEED` (first attempt)

### Verification
- `https://miempresa-stg.disruptiveexp.com/` → **200** ✓
- `https://miempresa-stg.disruptiveexp.com/certificados` → **200** ✓ (SPA fallback)
- Grep on served HTML: `miempresa-api-stg.disruptiveexp.com/api/v1` ✓ (apiBase points at staging API)

---

## R5 — Post-deploy QA ✅ (all three tiers green)

### Full staging QA (`scripts/qa-staging.sh`)
- **DB tier**: 18 passed / 0 failed
- **Backend API tier (smoke)**: 9 passed (2.8s)
  - health 200 · origin hardening · CORS preflight · wrong-pw 401 · DEV_USERS_ENABLED policy · login + cookie · /auth/me authed 200 · /auth/me unauthed 401 · logout
- **Frontend browser tier (e2e)**: 6 passed (21.3s)
  - login shell · SPA fallback · login flow · invalid creds · logout · staging-upload.spec (real S3 PUT to staging bucket)
- **TOTAL: 33/33** ✓

### jul-8 endpoint smoke (authed cookie)
| Endpoint | Status |
|---|---|
| `POST /auth/login` (qa user) | 200 |
| `GET /auth/me` | 200 |
| `GET /certificates` | 200 |
| `GET /certificates/stats` | 200 |
| `GET /instruments` | 200 (jul-8 MultiSelect target) |
| `GET /nomina?periodo=2026-07` | 200 (jul-8 filter target) |
| `GET /employees?limit=1` | 200 |
| `GET /patients/1` (with `registrosFichas`) | 200 ✓ |
| `GET /patients?limit=1` | 200 |

### Process stability
- PM2: `miempresa-api` online, `restarts: 0`
- `pm2 logs miempresa-api --err --lines 200 | grep -iE 'error|exception|fatal'` → **no matches** (excluding intentional `ZodError` from origin-hardening probe)

### Local-QA coverage that maps to staging behavior
Per task assignment R5.3 — jul-8 features have end-to-end coverage in `frontend/tests/local-qa/jul8-*.spec.ts` (10 files). They target the localhost dev stack by design (login as `admin@miempresa.com` from local seed); the implementation-level contract they assert is the same backend these staging endpoints resolve:
- `jul8-fichas-vencido-to-completado.spec.ts` → `PATCH /patients/:id/fichas/:fichaId/status`
- `jul8-cert-crear-with-update.spec.ts` + `jul8-cert-updates.spec.ts` → cert create + Agregar update + Detalle historial → backed by the new `certificados_empresa_updates` table deployed in R3
- `jul8-instrumentos-multiselect.spec.ts` + `jul8-instrumentos-editar.spec.ts` → instruments Zod refine + editar page
- `jul8-nomina-filter.spec.ts` + `jul8-nomina-cuenta-cobro-error.spec.ts` → nomina filter + cuenta-cobro required error
- `jul8-fichas-{file-stash,persistence,file-reset}.spec.ts` → ficha file reset / upload attachment

---

## ⏹ NO BLOCKERS · NO REGRESSIONS · NO ROLLBACK REQUIRED

All five phases complete; all verifications green. Ready to send FINAL COMPLETE to orchestrator.

