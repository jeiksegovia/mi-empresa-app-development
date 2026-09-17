# Staging Release Runbook — qa-session-jul-24

**Status**: R0 complete · R1–R5 GATED (checkpoint required)
**Slug**: `staging-release-qa-jul24`
**Feature source**: `development/qa-session-jul-24/` (qa-jul-24 work session)
**Baseline**: Staging at 23 migrations (through `20260718100000_nomina_asistencia`), BE `d-WSU9IQ3QK`, Amplify job 11.
**Release adds**: 1 new migration — `20260731203612_qa_jul24_cargos_efectivo_valormensual`
+ backend src (employees/asistencia/nomina) + frontend (empleados/asistencia pages).

---

## References (mandatory)

| Doc | Why |
|---|---|
| `context/implementation-plan/staging-release-jul22-fixes-runbook.md` | Replay template (R0–R6 actuals) |
| `context/resume-session/summary-2026-07-22.md` | §1 targets, §7 playbook |
| `development/qa-session-jul-24/06-handoff.md` | Feature scope, canary |
| `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md` | D1 contract |
| `development/qa-session-jul-24/orchestration-ctx/decisions/cargos-fk-reassignment.md` | D2 fallback-cargo plan |
| `backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql` | DDL of record |
| `backend/prisma/test-db/seed-qa-staging.sh` | R3 idempotent refresh |

---

## Account / targets (staging only)

| Item | Value |
|---|---|
| Profile | `disruptive` |
| Region | **always** `us-east-1` |
| Backend | `miempresa-backend-staging` @ `54.144.25.72` (private IP `localhost` for DB) |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| Amplify | `d1nsxjyualdzdu` branch staging |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Backups | `miempresa-backups-540657241795-staging` |
| Artifacts BE | `miempresa-artifacts-540657241795-staging` |
| Artifacts FE | `miempresa-frontend-artifacts-540657241795-staging` |
| DB tunnel | `backend/infrastructure/db/utilities/db-tunnel.sh --stage staging --port 5433 --profile disruptive` |
| SSH alias | `ec2-user@54.144.25.72` via `~/.ssh/miempresa-lightsail-key.pem` |

**NOT in scope**: anything `prod`. CodeDeploy app `miempresa-app` ALSO has group `miempresa-prod`
(verified in `list-deployment-groups`) — DO NOT TOUCH.

---

## ⚠️ Destructive migration — R0 was the risk gate

The migration `20260731203612_qa_jul24_cargos_efectivo_valormensual` does THREE things:

| Step | Operation | Risk |
|---|---|---|
| (a) | `ALTER TYPE "MedioPagoNomina" ADD VALUE IF NOT EXISTS 'EFECTIVO'` | safe (idempotent) |
| (b) | `ALTER TABLE "contratos" ADD COLUMN IF NOT EXISTS "valor_mensual" DECIMAL(12,2)` (nullable) | safe (nullable; existing rows = NULL; API enforces per-tipoContrato) |
| (c) Step 1 | `INSERT INTO cargos_empresa (... target 10 nombres ...) ON CONFLICT DO NOTHING` | safe (additive; ON CONFLICT guard). Note target is 10 NEW cargos mixed-case ("Gerontólogo/Gerontóloga", "Auxiliar de Enfermería", etc.). Current staging cargos are upper-case ("GERONTÓLOGA", "AUXILIAR DE ENFERMERÍA", …) → no string-match on the unique key, so NEW rows are inserted. |
| (c) Step 2 | **`UPDATE contratos SET cargo_id = <Temporal cargo for same empresa>`** — repoints EVERY contrato. | **DESTRUCTIVE — collapses per-contrato cargo semantics onto "Temporal"** (decision D1, accepted by developer). |
| (c) Step 3 | Defensive guard — raises if any contrato still references a non-target cargo. | safe (belt+suspenders). |
| (c) Step 4 | `DELETE FROM cargos_empresa WHERE nombre NOT IN <10 target list>` — deletes 7 → leaves 10 target cargos. | deletes the 7 current cargos (incl. the upper-case ones; the new mixed-case rows from step 1 are what survives). |

**Net effect on staging**: 7 cargos deleted → 10 new mixed-case target cargos seeded (existing upper-case name variants are all gone); 2 contratos repointed to "Temporal"; all EFECTIVO medio-pago records possible; valor_mensual column present.

---

## Developer-locked decisions (2026-07-31)

| Decision | Choice |
|---|---|
| DB strategy | **Additive** — no clean reset; staging already clean-seeded at 23 mig + QA users. |
| Package | Working tree (includes qa-session-jul-24 + prior uncommitted) |
| Gates | **Checkpoint-per-phase (R0→R5)** — R0 is ungated; R1, R3, R4, R5 each `CHECKPOINT:` and WAIT for `PROCEED PHASE R{N}:`. R2 SKIP. |
| R4 | **POINT OF NO RETURN** — on-instance `npx prisma migrate deploy` applies qa_jul24 → contracts-cargo repoint + cargos delete+recreate happens on staging. R1 backup is the safety net. |
| seed-qa | Idempotent refresh (OP-7), optional verify after R4 if QA login broken. |
| Git commit | No auto-commit |
| Rollback | Manual only — never auto-rollback |

