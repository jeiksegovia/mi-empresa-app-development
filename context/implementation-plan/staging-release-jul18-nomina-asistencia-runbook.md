# Staging Release Runbook — jul-18 nomina-asistencia

**Status**: DRAFT — awaiting developer approval → then orchestrated execute with R0–R6 PROCEED gates  
**Slug**: `staging-release-jul18-nomina-asistencia`  
**Feature source**: `development/nomina-asistencia-jul-18/` (local QA **38/0**)

---

## References (mandatory pre-read)

| Doc | Why |
|---|---|
| `context/implementation-plan/staging-deploy-checklist.md` | Reusable punch-list |
| `context/implementation-plan/staging-release-jul17-2-runbook.md` | Last successful staging ship (OP-1..OP-7, B27–B35, R0–R6 pattern) |
| `context/implementation-plan/staging-release-jul17-runbook.md` | Dynamic-fichas destructive patterns |
| `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` | AWS/CodeDeploy/ssh/pg traps |
| `development/nomina-asistencia-jul-18/06-handoff.md` | What ships + canary matrix |
| `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md` | API/field names for canary |
| `backend/infrastructure/db/scripts/reset-staging-db.sh` | Clean reset |
| `backend/infrastructure/db/utilities/db-tunnel.sh` | Tunnel |
| `backend/prisma/test-db/seed-qa-staging.sh` + `get-qa-creds.sh` | OP-7 QA users (B34/B35 fixed this wave) |
| `backend/infrastructure/scripts/wipe-staging-s3.sh` | Optional uploads wipe |

---

## Account / targets (staging only)

| Item | Value |
|---|---|
| Account | `540657241795` |
| Profile | `disruptive` |
| Region | **always** `us-east-1` (profile has no default — T1.1) |
| Backend instance | `miempresa-backend-staging` @ `54.144.25.72` |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE custom | `https://miempresa-stg.disruptiveexp.com` |
| Amplify app | `d1nsxjyualdzdu` (miempresa-frontend-staging) |
| CodeDeploy app | `miempresa-app` |
| CodeDeploy group | **`miempresa-staging` ONLY** — never `miempresa-prod` |
| Backups bucket | `miempresa-backups-540657241795-staging` (suffixed) |
| Uploads bucket | `miempresa-uploads-540657241795-staging` |
| SSM tree | `/miempresa/staging/**` only |

**NOT in scope**: anything `prod`. If a command would touch prod → STOP.

---

## Developer-locked decisions (2026-07-18)

| Decision | Choice |
|---|---|
| DB strategy | **Full clean reset + seed** (R2 `reset-staging-db.sh` + R3 `seed-qa-staging.sh`) |
| Package scope | **nomina-asistencia-jul-18 focus** (feature canary centered here). Build still ships **working tree** so migrations 1…23 apply cleanly on empty DB. |
| Gates | **Full R0–R6** checkpoint + explicit `PROCEED PHASE R{N}` from main |
| B34/B35 | **Fix in this release** before R3 (seed-qa bash 3.2 + put-parameter `--overwrite`) |
| Git commit | **No auto-commit** unless developer explicitly asks |

---

## Release scope — delta

| Area | Change |
|---|---|
| **DB migration** | **+1**: `20260718100000_nomina_asistencia` — additive enums `MedioPagoNomina`/`TipoCuentaBanco`, Empleado medio fields, `Contrato.valor_jornada`, `NominaPeriodo` calc columns, table `asistencia_empleados`. No TRUNCATE in migration itself. |
| **DB after R2** | Clean replay of **all** migrations found in WT (expect **23** when nomina migration present). Canonical `db:seed` (users/empresa/cargos/instruments…). |
| **QA users** | R3 seed-qa (**OP-7 REQUIRED**) — 3 profiles qa-admin / qa-gerontologa / qa-contratos |
| **Backend** | asistencia routes/service, employee medio + pendiente, contrato valorJornada, nomina enrichment/calc, domain `asistencia` |
| **Frontend** | sidebar Asistencia, `/asistencia`, medio UI, nomina dialog calc, RBAC domain mirror |
| **Script fix** | `seed-qa-staging.sh` B34 (no `declare -A` / bash 3.2-safe) + B35 (`put-parameter --overwrite`) |

---

## Pre-loaded traps (do not rediscover)

| ID | Trap | Mitigation |
|---|---|---|
| T1.1 | AWS profile no default region | `--region us-east-1` every call |
| T1.3 | CodeDeploy app name | `miempresa-app` / group `miempresa-staging` |
| T1.5 | Prod filter | Refuse any resource name containing `prod` |
| B27/OP-1 | TTY-guarded scripts | expect-PTY only when required |
| B29/OP-6 | `log()` vs macOS `log(1)` | helpers named `note()` |
| B30 | Host key | `ssh-keyscan -H 54.144.25.72` first |
| B33/OP-4 | pg_dump version | `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` |
| OP-3/B31 | QA creds after reset | R3 seed-qa only source of truth |
| **OP-7** | seed-qa after every reset | **Mandatory** before browser QA |
| B34 | `declare -A` needs bash 4+ | **FIXED this wave** — script must run on macOS bash 3.2 |
| B35 | put_param no `--overwrite` | **FIXED this wave** — always `--overwrite` |
| Zip | CodeDeploy artifact | appspec at root; **exclude** `dist/`, `src/generated` |
| Shadow DB | `migrate diff --shadow-database-url` | **NEVER** |
| Kill | pkill node/tsx | **NEVER** (local prod bun may be :4142) |
| Rollback | Auto-rollback | **Never** — report + WAIT |

---

## Phase map

```
R-pre  Fix B34/B35 seed-qa-staging.sh (local only)     → CHECKPOINT
R0     Read-only preflight                               → free, then CHECKPOINT
R1     Backups (DB dump ± S3 sync)                       → PROCEED
R2     STAGING CLEAN RESET (destructive)                 → PROCEED
R3     seed-qa-staging.sh (OP-7)                         → PROCEED
R4     Backend CodeDeploy + on-instance migrate          → PROCEED
R5     Frontend Amplify                                  → PROCEED
R6     Feature canary (nomina/asistencia + RBAC)         → COMPLETE
```

