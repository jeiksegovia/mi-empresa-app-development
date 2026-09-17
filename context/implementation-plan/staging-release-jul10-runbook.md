# Staging Release Runbook — July 10, 2026 (jul-9 improvements + jul-10 hardening)

**Reference**: [staging-release-jul9-runbook.md](staging-release-jul9-runbook.md) (pattern; jul-9 was 1 migration)
**Account**: 540657241795 · Profile `disruptive` · Region `us-east-1` (MUST pass explicitly — profile has no default)
**Targets**: `miempresa-backend-staging` @ 54.144.25.72 · Amplify app `d1nsxjyualdzdu` · CFN stack `miempresa-s3-staging`
**NOT in scope**: anything `prod` — no prod resource is read or mutated in this runbook.

## How this document works
- Every AWS-mutating command is logged verbatim under its phase with its outcome (same protocol as jul-9).
- ✋ = requires explicit developer confirmation BEFORE execution.
- R0 is read-only (no wait). R1–R5 each mutate staging — explicit `PROCEED PHASE R{N+1}:` from main before continuing.
- 🔑 turning point · 📚 learning · 🐛 numbered bugs continue from jul-9 (next B22).

## Release scope — delta since the jul-9 staging deploy (`d-M8XBER0HK`)

| Area | Change |
|---|---|
| **Features** | All deferred items from jul-9: fichas single-step dialog, C4 lazy flip PENDIENTE→VENCIDO, C6 `/users` ADMIN CRUD + `tipoEmpleado` pairing, E1 uppercase-as-you-type on 5 entity nombre fields, weekly `/patients/fichas/vencimientos`. Plus jul-9 group A (CertificateUpdateForm shared, empresa cargos manager, paciente notas fechaIncidente with 2-bus-day window, educacionEmpleado docs). |
| **DB** | **6 new migrations** (staging currently at 14 → will be at 20): `jul9_additive_fields`, `jul9_nota_fecha_incidente` **(+ backfill fecha_incidente + SET NOT NULL on notas_clientes)**, `jul9_educacion_empleado`, `jul9_cargo_empresa` **(seeds 8 cargos per empresa)**, `jul10_contrato_cargo_not_null` **(backfills NULL cargo_id → Otro; depends on cargo seed from jul9_cargo_empresa)**, `jul10_tipo_empleado` |
| **Infra** | `s3-stack.yml` — unchanged since jul-5 (already `UPDATE_COMPLETE`); IaC delta only in `deploy-infrastructure.sh` `DEV_LOCAL_ORIGINS` (dev-only) → R1 expected no-op |
| **App code** | Backend: users.routes (ADMIN-only CRUD, tipoEmpleado pairing rule), requireInstrumentWriter in auth.ts, forbidLegacy middleware, businessDays util, patientService flips + vencimientos endpoint, instruments routes gated, certificados Zod refine + CertificateUpdateForm. Frontend: single-step ficha dialog, descargar-plantilla testid, uppercase-as-you-type on 8 forms, empleados contrato-laboral tab, empresa cargos manager. |
| **Not needed** | No new SSM params, no IAM changes, no instance changes, no CORS change. |

## Pre-flight working-tree record
Working tree is dirty (123 files; deployments build from working tree per established pattern — task-assignment baseline confirms this is expected).

---

## Phase R0 — Preflight (local + read-only staging) — no mutations

### R0.1 — Confirm git baseline
```bash
git rev-parse HEAD
# → 48029efc0b46306d396f4763e0f4bef7644e4363  ✓ matches task-assignment baseline

git stash create | xargs -I {} git tag -f staging-jul10-snapshot {}
git tag -l staging-jul10-snapshot -n1
# → staging-jul10-snapshot → WIP on main: 48029ef (staged HEAD + dirty-tree WIP commit)
```
Note: previous staging snapshots (`staging-jul5-snapshot` at `eed9780…`) preserved.

### R0.2 — Local migration state
```bash
cd backend && npx prisma migrate status
# → "20 migrations found in prisma/migrations"
# → "Database schema is up to date!"

ls prisma/migrations/ | tail -7
# → 20260709025844_add_certificado_update
# → 20260710024539_jul9_additive_fields
# → 20260710024613_jul9_nota_fecha_incidente
# → 20260710024705_jul9_educacion_empleado
# → 20260710024928_jul9_cargo_empresa
# → 20260710100000_jul10_contrato_cargo_not_null
# → 20260710100100_jul10_tipo_empleado
```
(six new migration directories on disk — match task-assignment expected list.)

### R0.3 — New migration content (read for risk analysis)
**`jul9_additive_fields`** — WIDENING + ADDITIVE: `DROP NOT NULL` on `educacion_idiomas.nivel_escritura`, six nullable columns (comprobante_pago_url, eps, fecha_cumpleanos, tipo_sangre, archivo_firmado_url, documento_identificacion_url), one enum (`TipoSangre`), one new table (`educacion_empleado`). **All operations are safe regardless of existing data**.

**`jul9_nota_fecha_incidente`** — ADD nullable column → UPDATE backfill from `fecha::date` → SET NOT NULL. Staging has **1 row** in `notas_clientes`; backfill is trivially safe.

**`jul9_educacion_empleado`** — greenfield table + FK to `empleados(empleado_id) ON DELETE CASCADE`. Zero rows by definition.

**`jul9_cargo_empresa`** — ADD column `cargo_id INTEGER` (nullable) to `contratos`, new `cargos_empresa` table, FK to `empresas(id) ON DELETE CASCADE`, FK from `contratos(cargo_id) ON DELETE SET NULL`, seed loop `INSERT INTO cargos_empresa SELECT FROM empresas e CROSS JOIN (...)`. **On staging, the seed loop is a NO-OP** (cross-joined with zero `empresas` rows = zero seeds). `cargos_empresa` will be empty after this migration runs. The cross-empresa FK still satisfies DDL; the only usability impact is that future staging contratos inserts must supply an existing `cargo_id` (which can't exist until an empresa exists with cargos). Acceptable: staging has 0 contratos today.

**`jul10_contrato_cargo_not_null`** — UPDATE `contratos SET cargo_id = (SELECT cargo_id FROM cargos_empresa WHERE empresa_id=6 AND nombre='Otro')` WHERE cargo_id IS NULL → ALTER COLUMN cargo_id SET NOT NULL. **Two no-ops on staging**: (a) 0 contratos rows so UPDATE matches nothing, (b) `empresa_id=6` lookup returns NULL → cargo_id = NULL = no-op (UPDATE of NULL to NULL). SET NOT NULL succeeds because there are zero rows. **Note for dev/staging asymmetry**: the hardcoded `empresa_id=6` is correct for the local dev DB only (empresa id 6 = "Otro" cargo_id 7 per improvements-jul-9 plan §0). On staging with 0 empresas and 0 contratos, the SQL produces a no-op; not a failure.

**`jul10_tipo_empleado`** — CREATE TYPE `TipoEmpleado AS ENUM ('GERONTOLOGA')` + ALTER TABLE `usuarios ADD COLUMN IF NOT EXISTS tipo_empleado TipoEmpleado` (nullable). Safe.

### R0.4 — Local backend health + tsc
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/api/v1/health
# → 200

cd backend && npx tsc --noEmit
# → clean (no errors, exit 0)
```

### R0.5 — Staging instance + health
```bash
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
# → miempresa-backend-staging | 54.144.25.72 | running | us-east-1  ✓ (matches task assignment)

curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# → 200
```

### R0.6 — On-instance migration state (read-only)
```bash
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
# → "14 migrations found in prisma/migrations"
# → "Database schema is up to date!"

ssh ... ec2-user@54.144.25.72 "ls /opt/miempresa/app/prisma/migrations | sort"
# → 13 named dirs from 20260218003359_initial_schema through 20260705000500_jul4_nomina_foundation
# → + 20260709025844_add_certificado_update
# → + migration_lock.toml
# (6 new jul-9/jul-10 migration dirs NOT present on instance → confirms they will be deployed in R3)

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \"SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;\""
# → 14 rows ending in 20260709025844_add_certificado_update
# (6 new migrations NOT in _prisma_migrations → ready for R3)
```

### R0.7 — Migration-risk gate ✋
**Staging DB row counts (read-only, read via `sudo -u postgres psql`)**:

| Table | Count | Risk for the 6 new migrations |
|---|---:|---|
| `empresas` | **0** | cargo seed loop is a NO-OP (`CROSS JOIN` with 0 rows = 0 seeds). `cargos_empresa` will be empty. |
| `contratos` | **0** | `UPDATE ... SET cargo_id = ...` is a NO-OP. `SET NOT NULL` succeeds vacuously. |
| `notas_clientes` | **1** | Backfill `UPDATE ... SET fecha_incidente = fecha::date` runs on 1 row; `SET NOT NULL` succeeds (the row already has `fecha`, so the backfill guarantees no NULL remains). |
| `clientes` | **2** | New nullable columns (`eps`, `fecha_cumpleanos`, `tipo_sangre`) — all permissive. |
| `usuarios` | **3** | New nullable `tipo_empleado` column + new enum — permissive. |
| `educacion_idiomas` | **1** | `DROP NOT NULL` on `nivel_escritura` — WIDENING constraint, always safe. |
| `empleados` | (present) | `educacion_empleado` FK → safe; `documento_identificacion_url` nullable → safe. |

**Verdict**: total surface for the 2 backfills is **1 row in notas_clientes** + **0 rows in contratos**. Essentially a no-op for the staging DB. Risk = **LOW**.

### R0.8 — CORS + SSM sanity (read-only)
```bash
aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging \
  --region us-east-1 --profile disruptive
# → 4 origins (stg custom domain + 3 localhost dev), methods GET/PUT/HEAD (unchanged since jul-5)

aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
  --region us-east-1 --profile disruptive --query 'Parameters[].Name' --output text | sort
# → 30 staging SSM params under /api/*, /db/*, /frontend/*, /qa/* — all intact
```

### R0.9 — CFN stack inventory (read-only)
```bash
aws cloudformation describe-stacks --region us-east-1 --profile disruptive --output json \
  | python3 -c "import json,sys; [print(s['StackName'], s['StackStatus']) for s in json.load(sys.stdin)['Stacks'] if 'prod' not in s['StackName'].lower()]"
# staging-relevant: 
#   miempresa-frontend-staging CREATE_COMPLETE
#   miempresa-edge-staging        CREATE_COMPLETE
#   miempresa-codedeploy          CREATE_COMPLETE
#   miempresa-ssm-staging         CREATE_COMPLETE
#   miempresa-s3-staging          UPDATE_COMPLETE  ← R1 target
#   miempresa-iam                 CREATE_COMPLETE
# (no prod stacks enumerated; non-miempresa stacks also present but NOT in scope)
```

### R0.10 — CodeDeploy app/group truth
```bash
aws deploy list-applications --region us-east-1 --profile disruptive --query applications --output text
# → miempresa-app  ✓ (NOT miempresa-api-staging; matches jul-9 pattern L19)

aws deploy list-deployment-groups --application-name miempresa-app \
  --region us-east-1 --profile disruptive --query deploymentGroups --output text
# → miempresa-staging  miempresa-prod  (use ONLY miempresa-staging; do NOT touch miempresa-prod)
```

### R0 execution log — ✅ ALL GREEN (2026-07-10)

| Check | Result |
|---|---|
| `git rev-parse HEAD` | ✅ `48029efc0b46306d396f4763e0f4bef7644e4363` |
| `staging-jul10-snapshot` tag | ✅ created at WIP commit; prior `staging-jul5-snapshot` preserved |
| Local `prisma migrate status` | ✅ 20 migrations, up to date |
| Local backend `/api/v1/health` | ✅ 200 |
| Local backend `tsc --noEmit` | ✅ clean |
| Staging `/api/v1/health` (CloudFront) | ✅ 200 |
| On-instance `prisma migrate status` | ✅ 14 migrations, up to date (pre-jul-10 snapshot) |
| Staging `_prisma_migrations` | ✅ last row = `20260709025844_add_certificado_update` (6 new pending) |
| ✋ Migration-risk gate `empresas` count | ✅ **0** → `cargos_empresa` seed loop is no-op |
| ✋ Migration-risk gate `contratos` count | ✅ **0** → cargo backfill is no-op |
| ✋ Migration-risk gate `notas_clientes` count | ✅ **1** → fecha_incidente backfill trivial |
| On-instance `pm2 jlist` | ✅ `miempresa-api status: online restart_time: 0` PID 376597 |
| `miempresa-s3-staging` CFN status | ✅ `UPDATE_COMPLETE` |
| Staging uploads bucket CORS | ✅ 4 origins, methods GET/PUT/HEAD (unchanged) |
| CodeDeploy application name | ✅ `miempresa-app` (matches jul-9 L19) |
| `miempresa-staging` deployment group | ✅ exists; `miempresa-prod` group NOT touched |

**Conclusion**: all R0 gates pass with **very low** migration risk thanks to sparse staging data (0 empresas, 0 contratos, 1 notas_clientes). R1 is a no-op infra pass (stack already current); proceed to R2/R3 only after explicit `PROCEED PHASE R1:` from main.

---

## Phase R1 — Infra: idempotent re-deploy of `miempresa-s3-staging` ✋

(same as jul-9 R1 — `s3-stack.yml` unchanged → `cloudformation deploy` must return "No changes to deploy")

```bash
cd backend/infrastructure/db/cloudformation
aws cloudformation validate-template --template-body file://s3-stack.yml \
  --region us-east-1 --profile disruptive --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Description:', d.get('Description','(none)'))
print('Params:', [p['ParameterKey'] for p in d.get('Parameters',[])])
print('OK')
"

aws cloudformation deploy \
  --template-file s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides \
    Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --region us-east-1 --profile disruptive

aws cloudformation describe-stacks --stack-name miempresa-s3-staging \
  --region us-east-1 --profile disruptive \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime}" --output json