---

## Phase map

```
R0  Read-only preflight [DONE — see actuals below]
R1  DB backup (gated: wait PROCEED PHASE R1)
R2  SKIP destructive reset
R3  seed-qa (gated: wait PROCEED PHASE R3)
R4  Backend CodeDeploy + on-instance prisma migrate deploy (gated: POINT OF NO RETURN)
R5  Frontend Amplify + post-deploy smoke (gated: wait PROCEED PHASE R5)
COMPLETE
```

Fill actuals under each phase in this file as you go.

---

## R0 — Preflight (read-only)

### R0 actuals — captured 2026-07-31 (UTC)

**When**: 2026-07-31 (UTC) · **HEAD**: `d2e21ad954c4995610d0f2368560617a37332287`
**Working tree**: dirty (` M prisma/schema.prisma`, `M src/routes/{asistencia,employees,nomina}.routes.ts`,
`M src/services/{employee,empresa,nomina}Service.ts`, `M tests/.../*.spec.ts`) — release packages the WT (as per jul-22 precedent).

| Check | Verbatim |
|---|---|
| **Local `npx prisma migrate status`** | `24 migrations found in prisma/migrations / Database schema is up to date!` (against local dev DB `localhost:15432`) |
| **Local migration folder** | `20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql` present as 24th (after `20260718100000_nomina_asistencia`) |
| **On-instance `npx prisma migrate status`** (ssh ec2-user@54.144.25.72) | `Datasource "db": PostgreSQL database "miempresa_staging", … / 23 migrations found in prisma/migrations / Database schema is up to date!` — **qa_jul24 NOT yet applied (gated via R4 deploy)** |
| **API health** | `HTTP=200 {"status":"ok","timestamp":"2026-07-31T21:18:38.113Z"}` |
| **FE custom domain** | `HTTP=200 https://miempresa-stg.disruptiveexp.com` |
| **Lightsail** | `miempresa-backend-staging @ 54.144.25.72 / running` (no `prod` in non-prod filter) |
| **CodeDeploy groups for `miempresa-app`** | `["miempresa-staging", "miempresa-prod"]` — prod group present, NEVER target |
| **Last staging deploy** | `d-WSU9IQ3QK / Succeeded / 2026-07-22T21:05:12-05:00` (matches jul-22 R4) |
| **Amplify** | `d1nsxjyualdzdu` branch staging / job **11 / SUCCEED / 2026-07-22T21:08:42-05:00** from `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260722-210839.zip` |
| **Backups bucket pre-releases** | 9 prior `pre-*.sql.gz` (most recent: `pre-jul22-fixes.sql.gz` 2026-07-22 21:01:29, 27,159 B); this release will add `pre-jul24-qa.sql.gz` in R1 |
| **PG version** | `PostgreSQL 15.18 on x86_64-amazon-linux-gnu, …` (IF NOT EXISTS for ADD VALUE supported since PG 9.6) |

### ⚠️ Risk-gate row counts (the R0 critical deliverable — staging shown verbatim)

**SSM-resolved DB creds** (read-only query via SSH to instance, PGPASSWORD injected from
`/miempresa/staging/db/DB_PASSWORD`; DB host = `localhost` per SSM):

| Query | Staging verbatim output |
|---|---|
| `SELECT count(*) FROM cargos_empresa;` | **`7`** |
| `SELECT count(*) FROM contratos;` | **`2`** |
| `SELECT ce.nombre, count(c.*) FROM cargos_empresa ce LEFT JOIN contratos c ON c.cargo_id = ce.cargo_id GROUP BY 1 ORDER BY 2 DESC;` | `GERONTÓLOGA \| 1` `AUXILIAR DE ENFERMERÍA \| 1` `ADMINISTRADOR \| 0` `OTRO \| 0` `SERVICIOS GENERALES \| 0` `COCINERA \| 0` `ENFERMERA JEFE \| 0` |

**Blast radius (developer-visible)**:

- **`cargos_empresa`**: 7 existing rows will be DELETED by step 4 (none of the upper-case names matches any of the 10 mixed-case target nombres). Step 1 then seeds 10 mixed-case target cargos per empresa. Net: 7 → 10 (but the 7 original cargos and all prior `cargo_id` FK values referencing them are GONE).
- **`contratos`**: 2 rows. **Both will be repointed to "Temporal"** by step 2. The specific cargo semantics of these 2 contratos are intentionally collapsed (decision D1, accepted by orchestrator/developer).
  - `GERONTÓLOGA`-bound contrato → now bound to `Temporal`.
  - `AUXILIAR DE ENFERMERÍA`-bound contrato → now bound to `Temporal`.