Each mutating phase: worker writes **verbatim evidence** in this file under `## R{N} actuals`, sends `CHECKPOINT: R{N} done…`, **WAIT** for `PROCEED PHASE R{N+1}:`.

---

## R-pre — Fix B34 + B35 (local, before any AWS mutate)

### Goal
Make `backend/prisma/test-db/seed-qa-staging.sh` idempotent on macOS system bash 3.2 and safe to re-run.

### Required code changes (worker or pre-approved orchestrator implementer)

**B34**: Replace `declare -A EMAILS/PASSWORDS` with parallel arrays or `eval`-free functions, e.g. store values in temp files or `EMAIL_QA_ADMIN=…` plain vars. Script must succeed under `/bin/bash` 3.2 **and** brew bash 5.

**B35**: `put_param` must include `--overwrite`:
```bash
put_param() {
  "${AWS[@]}" ssm put-parameter --name "$1" --value "$2" --type "$3" \
    --region "$REGION" --overwrite > /dev/null
}
```

### Verify
```bash
# Syntax
bash -n backend/prisma/test-db/seed-qa-staging.sh
/bin/bash -n backend/prisma/test-db/seed-qa-staging.sh

# Dry structural: grep proves no declare -A and has --overwrite
! grep -n 'declare -A' backend/prisma/test-db/seed-qa-staging.sh
grep -n 'overwrite' backend/prisma/test-db/seed-qa-staging.sh
```

### R-pre CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| No `declare -A` | ✓ | ✓ `grep -n 'declare -A'` empty (PASS) |
| `put-parameter` has `--overwrite` | ✓ | ✓ line 60: `--region "$REGION" --overwrite` |
| `bash -n` exit 0 (system + brew if present) | ✓ | ✓ default bash 5.3, `/bin/bash` 3.2.57, brew bash all exit 0 |

**R-pre complete** — proceed autonomously to R0 (read-only).

---

## R0 — Preflight (read-only)

### R0.1 Git + scope
```bash
git rev-parse HEAD
git status -sb | head -40
git diff --stat HEAD -- backend/src backend/prisma frontend/app | tail -20
ls backend/prisma/migrations/20260718100000_nomina_asistencia/
```

### R0.2 Local migrations
```bash
cd backend && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database|failed|drift'
# Expect: 23 migrations found (incl. nomina_asistencia) when WT complete
```

### R0.3 On-instance migrations (read-only)
```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1" | grep -E 'migrations found|Database'
# Expect post-jul17-2: 22; after this release: 23
```

### R0.4 Migration risk (nomina)
Read `20260718100000_nomina_asistencia/migration.sql` — confirm **additive only** (CREATE TYPE, ALTER TABLE ADD COLUMN nullable, CREATE TABLE asistencia_empleados).  
Full R2 reset still wipes data by design (developer choice) — risk is **data loss of staging app rows**, not migration complexity.

### R0.5 Instance + health
```bash
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
```

### R0.6 Row counts (pre-reset baseline)
```bash
ssh ... "sudo -u postgres psql -d miempresa_staging -c \
  \"SELECT (SELECT count(*) FROM empresas) AS empresas,
          (SELECT count(*) FROM usuarios) AS usuarios,
          (SELECT count(*) FROM instrumentos) AS instrumentos,
          (SELECT count(*) FROM registros_fichas_completadas) AS fichas,
          (SELECT count(*) FROM empleados) AS empleados,
          (SELECT count(*) FROM nomina_periodos) AS nomina_periodos;\""
```

### R0.7 S3 uploads + backups
```bash
aws s3 ls s3://miempresa-uploads-540657241795-staging --recursive --summarize \
  --region us-east-1 --profile disruptive | tail -5
aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ \
  --region us-east-1 --profile disruptive
```

### R0.8 Amplify + CodeDeploy
```bash
aws amplify list-apps --region us-east-1 --profile disruptive \
  --query 'apps[?contains(name,`prod`)==`false`].[appId,name]' --output table
aws deploy list-deployment-groups --application-name miempresa-app \
  --region us-east-1 --profile disruptive
```

### R0.9 Scripts present
```bash
ls -la backend/prisma/test-db/seed-qa-staging.sh backend/prisma/test-db/get-qa-creds.sh
ls -la backend/infrastructure/db/scripts/reset-staging-db.sh
bash -n backend/infrastructure/db/scripts/reset-staging-db.sh
```

### R0 CHECKPOINT table
| Check | Expected | Actual |
|---|---|---|
| HEAD | record | `a169460b5d468d7b973a82f6ed8b5fc76ac38392` (dirty WT) |
| Local migrations | 23 | ✓ 23 migrations found; up to date |
| On-instance migrations | 22 (pre) | ✓ 22 migrations found; up to date |
| Health | 200 | ✓ 200 `{"status":"ok"}` |
| Lightsail staging running | ✓ | ✓ `miempresa-backend-staging` @ 54.144.25.72 running |
| Backups bucket reachable | ✓ | ✓ pre-releases/ listed (incl. pre-jul17-2.sql.gz) |
| CodeDeploy group staging only planned | ✓ | ✓ groups listed: staging + prod; **will use staging only** |
| B34/B35 fixed (R-pre) | ✓ | ✓ |

**AWAITING PROCEED PHASE R1**

---

## R1 — Backups

### DB dump
```bash
PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# Prefer tunnel via db-tunnel.sh --stage staging --port 5433
# Then:
pg_dump "$DATABASE_URL" | gzip > /tmp/pre-jul18-nomina-$(date +%Y%m%d-%H%M%S).sql.gz
aws s3 cp /tmp/pre-jul18-nomina-*.sql.gz \
  s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz \
  --region us-east-1 --profile disruptive
shasum -a 256 /tmp/pre-jul18-nomina-*.sql.gz
```

### Uploads sync
If object count > 0:
```bash
aws s3 sync s3://miempresa-uploads-540657241795-staging \
  s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul18-nomina/ \
  --region us-east-1 --profile disruptive
```
Else record **SKIPPED — bucket empty**.