```

### Execution log R1 — ✅ IDEMPOTENT NO-OP (2026-07-10)

**Commands executed (verbatim)**:
```bash
cd /Users/jeik/ws/mi-empresa-app-development/backend/infrastructure/db/cloudformation
aws cloudformation validate-template --template-body file://s3-stack.yml \
  --region us-east-1 --profile disruptive --output json | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Description:', d.get('Description','(none)'))
print('Params:', [p['ParameterKey'] for p in d.get('Parameters',[])])
print('OK')
"
# → Description: Mi Empresa Backend Infrastructure - S3 Buckets (artifacts, backups, uploads).
#     Environment=dev creates ONLY the uploads bucket, used exclusively by LOCAL
#     development/testing (backend on localhost:3101 signs presigned URLs against it).
#     There is no dev server: artifacts and backups buckets are skipped for dev.
# → Params: ['ProjectName', 'Environment', 'UploadsCorsAllowedOrigins']
# → OK     ✓ template valid

aws cloudformation deploy \
  --template-file /Users/jeik/ws/mi-empresa-app-development/backend/infrastructure/db/cloudformation/s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --region us-east-1 --profile disruptive
# → Waiting for changeset to be created..
# → No changes to deploy. Stack miempresa-s3-staging is up to date   ✓ idempotent as expected

aws cloudformation describe-stacks --stack-name miempresa-s3-staging \
  --region us-east-1 --profile disruptive \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime,Params:Parameters}" --output json
# → {"Status": "UPDATE_COMPLETE",
#    "Updated": "2026-07-05T19:41:19.171000+00:00",
#    "Params": [...staging...] }
#   ✓ LastUpdated still 2026-07-05 (no drift introduced)
```

🔑 Same pattern as jul-9 R1 — no drift, idempotent no-op. Confirms staging CORS bucket + stack parameters match the template exactly.

---

## Phase R2 — DB safety backup ✋ (before any migration runs)

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul10-migration.sql.gz && \
   ls -la /tmp/pre-jul10-migration.sql.gz && \
   sha256sum /tmp/pre-jul10-migration.sql.gz && \
   aws s3 cp /tmp/pre-jul10-migration.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"

aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ \
  --region us-east-1 --profile disruptive --human-readable
aws s3api head-object --bucket miempresa-backups-540657241795-staging \
  --key pre-releases/pre-jul10.sql.gz --region us-east-1 --profile disruptive --output json
```

### Execution log R2 — ✅ BACKUP COMPLETE (2026-07-10)

**Commands executed (verbatim)**:
```bash
# 1. on-instance pg_dump + SHA256 + size
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul10-migration.sql.gz && \
   ls -la /tmp/pre-jul10-migration.sql.gz && \
   sha256sum /tmp/pre-jul10-migration.sql.gz && \
   gunzip -c /tmp/pre-jul10-migration.sql.gz | head -3"
# → could not change directory to "/home/ec2-user": Permission denied   (benign pg warning, L17)
# → -rw-rw-r--. 1 ec2-user ec2-user 16862 Jul 10 15:48 /tmp/pre-jul10-migration.sql.gz
# → 91ef420ffd628130676588be46e39d7be4e43e5780950ef99a8af7d86855f273  /tmp/pre-jul10-migration.sql.gz
# → --
# → -- PostgreSQL database dump                  ✓ valid gzipped dump
# ✓ size 16,862 bytes (~16.5 KiB, slightly larger than jul-9's 14.3 KiB — staging gained ~2.5 KiB since then)

# 2. Upload to S3 + list
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "aws s3 cp /tmp/pre-jul10-migration.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"
# → Completed 16.5 KiB/16.5 KiB (220.1 KiB/s) with 1 file(s) remaining
# → upload: ../../tmp/pre-jul10-migration.sql.gz to s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz
# → 2026-07-10 15:48:06      16862 pre-jul10.sql.gz     ✓ uploaded
# → 2026-07-09 06:05:22      14694 pre-jul9.sql.gz       ✓ prior release preserved

# 3. head-object from local AWS CLI (cross-check)
aws s3api head-object --bucket miempresa-backups-540657241795-staging \
  --key pre-releases/pre-jul10.sql.gz --region us-east-1 --profile disruptive --output json \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Size:', d['ContentLength'], 'bytes')
print('ETag:', d['ETag'])
print('LastModified:', d['LastModified'])
print('ServerSideEncryption:', d.get('ServerSideEncryption'))
"
# → Size: 16862 bytes                          ✓ matches
# → ETag: \"f1bba2e0e3b60bcec328a42287df6abc\"
# → LastModified: 2026-07-10T15:48:06+00:00     ✓ matches upload timestamp
# → ServerSideEncryption: AES256                ✓ encrypted at rest
```

📚 **Notable**: dump size grew from 14.3 KiB (jul-9) → 16.5 KiB (jul-10), consistent with the staging DB gaining ~2 KiB of QA data between releases. Both pre-jul9.sql.gz (14,694 bytes) and pre-jul10.sql.gz (16,862 bytes) coexist in the staging backups bucket.

---

## Phase R3 — Backend deploy ✋ (CodeDeploy → applies the 6 new migrations)

Same pipeline as jul-9 R3 (`d-M8XBER0HK`). Reminders from the bug ledger (worker-deploy-learning):
- appspec at **bundle root** (B10)
- **NO `permissions:`** section in appspec (B18)
- `after-install.sh` regenerates Prisma client on-instance: `npx prisma generate` → `cp -R src/generated dist/generated`
- Artifact zip is correct WITHOUT `dist/generated` (L4, T5.3)
- Do NOT include `.env`, `node_modules/`, or `dist/generated` in the zip (T5.5)

### R3 artifact prep + deploy
```bash
cd backend
npm ci                                       # install deps
npm run build                                # tsc
ls dist/server.js                            # ✓ built
ls dist/generated 2>&1                       # ✓ absent (after-install.sh creates it on-instance)

cp infrastructure/db/appspec.yml ./appspec.yml
rm -f /tmp/miempresa-staging-jul10.zip
zip -r /tmp/miempresa-staging-jul10.zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log"
ls -la /tmp/miempresa-staging-jul10.zip      # expect ~ 250-280 KiB

TS=$(date +%Y%m%d-%H%M%S)
aws s3 cp /tmp/miempresa-staging-jul10.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/jul10-${TS}.zip \
  --region us-east-1 --profile disruptive

DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul10-${TS}.zip,bundleType=zip \
  --description "staging jul-10 release: 6 Prisma migrations + jul-9/jul-10 features (fichas, /users, uppercase, hardening)" \
  --region us-east-1 --profile disruptive \
  --query deploymentId --output text)

aws deploy wait deployment-successful --deployment-id ${DEPLOY_ID} \
  --region us-east-1 --profile disruptive
```

### R3 post-deploy verification
```bash
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"

# Migrations table tail
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY started_at DESC LIMIT 7;\""

# Backfill verifications
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT COUNT(*) AS n_total, COUNT(fecha_incidente) AS n_with_fecha FROM notas_clientes;\""
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT COUNT(*) AS n_null_cargo FROM contratos WHERE cargo_id IS NULL;\""
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT COUNT(*) AS n_cargos_empresa FROM cargos_empresa;\""

# New tables/columns presence
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.cargos_empresa') AS cargos_ok, to_regclass('public.educacion_empleado') AS educacion_empleado_ok;\""
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT column_name FROM information_schema.columns WHERE table_name='contratos' AND column_name IN ('cargo_id','archivo_firmado_url') ORDER BY column_name;\""

# PM2 + public health
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"...\"; pm2 status"

curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health

# After-install log tail
tail -50 /opt/miempresa/logs/after-install.log
```

### Execution log R3 — ✅ SUCCEEDED on first attempt (2026-07-10)

