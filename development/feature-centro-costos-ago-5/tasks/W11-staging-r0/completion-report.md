# W11 Staging R0 — Completion Report

**Worker**: worker-11 (pt-devops-infra)  
**TaskList ID**: 8  
**Phase**: R0 (read-only preflight)  
**Date**: 2026-08-19 (UTC)  
**Profile**: `disruptive` · region `us-east-1`  
**Instance**: `ec2-user@54.144.25.72`  
**Status**: 🟢 R0 COMPLETE — `CHECKPOINT` sent, awaiting PROCEED R1.

---

## Acceptance criteria

| # | Criterion | Evidence | Verdict |
|---|---|---|---|
| 1 | API health curl R0 | `{"status":"ok","timestamp":"2026-08-19T05:03:32.114Z"}` | ✅ VERIFIED |
| 2 | FE HTTP code R0 | `200` | ✅ VERIFIED |
| 3 | Last 3 CodeDeploy staging | `d-YRWXPRH7L / d-FD0BEVH7L / d-13RWC0Q4L` (all staging; never `*prod*`) | ✅ VERIFIED |
| 4 | Latest CodeDeploy status | `d-YRWXPRH7L` Succeeded (2026-08-18 07:24:11 → 07:25:18) | ✅ VERIFIED |
| 5 | Last 3 Amplify jobs | `16 / 15 / 14` — all `SUCCEED` | ✅ VERIFIED |
| 6 | `npx prisma migrate status` local | **30** migrations, up to date | ✅ VERIFIED |
| 7 | `npx prisma migrate status` staging (on-instance) | **29** migrations, up to date | ✅ VERIFIED |
| 8 | `20260805000000_centro_costos_ago5` on staging | **YES** (finished `2026-08-06 10:41:21.952137+00`) | ✅ VERIFIED |
| 9 | `20260819025302_centro_costos_aug17_qa` on staging | **NO** (expected — that's the deploy target) | ✅ VERIFIED |
| 10 | `centros_costos` row count | **11** | ✅ VERIFIED |
| 11 | `centro_costos_items` row count | **5** | ✅ VERIFIED |
| 12 | Old finance tables (`productos_servicios`, `prefacturas`, `egresos`) | All `NULL` (absent — ago-5 drops already ran) | ✅ VERIFIED — O1 OK |
| 13 | `Transporte` exact name present | **YES** (centro_id=3) — aug-17 seed will rename to `Transporte completo` | ✅ VERIFIED |
| 14 | `fecha` column on `centro_costos_items` | **NO** (aug-17 will create) | ✅ VERIFIED |
| 15 | `precio_unitario` column on `centros_costos` | **NO** (aug-17 will create) | ✅ VERIFIED |
| 16 | `habilitar_recibo` column on `centros_costos` | **NO** (aug-17 will create) | ✅ VERIFIED |
| 17 | `pagador`, `beneficiario_cliente_id`, `medio_pago` on `centro_costos_items` | All **NO** (aug-17 will create) | ✅ VERIFIED |
| 18 | `updated_at` on `centros_costos` | **YES** (ago-5 added RB-1 column; deployed 2026-08-06 with 11 rows — proves ago-5 succeeded) | ✅ VERIFIED |
| 19 | RB-1 STOP condition | **NOT TRIGGERED** — ago-5 already applied, no pending DROP+ALTER path | ✅ VERIFIED |
| 20 | O1 STOP condition | **NOT TRIGGERED** — old tables absent | ✅ VERIFIED |
| 21 | R0 actuals written into runbook | `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R0 actuals | ✅ VERIFIED |
| 22 | Zero write operations | No `put`, `create`, `deploy`, `migrate deploy`, `pg_dump`, S3 upload, S3 put, SSM put, CloudFormation, `pm2 restart`. All commands were `read-only` (`curl`, `describe`, `list`, `get`, `SELECT`). | ✅ VERIFIED |
| 23 | Never `miempresa-prod` | All AWS commands targeted `--deployment-group-name miempresa-staging` only; never any `*prod*` group. | ✅ VERIFIED |
| 24 | Never `pkill` / `prisma migrate diff --shadow-database-url` | Not invoked. | ✅ VERIFIED |

---

## Verbatim command output

### Public health

```bash
$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-08-19T05:03:32.114Z"}

$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
200
```

### AWS read-only — `disruptive` / `us-east-1`

```bash
$ aws deploy list-deployments --application-name miempresa-app \
    --deployment-group-name miempresa-staging --region us-east-1 \
    --profile disruptive --max-items 3
{
    "deployments": [
        "d-YRWXPRH7L",
        "d-FD0BEVH7L",
        "d-13RWC0Q4L"
    ],
    "NextToken": "eyJuZXh0VG9rZW4iOiBudWxsLCAiYm90b190cnVuY2F0ZV9hbW91bnQiOiAzfQ=="
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
{
    "jobSummaries": [
        {
            "jobArn": "arn:aws:amplify:us-east-1:540657241795:apps/d1nsxjyualdzdu/branches/staging/jobs/0000000016",
            "jobId": "16",
            "startTime": "2026-08-18T07:07:47.058000-05:00",
            "status": "SUCCEED",
            "endTime": "2026-08-18T07:07:55.606000-05:00",
            "sourceUrl": "s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260818-070742.zip",
            "sourceUrlType": "ZIP"
        },
        {
            "jobArn": "arn:aws:amplify:us-east-1:540657241795:apps/d1nsxjyualdzdu/branches/staging/jobs/0000000015",
            "jobId": "15",
            "startTime": "2026-08-14T02:04:56.297000-05:00",
            "status": "SUCCEED",
            "endTime": "2026-08-14T02:05:05.127000-05:00",
            "sourceUrl": "s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260814-020451.zip",
            "sourceUrlType": "ZIP"
        },
        {
            "jobArn": "arn:aws:amplify:us-east-1:540657241795:apps/d1nsxjyualdzdu/branches/staging/jobs/0000000014",
            "jobId": "14",
            "startTime": "2026-08-06T05:42:40.590000-05:00",
            "status": "SUCCEED",
            "endTime": "2026-08-06T05:42:49.293000-05:00",
            "sourceUrl": "s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260806-054237.zip",
            "sourceUrlType": "ZIP"
        }
    ]
}
```

### Local migrations (backend/)

```bash
$ npx prisma migrate status
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "miempresa_dev", schema "public" at "localhost:15432"

30 migrations found in prisma/migrations

Database schema is up to date!

$ ls prisma/migrations/ | grep -E 'centro_costos'
20260805000000_centro_costos_ago5
20260819025302_centro_costos_aug17_qa
```

### Staging on-instance — SSH `ec2-user@54.144.25.72`

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 \
    'cd /opt/miempresa/app && npx prisma migrate status'
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7.
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "miempresa_staging", schema "public" at "localhost:5432"

29 migrations found in prisma/migrations

Database schema is up to date!
```

### Staging — L2 SQL via SSH + local psql

```bash
$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;"
... 29 rows ...
 20260803022244_add_empleado_eps_fondo_arl                | 2026-08-04 22:38:35.515631+00
 20260804165919_add_empleado_bloqueado                    | 2026-08-04 22:38:35.540111+00
 20260805000000_centro_costos_ago5                        | 2026-08-06 10:41:21.952137+00
 20260806035159_add_tipoempleado_profesores_auxiliares    | 2026-08-06 10:41:21.963228+00
 20260818113726_add_nomina_bonos_and_registro_actividades | 2026-08-18 12:06:30.270169+00
(29 rows)

$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT migration_name FROM _prisma_migrations WHERE migration_name LIKE '%centro_costos%' ORDER BY started_at;"
          migration_name           
-----------------------------------
 20260805000000_centro_costos_ago5
(1 row)

$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT to_regclass('public.productos_servicios') AS productos_servicios, to_regclass('public.prefacturas') AS prefacturas, to_regclass('public.egresos') AS egresos, to_regclass('public.centros_costos') AS centros_costos, to_regclass('public.centro_costos_items') AS centro_costos_items;"
 productos_servicios | prefacturas | egresos | centros_costos | centro_costos_items 
---------------------+-------------+---------+----------------+---------------------
                     |             |         | centros_costos | centro_costos_items
(1 row)

$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT count(*) AS centros_costos_count FROM centros_costos;" \
    -c "SELECT count(*) AS centro_costos_items_count FROM centro_costos_items;"
 centros_costos_count 
----------------------
                   11
(1 row)

 centro_costos_items_count 
---------------------------
                         5
(1 row)

$ psql -h localhost -U miempresa -d miempresa_staging \
    -c "SELECT centro_id, tipo, nombre, orden FROM centros_costos ORDER BY tipo, orden;"
 centro_id |   tipo   |         nombre          | orden 
-----------+----------+-------------------------+-------
         1 | INGRESOS | Mensualidades completas |     1
         2 | INGRESOS | Mensualidades por día   |     2
         3 | INGRESOS | Transporte              |     3
         4 | INGRESOS | Ingresos adicionales    |     4
         5 | INGRESOS | Valoraciones            |     5
         6 | EGRESOS  | Refrigerios             |     6
         7 | EGRESOS  | Aseo                    |     7
         8 | EGRESOS  | Papelería               |     8
         9 | EGRESOS  | Eventos                 |     9
        10 | EGRESOS  | Nómina                  |    10
        11 | EGRESOS  | Mantenimiento           |    11
(11 rows)

$ psql -h localhost -U miempresa -d miempresa_staging -tA \
    -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centros_costos' AND column_name='precio_unitario'), EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centros_costos' AND column_name='habilitar_recibo'), EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='fecha'), EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='pagador'), EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='beneficiario_cliente_id'), EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='centro_costos_items' AND column_name='medio_pago');"
f|f|f|f|f|f

$ psql -h localhost -U miempresa -d miempresa_staging -c "\d centros_costos"
                                              Table "public.centros_costos"
   Column    |              Type              | Collation | Nullable |                      Default                       
-------------+--------------------------------+-----------+----------+---------------------------------------------------
 centro_id   | integer                        |           | not null | nextval('centros_costos_centro_id_seq'::regclass)
 nombre      | character varying(200)         |           | not null | 
 tipo        | "TipoCentroCostos"             |           | not null | 
 descripcion | text                           |           |          | 
 activo      | boolean                        |           | not null | true
 created_at  | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP
 orden       | integer                        |           | not null | 0
 updated_at  | timestamp(3) without time zone |           | not null | 
Indexes:
    "centros_costos_pkey" PRIMARY KEY, btree (centro_id)
    "centros_costos_tipo_activo_idx" btree (tipo, activo)
    "centros_costos_tipo_nombre_key" UNIQUE, btree (tipo, nombre)
Referenced by:
    TABLE "centro_costos_items" CONSTRAINT "centro_costos_items_centro_costos_id_fkey" FOREIGN KEY (centro_costos_id) REFERENCES centros_costos(centro_id) ON UPDATE CASCADE ON DELETE RESTRICT

$ psql -h localhost -U miempresa -d miempresa_staging -c "\d centro_costos_items"
                                               Table "public.centro_costos_items"
      Column      |              Type              | Collation | Nullable |                       Default                        
------------------+--------------------------------+-----------+----------+------------------------------------------------------
 item_id          | integer                        |           | not null | nextval('centro_costos_items_item_id_seq'::regclass)
 centro_costos_id | integer                        |           | not null | 
 nombre           | character varying(200)         |           | not null | 
 notas            | text                           |           |          | 
 cantidad         | integer                        |           | not null | 1
 valor_unitario   | numeric(15,2)                  |           | not null | 
 valor_total      | numeric(15,2)                  |           | not null | 
 periodo          | date                           |           | not null | 
 numero_factura   | character varying(100)         |           |          | 
 proveedor        | character varying(200)         |           |          | 
 fecha_factura    | date                           |           |          | 
 created_at       | timestamp(3) without time zone |           | not null | CURRENT_TIMESTAMP
 updated_at       | timestamp(3) without time zone |           | not null | 
Indexes:
    "centro_costos_items_pkey" PRIMARY KEY, btree (item_id)
    "centro_costos_items_centro_costos_id_periodo_idx" btree (centro_costos_id, periodo)
    "centro_costos_items_periodo_idx" btree (periodo)
Foreign-key constraints:
    "centro_costos_items_centro_costos_id_fkey" FOREIGN KEY (centro_costos_id) REFERENCES centros_costos(centro_id) ON UPDATE CASCADE ON DELETE RESTRICT
```

---

## Risk gate result

**Risk: LOW**

- `20260805000000_centro_costos_ago5` is **already applied** on staging (finished 2026-08-06 10:41:21 UTC). RB-1 was the historical known risk; it has already worked in production: 11 rows in `centros_costos` post-deploy with `updated_at NOT NULL` present.
- `20260819025302_centro_costos_aug17_qa` is **additive only**:
  - 3-step `fecha` ADD nullable → UPDATE → SET NOT NULL.
  - `precio_unitario` and `habilitar_recibo` on `centros_costos` with defaults.
  - `pagador`, `beneficiario_cliente_id`, `medio_pago` on `centro_costos_items` (nullable).
  - No drops, no enum changes.
- Old finance tables (`productos_servicios`, `prefacturas`, `egresos`) **absent** (ago-5 already ran). O1 OK.
- `Transporte` exact name still present (centro_id=3). aug-17 seed on boot will rename → `Transporte completo` and add 3 new centros (Mensualidad 3/4 días, Transporte por 3 días). This is non-destructive (UPDATE + skipDuplicates INSERT).

**RB-1**: ok (ago-5 already applied).  
**O1**: ok (old tables absent).

---

## Frontend / backend sync — observations

- **Last CodeDeploy** `d-YRWXPRH7L` Succeeded 2026-08-18 07:25 (after the aug-17 release `d-FD0BEVH7L` at 07:25-07:24). The 17-minute delta suggests a re-deploy of the same artifact; no centro_costos_aug17_qa migration included. **No rollback needed; just observed.**
- **Last Amplify** job 16 SUCCEED 2026-08-18 07:07 (matches the aug-17 runbook).
- FE bundle on staging UI today is the post-aug-17 build (job 16) — accordion/ingreso dialog/recibo link present, but the catalog the API returns still has 11 INGRESOS rows with `Transporte` exact name because the aug-17 backend migration + seed hasn't run yet. **This is the expected pre-deploy state.** R4 (CodeDeploy) will land `20260819025302_centro_costos_aug17_qa` + restart pm2 + seed; R5 will then re-verify.

---

## Forward commands (NOT executed — R0 only)

R1 (pg_dump → S3) → R4 (CodeDeploy miempresa-staging + `migrate deploy`) → R5 (Amplify + smoke). Each requires `PROCEED PHASE R{n}` from team-lead via the developer.

---

## Files written

- `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` — updated header (T9–T13 done local) + new §R0 actuals (the verbatim block above).
- `development/feature-centro-costos-ago-5/tasks/W11-staging-r0/completion-report.md` — this file.