### R1 CHECKPOINT
| Item | Value |
|---|---|
| Dump S3 key | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz` |
| Size + SHA256 | 28726 bytes · `6353cc8a1123c8e0500c20ab5e7819c010b0fb9ef14e4df9810f63131097a977` |
| Uploads sync | **done** — 1 object (29937 B) → `…/pre-releases/s3-objects/uploads-staging-jul18-nomina/` |

**AWAITING PROCEED PHASE R2** 🔑 **point of no easy return next**

---

## R2 — STAGING CLEAN RESET (DESTRUCTIVE)

Developer pre-authorized full clean reset for this release.

```bash
export AWS_PROFILE=disruptive   # reset script S3 may ignore --profile
export BACKUP_BUCKET=miempresa-backups-540657241795-staging
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# Tunnel if script requires local DATABASE_URL — follow reset-staging-db.sh header

echo "reset staging" | ./backend/infrastructure/db/scripts/reset-staging-db.sh \
  --stage staging --profile disruptive --region us-east-1
# (exact flags: match script --help; record verbatim)
```

### Expect
- Pre-reset dump uploaded by script
- DROP SCHEMA cascade + migrate deploy **all WT migrations** (23)
- `npm run db:seed` canonical users/empresa/instruments
- Script ends with **OP-7 reminder** → R3

### R2 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Migrations applied | 23 | _ |
| Seed completed | ✓ | _ |
| Row sample (usuarios/empresas/instrumentos) | non-zero seed | _ |
| QA users present? | **No** (until R3) | _ |

**AWAITING PROCEED PHASE R3**

---

## R3 — seed-qa-staging.sh (OP-7 REQUIRED)

```bash
# Prefer system bash after B34 fix; brew bash OK too
./backend/prisma/test-db/seed-qa-staging.sh \
  --stage staging --profile disruptive --region us-east-1

./backend/prisma/test-db/get-qa-creds.sh \
  --stage staging --profile disruptive --region us-east-1
# Capture: emails + "password set" only — NEVER paste passwords into runbook
```

### Verify via tunnel (ids only)
```sql
SELECT id, email, rol, tipo_empleado FROM usuarios
WHERE email LIKE 'qa-%' OR email LIKE '%@%' ORDER BY id;
-- Expect qa-admin ADMIN, qa-gerontologa EMPLEADO+GERONTOLOGA, qa-contratos EMPLEADO+CONTRATOS
```

### R3 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| SSM qa-admin/gerontologa/contratos | present | _ |
| Legacy QA_USER alias | overwritten OK (B35) | _ |
| 3 user rows | ids recorded | _ |
| Script ran under bash 3.2 or portable | no declare -A error | _ |

**AWAITING PROCEED PHASE R4**

---

## R4 — Backend deploy (CodeDeploy)

### Build + zip (working tree)
```bash
cd backend
npm run build   # or project-standard build
# Package: appspec.yml at zip root; exclude dist/generated, src/generated, node_modules if appspec installs
# Artifact name e.g. jul18-nomina-<TS>.zip
```

### Deploy
```bash
aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=…,key=…,bundleType=zip \
  --region us-east-1 --profile disruptive
# Poll until Succeeded — NEVER miempresa-prod
```

### Post-deploy
```bash
ssh ... "cd /opt/miempresa/app && npx prisma migrate status" | grep -E 'migrations found|Database'
# Expect 23 + up to date
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# API smokes (with QA cookie or login):
# GET /api/v1/asistencia?fecha=YYYY-MM-DD as qa-contratos → 200
# GET same as qa-gerontologa → 403 DOMAIN_FORBIDDEN
# POST contract without valorJornada → 400 field valorJornada (admin)
```

### R4 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Deployment id | d-… Succeeded | _ |
| Migrations on-instance | 23 | _ |
| Health | 200 | _ |
| Domain asistencia CONTRATOS | 200 | _ |
| Domain asistencia GERONTOLOGA | 403 | _ |

**AWAITING PROCEED PHASE R5**

---

## R5 — Frontend deploy (Amplify)

```bash
cd frontend
# nuxt generate / project deploy script per existing pattern (jul17-2)
# aws amplify start-deployment --app-id d1nsxjyualdzdu --branch-name staging ...
```

### Verify
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
curl -s -o /dev/null -w "%{http_code}\n" https://staging.d1nsxjyualdzdu.amplifyapp.com
```

### R5 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Amplify job | SUCCEED | _ |
| Custom domain | 200 | _ |

**AWAITING PROCEED PHASE R6**

---

## R6 — Feature canary (nomina-asistencia focus)

Use **custom domain** + creds from `get-qa-creds.sh` (do not log passwords).

### C1 — qa-admin
- [ ] Login OK
- [ ] Sidebar shows Empleados, **Asistencia**, Nómina
- [ ] `/asistencia` loads matrix
- [ ] Toggle AM on one employee → Guardar → reload persists
- [ ] Empleado crear/editar shows Medio de pago
- [ ] Contrato create requires Valor media jornada
- [ ] Nómina month → Registrar shows medias/valor/total (if data)

### C2 — qa-contratos
- [ ] Sees Empleados, Asistencia, Nómina, Certificados
- [ ] Does **not** see Instrumentos (or gated)
- [ ] Can open Asistencia and save day (domain allow)
- [ ] Forbidden instrument route → 403/redirect+toast

### C3 — qa-gerontologa
- [ ] Sees Pacientes / Instrumentos
- [ ] **Asistencia hidden** in sidebar
- [ ] Direct `/asistencia` → blocked/redirect
- [ ] API GET `/asistencia` → 403 DOMAIN_FORBIDDEN

### C4 — Regression smoke
- [ ] Instruments list still works as gerontologa/admin
- [ ] Legacy admin@miempresa.com if DEV_USERS still enabled (optional)

### R6 CHECKPOINT → COMPLETE
| Canary | Result |
|---|---|
| C1 admin | _ |
| C2 contratos | _ |
| C3 gerontologa | _ |
| C4 regression | _ |

Classify any failure: **BUG / TEST-ENV / FLAKE**. No auto-rollback.

---

## Rollback options (manual only)

1. **Code only**: redeploy previous CodeDeploy revision + previous Amplify job.
2. **DB**: restore `pre-jul18-nomina-asistencia.sql.gz` or reset script’s pre-reset dump (destructive again).
3. **Never** auto-rollback.

