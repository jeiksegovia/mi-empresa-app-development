# Completion Report — staging-release-jul22-fixes

**Worker**: pt-devops-infra · **Stage**: staging · **Profile**: `disruptive` · **Region**: `us-east-1`
**Plan**: `development/staging-release-jul22-fixes/`
**Runbook**: `context/implementation-plan/staging-release-jul22-fixes-runbook.md` (all phases filled)
**Started**: 2026-07-22 21:00 UTC · **Completed**: 2026-07-22 21:10 UTC

---

## 1. Result

**PASS — staging release `jul22-fixes` shipped end-to-end R0 → R6.** No prod touched. No auto-rollback. No destructive reset (R2 skipped with evidence). No shadow migrate. No `pkill node`. No passwords in runbook.

| Phase | Status | Evidence |
|---|---|---|
| R0 preflight | ✅ | 23 mig local + on-instance; health 200; Lightsail staging running; CodeDeploy app `miempresa-app` / group `miempresa-staging`; Amplify app `d1nsxjyualdzdu`; SSH alias added |
| R1 backups | ✅ | DB dump 27,159 B (sha256 `be6207a1…`); 1 upload synced to `pre-releases/s3-objects/uploads-staging-jul22-fixes/` |
| R2 SKIP wipe | ✅ | No new migration; verified 23 mig up to date; 7 usuarios incl. qa-* present |
| R3 seed-qa | ✅ | 3 QA users idempotent upsert (admin id=5, gerontologa id=6, contratos id=7); creds in SSM only |
| R4 BE deploy | ✅ | CodeDeploy **`d-WSU9IQ3QK` / Succeeded**; zip 369,204 B w/ `prisma/instrument-templates/{TINETTI.v2, MNA_CUADRO.v2, VALORACION_INTEGRAL.v1}.json`; `instruments:upgrade` activated v2 versions |
| R5 FE Amplify | ✅ | Amplify **job 11 / SUCCEED**; custom + default domain 200; /login /pacientes/crear /asistencia 200 |
| R6 canary | ✅ | Full RBAC matrix PASS across qa-admin / qa-contratos / qa-gerontologa; v2 instruments active; CONTRATOS estado defaults to ACTIVO; asistencia regression intact |

---

## 2. Resource IDs / verification commands

### Backend (CodeDeploy)
- Application: `miempresa-app` · Deployment group: **`miempresa-staging`** (no prod)
- Deployment ID: **`d-WSU9IQ3QK`** · Status: **Succeeded** · Created 2026-07-22T21:04:03-05:00 · Completed 21:05:12-05:00
- S3 artifact: `s3://miempresa-artifacts-540657241795-staging/deployments/jul22-fixes-20260722-210352.zip` (369,204 B)
- Local zip: `/tmp/miempresa-staging-jul22-fixes-20260722-210352.zip`
- Verify:
  ```bash
  aws deploy get-deployment --deployment-id d-WSU9IQ3QK --region us-east-1 --profile disruptive \
    --query 'deploymentInfo.[status,createTime,completeTime]' --output table
  ```

### Frontend (Amplify)
- App ID: `d1nsxjyualdzdu` (`miempresa-frontend-staging`) · Branch: `staging`
- Job ID: **11** · Status: **SUCCEED** · Started 2026-07-22T21:08:39-05:00
- S3 artifact: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260722-210839.zip` (2.1 MB)
- Local zip: `/tmp/miempresa-frontend-staging-20260722-210839.zip`
- Custom domain: `https://miempresa-stg.disruptiveexp.com` (HTTP 200)
- Verify:
  ```bash
  aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging --region us-east-1 --max-items 2 \
    --query 'jobSummaries[].[jobId,status,startTime]' --output table
  ```

### Database
- Engine: PostgreSQL @ `miempresa-backend-staging` (54.144.25.72) → localhost:5432 (tunnel)
- Migrations: 23/23 up to date (no new migration this wave)
- Backup: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul22-fixes.sql.gz`
  - sha256: `be6207a1f8cfadbe43448ea6cfa3ff065c0df3d0b9b5952d91bce4fba49f0950`
- Verify migrations:
  ```bash
  ssh miempresa-staging 'cd /opt/miempresa/app && npx prisma migrate status' | grep -E 'migrations found|Database'
  # → 23 migrations found in prisma/migrations
  # → Database schema is up to date!
  ```
- Verify instrument versions:
  ```bash
  ssh miempresa-staging 'sudo -u postgres psql -d miempresa_staging -c \
    "SELECT i.codigo, iv.version_numero, iv.activo FROM instrumentos_versiones iv \
     JOIN instrumentos i ON iv.instrumento_id=i.instrumento_id \
     WHERE i.codigo IN ('"'"'TINETTI'"'"','"'"'MNA_CUADRO'"'"','"'"'VALORACION_INTEGRAL'"'"') \
     ORDER BY i.codigo, iv.version_numero DESC;"'
  # → TINETTI v2 activo=t · MNA_CUADRO v2 activo=t · VALORACION_INTEGRAL v1 activo=t
  ```

### Health
- API: `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → `HTTP 200 {"status":"ok"}`
- FE custom: `https://miempresa-stg.disruptiveexp.com` → `HTTP 200`
- FE default: `https://staging.d1nsxjyualdzdu.amplifyapp.com` → `HTTP 200`

