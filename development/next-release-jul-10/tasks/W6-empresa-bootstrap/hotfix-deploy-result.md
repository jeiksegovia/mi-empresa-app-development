# Hotfix deploy result — W6 empresa bootstrap (2026-07-10)

**Worker**: pt-devops-infra (W7) · **Task #**: 34 · **Status**: ✅ COMPLETE
**Runbook section appended**: `context/implementation-plan/staging-release-jul10-runbook.md` §"Hotfix W6 — empresa bootstrap (2026-07-10)"
**Full evidence**: `development/next-release-jul-10/tasks/devops-w6-hotfix/progress-report.md`

---

## What was deployed

A **code-only hotfix** to staging (no migrations, no IaC mutation, no SSM change):

| Layer | Artifact | Size | Identifier |
|---|---|---:|---|
| Backend | `s3://miempresa-artifacts-540657241795-staging/deployments/w6-hotfix-20260710-184923.zip` | 269 KiB | CodeDeploy `d-NT3SGP4IK` (Succeeded; 1/0/0/0/0/0) |
| Frontend | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260710-185149.zip` | 2.0 MiB | Amplify Job 5 (was Job 4 after jul-10) |

**Release group**: `miempresa-app` / `miempresa-staging` only — `miempresa-prod` not enumerated.

## Outcome

- ✅ Empresa created via API: `MI EMPRESA STAGING` (id=1, nit=900888888-1, email=admin@miempresa-staging.com)
- ✅ 7 default cargos atomically seeded via `createMany` inside the `$transaction`:
  `Auxiliar de Enfermería`, `Auxiliar de Servicios Generales`, `Educador Físico`, `Fisioterapeuta`, `Manualidades`, `Otro`, `Terapeuta Ocupacional`
- ✅ DB migration count unchanged: still 20/20 (intentional — no migrations in hotfix)
- ✅ PM2: `miempresa-api online restarts= 0 pid= 473002` (new PID since jul-10's 454011); zero error log entries
- ✅ All 3 post-deploy evidence gates pass per W6 spec §R3 post-deploy verification

## 5-step hotfix evidence

| Step | Check | Result |
|---:|---|---|
| (a) | `GET /empresa` (was 404 pre-hotfix) | `200 {"success":true,"data":null}` — normalized contract ✓ |
| (b) | `POST /empresa` (empty staging) | `201`, created `id=1, nombre=MI EMPRESA STAGING, nit=900888888-1` ✓ |
| (c) | `GET /empresa/cargos` | 7 cargos returned, names exactly match `DEFAULT_CARGOS` in `empresaService.ts:49-79` ✓ |
| (d) | On-instance DB state | `empresas=1, cargos=7, contratos=0` ✓ |
| (e) | Idempotency: second `POST /empresa` | `409 {"success":false,"message":"La empresa ya existe","field":"empresa"}` ✓ |

## QA results

- **DB tier**: 18/18 (config-drift check included — SSM password still verifies against DB bcrypt hash; confirms staging user table intact after deploy)
- **Backend API smoke**: 9/9 (2.8 s)
- **Frontend browser e2e**: 6/6 (17.5 s) — full Chromium spin-up of login, SPA fallback, real S3 upload
- **Total**: 33/33 green ✓
- **Wider cookie-authed regression smoke**: 10/10 reachable (`/auth/me, /empresa, /empresa/cargos, /certificates, /certificates/stats, /instruments, /nomina?periodo=2026-07, /employees?limit=1, /patients?limit=1, /users`) — zero regressions

## Pre-conditions verified (R0)

- HEAD: `48029efc0b46306d396f4763e0f4bef7644e4363` — matches jul-10 baseline (no new commits, per task spec)
- Local: `prisma migrate status` → 20/20 up to date (✓ matches expected — no migrations in hotfix)
- Local: `tsc --noEmit` → clean (exit 0)
- Public staging health: 200
- On-instance migration status: 20/20 (matches local)
- On-instance DB state pre-hotfix: `empresas=0, cargos_empresa=0, contratos=0` — confirms W6 BEFORE evidence
- CodeDeploy targets: `miempresa-app` (correct), `miempresa-staging` (only staging group used)

## Safety

- ✅ Confirmed `--region us-east-1 --profile disruptive` on every AWS command (defense in depth)
- ✅ All AWS results filtered for `prod` — none found in mutation commands
- ✅ Database backup `s3://miempresa-backups-540657241795-staging/pre-releases/pre-w6-hotfix.sql.gz` (18,906 bytes, SHA256=`c961f870…`, AES256 encrypted) — coexists with prior `pre-jul10.sql.gz` + `pre-jul9.sql.gz`
- ✅ Did NOT run `prisma migrate diff --shadow-database-url` anywhere
- ✅ Did NOT git-commit (per task spec)
- ✅ Did NOT touch any `miempresa-prod*` resource (deployment group, stack, bucket, instance)

## Rollback (not needed — green; documented for audit trail)

- Backend: redeploy prior jul-10 artifact `deployments/jul10-20260710-104847.zip` via `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging …`
- Frontend: redeploy prior Amplify job artifact (Job 4 from jul-10 = `miempresa-frontend-artifacts-540657241795-staging/releases/`)
- DB: restore `pre-w6-hotfix.sql.gz` (loses seeded empresa + cargos; re-run hotfix POST afterwards)

## Files for the next worker / orchestrator review

| File | Purpose |
|---|---|
| `context/implementation-plan/staging-release-jul10-runbook.md` §"Hotfix W6 — empresa bootstrap (2026-07-10)" | **Verbatim commands + outputs** for every R0/R2/R3 (incl. 5-step evidence)/R4/R5 step |
| `development/next-release-jul-10/tasks/devops-w6-hotfix/progress-report.md` | Per-phase chronological log with full output capture |
| `development/next-release-jul-10/tasks/W6-empresa-bootstrap/hotfix-deploy-result.md` | This file — summary |
EOF
echo "wrote hotfix-deploy-result.md"