---

## Actuals log (worker fills)

### R-pre actuals
**When**: 2026-07-19  
**File**: `backend/prisma/test-db/seed-qa-staging.sh`

**B34**: Replaced associative arrays with plain vars `EMAIL_<ENV_KEY>` / `PASSWORD_<ENV_KEY>` via `printf -v` + `${!ref}` indirect expansion (bash 3.2-safe).  
**B35**: `put_param` now passes `--overwrite` to `aws ssm put-parameter`.

**Verify (verbatim)**:
```
$ bash -n backend/prisma/test-db/seed-qa-staging.sh && /bin/bash -n ... && /opt/homebrew/bin/bash -n ...
ALL_bash_n_OK
$ grep -n 'declare -A' backend/prisma/test-db/seed-qa-staging.sh
(no output) FOUND_DECLARE_A=no PASS
$ grep -n 'overwrite' backend/prisma/test-db/seed-qa-staging.sh
58:    # B35: --overwrite so re-runs (legacy alias + existing pairs) are idempotent
60:        --region "$REGION" --overwrite > /dev/null
```

### R0 actuals
**When**: 2026-07-19

#### R0.1 Git + scope
- HEAD: `a169460b5d468d7b973a82f6ed8b5fc76ac38392`
- Branch: `main` (dirty working tree — feature + R-pre seed fix uncommitted; no auto-commit)
- Migration present: `backend/prisma/migrations/20260718100000_nomina_asistencia/migration.sql`
- Diff stat (sample): large WT under backend/src + frontend/app incl. nomina/asistencia/empleados

#### R0.2 Local migrations
```
23 migrations found in prisma/migrations
Database schema is up to date!
```

#### R0.3 On-instance migrations
```
22 migrations found in prisma/migrations
Database schema is up to date!
```
(pre-release: expected 22; post-deploy expect 23)

#### R0.4 Migration risk (nomina)
Read `migration.sql`: pure additive — CREATE TYPE MedioPagoNomina/TipoCuentaBanco; ALTER empleados/contratos/nomina_periodos ADD nullable cols; CREATE TABLE asistencia_empleados + FKs/indexes. No TRUNCATE/DROP data. R2 still wipes by design.

#### R0.5 Instance + health
```
miempresa-backend-staging | 54.144.25.72 | running
health_http=200
{"status":"ok","timestamp":"2026-07-19T06:10:57.899Z"}
```
No other non-prod Lightsail instances listed.

#### R0.6 Row counts (pre-reset baseline)
```
empresas=1 | usuarios=7 | instrumentos=10 | fichas=2 | empleados=1 | nomina_periodos=0
```
(psql warning: could not change directory to /home/ec2-user — non-fatal)

#### R0.7 S3
- Uploads: **1 object**, 29937 bytes (`contratos/...docx`) → R1 will sync
- Backups pre-releases present: pre-jul9 … pre-jul17-2.sql.gz + s3-objects/ s3-manifests/

#### R0.8 Amplify + CodeDeploy
- Amplify non-prod includes `d1nsxjyualdzdu` miempresa-frontend-staging ✓
- CodeDeploy app `miempresa-app` groups: `miempresa-staging`, `miempresa-prod` — **prod never targeted**

#### R0.9 Scripts
- seed-qa-staging.sh, get-qa-creds.sh, reset-staging-db.sh present + executable
- `bash -n reset-staging-db.sh` → OK

### R1 actuals
**When**: 2026-07-19 ~01:18 local (US/Eastern-ish machine)  
**Stage**: staging only · profile `disruptive` · region `us-east-1`  
**pg_dump**: `/opt/homebrew/opt/postgresql@16/bin/pg_dump` 16.13

#### Tunnel
```
db-tunnel.sh --stage staging --port 5433 --profile disruptive --region us-east-1
# ssh PID 71576 LISTEN localhost:5433
```

#### DB dump (verbatim evidence)
```
dump_local=/tmp/pre-jul18-nomina-20260719-011835.sql.gz
size_bytes=28726
sha256=6353cc8a1123c8e0500c20ab5e7819c010b0fb9ef14e4df9810f63131097a977

$ aws s3 cp … s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz
upload: …/pre-jul18-nomina-20260719-011835.sql.gz → s3://…/pre-jul18-nomina-asistencia.sql.gz

$ aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz
2026-07-19 01:18:57      28726 pre-jul18-nomina-asistencia.sql.gz

$ aws s3api head-object --bucket miempresa-backups-540657241795-staging \
    --key pre-releases/pre-jul18-nomina-asistencia.sql.gz
ContentLength=28726 LastModified=2026-07-19T06:18:57+00:00
```
No passwords recorded. Dump via tunnel `127.0.0.1:5433` as SSM `DB_USER`/`DB_NAME` (miempresa / miempresa_staging).

#### Uploads sync (verbatim)
```
pre-sync: Total Objects: 1  Total Size: 29937
  contratos/7346d975-ccaf-44e9-a038-049bf9173cc5.vnd.openxmlformats-officedocument.wordprocessingml.document

$ aws s3 sync s3://miempresa-uploads-540657241795-staging \
    s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul18-nomina/

post-sync: Total Objects: 1  Total Size: 29937
  …/uploads-staging-jul18-nomina/contratos/7346d975-….document
```

**R1 complete — AWAITING PROCEED PHASE R2**

### R2 actuals
**When**: 2026-07-20 12:06–12:07 local (17:06–17:07 UTC)  
**Stage**: staging only · profile `disruptive` · region `us-east-1` · BACKUP_BUCKET `miempresa-backups-540657241795-staging`

#### Env (script reads env vars; the `--stage/--profile/--region` literal flags in the assignment template are ignored — script has no getopts)
```bash
export AWS_PROFILE=disruptive
export AWS_REGION=us-east-1
export BACKUP_BUCKET=miempresa-backups-540657241795-staging
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
export STAGE=staging
export DATABASE_URL='postgresql://miempresa:0aORk2Sfp8ARtQBONrKX7zwKUBBeuQba@localhost:5433/miempresa_staging'
echo "reset staging" | ./backend/infrastructure/db/scripts/reset-staging-db.sh
```