---

## 3. Canary matrix (verbatim evidence)

All commands executed with cookies obtained via `POST /api/v1/auth/login` (no passwords persisted).

### C1 qa-admin (`qa-admin@miempresa.com`)
| Action | Result |
|---|---|
| `POST /auth/login` | 200 `{user:{rol:"ADMIN"}}` |
| `GET /instruments` | 200, 10 items |
| `PUT /patients/2 {estado:"ACTIVO"}` | 200 ACTIVO |
| `GET /asistencia?fecha=2026-07-22` | 200 |
| `GET /patients` | 200 |
| `GET /instruments/TINETTI/definition` | 200, version=2 activo |
| `GET /instruments/MNA_CUADRO/definition` | 200, version=2 activo (cellInput:text present) |
| `GET /instruments/VALORACION_INTEGRAL/definition` | 200, version=1 activo |

### C2 qa-contratos (`qa-contratos@miempresa.com`)
| Action | Result |
|---|---|
| `POST /auth/login` | 200 `{user:{rol:"EMPLEADO",tipoEmpleado:"CONTRATOS"}}` |
| `POST /patients {…, estado:"INACTIVO"}` | 200 → server returns **`estado:"ACTIVO"`** (RBAC fix) ✓ |
| `PUT /patients/2 {estado:"INACTIVO"}` | **403 DOMAIN_FORBIDDEN** ✓ |
| `GET /instruments` | **403 DOMAIN_FORBIDDEN** ✓ |
| `GET /asistencia?fecha=2026-07-22` | 200 ✓ (regression) |

### C3 qa-gerontologa (`qa-gerontologa@miempresa.com`)
| Action | Result |
|---|---|
| `POST /auth/login` | 200 `{user:{rol:"EMPLEADO",tipoEmpleado:"GERONTOLOGA"}}` |
| `PUT /patients/2 {estado:"INACTIVO"}` | 200, persisted INACTIVO ✓ |
| `GET /instruments` | 200 ✓ |
| `GET /asistencia?fecha=2026-07-22` | **403 DOMAIN_FORBIDDEN** ✓ |

### C4 regression
- ADMIN GET /asistencia → 200 (1 empleado)
- ADMIN GET /instruments → 200
- ADMIN GET /patients → 200
- FE `/pacientes/crear` → 200
- FE `/asistencia` → 200
- FE `/login` → 200

**Outcome: PASS** — RBAC matrix intact; v2 instruments activated; CONTRATOS create flow forces ACTIVO; asistencia regression green; FE pages load.

---

## 4. Trap ledger

| ID | Mitigation applied |
|---|---|
| T1.1 | Every AWS call explicitly `--region us-east-1` |
| T1.3 | CodeDeploy group `miempresa-staging` (not `miempresa-prod`) — verified before deploy |
| T1.5 | Refused any prod target (only `54.144.25.72`/staging touched; CodeDeploy group staging only) |
| B30 | `ssh-keyscan 54.144.25.72`; SSH alias `miempresa-staging` (ec2-user + `~/.ssh/miempresa-lightsail-key.pem`) |
| B33 | `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` for `pg_dump` |
| B34/B35 | Already fixed in `seed-qa-staging.sh` (bash 3.2 compat; `--overwrite`) |
| Zip | appspec at root; `dist/`, `prisma/`, `scripts/`, `infrastructure/db/scripts|utilities`; excluded `node_modules`, `dist/generated`, `*.log` |
| Shadow migrate | NEVER used |
| pkill node | NEVER used (no blanket kill) |
| Auto-rollback | Never — only human-driven |
| FE login | Used `miempresa-stg.disruptiveexp.com` (custom domain) — `*.amplifyapp.com` rejected by CORS/cookies |
| New: on-instance `tsx` missing | Used `npx --yes tsx scripts/instruments-upgrade.ts` (tsx is devDep; instance `npm install --production` skips it). Force-upgrade required `FORCE_UPGRADE=true` env var (intentional safety). |

---

## 5. Deliverables

1. ✅ `context/implementation-plan/staging-release-jul22-fixes-runbook.md` — all R0–R6 actuals filled
2. ✅ `development/staging-release-jul22-fixes/tasks/W1-staging-release/progress-report.md` — phased log
3. ✅ `development/staging-release-jul22-fixes/tasks/W1-staging-release/completion-report.md` — this file

---

## 6. Rollback (manual only, if needed)

1. `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul20-nomina-asistencia-20260720-180836.zip,bundleType=zip --region us-east-1 --profile disruptive`
2. Re-deploy last FE zip (job 10) via Amplify console
3. DB restore from `pre-releases/pre-jul22-fixes.sql.gz` ONLY if data corrupted (very unlikely — code+instrument-version only)
4. Reverse `instruments:upgrade` by setting previous versions active (`UPDATE instrumentos_versiones SET activo=false WHERE instrumento_version_id IN (8,9); UPDATE instrumentos_versiones SET activo=true WHERE instrumento_version_id IN (5,6);`)