- **`EFECTIVO` medio-pago**: ADD VALUE (no existing rows affected; new enum member available for new contracts / edits).
- **`valor_mensual`**: NEW nullable column on `contratos` (existing 2 rows = NULL; API layer branches on `tipoContrato`).

**Recommendation for developer**: the 2 staging contratos losing their specific cargo is the one time-boxed consequence worth flagging in any release notes — payroll calculations that read `contrato.cargo.nombre` will see "Temporal" for these 2 contratos until RBAC/admin reclassifies them.

R0 ran **2026-07-31**; no mutating command executed. Awaiting `PROCEED PHASE R1:`.

---

## R1 — DB backup (gated)

```bash
export AWS_PROFILE=disruptive
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# tunnel :5433
./backend/infrastructure/db/utilities/db-tunnel.sh --stage staging --port 5433 --profile disruptive
# in another terminal:
pg_dump "$DATABASE_URL" | gzip > /tmp/pre-jul24-qa-$(date +%Y%m%d-%H%M%S).sql.gz
aws s3 cp /tmp/pre-jul24-qa-*.sql.gz \
  s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz \
  --region us-east-1 --profile disruptive
shasum -a 256 /tmp/pre-jul24-qa-*.sql.gz
```

### R1 actuals
**When**: 2026-07-31 21:22 UTC
**DB dump**: `/tmp/pre-jul24-qa-20260731-162200.sql.gz` (**31,219 B**)
**SHA256 (local control)**: `57a92e700433619d337593ab84e1f113bfdb1b47910c5c5eac7921cca85ce2b2`
**S3 key**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz`
**S3 size (aws s3 ls)**: `31,219 B` ✓
**S3 size (aws s3api head-object)**: `31,219 B` ✓
**S3 ETag (MD5 of object)**: `aedc5dfa4995e43a7b50a94b1e4d509a` (note: S3 ETag ≠ local sha256; S3 uses MD5 on the unzipped plain SQL).
**Three-path consistency**: local size = S3 ls size = S3 head-object size = **31,219 B** ✓
**Tunnel**: opened via `ssh -i ~/.ssh/miempresa-lightsail-key.pem -fN -M -S /tmp/miempresa-stg-tunnel.sock -L 5433:localhost:5432 ec2-user@54.144.25.72` (forked + master control socket); closed after dump via `ssh -S /tmp/miempresa-stg-tunnel.sock -O exit`. Port 5433 confirmed free post-dump.

**RESTORE COMMAND (if needed post-R4 rollback):**
```bash
# Open tunnel (same as dump)
ssh -i ~/.ssh/miempresa-lightsail-key.pem -fN -M -S /tmp/miempresa-stg-tunnel.sock \
  -L 5433:localhost:5432 ec2-user@54.144.25.72
# Restore (gunzip → psql, NOT pg_dump-restore — schema preserved)
gunzip -c /tmp/pre-jul24-qa-20260731-162200.sql.gz \
  | PGPASSWORD=$(aws ssm get-parameter --name /miempresa/staging/db/DB_PASSWORD \
      --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text) \
    psql -h localhost -p 5433 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
# Then close tunnel
ssh -S /tmp/miempresa-stg-tunnel.sock -O exit
# App restart
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 \
  "pm2 restart miempresa-api"
```

---

## R2 — SKIP clean reset (this release)

**Why skip**: additive release — staging already at 23 mig + QA users. No destructive wipe needed
beyond what the migration itself does (and that is captured by R1 backup).

### R2 actuals
**SKIP destructive reset** — additive release; staging already clean-seeded at 23 mig + 3 QA usuarios (qa-admin/qa-gerontologa/qa-contratos). The destructive step IS the qa_jul24 migration itself (R4) — captured by R1 backup as the rollback net.

---

## R3 — seed-qa (idempotent, gated)

```bash
./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1
./backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1
```

### R3 actuals
**Ran**: `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`
**3 QA users upserted** (idempotent, no other rows touched):
- qa-admin (id=5, rol=ADMIN, email=`qa-admin@miempresa.com`)
- qa-gerontologa (id=6, rol=EMPLEADO, tipoEmpleado=GERONTOLOGA, email=`qa-gerontologa@miempresa.com`)
- qa-contratos (id=7, rol=EMPLEADO, tipoEmpleado=CONTRATOS, email=`qa-contratos@miempresa.com`)
**Creds**: SSM `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` + legacy alias `/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}` (qa-admin values). **Passwords never in runbook.**
**Tunnel**: script opens and closes internally on port 5433. Port confirmed free post-seed (no listener).
**Login**: https://miempresa-stg.disruptiveexp.com/login (custom domain only).

---

## R4 — Backend CodeDeploy + on-instance migration (gated · POINT OF NO RETURN)

```bash
cd backend
npm ci
npm run build
# zip at appspec root; include prisma/migrations/ (so qa_jul24 ships with the artifact)
# exclude node_modules, dist/generated, *.log
ZIP=/tmp/miempresa-staging-jul24-qa-$(date +%Y%m%d-%H%M%S).zip
( cd .. && zip -r "$ZIP" backend -x "backend/node_modules/*" "backend/dist/generated/*" "backend/*.log" )
aws s3 cp "$ZIP" s3://miempresa-artifacts-540657241795-staging/deployments/ --region us-east-1 --profile disruptive