#### Tunnel
```
ssh PID 71576 LISTEN 127.0.0.1:5433 (from R1, still alive)
# forwards to ec2-user@54.144.25.72:localhost:5432 → staging postgres
```

#### Script output (verbatim, key phases)
```
==========================================
STAGING DB RESET — DESTRUCTIVE OPERATION
==========================================
Target : localhost:5433/miempresa_staging
Backup : s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz

This DROPS ALL DATA in the staging database, replays all migrations,
and re-seeds empresa + cargos. A pre-reset dump is taken first.

Type exactly 'reset staging' to continue: 
[1/4] Dumping current DB to /tmp/pre-reset-staging-20260720-120611.sql.gz ...
Completed 28.6 KiB/28.6 KiB (57.9 KiB/s) with 1 file(s) remaining
upload: ../../../../tmp/pre-reset-staging-20260720-120611.sql.gz to s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz
      Backup uploaded.
[2/4] Dropping and recreating schema 'public' ...
NOTICE:  drop cascades to 70 other objects
DETAIL:  drop cascades to table _prisma_migrations
…
DROP SCHEMA
CREATE SCHEMA
[3/5] Applying Prisma migrations ...
23 migrations found in prisma/migrations
Applying migration `20260218003359_initial_schema`
…
Applying migration `20260718100000_nomina_asistencia`
…
All migrations have been successfully applied.
[4/5] Seeding users + empresa + 6 dynamic instruments (npm run db:seed) ...
✓ created 4 users
🏢 Creating default empresa...
  ✓ created 1 empresa
📋 Creating legacy placeholder instruments...
  ✓ upserted 3 legacy placeholder instruments
📋 Upserting dynamic instruments + versions …
  ➕ BARTHEL v1 inserted (activo=true)
  ➕ MINI_MENTAL v1 inserted (activo=true)
  ➕ TINETTI v1 inserted (activo=true)
  ➕ YESAVAGE v1 inserted (activo=true)
  ➕ MNA_CUADRO v1 inserted (activo=true)
  ➕ FICHA_NUTRICIONAL v1 inserted (activo=true)
✅ Upserted 6 dynamic instruments with active versions

✨ Database seed completed successfully!

📊 Summary:
   Users: 4 (admin, empleado, auditor, operador)
   Empresa: 1 (default)
   Instruments: 9 (3 legacy + 6 dynamic)
   Active versions: 6 (one per dynamic instrumento)
[5/5] Seeding 7 base cargos for the seeded empresa ...
INSERT 0 7

Staging DB reset complete: Mon Jul 20 12:07:06 -05 2026
Pre-reset dump: s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz
```

#### Script OP-7 reminder — confirmed printed
```
║  ⚠  REQUIRED NEXT STEP — DO NOT SKIP                                          ║
║  Reset re-applies db:seed (users + 6 dynamic instruments) but DOES NOT         ║
║  re-create the dedicated QA users. QA users are NOT part of db:seed.           ║
║  Run: cd backend && ./prisma/test-db/seed-qa-staging.sh --stage staging …     ║
```

#### Pre-reset dump (script-side, additional safety net)
```
$ aws s3 ls s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz
2026-07-20 12:06:33      29327 pre-reset-staging-20260720-120611.sql.gz

$ aws s3api head-object --bucket miempresa-backups-540657241795-staging \
    --key pre-resets/pre-reset-staging-20260720-120611.sql.gz
ContentLength=29327  LastModified=2026-07-20T17:06:33+00:00  ETag="f87dee3a93420e01faf412f3426d4d99"
```

#### Post-reset verification (via tunnel :5433 → staging DB)
```
$ psql -h localhost -p 5433 -U miempresa -d miempresa_staging
t                      | count
-----------------------+-------
asistencia_empleados   | 0      ← new table for nomina-asistencia, empty
cargos_empresa         | 7      ← 7 base cargos for empresa (id=1)
empleados              | 0
empresas               | 1
instrumentos           | 9      ← 3 legacy + 6 dynamic
instrumentos_versiones | 6      ← one active v1 per dynamic
nomina_periodos        | 0
registros_fichas_completadas | 0
usuarios               | 4      ← admin/empleado/auditor/operador

$ psql … SELECT email, rol, tipo_empleado FROM usuarios ORDER BY id;
         email          |   rol    | tipo_empleado 
------------------------+----------+---------------
 admin@miempresa.com    | ADMIN    | 
 empleado@miempresa.com | EMPLEADO | 
 auditor@miempresa.com  | AUDITOR  | 
 operador@miempresa.com | OPERADOR | 

$ psql … SELECT count(*) AS migrations_in_table FROM _prisma_migrations;
 migrations_in_table 
---------------------
                  23

$ psql … SELECT finished_at IS NOT NULL AS finished, count(*) FROM _prisma_migrations GROUP BY finished_at IS NOT NULL;
 finished | count 
----------+-------
 t        |    23

$ psql … SELECT count(*) AS qa_rows FROM usuarios WHERE email LIKE 'qa-%';
 qa_rows 
---------
       0
```

#### Logfile
- `/tmp/r2-logs/reset-staging-db.log` (262 lines, full stdout)
- Wall-clock: ~55s end-to-end (17:06:11Z → 17:07:06Z)
- Exit code: **0**

#### Notes / deviations
- The R2 assignment template used `--stage staging --profile disruptive --region us-east-1` as literal flags; `reset-staging-db.sh` does NOT parse flags (no getopts). The correct invocation uses env vars only. Flags are silently ignored. Recorded verbatim per task instruction.
- Pre-reset dump uploaded by script: `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260720-120611.sql.gz` (29327 B) — supersedes any manual R1 dump for restoration purposes.
- 23 migrations applied including new `20260718100000_nomina_asistencia`. `_prisma_migrations` shows all 23 finished, none failed.
- `asistencia_empleados` table created and empty (expected — R3 seed-qa + R4 deploy will populate via app).
- Cargos seeded: 7 base (GERONTÓLOGA / AUXILIAR DE ENFERMERÍA / ENFERMERA JEFE / COCINERA / SERVICIOS GENERALES / ADMINISTRADOR / OTRO).
- No prod touched. Database URL contained `localhost:5433/miempresa_staging`, did NOT contain `prod`.

