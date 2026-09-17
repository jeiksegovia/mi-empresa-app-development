# Staging Release Runbook — Centro de Costos (ago-5 + aug-17 QA)

**Status**: R0 + R1 + R4 + R5 COMPLETE 2026-08-19 — CodeDeploy `d-IUQUHA58L` / Amplify job 17 / 30 migrations / 8 INGRESOS / smoke PASS.  
**Never** target `miempresa-prod`.

**Depends on**: T9–T13 landing locally (DONE as of 2026-08-18 per `tasks/W1-W3` completion reports).  
R0 verified locally: 30 migrations / up to date; staging: 29 migrations / up to date. Only the aug-17 migration (#30) is pending on staging.

**Prior staging**: qa-session-aug-17 COMPLETE — CodeDeploy `d-FD0BEVH7L`, Amplify job 16, **29 migrations**.  
See `staging-release-qa-session-aug-17-runbook.md`. That release already noted *“centro-costos already on staging”* (working-tree leftover). Treat **ago-5 migration as likely already applied** on staging; R0 must prove it.

---

## What this release ships (when T9–T11 are done)

| Layer | Artifact |
|---|---|
| Migration **#30** | `20260819025302_centro_costos_aug17_qa` — **additive only** |
| Seed / data-fix | `seedCentrosCostos()` + Transporte rename (NOT in SQL — runs on API startup) |
| Backend | `centroCostosService` / `centroCostos.routes` (fecha, precio, ingreso fields, CONTRATOS limits, GET `/items/:itemId`) |
| Frontend | accordion, create-centro (ADMIN), CONTRATOS visual, ingreso dialog, `/centro-costos/recibo/:itemId` |

**Not in this release**: Prefactura module, IVA, payment splits, reports, nómina ingest, prod.

---

## Account / targets (staging only)

Copy from prior runbooks — do not invent:

| Item | Value |
|---|---|
| Profile / region | developer-designated (ask) / `us-east-1` |
| Instance | `miempresa-backend-staging` @ `54.144.25.72` |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Amplify | `d1nsxjyualdzdu` branch `staging` |
| Backups | `miempresa-backups-540657241795-staging` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` |

**NOT in scope**: group `miempresa-prod`.

---

## Learnings from this cycle (apply on staging)

These are the reasons this runbook exists. Encode them in R0, not as folklore.

### L1 — Never `ADD COLUMN … NOT NULL` without DEFAULT on a table that may have rows

**RB-1** (`20260805000000_centro_costos_ago5` line ~24):

```sql
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;  -- no DEFAULT
```

- Local: 0 rows in `centros_costos` → succeeded.
- Staging with ≥1 row: PostgreSQL **rejects** the statement.
- That ALTER sits **after** `DROP TABLE egresos / prefacturas / productos_servicios`. A failure there leaves a **half-migrated** schema: finance tables gone, new columns missing, `_prisma_migrations` not marked finished.

**If R0 shows ago-5 already applied** → RB-1 is historical. Do not re-run or edit that file.

**If R0 shows ago-5 NOT applied** and `centros_costos.count > 0`:
1. **STOP.** Do not CodeDeploy.
2. Ship a **new** patch migration *before* ago-5 is applied, **or** amend only the **unapplied** ago-5 file to:

```sql
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
```

3. Never edit a migration that is already in `_prisma_migrations` on staging.

**Correct pattern (used in aug-17 `fecha`)** — 3 steps:

```sql
ALTER TABLE … ADD COLUMN "fecha" DATE;           -- nullable
UPDATE … SET "fecha" = "periodo" WHERE "fecha" IS NULL;
ALTER TABLE … ALTER COLUMN "fecha" SET NOT NULL;
```

### L2 — R0 must count every table a migration touches

Including tables being **dropped**, **altered**, and **created**. Ago-5 local audit was 0/0/0/0; **staging was never counted (O1)**. If ago-5 already ran, those three tables must be **absent**. If they still exist with rows, dropping them is data loss — STOP.

R0 query set (run on staging via SSH + local `psql`, after developer names the profile):

```sql
-- identity
SELECT migration_name, finished_at
  FROM _prisma_migrations
 ORDER BY started_at;

-- ago-5 objects
SELECT to_regclass('public.productos_servicios') AS productos_servicios,
       to_regclass('public.prefacturas')         AS prefacturas,
       to_regclass('public.egresos')             AS egresos,
       to_regclass('public.centros_costos')      AS centros_costos,
       to_regclass('public.centro_costos_items') AS centro_costos_items;

SELECT count(*) FROM centros_costos;           -- fail if relation missing: note it
SELECT count(*) FROM centro_costos_items;
SELECT tipo, nombre, orden FROM centros_costos ORDER BY tipo, orden;

-- only if the old tables still exist:
-- SELECT count(*) FROM productos_servicios;
-- SELECT count(*) FROM prefacturas;
-- SELECT count(*) FROM egresos;
```

### L3 — Data-fix that is not in `migration.sql` must be verified after boot

Aug-17 catalog change (D12) is **application seed**, not DDL:

1. `UPDATE` `Transporte` → `Transporte completo` **before** insert (unique `(tipo, nombre)`).
2. Insert Mensualidad 3/4 días + Transporte por 3 días (`skipDuplicates`).
3. Resequence orden 1–14.

If `seedCentrosCostos()` does not run on staging boot, the API is live but the catalog is still the old 11 names. **R5 smoke must query the 8 INGRESOS names.**

### L4 — Do not edit shipped migrations; do not use `--shadow-database-url`

`prisma migrate diff --shadow-database-url` wipes the DB. Forbidden.  
`20260805000000_centro_costos_ago5` must not be rewritten if staging already recorded it.

### L5 — Migrations are gitignored; they only ship inside the CodeDeploy zip

The artifact **must** contain `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/`. AfterInstall runs `npx prisma migrate deploy`. Confirm zip listing before upload (same as jul-31 / aug-17).

### L6 — Point of no return is migrate deploy, not the zip upload

Rollback of additive columns is possible via restore from R1 dump. Rollback of ago-5 **drops** (if it were still pending) is not reversible without that dump. Pre-stage restore command in R1; never auto-rollback.

---

## Risk gate (fill in R0)

| Object | Expected if ago-5 already on staging | Expected if ago-5 pending |
|---|---|---|
| `productos_servicios` / `prefacturas` / `egresos` | **absent** | exist; **must be 0 rows** or STOP |
| `centros_costos` | exists; count N | exists (legacy empty or not) |
| `updated_at` on `centros_costos` | present | RB-1 applies — see L1 |
| `centro_costos_items` | exists | created by ago-5 |
| aug-17 columns (`fecha`, `precio_unitario`, …) | **absent** until #30 | n/a |
| `Transporte` exact name | may still exist until seed runs | — |

Aug-17 migration risk: **LOW** if ago-5 is already applied — additive, 3-step `fecha`, defaults on `habilitar_recibo`.  
Ago-5 if still pending: **HIGH** (drops + RB-1). Do not bundle “just apply both” without the L1/L2 checks.

---

## Phase map

```
R0  Read-only preflight (counts + migrate status + health)     [ungated]
R1  On-instance pg_dump → S3, size+sha two paths               [CHECKPOINT]
R2  SKIP unless R0 says reset/seed needed
R3  SKIP seed-qa (qa-admin / qa-gerontologa / qa-contratos exist)
R4  CodeDeploy miempresa-staging + migrate deploy + pm2        [POINT OF NO RETURN]
R5  Amplify + smoke (catalog, fecha, CONTRATOS 403s, recibo)
```

Gate granularity for the human (choose at R0 CHECKPOINT):

1. Per-phase approval  
2. Bundle R1 then stop before R4  
3. Autonomous after backup (`PROCEED R4+R5 after R1 verifies`)

Always highlight **R4 = point of no easy return**.

---

## R0 — commands (read-only; state profile first)

Do **not** run until the developer says which AWS profile and “yes, run R0”.

```bash
# health
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com

# last deploys (profile TBD)
aws deploy list-deployments --application-name miempresa-app \
  --deployment-group-name miempresa-staging --region us-east-1 --profile <PROFILE>
# NEVER --deployment-group-name miempresa-prod

# on-instance migrate status + L2 queries (SSH as in jul-31 runbook)
# npx prisma migrate status
# then the SQL block in L2
```

Record verbatim: migration list, table existence, counts, whether `Transporte` still exists, whether `fecha` column exists.

---

## R0 actuals — 2026-08-19 (worker-11)

**Date**: 2026-08-19 (UTC)  
**Profile**: `disruptive` · region `us-east-1` · instance `ec2-user@54.144.25.72`  
**Run by**: worker-11 (pt-devops-infra) — read-only.

### Public health

```bash
$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-08-19T05:03:32.114Z"}

$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
200
```

### AWS — last CodeDeploy / Amplify (read-only)

```bash
$ aws deploy list-deployments --application-name miempresa-app \
    --deployment-group-name miempresa-staging --region us-east-1 \
    --profile disruptive --max-items 3
{
    "deployments": [
        "d-YRWXPRH7L",
        "d-FD0BEVH7L",
        "d-13RWC0Q4L"
    ]
}

$ aws deploy get-deployment --deployment-id d-YRWXPRH7L \
    --region us-east-1 --profile disruptive \
    --query 'deploymentInfo.{id:deploymentId,status:status,createTime:createTime,completeTime:completeTime}'
{
    "id": "d-YRWXPRH7L",
    "status": "Succeeded",
    "createTime": "2026-08-18T07:24:11.474000-05:00",
    "completeTime": "2026-08-18T07:25:18.493000-05:00"
}

$ aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
    --region us-east-1 --profile disruptive --max-items 3
{ "jobId": "16", "status": "SUCCEED", "startTime": "2026-08-18T07:07:47-05:00", ... sourceUrl: s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260818-070742.zip }
{ "jobId": "15", "status": "SUCCEED", "startTime": "2026-08-14T02:04:56-05:00" }
{ "jobId": "14", "status": "SUCCEED", "startTime": "2026-08-06T05:42:40-05:00" }
```

- Last CodeDeploy: `d-YRWXPRH7L` **Succeeded** (2026-08-18 07:24).
  - Note: aug-17 runbook (2026-08-18) reported `d-FD0BEVH7L` as the release ID. `d-YRWXPRH7L` came ~17min later (07:24 vs 07:07) — likely a re-deploy of the same artifact (appspec + mig 29 ships no centro_costos_aug17). Read-only; no rollback needed.
- Last Amplify: job **16** SUCCEED (2026-08-18 07:07).

### Local vs staging migrations

```bash
# local
$ cd backend && npx prisma migrate status
30 migrations found in prisma/migrations
Database schema is up to date!

# staging (on-instance)
$ cd /opt/miempresa/app && npx prisma migrate status
29 migrations found in prisma/migrations
Database schema is up to date!

# staging centro_costos subset
$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%centro_costos%' ORDER BY started_at;"
          migration_name           
-----------------------------------
 20260805000000_centro_costos_ago5
(1 row)
```

- **ago-5 on staging**: ✅ YES (finished `2026-08-06 10:41:21.952137+00`).
- **aug-17 on staging**: ❌ NO (local 30 ≠ staging 29 — the only missing mig is `20260819025302_centro_costos_aug17_qa`).

### L2 — table existence (regclass)

```sql
SELECT to_regclass('public.productos_servicios') AS productos_servicios,
       to_regclass('public.prefacturas')         AS prefacturas,
       to_regclass('public.egresos')             AS egresos,
       to_regclass('public.centros_costos')      AS centros_costos,
       to_regclass('public.centro_costos_items') AS centro_costos_items;
```
Result:
```
 productos_servicios | prefacturas | egresos | centros_costos | centro_costos_items 
---------------------+-------------+---------+----------------+---------------------
                     |             |         | centros_costos | centro_costos_items
(1 row)
```
- `productos_servicios`, `prefacturas`, `egresos`: **NULL** (absent — ago-5 drops already executed). **O1 OK.**
- `centros_costos`, `centro_costos_items`: present.

### L2 — row counts

```sql
SELECT count(*) FROM centros_costos;        -- 11
SELECT count(*) FROM centro_costos_items;  --  5
```
- `centros_costos`: **11 rows** (legacy ago-5 catalog, pre-aug-17 seed).
- `centro_costos_items`: **5 rows** (legacy items from ago-5 window).

### L2 — catalog (Transporte check)

```sql
SELECT centro_id, tipo, nombre, orden FROM centros_costos ORDER BY tipo, orden;
```
Result:
```
 1 | INGRESOS | Mensualidades completas | 1
 2 | INGRESOS | Mensualidades por día   | 2
 3 | INGRESOS | Transporte              | 3     <-- TRANSPORTE EXACT (not yet renamed)
 4 | INGRESOS | Ingresos adicionales    | 4
 5 | INGRESOS | Valoraciones            | 5
 6 | EGRESOS  | Refrigerios             | 6
 7 | EGRESOS  | Aseo                    | 7
 8 | EGRESOS  | Papelería               | 8
 9 | EGRESOS  | Eventos                 | 9
10 | EGRESOS  | Nómina                  | 10
11 | EGRESOS  | Mantenimiento           | 11
```
- `Transporte` exact name **still present** (centro_id=3). aug-17 seed will rename → `Transporte completo` and add 3 nuevos (Mensualidad 3/4 días, Transporte por 3 días) on next boot.

### L2 — column presence (aug-17 features)

```sql
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centros_costos' AND column_name='precio_unitario')   AS has_precio_unitario,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centros_costos' AND column_name='habilitar_recibo')   AS has_habilitar_recibo,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='fecha')          AS has_fecha,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='pagador')        AS has_pagador,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='beneficiario_cliente_id') AS has_beneficiario,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='medio_pago')     AS has_medio_pago;
```
Result: `f|f|f|f|f|f` — **all six aug-17 columns absent** (expected — aug-17 not yet applied).

### L2 — `centros_costos` schema (\d)

```
 centro_id   | integer                        | not null | nextval(...)
 nombre      | character varying(200)         | not null
 tipo        | "TipoCentroCostos"             | not null
 descripcion | text                           |
 activo      | boolean                        | not null | true
 created_at  | timestamp(3) without time zone | not null | CURRENT_TIMESTAMP
 orden       | integer                        | not null | 0
 updated_at  | timestamp(3) without time zone | not null |               <-- present (ago-5 RB-1 OK, deployed 2026-08-06)