**Commands executed (verbatim)**:
```bash
# Build
cd /Users/jeik/ws/mi-empresa-app-development/backend
npm ci 2>&1 | tail -5
# → "up to date in Xs", "Run npm audit for details" (no errors)
npm run build 2>&1 | tail -10
# → "> mi-empresa-backend@1.0.0 build / tsc"   (clean TSC)
ls dist/server.js && ls dist/generated 2>&1
# → dist/server.js                                ✓
# → ls: dist/generated: No such file or directory ✓ (after-install.sh creates on-instance)

# Package
cp infrastructure/db/appspec.yml ./appspec.yml
ls -la appspec.yml
# → -rw-r--r--  1 jeik  staff  5193 Jul 10 10:48 appspec.yml

rm -f /tmp/miempresa-staging-jul10.zip
zip -r /tmp/miempresa-staging-jul10.zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log" 2>&1 | tail -3
ls -la /tmp/miempresa-staging-jul10.zip
# → -rw-r--r--  1 jeik  wheel  274046 Jul 10 10:48 /tmp/miempresa-staging-jul10.zip

# Zip contents sanity
unzip -l /tmp/miempresa-staging-jul10.zip | grep -E "appspec|^---|server\.js"
# → 5193  07-10-2026 10:48   appspec.yml        (at root ✓)
# →  724  07-10-2026 10:48   dist/server.js      ✓
unzip -l /tmp/miempresa-staging-jul10.zip | grep -i generated
# → (no entries — no dist/generated / src/generated)   ✓

# Upload
aws s3 cp /tmp/miempresa-staging-jul10.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/jul10-20260710-104847.zip \
  --region us-east-1 --profile disruptive
# → Completed 267.6 KiB/267.6 KiB (910.9 KiB/s) with 1 file(s) remaining

DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul10-20260710-104847.zip,bundleType=zip \
  --description "staging jul-10 release: 6 Prisma migrations + jul-9/jul-10 features (fichas, /users, uppercase, hardening)" \
  --region us-east-1 --profile disruptive \
  --query deploymentId --output text)
echo $DEPLOY_ID
# → d-9CDIOTWHK

aws deploy wait deployment-successful --deployment-id d-9CDIOTWHK \
  --region us-east-1 --profile disruptive
# → (silent — wait succeeded)

aws deploy get-deployment --deployment-id d-9CDIOTWHK \
  --region us-east-1 --profile disruptive --output json | python3 -c "..."
# → Deployment d-9CDIOTWHK: Succeeded
# →   Group: miempresa-staging
# →   Started:   2026-07-10T10:48:52-05:00
# →   Completed: 2026-07-10T10:50:01-05:00   (1 min 9 s)
# →   Overview: Succeeded=1, Failed=0, Pending=0
# →   Previous revision: s3://...deployments/jul9-20260709-011123.zip
# →   New revision:      s3://...deployments/jul10-20260710-104847.zip

# Migration status
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
# → 20 migrations found in prisma/migrations       ✓ (was 14 in R0)
# → Database schema is up to date!

# _prisma_migrations tail
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY started_at DESC LIMIT 7;\""
# → 20260710100100_jul10_tipo_empleado           | t   ✓
# → 20260710100000_jul10_contrato_cargo_not_null | t   ✓
# → 20260710024928_jul9_cargo_empresa            | t   ✓
# → 20260710024705_jul9_educacion_empleado       | t   ✓
# → 20260710024613_jul9_nota_fecha_incidente     | t   ✓
# → 20260710024539_jul9_additive_fields          | t   ✓
# → 20260709025844_add_certificado_update        | t

# Combined backfill verifications (single query for compactness)
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT (SELECT count(*) FROM notas_clientes) AS notas_total, \
           (SELECT count(*) FROM notas_clientes WHERE fecha_incidente IS NULL) AS notas_null_fecha, \
           (SELECT count(*) FROM contratos) AS contratos_total, \
           (SELECT count(*) FROM contratos WHERE cargo_id IS NULL) AS contratos_null_cargo, \
           (SELECT count(*) FROM cargos_empresa) AS cargos_total, \
           (SELECT count(*) FROM empresas) AS empresas_total;\""
# → notas_total=1 | notas_null_fecha=0  ✓ (fecha_incidente backfill + NOT NULL held)
# → contratos_total=0 | contratos_null_cargo=0  ✓ (no contratos, NOT NULL vacuous)
# → cargos_total=0 | empresas_total=0   ✓ (cargos_empresa empty as predicted; FK DDL still succeeded)

# Tables presence check
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.cargos_empresa') AS cargos_ok, \
           to_regclass('public.educacion_empleado') AS educacion_empleado_ok, \
           to_regclass('public.notas_clientes') AS notas_ok;\""
# → cargos_empresa | educacion_empleado | notas_clientes   ✓ all present

# New contratos columns
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT column_name FROM information_schema.columns WHERE table_name='contratos' AND column_name IN ('cargo_id','archivo_firmado_url') ORDER BY column_name;\""
# → archivo_firmado_url
# → cargo_id                                  ✓ both columns added

# PM2 status (new PID since jul-9 baseline)
ssh ... ec2-user@54.144.25.72 "pm2 jlist"
# → name: miempresa-api | status: online | restarts: 0 | pid: 454011   ✓ (was 376597 in R0)

curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# → {"status":"ok","timestamp":"2026-07-10T15:50:39.004Z"}     ✓ 200 (new build answering)

# After-install log tail
ssh ... ec2-user@54.144.25.72 "tail -50 /opt/miempresa/logs/after-install.log"
# → ...
# → Applying migration `20260710024539_jul9_additive_fields`
# → Applying migration `20260710024613_jul9_nota_fecha_incidente`
# → Applying migration `20260710024705_jul9_educacion_empleado`
# → Applying migration `20260710024928_jul9_cargo_empresa`
# → Applying migration `20260710100000_jul10_contrato_cargo_not_null`
# → Applying migration `20260710100100_jul10_tipo_empleado`
# → All migrations have been successfully applied.
# →   ✓ Database migrations applied
# →   ✓ All artifacts present
# →   ✓ Permissions set (app owned by ec2-user, .env 600)
# → AfterInstall completed successfully
# → Completed: Fri Jul 10 15:49:54 UTC 2026
# →   Stage: staging
# →   node_modules: 267M
# →   dist: 7.6M
```

🔑 All 6 jul-9/jul-10 migrations applied in alphabetical order on the instance, hitting every backfill. `cargos_empresa` ends up EMPTY because staging has 0 `empresas` rows — exactly as predicted in R0 risk gate. The FKs were established by `jul9_cargo_empresa` (referencing `empresas(id)`); since both source tables and target table are empty, the FK DDL and the follow-on NOT NULL constraint both succeeded without errors. PM2 was restarted by `after-install.sh` and picked up new PID 454011 with zero error log entries.

**Decision recorded**: `miempresa-prod` deployment group was NOT enumerated against in `create-deployment`; the staging-only deployment covers `miempresa-staging`.

---

## Phase R4 — Frontend deploy ✋ (Amplify)

```bash
cd frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive

curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE "miempresa-api-stg[^\"]*" | head -1
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/certificados
```

### Execution log R4 — ✅ SUCCEEDED on first attempt (2026-07-10)

**Commands executed (verbatim)**:
```bash
# SSM API_BASE pre-build sanity
aws ssm get-parameter --name /miempresa/staging/frontend/API_BASE \
  --region us-east-1 --profile disruptive --query Parameter.Value --output text
# → https://miempresa-api-stg.disruptiveexp.com/api/v1   ✓ (deploy script bakes this in)

# Run the script
cd /Users/jeik/ws/mi-empresa-app-development/frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
# → [INFO] Resolving Amplify app for stage 'staging'...
# → [INFO]   App ID: d1nsxjyualdzdu
# → [INFO]   Branch: staging
# → [INFO]   API base (baked into build): https://miempresa-api-stg.disruptiveexp.com/api/v1
# → [INFO] Installing dependencies (npm ci)...
# → [nitro] ℹ Prerendering 16 initial routes with crawler
# → [nitro]   ├─ /index.html ... [16 routes prerendered in 1.273s]
# → [nitro] ✔ Generated public .output/public
# → [INFO] ✓ Build complete:  12M
# → [INFO] Packaging /tmp/miempresa-frontend-staging-20260710-105056.zip...
# → [INFO] ✓ Zip: 2.0M
# → [INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260710-105056.zip
# → [INFO] Starting Amplify deployment...
# → [INFO]   Job ID: 4
# → [INFO] ✓ Deployment SUCCEED
# →   Custom domain:  https://miempresa-stg.disruptiveexp.com
# →   Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com

# Verify
curl -s -o /dev/null -w "staging-root: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/
# → 200                                                         ✓
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
# → miempresa-api-stg.disruptiveexp.com/api/v1                  ✓ apiBase points at staging API
curl -s -o /dev/null -w "/certificados: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/certificados
# → 200                                                         ✓ SPA fallback works
```

🔑 Amplify Job ID = **4** (was job 3 in jul-9 → one new deploy = now 4). Custom + default domains both live; apiBase correctly baked.

---

## Phase R5 — Post-deploy QA

```bash
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive

# Cookie-authed smoke for NEW endpoints (single-step ficha, /users, /patients/fichas/vencimientos, /empresa/cargos, contrato-cargo required)
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1

curl -s -c /tmp/jul10-jar -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null -w "login: %{http_code}\n"
# New endpoints smoke
for ep in "patients/fichas/vencimientos?days=7" "users" "empresa/cargos" "certificates/stats" "instruments" "nomina?periodo=2026-07" "patients?limit=1" "auth/me"; do
  curl -s -b /tmp/jul10-jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
done

# Single-step ficha: POST without archivoCompletado (existing 2-step), with archivoCompletado (single-step)
# Cargo-required negative test
# Uppercase round-trip on a created entity
```

### Execution log R5 — ✅ ALL GREEN (2026-07-10)

**Commands executed (verbatim) — full 3-tier staging suite**:
```bash
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive
# → DB QA result: 18 passed / 0 failed
# → Backend API tier: 9 passed (2.8s)
#     ✓ health endpoint responds 200 with status field (336ms)
#     ✓ origin hardening: non-health route is NOT reachable bypassing CloudFront (124ms)
#     ✓ CORS: preflight from the frontend origin is allowed with credentials (127ms)
#     ✓ login rejects wrong password with 401 (499ms)
#     ✓ dev credentials match the stage policy (DEV_USERS_ENABLED) (341ms)
#     ✓ login succeeds with QA credentials and sets the session cookie (327ms)
#     ✓ authenticated GET /auth/me returns the QA user (114ms)
#     ✓ unauthenticated GET /auth/me is rejected with 401 (100ms)
#     ✓ logout invalidates the session (236ms)
# → Frontend browser tier: 6 passed (19.9s)
#     ✓ deployed SPA serves the login page with the app shell (1.7s)
#     ✓ SPA fallback: deep link to a protected route redirects to login (2.5s)
#     ✓ full login flow against the staging backend (2.8s)
#     ✓ invalid credentials show an error and stay on login (2.0s)
#     ✓ logout returns to login (3.8s)
#     ✓ real upload on staging: S3 PUT to the staging uploads bucket returns 200 (6.0s)
# → STAGING QA SUMMARY: ✓ DB / ✓ Backend API / ✓ Frontend browser
```

**Commands executed (verbatim) — jul-10 new-endpoint authed smoke**:
```bash
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1
rm -f /tmp/jul10-jar

curl -s -c /tmp/jul10-jar -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null -w "login: %{http_code}\n"
for ep in "patients/fichas/vencimientos?days=7" "users" "empresa/cargos" "certificates/stats" \
          "instruments" "nomina?periodo=2026-07" "patients?limit=1" "employees?limit=1" "auth/me"; do
  curl -s -b /tmp/jul10-jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
done
# → login: 200
# → GET /patients/fichas/vencimientos?days=7: 200   ← NEW jul-10 weekly endpoint
# → GET /users: 200                                ← NEW jul-10 ADMIN users CRUD
# → GET /empresa/cargos: 200                       ← NEW jul-9 per-empresa catalog
# → GET /certificates/stats: 200
# → GET /instruments: 200                          ← write-gated by requireInstrumentWriter
# → GET /nomina?periodo=2026-07: 200
# → GET /patients?limit=1: 200
# → GET /employees?limit=1: 200
# → GET /auth/me: 200
# ✓ all 8 new/affected endpoints reachable

# Negative tests
curl -s -b /tmp/jul10-jar -X POST "$API/nomina/employees/5/contratos" \
  -H 'Content-Type: application/json' -d '{"fechaInicio":"2026-01-01","fechaFin":"2026-12-31"}' -w "\nHTTP=%{http_code}\n"
# → {"success":false,"message":"Validation error","errors":{"tipoContrato":["Required"],"cargoId":["Required"]}}
# → HTTP=400                                       ✓ D7 cargo_id NOT NULL enforced at the API layer

curl -s -b /tmp/jul10-jar -X POST "$API/users" -H 'Content-Type: application/json' \
  -d '{"email":"foo@bar.com","password":"ValidPass1!","nombre":"Test","apellido":"User","rol":"ADMIN","tipoEmpleado":"GERONTOLOGA"}' -w "\nHTTP=%{http_code}\n"
# → {"success":false,"message":"tipoEmpleado is only valid when rol=\"EMPLEADO\"","field":"tipoEmpleado"}
# → HTTP=400                                       ✓ C6 pairing rule enforced (GERONTOLOGA only with EMPLEADO)

# Uppercase round-trip on POST /users (created + deactivated test user)
curl -s -b /tmp/jul10-jar -X POST "$API/users" -H 'Content-Type: application/json' \
  -d '{"email":"bar@foo.com","password":"ValidPass1!","nombre":"Test","apellido":"User","rol":"EMPLEADO"}'
# → {"success":true,"data":{"id":4,...,"nombre":"TEST","apellido":"USER","rol":"EMPLEADO",...}}
# ✓ E1 uppercase transform applied to nombre + apellido on create (not on email/auth fields)
curl -s -b /tmp/jul10-jar -X PATCH "$API/users/4" -H 'Content-Type: application/json' -d '{"activo":false}'
# → {"success":true,...,"activo":false,...}
# ✓ cleanup test user deactivated (no DELETE route — PATCH activo:false is the supported removal)

# Single-step ficha smoke (C1 atomic ficha)
curl -s -b /tmp/jul10-jar -X POST "$API/patients/2/fichas" \
  -H 'Content-Type: application/json' \
  -d '{"instrumentoId":1,"versionRegistro":"v1","archivoCompletado":"https://example.com/test.pdf","notasObservaciones":"jul10 single-step smoke"}' \
  -w "\nHTTP=%{http_code}\n" -o /tmp/ficha3.json
# → {"success":true,"data":{"id":2,"clienteId":2,"instrumentoId":1,"estado":"COMPLETADO",
#    "archivoCompletado":"https://example.com/test.pdf","fechaCompletado":"2026-07-10T15:52:57.788Z",
#    "fechaVencimiento":null,"versionRegistro":"v1","notasObservaciones":"jul10 single-step smoke",
#    "singleStepCompleted":true,"instrumento":{"id":1,"nombreInstrumento":"DIETA","tipo":"ADMISION"}}}
# → HTTP=201                                       ✓ C1 single-step atomic ficha — singleStepCompleted=true,
#                                                    estado=COMPLETADO on create when archivoCompletado present
curl -s -b /tmp/jul10-jar -X DELETE "$API/patients/2/fichas/2" -w "HTTP=%{http_code}\n"
# → {"success":false,"message":"Solo se pueden eliminar fichas en estado PENDIENTE"}
# → HTTP=400                                       ✓ by design (COMPLETADO fichas are not deletable)
# NOTE: the test ficha persists in staging — minor data residue, harmless for QA
```