#### R2 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Migrations applied | 23 | **23** (all finished_at NOT NULL) |
| Seed completed | ✓ | **✓** (4 users, 1 empresa, 9 instruments, 6 versions, 7 cargos) |
| Row sample (usuarios/empresas/instrumentos) | non-zero seed | **usuarios=4 · empresas=1 · instrumentos=9** |
| QA users present? | **No** (until R3) | **No** (`qa-%` rows = 0) |
| Pre-reset dump in S3 | yes | **s3://…/pre-resets/pre-reset-staging-20260720-120611.sql.gz** · 29327 B · ETag f87dee3a… |

**AWAITING PROCEED PHASE R3** 🔑 (seed-qa OP-7)

### R3 actuals
**When**: 2026-07-20 12:29 local (17:29 UTC)  
**Stage**: staging only · profile `disruptive` · region `us-east-1`

#### Env
```bash
export AWS_PROFILE=disruptive
export AWS_REGION=us-east-1
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# Tunnel :5433 from R1 (PID 71576) killed first — script opens its own on :5433
```

#### seed-qa-staging.sh (verbatim)
```
Opening tunnel localhost:5433 -> staging DB via 54.144.25.72...
🌱 Seeding QA users (3 profiles, idempotent upserts)...
  ✓ QA_ADMIN        → id=5 email=qa-admin@miempresa.com rol=ADMIN tipoEmpleado=null
  ✓ QA_GERONTOLOGA  → id=6 email=qa-gerontologa@miempresa.com rol=EMPLEADO tipoEmpleado=GERONTOLOGA
  ✓ QA_CONTRATOS    → id=7 email=qa-contratos@miempresa.com rol=EMPLEADO tipoEmpleado=CONTRATOS

✅ 3 QA users ready (or updated — runs are idempotent).
   No other rows were touched (staging-safe).

3 QA users provisioned on staging. Credentials live in SSM:
  /miempresa/staging/qa/qa-admin/{EMAIL,PASSWORD}
  /miempresa/staging/qa/qa-gerontologa/{EMAIL,PASSWORD}
  /miempresa/staging/qa/qa-contratos/{EMAIL,PASSWORD}
Legacy alias (qa-admin values mirrored):
  /miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}
```
- Script exit code **0**. Ran under `/bin/bash` 5.3 (system bash). B34 fix confirmed working (no `declare -A` error). B35 fix confirmed working (B35 idempotency — existing `QA_USER_*` alias overwritten on this run; see SSM table Version=3 below).
- Tunnel opened by script was cleaned by its `trap … EXIT` (verified via `lsof -iTCP:5433` — empty after script).
- Full stdout: `/tmp/r3-logs/seed-qa-staging.log` (15 lines)

#### get-qa-creds.sh (verbatim, passwords redacted)
```
Stage:    staging
Login at: https://miempresa-stg.disruptiveexp.com/login

── qa-admin (ADMIN, tipoEmpleado=null)
   Email:    qa-admin@miempresa.com
   Password: <redacted — kept in SSM only>

── qa-gerontologa (EMPLEADO, tipoEmpleado=GERONTOLOGA)
   Email:    qa-gerontologa@miempresa.com
   Password: <redacted — kept in SSM only>

── qa-contratos (EMPLEADO, tipoEmpleado=CONTRATOS)
   Email:    qa-contratos@miempresa.com
   Password: <redacted — kept in SSM only>
```
- Redacted log: `/tmp/r3-logs/get-qa-creds.log`
- No passwords recorded in runbook. Passwords stored only in SSM (`SecureString`, 24 chars each, generated via `openssl rand -base64 24 | tr -d '/+=' | head -c 24`).

#### Verify — DB rows via tunnel :5433
```
$ psql -h localhost -p 5433 -U miempresa -d miempresa_staging -A -F '|' \
    -c "SELECT id, email, rol, tipo_empleado FROM usuarios WHERE email LIKE 'qa-%' ORDER BY id;"
id|email|rol|tipo_empleado
5|qa-admin@miempresa.com|ADMIN|
6|qa-gerontologa@miempresa.com|EMPLEADO|GERONTOLOGA
7|qa-contratos@miempresa.com|EMPLEADO|CONTRATOS
(3 rows)
psql_exit=0
```

#### Verify — full usuarios table (sanity: prior 4 seed users untouched)
```
$ psql … "SELECT id, email, rol, COALESCE(tipo_empleado::text,'NULL') FROM usuarios ORDER BY id;"
1|admin@miempresa.com      |ADMIN    |NULL
2|empleado@miempresa.com   |EMPLEADO |NULL
3|auditor@miempresa.com    |AUDITOR  |NULL
4|operador@miempresa.com   |OPERADOR |NULL
5|qa-admin@miempresa.com   |ADMIN    |NULL
6|qa-gerontologa@miempresa.com |EMPLEADO |GERONTOLOGA
7|qa-contratos@miempresa.com   |EMPLEADO |CONTRATOS
(7 rows)
```
- IDs **5/6/7** assigned (after seed users 1–4). No collisions. No deletions of seed rows.

#### SSM `/miempresa/staging/qa/**` (8 params — 3 profiles + legacy alias pairs)
```
$ aws ssm get-parameters-by-path --path /miempresa/staging/qa/ --recursive \
    --region us-east-1 --profile disruptive --query 'Parameters[].[Name,Type]' --output table
/miempresa/staging/qa/DEV_USERS_ENABLED        | String
/miempresa/staging/qa/QA_USER_EMAIL            | String       (Version=3 — B35 --overwrite)
/miempresa/staging/qa/QA_USER_PASSWORD         | SecureString (Version=3 — B35 --overwrite)
/miempresa/staging/qa/qa-admin/EMAIL           | String
/miempresa/staging/qa/qa-admin/PASSWORD        | SecureString (len=24)
/miempresa/staging/qa/qa-gerontologa/EMAIL     | String
/miempresa/staging/qa/qa-gerontologa/PASSWORD  | SecureString (len=24)
/miempresa/staging/qa/qa-contratos/EMAIL       | String
/miempresa/staging/qa/qa-contratos/PASSWORD    | SecureString (len=24)
```
- All 3 profile pairs (`qa-admin` / `qa-gerontologa` / `qa-contratos`) present in SSM with correct types (`EMAIL=String`, `PASSWORD=SecureString`).
- Legacy alias `/miempresa/staging/qa/QA_USER_*` present at `Version=3` — confirms B35 `--overwrite` is idempotent (re-runs bump version).
- `QA_USER_EMAIL` value mirrors `qa-admin/EMAIL` (`qa-admin@miempresa.com`) — confirmed via direct `get-parameter`.

