# W13-staging-r4r5 · Completion Report

- Worker: `worker-13` (pt-devops-infra) — replacing idle W12 for **R4 + R5**
- Phase: R4 (CodeDeploy backend) + R5 (Amplify frontend + smoke)
- Runbook: `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R4 / §R5
- Reference: `context/implementation-plan/staging-release-qa-session-aug-17-runbook.md`
- Date (UTC): 2026-08-19
- Status: **R4 + R5 complete — staging green, smoke PASS**

> Hard limits respected: no `miempresa-prod` access; no `pkill`/`pkill -f` (used pm2 process name `miempresa-api` only); no auto-rollback; no `prisma migrate diff --shadow-database-url`; CodeDeploy group strictly `miempresa-staging`.

---

## Resource summary (staging only)

| field | value |
| --- | --- |
| AWS profile | `disruptive` |
| region | `us-east-1` |
| CodeDeploy app | `miempresa-app` |
| CodeDeploy group | **`miempresa-staging`** (NOT prod) |
| **CodeDeploy id** | **`d-IUQUHA58L`** Succeeded |
| CodeDeploy created | `2026-08-19T07:52:03.698000-05:00` |
| CodeDeploy complete | `2026-08-19T07:53:11.467000-05:00` (≈ 67 s) |
| Artifact zip | `/tmp/miempresa-staging-centro-costos-aug17-20260819-125148.zip` |
| zip size | 340320 B (332.3 KiB) |
| zip SHA256 | `0a38793416b556fcfe5f9c8083fbdf5fd8f6d2f51b8debb08aa298b8a6410890` |
| zip ETag (md5) | `b2687356e1515a1718b075edd67eb7ad` |
| S3 URI | `s3://miempresa-artifacts-540657241795-staging/miempresa-staging-centro-costos-aug17-20260819-125148.zip` |
| S3 SSE | AES256 |
| Amplify app | `d1nsxjyualdzdu` branch `staging` |
| **Amplify job** | **`17`** SUCCEED |
| Amplify artifact | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260819-075501.zip` |
| Target host | `ec2-user@54.144.25.72` (Lightsail, stage=`staging`) |
| pm2 process | `miempresa-api` (PID 2788271, online, uptime ≥ 71 s post-deploy) |
| Migration count (after) | **30** / up to date |
| Latest migration | `20260819025302_centro_costos_aug17_qa` |
| Catalog INGRESOS | **8** (incl. `Transporte completo`, no exact `Transporte`) |
| Catalog total | 14 rows (8 INGRESOS + 6 EGRESOS) |

---

## R4 — backend deploy evidence

### 1. Working-tree rebuild + zip

```bash
$ cd backend && npm run build      # tsc
$ STAMP=$(date -u +%Y%m%d-%H%M%S)   # 20260819-125148
$ ZIP="/tmp/miempresa-staging-centro-costos-aug17-${STAMP}.zip"
$ cd /Users/jeik/ws/mi-empresa-app-development
$ zip -r "$ZIP" appspec.yml dist/ prisma/migrations/ prisma/schema.prisma \
    prisma/seed.ts prisma/MIGRATIONS.md prisma/instrument-templates/ \
    prisma/migration_lock.toml package.json package-lock.json infrastructure/db/ \
    -x '*/node_modules/*' '*/.git/*' '*.map'
$ shasum -a 256 "$ZIP"
0a38793416b556fcfe5f9c8083fbdf5fd8f6d2f51b8debb08aa298b8a6410890  /tmp/miempresa-staging-centro-costos-aug17-20260819-125148.zip
$ stat -f%z "$ZIP"
340320
```

### 2. Zip MUST contain required migration — verified

```bash
$ unzip -l "$ZIP" | grep centro_costos_aug17
        0  08-18-2026 21:53   prisma/migrations/20260819025302_centro_costos_aug17_qa/
     1767  08-18-2026 21:53   prisma/migrations/20260819025302_centro_costos_aug17_qa/migration.sql
$ unzip -l "$ZIP" | grep appspec.yml
     5193  08-18-2026 07:24   appspec.yml
