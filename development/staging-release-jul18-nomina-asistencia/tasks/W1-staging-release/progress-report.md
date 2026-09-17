# Progress: W1-staging-release
**Worker**: devops-infra (W1)  
**Started**: 2026-07-19

## Task 1 R-pre — ✓ complete
- B34: plain vars + printf -v / indirect expansion (no associative arrays)
- B35: put_param --overwrite
- Verified: bash -n (3.2 + 5.x), no `declare -A`, has overwrite
- Runbook R-pre actuals filled

## Task 2 R0 — ✓ complete (awaiting PROCEED PHASE R1)
- HEAD a169460… dirty WT
- Local migrations 23; on-instance 22; health 200
- Lightsail staging running; backups OK; Amplify d1nsxjyualdzdu
- CodeDeploy groups include prod listing — **will never target prod**
- Pre-reset rows: empresas=1 usuarios=7 instrumentos=10 fichas=2 empleados=1 nomina=0
- Uploads: 1 object (will sync in R1)

## Task 3 R1 — ✓ complete (2026-07-19) — AWAITING PROCEED PHASE R2
- PATH pg16: `/opt/homebrew/opt/postgresql@16/bin` (16.13)
- Tunnel: `db-tunnel.sh --stage staging --port 5433` (ssh PID 71576)
- Dump: `/tmp/pre-jul18-nomina-20260719-011835.sql.gz` →  
  `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz`
- Size **28726** · SHA256 **6353cc8a1123c8e0500c20ab5e7819c010b0fb9ef14e4df9810f63131097a977**
- `aws s3 ls` + head-object ContentLength=28726 verified
- Uploads sync: **1 object** (29937 B contrato docx) →  
  `…/pre-releases/s3-objects/uploads-staging-jul18-nomina/`
- Runbook R1 actuals + CHECKPOINT filled
- Note: TaskList empty in this session (TaskUpdate taskId 3 not found) — progress tracked here

## Task 3 R2 — ✓ complete (2026-07-20 12:06–12:07 local / 17:06–17:07 UTC) — AWAITING PROCEED PHASE R3
- Env: AWS_PROFILE=disruptive, AWS_REGION=us-east-1, BACKUP_BUCKET=miempresa-backups-540657241795-staging, STAGE=staging, DATABASE_URL via tunnel :5433
- Script: `./backend/infrastructure/db/scripts/reset-staging-db.sh` (no `--*` flag parsing — uses env vars; piped `reset staging` for interactive confirm)
- Pre-reset dump by script: `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz` · 29327 B · ETag f87dee3a93420e01faf412f3426d4d99
- DROP SCHEMA public CASCADE (70 cascade objects); CREATE SCHEMA public
- `npx prisma migrate deploy` → **23 migrations applied** including new `20260718100000_nomina_asistencia` (all finished_at NOT NULL)
- `npm run db:seed` → 4 users (admin/empleado/auditor/operador) + 1 empresa + 3 legacy + 6 dynamic instruments + 6 active versions
- cargos_empresa: 7 base cargos seeded for empresa id=1
- asistencia_empleados: new table, empty (0 rows) — populated post-deploy via app
- QA users: 0 (`qa-%` rows absent, confirmed via psql) — **R3 required**
- Post-reset verification via tunnel psql: empresas=1, usuarios=4, instrumentos=9, instrumentos_versiones=6, cargos_empresa=7, empleados=0, nomina_periodos=0, asistencia_empleados=0, registros_fichas_completadas=0
- Exit code 0; wall-clock ≈ 55s; full log `/tmp/r2-logs/reset-staging-db.log` (262 lines)
- Runbook R2 actuals + CHECKPOINT filled
- OP-7 reminder printed by script (seed-qa needed in R3)
- No prod touched; DATABASE_URL contains `localhost:5433/miempresa_staging` (no `prod` substring)
- Note: prior progress-report also said "PROCEED R2 2026-07-19" — actually executed 2026-07-20

## Task 3 R3 — ✓ complete (2026-07-20 12:29 local / 17:29 UTC) — AWAITING PROCEED PHASE R4
- Killed R1 tunnel (PID 71576) so seed-qa-staging.sh's own tunnel mechanism works cleanly on :5433
- `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1` → exit 0
  - 3 QA users upserted (idempotent): QA_ADMIN id=5, QA_GERONTOLOGA id=6, QA_CONTRATOS id=7
  - B34 fix confirmed: ran on `/bin/bash` 5.3 (and would run on 3.2); no `declare -A` error
  - B35 fix confirmed: SSM `QA_USER_EMAIL`/`QA_USER_PASSWORD` at Version=3 — `--overwrite` idempotent
  - Script's `trap … EXIT` killed its own tunnel on exit (verified `lsof -iTCP:5433` empty)