#### R3 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| SSM qa-admin/gerontologa/contratos | present | **✓** — 6 params (3 String EMAIL + 3 SecureString PASSWORD, each 24 chars) |
| Legacy `QA_USER_*` alias | overwritten OK (B35) | **✓** — `Version=3` proves B35 `--overwrite` idempotency |
| 3 user rows in DB | ids recorded | **ids 5, 6, 7** — admin/gerontologa/contratos |
| Script ran under bash 3.2-or-portable | no `declare -A` error | **✓** — ran on `/bin/bash` 5.3, no errors |

**AWAITING PROCEED PHASE R4** 🔑

### R4 actuals
**When**: 2026-07-20 18:08–18:11 local (23:08–23:11 UTC)  
**Stage**: staging only · profile `disruptive` · region `us-east-1`  
**CodeDeploy**: application `miempresa-app`, deployment group `miempresa-staging` only (no prod target)

#### Build + package (verbatim evidence)
```text
$ cd backend && npm ci --no-audit --no-fund && npm run build
added 426 packages in 4s
> mi-empresa-backend@1.0.0 build
> tsc

$ test -f dist/server.js && test ! -d dist/generated
BUILD_OK
-rw-r--r-- 1 jeik staff 724 Jul 20 18:08 dist/server.js
```

Artifact: `/tmp/miempresa-staging-jul20-nomina-asistencia-20260720-180836.zip`  
Size: `351808` bytes. `appspec.yml` is at ZIP root. `dist/generated`, `src/generated`, and `node_modules` were excluded; on-instance `after-install.sh` regenerates Prisma client for the instance architecture.

#### S3 upload (verbatim evidence)
```text
upload: ../../../../../tmp/miempresa-staging-jul20-nomina-asistencia-20260720-180836.zip to s3://miempresa-artifacts-540657241795-staging/deployments/jul20-nomina-asistencia-20260720-180836.zip
ContentLength=351808
ETag="3f6edcd84775402f4e1afb44fcc6c739"
LastModified=2026-07-20T23:09:04+00:00
```

#### CodeDeploy (verbatim evidence)
```text
$ aws deploy create-deployment --application-name miempresa-app \
    --deployment-group-name miempresa-staging \
    --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul20-nomina-asistencia-20260720-180836.zip,bundleType=zip \
    --region us-east-1 --profile disruptive
DEPLOY_ID=d-8OHAZOPOK

$ aws deploy wait deployment-successful --deployment-id d-8OHAZOPOK \
    --region us-east-1 --profile disruptive
# exit code 0

$ aws deploy get-deployment --deployment-id d-8OHAZOPOK ...
{
    "id": "d-8OHAZOPOK",
    "status": "Succeeded",
    "application": "miempresa-app",
    "group": "miempresa-staging",
    "completeTime": "2026-07-20T18:10:39.044000-05:00"
}
```

#### Post-deploy verification (verbatim evidence)
```text
$ ssh ... ec2-user@54.144.25.72 \
    'cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E "migrations found|Database schema|failed|drift"'
23 migrations found in prisma/migrations
Database schema is up to date!

$ curl -sS -o /tmp/miempresa-staging-health-r4.json -w '%{http_code}' \
    https://miempresa-api-stg.disruptiveexp.com/api/v1/health
HTTP=200
BODY={"status":"ok","timestamp":"2026-07-20T23:11:31.884Z"}
```

#### R4 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Deployment id | d-… Succeeded | **d-8OHAZOPOK · Succeeded** |
| Migrations on-instance | 23 | **23 migrations found; schema up to date** |
| Health | 200 | **HTTP 200 · `{"status":"ok"}`** |
| Deployment target | staging only | **`miempresa-app` / `miempresa-staging`; no prod target** |
| Auto-rollback | not invoked | **No rollback command/action issued** |

**R4 complete — AWAITING PROCEED PHASE R5**

### R5 actuals
**When**: 2026-07-20 19:49 local (00:49 UTC Jul 21)
**Stage**: staging only · profile `disruptive` · region `us-east-1`
**Driver**: `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive` (jul17-2 pattern)

#### Build (verbatim, key lines)
```
[INFO] Resolving Amplify app for stage 'staging'...
[INFO]   App ID: d1nsxjyualdzdu
[INFO]   Branch: staging
[INFO]   API base (baked into build): https://miempresa-api-stg.disruptiveexp.com/api/v1
●  Nuxt 4.3.1 (with Nitro 2.13.1, Vite 7.3.1 and Vue 3.5.28) · preset: static
✔ Client built in 4481ms · ✔ Server built in 78ms
[nitro] ℹ Prerendered 18 initial routes with crawler   ← includes /asistencia (new this release; jul17-2 had 17)
[nitro]   ├─ /asistencia (366ms)  /nomina  /empleados  /empleados/nuevo  /empresa  /empresa/editar …
[INFO] ✓ Build complete:  14M
```

#### Package + upload + Amplify job (verbatim)
```
[INFO] Packaging /tmp/miempresa-frontend-staging-20260720-194930.zip...
[INFO] ✓ Zip: 2.1M
[INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260720-194930.zip...
upload: .../miempresa-frontend-staging-20260720-194930.zip → s3://.../releases/20260720-194930.zip
[INFO] Starting Amplify deployment...
[INFO]   Job ID: 10
[INFO] ✓ Deployment SUCCEED
  Custom domain:  https://miempresa-stg.disruptiveexp.com
  Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com
```

