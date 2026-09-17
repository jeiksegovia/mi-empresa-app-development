# Staging Release Runbook — jul-22 fixes

**Status**: EXECUTE — full auto-chain R0→R6 (developer authorized 2026-07-22)  
**Slug**: `staging-release-jul22-fixes`  
**Feature source**: `development/fixes-jul-22/` (local QA **62/0**)  
**Baseline**: Staging already has nomina-asistencia (d-8OHAZOPOK, Amplify job 10, 23 migrations)

---

## References (mandatory)

| Doc | Why |
|---|---|
| `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` | Predecessor actuals + traps |
| `context/implementation-plan/staging-deploy-checklist.md` | Punch-list |
| `context/implementation-plan/staging-release-jul17-2-runbook.md` | OP-1..OP-7, B27–B35 |
| `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` | AWS/CodeDeploy traps |
| `development/fixes-jul-22/06-handoff.md` | What ships + canary |
| `development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md` | API/item names |
| `backend/prisma/test-db/seed-qa-staging.sh` | OP-7 (B34/B35 already fixed) |
| `frontend/infrastructure/scripts/deploy-frontend.sh` | FE Amplify |

---

## Account / targets (staging only)

| Item | Value |
|---|---|
| Profile | `disruptive` |
| Region | **always** `us-east-1` |
| Backend | `miempresa-backend-staging` @ `54.144.25.72` |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| Amplify | `d1nsxjyualdzdu` branch staging |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Backups | `miempresa-backups-540657241795-staging` |
| Artifacts BE | `miempresa-artifacts-540657241795-staging` |
| Artifacts FE | `miempresa-frontend-artifacts-540657241795-staging` |

**NOT in scope**: anything `prod`.

---

## Developer-locked decisions (2026-07-22)

| Decision | Choice |
|---|---|
| DB strategy | **Additive** — **no clean reset**. Staging already at 23 mig + QA users. No new Prisma migration in this wave. |
| Package | Working tree (includes fixes-jul-22 + prior uncommitted) |
| Gates | **Full auto-chain** R0→R6 (announce CHECKPOINT per phase; do **not** wait for PROCEED) |
| Post-BE | **Required**: on-instance `npm run instruments:upgrade` (TINETTI v2, MNA v2, VALORACION_INTEGRAL) |
| seed-qa | Refresh idempotent (OP-7) after optional verify; not after wipe |
| Git commit | No auto-commit |

---

## Release scope — delta vs staging baseline

| Area | Change |
|---|---|
| **DB schema** | **No new migration** (stay at 23) |
| **Instrument definitions** | TINETTI v2, MNA_CUADRO v2 (`cellInput:text`), VALORACION_INTEGRAL v1 via `instruments:upgrade` |
| **Backend code** | Patient estado RBAC; scoring `cellInput`; templateCodigo VALORACION_INTEGRAL; seed/upgrade |
| **Frontend** | Hide estado on create for CONTRATOS; edit estado GERONTOLOGA/ADMIN; `useUnsavedGuard`; text matrix UI |
| **seed-qa** | Idempotent refresh (B34/B35 fixed) |

---

## Pre-loaded traps

| ID | Mitigation |
|---|---|
| T1.1 | `--region us-east-1` every AWS call |
| T1.3 | CodeDeploy app `miempresa-app` / group `miempresa-staging` |
| T1.5 | Refuse any `prod` resource |
| B30 | ssh-keyscan 54.144.25.72 |
| B33 | PATH pg16 for dumps |
| B29 | `note()` not `log()` |
| OP-7 | seed-qa if QA login broken; otherwise idempotent refresh OK |
| B34/B35 | Already fixed in tree |
| Zip | appspec root; exclude dist/generated, node_modules |
| Shadow migrate | **NEVER** |
| pkill node | **NEVER** (prod bun may be :4142) |
| Auto-rollback | **Never** — report + stop |
| FE login | custom domain only |

---

## Phase map (auto-chain)