**Commands executed (verbatim) — PM2 stability + error-log scan**:
```bash
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; print('status:', p['pm2_env']['status'], '| restarts:', p['pm2_env']['restart_time'], '| pid:', p['pid'])\"; \
   pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | grep -iE 'error|exception|fatal' | grep -v 'ZodError' | tail -10 || echo '(no error matches)'"
# → status: online | restarts: 0 | pid: 454011     ✓ zero restart loops since deploy
# → (no error matches)                              ✓ clean error log
```

🎯 All R5 gates pass: full 3-tier staging suite is 33/33 green; new jul-10 endpoints reachable; cargo-required validation, users pairing-rule, uppercase round-trip, and single-step atomic ficha all confirmed working against the deployed build.

---

## Release result — ✅ COMPLETE (2026-07-10)

```
Deployed:   backend d-9CDIOTWHK  (deployments/jul10-20260710-104847.zip, 267.6 KiB, 1 min 9 s)
            frontend Amplify Job 4  (releases/20260710-105056.zip, 2.0 MiB, first attempt)

DB:         14 → 20 migrations (6 new applied: jul9_additive_fields, jul9_nota_fecha_incidente,
            jul9_educacion_empleado, jul9_cargo_empresa, jul10_contrato_cargo_not_null,
            jul10_tipo_empleado)
            Backfills verified:
              • notas_clientes.fecha_incidente: 1/1 rows have value, 0 NULL  (NOT NULL held)
              • contratos.cargo_id: 0 rows total, 0 NULL  (NOT NULL vacuously satisfied)
              • cargos_empresa: 0 rows seeded (no staging empresas to cross with — predicted)
              • educacion_empleado + cargos_empresa tables present

Baseline:   HEAD 48029efc0b46306d396f4763e0f4bef7644e4363 (jul-7 storage + jul-8 UX + jul-9 improvements + jul-10 hardening)
Backup:     s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz  (16,862 bytes / 16.5 KiB, SHA256 91ef420ffd62..., AES256)

QA:         • 3-tier staging suite: 33/33 green (18 DB + 9 Backend API + 6 Frontend browser)
            • jul-10 endpoints authed smoke: 8/8 reachable (fichas/vencimientos, /users, /empresa/cargos, etc.)
            • Negative tests passed: contrato-sans-cargoId → 400, users pairing rule (rol=ADMIN+tipoEmpleado) → 400
            • E1 uppercase round-trip on POST /users → nombre/apellido UPPERCASE on create
            • C1 atomic single-step ficha → HTTP 201 with singleStepCompleted=true, estado=COMPLETADO
            • PM2 miempresa-api online, 0 restarts since deploy, no error log entries

Not touched: prod (no prod stack/bucket/instance/deployment-group enumerated against)
Tags:       staging-jul10-snapshot created at WIP commit (preserves prior staging-jul5-snapshot)
```

---

## Rollback plan (only on explicit orchestrator instruction)

| Layer | How |
|---|---|
| **Frontend** | Redeploy prior Amplify job artifact (the jul-9 staging artifact is preserved in `miempresa-frontend-artifacts-540657241795-staging/releases/`). `aws amplify start-deployment --app-id d1nsxjyualdzdu --branch staging --source-url s3://…prior-release.zip`. SPA-only, instant. |
| **Backend code** | Redeploy the jul-9 artifact from `miempresa-artifacts-540657241795-staging/deployments/jul9-*.zip` via `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging --s3-location bucket=...,key=deployments/jul9-*.zip,bundleType=zip`. **Asymmetry**: with the jul-10 migrations applied, the OLD backend code that doesn't know about new tables is mostly safe (it never reads `cargos_empresa`, `educacion_empleado`, `tipo_empleado`). The two real risks: (a) old code writing to `notas_clientes` without `fecha_incidente` would fail the new NOT NULL constraint → 500 errors. (b) old code creating `contratos` without `cargo_id` would fail the new NOT NULL constraint. Document both before reverting. |
| **Database** | Restore R2 snapshot: stop pm2 (`pm2 stop miempresa-api`), `dropdb miempresa_staging && createdb miempresa_staging` + `gunzip -c /tmp/pre-jul10-migration.sql.gz \| psql miempresa_staging`, restart pm2. Re-deploy jul-9 backend artifact afterwards. **LAST RESORT — loses any staging data written after 2026-07-10 12:05 UTC**. |
| **CFN s3-stack** | No rollback needed (R1 is a verified no-op). |
| **Amplify stack** | No rollback needed. |

---

## Issues & mitigations log (live — bug ledger continues from jul-9, next B22)

| # | Phase | Issue | Mitigation |
|---|---|---|---|
| 1 | R0 (doc) | `task-assignment-staging-jul10.md` references CodeDeploy application name as `miempresa-app`/`miempresa-staging` (correct, no fix needed) | Verified via `aws deploy list-applications` — runbook uses the same names. |
| 2 | R3 (doc) | `jul10_contrato_cargo_not_null` migration hardcodes `empresa_id=6` lookup (dev-specific) — on staging where there are 0 empresas and 0 contratos the UPDATE is a no-op, so the asymmetry doesn't break staging. **However, the migration is dev-tuned and would not work on any environment with a different empresa_id distribution.** | Documented for the next time this same migration runs in another env. For staging this release, no action needed. Future improvement: parameterize the lookup to `WHERE id IN (SELECT id FROM empresas)` and pair each contrato with its own empresa's "Otro" cargo before applying NOT NULL. |
| 3 | R5 | Smoke loop initially probed `/employees/:id/contrato` (singular) and `/employees/:id/contratos` (plural at root). Returned 404 both times. | Routes are mounted under `/nomina` in `src/routes/index.ts` (`router.use('/nomina', nominaRoutes)`); the contrato path is `/nomina/employees/:id/contratos`. Re-probed at the correct nested path; cargoId/tipoContrato validation fired (400) ahead of the role check, confirming D7 tightening. Documented for future smoke loops. |
| 4 | R5 | `POST /users` smoke initially failed validation with "errors.password/nombre/apellido Required" before pairing-rule check could fire. | Re-sent with all required fields populated. Pairing rule then correctly returned 400 for rol=ADMIN+tipoEmpleado=GERONTOLOGA. |
| 5 | R5 | Test user `bar@foo.com` (id=4) created during uppercase round-trip smoke; `DELETE /users/:id` returned 404 — no DELETE route declared for `/users`. | Switched to PATCH `activo:false` (the supported soft-disable path). User now inactive; data persists but harmless for QA. |
| 6 | R5 | `DELETE /patients/2/fichas/2` on the COMPLETADO test ficha returned 400 ("Solo se pueden eliminar fichas en estado PENDIENTE"). | By design — only PENDIENTE fichas are deletable; the COMPLETADO ficha persists in staging as test residue. Documented. |

📚 **Learnings**
22. The full jul-10 migrations sequence applied in alphabetical order on staging without manual intervention. The `IF NOT EXISTS` / `DO $$ BEGIN ... END $$` guards in `jul9_nota_fecha_incidente`, `jul9_cargo_empresa`, and `jul10_contrato_cargo_not_null` made them safely re-runnable in the future (relevant for partial replay or pre-flight verification).
23. `jul9_cargo_empresa` seeds cargos PER EMPRESA via a `CROSS JOIN (VALUES …)` block, so the seed count equals `7 × count(empresas)`. On staging with 0 empresas the cargo seed loop is a no-op; the migration still succeeds in DDL terms (FK references resolve to an empty base table). Future staging contrato inserts will need a seed pass first.
24. `jul10_contrato_cargo_not_null` is dev-tuned: the cargo_id backfill hardcodes `WHERE ce."empresa_id" = 6` (single-empresa dev DB). On multi-empresa environments this would copy one empresa's "Otro" cargo_id onto every contrato, breaking the FK semantics. **If/when staging gets more empresas or contratos, this migration will need to be re-tuned** to either (a) keep cargo_id nullable + require at the Zod layer (current jul-9 behavior), or (b) parameterize the UPDATE per `contrato.empresa_id`. For now, on staging 0/0 it's a literal no-op and safe.
25. Contrato routes live under `/nomina/employees/:id/contratos` (the `nominaRoutes` router is mounted at `/nomina`). Future smoke loops should probe nested paths directly or read `src/routes/index.ts` first.
26. `/users` has no DELETE endpoint — only PATCH `activo:false`. Smoke loops or admin UIs must use the soft-disable pattern for user removal.
27. `versionRegistro` is a required field for ficha creation (Zod `.min(1).max(20)`). The single-step smoke loop missed it on the first attempt (400 with "errors.versionRegistro Required"); added to the documented schema for future probes.

---

## Grep hooks
staging-release-jul10 jul10-20260710-104847 d-9CDIOTWHK amplify-job-4 pre-jul10.sql.gz staging-jul10-snapshot miempresa-s3-staging UPDATE_COMPLETE 48029efc jul9_additive_fields jul9_nota_fecha_incidente jul9_educacion_empleado jul9_cargo_empresa jul10_contrato_cargo_not_null jul10_tipo_empleado fecha_incidente cargo_id educacion_empleado cargos_empresa TipoEmpleado TipoSangre comprobante_pago_url archivo_firmado_url documento_identificacion_url singleStepCompleted createFichaAtomic flipExpiredFichas nomina-contratos pairing-rule

---

## Hotfix W6 — empresa bootstrap (2026-07-10)

**Source**: `development/next-release-jul-10/tasks/W6-empresa-bootstrap/completion-report.md` §"Hotfix DEPLOY steps for the orchestrator"
**Worker**: pt-devops-infra (W7) · **Verdict**: ✅ Live in staging · **DB**: still 20/20 (no migrations)

**Note**: Asymmetry vs. jul-10 — this is a *code-only* hotfix (POST /empresa + create-mode UI + cargo seed inline). No migrations, no IaC mutation, no SSM change.

### H.R0 — Pre-flight (read-only)
```bash
$ git rev-parse HEAD
48029efc0b46306d396f4763e0f4bef7644e4363   ✓ same jul-10 baseline

$ npx prisma migrate status (filtered, no new migrations expected)
20 migrations found in prisma/migrations
Database schema is up to date!         ✓ still 20/20

$ npx tsc --noEmit
TSC_EXIT=0                              ✓ clean

$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
200                                     ✓

$ ssh ... ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
20 migrations found in prisma/migrations
Database schema is up to date!         ✓ staging matches local — no migrations in hotfix

$ ssh ... ec2-user@54.144.25.72 \
    "sudo -u postgres psql -d miempresa_staging -c \
     \"SELECT (SELECT count(*) FROM empresas) AS empresas, (SELECT count(*) FROM cargos_empresa) AS cargos, (SELECT count(*) FROM contratos) AS contratos;\""
 empresas | cargos | contratos
----------+--------+-----------
        0 |      0 |         0   ✓ confirms W6 BEFORE evidence — staging needed bootstrap

$ aws deploy list-applications --region us-east-1 --profile disruptive
miempresa-app                           ✓
$ aws deploy list-deployment-groups --application-name miempresa-app --region us-east-1 --profile disruptive
miempresa-staging  miempresa-prod       ✓ using ONLY miempresa-staging; prod untouched
```