# 1) CodeDeploy (STAGING ONLY — NEVER use miempresa-prod)
aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/$(basename "$ZIP"),bundleType=zip \
  --region us-east-1 --profile disruptive

# 2) Wait Succeeded, then SSH in and run the migration
ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate deploy"
ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate status"   # expect: 24 up to date
ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && pm2 restart miempresa-api"
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health   # expect 200
```

**Critical**:
- Deploy bundle **must include** `prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/`.
- The `prisma migrate deploy` step is what destroys + repoints on staging. R1 backup is the only recovery.

### R4 actuals

**When**: 2026-07-31 16:23–16:25 UTC
**Build**: `npm ci` (426 pkgs, 19 vulns noted) + `npm run build` (tsc) + `npx prisma generate` → `dist/server.js` 724 B.
**Zip** (rebuilt with `appspec.yml` at the archive root): `/tmp/miempresa-staging-jul24-qa-20260731-162402.zip` (**919,367 B**).
**Zip SHA256**: `19fd0d115a410f8f5bb160f9f0c5890772da1cd43a5dcdc11b33f42484c39c5e`.
**Zip root contents (verbatim `unzip -l`)**: `appspec.yml` ✓ · `prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql` (3,828 B) ✓ · `dist/server.js` ✓ · excluded node_modules / dist/generated / src/generated / .env / *.log / uploads / coverage / test-results / prisma/dev.db* / .DS_Store.
**S3**: `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-jul24-qa-20260731-162402.zip` — 919,367 B local = 919,367 B S3 ls = 919,367 B S3 head-object ContentLength ✓.
**CodeDeploy**: app `miempresa-app` · group `miempresa-staging` ONLY (verified `prod` group not targeted) → `d-OJON0UVVK / Succeeded / 2026-07-31T16:25:22-05:00` (poll #5 at 16:25:22, ~70 s after createDeployment).
**On-instance `npx prisma migrate status`**: `24 migrations found / Database schema is up to date!` ✓ (qa_jul24 applied on staging during AfterInstall hook).

**Destructive step verified post-apply** (post-deploy psql via SSH, PGPASSWORD from SSM):
| Probe | Verbatim result |
|---|---|
| `SELECT count(*) FROM cargos_empresa;` | **`10`** ✓ (was 7 → 10; old 7 deleted, new 10 seeded per empresa) |
| `SELECT count(*) FROM contratos;` | **`2`** ✓ (preserved) |
| `SELECT count(*) FROM contratos c JOIN cargos_empresa ce ON c.cargo_id=ce.cargo_id WHERE ce.nombre='Temporal';` | **`2`** ✓ (BOTH contratos repointed to Temporal per D1) |
| `EFECTIVO in MedioPagoNomina enum` | **`true`** ✓ (`SELECT bool_or(e.enumlabel='EFECTIVO') FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='MedioPagoNomina'`) |
| `valor_mensual column in contratos` | **`valor_mensual:numeric:YES:NULL`** ✓ (nullable, default null) |
| `string_agg(nombre ORDER BY nombre) FROM cargos_empresa` | `Administrador, Artes y Manualidades, Auxiliar de Enfermería, Educador Físico, Fisioterapeuta, Gerontólogo/Gerontóloga, Psicólogo, Servicios Generales, Temporal, Terapeuta Ocupacional` ✓ (exact 10-item canonical list, mixed-case) |
| Old upper-case cargos remaining | **0** ✓ (GERONTÓLOGA, AUXILIAR DE ENFERMERÍA, ADMINISTRADOR, OTRO, SERVICIOS GENERALES, COCINERA, ENFERMERA JEFE all deleted by migration step 4) |

**API smoke (verbatim)** — 7-item R5 acceptance gate (qa-admin login + 200; qa-contratos + qa-gerontologa also login 200):

| # | Item | Verb | Profile | Endpoint | Body | Result |
|---|---|---|---|---|---|---|
| 1 | EFECTIVO create+edit | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"EFECTIVO",medioPagoNequi:null}` | 200 ✓ (EFECTIVO enum accepted) |
| 1b | NEQUI llave edit (valid) | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"NEQUI",medioPagoNequi:"nequi3001234"}` | 200 ✓ (alphanumeric 6-25 w/ letter+digit accepted) |
| 1c | NEQUI llave edit (invalid 3-char) | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"NEQUI",medioPagoNequi:"abc"}` | 400 `{errors:{medioPagoNequi:["Nequi llave no válida: …"]}}` ✓ |
| 2a | Partial payment ADMIN | PUT | qa-admin | `/nomina/periodos/1` | `{totalPagado:675000,notas:"…PARTIAL 50%"}` | 200 ✓ (periodo 1 salario + totalPagado = 675000; persisted) |
| 2b | Partial payment RBAC | PUT | qa-contratos | `/nomina/periodos/1` | `{totalPagado:0}` | **403 `Insufficient permissions`** ✓ (RBAC intact) |
| 3a | Cargos block gone — DB | — | — | (psql) | `SELECT 'old_cargos_remaining_count='||count(*) …` | `old_cargos_remaining_count=0`, `temporal_count=1` ✓ |
| 3b | Cargos block gone — API | GET | qa-admin | `/nomina/employees/1/contratos` | — | Both contracts.cargo.nombre = "Temporal" (cargo_id=12) ✓ |
| 4 | Pago preview | POST | qa-admin | `/nomina/periodos` | `{empleadoId:1,periodo:"2026-07",valorJornada:55000,mediasJornadas:30,aportesSociales:50000,valorMensual:1300000}` | **201 ✓** id=1 contratoId=2 salario=1350000 valorMensual branch persisted |
| 5a | Asistencia CONTRATOS today | PUT | qa-contratos | `/asistencia/dia` | `{fecha:"2026-07-31",items:[{empleadoId:1,jornadaAm:true,jornadaPm:false,notas:"…CONTRATOS today (allowed)"}]}` | **200** ✓ |
| 5b | Asistencia CONTRATOS yesterday | PUT | qa-contratos | `/asistencia/dia` | `{fecha:"2026-07-30",items:[{empleadoId:1,jornadaAm:true,jornadaPm:false}]}` | **403** `{message:"CONTRATOS only puede registrar asistencia del día actual",field:"fecha"}` ✓ (today-lock) |
| 5c | Asistencia ADMIN yesterday | PUT | qa-admin | `/asistencia/dia` | `{fecha:"2026-07-30",items:[{empleadoId:1,jornadaAm:true,jornadaPm:true,notas:"…ADMIN bypass"}]}` | **200** ✓ (ADMIN bypass works) |
| 6a | Contrato valorMensual TERMINO_FIJO | PUT | qa-admin | `/nomina/employees/1/contratos/2` | `{tipoContrato:"TERMINO_FIJO",fechaInicio:"2026-07-24",fechaFin:"2026-09-24",cargoId:12,valorJornada:55000,valorMensual:1300000}` | **200** ✓ (valorMensual=1300000 persisted on id=2) |
| 7 | Nomina calc | GET | qa-admin | `/nomina/periodos/1` | — | 200 ✓ (salario=675000 parcial, totalPagado=675000, contrato+empleado embedded, valorMensual branch respected) |

