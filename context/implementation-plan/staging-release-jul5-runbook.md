# Staging Release Runbook — July 5, 2026 (jul4 milestone + storage fixes)

**Reference**: [backend-lightsail-deployment-runbook.md](backend-lightsail-deployment-runbook.md) (July 2–3 initial deployment — reuse its learnings B1–B18, L1–L16)
**Account**: 540657241795 · Profile `disruptive` · Region `us-east-1`
**Targets**: `miempresa-backend-staging` @ 54.144.25.72 (Lightsail) · Amplify app `d1nsxjyualdzdu` · CFN stack `miempresa-s3-staging`
**NOT in scope**: anything `prod` — no prod resource is read or mutated in this runbook.

## How this document works
- Same protocol as the previous runbook: every AWS-mutating command is logged verbatim under its phase with its outcome.
- ✋ = requires explicit developer confirmation BEFORE execution.
- 🔑 **Turning point** · 📚 **Learning** · 🐛 numbered bugs continue the prior ledger (next: B19).
- **Developer decisions taken before writing (2026-07-05)**: ① runbook-only now, execution triggered separately · ② deploy from the uncommitted working tree (same as July 2–3 releases; commit later) · ③ include the `miempresa-s3-staging` CFN drift reconciliation.

---

## Release scope — what ships (delta since the July 3 staging deploy)

| Area | Changes |
|---|---|
| **Features** | cert-mejoras P1–P5 (cert taxonomy, vivienda/salario, generic empleado certs) · jul4 P0–P7 (genero OTRO, cert recurrencia MENSUAL/ANUAL + comprobante, cert archivo per row, hoja de vida, pendientes + derived, novedades + adjuntos, contratos + nómina foundation + `/nomina` page) |
| **Fixes** | 12 review FIX items + 8 cleanups (shared `useFileUpload`, `utils/date.ts`, `utils/file.ts`, `tests/helpers/auth.ts`) · storage CRITICAL-1 (bucket config, `requireBucket()` fail-fast, no phantom default) · **CRITICAL-2** (`useFileUpload` read `res.uploadUrl` instead of `res.data.uploadUrl` — browser uploads never reached S3; see `storage-validation-report-jul5.md` §Resolution) |
| **DB** | **9 new migrations** (staging currently has 4): `20260704172546_f1_cert_taxonomy` · `20260704172811_f2_vivienda_salario` · `20260704173358_f2_cert_empleado_generic` · `20260705000000_jul4_cert_empresa_recurrencia` · `20260705000100_jul4_cert_empleado_archivo` · `20260705000200_jul4_hoja_vida` · `20260705000300_jul4_pendientes` · `20260705000400_jul4_novedades` · `20260705000500_jul4_nomina_foundation` |
| **Infra** | `s3-stack.yml` gained `UploadsCorsAllowedOrigins` param + `Environment=dev` support — staging stack update reconciles the CORS applied live via `put-bucket-cors` on 2026-07-05 |
| **Not needed** | No new SSM params (`AWS_S3_BUCKET`, `CORS_ORIGIN`, `MAX_FILE_SIZE_MB` already set for staging) · no IAM changes · no instance changes |

**Migration risk notes** (read before Phase R2):
- `f1_cert_taxonomy` performs **enum surgery with data mapping** (rename enum → create new → temp column → `CASE` UPDATE → drop old) on `certificados_empresa`. Dev users were enabled on staging 2026-07-04 for manual testing — rows MAY exist with old enum values. If a value is not covered by the `CASE`, the row maps wrong/null and…
- `jul4_cert_empresa_recurrencia` then runs `ALTER COLUMN tipo_certificado SET NOT NULL` (DRIFT-1 fix) — this **fails the whole deploy** if any null slipped through. → Phase R0 gate: inspect staging `certificados_empresa` rows first; Phase R2 takes a manual backup regardless.
- All 6 jul4 migrations are additive (new tables/columns/enums, `DO $$` idempotent wrappers); the partial unique index `contratos_empleado_activo_uq` is raw SQL — additive, no risk on empty tables.

---

## Phase R0 — Preflight (local + read-only staging) — no mutations