```

### L2 — `centro_costos_items` schema (\d)

```
 item_id          | integer            | not null | nextval(...)
 centro_costos_id | integer            | not null
 nombre           | varchar(200)       | not null
 notas            | text               |
 cantidad         | integer            | not null | 1
 valor_unitario   | numeric(15,2)      | not null
 valor_total      | numeric(15,2)      | not null
 periodo          | date               | not null
 numero_factura   | varchar(100)       |
 proveedor        | varchar(200)       |
 fecha_factura    | date               |
 created_at       | timestamp(3)       | not null | CURRENT_TIMESTAMP
 updated_at       | timestamp(3)       | not null
```
- aug-17 columns (`fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`) absent — confirmed.

### R0 answer table

| Question | Answer from evidence |
|---|---|
| Is `20260805000000_centro_costos_ago5` on staging? | **yes** (finished 2026-08-06 10:41:21) |
| If **no** and `centros_costos` rows > 0 | **n/a** — RB-1 STOP does NOT apply |
| If old finance tables exist with rows | **O1 OK** — `productos_servicios`, `prefacturas`, `egresos` all NULL (absent) |
| Is `20260819025302_centro_costos_aug17_qa` on staging? | **no** (expected — that's the deploy target) |
| `Transporte` exact name still present? | **yes** (centro_id=3) — aug-17 seed will rename |
| `fecha` / `precio_unitario` columns present? | **no** / **no** — aug-17 will create |
| Last CodeDeploy | `d-YRWXPRH7L` Succeeded (2026-08-18 07:24) |
| Last Amplify | job 16 SUCCEED (2026-08-18 07:07) |

### Risk gate

**LOW** — ago-5 already applied on staging; aug-17 is **additive only** (3-step `fecha` ADD nullable → UPDATE → SET NOT NULL; defaults on `habilitar_recibo`; new cols on `centro_costos_items`). No drops, no enum changes. RB-1 is historical and already worked (ago-5 deployed 2026-08-06 with 11 rows). O1 OK — old tables already absent.

**RB-1 = ok.** **O1 = ok.** R0 complete.

---

## R1 — backup

On-instance `pg_dump` → `s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz`  
Verify size + sha256 locally **and** on S3. Write the restore one-liner into this file before R4.

### R1 actuals — 2026-08-19 (worker-12, gate 2)

| field | value |
| --- | --- |
| source DB | `miempresa_staging` @ `localhost:5432` (ec2-user@54.144.25.72) |
| dump command | `pg_dump -h localhost -p 5432 -U miempresa -d miempresa_staging --no-owner --no-acl --format=plain \| gzip > "$BACKUP_PATH"` |
| local path | `/opt/miempresa/backups/pre-centro-costos-aug17.sql.gz` |
| S3 URI | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz` |
| bytes | **40943** |
| sha256 | `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd` |
| ETag (md5) | `e2ae26fb56960f341c06e5fd5a77d141` |
| SSE | `AES256` |
| storage class | STANDARD (default; file is 40 KiB) |
| started (UTC) | `2026-08-19T12:46:46Z` |
| uploaded (UTC) | `2026-08-19T12:46:53Z` |
| metadata | `stage=staging, database=miempresa_staging, release=pre-centro-costos-aug17, timestamp=20260819T124651Z` |
| account | `540657241795`, region `us-east-1`, profile `disruptive` (laptop verification only) |