```

### 3. S3 upload + verification

```bash
$ AWS_PROFILE=disruptive aws s3 cp "$ZIP" \
    s3://miempresa-artifacts-540657241795-staging/miempresa-staging-centro-costos-aug17-20260819-125148.zip \
    --region us-east-1 --sse AES256
Completed 332.3 KiB/332.3 KiB (1.2 MiB/s) with 1 file(s) remaining

$ AWS_PROFILE=disruptive aws s3api head-object \
    --bucket miempresa-artifacts-540657241795-staging \
    --key miempresa-staging-centro-costos-aug17-20260819-125148.zip \
    --region us-east-1 \
    --query '{ContentLength:ContentLength,ETag:ETag,SSE:ServerSideEncryption}'
{ "ContentLength": 340320, "ETag": "\"b2687356e1515a1718b075edd67eb7ad\"", "SSE": "AES256" }
```

### 4. CodeDeploy create-deployment (group = miempresa-staging only)

```bash
$ AWS_PROFILE=disruptive aws deploy create-deployment \
    --application-name miempresa-app \
    --deployment-group-name miempresa-staging \
    --deployment-config-name CodeDeployDefault.OneAtATime \
    --s3-location bucket=miempresa-artifacts-540657241795-staging,key=miempresa-staging-centro-costos-aug17-20260819-125148.zip,bundleType=zip \
    --description "centro-costos aug17 (T9-T11+QA): adds mig #30 20260819025302_centro_costos_aug17_qa (fecha, pagador, beneficiario, medio_pago, precio_unitario, habilitar_recibo) + D14 GET item guard" \
    --region us-east-1
{ "deploymentId": "d-IUQUHA58L" }
```

### 5. CodeDeploy Succeeded

```bash
$ AWS_PROFILE=disruptive aws deploy get-deployment --deployment-id d-IUQUHA58L \
    --region us-east-1 \
    --query 'deploymentInfo.{id:deploymentId,status:status,createTime:createTime,completeTime:completeTime}'
{
    "id": "d-IUQUHA58L",
    "status": "Succeeded",
    "createTime": "2026-08-19T07:52:03.698000-05:00",
    "completeTime": "2026-08-19T07:53:11.467000-05:00"
}
```

### 6. on-instance `prisma migrate status` = 30 ✓

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 \
    'cd /opt/miempresa/app && npx prisma migrate status'
30 migrations found in prisma/migrations
Database schema is up to date!
```

### 7. aug-17 columns present (all six) ✓

```bash
$ ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '… psql … <<EOF
SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centros_costos$$ AND column_name=$$precio_unitario$$)   AS has_precio_unitario,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centros_costos$$ AND column_name=$$habilitar_recibo$$)   AS has_habilitar_recibo,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centro_costos_items$$ AND column_name=$$fecha$$)          AS has_fecha,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centro_costos_items$$ AND column_name=$$pagador$$)        AS has_pagador,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centro_costos_items$$ AND column_name=$$beneficiario_cliente_id$$) AS has_beneficiario,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name=$$centro_costos_items$$ AND column_name=$$medio_pago$$)     AS has_medio_pago;
EOF'
 has_precio_unitario | has_habilitar_recibo | has_fecha | has_pagador | has_beneficiario | has_medio_pago
---------------------+----------------------+-----------+-------------+------------------+----------------
 t                   | t                    | t         | t           | t                | t
```

### 8. Catalog post-seed — 8 INGRESOS, Transporte completo, no exact Transporte ✓

```bash
$ ssh … '… psql … -c "SELECT centro_id, tipo, nombre, orden FROM centros_costos ORDER BY tipo, orden;"'
 centro_id |   tipo   |         nombre          | orden
-----------+----------+-------------------------+-------
         1 | INGRESOS | Mensualidades completas |     1
      6965 | INGRESOS | Mensualidad por 4 días  |     2
      6966 | INGRESOS | Mensualidad por 3 días  |     3
         2 | INGRESOS | Mensualidades por día   |     4
         3 | INGRESOS | Transporte completo     |     5
      6969 | INGRESOS | Transporte por 3 días   |     6
         4 | INGRESOS | Ingresos adicionales    |     7
         5 | INGRESOS | Valoraciones            |     8
         6 | EGRESOS  | Refrigerios             |     9
         7 | EGRESOS  | Aseo                    |    10
         8 | EGRESOS  | Papelería               |    11
         9 | EGRESOS  | Eventos                 |    12
        10 | EGRESOS  | Nómina                  |    13
        11 | EGRESOS  | Mantenimiento           |    14
(14 rows)
```