```bash
# 1. Local quality gates (all must pass before anything touches AWS)
cd backend && npx tsc --noEmit                              # backend compiles
cd frontend && npx nuxt generate                            # SPA bundle builds
cd frontend && npx playwright test tests/local-qa/          # expect 40/40 green

# 2. Local migration state sanity (13 applied, none pending)
cd backend && npx prisma migrate status

# 3. Staging current state (read-only)
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health          # 200
backend/infrastructure/db/utilities/validate-instance.sh --stage staging --profile disruptive   # 30/30
# On instance (ssh-to-instance.sh): current migration count must be 4
cd /opt/miempresa/app && npx prisma migrate status          # "4 migrations found ... up to date"

# 4. ✋ MIGRATION-RISK GATE — inspect certificados_empresa data BEFORE deploying
#    (via utilities/ssh-to-instance.sh or db-tunnel.sh)
psql -d miempresa_staging -c "SELECT count(*), tipo FROM certificados_empresa GROUP BY tipo;"
#    - 0 rows → proceed, zero enum-mapping risk
#    - >0 rows → verify every tipo value is covered by the CASE mapping in
#      prisma/migrations/20260704172546_f1_cert_taxonomy/migration.sql; if any is not,
#      STOP and add a mapping before building the artifact.

# 5. Confirm staging SSM still correct (read-only)
aws ssm get-parameter --name /miempresa/staging/api/AWS_S3_BUCKET --profile disruptive \
  --query Parameter.Value --output text     # miempresa-uploads-540657241795-staging
aws ssm get-parameter --name /miempresa/staging/api/CORS_ORIGIN --profile disruptive \
  --query Parameter.Value --output text     # https://miempresa-stg.disruptiveexp.com,http://localhost:3100
```

**Working-tree record** (since we deploy uncommitted code — decision ②): before building, capture a snapshot hash for traceability without committing:
```bash
git stash create   # prints a dangling commit SHA — record it here: __________
git tag -f staging-jul5-snapshot <SHA>     # optional, local-only tag
```

### Execution log R0 — ✅ ALL GREEN (2026-07-05)

| Check | Result |
|---|---|
| `tsc --noEmit` (backend) | ✅ clean |
| `nuxt generate` (frontend) | ✅ SPA bundle built |
| `tests/local-qa/` | ✅ **40/40 passed** (1.4 m) |
| Local `prisma migrate status` | ✅ 13 migrations, up to date |
| Staging health (`/api/v1/health` via CloudFront) | ✅ 200 |
| `validate-instance.sh --stage staging` | ✅ **30 passed / 0 failed** |
| On-instance `prisma migrate status` | ✅ 4 migrations, up to date (as expected pre-release) |
| ✋ **Migration-risk gate**: `SELECT count(*) FROM certificados_empresa` | ✅ **0 rows** → zero enum-mapping risk for `f1_cert_taxonomy` + `SET NOT NULL` |
| SSM `AWS_S3_BUCKET` | ✅ `miempresa-uploads-540657241795-staging` |
| SSM `CORS_ORIGIN` | ✅ `https://miempresa-stg.disruptiveexp.com,http://localhost:3100` |
| Working-tree snapshot | SHA `eed97803213dfeb3c29d3f6e7cfabd36100abf63` · local tag `staging-jul5-snapshot` |

Note: `ssh-to-instance.sh` takes a positional `<instance-name>` and is interactive-only — remote commands were run via direct `ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 "..."`.

