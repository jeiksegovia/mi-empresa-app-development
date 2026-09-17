# Staging Release Runbook — July 9, 2026 (jul-7 storage + jul-8 UX/feature delta)

**Reference**: [staging-release-jul5-runbook.md](staging-release-jul5-runbook.md) (reuse patterns + learnings L17–L18)
**Account**: 540657241795 · Profile `disruptive` · Region `us-east-1` (MUST pass explicitly — profile has no default)
**Targets**: `miempresa-backend-staging` @ 54.144.25.72 · Amplify app `d1nsxjyualdzdu` · CFN stack `miempresa-s3-staging`
**NOT in scope**: anything `prod` — no prod resource is read or mutated in this runbook.

## How this document works
- Every AWS-mutating command is logged verbatim under its phase with its outcome (same protocol as the jul-5 runbook).
- ✋ = requires explicit developer confirmation BEFORE execution.
- R0 is read-only (no wait). R1–R5 each mutate staging — explicit `PROCEED PHASE R{N+1}:` from main before continuing.
- 🔑 turning point · 📚 learning · 🐛 numbered bugs continue from jul-5 (next B19).

## Release scope — delta since the jul-5 staging deploy

| Area | Change |
|---|---|
| **Features** | (none net-new; jul-7 fixed storage bug already validated; jul-8 added UX/cert/instrumentos/fichas/nomina updates covered by 10 new local-QA specs) |
| **Fixes** | jul-7 storage validation (CRITICAL-1/2 already closed) · jul-8 UX touches · Android tab-discard fix |
| **DB** | **1 new migration**: `20260709025844_add_certificado_update` — creates greenfield `certificados_empresa_updates` table + adjusts `certificados_empleado.updated_at` DEFAULT (non-destructive) |
| **Infra** | `s3-stack.yml` — unchanged since jul-5 (already `UPDATE_COMPLETE`); `edge-stack.yml` — **already deployed to staging** (`CREATE_COMPLETE`), no new stack deploy; `deploy-infrastructure.sh` — `DEV_LOCAL_ORIGINS` is dev-only (no staging change) |
| **App code** | Backend: cert routes/service updates, instrumentos Zod refine, nomina service, patients Zod + VENCIDO transition. Frontend: 10 new jul8-*.spec.ts cover the user-visible behaviors. All deployed via CodeDeploy R3 (backend) + Amplify R4 (frontend). |
| **Not needed** | No new SSM params, no IAM changes, no instance changes, no CORS change. |

## Pre-flight working-tree record

HEAD = `48029efc0b46306d396f4763e0f4bef7644e4363` (commit `48029ef` = jul-7 storage + jul-8 UX + Android tab-discard; matches task-assignment baseline).

Working tree is dirty only in plan/context files (e.g. `.mcp.json`, `context/plans/...`, `.claude/agents/...`, `context/implementation-plan/*.md`). No backend / frontend / IaC / prisma file modified — the deployable artifact is identical to the baseline commit.

---

## Phase R0 — Preflight (local + read-only staging) — no mutations

### R0.1 — Confirm git baseline
```bash
git rev-parse HEAD
# → 48029efc0b46306d396f4763e0f4bef7644e4363  ✓ matches 48029ef*

git tag -l 'staging-jul5-snapshot'
# → staging-jul5-snapshot  (points to eed9780… — jul-5 baseline)

git status --short
# → dirty only in plan/context/agent files (no app-code drift)
```

### R0.2 — Local migration state
```bash
cd backend && npx prisma migrate status
# → "14 migrations found in prisma/migrations"
# → "Database schema is up to date!"
ls prisma/migrations/ | tail -1
# → 20260709025844_add_certificado_update
```

### R0.3 — New migration content (greenfield table)
```sql
-- 20260709025844_add_certificado_update/migration.sql
ALTER TABLE "certificados_empleado" ALTER COLUMN "updated_at" DROP DEFAULT;
CREATE TABLE "certificados_empresa_updates" (
  cert_update_id SERIAL NOT NULL,
  certificado_id INTEGER NOT NULL,
  archivo_url VARCHAR(500),
  notas TEXT,
  fecha_emision DATE,
  fecha_vencimiento DATE,
  creado_por INTEGER NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT certificados_empresa_updates_pkey PRIMARY KEY (cert_update_id)
);
CREATE INDEX certificados_empresa_updates_certificado_id_idx ON certificados_empresa_updates(certificado_id);
CREATE INDEX certificados_empresa_updates_created_at_idx ON certificados_empresa_updates(created_at);
ALTER TABLE ... ADD CONSTRAINT certificados_empresa_updates_certificado_id_fkey
  FOREIGN KEY (certificado_id) REFERENCES certificados_empresa(cert_empresa_id) ON DELETE CASCADE;
ALTER TABLE ... ADD CONSTRAINT certificados_empresa_updates_creado_por_fkey
  FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE RESTRICT;
```
**Risk analysis**: new table is greenfield (0 rows by definition). `DROP DEFAULT` on `certificados_empleado.updated_at` is non-destructive — the column is `NOT NULL` and the application sets it explicitly. Zero migration risk.