### H.R2 — Backup
```bash
$ ssh ... ec2-user@54.144.25.72 \
    "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-w6-hotfix.sql.gz && \
     ls -la /tmp/pre-w6-hotfix.sql.gz && \
     sha256sum /tmp/pre-w6-hotfix.sql.gz && \
     aws s3 cp /tmp/pre-w6-hotfix.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-w6-hotfix.sql.gz"
could not change directory to "/home/ec2-user": Permission denied   (benign pg warning)
-rw-rw-r--. 1 ec2-user ec2-user 18906 Jul 10 23:48 /tmp/pre-w6-hotfix.sql.gz
c961f870265b83abebaa6c16fa7df6ff9f47a42af3ef543119ec73624141082a  /tmp/pre-w6-hotfix.sql.gz
Completed 18.5 KiB/18.5 KiB (224.3 KiB/s) with 1 file(s) remaining
upload: .../pre-releases/pre-w6-hotfix.sql.gz    ✓ uploaded

$ aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ --region us-east-1 --profile disruptive --human-readable
2026-07-10 10:48:06   16.5 KiB pre-jul10.sql.gz
2026-07-09 01:05:22   14.3 KiB pre-jul9.sql.gz
2026-07-10 18:48:45   18.5 KiB pre-w6-hotfix.sql.gz     ✓

$ aws s3api head-object --bucket miempresa-backups-540657241795-staging \
    --key pre-releases/pre-w6-hotfix.sql.gz \
    --region us-east-1 --profile disruptive --output json | python3 ...
Size: 18906 bytes                              ✓ matches
ETag: "f33ee1994a5a57f8c1c67d7ef2f6ab0e"
LastModified: 2026-07-10T23:48:45+00:00
ServerSideEncryption: AES256                   ✓ encrypted at rest
```

### H.R3 — Backend deploy + 5-step hotfix evidence
```bash
$ cd backend && npm run build
> mi-empresa-backend@1.0.0 build
> tsc           ✓ clean

$ ls dist/server.js && ! ls dist/generated 2>&1
dist/server.js
ls: dist/generated: No such file or directory   ✓

$ cp infrastructure/db/appspec.yml ./appspec.yml
$ rm -f /tmp/miempresa-staging-w6-hotfix.zip && zip -r /tmp/miempresa-staging-w6-hotfix.zip \
    appspec.yml dist prisma package.json package-lock.json \
    infrastructure/db/scripts infrastructure/db/utilities -x "*.log" | tail -3
$ ls -la /tmp/miempresa-staging-w6-hotfix.zip
-rw-r--r--  1 jeik  wheel  275825 Jul 10 18:49 /tmp/miempresa-staging-w6-hotfix.zip    ✓ 269 KiB

$ TS=$(date +%Y%m%d-%H%M%S)   # TS=20260710-184923
$ aws s3 cp /tmp/miempresa-staging-w6-hotfix.zip \
    s3://miempresa-artifacts-540657241795-staging/deployments/w6-hotfix-${TS}.zip \
    --region us-east-1 --profile disruptive
Completed 269.4 KiB/269.4 KiB (1.0 MiB/s)
upload: .../w6-hotfix-20260710-184923.zip    ✓

$ DEPLOY_ID=$(aws deploy create-deployment \
    --application-name miempresa-app \
    --deployment-group-name miempresa-staging \
    --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/w6-hotfix-20260710-184923.zip,bundleType=zip \
    --description "W6 hotfix: POST /empresa + create-mode UI + cargo seed inline (empresa bootstrap)" \
    --region us-east-1 --profile disruptive \
    --query deploymentId --output text)
$ echo $DEPLOY_ID
d-NT3SGP4IK                                  ✓

$ aws deploy wait deployment-successful --deployment-id d-NT3SGP4IK --region us-east-1 --profile disruptive
$ echo $?
0                                            ✓

$ aws deploy get-deployment --deployment-id d-NT3SGP4IK --region us-east-1 --profile disruptive --output json | python3 ...
Deployment: d-NT3SGP4IK
  Status:   Succeeded
  App/Grp:  miempresa-app / miempresa-staging
  Overview: {'Pending': 0, 'InProgress': 0, 'Succeeded': 1, 'Failed': 0}

$ ssh ... ec2-user@54.144.25.72 "pm2 jlist | python3 ... | grep miempresa-api"
miempresa-api online restarts= 0 pid= 473002   ✓ new build, no restarts

$ ssh ... ec2-user@54.144.25.72 "pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | grep -iE 'error|exception|fatal' | grep -v ZodError | tail -10"
(empty)                                          ✓ no error log entries

$ ssh ... ec2-user@54.144.25.72 "tail -20 /opt/miempresa/logs/after-install.log"
Datasource "db": PostgreSQL database "miempresa_staging", schema "public" at "localhost:5432"
20 migrations found in prisma/migrations
No pending migrations to apply.    ✓ correct — no migrations in hotfix
  ✓ Database migrations applied
[6/6] Verifying artifacts and setting permissions...
  ✓ All artifacts present
  ✓ Permissions set (app owned by ec2-user, .env 600)
AfterInstall completed successfully
Completed: Fri Jul 10 23:50:29 UTC 2026
  Stage: staging
  node_modules: 267M
  dist: 7.6M

$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-07-10T23:51:23.497Z"}    ✓ 200
```

**5-step hotfix evidence (per W6 §R3 post-deploy verification)**:
```bash
$ QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption ... --query Parameter.Value --output text)
$ QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption ... --query Parameter.Value --output text)
$ API=https://miempresa-api-stg.disruptiveexp.com/api/v1

# (a) GET /empresa was 404 → now 200 {data:null}
$ curl -s -c /tmp/w6-stg-jar -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" \
    -o /dev/null -w "login: %{http_code}\n"
login: 200
$ curl -s -b /tmp/w6-stg-jar "$API/empresa" -w "\nHTTP=%{http_code}\n"
{"success":true,"data":null}
HTTP=200                                                     ✓ (a)

# (b) POST /empresa creates row id=1 + seeds 7 cargos atomically
$ curl -s -b /tmp/w6-stg-jar -X POST "$API/empresa" \
    -H 'Content-Type: application/json' \
    -d '{"nombre":"MI EMPRESA STAGING","nit":"900888888-1","email":"admin@miempresa-staging.com"}' \
    -w "\nHTTP=%{http_code}\n"
{"success":true,"data":{"id":1,"nombre":"MI EMPRESA STAGING","nit":"900888888-1","direccion":null,"telefono":null,"email":"admin@miempresa-staging.com","activa":true,"createdAt":"2026-07-10T23:51:02.275Z","updatedAt":"2026-07-10T23:51:02.275Z"}}
HTTP=201                                                     ✓ (b)

# (c) GET /empresa/cargos returns the 7 atomically-seeded cargos
$ curl -s -b /tmp/w6-stg-jar "$API/empresa/cargos" | python3 -c "..."
count:  7
match:  True
names:  ['Auxiliar de Enfermería', 'Auxiliar de Servicios Generales', 'Educador Físico', 'Fisioterapeuta', 'Manualidades', 'Otro', 'Terapeuta Ocupacional']   ✓ (c)

# (d) On-instance DB state matches expectations
$ ssh ... ec2-user@54.144.25.72 \
    "sudo -u postgres psql -d miempresa_staging -c \
     \"SELECT (SELECT count(*) FROM empresas) AS empresas, \
             (SELECT count(*) FROM cargos_empresa) AS cargos, \
             (SELECT count(*) FROM contratos) AS contratos;\""
 empresas | cargos | contratos
----------+--------+-----------
        1 |      7 |         0                                          ✓ (d)

# (e) Single-empresa idempotency: second POST → 409
$ curl -s -b /tmp/w6-stg-jar -X POST "$API/empresa" \
    -H 'Content-Type: application/json' \
    -d '{"nombre":"DUPLICADA","nit":"900111111-1"}' \
    -w "\nHTTP=%{http_code}\n"
{"success":false,"message":"La empresa ya existe","field":"empresa"}
HTTP=409                                                      ✓ (e)
```

### H.R4 — Frontend deploy (Amplify)
```bash
$ cd frontend && ./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
[INFO] ✓ Build complete:  12M
[INFO] Packaging /tmp/miempresa-frontend-staging-20260710-185149.zip...
[INFO] ✓ Zip: 2.0M
[INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260710-185149.zip...
[INFO] Starting Amplify deployment...
[INFO]   Job ID: 5                            ✓ (was 4 after jul-10)
[INFO] ✓ Deployment SUCCEED
  Custom domain:  https://miempresa-stg.disruptiveexp.com
  Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com

$ curl -s -o /dev/null -w "staging-root: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/
staging-root: 200                                              ✓
$ curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
miempresa-api-stg.disruptiveexp.com/api/v1                     ✓ apiBase staged (no prod string)
$ curl -s -o /dev/null -w "/empresa: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/empresa
/empresa: 200                                                  ✓ route reachable (SPA fallback)
$ curl -s -o /dev/null -w "/empresa/editar: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/empresa/editar
/empresa/editar: 200                                           ✓ route reachable
```

### H.R5 — Post-deploy QA (3-tier)
```bash
$ cd /Users/jeik/ws/mi-empresa-app-development && ./scripts/qa-staging.sh --stage staging --profile disruptive
[5/5] Config drift — SSM QA password vs DB bcrypt hash
  ✓ SSM password verifies against DB hash (no drift)
DB QA result: 18 passed / 0 failed
Backend API: 9 passed (2.8s)
Frontend browser: 6 passed (17.5s)
  ✓ DB (schema/migrations/seed)
  ✓ Backend API (smoke)
  ✓ Frontend browser (e2e)            ✓ 33/33 green
```

**Wider cookie-authed regression smoke (10 endpoints)**:
```bash
login: 200
GET /auth/me: 200
GET /empresa: 200                ← W6-hotfix (normalized GET, returns the staged row)
GET /empresa/cargos: 200         ← W6-hotfix (returns 7 seeded cargos)
GET /certificates: 200
GET /certificates/stats: 200
GET /instruments: 200
GET /nomina?periodo=2026-07: 200
GET /employees?limit=1: 200
GET /patients?limit=1: 200
GET /users: 200                              ✓ 10/10 reachable; zero regressions
```

### H.Summary
```
Deployed:    backend  CodeDeploy  d-NT3SGP4IK  (deployments/w6-hotfix-20260710-184923.zip, 269 KiB)
             frontend Amplify Job 5            (releases/20260710-185149.zip, 2.0 MiB)
DB:          20/20 migrations (unchanged) — empresas 0→1, cargos 0→7, contratos 0
Backup:      s3://miempresa-backups-540657241795-staging/pre-releases/pre-w6-hotfix.sql.gz (18.5 KiB, SHA256=c961f870…, AES256)
QA:          3-tier staging suite 33/33 + 10/10 wider authed smoke
Hotfix:      (a) GET normalized / (b) POST returns id=1 / (c) cargos match DEFAULT_CARGOS exactly /
             (d) DB state empresas=1,cargos=7,contratos=0 / (e) idempotent duplicate→409
PM2:         miempresa-api online, 0 restarts, pid=473002, 0 error log entries
Not touched: prod (no prod stack/bucket/instance/deployment-group/CodeDeploy-group enumerated against)
HEAD:        48029efc0b46306d396f4763e0f4bef7644e4363 (unchanged — no commits per task spec)
```

### H.Rollback (not exercised — hotfix is GREEN)
If hotfix breaks anything, redeploy the prior jul-10 artifact:
- Backend: `deployments/jul10-20260710-104847.zip` from `s3://miempresa-artifacts-540657241795-staging/`
  via `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul10-20260710-104847.zip,bundleType=zip`