**Two-path sha256 verification**
- Path A — instance (`sha256sum` on local gz):
  `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd  /opt/miempresa/backups/pre-centro-costos-aug17.sql.gz`
- Path B — laptop (`AWS_PROFILE=disruptive aws s3 cp … ; shasum -a 256`):
  `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd  /tmp/pre-centro-costos-aug17.s3.sql.gz`
- Path C — `aws s3api head-object` ContentLength (`40943`) matches both A and B byte counts. **match ✓**

### R1 restore one-liner (do not run yet)

```bash
# Restore into the same staging instance (DB: miempresa_staging).
# Requires stopping the API so connections release before pg_restore runs.
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '
  set -euo pipefail
  pm2 stop miempresa-api
  aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz /tmp/restore.sql.gz --region us-east-1
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query Parameter.Value --output text --region us-east-1)
  gunzip -c /tmp/restore.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
  pm2 start miempresa-api
  rm -f /tmp/restore.sql.gz
'
```

(Captured before R4. Restore is only used on rollback — never auto-invoked.)

---

## R4 — backend

- Zip includes `appspec` at root + **both** centro-costos migration dirs (ago-5 only if not yet on staging; always include aug-17).
- Group **`miempresa-staging` only**.
- After Succeeded: `prisma migrate status` shows **30** (or 29+1) up to date; `\d centro_costos_items` has `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`; `\d centros_costos` has `precio_unitario`, `habilitar_recibo`.
- After `pm2 restart`: GET `/centro-costos` as admin lists **8 INGRESOS** including `Transporte completo`, **no** exact `Transporte`. If still 5 INGRESOS / old name → seed did not run — BLOCKED, do not start R5 as “done”.