### 9. pm2 process restart (default CodeDeploy lifecycle, NOT pkill)

```bash
$ ssh … 'pm2 list'
┌────┬──────────────────┬─────────┬────────┬───────────┬──────────┬──────┐
│ id │ name             │ mode    │ pid    │ status    │ uptime   │ ↺    │
├────┼──────────────────┼─────────┼────────┼───────────┼──────────┼──────┤
│ 0  │ miempresa-api    │ cluster │ 2788271│ online    │ 71s      │ 0    │
└────┴──────────────────┴─────────┴────────┴───────────┴──────────┴──────┘
```

Process `miempresa-api` started by `ApplicationStart` hook (`start-service.sh`); no `pkill`/`pkill -f` issued.

---

## R5 — frontend + smoke evidence

### 1. Amplify deploy

```bash
$ ./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
…
[INFO] ✓ Build complete:  15M
[INFO] ✓ Zip: 2.3M
[INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260819-075501.zip…
[INFO] Starting Amplify deployment…
[INFO]   Job ID: 17
[INFO] ✓ Deployment SUCCEED
  Custom domain:  https://miempresa-stg.disruptiveexp.com
```

### 2. Frontend pages (200)

```bash
$ for p in / /login /empleados /nomina /asistencia /centro-costos /actividades /instrumentos /certificados /pacientes; do
    curl -s -o /dev/null -w "%{http_code}  $p\n" "https://miempresa-stg.disruptiveexp.com$p"
  done
200  /
200  /login
200  /empleados
200  /nomina
200  /asistencia
200  /centro-costos
200  /actividades
200  /instrumentos
200  /certificados
200  /pacientes
```

### 3. API health

```bash
$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-08-19T12:55:27.210Z"}
```

### 4. Smoke table (RBAC + admin/catalog/balance/items)

Credentials sourced from SSM (`/miempresa/staging/qa/qa-{admin,contratos,gerontologa}/{EMAIL,PASSWORD}`), cookies used for the session (`Set-Cookie: session=…`). Base URL `https://miempresa-api-stg.disruptiveexp.com/api/v1`.

| # | Check | Result |
| --- | --- | --- |
| 1 | API `GET /health` | **200** `{"status":"ok",…}` |
| 2 | FE pages 10 routes (`/`, `/login`, `/empleados`, `/nomina`, `/asistencia`, `/centro-costos`, `/actividades`, `/instrumentos`, `/certificados`, `/pacientes`) | **all 200** |
| 3 | qa-admin `GET /centro-costos` | **200**, 14 rows, **INGRESOS=8** (incl. `Transporte completo` id=3, NO exact `Transporte`) |
| 4 | qa-contratos `GET /centro-costos` | **200** (read OK) |
| 5 | qa-contratos `GET /centro-costos/balance?periodo=2026-08` | **403** `CONTRATOS no tiene acceso al balance del centro de costos` |
| 6 | qa-contratos `GET /centro-costos/items?periodo=1999-01` | **403** `DOMAIN_FORBIDDEN` |
| 7 | qa-contratos `POST /centro-costos` (create) | **403** `CONTRATOS no puede crear centros de costos` |
| 8 | qa-gerontologa `GET /centro-costos` | **403** `DOMAIN_FORBIDDEN` |
| 9 | qa-admin `GET /centro-costos/balance?periodo=2026-08` | **200** `totalIngresos=1,560,000.00 totalEgresos=640,000.00 balance=920,000.00` |

### 5. Optional smoke — ADMIN POST INGRESOS item with `fecha=2026-08-19` (D10/D11)