- Frontend: prior Amplify artifact from `miempresa-frontend-artifacts-540657241795-staging/releases/` (job 4 = jul-10 release; job 5 = this hotfix)
- DB: restore `pre-w6-hotfix.sql.gz` (loses the seeded empresa + cargos — re-run hotfix and POST again)
- **Asymmetry risk (documented, NOT exercised)**: jul-10 backend doesn't know POST /empresa. Old GET / still works on the seeded row; the only thing the old code can't handle is a SECOND POST (but the hotfix already gated that with 409). So rollback is safe — no active traffic to /empresa POST would be in flight at the moment of swap.

### H.Learnings (added to live bug/mitigation ledger)
- **W7-L1**: On-instance `aws s3 ls --profile disruptive` fails because `ec2-user` has no `disruptive` AWS profile. The S3 upload itself uses instance-role credentials and works; verification commands should always run from the local machine. (Generalizes L11 in worker-deploy-learning.)
- **W7-L2**: `qa-staging.sh` step 5/5 ("Config drift — SSM QA password vs DB bcrypt hash") is the canonical post-deploy smoke. If it's still green after a backend re-deploy, the staging user table is intact. Cheap (~3 s), catches accidental auth-table resets.
- **W7-L3**: Hotfix pattern (no migrations, no IaC, no SSM change) skips R1 entirely. R0 → R2 → R3 → R4 → R5 is sufficient. Document this as the §"minimal backend code-only hotfix" pattern in worker-deploy-learning for future use.
- **W7-L4**: The `cargos_empresa` seed loop in `jul9_cargo_empresa` migration (jul-10 release) was a no-op on staging (0 empresas at that time). The W6 hotfix's `createEmpresa` `$transaction` + `createMany` is the live mechanism that populates `cargos_empresa` for the staging-test empresa. Future staging-instances: if you want a different staging-test empresa, delete + recreate it via the API; the `Otro` cargo will be one of the 7 re-seeded.

### H.Grep hooks
hotfix w6-hotfix-20260710-184923 d-NT3SGP4IK amplify-job-5 pre-w6-hotfix.sql.gz mi-empresa-staging empresa-bootstrap HOTFIX MI EMPRESA STAGING admin@miempresa-staging.com idempotent-empresa 409-La-empresa-ya-existe DEFAULT_CARGOS createMany skipDuplicates atomic-createEmpresa

---

## Hotfix hotfixqa — S3 durable fix + S7 + UI (2026-07-11)

**Reference**: [tasks/W8-s3-forensics/result.md](../../development/hotfixqa-jul-10/tasks/W8-s3-forensics/result.md) (root cause + classification) · [tasks/W11-fixes/result.md](../../development/hotfixqa-jul-10/tasks/W11-fixes/result.md) (what ships) · worker-deploy-learning.md
**Targets**: same as above
**Deployer**: pt-devops-infra (worker-8, reused W8)
**Pattern**: minimal backend code-only hotfix (W7-L3)
**NOT in scope**: anything `prod` — no prod resource is read or mutated.

### Hotfix scope

| Area | Change |
|---|---|
| **Backend (P0)** | NEW `backend/src/config/awsCredentials.ts` — env-aware async credentials provider that reads `~/.aws/credentials` and synthesizes `expiration = fileMtime + 55min`. Wired into `s3Service.ts` via `resolveS3Credentials()`. Solves the W8 root cause (SDK cache never invalidates because file format has no `expiration` field). 14/14 unit tests green. |
| **Backend (Stopgap-B sync)** | Repo `infrastructure/db/scripts/refresh-credentials.sh` synced with the W8 on-instance stopgap (pm2 reload after successful credential rotation). 329 lines (was 272). `bash -n` syntax OK. |
| **Frontend (P1)** | S7 fix — `archivoUrl` now included in empleado certificados PUT payload (was being dropped from form save). Download affordance added to certificado rows. Same fix in `empleados/nuevo.vue` wizard. |
| **Frontend (Wave B)** | C3 cert refresh after save, C4 contrato "descargar firmado" button, C6 detail-view Contrato tab, C1/C7 silent-failure specs. |
| **Tests** | `backend/tests/s3/awsCredentials.spec.ts` (NEW, 14 unit tests) + 3 local-qa specs (`jul10-w11-empleado-cert-persistence`, `jul10-w11-silent-failure`, `jul10-w11-ui-parity`) = 9/9 green locally. |
| **DB** | None — no migrations. 20/20 unchanged. |
| **Infra** | None — no IaC, no SSM, no IAM. |
| **Not needed** | No new SSM params, no IAM changes, no instance changes other than the deploy itself. |

### R0 — Preflight (local + read-only staging) — no mutations

```
$ git rev-parse HEAD
48029efc0b46306d396f4763e0f4bef7644e4363

$ cd backend && npx tsc --noEmit
tsc exit: 0

$ curl http://localhost:3101/api/v1/health
Local /api/v1/health: 200

$ ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate status"
20 migrations found in prisma/migrations
Database schema is up to date!

$ curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health
Staging health: 200

$ pm2 jlist (on-instance, pre-deploy)
PID: 485205, Status: online, Restart count: 4, Started: 2026-07-11T04:00:54Z

$ row counts baseline
empleados=6, clientes=2, certificados_empresa=1, certificados_empleado=1
```

### R2 — DB backup

```
$ sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-hotfixqa.sql.gz
-rw-rw-r--. 1 ec2-user ec2-user 20860 Jul 11 04:20 /tmp/pre-hotfixqa.sql.gz

$ sha256sum /tmp/pre-hotfixqa.sql.gz
ab1e9d27740ad426d86ec49992648afa1e4336f7a54be567675bd1888d2ebe5f  /tmp/pre-hotfixqa.sql.gz

$ aws s3 cp /tmp/pre-hotfixqa.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-hotfixqa.sql.gz
upload: ../../tmp/pre-hotfixqa.sql.gz to s3://miempresa-backups-540657241795-staging/pre-releases/pre-hotfixqa.sql.gz

$ aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/pre-hotfixqa.sql.gz --summarize
Total Objects: 1
   Total Size: 20860
```

### R3 — Backend deploy (CodeDeploy)

```
$ cd backend && npm ci && npm run build && npx prisma generate
npm ci exit: 0
tsc build exit: 0
dist/server.js present, dist/generated NOT present

$ cp infrastructure/db/appspec.yml ./appspec.yml
$ zip -r /tmp/artifact-hotfixqa.zip appspec.yml dist prisma package.json package-lock.json infrastructure/db/scripts infrastructure/db/utilities
$ ls -la /tmp/artifact-hotfixqa.zip
-rw-r--r--  1 jeik  wheel  282765 Jul 10 23:20 /tmp/artifact-hotfixqa.zip
$ sha256sum /tmp/artifact-hotfixqa.zip
6d514c6a4720457f19fd930c505bf611cfe945091fb7ecfdfddd0a630df8bc07

$ unzip -l /tmp/artifact-hotfixqa.zip | grep appspec
     5193  07-10-2026 23:20   appspec.yml      ← at root ✓
$ unzip -l /tmp/artifact-hotfixqa.zip | grep dist/generated
OK: dist/generated NOT in zip ✓

$ aws s3 cp /tmp/artifact-hotfixqa.zip s3://miempresa-artifacts-540657241795-staging/deployments/20260710-232056-hotfixqa.zip
upload: ../../../../../tmp/artifact-hotfixqa.zip to s3://miempresa-artifacts-540657241795-staging/deployments/20260710-232056-hotfixqa.zip

$ DEPLOY_ID=$(aws deploy create-deployment \
    --application-name miempresa-app \
    --deployment-group-name miempresa-staging \
    --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/20260710-232056-hotfixqa.zip,bundleType=zip \
    --region us-east-1 --profile disruptive \
    --query deploymentId --output text)
$ echo $DEPLOY_ID
d-VGKFFBAIK

$ aws deploy wait deployment-successful --deployment-id d-VGKFFBAIK --region us-east-1 --profile disruptive
wait exit: 0

$ aws deploy get-deployment --deployment-id d-VGKFFBAIK --query deploymentInfo.status
Status: Succeeded

# Post-deploy pm2 + health
PID: 486757, Status: online, Restart count: 0, Started: 2026-07-11T04:22:11Z
Staging /api/v1/health: 200
migrate status: Database schema is up to date!
pm2 logs scan for errors: 0 entries
```

### R3b — Cred-rotation-boundary check (P0 isolation)

This was the critical verification. W8's stopgap-B reloads pm2 at every cron tick, so to isolate the P0 code fix from the stopgap, the stopgap block was temporarily commented out via `python3` splice at `/opt/miempresa/scripts/refresh-credentials.sh`. Backup saved to `.bak-w8-isol`. Stopgap restored after the test.

```
# Step 1: PRE-ROTATION baseline (before any manual refresh)
$ date -u; grep aws_access_key_id /home/ec2-user/.aws/credentials
Sat Jul 11 04:24:17 UTC 2026
aws_access_key_id = ASIA_REDACTED       ← OLD
PID: 486757, Started: 2026-07-11T04:22:11Z
$ presign → URL X-Amz-Credential=ASIA_REDACTED     ← OLD, matches file

# Step 2: Run refresh manually (rotation, NO stopgap reload fires)
$ sudo /opt/miempresa/scripts/refresh-credentials.sh     # stopgap block commented out
file mtime 04:00 → 04:24
file key  ASIA_REDACTED (OLD) → ASIA_REDACTED (NEW)
PM2 PID: 486757 UNCHANGED                                  ← no reload fired

# Step 3: IMMEDIATE post-rotation presign (cache still holds OLD key)
$ presign → URL X-Amz-Credential=ASIA_REDACTED     ← OLD (cache hold — expected)
$ file key                                                   ASIA_REDACTED (NEW)

# Step 4: Wait for natural cron tick at 04:45 + P0 cache invalidation
04:45 cron fires → file mtime 04:45 → key BTZGKMYOL (NEW from cron)
04:50:35 (after P0's mtime+55min cycle refreshes) presign →
   URL X-Amz-Credential=ASIA_REDACTED              ← NEW (matches file)
PM2 PID: 486757 UNCHANGED                                  ← STILL no reload — proves P0 alone

# Step 5: Restore stopgap
$ sudo cp /opt/miempresa/scripts/refresh-credentials.sh.bak-w8-isol /opt/miempresa/scripts/refresh-credentials.sh
$ sudo bash -n /opt/miempresa/scripts/refresh-credentials.sh
SYNTAX OK
```

**Verdict: P0 works in isolation. The SDK refreshes its credentials from the file without requiring a pm2 reload, even with the stopgap disabled. Combined defense (P0 + Stopgap-B) is now in place.**

### R4 — Frontend deploy (Amplify)

```
$ cd frontend && ./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
[nitro] ✔ Generated public .output/public
[INFO] ✓ Build complete:  12M
[INFO] Packaging /tmp/miempresa-frontend-staging-20260710-235452.zip...
[INFO] ✓ Zip: 2.0M
[INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260710-235452.zip...
[INFO] Starting Amplify deployment...
[INFO]   Job ID: 6
[INFO] ✓ Deployment SUCCEED
  Custom domain:  https://miempresa-stg.disruptiveexp.com
  Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com

$ curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
miempresa-api-stg.disruptiveexp.com/api/v1                    ← correct API base

$ for p in /certificados/1 /empleados/6 /pacientes/2 /instrumentos/1 /nomina; do
    /usr/bin/curl -s -o /dev/null -w "%{http_code}\n" "https://miempresa-stg.disruptiveexp.com$p"
  done
/certificados/1                200
/empleados/6                   200
/pacientes/2                   200
/instrumentos/1                200
/nomina                        200
```

### R5 — Staging QA + S7 curl re-test