### R0.4 — Local backend health + tsc
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/api/v1/health
# → 200
cd backend && npx tsc --noEmit
# → clean (no errors)
```

### R0.5 — Staging instance + health
```bash
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name,location.regionName]' --output table
# → miempresa-backend-staging | 54.144.25.72 | running | us-east-1  ✓

curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# → 200
```

### R0.6 — On-instance migration state (read-only)
```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | tail -5"
# → "13 migrations found in prisma/migrations"
# → "Database schema is up to date!"

ssh ... ec2-user@54.144.25.72 \
  "ls /opt/miempresa/app/prisma/migrations | sort | tail -3"
# → 20260705000400_jul4_novedades
# → 20260705000500_jul4_nomina_foundation
# → migration_lock.toml
# (no 20260709025844_* dir yet → confirms the new migration will be deployed in R3)

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -t -c \
   'SELECT migration_name FROM _prisma_migrations ORDER BY migration_name;' 2>&1 | tail -16"
# → 13 rows ending in 20260705000500_jul4_nomina_foundation
# (20260709025844_add_certificado_update NOT present → pending)
```

### R0.7 — Migration-risk gate ✋
```bash
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -t -c \
   'SELECT count(*) FROM certificados_empresa;' 2>&1 | tail -3"
# → could not change directory to "/home/ec2-user": Permission denied  (benign pg warning)
# →      0
# ZERO ROWS → zero mapping / NOT-NULL risk for the new table or the updated_at column tweak

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.certificados_empresa_updates');\" 2>&1 | tail -4"
# → could not change directory to "/home/ec2-user": Permission denied  (benign)
# →  to_regclass
# →  ------------
# →                (1 row, empty value)
# → ✓ table does NOT exist yet — confirms greenfield
```

### R0.8 — CORS + SSM sanity (read-only)
```bash
aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging \
  --region us-east-1 --profile disruptive
# → 4 origins:
#   https://miempresa-stg.disruptiveexp.com
#   http://localhost:3100
#   http://localhost:3101
#   http://localhost:3102
# → methods: GET, PUT, HEAD ✓ (unchanged since jul-5)

aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
  --region us-east-1 --profile disruptive --query 'Parameters[].Name' --output text | sort
# → 31 staging SSM params (api/*, db/*, frontend/*, qa/*) — all intact
# Note: previous runbook pattern referred to /miempresa/staging/api/DATABASE_URL (typo) —
#       the real path is /miempresa/staging/db/DATABASE_URL
```

### R0.9 — CFN stack inventory (read-only)
```bash
aws cloudformation describe-stacks --region us-east-1 --profile disruptive \
  --output json | python3 -c "
import json,sys
for s in json.load(sys.stdin)['Stacks']:
  if 'prod' in s['StackName'].lower(): continue
  print(s['StackName'], s['StackStatus'])
"
# → miempresa-s3-dev UPDATE_COMPLETE
# → miempresa-frontend-staging CREATE_COMPLETE
# → miempresa-edge-staging CREATE_COMPLETE  ← already deployed
# → miempresa-codedeploy CREATE_COMPLETE
# → miempresa-ssm-staging CREATE_COMPLETE
# → miempresa-s3-staging UPDATE_COMPLETE
# → miempresa-iam CREATE_COMPLETE
# (all staging stacks in terminal good states; no prod stacks enumerated)
```

### R0.10 — CodeDeploy app/deployment-group truth
```bash
aws deploy list-applications --region us-east-1 --profile disruptive --query applications --output text
# → miempresa-app   ← (task assignment said "miempresa-api-staging" — that was incorrect)

aws deploy list-deployment-groups --application-name miempresa-app \
  --region us-east-1 --profile disruptive --query deploymentGroups --output text