- `./backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1` → emails captured, **passwords redacted in log + runbook**
- SSM `get-parameters-by-path --recursive /miempresa/staging/qa/`: 8 params present (3 profile pairs + QA_USER alias pair + DEV_USERS_ENABLED), all correct types
- DB verification (tunnel :5433, opened fresh, killed after):
  - `SELECT id, email, rol, tipo_empleado FROM usuarios WHERE email LIKE 'qa-%'` → 3 rows: 5/ADMIN/null, 6/EMPLEADO/GERONTOLOGA, 7/EMPLEADO/CONTRATOS
  - Full usuarios count: 7 (4 seed + 3 QA, no collisions, no deletions)
- Runbook R3 actuals + CHECKPOINT table filled
- Logs: `/tmp/r3-logs/seed-qa-staging.log` (15 lines, no secrets), `/tmp/r3-logs/get-qa-creds.log` (redacted)
- No prod touched; all SSM ops under `/miempresa/staging/` prefix
## Task 3 R4 — 🔄 in progress (PROCEED R4 / "proceef R4") — worker-staging5
- Build from working tree completed 2026-07-20: `npm ci --no-audit --no-fund` exit 0; `npm run build` (`tsc`) exit 0.
- Artifact precondition verified: `dist/server.js` exists (724 bytes); `dist/generated` absent (on-instance `after-install.sh` regenerates Prisma client).
- Packaged `/tmp/miempresa-staging-jul20-nomina-asistencia-20260720-180836.zip` (351808 bytes), root `appspec.yml`; `dist/generated`, `src/generated`, and `node_modules` excluded.
- Uploaded staging artifact: `s3://miempresa-artifacts-540657241795-staging/deployments/jul20-nomina-asistencia-20260720-180836.zip`; `ContentLength=351808`, `ETag=3f6edcd84775402f4e1afb44fcc6c739`, `LastModified=2026-07-20T23:09:04Z`.
- Created CodeDeploy deployment `d-8OHAZOPOK` using app `miempresa-app`, group `miempresa-staging` only; initial status `Created`; revision points to the staging artifact above.
- CodeDeploy wait completed: `d-8OHAZOPOK` **Succeeded**; create `2026-07-20T18:09:30.143-05:00`, complete `2026-07-20T18:10:39.044-05:00`, `errorInformation=null`.
- Post-deploy verification (2026-07-20): SSH `cd /opt/miempresa/app && npx prisma migrate status` → `23 migrations found in prisma/migrations`; `Database schema is up to date!`.
- Health verification: `curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → `HTTP=200`, body `{"status":"ok","timestamp":"2026-07-20T23:11:31.884Z"}`.
## Task 3 R5–R6 — ⏳ gated until PROCEED PHASE R{N}

## Issues
- Accidental shutdown_request to worker-staging3 while waiting; R3 assigned to fresh worker-staging4
- R4: primary worker-staging5 (staging4 messaged PROCEED if still alive)

## Task 3 R5 — ✓ complete (2026-07-20 19:49 local / 00:49 UTC Jul 21) — auto-chaining to R6
- Driver `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive` → exit 0 (jul17-2 pattern)
- Build: Nuxt 4.3.1 static preset; **18 routes prerendered incl. new /asistencia** (jul17-2 had 17); API base baked = https://miempresa-api-stg.disruptiveexp.com/api/v1; build 14M
- Artifact: /tmp/miempresa-frontend-staging-20260720-194930.zip (2.1M) → s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260720-194930.zip
- Amplify: app d1nsxjyualdzdu branch staging → **Job 10 SUCCEED** (independent aws amplify get-job confirmed: SUCCEED, 19:49:33 to 19:49:41 local)
- Domains: custom https://miempresa-stg.disruptiveexp.com 200; default https://staging.d1nsxjyualdzdu.amplifyapp.com 200; /asistencia 200
- Runbook R5 actuals + CHECKPOINT filled. Log: /tmp/r5-logs/deploy-frontend.log
- No prod touched

## Task 3 R6 — ✓ complete (2026-07-20 ~20:05 local) — RELEASE DONE
- API canary (/tmp/r6-logs/api-canary.out): 3 logins 200 w/ correct rol+tipo
  - C1 admin: /asistencia 200, /nomina 200, /instruments 200
  - C2 contratos: /asistencia 200, /asistencia/resumen 200 (domain allow); /instruments 403 DOMAIN_FORBIDDEN (gated)
  - C3 gerontologa: /asistencia 403 DOMAIN_FORBIDDEN; /instruments 200 (regression)
  - C4 regression: /instruments 200 admin+gerontologa
- Browser canary (/tmp/r6-logs/nav-gating.out): rbac/nav-gating.spec.ts vs R5 bundle = 5/5 PASS (asistencia sidebar gating per profile + forbidden-route redirect + fichas tab)
- Creds fetched live from SSM, never printed. No staging DB mutation (reads only + mocked session). No prod. No auto-rollback.
- Runbook R6 actuals + CHECKPOINT filled; completion-report.md written.
- Deviation: instruments API path is /instruments (route) not /instrumentos (domain key) — corrected mid-canary.