### R4 actuals — 2026-08-19 (worker-13, gate 3)

| field | value |
| --- | --- |
| profile / region | `disruptive` / `us-east-1` |
| artifact | `/tmp/miempresa-staging-centro-costos-aug17-20260819-125148.zip` |
| artifact size / sha256 | **340320 B** / `0a38793416b556fcfe5f9c8083fbdf5fd8f6d2f51b8debb08aa298b8a6410890` |
| S3 URI | `s3://miempresa-artifacts-540657241795-staging/miempresa-staging-centro-costos-aug17-20260819-125148.zip` |
| S3 SSE / ETag | AES256 / `b2687356e1515a1718b075edd67eb7ad` |
| zip root contents (verified) | `appspec.yml` + `dist/` + `prisma/migrations/20260819025302_centro_costos_aug17_qa/` + all other migrations |
| CodeDeploy group | `miempresa-staging` (NOT prod) |
| CodeDeploy id | **`d-IUQUHA58L`** |
| CodeDeploy created | `2026-08-19T07:52:03-05:00` |
| CodeDeploy complete | `2026-08-19T07:53:11-05:00` (≈ 67 s) |
| CodeDeploy status | **Succeeded** |
| on-instance migrate status | **30 migrations / up to date** (latest: `20260819025302_centro_costos_aug17_qa`) |
| aug-17 columns | `centros_costos.precio_unitario=t`, `centros_costos.habilitar_recibo=t`; `centro_costos_items.fecha=t`, `pagador=t`, `beneficiario_cliente_id=t`, `medio_pago=t` |
| pm2 process | `miempresa-api` (PID 2788271, online, uptime 71 s) — restarted via `ApplicationStart` hook, **no `pkill`** |
| Catalog post-seed | **8 INGRESOS** + 6 EGRESOS = 14 rows total |
| INGRESOS names | Mensualidades completas · Mensualidad por 4 días · Mensualidad por 3 días · Mensualidades por día · **Transporte completo** · Transporte por 3 días · Ingresos adicionales · Valoraciones |
| `Transporte` exact count | **0** (renamed; aug-17 seed worked) |