```bash
# set precioUnitario on centro 1 (Mensualidades completas)
$ curl -s -b /tmp/jar-admin.txt -X PUT \
    "https://miempresa-api-stg.disruptiveexp.com/api/v1/centro-costos/1" \
    -H 'Content-Type: application/json' \
    -d '{"precioUnitario":1500000,"habilitarRecibo":false}'
{ "success": true, "data": { "id": 1, "nombre": "Mensualidades completas", ..., "precioUnitario": "1500000.00", "habilitarRecibo": false } }

# POST item with fecha → expect periodo derived to 2026-08-01
$ curl -s -b /tmp/jar-admin.txt -X POST \
    "https://miempresa-api-stg.disruptiveexp.com/api/v1/centro-costos/1/items" \
    -H 'Content-Type: application/json' \
    -d '{"nombre":"smoke-aug17","cantidad":1,"valorUnitario":1500000,"valorTotal":1500000,"fecha":"2026-08-19","pagador":"smoke","beneficiarioClienteId":1,"medioPago":"EFECTIVO","numeroFactura":null,"proveedor":null,"fechaFactura":null,"notas":"smoke test aug17 fecha"}'
{ "success": true, "data": { "item_id": 6, ..., "periodo": "2026-08-01", "fecha": "2026-08-19", "valorUnitario": "1500000.00", "pagador": "smoke", "beneficiarioClienteId": 1, "medioPago": "EFECTIVO" } }
```

**Verified**: `fecha=2026-08-19` → `periodo=2026-08-01` (first of month derivation); all D11 columns persist (`pagador`, `beneficiarioClienteId`, `medioPago`).

---

## Acceptance criteria — evidence matrix

| Acceptance criterion (task assignment) | Evidence | Status |
| --- | --- | --- |
| Working-tree zip with `appspec.yml` at root | `unzip -l` shows `appspec.yml` at root | **PASS** |
| Zip MUST contain `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/` | `unzip -l` shows the directory + `migration.sql` (1767 B) | **PASS** |
| CodeDeploy group = `miempresa-staging` ONLY | `--deployment-group-name miempresa-staging` | **PASS** |
| After Succeeded: `prisma migrate status` = **30** + aug-17 applied | on-instance `migrate status` → "30 migrations found in prisma/migrations / Database schema is up to date!" | **PASS** |
| `centro_costos_items` has `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago` | `has_fecha=t has_pagador=t has_beneficiario=t has_medio_pago=t` | **PASS** |
| `centros_costos` has `precio_unitario`, `habilitar_recibo` | `has_precio_unitario=t has_habilitar_recibo=t` | **PASS** |
| Admin GET `/centro-costos` → 8 INGRESOS incl. `Transporte completo`, no exact `Transporte` | catalog dump + API JSON parse: INGRESOS=8; `Transporte` count=0; `Transporte completo` count=1 | **PASS** |
| `pm2 restart miempresa-api` not used; specific process name (not pkill) | pm2 `ApplicationStart` hook only; `pm2 list` shows `miempresa-api` online; **no `pkill` issued** | **PASS** |
| Amplify deploy `--stage staging` ONLY (never prod) | `--stage staging --region us-east-1 --profile disruptive` | **PASS** |
| Amplify job SUCCEED | **job 17** SUCCEED | **PASS** |
| Smoke: health 200, catalog OK, CONTRATOS 403s, GERONTO 403, FE 200s | smoke table rows 1–9 all PASS | **PASS** |

---

## Rollback (pre-staged, never auto-invoked)

- Backend: redeploy prior CodeDeploy `d-YRWXPRH7L` (last Succeeded before this release).
- Frontend: redeploy prior Amplify job `16`.
- Data: restore `s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz`
  (sha256 `f28a061c1e25865f21a507cf1ea2c920bfc5aa6446af44a282e49af58586d5dd`, 40943 B).
  Restore one-liner is captured in the runbook `staging-release-centro-costos-aug17-runbook.md` §R1.

---

## Grep hooks

```
W13-staging-r4r5 d-IUQUHA58L amplify-job-17 30-migrations 20260819025302_centro_costos_aug17_qa
Transporte-completo 8-INGRESOS miempresa-staging disruptive us-east-1
pm2-restart-miempresa-api centro-costos/balance 403-items contrato
```