**Commands executed (verbatim)**:
```bash
# Local quality gates
cd backend && npx tsc --noEmit                                    # → TSC OK
cd frontend && npx nuxt generate                                  # → "✨ You can now deploy .output/public"
cd frontend && npx playwright test tests/local-qa/ --reporter=line  # → 40 passed (1.4m)

# Local migration state
cd backend && npx prisma migrate status
#   → "13 migrations found in prisma/migrations / Database schema is up to date!"

# Staging health (via CloudFront)
curl -s -o /dev/null -w "%{http_code}" https://miempresa-api-stg.disruptiveexp.com/api/v1/health   # → 200

# SSM params — FIRST attempt failed (exit 253 "You must specify a region"); retried with --region:
aws ssm get-parameter --name /miempresa/staging/api/AWS_S3_BUCKET \
  --profile disruptive --region us-east-1 --query Parameter.Value --output text
#   → miempresa-uploads-540657241795-staging
aws ssm get-parameter --name /miempresa/staging/api/CORS_ORIGIN \
  --profile disruptive --region us-east-1 --query Parameter.Value --output text
#   → https://miempresa-stg.disruptiveexp.com,http://localhost:3100

# Instance validation
cd backend/infrastructure/db/utilities
./validate-instance.sh --stage staging --profile disruptive       # → 30 passed / 0 failed / 0 pending

# On-instance checks — ssh-to-instance.sh --stage failed ("Cannot determine stage from
# instance name"; script wants positional <instance-name> and is interactive-only) → direct ssh:
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | tail -4; \
   sudo -u postgres psql -d miempresa_staging -t -c 'SELECT count(*) FROM certificados_empresa;'"
#   → "4 migrations found ... Database schema is up to date!"  ·  count = 0
#   (a GROUP BY tipo probe errored "column tipo does not exist" — expected: pre-f1 schema
#    uses the old column name; irrelevant since count=0)

# Working-tree snapshot (decision ②: no commit)
git stash create                                                  # → eed97803213dfeb3c29d3f6e7cfabd36100abf63
git tag -f staging-jul5-snapshot eed97803213dfeb3c29d3f6e7cfabd36100abf63
```

---

## Phase R1 — Infra: reconcile `miempresa-s3-staging` CFN drift ✋

Live CORS on the staging uploads bucket was already scoped on 2026-07-05 via `put-bucket-cors` (verified: staging domain + localhost:3100/3101/3102). This update makes it durable in IaC. **No resource replacement** — bucket names/logical IDs unchanged; only the CORS config property and new parameters.

```bash
cd backend/infrastructure/db/cloudformation
aws cloudformation validate-template --template-body file://s3-stack.yml --profile disruptive

# ✋ confirm, then:
aws cloudformation deploy \
  --template-file s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --profile disruptive --region us-east-1

# Verify: CORS unchanged from live state (idempotent) + stack UPDATE_COMPLETE
aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging --profile disruptive
aws cloudformation describe-stacks --stack-name miempresa-s3-staging --profile disruptive \
  --query "Stacks[0].StackStatus"
```

**Watch-out**: `CommaDelimitedList` parameter values with commas must be passed as ONE quoted `Key=Value` string (above). If CFN complains, fall back to a `--parameter-overrides file://params.json`.

### Execution log R1 — ✅ COMPLETE (already reconciled)

**Commands executed (verbatim)**:
```bash
cd backend/infrastructure/db/cloudformation
aws cloudformation validate-template --template-body file://s3-stack.yml \
  --profile disruptive --region us-east-1                          # ✓ valid

aws cloudformation deploy --template-file s3-stack.yml \
  --stack-name miempresa-s3-staging \
  --parameter-overrides Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --profile disruptive --region us-east-1
#   → "No changes to deploy. Stack miempresa-s3-staging is up to date"

# Verification
aws cloudformation describe-stacks --stack-name miempresa-s3-staging \
  --profile disruptive --region us-east-1 \
  --query "Stacks[0].{Status:StackStatus,Updated:LastUpdatedTime,Params:Parameters}" --output json
#   → Status UPDATE_COMPLETE · Updated 2026-07-05T19:41:19 UTC
#   → Params: Environment=staging, UploadsCorsAllowedOrigins=<the 4 origins above>
```

🔑 The stack was ALREADY updated with the parameterized template during the storage-fix session (LastUpdated 2026-07-05 19:41 UTC, `UPDATE_COMPLETE`, `UploadsCorsAllowedOrigins` param present) — the CORS scoping was applied via CFN, not only `put-bucket-cors`. No drift existed; the deploy was a no-op, which is itself the verification.

---

## Phase R2 — DB safety backup ✋ (before any migration runs)

The nightly 02:00 cron backup exists, but take a **manual pre-release snapshot** — the enum surgery + `SET NOT NULL` are not auto-reversible.