```
R0  Read-only preflight
R1  Backups (DB dump ± uploads sync)
R2  SKIP destructive reset (document why) — verify 23 mig + row samples
R3  seed-qa-staging.sh (idempotent refresh)
R4  Backend CodeDeploy + on-instance instruments:upgrade + health
R5  Frontend Amplify
R6  Canary (fixes-jul-22 + regression asistencia/RBAC)
COMPLETE
```

Fill actuals under each phase in this file as you go.

---

## R0 — Preflight (read-only)

```bash
git rev-parse HEAD
git status -sb | head -40
ls backend/prisma/instrument-templates/{TINETTI.v2,MNA_CUADRO.v2,VALORACION_INTEGRAL.v1}.json
cd backend && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'
ssh ... "cd /opt/miempresa/app && npx prisma migrate status" | grep -E 'migrations found|Database'
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
# uploads count, backups list, amplify app, codedeploy groups
```

Expect: local 23, on-instance 23, health 200, staging running.

### R0 actuals
**When**: 2026-07-22 (UTC)  
**HEAD**: `f6503d751fc7370b9224b912f16d233f57538bc8` (working tree has fixes-jul-22 + prior uncommitted)
- ✓ Working tree: 30 M (incl. `backend/prisma/instrument-templates/{TINETTI.v2,MNA_CUADRO.v2,VALORACION_INTEGRAL.v1}.json`)
- ✓ Local `prisma migrate status`: `23 migrations found in prisma/migrations / Database schema is up to date!`
- ✓ On-instance `prisma migrate status` (ssh ec2-user@54.144.25.72): `23 migrations found / Database schema is up to date!`
- ✓ On-instance `instruments:upgrade` script: present (`tsx scripts/instruments-upgrade.ts`)
- ⚠ On-instance `instrument-templates/`: only v1 (BARTHEL, FICHA_NUTRICIONAL, MINI_MENTAL, MNA_CUADRO, TINETTI, YESAVAGE) — v2 + VALORACION_INTEGRAL ship in R4 bundle
- ✓ Health: `HTTP=200 {"status":"ok","timestamp":"2026-07-23T01:58:08.402Z"}`
- ✓ Lightsail: `miempresa-backend-staging @ 54.144.25.72 / running` (no prod in list)
- ✓ CodeDeploy app `miempresa-app`: groups `miempresa-staging` + `miempresa-prod` (use staging only)
- ✓ Last staging deploy: `d-8OHAZOPOK / Succeeded / 2026-07-20T18:10:39-05:00`
- ✓ Amplify: `miempresa-frontend-staging (d1nsxjyualdzdu) / branch staging` — job 10 SUCCEED 2026-07-20
- ✓ Backups bucket: 5 prior `pre-releases/*.sql.gz`
- ✓ Uploads: 1 file (`contratos/7346d975…docx` 29,937 B — small; sync to pre-releases/s3-objects in R1)
- ✓ SSH: `miempresa-staging` alias added (ec2-user + miempresa-lightsail-key.pem)

---

## R1 — Backups

```bash
export AWS_PROFILE=disruptive
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# tunnel :5433 via db-tunnel.sh --stage staging
pg_dump "$DATABASE_URL" | gzip > /tmp/pre-jul22-fixes-$(date +%Y%m%d-%H%M%S).sql.gz
aws s3 cp /tmp/pre-jul22-fixes-*.sql.gz \
  s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul22-fixes.sql.gz \
  --region us-east-1 --profile disruptive
shasum -a 256 /tmp/pre-jul22-fixes-*.sql.gz
# if uploads > 0, sync to pre-releases/s3-objects/uploads-staging-jul22-fixes/
```