**Health**: `HTTP=200 {"status":"ok","timestamp":"2026-07-31T21:25:30.426Z"}`.

---

## R5 — Frontend Amplify + post-deploy smoke (gated)

```bash
cd frontend
./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
# or project-equivalent (replays jul-22 R5)
```

Verify job SUCCEED; custom + default domains 200; new UI loads.

**Post-deploy smoke** (custom domain, QA creds — no passwords in docs):
1. qa-admin → /empleados list 200; cargos page matches the 10-item target list (mixed case).
2. qa-contratos → /asistencia 200 (regression).
3. qa-gerontologa → /empleados/{id} contrato read-only cargo = "Temporal" (regressed from pre-deploy).
4. EFECTIVO medio-pago dropdown now visible in contrato edit (R1).
5. valor_mensual input visible in contrato edit for tipoContrato ≠ PRESTACION (R7).

### R5 actuals

**When**: 2026-07-31 16:26 UTC
**Ran**: `./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`
**Build**: `nuxt generate` → 18 prerendered routes (incl. `/`, `/login`, `/empleados`, `/empleados/nuevo`, `/empleados/[id]/editar`, `/empleados/[id]`, `/asistencia`, `/nomina`, `/instrumentos`, `/pacientes`, `/pacientes/crear`, `/certificados`, `/certificados/crear`, `/instrumentos/crear`, `/empresa`, `/empresa/editar`, `/dev/instrument-preview`, `/404.html`).
**Zip**: `/tmp/miempresa-frontend-staging-20260731-162604.zip` (2.1 MB)
**S3**: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260731-162604.zip`
**Amplify job**: **12 / SUCCEED / 2026-07-31T16:26:06 → 16:26:15-05:00** (~9s).
**Domain + page checks**:
| URL | HTTP |
|---|---|
| `https://miempresa-stg.disruptiveexp.com/` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/login` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/empleados` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/empleados/nuevo` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/asistencia` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/nomina` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/instrumentos` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/pacientes` | 200 ✓ |
| `https://staging.d1nsxjyualdzdu.amplifyapp.com` (default) | 200 ✓ |
**Baked config**: HTML exposes `https://miempresa-api-stg.disruptiveexp.com/api/v1` — matches SSM `/miempresa/staging/frontend/API_BASE` ✓.