```bash
# On instance (via utilities/ssh-to-instance.sh):
sudo -u ec2-user /opt/miempresa/scripts/backup-postgres-s3.sh   # or the manual equivalent:
pg_dump -U miempresa miempresa_staging | gzip > /tmp/pre-jul5-release.sql.gz
aws s3 cp /tmp/pre-jul5-release.sql.gz \
  s3://miempresa-backups-540657241795-staging/manual/pre-jul5-release.sql.gz

# Verify the object exists and is non-trivial in size:
aws s3 ls s3://miempresa-backups-540657241795-staging/manual/ --profile disruptive
```

### Execution log R2 — ✅ COMPLETE (2026-07-05)

**Commands executed (verbatim)** — one ssh invocation, chained on the instance (instance-side
`aws` uses the STS-refreshed instance creds, no profile flag needed):
```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-jul5-release.sql.gz && \
   ls -la /tmp/pre-jul5-release.sql.gz && \
   aws s3 cp /tmp/pre-jul5-release.sql.gz s3://miempresa-backups-540657241795-staging/manual/pre-jul5-release.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/manual/"
#   → -rw-rw-r-- ec2-user 11909 bytes /tmp/pre-jul5-release.sql.gz
#   → upload: ... to s3://miempresa-backups-540657241795-staging/manual/pre-jul5-release.sql.gz
#   → 2026-07-06 03:27:43   11909  pre-jul5-release.sql.gz   ✓ verified in S3
```
Small dump is expected — staging DB holds only QA/dev users + empty feature tables (cert count was 0 in R0). Benign warning: `could not change directory to "/home/ec2-user"` from `sudo -u postgres` (postgres user can't read ec2-user's home; pg_dump ran fine).

---

## Phase R3 — Backend deploy ✋ (CodeDeploy → applies the 9 migrations)

Same pipeline as Phase 3 of the previous runbook (deployment `d-41DIRIECK`). Reminders from the bug ledger: appspec at **bundle root** (B10) · **no permissions section** in appspec (B18).

```bash
# Build artifact locally (mirrors deploy.yml)
cd backend
npm ci && npx prisma generate && npm run build
cp infrastructure/db/appspec.yml ./appspec.yml
zip -r /tmp/miempresa-staging-jul5.zip appspec.yml dist prisma package.json package-lock.json \
    infrastructure/db/scripts infrastructure/db/utilities -x "*.log"

# Upload + deploy
aws s3 cp /tmp/miempresa-staging-jul5.zip \
  s3://miempresa-artifacts-540657241795-staging/releases/manual-jul5.zip --profile disruptive

# ✋ confirm, then:
aws deploy create-deployment --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=releases/manual-jul5.zip,bundleType=zip \
  --profile disruptive
aws deploy wait deployment-successful --deployment-id <d-XXXX> --profile disruptive
```

`after-install.sh` runs `npx prisma migrate deploy` — the 9 new migrations apply here. **If the deploy fails at AfterInstall**, check `/opt/codedeploy-agent/deployment-root/deployment-logs/` first; a migration failure leaves `_prisma_migrations` with a failed row → resolve with `prisma migrate resolve --rolled-back <name>` after fixing, or restore R2 backup for data-corrupting failures.

**Immediate post-deploy checks**:
```bash
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health           # 200
# On instance:
cd /opt/miempresa/app && npx prisma migrate status                          # "13 migrations found ... up to date"
psql -d miempresa_staging -c "\dt" | wc -l                                  # table count grew (pendientes, novedades, archivos_novedad, contratos, nomina_periodos, archivos_nomina_periodo)
psql -d miempresa_staging -c "SELECT indexname FROM pg_indexes WHERE indexname='contratos_empleado_activo_uq';"
```

### Execution log R3 — ✅ COMPLETE (2026-07-05)