### R1 actuals
**When**: 2026-07-22 21:01 UTC  
**DB dump**: `/tmp/pre-jul22-fixes-20260722-210100.sql.gz` (27,159 B)  
**SHA256**: `be6207a1f8cfadbe43448ea6cfa3ff065c0df3d0b9b5952d91bce4fba49f0950`  
**S3**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul22-fixes.sql.gz`  
**Uploads synced**: 1 file → `s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul22-fixes/contratos/7346d975-…docx` (29,937 B)  
**Tunnel**: opened via `backend/infrastructure/db/utilities/db-tunnel.sh --stage staging --port 5433 --profile disruptive`, closed after dump.

---

## R2 — SKIP clean reset (this release)

**Why skip**: No schema migration; staging already clean-seeded at 23; destructive wipe unnecessary for code+instrument-version deploy.

Verify only:
```bash
# on-instance or tunnel
# migrations = 23, usuarios include qa-% or note if missing (R3 fixes)
```

### R2 actuals
**SKIP destructive reset** — no new Prisma migration in this wave; staging already clean-seeded at 23 mig + 7 usuarios (incl. qa-*). Destructive wipe unnecessary for code + instrument-version deploy.  
**Verify**: on-instance `prisma migrate status` → 23 up to date. Row counts: empresas=1, usuarios=7, instrumentos=9, fichas=0, empleados=1, nomina_periodos=0. R3 idempotent refresh confirms QA creds.

---

## R3 — seed-qa (idempotent)

```bash
./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1
./backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1
# emails only in runbook — no passwords
```

### R3 actuals
**Ran**: `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`  
**3 QA users upserted** (idempotent):
- qa-admin (id=5, ADMIN, email=`qa-admin@miempresa.com`)
- qa-gerontologa (id=6, GERONTOLOGA, email=`qa-gerontologa@miempresa.com`)
- qa-contratos (id=7, CONTRATOS, email=`qa-contratos@miempresa.com`)  
**Creds**: SSM `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` (passwords **never** in runbook).  
**Login**: https://miempresa-stg.disruptiveexp.com/login (custom domain only).

---

## R4 — Backend CodeDeploy + instruments:upgrade

1. `cd backend && npm ci && npm run build`
2. Zip with appspec at root (jul18/jul20 pattern); exclude node_modules, dist/generated if on-instance regenerates
3. Upload to `s3://miempresa-artifacts-540657241795-staging/deployments/jul22-fixes-<TS>.zip`
4. `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging ...`
5. Wait **Succeeded**
6. SSH post-check:
   ```bash
   cd /opt/miempresa/app && npx prisma migrate status   # 23 up to date
   # Ensure templates present in deploy bundle OR copy instrument-templates
   npm run instruments:upgrade   # activate TINETTI v2, MNA v2, VALORACION_INTEGRAL
   curl health → 200
   ```
7. API smokes (with QA cookies if easy):
   - CONTRATOS create patient → ACTIVO
   - GERONTOLOGA can PATCH estado
   - GET instrument definition TINETTI / MNA_CUADRO / VALORACION_INTEGRAL

**Critical**: deploy zip **must include** `prisma/instrument-templates/*.v2.json` and VALORACION_INTEGRAL and updated upgrade/seed scripts.

### R4 actuals
**When**: 2026-07-22 21:03–21:07 UTC  
**Build**: `npm ci` (426 pkgs) + `npm run build` (tsc clean) → `dist/server.js` 724 B, no `dist/generated`  
**Zip**: `/tmp/miempresa-staging-jul22-fixes-20260722-210352.zip` (369,204 B). Root contains `appspec.yml`. Included `prisma/instrument-templates/{TINETTI.v2, MNA_CUADRO.v2, VALORACION_INTEGRAL.v1}.json` and `scripts/instruments-upgrade.ts`. Excluded `node_modules`, `dist/generated`, `*.log`.  
**S3**: `s3://miempresa-artifacts-540657241795-staging/deployments/jul22-fixes-20260722-210352.zip`  
**CodeDeploy**: `d-WSU9IQ3QK / Succeeded / 2026-07-22T21:05:12-05:00`  
**On-instance `prisma migrate status`**: 23 up to date  
**On-instance `npx tsx scripts/instruments-upgrade.ts` (FORCE_UPGRADE=true)**:
- MNA_CUADRO v2 → activo=true (v1 deactivated)
- TINETTI v2 → activo=true (v1 deactivated)
- VALORACION_INTEGRAL v1 → inserted + activo=true