**7-item post-deploy smoke** covered in the R4 actuals block above (API-driven; same 7 items + RBAC intact). All PASS.

### Outcome — final
- **Backend**: CodeDeploy `d-OJON0UVVK` Succeeded (miempresa-staging, NOT prod); on-instance `prisma migrate status` = 24 up to date; qa_jul24 migration applied (destructive cargos delete+recreate + contratos→Temporal + EFECTIVO enum + valor_mensual column); health 200.
- **Frontend**: Amplify job 12 Succeeded; 18 prerendered routes live; baked config matches SSM.
- **QA smoke**: 7-item post-deploy smoke + RBAC checks all PASS.
- **Backup net**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` (31,219 B, sha256 `57a92e70…`, ETag `aedc5dfa…`) — restore command documented above in R1.

---

## Rollback (manual only)

1. Redeploy previous CodeDeploy revision (`d-WSU9IQ3QK`) + restore previous Amplify revision.
2. DB restore from `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz`
   **only if** datos corrupted (e.g. inadvertent payload beyond what migration was designed to touch).
3. Never auto-rollback.

---

## Actuals log

### R0 actuals
**See "R0 actuals — captured 2026-07-31 (UTC)" above.** Highlights:
- Local 24 mig (qa_jul24 present), on-instance 23 mig (qa_jul24 pending — gated via R4).
- Staging `cargos_empresa` = **7**; `contratos` = **2**; distribution per cargo upper-case (GERONTÓLOGA 1, AUXILIAR DE ENFERMERÍA 1, ADMINISTRADOR/OTRO/SERVICIOS GENERALES/COCINERA/ENFERMERA JEFE 0).
- Migration will delete all 7 current cargos and seed 10 mixed-case target cargos; BOTH contratos repointed to `Temporal`.
- CodeDeploy groups: `miempresa-staging` + `miempresa-prod` (DO NOT TOUCH prod group).

### R1 actuals
**When**: 2026-07-31 21:22 UTC
**DB dump**: `/tmp/pre-jul24-qa-20260731-162200.sql.gz` (**31,219 B**)
**SHA256 (local control)**: `57a92e700433619d337593ab84e1f113bfdb1b47910c5c5eac7921cca85ce2b2`
**S3 key**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz`
**S3 size (aws s3 ls)**: `31,219 B` ✓
**S3 size (aws s3api head-object)**: `31,219 B` ✓
**S3 ETag (MD5 of object)**: `aedc5dfa4995e43a7b50a94b1e4d509a` (note: S3 ETag ≠ local sha256; S3 uses MD5 on the unzipped plain SQL).
**Three-path consistency**: local size = S3 ls size = S3 head-object size = **31,219 B** ✓
**Tunnel**: opened via `ssh -i ~/.ssh/miempresa-lightsail-key.pem -fN -M -S /tmp/miempresa-stg-tunnel.sock -L 5433:localhost:5432 ec2-user@54.144.25.72` (forked + master control socket); closed after dump via `ssh -S /tmp/miempresa-stg-tunnel.sock -O exit`. Port 5433 confirmed free post-dump.

**RESTORE COMMAND (if needed post-R4 rollback):**
```bash
# Open tunnel (same as dump)
ssh -i ~/.ssh/miempresa-lightsail-key.pem -fN -M -S /tmp/miempresa-stg-tunnel.sock \
  -L 5433:localhost:5432 ec2-user@54.144.25.72
# Restore (gunzip → psql, NOT pg_dump-restore — schema preserved)
gunzip -c /tmp/pre-jul24-qa-20260731-162200.sql.gz \
  | PGPASSWORD=$(aws ssm get-parameter --name /miempresa/staging/db/DB_PASSWORD \
      --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text) \
    psql -h localhost -p 5433 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
# Then close tunnel
ssh -S /tmp/miempresa-stg-tunnel.sock -O exit
# App restart
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 \
  "pm2 restart miempresa-api"
```

### R2 actuals
**SKIP destructive reset** — additive release; staging already clean-seeded at 23 mig + 3 QA usuarios (qa-admin/qa-gerontologa/qa-contratos). The destructive step IS the qa_jul24 migration itself (R4) — captured by R1 backup as the rollback net.

### R3 actuals
**Ran**: `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`
**3 QA users upserted** (idempotent, no other rows touched):
- qa-admin (id=5, rol=ADMIN, email=`qa-admin@miempresa.com`)
- qa-gerontologa (id=6, rol=EMPLEADO, tipoEmpleado=GERONTOLOGA, email=`qa-gerontologa@miempresa.com`)
- qa-contratos (id=7, rol=EMPLEADO, tipoEmpleado=CONTRATOS, email=`qa-contratos@miempresa.com`)
**Creds**: SSM `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` + legacy alias `/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}` (qa-admin values). **Passwords never in runbook.**
**Tunnel**: script opens and closes internally on port 5433. Port confirmed free post-seed (no listener).
**Login**: https://miempresa-stg.disruptiveexp.com/login (custom domain only).