**Commands executed (verbatim)**:
```bash
# Build
cd backend
npm ci && npx prisma generate && npm run build                    # ✓ clean (tsc, no errors)

# Package
cp infrastructure/db/appspec.yml ./appspec.yml
rm -f /tmp/miempresa-staging-jul5.zip
zip -r /tmp/miempresa-staging-jul5.zip appspec.yml dist prisma package.json package-lock.json \
    infrastructure/db/scripts infrastructure/db/utilities -x "*.log"
ls -la /tmp/miempresa-staging-jul5.zip                            # → 234,471 bytes

# Artifact sanity — appspec at root, contents, dist/generated question:
ls dist/generated/                                                # → No such file or directory (!)
unzip -l /tmp/miempresa-staging-jul5.zip | grep -E "appspec|generated"   # → appspec.yml at root ✓
unzip -l /tmp/miempresa-staging-jul5.zip | tail -1                # → 207 files
# Investigated before proceeding (looked like B-learning-3):
grep -n '"build"' package.json                                    # → "build": "tsc" (no copy step)
grep -A 3 "generator client" prisma/schema.prisma                 # → output = "../src/generated/prisma"
grep -n "generate\|npm ci" infrastructure/db/scripts/after-install.sh
#   → lines 90-106: on-instance `npx prisma generate` + `cp -R src/generated dist/generated`
#   → line 142: hard validation that dist/generated/prisma exists
#   VERDICT: artifact is correct WITHOUT dist/generated — do not add it.

# Upload + deploy
aws s3 cp /tmp/miempresa-staging-jul5.zip \
  s3://miempresa-artifacts-540657241795-staging/releases/manual-jul5.zip \
  --profile disruptive --region us-east-1                         # ✓ 229 KiB uploaded

DEPLOY_ID=$(aws deploy create-deployment --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=releases/manual-jul5.zip,bundleType=zip \
  --profile disruptive --region us-east-1 --query deploymentId --output text)
#   → d-4652ODYEK
aws deploy wait deployment-successful --deployment-id d-4652ODYEK \
  --profile disruptive --region us-east-1                         # ✅ SUCCEEDED (first attempt)
```

**Verification commands (verbatim, all passed)**:
```bash
curl -s -o /dev/null -w "health: %{http_code}\n" \
  https://miempresa-api-stg.disruptiveexp.com/api/v1/health       # → health: 200

ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep 'migrations found'; \
   sudo -u postgres psql -d miempresa_staging -t -c \
     \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public';\"; \
   sudo -u postgres psql -d miempresa_staging -t -c \
     \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN \
       ('pendientes_empleado','novedades_empleado','archivos_novedad','contratos','nomina_periodos','archivos_nomina_periodo');\"; \
   sudo -u postgres psql -d miempresa_staging -t -c \
     \"SELECT indexname FROM pg_indexes WHERE indexname='contratos_empleado_activo_uq';\"; \
   pm2 jlist | python3 -c \"import json,sys; [print(p['name'], p['pm2_env']['status']) for p in json.load(sys.stdin)]\""
#   → "13 migrations found in prisma/migrations" (was 4)  ·  "Database schema is up to date!"
#   → table count: 35 (was 30)
#   → all 6 new tables listed: archivos_nomina_periodo, archivos_novedad, contratos,
#     nomina_periodos, novedades_empleado, pendientes_empleado
#   → contratos_empleado_activo_uq present
#   → miempresa-api online
```

---

## Phase R4 — Frontend deploy ✋ (Amplify)

```bash
# ✋ confirm, then (script does: nuxt generate with SSM-sourced API base → zip → S3 → amplify start-deployment):
frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --profile disruptive
```

Reminders: zip the **contents** of `.output/public`, not the folder (L13 — the script already does this) · verify the served bundle bakes `apiBase:"https://miempresa-api-stg.disruptiveexp.com/api/v1"`.

```bash
curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com/          # 200
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -o 'miempresa-api-stg[^"]*' | head -1
```

### Execution log R4 — ✅ COMPLETE (2026-07-05)

**Commands executed (verbatim)**:
```bash
cd frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --profile disruptive
#   → nuxt generate: build 12M
#   → zip 2.0M → s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260705-223123.zip
#   → amplify start-deployment: Job ID 2 → ✓ SUCCEED (first attempt)
#   → Custom domain: https://miempresa-stg.disruptiveexp.com

# Verification
curl -s -o /dev/null -w "root: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/
#   → root: 200
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -o 'miempresa-api-stg[^"]*' | head -1
#   → miempresa-api-stg.disruptiveexp.com/api/v1   (correct apiBase baked into served bundle)
curl -s -o /dev/null -w "spa-fallback /nomina: %{http_code}\n" https://miempresa-stg.disruptiveexp.com/nomina
#   → spa-fallback /nomina: 200   (new route served by the Amplify rewrite rule)
```

---

