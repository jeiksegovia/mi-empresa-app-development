# Progress: staging-release-jul22-fixes
**Worker**: pt-devops-infra · **Stage**: staging · **Profile**: disruptive · **Region**: us-east-1
**HEAD**: f6503d7 · **Started**: 2026-07-22

## R0 — ✅ (preflight clean)
- HEAD f6503d7; local + instance: 23 mig up to date; health 200; Lightsail staging running.
- CodeDeploy last `d-8OHAZOPOK Succeeded` 2026-07-20; Amplify job 10 SUCCEED.
- v2 templates + VALORACION_INTEGRAL present locally; NOT on instance yet (R4 deploy).
- SSH alias `miempresa-staging` (ec2-user + miempresa-lightsail-key.pem) added.
- Uploads: 1 file (29,937 B) → sync in R1.

## R1 — ✅ (backup complete)
- DB dump: `/tmp/pre-jul22-fixes-20260722-210100.sql.gz` (27,159 B)
- SHA256: `be6207a1f8cfadbe43448ea6cfa3ff065c0df3d0b9b5952d91bce4fba49f0950`
- S3: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul22-fixes.sql.gz`
- Uploads synced: 1 file → `s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul22-fixes/`
- DB tunnel closed.
## R2 SKIP — ✅ (verify-only)
- No new migration this wave; destructive reset unnecessary.
- On-instance prisma migrate status: 23 up to date.
- Row counts: empresas=1, usuarios=7, instrumentos=9, fichas=0, empleados=1, nomina_periodos=0.
- Staging DB clean-seeded (qa users present from prior OP-7); R3 idempotent refresh will confirm.

## R3 — ✅ (seed-qa idempotent)
- 3 QA users upserted via `seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`:
  - qa-admin (id=5, ADMIN)
  - qa-gerontologa (id=6, GERONTOLOGA)
  - qa-contratos (id=7, CONTRATOS)
- Creds in SSM (`/miempresa/staging/qa/qa-*`); passwords NEVER in runbook/logs.
- Login URL: https://miempresa-stg.disruptiveexp.com/login (custom domain only).

## R4 — ✅ (BE CodeDeploy + upgrade)
- Build: `tsc` clean → `dist/server.js` 724 B; no `dist/generated`.
- Zip: `/tmp/miempresa-staging-jul22-fixes-20260722-210352.zip` (369,204 B) — included:
  - `appspec.yml` (root)
  - `dist/`, `prisma/`, `scripts/`, `infrastructure/db/scripts|utilities`
  - **`prisma/instrument-templates/TINETTI.v2.json`, `MNA_CUADRO.v2.json`, `VALORACION_INTEGRAL.v1.json`**
  - `scripts/instruments-upgrade.ts` (run on-instance via npx tsx)
- S3: `s3://miempresa-artifacts-540657241795-staging/deployments/jul22-fixes-20260722-210352.zip`
- **CodeDeploy**: `d-WSU9IQ3QK` / **Succeeded** 2026-07-22 21:05:12
- On-instance: `prisma migrate status` → 23 up to date; `instruments:upgrade` (via npx tsx + FORCE_UPGRADE=true) →
  - MNA_CUADRO v2 → activo=true (v1 deactivated)
  - TINETTI v2 → activo=true (v1 deactivated)
  - VALORACION_INTEGRAL v1 → created + activo=true
- Health: `HTTP=200 {"status":"ok"}`
- **API smokes (RBAC + instruments)**:
  - CONTRATOS POST /patients `estado:INACTIVO` → defaults to **ACTIVO** ✓
  - GERONTOLOGA PUT /patients/2 `estado:INACTIVO` → 200 ✓
  - CONTRATOS PUT /patients/2 `estado` → **403 DOMAIN_FORBIDDEN** ✓
  - ADMIN PUT /patients/2 `estado:ACTIVO` → 200 ✓
  - GERONTOLOGA GET /instruments → 200 ✓
  - CONTRATOS GET /instruments → **403 DOMAIN_FORBIDDEN** ✓
  - GET /instruments/{TINETTI,MNA_CUADRO,VALORACION_INTEGRAL}/definition → 200 with active versions

## R5 — ✅ (FE Amplify SUCCEED)
- `./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`
- Build: `nuxt generate` 18 routes prerendered.
- Zip: `/tmp/miempresa-frontend-staging-20260722-210839.zip` (2.1M)
- S3: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260722-210839.zip`
- **Amplify job 11 / SUCCEED**
- Domain checks: custom `HTTP=200` · default `HTTP=200` · /login `HTTP=200` · /pacientes/crear `HTTP=200` · /asistencia `HTTP=200`

## R6 — ✅ (canary matrix PASS)

### C1 qa-admin
- Login 200 ✓ (cookie `session=eyJ…` JWT payload includes `rol:ADMIN`)
- Instruments list: 10 instrumentos returned (incl. TINETTI, MNA_CUADRO, VALORACION_INTEGRAL, etc.) ✓
- Edit patient estado: PUT /patients/2 → 200 ACTIVO ✓

### C2 qa-contratos
- Login 200 ✓
- POST /patients `estado:INACTIVO` → server returns **`estado:ACTIVO`** (default applied) ✓
- PUT /patients/2 `estado:INACTIVO` → **403 DOMAIN_FORBIDDEN** ✓
- GET /instruments → **403 DOMAIN_FORBIDDEN** ✓
- GET /asistencia?fecha=2026-07-22 → 200 ✓ (regression)

### C3 qa-gerontologa
- Login 200 ✓
- PUT /patients/2 `estado:INACTIVO` → 200, persisted `estado:INACTIVO` ✓
- GET /instruments → 200 ✓
- GET /asistencia?fecha=2026-07-22 → **403 DOMAIN_FORBIDDEN** ✓

### C4 regression
- ADMIN GET /asistencia → 200 ✓ (1 empleado)
- ADMIN GET /instruments → 200 ✓
- ADMIN GET /patients → 200 ✓
- FE /asistencia page → HTTP=200 ✓
- 3 instrument definitions (TINETTI v2, MNA_CUADRO v2, VALORACION_INTEGRAL v1) → 200 with active versions ✓

**Canary: PASS — all 4 profiles behave per RBAC matrix; v2 instruments active; estado default-to-ACTIVO enforced for CONTRATOS; asistencia regression intact.**