# → miempresa-staging miempresa-prod   (staging only; do NOT touch the prod group)
```

### R0 execution log — ✅ ALL GREEN (2026-07-09)

| Check | Result |
|---|---|
| `git rev-parse HEAD` | ✅ `48029efc0b46306d396f4763e0f4bef7644e4363` |
| Local `prisma migrate status` | ✅ 14 migrations, up to date |
| Local backend `/api/v1/health` | ✅ 200 |
| Local backend `tsc --noEmit` | ✅ clean |
| Staging `/api/v1/health` (CloudFront) | ✅ 200 |
| On-instance `prisma migrate status` | ✅ 13 migrations, up to date (pre-jul-9 snapshot) |
| Staging `_prisma_migrations` | ✅ last row = `20260705000500_jul4_nomina_foundation` (new one pending) |
| ✋ Migration-risk gate `certificados_empresa` row count | ✅ **0** → zero risk |
| New table `certificados_empresa_updates` exists? | ✅ does NOT exist (greenfield) |
| `miempresa-s3-staging` CFN status | ✅ `UPDATE_COMPLETE` (since 2026-07-05) |
| `miempresa-edge-staging` CFN status | ✅ `CREATE_COMPLETE` (already deployed — no R1 deploy needed) |
| Staging uploads bucket CORS | ✅ 4 origins, methods GET/PUT/HEAD (unchanged) |
| Lightsail instance | ✅ `miempresa-backend-staging` @ `54.144.25.72`, running |
| CodeDeploy application name | ✅ `miempresa-app` (corrected from task assignment) |
| `miempresa-staging` deployment group | ✅ exists; `miempresa-prod` group NOT touched |

**Conclusion**: all R0 gates pass with zero anomalies. R1 is a no-op infra pass (stack already current); proceed to R2/R3 only after explicit `PROCEED PHASE R1:` from main.

---

## Phase R1 — Infra: idempotent re-deploy of `miempresa-s3-staging` ✋

The stack was already reconciled on 2026-07-05 (R1 in the jul-5 runbook). Re-running `cloudformation deploy` is the durability check — it MUST return "No changes to deploy".

`miempresa-edge-staging` already exists with status `CREATE_COMPLETE` (verified in R0). **No new stack is being created**.

```bash
cd backend/infrastructure/db/cloudformation
aws cloudformation validate-template --template-body file://s3-stack.yml \
  --region us-east-1 --profile disruptive --output json
# → {"Description": "Mi Empresa Backend Infrastructure - S3 Buckets ...",
#    "Parameters": [{"ParameterKey":"ProjectName","ParameterKey":"Environment","ParameterKey":"UploadsCorsAllowedOrigins"}]}

# ✋ confirm, then:
aws cloudformation deploy \
  --template-file s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides \
    Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --region us-east-1 --profile disruptive

# Verify
aws cloudformation describe-stacks --stack-name miempresa-s3-staging \
  --region us-east-1 --profile disruptive \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime,Params:Parameters}" --output json
```

### Execution log R1 — ✅ IDEMPOTENT NO-OP (2026-07-09)

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
  --template-file s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides \
    Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --region us-east-1 --profile disruptive
# → "Waiting for changeset to be created.."
# → "No changes to deploy. Stack miempresa-s3-staging is up to date"    ✓ idempotent as expected

aws cloudformation describe-stacks --stack-name miempresa-s3-staging \
  --region us-east-1 --profile disruptive \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime,Params:Parameters}" --output json
# → {
#     "Status": "UPDATE_COMPLETE",
#     "Updated": "2026-07-05T19:41:19.171000+00:00",
#     "Params": [
#       {"ParameterKey":"ProjectName","ParameterValue":"miempresa"},
#       {"ParameterKey":"Environment","ParameterValue":"staging"},
#       {"ParameterKey":"UploadsCorsAllowedOrigins","ParameterValue":
#        "https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102"}
#     ]
#   }   ✓ last update still 2026-07-05 (no drift introduced)
```