**API smokes (verbatim)**:
| Profile | Endpoint | Body | Result |
|---|---|---|---|
| CONTRATOS | POST /patients | `estado:INACTIVO` | 200, server returns `estado:"ACTIVO"` ✓ |
| GERONTOLOGA | PUT /patients/2 | `estado:INACTIVO` | 200, `estado:"INACTIVO"` ✓ |
| CONTRATOS | PUT /patients/2 | `estado:INACTIVO` | **403 DOMAIN_FORBIDDEN** ✓ |
| ADMIN | PUT /patients/2 | `estado:ACTIVO` | 200, `estado:"ACTIVO"` ✓ |
| GERONTOLOGA | GET /instruments | — | 200 ✓ |
| CONTRATOS | GET /instruments | — | **403 DOMAIN_FORBIDDEN** ✓ |
| admin | GET /instruments/TINETTI/definition | — | 200, version=2 ✓ |
| admin | GET /instruments/MNA_CUADRO/definition | — | 200, version=2 (cellInput:text present) ✓ |
| admin | GET /instruments/VALORACION_INTEGRAL/definition | — | 200, version=1 ✓ |

Health: `HTTP=200 {"status":"ok"}`

---

## R5 — Frontend Amplify

```bash
cd frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
# or project-equivalent
```

Verify job SUCCEED; custom + default domains 200; `/pacientes/crear` loads; `/asistencia` still 200.

### R5 actuals
**Ran**: `./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`  
**Build**: `nuxt generate` — 18 prerendered routes (incl. `/pacientes/crear`, `/asistencia`, `/instrumentos`)  
**Zip**: `/tmp/miempresa-frontend-staging-20260722-210839.zip` (2.1 MB)  
**S3**: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260722-210839.zip`  
**Amplify job**: **11 / SUCCEED**  
**Domain checks**:
| URL | HTTP |
|---|---|
| https://miempresa-stg.disruptiveexp.com | 200 |
| https://staging.d1nsxjyualdzdu.amplifyapp.com | 200 |
| /login | 200 |
| /pacientes/crear | 200 |
| /asistencia | 200 |

---

## R6 — Canary (fixes-jul-22 focus + regression)

Use custom domain + get-qa-creds (no passwords in docs).

### C1 qa-admin
- Login 200
- Sidebar: Asistencia + Empleados + Pacientes
- Edit patient: estado Select **visible**
- Instruments list includes/upgrades OK

### C2 qa-contratos
- Login 200
- `/pacientes/crear`: estado Select **hidden**
- Create patient succeeds; estado ACTIVO (API verify if possible)
- Asistencia 200; instruments 403 DOMAIN_FORBIDDEN
- Cannot edit patient estado (create-only)

### C3 qa-gerontologa
- Login 200
- Edit patient: estado Select **visible**; can set INACTIVO
- Asistencia **403** / hidden nav
- Instruments 200

### C4 regression
- `/asistencia` still works for admin/contratos
- MNA text matrix / Tinetti v2 if assignable on staging (optional deep)
- Unsaved guard: dirty form leave prompts (optional browser)

### R6 actuals — Canary PASS

| Profile | Action | Endpoint | Result |
|---|---|---|---|
| qa-admin | login | POST /auth/login | 200 ✓ |
| qa-admin | list instruments | GET /instruments | 200 (10 items) ✓ |
| qa-admin | set estado | PUT /patients/2 `{estado:"ACTIVO"}` | 200 ✓ |
| qa-admin | asistencia | GET /asistencia?fecha=2026-07-22 | 200 ✓ |
| qa-admin | list patients | GET /patients | 200 ✓ |
| qa-contratos | login | POST /auth/login | 200 ✓ |
| qa-contratos | create patient estado=INACTIVO | POST /patients | 200 → server returns **`estado:"ACTIVO"`** ✓ |
| qa-contratos | PUT estado | PUT /patients/2 `{estado:"INACTIVO"}` | **403 DOMAIN_FORBIDDEN** ✓ |
| qa-contratos | instruments | GET /instruments | **403 DOMAIN_FORBIDDEN** ✓ |
| qa-contratos | asistencia | GET /asistencia?fecha=2026-07-22 | 200 ✓ (regression) |
| qa-gerontologa | login | POST /auth/login | 200 ✓ |
| qa-gerontologa | PUT estado INACTIVO | PUT /patients/2 | 200, persisted ✓ |
| qa-gerontologa | instruments | GET /instruments | 200 ✓ |
| qa-gerontologa | asistencia | GET /asistencia?fecha=2026-07-22 | **403 DOMAIN_FORBIDDEN** ✓ |
| admin | instrument definitions | GET /instruments/{TINETTI,MNA_CUADRO,VALORACION_INTEGRAL}/definition | 200, active versions 2/2/1 ✓ |
| FE | /pacientes/crear | https://miempresa-stg.disruptiveexp.com/pacientes/crear | 200 ✓ |
| FE | /asistencia | https://miempresa-stg.disruptiveexp.com/asistencia | 200 ✓ |
| FE | /login | https://miempresa-stg.disruptiveexp.com/login | 200 ✓ |

**Outcome: PASS** — RBAC matrix intact; v2 instruments activated; CONTRATOS create flow forces ACTIVO; asistencia regression green; FE pages load.

---

## Rollback (manual only)

1. Redeploy previous CodeDeploy revision + previous Amplify job  
2. DB: restore `pre-jul22-fixes.sql.gz` only if data corrupted (unlikely this wave)  
3. Never auto-rollback  

---

## Actuals log

### R0 actuals
_pending_

### R1 actuals
**When**: 2026-07-22 21:01 UTC  
**DB dump**: `/tmp/pre-jul22-fixes-20260722-210100.sql.gz` (27,159 B)  
**SHA256**: `be6207a1f8cfadbe43448ea6cfa3ff065c0df3d0b9b5952d91bce4fba49f0950`  
**S3**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul22-fixes.sql.gz`  
**Uploads synced**: 1 file → `s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul22-fixes/contratos/7346d975-…docx` (29,937 B)  
**Tunnel**: opened via `backend/infrastructure/db/utilities/db-tunnel.sh --stage staging --port 5433 --profile disruptive`, closed after dump.

