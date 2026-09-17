# W4 Staging Release — Progress Report

**Task ID**: `7` · **Slug**: `staging-release-qa-jul24` · **Profile**: `disruptive` · **Region**: `us-east-1`

---

## R0 — Read-only preflight (DONE · 2026-07-31)

### What ran (read-only commands only — no mutating ops)
- `pwd` → project root `/Users/jeik/ws/mi-empresa-app-development` ✓
- `aws sts get-caller-identity --profile disruptive --region us-east-1` → Account `540657241795`, user `arn:aws:iam::540657241795:user/admin` ✓
- `TaskUpdate(taskId:"7", status:"in_progress")` ✓
- Local: `cd backend && npx prisma migrate status` → `24 migrations found / Database schema is up to date!` (against `localhost:15432` dev DB). New migration `20260731203612_qa_jul24_cargos_efectivo_valormensual` present in `backend/prisma/migrations/`.
- Staging reachability: API `GET /api/v1/health` → 200; FE `GET https://miempresa-stg.disruptiveexp.com` → 200.
- On-instance via `ssh ec2-user@54.144.25.72`: `cd /opt/miempresa/app && npx prisma migrate status` → `23 migrations found / Database schema is up to date!` — qa_jul24 NOT YET APPLIED (gated via R4).
- Infra state: `lightsail get-instances` → `miempresa-backend-staging @ 54.144.25.72 / running`. `deploy list-deployment-groups --application-name miempresa-app` → `["miempresa-staging", "miempresa-prod"]` (prod exists — DO NOT TOUCH). Last staging deploy `d-WSU9IQ3QK / Succeeded / 2026-07-22T21:05:12-05:00`. Amplify app `d1nsxjyualdzdu` branch staging / job **11 / SUCCEED** 2026-07-22T21:08:42.
- Backups bucket `s3://miempresa-backups-540657241795-staging/pre-releases/` — 9 prior `pre-*.sql.gz` (most recent pre-jul22-fixes 27,159 B).

### ⚠️ Risk-gate row counts (the destructive-migration blast radius, verbatim)
| Query | Result |
|---|---|
| `SELECT count(*) FROM cargos_empresa;` | **7** |
| `SELECT count(*) FROM contratos;` | **2** |
| `SELECT ce.nombre, count(c.*) FROM cargos_empresa ce LEFT JOIN contratos c ON c.cargo_id = ce.cargo_id GROUP BY 1 ORDER BY 2 DESC;` | `GERONTÓLOGA 1` · `AUXILIAR DE ENFERMERÍA 1` · `ADMINISTRADOR 0` · `OTRO 0` · `SERVICIOS GENERALES 0` · `COCINERA 0` · `ENFERMERA JEFE 0` |

PG version: `PostgreSQL 15.18 on x86_64-amazon-linux-gnu, …` (ADD VALUE IF NOT EXISTS works since PG 9.6).

### Blast radius (developer-visible)
- `cargos_empresa`: 7 rows → DELETED by migration step 4 (none of the upper-case names matches any of the 10 mixed-case target nombres); 10 new mixed-case target cargos seeded per empresa.
- `contratos`: 2 rows, **BOTH repointed to "Temporal"** (decision D1, accepted by orchestrator/developer). Per-contrato cargo semantics intentionally collapsed.
- `MedioPagoNomina` gets new enum value `EFECTIVO`.
- `contratos.valor_mensual DECIMAL(12,2)` nullable; existing 2 rows = NULL until updated via API per-tipoContrato.

### Runbook written
`context/implementation-plan/staging-release-qa-jul24-runbook.md` created with R0 actuals block + risk-gate callout + 9 grep hooks.

### CHECKPOINT sent
"CHECKPOINT: R0 preflight done. Staging: cargos_empresa=N, contratos=M, distribution=<…>, qa_jul24 pending, health 200. Runbook R0 written. Point of no return = R4 migration. Awaiting PROCEED."

### State
**Awaiting `PROCEED PHASE R1:` from main.** All R0 infra verification READ-ONLY — no AWS mutating call, no SSH mutating call, no DB write, no git write. No resource tagged `prod` was touched or read in a mutating fashion (only STS get-caller-identity + lightsail get-instances + deploy list-* + s3 ls + read-only psql SELECT — all read-only by API contract).