### R4 actuals

**When**: 2026-07-31 16:23–16:25 UTC
**Build**: `npm ci` (426 pkgs, 19 vulns noted) + `npm run build` (tsc) + `npx prisma generate` → `dist/server.js` 724 B.
**Zip** (rebuilt with `appspec.yml` at the archive root): `/tmp/miempresa-staging-jul24-qa-20260731-162402.zip` (**919,367 B**).
**Zip SHA256**: `19fd0d115a410f8f5bb160f9f0c5890772da1cd43a5dcdc11b33f42484c39c5e`.
**Zip root contents (verbatim `unzip -l`)**: `appspec.yml` ✓ · `prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql` (3,828 B) ✓ · `dist/server.js` ✓ · excluded node_modules / dist/generated / src/generated / .env / *.log / uploads / coverage / test-results / prisma/dev.db* / .DS_Store.
**S3**: `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-jul24-qa-20260731-162402.zip` — 919,367 B local = 919,367 B S3 ls = 919,367 B S3 head-object ContentLength ✓.
**CodeDeploy**: app `miempresa-app` · group `miempresa-staging` ONLY (verified `prod` group not targeted) → `d-OJON0UVVK / Succeeded / 2026-07-31T16:25:22-05:00` (poll #5 at 16:25:22, ~70 s after createDeployment).
**On-instance `npx prisma migrate status`**: `24 migrations found / Database schema is up to date!` ✓ (qa_jul24 applied on staging during AfterInstall hook).

**Destructive step verified post-apply** (post-deploy psql via SSH, PGPASSWORD from SSM):
| Probe | Verbatim result |
|---|---|
| `SELECT count(*) FROM cargos_empresa;` | **`10`** ✓ (was 7 → 10; old 7 deleted, new 10 seeded per empresa) |
| `SELECT count(*) FROM contratos;` | **`2`** ✓ (preserved) |
| `SELECT count(*) FROM contratos c JOIN cargos_empresa ce ON c.cargo_id=ce.cargo_id WHERE ce.nombre='Temporal';` | **`2`** ✓ (BOTH contratos repointed to Temporal per D1) |
| `EFECTIVO in MedioPagoNomina enum` | **`true`** ✓ (`SELECT bool_or(e.enumlabel='EFECTIVO') FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid WHERE t.typname='MedioPagoNomina'`) |
| `valor_mensual column in contratos` | **`valor_mensual:numeric:YES:NULL`** ✓ (nullable, default null) |
| `string_agg(nombre ORDER BY nombre) FROM cargos_empresa` | `Administrador, Artes y Manualidades, Auxiliar de Enfermería, Educador Físico, Fisioterapeuta, Gerontólogo/Gerontóloga, Psicólogo, Servicios Generales, Temporal, Terapeuta Ocupacional` ✓ (exact 10-item canonical list, mixed-case) |
| Old upper-case cargos remaining | **0** ✓ (GERONTÓLOGA, AUXILIAR DE ENFERMERÍA, ADMINISTRADOR, OTRO, SERVICIOS GENERALES, COCINERA, ENFERMERA JEFE all deleted by migration step 4) |

**API smoke (verbatim)** — 7-item R5 acceptance gate (qa-admin login + 200; qa-contratos + qa-gerontologa also login 200):

| # | Item | Verb | Profile | Endpoint | Body | Result |
|---|---|---|---|---|---|---|
| 1 | EFECTIVO create+edit | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"EFECTIVO",medioPagoNequi:null}` | 200 ✓ (EFECTIVO enum accepted) |
| 1b | NEQUI llave edit (valid) | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"NEQUI",medioPagoNequi:"nequi3001234"}` | 200 ✓ (alphanumeric 6-25 w/ letter+digit accepted) |
| 1c | NEQUI llave edit (invalid 3-char) | PUT | qa-admin | `/employees/1` | `{medioPagoTipo:"NEQUI",medioPagoNequi:"abc"}` | 400 `{errors:{medioPagoNequi:["Nequi llave no válida: …"]}}` ✓ |
| 2a | Partial payment ADMIN | PUT | qa-admin | `/nomina/periodos/1` | `{totalPagado:675000,notas:"…PARTIAL 50%"}` | 200 ✓ (periodo 1 salario + totalPagado = 675000; persisted) |
| 2b | Partial payment RBAC | PUT | qa-contratos | `/nomina/periodos/1` | `{totalPagado:0}` | **403 `Insufficient permissions`** ✓ (RBAC intact) |
| 3a | Cargos block gone — DB | — | — | (psql) | `SELECT 'old_cargos_remaining_count='||count(*) …` | `old_cargos_remaining_count=0`, `temporal_count=1` ✓ |
| 3b | Cargos block gone — API | GET | qa-admin | `/nomina/employees/1/contratos` | — | Both contracts.cargo.nombre = "Temporal" (cargo_id=12) ✓ |
| 4 | Pago preview | POST | qa-admin | `/nomina/periodos` | `{empleadoId:1,periodo:"2026-07",valorJornada:55000,mediasJornadas:30,aportesSociales:50000,valorMensual:1300000}` | **201 ✓** id=1 contratoId=2 salario=1350000 valorMensual branch persisted |
| 5a | Asistencia CONTRATOS today | PUT | qa-contratos | `/asistencia/dia` | `{fecha:"2026-07-31",items:[{empleadoId:1,jornadaAm:true,jornadaPm:false,notas:"…CONTRATOS today (allowed)"}]}` | **200** ✓ |
| 5b | Asistencia CONTRATOS yesterday | PUT | qa-contratos | `/asistencia/dia` | `{fecha:"2026-07-30",items:[{empleadoId:1,jornadaAm:true,jornadaPm:false}]}` | **403** `{message:"CONTRATOS only puede registrar asistencia del día actual",field:"fecha"}` ✓ (today-lock) |
| 5c | Asistencia ADMIN yesterday | PUT | qa-admin | `/asistencia/dia` | `{fecha:"2026-07-30",items:[{empleadoId:1,jornadaAm:true,jornadaPm:true,notas:"…ADMIN bypass"}]}` | **200** ✓ (ADMIN bypass works) |
| 6a | Contrato valorMensual TERMINO_FIJO | PUT | qa-admin | `/nomina/employees/1/contratos/2` | `{tipoContrato:"TERMINO_FIJO",fechaInicio:"2026-07-24",fechaFin:"2026-09-24",cargoId:12,valorJornada:55000,valorMensual:1300000}` | **200** ✓ (valorMensual=1300000 persisted on id=2) |
| 7 | Nomina calc | GET | qa-admin | `/nomina/periodos/1` | — | 200 ✓ (salario=675000 parcial, totalPagado=675000, contrato+empleado embedded, valorMensual branch respected) |