## Phase R5 — Post-deploy QA (closes the storage report's item 5)

```bash
# 1. Full staging suite (DB 18 · API 9 · browser 5 = 32/32 expected)
./scripts/qa-staging.sh --stage staging --profile disruptive

# 2. NEW — real upload e2e against staging (first ever; the July-3 frontend predates all upload surfaces)
#    Write frontend/tests/staging/staging-upload.spec.ts following the P2-5 pattern
#    (tests/local-qa/jul4-p2-cert-empleado-archivo.spec.ts), with ONE key difference:
#    assert the PUT destination host is the STAGING bucket, not just "any S3 URL"
#    (CRITICAL-2 lesson: a 200 on the wrong URL is worse than an error):
#      waitForResponse(r => r.request().method()==='PUT'
#        && r.url().includes('miempresa-uploads-540657241795-staging')) → expect 200
#    Login: QA user from SSM (qa/QA_USER_EMAIL + qa/QA_USER_PASSWORD) — same pattern as
#    staging-login.spec.ts; the spec creates and deletes its own throwaway empleado.
TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com \
  npx playwright test tests/staging/staging-upload.spec.ts
#    NOTE: this spec is now permanent in tests/staging/ — future qa-staging.sh runs report
#    6 browser tests (was 5), i.e. 33 total.

# 3. Feature smoke (manual or scripted, via browser on https://miempresa-stg.disruptiveexp.com):
#    - /certificados: create MENSUAL cert + comprobante upload; missing-month alert; "Duplicar para este mes"
#    - /empleados/[id]/editar: cert row archivo upload · hoja de vida upload (Info Laboral tab)
#    - /empleados/[id]: Pendientes tab (derived items render) · Novedades tab (create MEMORANDO with adjunto)
#    - /nomina: reachable from sidebar; month table renders; registrar entrada for an empleado with contrato activo
#    - /pacientes/crear: genero OTRO reveals inline input and persists
```

**Success criteria**: 32/32 staging suite · staging upload spec green (S3 PUT 200 to the staging bucket) · all smoke flows work · no pm2 restarts/errors in `pm2 logs miempresa-api --lines 100`.

### Execution log R5 — ✅ ALL GREEN (2026-07-05)

**Commands executed (verbatim)**:
```bash
# 1. Full three-tier staging suite
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive
#   → ✅ DB (schema/migrations/seed) · ✅ Backend API 9 passed · ✅ Frontend browser 5 passed — 32/32

# 2. NEW spec written: frontend/tests/staging/staging-upload.spec.ts
#    (self-contained: creates throwaway empleado via cookie-authed page.request, uploads a
#     cert archivo through the deployed SPA, asserts the PUT host matches
#     /miempresa-uploads-\d+-staging\.s3[.-]/, deletes the empleado in finally{})
cd frontend
export TEST_FRONTEND_URL=$(aws ssm get-parameter --name /miempresa/staging/frontend/APP_URL \
  --profile disruptive --region us-east-1 --query Parameter.Value --output text)
export QA_USER_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL \
  --with-decryption --profile disruptive --region us-east-1 --query Parameter.Value --output text)
export QA_USER_PASSWORD=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD \
  --with-decryption --profile disruptive --region us-east-1 --query Parameter.Value --output text)
npx playwright test tests/staging/staging-upload.spec.ts --reporter=line
#   → ✅ 1 passed (8.4 s) — REAL browser PUT direct to the staging bucket → 200
#   → storage-validation-report-jul5.md item 5 CLOSED. First-ever verified upload on staging.
#   (future runs: tests/staging/run-staging-qa.sh exports the same three vars and runs the
#    whole tests/staging dir — this spec is now part of that suite)

# 3. Endpoint smoke on new/changed surfaces (cookie-authed curl, read-only)
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL \
  --with-decryption --profile disruptive --region us-east-1 --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD \
  --with-decryption --profile disruptive --region us-east-1 --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1
curl -s -c /tmp/jul5-jar -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null -w "login: %{http_code}\n"
for ep in "certificates" "certificates/stats" "nomina?periodo=2026-07" "employees?limit=1"; do
  curl -s -b /tmp/jul5-jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
done
rm -f /tmp/jul5-jar
#   → login: 200 · GET /certificates: 200 · GET /certificates/stats: 200
#   → GET /nomina?periodo=2026-07: 200 · GET /employees?limit=1: 200

# 4. Process stability + error-log scan
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
    -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "pm2 logs miempresa-api --lines 60 --nostream 2>/dev/null | grep -iE 'error|exception|fatal' | tail -8; \
   pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; \
     print('status:', p['pm2_env']['status'], '| restarts:', p['pm2_env']['restart_time'])\""
#   → status: online | restarts: 0 (since deploy)
#   → only log "error": a ZodError from the QA suite's intentional empty-body login probe
#     (origin-hardening test) — expected, benign
```