---

## R1 — DB backup (DONE · 2026-07-31 21:22 UTC)

- `pg_dump postgresql://miempresa@localhost:5433/miempresa_staging | gzip -c > /tmp/pre-jul24-qa-20260731-162200.sql.gz` (PG16 in PATH).
- **Local**: 31,219 B / SHA256 `57a92e700433619d337593ab84e1f113bfdb1b47910c5c5eac7921cca85ce2b2`.
- **S3**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul24-qa.sql.gz`.
- **3-path size consistency (all 31,219 B)**: local stat ✓ · `aws s3 ls` ✓ · `aws s3api head-object ContentLength` ✓.
- Tunnel: `ssh -i key -fN -M -S /tmp/miempresa-stg-tunnel.sock -L 5433:localhost:5432 ec2-user@54.144.25.72`, then `ssh -S ... -O exit`. Port 5433 confirmed free.
- **Restore command** documented in runbook R1 section (gunzip | psql via tunnel + pm2 restart).

## R2 — Destructive reset (SKIPPED)

Additive release; the destructive step is the qa_jul24 migration itself (R4), already covered by the R1 backup.

## R3 — seed-qa (DONE · 2026-07-31)

- `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`.
- **3 QA users upserted** (idempotent): qa-admin (id=5 ADMIN), qa-gerontologa (id=6 EMPLEADO/GERONTOLOGA), qa-contratos (id=7 EMPLEADO/CONTRATOS). No other rows touched.
- SSM credentials at `/miempresa/staging/qa/qa-*/{EMAIL,PASSWORD}` (passwords **never** in runbook).

---

## R4 — Backend CodeDeploy + on-instance migration (DONE · 2026-07-31 16:23–16:25 UTC)

- `npm ci` + `npm run build` + `npx prisma generate` → `dist/server.js` 724 B.
- Zip rebuilt with `appspec.yml` at archive root: `/tmp/miempresa-staging-jul24-qa-20260731-162402.zip` (919,367 B) — includes `prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql` (3,828 B). SHA256 `19fd0d115a410f8f5bb160f9f0c5890772da1cd43a5dcdc11b33f42484c39c5e`.
- S3 upload verified (`deployments/...zip` 919,367 B local = S3 ls = S3 head-object).
- `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging` (STAGING ONLY — `miempresa-prod` group not targeted) → `d-OJON0UVVK / Succeeded / 2026-07-31T16:25:22-05:00` (poll #5, ~70 s).
- AfterInstall hook auto-ran `npx prisma migrate deploy` → **24 migrations up to date** ✓.
- Post-migration probes (psql via SSH): cargos=**10** (old 7 deleted, new 10 target seeded); contratos=**2** (preserved); contratos_with_temporal=**2** (BOTH repointed to Temporal per D1); `EFECTIVO` enum present; `valor_mensual` nullable numeric present; old upper-case cargos remaining=**0**; cargo names exact match to canonical 10-item list.
- Health 200 ✓.

## R5 — Frontend Amplify + post-deploy smoke (DONE · 2026-07-31 16:26 UTC)

- `nuxt generate` → 18 prerendered routes → zip `/tmp/miempresa-frontend-staging-20260731-162604.zip` (2.1 MB) → Amplify job **12 / Succeeded / 2026-07-31T16:26:06 → 16:26:15-05:00**.
- 9-page custom-domain HTTP check: `/, /login, /empleados, /empleados/nuevo, /asistencia, /nomina, /instrumentos, /pacientes` all 200 + default domain 200.
- Baked config: HTML exposes `https://miempresa-api-stg.disruptiveexp.com/api/v1` matching SSM.
- **7-item smoke PASS**: EFECTIVO create+edit, NEQUI llave valid/invalid, partial payment + RBAC (ADMIN OK, CONTRATOS 403), cargos block gone, pago preview, asistencia today-lock CONTRATOS + ADMIN any-date + nota, contrato valorMensual by tipo (TERMINO_FIJO required, persisted), nómina calc.
- **Outcome: PASS** — RBAC matrix intact; cargo canonical list enforced; CONTRATOS today-lock enforced; valor_mensual branch by tipoContrato enforced; FE fully live; backup net intact in R1.

## COMPLETE — see completion-report.md