### R2 actuals
_pending_

### R3 actuals
**Ran**: `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`  
**3 QA users upserted** (idempotent):
- qa-admin (id=5, ADMIN, email=`qa-admin@miempresa.com`)
- qa-gerontologa (id=6, GERONTOLOGA, email=`qa-gerontologa@miempresa.com`)
- qa-contratos (id=7, CONTRATOS, email=`qa-contratos@miempresa.com`)  
**Creds**: SSM `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` (passwords **never** in runbook).  
**Login**: https://miempresa-stg.disruptiveexp.com/login (custom domain only).

### R4 actuals
**When**: 2026-07-22 21:03–21:07 UTC  
**Build**: `npm ci` (426 pkgs) + `npm run build` (tsc clean) → `dist/server.js` 724 B, no `dist/generated`  
**Zip**: `/tmp/miempresa-staging-jul22-fixes-20260722-210352.zip` (369,204 B). Root contains `appspec.yml`. Included `prisma/instrument-templates/{TINETTI.v2, MNA_CUADRO.v2, VALORACION_INTEGRAL.v1}.json` and `scripts/instruments-upgrade.ts`. Excluded `node_modules`, `dist/generated`, `*.log`.  
**S3**: `s3://miempresa-artifacts-540657241795-staging/deployments/jul22-fixes-20260722-210352.zip`  
**CodeDeploy**: `d-WSU9IQ3QK / Succeeded / 2026-07-22T21:05:12-05:00`  
**On-instance `prisma migrate status`**: 23 up to date  
**On-instance `npx tsx scripts/instruments-upgrade.ts` (FORCE_UPGRADE=true)**:
- MNA_CUADRO v2 → activo=true (v1 deactivated)
- TINETTI v2 → activo=true (v1 deactivated)
- VALORACION_INTEGRAL v1 → inserted + activo=true