---

## R5 — frontend + smoke

`./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile <PROFILE>`

| Check | Expect |
|---|---|
| FE `/centro-costos` ADMIN | 200; centros collapsed; create-centro visible |
| FE `/centro-costos` CONTRATOS | no balance card; no month picker; no create-centro |
| CONTRATOS GET `/centro-costos/balance` | 403 |
| CONTRATOS GET `/items?periodo=1999-01` | 403 |
| CONTRATOS POST `/centro-costos` | 403 |
| ADMIN POST INGRESOS item `fecha=YYYY-MM-DD` | `periodo` = first of that month; `valorUnitario` = centro price |
| Recibo (centro with `habilitarRecibo`) | print page renders pagador / beneficiario / concepto / valor |
| GERONTOLOGA any `/centro-costos` | 403 `DOMAIN_FORBIDDEN` |
| Nómina / empleados / asistencia pages | 200 (no regression) |

### R5 actuals — 2026-08-19 (worker-13, gate 3)

| # | Check | Result |
| --- | --- | --- |
| 1 | Amplify deploy (script) | `…/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive` (NEVER `--stage prod`) |
| 2 | Amplify artifact | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260819-075501.zip` (2.3 MiB) |
| 3 | **Amplify job** | **17** SUCCEED |
| 4 | FE pages 10 routes (`/`, `/login`, `/empleados`, `/nomina`, `/asistencia`, `/centro-costos`, `/actividades`, `/instrumentos`, `/certificados`, `/pacientes`) | **all 200** |
| 5 | API `GET /health` | **200** `{"status":"ok","timestamp":"2026-08-19T12:55:27.210Z"}` |
| 6 | qa-admin `GET /centro-costos` | **200** — 14 rows; INGRESOS=8 (incl. `Transporte completo`); no exact `Transporte` |
| 7 | qa-contratos `GET /centro-costos` | **200** (read OK) |
| 8 | qa-contratos `GET /centro-costos/balance?periodo=2026-08` | **403** `CONTRATOS no tiene acceso al balance del centro de costos` |
| 9 | qa-contratos `GET /centro-costos/items?periodo=1999-01` | **403** `DOMAIN_FORBIDDEN` |
| 10 | qa-contratos `POST /centro-costos` | **403** `CONTRATOS no puede crear centros de costos` |
| 11 | qa-gerontologa `GET /centro-costos` | **403** `DOMAIN_FORBIDDEN` |
| 12 | qa-admin `GET /centro-costos/balance?periodo=2026-08` | **200** `totalIngresos=1,560,000.00 totalEgresos=640,000.00 balance=920,000.00` |
| 13 | (optional) ADMIN PUT `/centro-costos/1` `{precioUnitario:1500000,habilitarRecibo:false}` | **200** |
| 14 | (optional) ADMIN POST item centro 1 `fecha=2026-08-19` pagador=smoke beneficiarioClienteId=1 medioPago=EFECTIVO valorUnitario=1500000 | **201** `item_id=6 periodo=2026-08-01 fecha=2026-08-19 valorUnitario=1500000.00 pagador=smoke beneficiarioClienteId=1 medioPago=EFECTIVO` (fecha→periodo first-of-month derivation works) |

**Staging smoke: PASS**

> **Correction (worker-14, 2026-08-19):** Row #9 above is mislabeled. The matrix cell `CONTRATOS.centro-costos = true` so requireDomain passes; the route-level D14 check returns **403 `field: 'periodo'`** with message `CONTRATOS solo puede consultar el mes actual en curso`. It is **not** `DOMAIN_FORBIDDEN`. The W14 deeper smoke confirms D14 is in effect on staging.

---

### W14 deeper smoke — 2026-08-19 (worker-14, pt-test-quality)

Cover (per assignment): R18, R21, R22, R24, R25, R26, R31, D14, FE pages. Plus RBAC + envelope checks from contract §3/§4.

| # | Check | Result |
|---|---|---|
| R18 | 8 INGRESOS D12 names (orden 1–8); no exact `Transporte`; 6 EGRESOS (orden 9–14) | **PASS** |
| R21 | CONTRATOS POST/PUT/DELETE `/centro-costos` 403 (route-level, no DOMAIN_FORBIDDEN) | **PASS** (3×403) |
| R22 | CONTRATOS `/balance?periodo=2026-08` 403 (route-level) | **PASS** |
| R22 | CONTRATOS `/items?periodo=1999-01` 403 `field=periodo` (D14 route-level) | **PASS** |
| R24 | ADMIN POST EGRESOS `{fecha: 2026-08-19, valorUnitario:42}` → stored `periodo=2026-08-01 fecha=2026-08-19`; DELETE → 204 | **PASS** |
| R25 | INGRESOS missing `pagador` → 400 `field=pagador` | **PASS** |
| R26 | Unpriced INGRESOS centro (id=6965) → 400 `field=precioUnitario` | **PASS** |
| R31 | `GET /items/:id` returns `{id, ..., centro:{id,...}, beneficiario:{id,nombre}|null}` | **PASS** |
| R31 | CONTRATOS GET historical ítem (fecha 1999-01-15) → 403 `field=fecha` | **PASS** |
| D14 | CONTRATOS GET current-month ítem → 200; PUT → 200 | **PASS** |
| RBAC | GERONTOLOGA → 403 `DOMAIN_FORBIDDEN` on root + `?tipo=INGRESOS` + `/balance` + `/items?periodo=` | **PASS** (4×403) |
| RBAC | CONTRATOS root GET (matrix:true) → 200 | **PASS** |
| Envelope | `/balance` has all expected fields; `balance = totalIngresos − totalEgresos`; empty month (2099-12) → 200 zeros, not 404 | **PASS** |
| Envelope | `/balance` missing `periodo` → 400 `field=periodo` | **PASS** |
| Envelope | POST `/:id/items` missing `fecha` → 400 `field=fecha` | **PASS** |
| FE | `/centro-costos` 200; `/login` 200; regression `/empleados` `/nomina` `/asistencia` `/pacientes` `/` all 200 | **PASS** (7×200) |

**Total: 46 PASS / 0 FAIL / 0 SKIP.** No new gaps. Cleanup: 3 ítems created+deleted in-script, DB state unchanged.

---

## Rollback (pre-stage, never auto)

- Backend: redeploy prior successful CodeDeploy (`d-FD0BEVH7L` until this release replaces it).  
- Frontend: prior Amplify job 16.  
- Data: restore `pre-centro-costos-aug17.sql.gz` **only if** migrate deploy left a bad schema.  
- Additive #30 columns can stay if you only roll back the app; dropping them is optional and not required for rollback.

---

## Issues / mitigations

| ID | Issue | Mitigation |
|---|---|---|
| RB-1 | `updated_at` NOT NULL no default in ago-5 | R0: if unapplied and rows>0, patch unapplied SQL or STOP |
| O1 | Staging finance table counts never taken | L2 queries in R0; if tables exist with rows, STOP |
| Seed-not-SQL | Catalog rename/insert only on boot | R4 post-restart SELECT; fail the phase if names wrong |
| Half-migrate | DROP then failing ALTER | Only relevant if ago-5 still pending; restore from R1 |
| Dirty tree | Working-tree zip ships unrelated files | Same precedent as aug-6 / aug-17; list extra paths in R0 |

---

## Grep hooks

```
centro-costos-aug17 staging-release RB-1 O1
20260805000000_centro_costos_ago5 updated_at NOT NULL
20260819025302_centro_costos_aug17_qa fecha 3-step
Transporte completo seedCentrosCostos
d-IUQUHA58L amplify-job-17 30-migrations 8-INGRESOS
pre-centro-costos-aug17.sql.gz
```