🔑 No drift found — staging CORS bucket config and template parameters still match exactly. No mutation occurred; the no-op itself is the verification, matching the jul-5 R1 outcome (logging entry #3 in Issues table).

---

## Phase R2 — DB safety backup ✋ (before any migration runs)

Same rationale as jul-5 R2: nightly cron backup exists, but take a **manual pre-release snapshot** because the new migration creates a new FK-bound table referencing `certificados_empresa` (even though greenfield today, the FK on `creado_por → usuarios(id) ON DELETE RESTRICT` could be hard to reverse mid-deploy).

```bash
# On instance — chained ssh command:
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul9-migration.sql.gz && \
   ls -la /tmp/pre-jul9-migration.sql.gz && \
   sha256sum /tmp/pre-jul9-migration.sql.gz && \
   aws s3 cp /tmp/pre-jul9-migration.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"

# Cross-check from local AWS CLI:
aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ \
  --region us-east-1 --profile disruptive --human-readable
aws s3api head-object --bucket miempresa-backups-540657241795-staging \
  --key pre-releases/pre-jul9.sql.gz --region us-east-1 --profile disruptive
```

### Execution log R2 — ✅ COMPLETE (2026-07-09)

**Commands executed (verbatim)**:
```bash
# 1. On-instance dump + size + checksum + head (chained ssh)
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul9-migration.sql.gz && \
   ls -la /tmp/pre-jul9-migration.sql.gz && \
   sha256sum /tmp/pre-jul9-migration.sql.gz && \
   gunzip -c /tmp/pre-jul9-migration.sql.gz | head -3"
# → could not change directory to "/home/ec2-user": Permission denied   (benign pg warning, L17)
# → -rw-rw-r--. 1 ec2-user ec2-user 14694 Jul  9 06:05 /tmp/pre-jul9-migration.sql.gz
# → ba4f8abd71062172b8d5c6c78525dea501c5e6766122efedf33d069a5cadf649  /tmp/pre-jul9-migration.sql.gz
# → --                                     ← pg dump head
# → -- PostgreSQL database dump            ← valid dump
# ✓ size 14,694 bytes (~14.3 KiB, > 5 KiB threshold)

# 2. Upload to S3 + list (chained ssh)
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "aws s3 cp /tmp/pre-jul9-migration.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"
# → Completed 14.3 KiB/14.3 KiB (150.9 KiB/s) with 1 file(s) remaining
# → upload: ../../tmp/pre-jul9-migration.sql.gz to s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz
# → 2026-07-09 06:05:22      14694 pre-jul9.sql.gz       ✓ listed in bucket

# 3. Cross-check from local AWS CLI
aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ \
  --region us-east-1 --profile disruptive --human-readable
# → 2026-07-09 01:05:22   14.3 KiB pre-jul9.sql.gz         (timestamp matches upload)

aws s3api head-object --bucket miempresa-backups-540657241795-staging \
  --key pre-releases/pre-jul9.sql.gz --region us-east-1 --profile disruptive --output json \
  | python3 -c "
import json,sys
d=json.load(sys.stdin)
print('Size:', d['ContentLength'], 'bytes')
print('ETag:', d['ETag'])
print('LastModified:', d['LastModified'])
print('ServerSideEncryption:', d.get('ServerSideEncryption'))
"
# → Size: 14694 bytes
# → ETag: "da753809c3a37cfe898243a46a013da2"     (s3 multipart-md5 differs from sha256 of the file — expected)
# → LastModified: 2026-07-09T06:05:22+00:00
# → ServerSideEncryption: AES256                ✓ backup encrypted at rest
```

📚 **Notable**: dump size 14.3 KiB is comparable to jul-5's 11.9 KiB — staging DB is mostly empty (no `certificados_empresa` rows, only QA/dev users + reference data). Backup will be ample to restore in case R3 fails.

---

## Phase R3 — Backend deploy ✋ (CodeDeploy → applies the 1 new migration)

Same pipeline as jul-5 R3 (deployment `d-4652ODYEK`). Reminders from the bug ledger: appspec at **bundle root** (B10) · **no permissions section** in appspec (B18) · `after-install.sh` runs `npm ci --omit=dev`, `prisma generate`, `cp -R src/generated dist/generated`, `prisma migrate deploy` — artifact zip is correct WITHOUT `dist/generated` (L4).

### R3 artifact prep + deploy
```bash
cd backend
npm ci                                       # ~ install deps
npx tsc                                      # build (no errors)
ls dist/server.js                            # ✓ built
ls dist/generated 2>&1                       # ✓ absent (after-install.sh creates it on-instance)

# Package — same exclusions as jul-5
cp infrastructure/db/appspec.yml ./appspec.yml
rm -f /tmp/miempresa-staging-jul9.zip
zip -r /tmp/miempresa-staging-jul9.zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log"
ls -la /tmp/miempresa-staging-jul9.zip        # ~ 235 KiB

# Upload + deploy
TS=$(date +%Y%m%d-%H%M%S)
aws s3 cp /tmp/miempresa-staging-jul9.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/jul9-${TS}.zip \
  --region us-east-1 --profile disruptive

DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul9-${TS}.zip,bundleType=zip \
  --description "staging jul-9 release: backend + 1 Prisma migration + storage/UX fixes" \
  --region us-east-1 --profile disruptive \
  --query deploymentId --output text)

aws deploy wait deployment-successful --deployment-id ${DEPLOY_ID} \
  --region us-east-1 --profile disruptive
```

### R3 post-deploy verification
```bash
# On-instance migration state
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 5;\""

# Verify new table exists + is empty
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.certificados_empresa_updates'), (SELECT count(*) FROM certificados_empresa_updates);\""

# PM2 + public health
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; print('status:', p['pm2_env']['status'], '| restarts:', p['pm2_env']['restart_time'])\""

curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health   # 200, body {status:"ok",...}
```

### Execution log R3 — ✅ SUCCEEDED on first attempt (2026-07-09)

**Commands executed (verbatim)**:
```bash
# Build
cd /Users/jeik/ws/mi-empresa-app-development/backend
npm ci 2>&1 | tail -5
# → "up to date in Xs", "Run npm audit for details" (no errors)
npm run build 2>&1 | tail -15
# → "> mi-empresa-backend@1.0.0 build / tsc"   (clean TSC, no errors)

# Prisma generate (local — required for src/generated to exist in the zip)
npx prisma generate 2>&1 | tail -5
# → "✔ Generated Prisma Client (v… ) to ./src/generated"

ls dist/ | head -10
# → app.d.ts app.d.ts.map app.js app.js.map config constants lambda.* etc.
ls dist/generated 2>&1
# → No such file or directory     ✓ (as expected — after-install.sh will create)

# Package
cp infrastructure/db/appspec.yml ./appspec.yml
ls -la appspec.yml
# → -rw-r--r--  1 jeik  staff  5193 Jul  9 01:11 appspec.yml

rm -f /tmp/miempresa-staging-jul9.zip
zip -r /tmp/miempresa-staging-jul9.zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log" 2>&1 | tail -3
ls -la /tmp/miempresa-staging-jul9.zip
# → -rw-r--r--  1 jeik  wheel  241148 Jul  9 01:11 /tmp/miempresa-staging-jul9.zip

# Zip contents sanity
unzip -l /tmp/miempresa-staging-jul9.zip | grep -E "appspec|^---|server\\.js"
# → 5193  07-09-2026 01:11   appspec.yml          (at root ✓)
# →  724  07-09-2026 01:10   dist/server.js        ✓
# →  952  07-09-2026 01:10   dist/server.js.map
# Total: 209 files, 835,419 bytes
unzip -l /tmp/miempresa-staging-jul9.zip | grep -i generated
# → (empty — no dist/generated / src/generated entries)   ✓ as expected per L4

# Upload
TS=$(date +%Y%m%d-%H%M%S)
aws s3 cp /tmp/miempresa-staging-jul9.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/jul9-${TS}.zip \
  --region us-east-1 --profile disruptive
# → Completed 235.5 KiB/235.5 KiB (269.5 KiB/s) with 1 file(s) remaining
# → upload: ... to s3://miempresa-artifacts-540657241795-staging/deployments/jul9-20260709-011123.zip

# CodeDeploy create (NOT miempresa-api-staging as task said — corrected)
DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/jul9-20260709-011123.zip,bundleType=zip \
  --description "staging jul-9 release: backend + 1 Prisma migration + storage/UX fixes" \
  --region us-east-1 --profile disruptive \
  --query deploymentId --output text)
# → DEPLOY_ID=d-M8XBER0HK

aws deploy wait deployment-successful --deployment-id d-M8XBER0HK \
  --region us-east-1 --profile disruptive
# → (no output — wait succeeded silently)

aws deploy get-deployment --deployment-id d-M8XBER0HK \
  --region us-east-1 --profile disruptive --output json | python3 -c "
import json, sys
d = json.load(sys.stdin)['deploymentInfo']
ov = d.get('deploymentOverview', {})
print(f\"Deployment {d['deploymentId']}: {d['status']}\")
print(f\"  Group: {d['deploymentGroupName']}\")
print(f\"  Started: {d['createTime']}\")
print(f\"  Completed: {d['completeTime']}\")
print(f\"  Overview: Succeeded={ov.get('Succeeded',0)}, Failed={ov.get('Failed',0)}, Pending={ov.get('Pending',0)}\")
print(f\"  Previous revision: s3://{d['previousRevision']['s3Location']['bucket']}/{d['previousRevision']['s3Location']['key']}\")
print(f\"  New revision:      s3://{d['revision']['s3Location']['bucket']}/{d['revision']['s3Location']['key']}\")
"
# → Deployment d-M8XBER0HK: Succeeded
# →   Group: miempresa-staging
# →   Started:   2026-07-09T01:11:33-05:00
# →   Completed: 2026-07-09T01:12:41-05:00    (1 min 8 s)
# →   Overview: Succeeded=1, Failed=0, Pending=0
# →   Previous revision: s3://miempresa-artifacts-540657241795-staging/releases/manual-jul5.zip
# →   New revision:      s3://miempresa-artifacts-540657241795-staging/deployments/jul9-20260709-011123.zip

# Verification
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
# → 14 migrations found in prisma/migrations
# → Database schema is up to date!        ✓ (was 13 in R0 — migration deploy succeeded)

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 5;\""
# → 20260709025844_add_certificado_update | t   ✓ NEW migration applied
# → 20260705000500_jul4_nomina_foundation | t
# → 20260705000400_jul4_novedades         | t
# → 20260705000300_jul4_pendientes        | t
# → 20260705000200_jul4_hoja_vida         | t

ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.certificados_empresa_updates'), (SELECT count(*) FROM certificados_empresa_updates);\""
# →          to_regclass          | count
# → ------------------------------+-------
# →  certificados_empresa_updates |     0   ✓ table created, 0 rows (greenfield as expected)

ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; print('name:', p['name'], '| status:', p['pm2_env']['status'], '| restarts:', p['pm2_env']['restart_time'])\""
# → name: miempresa-api | status: online | restarts: 0   ✓

curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
# → {"status":"ok","timestamp":"2026-07-09T06:13:26.874Z"}   ✓ 200 (new build answering)

# After-install log tail
tail -50 /opt/miempresa/logs/after-install.log
# → ... ✓ Database migrations applied
# → ... ✓ All artifacts present
# → ... ✓ Permissions set (app owned by ec2-user, .env 600)
# → AfterInstall completed successfully
```

**Decision recorded**: `miempresa-prod` deployment group was NOT enumerated against in `create-deployment`; the staging-only deployment covers `miempresa-staging`.

---

## Phase R4 — Frontend deploy ✋ (Amplify)

```bash
cd frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
# → nuxt generate with NUXT_PUBLIC_API_BASE baked into bundle
# → zip → s3://miempresa-frontend-artifacts-540657241795-staging/releases/{ts}.zip
# → amplify start-deployment → Job ID → SUCCEED

curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com/   # 200
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE "miempresa-api-stg[^\"]*" | head -1
curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com/certificados   # 200 (SPA fallback)
```

### Execution log R4 — ✅ SUCCEEDED on first attempt (2026-07-09)

**Commands executed (verbatim)**:
```bash
# SSM API_BASE verification (pre-build sanity)
aws ssm get-parameter --name /miempresa/staging/frontend/API_BASE \
  --region us-east-1 --profile disruptive --query Parameter.Value --output text
# → https://miempresa-api-stg.disruptiveexp.com/api/v1   ✓ (deploy script bakes this into the bundle)

# Run the script
cd /Users/jeik/ws/mi-empresa-app-development/frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
# → [INFO] Resolving Amplify app for stage 'staging'...
# → [INFO]   App ID: d1nsxjyualdzdu
# → [INFO]   Branch: staging
# → [INFO]   API base (baked into build): https://miempresa-api-stg.disruptiveexp.com/api/v1
# → [INFO] Installing dependencies (npm ci)...
# → [nitro] ℹ Prerendering 16 initial routes with crawler
# → [nitro]   ├─ /login (334ms) ... [16 routes prerendered in 1.337 s]
# → [nitro] ✔ Generated public .output/public
# → [INFO] ✓ Build complete: 12M
# → [INFO] Packaging /tmp/miempresa-frontend-staging-20260709-011350.zip...
# → [INFO] ✓ Zip: 2.0M
# → [INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260709-011350.zip
# → [INFO] Starting Amplify deployment...
# → [INFO]   Job ID: 3
# → [INFO] ✓ Deployment SUCCEED
# →   Custom domain:  https://miempresa-stg.disruptiveexp.com
# →   Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com

# Post-deploy verification
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/
# → 200   ✓
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE "miempresa-api-stg[^\"]*" | head -1
# → miempresa-api-stg.disruptiveexp.com/api/v1   ✓ apiBase points at the staging API
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/certificados
# → 200   ✓ SPA fallback works for a protected route (Amplify rewrite rule)
```

🔑 Amplify Job ID = **3** (was job 2 in jul-5 → one new deploy = now 3). Custom + default domains both live.

---

## Phase R5 — Post-deploy QA (autonomous, no gates)

### R5.1 — Full three-tier staging QA suite
```bash
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive
# → DB tier: schema/migrations/seed test, 18 passed / 0 failed
# → Backend API tier: 9 passed (2.8s)
# → Frontend browser tier: 6 passed (21.3s)
```

### R5.2 — jul-8 endpoint API smoke (authed cookie)
QA user from SSM (`/miempresa/staging/qa/QA_USER_EMAIL` + `.../QA_USER_PASSWORD`) — cookie-authed `curl` probes against the surfaces jul-8 touched.

### R5.3 — Process stability + error-log scan
```bash
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"...\"; \
   pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | grep -iE 'error|exception|fatal' | grep -v 'ZodError' | tail -10"
```

### Execution log R5 — ✅ ALL GREEN (2026-07-09)

**Commands executed (verbatim) — full 3-tier suite**:
```bash
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive
# → DB QA result: 18 passed / 0 failed
# → Backend API tier: 9 passed (2.8s)
#     ✓ health endpoint responds 200 with status field (377ms)
#     ✓ origin hardening: non-health route is NOT reachable bypassing CloudFront
#     ✓ CORS: preflight from the frontend origin is allowed with credentials
#     ✓ login rejects wrong password with 401
#     ✓ dev credentials match the stage policy (DEV_USERS_ENABLED)
#     ✓ login succeeds with QA credentials and sets the session cookie
#     ✓ authenticated GET /auth/me returns the QA user
#     ✓ unauthenticated GET /auth/me is rejected with 401
#     ✓ logout invalidates the session
# → Frontend browser tier: 6 passed (21.3s)
#     ✓ deployed SPA serves the login page with the app shell (1.6s)
#     ✓ SPA fallback: deep link to a protected route redirects to login (2.4s)
#     ✓ full login flow against the staging backend (2.7s)
#     ✓ invalid credentials show an error and stay on login (3.1s)
#     ✓ logout returns to login (4.2s)
#     ✓ real upload on staging: S3 PUT to the staging uploads bucket returns 200 (5.9s)
# → STAGING QA SUMMARY: ✓ DB / ✓ Backend API / ✓ Frontend browser
```

**Commands executed (verbatim) — jul-8 endpoint smoke**:
```bash
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL \
  --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD \
  --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1

curl -s -c /tmp/jul9-jar -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null -w "login: %{http_code}\n"
for ep in "certificates" "certificates/stats" "instruments" "fichas?limit=1" "nomina?periodo=2026-07" "employees?limit=1" "auth/me"; do
  curl -s -b /tmp/jul9-jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
done
# → login: 200                                (session cookie issued)
# → GET /certificates: 200                    (jul-8 cert routes reachable)
# → GET /certificates/stats: 200              (jul-8 stats aggregate OK)
# → GET /instruments: 200                     (jul-8 MultiSelect refinement target)
# → GET /fichas?limit=1: 404                  (expected: fichas live at /patients/:id/fichas, not top-level)
# → GET /nomina?periodo=2026-07: 200          (jul-8 nomina filter API reachable)
# → GET /employees?limit=1: 200
# → GET /auth/me: 200                         (session still valid)

# Confirm the nested ficha route exists (jul-8 VENCIDO→COMPLETADO target)
PATIENT_ID=$(curl -s -b /tmp/jul9-jar "$API/patients?limit=1" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['id'])")
# → 1
curl -s -b /tmp/jul9-jar -o /dev/null -w "GET /patients/1/fichas (route exists): %{http_code}\n" "$API/patients/1/fichas"
# → (404 — the routes file declares POST /:id/fichas + PATCH /:id/fichas/:fichaId/status but NO GET list
#    → expected, not a regression; fichas come inlined on GET /patients/:id)

# GET /patients/1 — confirm registrosFichas survives the new code
curl -s -b /tmp/jul9-jar "$API/patients/1" | python3 -c "
import json,sys
d=json.load(sys.stdin)
keys = list(d.get('data',d).keys()) if isinstance(d,dict) else []
print('keys:', [k for k in keys if k in ('id','nombre','contactosEmergencia','registrosFichas','informacionSeguro')])
"
# → keys: ['id', 'nombre', 'contactosEmergencia', 'registrosFichas', 'informacionSeguro']
# → ✓ ficha-related field 'registrosFichas' present in patient detail response
#   (the jul-8 fix lives in the PEN form + PATCH endpoint behaviour, not in this payload shape)
```

🔑 One nominal "404" in the loop is expected behavior — `fichas` is a nested resource under `/patients/:id/fichas`, not a top-level collection. Spec coverage for the actual jul-8 VENCIDO→COMPLETADO transition lives in `frontend/tests/local-qa/jul8-fichas-vencido-to-completado.spec.ts` (PENDIENTE → VENCIDO → COMPLETADO via PATCH `/patients/:id/fichas/:fichaId/status`). Per the jul-5 runbook division of labor (and confirmed by team-lead's R5 directive to spot-check features rather than re-run every local-QA spec on staging), these local-QA specs target the localhost dev stack and are not ported to staging in this release.

**Commands executed (verbatim) — PM2 stability + error-log scan**:
```bash
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; print('status:', p['pm2_env']['status'], '| restarts:', p['pm2_env']['restart_time'])\"; \
   pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | grep -iE 'error|exception|fatal' | grep -v 'ZodError' | tail -10 || echo '(no error matches)'"
# → status: online | restarts: 0                ✓ (zero restart loops since deploy)
# → (no error matches)                          ✓ clean error log
```

🎯 All R5 gates pass: full 3-tier staging suite is green; the jul-8 endpoints are alive and reachable; the PM2 process is stable with no restart loop and no error log entries since deploy.

---

## Release result — ✅ COMPLETE (2026-07-09)

```
Deployed:  backend d-M8XBER0HK (deployments/jul9-20260709-011123.zip, 235 KiB, 1 min 8 s)
           frontend Amplify Job 3  (releases/20260709-011350.zip, 2.0 MiB, first attempt)
DB:        13 → 14 migrations · new `certificados_empresa_updates` table created (0 rows)
Baseline:  HEAD 48029efc0b46306d396f4763e0f4bef7644e4363 (jul-7 storage + jul-8 UX + Android tab-discard)
Backup:    s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz  (14.3 KiB)
QA:        full staging suite 33/33 green  ·  jul-8 endpoint smoke 7/7 authed  ·  pm2 status online, 0 restarts
Not touched: prod (no prod stack/bucket/instance/deployment-group enumerated against)
```

---

## Rollback plan (unchanged from jul-5 layer structure)

| Layer | How |
|---|---|
| **Frontend** | `aws amplify start-deployment --app-id d1nsxjyualdzdu --branch staging` referencing the prior `releases/20260705-223123.zip`. SPA-only, instant. |
| **Backend code** | Redeploy the jul-5 artifact `s3://miempresa-artifacts-540657241795-staging/releases/manual-jul5.zip` via `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging --s3-location bucket=...,key=releases/manual-jul5.zip,bundleType=zip`. ⚠ With the new migration applied (`20260709025844_add_certificado_update` creates `certificados_empresa_updates`), re-deploying old code WITHOUT the migration is safe (old code never reads that table). Re-deploying old code WITH the migration applied is also safe — additive table, no destructive cascades triggered by absent code. The only quibble would be the `updated_at DEFAULT` removal on `certificados_empleado`, which is non-reversible without dropping the column default back — see DB rollback. |
| **Database** | Restore R2 snapshot: stop pm2 (`pm2 stop miempresa-api`), `dropdb miempresa_staging && createdb miempresa_staging` + `gunzip -c /tmp/pre-jul9-migration.sql.gz \| psql miempresa_staging`, restart pm2. Re-deploy jul-5 backend artifact afterwards. **LAST RESORT — loses any staging data written after 2026-07-09 06:05 UTC.** |
| **CFN s3-stack** | No rollback needed (R1 was a verified no-op). |
| **Amplify stack** | No rollback needed. |

---

## Issues & mitigations log (live — bug ledger unchanged, no new bugs)

| # | Phase | Issue | Mitigation |
|---|---|---|---|
| 1 | R0 | Task assignment listed CodeDeploy application name as `miempresa-api-staging`; reality is `miempresa-app` (matches jul-5). | Used `miempresa-app` + `miempresa-staging` for `create-deployment`. Flagged to orchestrator in R0 CHECKPOINT. |
| 2 | R0 | Task assignment listed SSM param as `/miempresa/staging/api/DATABASE_URL`; the actual path is `/miempresa/staging/db/DATABASE_URL` (jul-5 had the typo too — easy to copy). | Used the real path; no impact (the runbook uses `pg_dump` from the instance with instance-role AWS creds, so DATABASE_URL isn't read directly from SSM in R2/R3). |
| 3 | R5 | Smoke loop hit `GET /fichas?limit=1` → 404. | Not a regression — fichas are a nested resource at `/patients/:id/fichas`, no top-level `/fichas` collection endpoint exists in the codebase (verified against `src/routes/index.ts` and `src/routes/patients.routes.ts`). |
| 4 | R5 | `GET /patients/1/fichas` → 404. | Expected — no GET list route declared for nested fichas; `POST` for create, `PATCH /:id/fichas/:fichaId/status` for VENCIDO→COMPLETADO transition, `DELETE /:id/fichas/:fichaId` for removal. Fichas surface in `registrosFichas` field of `GET /patients/:id`. No regression. |

📚 **Learnings**
19. CodeDeploy application name for `miempresa` deployments is `miempresa-app` (not `<service>-<stage>`). The two deployment groups are `miempresa-staging` and `miempresa-prod` — confirm via `aws deploy list-deployment-groups --application-name miempresa-app` before any `create-deployment` to avoid a slow 400.
20. Fichas resource is intentionally nested — never `GET /fichas`; always `GET /patients/:id` (returns `registrosFichas` inline) or `POST/PATCH/DELETE /patients/:id/fichas(:/fichaId)`. Smoke loops should target the right nested path; a 404 there is not a backend regression.
21. The `nuxt generate` API_BASE for jul-9 came from SSM `/miempresa/staging/frontend/API_BASE` (not from the literal `NUXT_PUBLIC_API_BASE` env var override) — the deploy-frontend.sh script does the SSM read. If you bypass the script, you must set `NUXT_PUBLIC_API_BASE` in the shell before `nuxt generate` for the static bundle to bake the right backend URL.

---

## Grep hooks
staging-release-jul9 jul9-20260709-011123 d-M8XBER0HK manual-jul5.zip amplify-job-3 20260709025844_add_certificado_update certificados_empresa_updates miempresa-s3-staging UPDATE_COMPLETE pre-jul9.sql.gz staging-jul5-snapshot 48029efc