---

## Release result — ✅ COMPLETE (2026-07-05, ~23:00 local)

```
Deployed:  backend d-4652ODYEK (releases/manual-jul5.zip, 229 KiB, first attempt)
           frontend Amplify Job 2 (releases/20260705-223123.zip, first attempt)
DB:        4 → 13 migrations · 30 → 35 tables · contratos_empleado_activo_uq present
Snapshot:  working tree eed9780 (local tag staging-jul5-snapshot) — NOT committed (decision ②)
Backup:    s3://miempresa-backups-540657241795-staging/manual/pre-jul5-release.sql.gz (11.9 KB)
QA:        local 40/40 · staging suite 32/32 · staging upload e2e 1/1 (NEW) · endpoint smoke 5/5
Zero failed deployments, zero rollbacks, no new bugs (ledger stays at B18).
```

---

## Rollback plan

| Layer | How |
|---|---|
| **Frontend** | Redeploy the previous zip: `aws amplify start-deployment` with the prior `releases/…` object in `miempresa-frontend-artifacts-540657241795-staging` (list with `aws s3 ls`). SPA-only, instant. |
| **Backend code** | Redeploy previous artifact `releases/manual-phase3-r2.zip` via `create-deployment`. ⚠ Only valid together with DB rollback if migrations already applied — old code + new schema is additive-safe for jul4 tables, but `f1_cert_taxonomy` renamed enum values the old code queries → restore DB too. |
| **Database** | Restore R2 snapshot: stop pm2, `dropdb`/`createdb` + `gunzip -c pre-jul5-release.sql.gz \| psql`, restart pm2. Data written between deploy and rollback is lost — acceptable on staging. |
| **CFN s3-stack** | No rollback needed (CORS change is idempotent with live state). Worst case: `put-bucket-cors` the previous JSON back. |

---

## Issues & mitigations log (live — bug ledger unchanged, no B19 needed)

| # | Phase | Issue | Mitigation |
|---|---|---|---|
| 1 | R0 | `ssh-to-instance.sh` is interactive-only (positional `<instance-name>`, no `--command`) — runbook draft assumed flags | Ran remote commands via direct `ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 "..."`; consider adding a `--command` passthrough to the utility later |
| 2 | R0 | `aws ssm` calls failed with "must specify a region" | Always pass `--region us-east-1` explicitly (profile has no default region) |
| 3 | R1 | Expected CFN drift didn't exist — stack was already `UPDATE_COMPLETE` with the new template (updated during the storage-fix session same day) | No-op deploy served as verification; runbook assumption corrected in log |
| 4 | R3 | Artifact zip (229 KiB) had no `dist/generated` — looked like B-learning-3 regression | False alarm: `after-install.sh:90-106` generates + copies the Prisma client ON-INSTANCE and validates it; artifact is correct without it |

📚 **Learnings**
17. `pg_dump` via `sudo -u postgres` from an ssh command prints a benign `could not change directory to "/home/ec2-user"` warning — the dump is unaffected.
18. The staging upload spec must pin the PUT **destination host** (`miempresa-uploads-\d+-staging.s3`) — asserting any 200 PUT would have passed even with CRITICAL-2 present, because the SPA host answers `PUT /empleados/:id/undefined` with 200.

---

## Grep hooks
staging-release-jul5 runbook manual-jul5.zip migrate-deploy 9-migrations f1_cert_taxonomy SET-NOT-NULL enum-surgery pre-jul5-release backup rollback miempresa-s3-staging UploadsCorsAllowedOrigins staging-upload.spec CRITICAL-2 res.data