```
$ ./scripts/qa-staging.sh --stage staging --profile disruptive
TIER: Backend API (smoke)
  9 passed (2.8s)

TIER: Frontend browser (e2e)
  ✓ empleado certificado: upload persists a downloadable key across reload (2.4s)
  ✓ ficha single-step: uploaded eval persists as COMPLETADO and downloads (1.4s)
  ✓ Staging frontend smoke (5 tests, 13.2s)
  ✓ nota create: valid nota persists; out-of-window fecha returns a surfaced 400 (948ms)
  ✓ S3 canary: presign→PUT→GET round-trips with non-expired credentials (1.0s)
    [s3-canary] host-ok put=200 get=200 stsToken=true accessKeyId=ASIA_REDACTED
  ✓ real upload on staging: S3 PUT to the staging uploads bucket returns 200 (6.2s)
  10 passed (26.6s)

STAGING QA SUMMARY: ✓ DB ✓ Backend API ✓ Frontend browser

# S7 curl re-test (verifies the W11 fix lands)
$ PUT /employees/6/certificados with archivoUrl  → HTTP 200
$ GET  /employees/6 (simulates reload)            → archivoUrl PRESENT (S7 PASS)
$ GET  presigned download URL for persisted key   → HTTP 200, content match
$ Cleanup: clear certs + delete S3 object         → HTTP 200 + delete OK
```

### Hotfix Summary

```
Deployed:    backend  CodeDeploy  d-VGKFFBAIK  (deployments/20260710-232056-hotfixqa.zip, 276 KiB)
             frontend Amplify Job 6            (releases/20260710-235452.zip, 2.0 MiB)
DB:          20/20 migrations (unchanged)
Backup:      s3://miempresa-backups-540657241795-staging/pre-releases/pre-hotfixqa.sql.gz (20.4 KiB, SHA256=ab1e9d27…)
QA:          9/9 backend + 10/10 frontend = 19/19 green; S3 canary confirms presign uses current STS access key
S7:          curl re-test PASS (archivoUrl persists across reload + download 200)
P0:          isolated verification PASS (SDK refreshes from file without pm2 reload — see R3b)
PM2:         miempresa-api online, pid=486757, started 2026-07-11T04:22:11Z, 0 error log entries
Stopgap-B:   ON-INSTANCE active (cron-driven pm2 reload); REPO synced (infrastructure/db/scripts/refresh-credentials.sh)
Not touched: prod (no prod stack/bucket/instance/deployment-group/CodeDeploy-group enumerated against)
HEAD:        48029efc0b46306d396f4763e0f4bef7644e4363 (unchanged — no commits per task spec)
```

### H.Rollback (not exercised — hotfix is GREEN)
If hotfix breaks anything, redeploy the prior jul-10 hotfix artifact (`deployments/w6-hotfix-20260710-184923.zip` from `s3://miempresa-artifacts-540657241795-staging/`) via:
```
aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/w6-hotfix-20260710-184923.zip,bundleType=zip --region us-east-1 --profile disruptive
```
Frontend rollback: Amplify job 5 (the prior release) via Amplify console.
DB: restore `pre-hotfixqa.sql.gz` (no schema change — rows unchanged).

### H.Learnings (added to live bug/mitigation ledger)
- **W11-L1**: When isolating a credential-cache fix from a stopgap-reload fallback, **comment out the stopgap block via Python splice (not sed)** — bash heredoc escaping for `python3 -c "..."` inside `ssh` is painful. The clean pattern: `scp` a tiny `.py` file to the instance, `sudo python3 <file>.py`, then verify with `sudo bash -n` + `grep -c '<marker>'`. Saved as `/tmp/w8-*-stopgap.py` if re-running.
- **W11-L2**: P0 isolation proved the SDK's `memoizeChain` is NOT the only cache layer — the S3Client's signing middleware appears to cache the provider function reference per-operation and only refreshes when the provider's `expiration` falls within ~5 min of expiry. For the file-mtime-based provider to refresh in-process, the mtime must have advanced since the first read (which is exactly what happens after each cron rotation). The empirical proof (URL switches from OLD to NEW key between 04:45:02 and 04:50:35, with PID unchanged) is stronger than the unit-test proof.
- **W11-L3**: Repo-vs-instance divergence is now resolved — `backend/infrastructure/db/scripts/refresh-credentials.sh` has the W8 stopgap block synced. Future CodeDeploy deployments will preserve it (the artifact zip includes `infrastructure/db/scripts/` per `worker-deploy-learning.md` T5.5). When A→B→C transition is fully complete (i.e., Option A code fix is durable enough to supersede the stopgap), remove both the repo block AND the on-instance block in one atomic deploy.
- **W11-L4**: `deploy-frontend.sh` already handles `--stage staging --region --profile` flags end-to-end; no manual S3/Amplify juggling needed. ~20s end-to-end.

### H.Grep hooks
hotfixqa hotfixqa-20260710-232056 d-VGKFFBAIK amplify-job-6 pre-hotfixqa.sql.gz P0 isolation rotation-boundary awsCredentials resolveS3Credentials stopgap-B rest sync S7 archivoUrl silent-failure ui-parity

---

## Hotfix I1-I3 — presign hardening (2026-07-11)

**Reference**: [development/hotfixqa-jul-10/tasks/W12-presign-hardening/completion-report.md](../../development/hotfixqa-jul-10/tasks/W12-presign-hardening/completion-report.md) (W12 implementation) · [development/hotfixqa-jul-10/tasks/W12-presign-hardening/deploy-result.md](../../development/hotfixqa-jul-10/tasks/W12-presign-hardening/deploy-result.md) (W13 deploy evidence)
**Targets**: same as above (no scope change vs. previous hotfixes)
**Deployer**: pt-devops-infra (worker-13, W13)
**Pattern**: minimal backend code-only hotfix (W7-L3)
**NOT in scope**: anything `prod` — no prod resource is read or mutated.

### Hotfix scope

| Area | Change |
|---|---|
| **Backend (I1)** | NEW `CredentialsExpiredError` + `assertCredentialsUsable` guard in `services/s3Service.ts` — fail-fast before `getSignedUrl` if creds carry `expiration` and it's ≤ `now + 60s margin`. Verified by 4 service tests + 4 route tests. |
| **Backend (I2)** | NEW `clampExpiresToCredLifetime(requested, creds, now)` helper — clamps both upload and download expiry to `min(requested, (expiration - now)/1000 - 60)`. Throws if clamp result ≤ 0. Verified by 3 service tests. |
| **Backend (I3)** | `generateDownloadUrl(key, expiresIn = 900)` — NEW default 900s (was 3600). Verified by service test #17 + live curl (clamp caught the value before reaching 900). |
| **Backend (route)** | `routes/uploads.routes.ts` refactored: module singleton → factory `createUploadRoutes(authMw)`; exports `isCredsExpired(error)` predicate; both presign endpoints catch `CredentialsExpiredError` and return 503 `{ success:false, code:'CREDS_EXPIRED', message:'Servicio de archivos temporalmente no disponible' }`. |
| **Backend (P0 provider)** | `config/awsCredentials.ts` UNTOUCHED (per W12 scope); 14/14 unit tests still green. |
| **Frontend** | None. |
| **Tests** | NEW `backend/tests/s3/s3Service.spec.ts` (22 tests) + `backend/tests/uploads/uploads-credentials-expired.spec.ts` (6 tests) + `backend/tests/s3/_env-setup.ts` helper. Total: 51/51 green (`14 awsCredentials + 22 s3Service + 6 uploads-creds-expired + 9 uploads`). |
| **DB** | None — no migrations. 20/20 unchanged. |
| **Infra** | None — no IaC, no SSM, no IAM. |
| **Not needed** | No new SSM params, no IAM changes, no instance changes other than the deploy itself. |

### R0 — Preflight (local + read-only staging) — no mutations

```bash
$ git rev-parse HEAD
48029efc0b46306d396f4763e0f4bef7644e4363                  ✓ same jul-10 baseline (no commits per spec)

$ cd backend && npx tsc --noEmit
TSC_EXIT=0                                                ✓ clean

$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/api/v1/health
200                                                       ✓

$ cd backend && npx prisma migrate status
20 migrations found in prisma/migrations
Database schema is up to date!                             ✓ local 20/20

$ ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate status"
20 migrations found in prisma/migrations
Database schema is up to date!                             ✓ instance 20/20 (no new migrations to apply)

$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
200                                                       ✓

# Modified files exist with hardening markers (sanity check before zipping)
$ grep -nE "CredentialsExpiredError|clampExpiresToCredLifetime|expiresIn = 900" backend/src/services/s3Service.ts
72:export class CredentialsExpiredError extends Error { ... }
86:export function clampExpiresToCredLifetime(...) { ... }
191:  expiresIn = 900,                                     ✓ I3 default visible
196:  const effectiveExpiresIn = clampExpiresToCredLifetime(expiresIn, creds, now)

$ grep -nE "isCredsExpired|CREDS_EXPIRED|createUploadRoutes" backend/src/routes/uploads.routes.ts
22:export function isCredsExpired(error: unknown): boolean { ... }   ✓ exported for testability
36:export function createUploadRoutes(authMw: RequestHandler = authMiddleware()): Router { ... }
49:      if (isCredsExpired(error)) {  ... 503 CREDS_EXPIRED ... }   ✓ route mapped
54:          code: 'CREDS_EXPIRED',
79:          code: 'CREDS_EXPIRED',
92:const router = createUploadRoutes()
```

### R2 — DB backup (defense-in-depth, not strictly needed for code-only hotfix)

```bash
$ ssh ec2-user@54.144.25.72 \
    "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-i123.sql.gz && \
     ls -la /tmp/pre-i123.sql.gz && sha256sum /tmp/pre-i123.sql.gz && \
     aws s3 cp /tmp/pre-i123.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-i123.sql.gz && \
     aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"
could not change directory to "/home/ec2-user": Permission denied   (benign pg warning)
-rw-rw-r--. 1 ec2-user ec2-user 23454 Jul 11 13:40 /tmp/pre-i123.sql.gz
4fde3dd094fa8b4b7f1b55144791fff75fe7ed70f5e623fc8adecb65d5a3d2ea  /tmp/pre-i123.sql.gz
Completed 22.9 KiB/22.9 KiB (275.0 KiB/s) with 1 file(s) remaining
upload: ../../tmp/pre-i123.sql.gz to s3://miempresa-backups-540657241795-staging/pre-releases/pre-i123.sql.gz
2026-07-11 04:20:36      20860 pre-hotfixqa.sql.gz
2026-07-11 13:40:43      23454 pre-i123.sql.gz                ✓ uploaded (latest pre-release)
2026-07-10 15:48:06      16862 pre-jul10.sql.gz
2026-07-10 23:48:45      18906 pre-w6-hotfix.sql.gz
2026-07-09 06:05:22      14694 pre-jul9.sql.gz                ✓ all prior pre-releases preserved

$ aws s3api head-object --bucket miempresa-backups-540657241795-staging \
    --key pre-releases/pre-i123.sql.gz --region us-east-1 --profile disruptive --output json | python3 -c "..."
Size: 23454                                                ✓ matches
ETag: "0d1dcad93ce252ca27d5cd5b8a43106b"
LastModified: 2026-07-11T13:40:43+00:00                     ✓ matches upload
ServerSideEncryption: AES256                                ✓ encrypted at rest
```

### R3 — Backend deploy (CodeDeploy)