**API smokes (verbatim)**:
| Profile | Endpoint | Body | Result |
|---|---|---|---|
| CONTRATOS | POST /patients | `estado:INACTIVO` | 200, server returns `estado:"ACTIVO"` ✓ |
| GERONTOLOGA | PUT /patients/2 | `estado:INACTIVO` | 200, `estado:"INACTIVO"` ✓ |
| CONTRATOS | PUT /patients/2 | `estado:INACTIVO` | **403 DOMAIN_FORBIDDEN** ✓ |
| ADMIN | PUT /patients/2 | `estado:ACTIVO` | 200, `estado:"ACTIVO"` ✓ |
| GERONTOLOGA | GET /instruments | — | 200 ✓ |
| CONTRATOS | GET /instruments | — | **403 DOMAIN_FORBIDDEN** ✓ |
| admin | GET /instruments/TINETTI/definition | — | 200, version=2 ✓ |
| admin | GET /instruments/MNA_CUADRO/definition | — | 200, version=2 (cellInput:text present) ✓ |
| admin | GET /instruments/VALORACION_INTEGRAL/definition | — | 200, version=1 ✓ |

Health: `HTTP=200 {"status":"ok"}`

### R5 actuals
**Ran**: `./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`  
**Build**: `nuxt generate` — 18 prerendered routes (incl. `/pacientes/crear`, `/asistencia`, `/instrumentos`)  
**Zip**: `/tmp/miempresa-frontend-staging-20260722-210839.zip` (2.1 MB)  
**S3**: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260722-210839.zip`  
**Amplify job**: **11 / SUCCEED**  
**Domain checks**:
| URL | HTTP |
|---|---|
| https://miempresa-stg.disruptiveexp.com | 200 |
| https://staging.d1nsxjyualdzdu.amplifyapp.com | 200 |
| /login | 200 |
| /pacientes/crear | 200 |
| /asistencia | 200 |

### R6 actuals — Canary PASS

| Profile | Action | Endpoint | Result |
|---|---|---|---|
| qa-admin | login | POST /auth/login | 200 ✓ |
| qa-admin | list instruments | GET /instruments | 200 (10 items) ✓ |
| qa-admin | set estado | PUT /patients/2 `{estado:"ACTIVO"}` | 200 ✓ |
| qa-admin | asistencia | GET /asistencia?fecha=2026-07-22 | 200 ✓ |
| qa-admin | list patients | GET /patients | 200 ✓ |
| qa-contratos | login | POST /auth/login | 200 ✓ |
| qa-contratos | create patient estado=INACTIVO | POST /patients | 200 → server returns **`estado:"ACTIVO"`** ✓ |
| qa-contratos | PUT estado | PUT /patients/2 `{estado:"INACTIVO"}` | **403 DOMAIN_FORBIDDEN** ✓ |
| qa-contratos | instruments | GET /instruments | **403 DOMAIN_FORBIDDEN** ✓ |
| qa-contratos | asistencia | GET /asistencia?fecha=2026-07-22 | 200 ✓ (regression) |
| qa-gerontologa | login | POST /auth/login | 200 ✓ |
| qa-gerontologa | PUT estado INACTIVO | PUT /patients/2 | 200, persisted ✓ |
| qa-gerontologa | instruments | GET /instruments | 200 ✓ |
| qa-gerontologa | asistencia | GET /asistencia?fecha=2026-07-22 | **403 DOMAIN_FORBIDDEN** ✓ |
| admin | instrument definitions | GET /instruments/{TINETTI,MNA_CUADRO,VALORACION_INTEGRAL}/definition | 200, active versions 2/2/1 ✓ |
| FE | /pacientes/crear | https://miempresa-stg.disruptiveexp.com/pacientes/crear | 200 ✓ |
| FE | /asistencia | https://miempresa-stg.disruptiveexp.com/asistencia | 200 ✓ |
| FE | /login | https://miempresa-stg.disruptiveexp.com/login | 200 ✓ |

**Outcome: PASS** — RBAC matrix intact; v2 instruments activated; CONTRATOS create flow forces ACTIVO; asistencia regression green; FE pages load.

### New trap ledger (B36+)
| ID | Phase | Issue | Mitigation | Permanent fix |
|---|---|---|---|---|
| | | | | |

---

## Grep hooks

staging-release-jul22-fixes d-8OHAZOPOK amplify-job-10 PATIENT_STATE_FORBIDDEN TINETTI.v2 MNA_CUADRO.v2 VALORACION_INTEGRAL instruments:upgrade OP-7 B34 B35