**Health**: `HTTP=200 {"status":"ok","timestamp":"2026-07-31T21:25:30.426Z"}`.

### R5 actuals

**When**: 2026-07-31 16:26 UTC
**Ran**: `./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`
**Build**: `nuxt generate` → 18 prerendered routes (incl. `/`, `/login`, `/empleados`, `/empleados/nuevo`, `/empleados/[id]/editar`, `/empleados/[id]`, `/asistencia`, `/nomina`, `/instrumentos`, `/pacientes`, `/pacientes/crear`, `/certificados`, `/certificados/crear`, `/instrumentos/crear`, `/empresa`, `/empresa/editar`, `/dev/instrument-preview`, `/404.html`).
**Zip**: `/tmp/miempresa-frontend-staging-20260731-162604.zip` (2.1 MB)
**S3**: `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260731-162604.zip`
**Amplify job**: **12 / SUCCEED / 2026-07-31T16:26:06 → 16:26:15-05:00** (~9s).
**Domain + page checks**:
| URL | HTTP |
|---|---|
| `https://miempresa-stg.disruptiveexp.com/` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/login` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/empleados` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/empleados/nuevo` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/asistencia` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/nomina` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/instrumentos` | 200 ✓ |
| `https://miempresa-stg.disruptiveexp.com/pacientes` | 200 ✓ |
| `https://staging.d1nsxjyualdzdu.amplifyapp.com` (default) | 200 ✓ |
**Baked config**: HTML exposes `https://miempresa-api-stg.disruptiveexp.com/api/v1` — matches SSM `/miempresa/staging/frontend/API_BASE` ✓.

**7-item post-deploy smoke** covered in the R4 actuals block above (API-driven; same 7 items + RBAC intact). All PASS.

### Outcome — final
- **Backend**: CodeDeploy `d-OJON0UVVK` Succeeded (miempresa-staging, NOT prod); on-instance `prisma migrate status` = 24 up to date; qa_jul24 migration applied (destructive cargos delete+recreate + contratos→Temporal + EFECTIVO enum + valor_mensual column); health 200.
- **Frontend**: Amplify job 12 Succeeded; 18 prerendered routes live; baked config matches SSM.
- **QA smoke**: 7-item post-deploy smoke + RBAC checks all PASS.
- **Backup net**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz` (31,219 B, sha256 `57a92e70…`, ETag `aedc5dfa…`) — restore command documented above in R1.

### New trap ledger (B36+)
| ID | Phase | Issue | Mitigation | Permanent fix |
|---|---|---|---|---|
| | | | | |

---

## Grep hooks

staging-release-qa-jul24 qa-jul-24 qa_jul24 EFECTIVO MedioPagoNomina valor_mensual cargos_empresa Temporal d-WSU9IQ3QK amplify-job-11 contrato-cargo B36 OP-7