```bash
$ cd backend && npm run build
> mi-empresa-backend@1.0.0 build
> tsc                                                      ✓ clean

$ ls dist/server.js && ls dist/generated 2>&1
-rw-r--r--  1 jeik  staff  724 Jul 11 08:40 dist/server.js
ls: dist/generated: No such file or directory              ✓ (after-install.sh creates on-instance)

$ cp infrastructure/db/appspec.yml ./appspec.yml
$ rm -f /tmp/miempresa-staging-i123.zip
$ zip -r /tmp/miempresa-staging-i123.zip \
    appspec.yml dist prisma package.json package-lock.json \
    infrastructure/db/scripts infrastructure/db/utilities -x "*.log" | tail -3
$ ls -la /tmp/miempresa-staging-i123.zip
-rw-r--r--  1 jeik  wheel  287945 Jul 11 08:40 /tmp/miempresa-staging-i123.zip    ✓ 281 KiB

$ unzip -l /tmp/miempresa-staging-i123.zip | grep -E "appspec|server\.js"
5193  07-11-2026 08:40   appspec.yml                       ← at root ✓
 724  07-11-2026 08:40   dist/server.js
$ unzip -l /tmp/miempresa-staging-i123.zip | grep -i generated
(empty)                                                    ✓ dist/generated NOT in zip

$ TS=$(date +%Y%m%d-%H%M%S)                                # TS=20260711-084102
$ aws s3 cp /tmp/miempresa-staging-i123.zip \
    s3://miempresa-artifacts-540657241795-staging/deployments/i123-${TS}.zip \
    --region us-east-1 --profile disruptive
Completed 281.2 KiB/281.2 KiB (1.1 MiB/s) with 1 file(s) remaining
upload: .../i123-20260711-084102.zip                       ✓

$ DEPLOY_ID=$(aws deploy create-deployment \
    --application-name miempresa-app \
    --deployment-group-name miempresa-staging \
    --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/i123-${TS}.zip,bundleType=zip \
    --description "staging jul-11 hotfix I1-I3 presign hardening (CREDS_EXPIRED + clamp + 900s download)" \
    --region us-east-1 --profile disruptive \
    --query deploymentId --output text)
$ echo $DEPLOY_ID
d-HH2LFJIIK                                               ✓

$ aws deploy wait deployment-successful --deployment-id d-HH2LFJIIK --region us-east-1 --profile disruptive
WAIT_EXIT=0                                                ✓

$ aws deploy get-deployment --deployment-id d-HH2LFJIIK --region us-east-1 --profile disruptive --output json | python3 -c "..."
Deployment: d-HH2LFJIIK
Status:     Succeeded
App/Grp:    miempresa-app / miempresa-staging
Overview:   {'Pending': 0, 'InProgress': 0, 'Succeeded': 1, 'Failed': 0, 'Skipped': 0}
Start:      2026-07-11T08:41:04-05:00
Complete:   2026-07-11T08:42:13-05:00                       ✓ 1 min 9 s
Artifact:   s3://miempresa-artifacts-540657241795-staging/deployments/i123-20260711-084102.zip
```

### R3 post-deploy verification

```bash
$ ssh ec2-user@54.144.25.72 "pm2 jlist"
name:    miempresa-api
status:  online
pid:     510987                                              ✓ NEW PID (was 486757 in hotfixqa deploy)
restarts: 0                                                  ✓ clean restart count

$ curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-07-11T13:43:25.717Z"}        ✓ 200

$ ssh ec2-user@54.144.25.72 "tail -25 /opt/miempresa/logs/after-install.log"
20 migrations found in prisma/migrations
No pending migrations to apply.                              ✓ correct — no migrations in hotfix
  ✓ Database migrations applied
  ✓ All artifacts present
  ✓ Permissions set (app owned by ec2-user, .env 600)
AfterInstall completed successfully
Completed: Sat Jul 11 13:42:05 UTC 2026
  Stage: staging
  node_modules: 267M
  dist: 7.6M

$ ssh ec2-user@54.144.25.72 \
    "pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | \
     grep -iE 'error|exception|fatal' | grep -v ZodError | tail -10"
(empty)                                                      ✓ no error log entries
```

### R5 — Smoke (per W12 deploy notes — 4-step verification)

```bash
$ QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption ... --query Parameter.Value --output text)
$ QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption ... --query Parameter.Value --output text)
$ API=https://miempresa-api-stg.disruptiveexp.com/api/v1
$ curl -s -c /tmp/i123-jar -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" \
    -o /dev/null -w "login: %{http_code}\n"
login: 200                                                   ✓

# Smoke 1: POST /uploads/presigned-url → 200, X-Amz-Expires=300 (upload default UNCHANGED)
$ curl -s -b /tmp/i123-jar -X POST "$API/uploads/presigned-url" \
    -H 'Content-Type: application/json' \
    -d '{"contentType":"application/pdf","folder":"certificados-empleado"}' \
    | python3 -c "import sys,json,re;u=json.load(sys.stdin)['data']['uploadUrl'];print(re.search(r'X-Amz-Expires=\d+',u).group(0))"
X-Amz-Expires=300                                            ✓ I0 (upload default unchanged from jul-5)

# Smoke 2: GET /uploads/download-url → 200 (I3 visible change)
$ curl -s -b /tmp/i123-jar "$API/uploads/download-url?key=certificados-empleado/i123-smoke.pdf" \
    | python3 -c "import sys,json,re;u=json.load(sys.stdin)['data']['downloadUrl'];print(re.search(r'X-Amz-Expires=\d+',u).group(0))"
X-Amz-Expires=670                                            ⚠ < 900 default → CLAMP FIRED (see Smoke 3)

# Smoke 3: Clamp observation (caught the rotation window — no wait required!)
$ date -u && \
  ssh ec2-user@54.144.25.72 "stat -c '%y' /home/ec2-user/.aws/credentials; grep aws_access_key_id /home/ec2-user/.aws/credentials"
Sat Jul 11 13:43:33 UTC 2026
2026-07-11 13:00:05.875099362 +0000                          ← last rotation 13:00:05 UTC
aws_access_key_id = ASIA_REDACTED

# Elapsed 43 min 28 s → 11 min 32 s remaining → 692 s, minus 60 s margin = 632 s expected.
# Observed: 13:42:55 UTC → 670 s (730 remaining - 60 margin)   ✓
#            13:43:32 UTC → 645 s (705 remaining - 60 margin)   ✓
# Both < 900 default ⇒ clamp reducing requested value to fit cred lifetime. I2 VERIFIED LIVE.

# Smoke 4: Full PUT→GET round-trip → 200, byte-identical
$ printf "hello-i123-roundtrip-payload" > /tmp/i123-payload.bin
$ ORIG_HASH=$(shasum -a 256 /tmp/i123-payload.bin | awk '{print $1}')
$ UPLOAD_URL=$(curl -s -b /tmp/i123-jar -X POST "$API/uploads/presigned-url" \
    -H 'Content-Type: application/json' -d '{"contentType":"text/plain","folder":"i123-smoke"}' \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['uploadUrl'])")
$ curl -s -o /dev/null -w "PUT: %{http_code}\n" -X PUT "$UPLOAD_URL" \
    -H 'Content-Type: text/plain' --data-binary @/tmp/i123-payload.bin
PUT: 200                                                     ✓
$ DL_URL=$(curl -s -b /tmp/i123-jar "$API/uploads/download-url?key=i123-smoke/cac55c18-0aec-4be1-8f80-858452401258.plain" \
    | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['downloadUrl'])")
$ echo "DL X-Amz-Expires: $(echo "$DL_URL" | grep -oE 'X-Amz-Expires=[0-9]+')"
DL X-Amz-Expires: X-Amz-Expires=645                          ← clamp fired again (same window)
$ curl -s -o /tmp/i123-round.bin -w "GET: %{http_code} | size: %{size_download}\n" "$DL_URL"
GET: 200 | size: 28                                          ✓
$ ROUND_HASH=$(shasum -a 256 /tmp/i123-round.bin | awk '{print $1}')
$ [ "$ORIG_HASH" = "$ROUND_HASH" ] && echo "✓ BYTE-IDENTICAL"
✓ BYTE-IDENTICAL

# Wider authed smoke (8 endpoints — no regressions)
$ for ep in "auth/me" "certificates" "certificates/stats" "instruments" \
            "nomina?periodo=2026-07" "employees?limit=1" "patients?limit=1" "users"; do
    curl -s -b /tmp/i123-jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
  done
GET /auth/me: 200
GET /certificates: 200
GET /certificates/stats: 200
GET /instruments: 200
GET /nomina?periodo=2026-07: 200
GET /employees?limit=1: 200
GET /patients?limit=1: 200
GET /users: 200                                              ✓ 8/8 reachable — zero regressions
```

### 🔑 W12 "Optional fail-fast verification" — DELIBERATELY NOT RUN

The W12 completion-report §Deploy notes step 4 suggests pausing `refresh-credentials.sh` cron on staging and waiting one STS cycle to observe the 503 live. **Decision: NOT executed.** Rationale:
1. Pausing the cron would deliberately break staging for ~1 hour — out-of-scope for a routine hotfix.
2. The 503 path is fully covered by the 6 unit tests in `backend/tests/uploads/uploads-credentials-expired.spec.ts` (verified by W12 — see `completion-report.md` §"Acceptance criteria — verdict").
3. Triggering the 503 live in staging would block any concurrent QA session hitting presign.
4. The route's `isCredsExpired` predicate + 503 branch is at `routes/uploads.routes.ts` lines 49-58 and 74-83; the predicate is also exported for testability (`isCredsExpired(error)`).

If a future worker wants live verification of the I1 path, do it in a controlled window (off-hours, or on a temporary stage instance). Do NOT pause the cron during normal staging operation.

### Hotfix Summary

```
Deployed:    backend  CodeDeploy  d-HH2LFJIIK  (deployments/i123-20260711-084102.zip, 281 KiB, 1 min 9 s)
DB:          20/20 migrations (unchanged)
Backup:      s3://miempresa-backups-540657241795-staging/pre-releases/pre-i123.sql.gz
             (23,454 bytes / 22.9 KiB, SHA256=4fde3dd094fa8b4b7f1b55144791fff75fe7ed70f5e623fc8adecb65d5a3d2ea, AES256)
Smoke:       POST /uploads/presigned-url → 200, X-Amz-Expires=300                  ✓ I0 (unchanged)
             GET  /uploads/download-url    → 200, X-Amz-Expires=670 (< default 900) ✓ I2 (clamp fired)
             Full PUT→GET round-trip       → 200, 28B in == 28B out, SHA256 match    ✓ end-to-end
             8 wider authed endpoints reachable, zero regressions                    ✓
PM2:         miempresa-api online, pid=510987, 0 restarts, 0 error log entries
Clamp:       OBSERVED live (670s + 645s both < 900 default ⇒ I2 working)
I3 default:  expiresIn = 900 at s3Service.ts line 191 (code-inspection proven; clamp observed default first)
I1 path:     COVERED by 6 route unit tests; NOT run live (decision recorded above)
Not touched: prod (no prod stack/bucket/instance/deployment-group/CodeDeploy-group enumerated against)
HEAD:        48029efc0b46306d396f4763e0f4bef7644e4363 (unchanged — no commits per task spec)
```

### H.Rollback (not exercised — hotfix is GREEN)

Redeploy the prior hotfixqa artifact:
```bash
aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/20260710-232056-hotfixqa.zip,bundleType=zip \
  --region us-east-1 --profile disruptive
```
DB: restore `pre-i123.sql.gz` (no schema change — rows unchanged).
No frontend change → no frontend rollback.

### H.Learnings (added to live bug/mitigation ledger)

- **W13-L1**: The I2 clamp observation does NOT require waiting for a specific UTC minute — when the deploy window happens to land between 30 and 55 min after a credential rotation (which is most of the hour), the clamp will visibly reduce the requested expiry below the default 900. The empirical two-probe monotonic decrease (670 → 645 over ~37 s elapsed) is stronger evidence than the unit tests, because it exercises the real AWS SDK's `getSignedUrl` path with live credentials. **Next time we ship a clamp-style fix, just deploy and re-probe — don't wait for a "rotation boundary".**
- **W13-L2**: `dist/server.js` is only 724 bytes — the entire backend compiles to a tiny entry stub that imports the heavier modules. Adding 4 service tests + 6 route tests + 1 env-setup helper added zero measurable weight to the deployment artifact. Code-only hotfixes stay under 300 KiB.
- **W13-L3**: The `X-Amz-Date` in the signed URL gives the exact UTC signing time, which combined with `stat -c '%y' /home/ec2-user/.aws/credentials` lets you reconstruct the rotation timeline without server-side logs. Use this when characterizing clamp behavior.
- **W13-L4**: Re-running an `unzip -l | grep -i generated` sanity check before each deploy is worth ~3 s. Today's run confirmed dist/generated is absent — future deploys should keep this invariant.

### H.Grep hooks

I1-I3 i123-20260711-084102 d-HH2LFJIIK pre-i123.sql.gz CredentialsExpiredError CREDS_EXPIRED clampExpiresToCredLifetime generateDownloadUrl expiresIn-900 X-Amz-Expires-300 X-Amz-Expires-670 X-Amz-Expires-645 isCredsExpired createUploadRoutes Servicio-de-archivos-temporalmente-no-disponible 503-clamp-upload-download pin-510987 pid-510987 jul-11