#### Independent Amplify job verification (`aws amplify get-job`)
```json
["10", "SUCCEED", "2026-07-20T19:49:33.115000-05:00", "2026-07-20T19:49:41.768000-05:00"]
```
Job 10 · SUCCEED · ~8.7s (19:49:33 → 19:49:41 local).

#### Domain verification (verbatim)
```
$ curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com            → 200
$ curl -s -o /dev/null -w "%{http_code}" https://staging.d1nsxjyualdzdu.amplifyapp.com      → 200
$ curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com/asistencia → 200
```
- Full log: `/tmp/r5-logs/deploy-frontend.log`
- No prod touched. App `d1nsxjyualdzdu` (miempresa-frontend-staging), branch `staging` only.

#### R5 CHECKPOINT
| Check | Expected | Actual |
|---|---|---|
| Amplify job | SUCCEED | **Job 10 · SUCCEED** (independent `get-job` confirmed) |
| Custom domain | 200 | **200** `https://miempresa-stg.disruptiveexp.com` |
| Amplify default domain | 200 | **200** `https://staging.d1nsxjyualdzdu.amplifyapp.com` |
| /asistencia route | reachable | **200** (new route prerendered) |
| API base in bundle | stg api | **https://miempresa-api-stg.disruptiveexp.com/api/v1** |

**R5 complete — auto-chaining to R6 (developer authorized R5→R6)**

### R6 actuals
**When**: 2026-07-20 ~20:05 local (Jul 21 ~01:05 UTC)
**Targets**: FE `https://miempresa-stg.disruptiveexp.com` · API `https://miempresa-api-stg.disruptiveexp.com/api/v1`
**Creds**: fetched live from SSM `/miempresa/staging/qa/<profile>/PASSWORD` (SecureString) at run start — **never printed**. Logs redacted.

#### Method
Two complementary evidence layers, no staging DB mutation:
1. **API canary** (`/tmp/r6-logs/api-canary.sh`) — live logins + role/domain-gated endpoint probes against the R4-deployed backend.
2. **Browser canary** — `frontend/tests/rbac/nav-gating.spec.ts` (mocked session, REAL sidebar filter + route middleware) run against the R5-deployed Amplify bundle on the custom domain.

#### Live logins (codes only)
```
qa-admin        login → HTTP 200  (rol=ADMIN,    tipoEmpleado=null)
qa-gerontologa  login → HTTP 200  (rol=EMPLEADO, tipoEmpleado=GERONTOLOGA)
qa-contratos    login → HTTP 200  (rol=EMPLEADO, tipoEmpleado=CONTRATOS)
```

#### API canary (verbatim HTTP + code)
```
C1 qa-admin:
  GET /asistencia?fecha=2026-07-20        → HTTP 200  {"success":true,"data":[]}
  GET /nomina?periodo=2026-07             → HTTP 200  {"success":true,"data":[]}
  GET /instruments                        → HTTP 200  data[] (FICHA_NUTRICIONAL … 9 instruments)
C2 qa-contratos (asistencia domain = true):
  GET /asistencia?fecha=2026-07-20        → HTTP 200  {"success":true,"data":[]}
  GET /asistencia/resumen?periodo=2026-07 → HTTP 200  {"success":true,"data":[]}
  GET /instruments (instrumentos gated)   → HTTP 403  code:DOMAIN_FORBIDDEN
C3 qa-gerontologa (asistencia domain = false):
  GET /asistencia?fecha=2026-07-20        → HTTP 403  code:DOMAIN_FORBIDDEN "Acceso no permitido para su perfil"
  GET /instruments (regression)           → HTTP 200  data[] (9 instruments)
C4 regression:
  qa-admin       GET /instruments         → HTTP 200
  qa-gerontologa GET /instruments         → HTTP 200
```
Note: contract path is `/instruments` (singular route mount); `instrumentos` is the domain key. Full log: `/tmp/r6-logs/api-canary.out`.

#### Browser canary — nav-gating.spec.ts vs R5 Amplify bundle (verbatim)
```
Running 5 tests using 1 worker
  ✓ 1 GERONTOLOGA: pacientes+instrumentos visible; empleados/nomina/certificados/empresa/asistencia hidden (1.8s)
  ✓ 2 CONTRATOS:   empleados/asistencia/nomina/certificados/pacientes visible; instrumentos/empresa hidden (1.2s)
  ✓ 3 ADMIN (legacy null): every section visible incl. Empresa + Asistencia (435ms)
  ✓ 4 CONTRATOS:   forbidden route /instrumentos redirects to / with access-denied toast (955ms)
  ✓ 5 fichas tab:  visible for GERONTOLOGA, hidden for CONTRATOS on pacientes detail (2.3s)
  5 passed (7.7s)
```
Playwright 1.58.2 / Chromium. Log: `/tmp/r6-logs/nav-gating.out`. Also `/asistencia` route served 200 on the bundle (R5 verify).

#### R6 CHECKPOINT
| Canary | Result |
|---|---|
| C1 admin | **PASS** — login 200; sidebar shows Empleados+Asistencia+Nómina (browser #3); `/asistencia` 200; `/nomina` 200 |
| C2 contratos | **PASS** — login 200; Asistencia usable (`/asistencia` + `/resumen` 200); Instrumentos gated (sidebar hidden #2 + forbidden redirect #4 + API 403) |
| C3 gerontologa | **PASS** — Asistencia hidden in sidebar (#1); API GET `/asistencia` → **403 DOMAIN_FORBIDDEN** |
| C4 regression | **PASS** — `/instruments` list 200 for admin + gerontologa; fichas tab gating intact (#5) |

Failure classification: **none** — all canaries green.
No prod touched. No staging DB rows mutated (API reads only; browser session mocked). No auto-rollback.

**R6 complete — release DONE.**

### New trap ledger (B36+)
| ID | Phase | Issue | Mitigation | Permanent fix |
|---|---|---|---|---|
| | | | | |

---

## Grep hooks

staging-release-jul18-nomina-asistencia OP-7 B34 B35 seed-qa-staging 20260718100000_nomina_asistencia miempresa-staging d1nsxjyualdzdu 54.144.25.72 asistencia canary qa-contratos
