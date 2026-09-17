# Staging Release Runbook — Actividades list: empleado name + cargo (sep-8)

**Status**: R0 + R1 + R4 + R5 + QA COMPLETE 2026-09-08 — CodeDeploy `d-FC043YNLL` / Amplify job 24 / 32 migrations (unchanged) / QA PASS.  
**Never** target `miempresa-prod`.

**Commit shipped**: `935fe1d` ("sep-8: actividades list shows empleado name and cargo."). On `main`, not pushed to remote.

---

## What this release ships

| Layer | Artifact |
|---|---|
| Migration | **None.** Display fields only. |
| Backend | `actividadService.ts` — GET/POST/PUT `/actividades` add `empleadoNombre` + `empleadoCargo` (active contrato `CargoEmpresa.nombre`, else latest legacy `Cargo.nombreCargo`). `empleadoId` stays on the API for ACL. |
| Frontend | `actividades/index.vue` — columns Empleado (name) and Cargo. `#empleadoId` removed from the table. |
| Tests | `registro-actividades-acl.spec.ts` 9/9; mocked FE R6 6/6. |

**Not in this release**: schema, RBAC, prod.

**Working-tree zip** still includes other dirty ride-alongs (same convention as the telefono recibo release). Commit is scoped to the 6 actividades files.

---

## Account / targets (staging only)

| Item | Value |
|---|---|
| Profile / region | `disruptive` / `us-east-1` |
| Instance | `miempresa-backend-staging` @ `54.144.25.72` |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Amplify | `d1nsxjyualdzdu` branch `staging` |
| Backups | `miempresa-backups-540657241795-staging` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` |

**NOT in scope**: group `miempresa-prod`.

---

## R0 — actuals (2026-09-08)

```
GET /api/v1/health → 200 {"status":"ok"}
FE / → 200
prior CodeDeploy: d-MRURUYMLL, d-3IBR2MMHL, d-FZP4YFCEL
prior Amplify: job 23 SUCCEED, 22 SUCCEED, 21 SUCCEED
on-instance migrate: 32 / up to date
```

**Risk gate: LOW.** Zero migration. Additive DTO fields + two table columns. No route/permission change.

---

## R1 — backup (actuals)

| field | value |
|---|---|
| dump | `pg_dump -h localhost -p 5432 -U miempresa -d miempresa_staging --no-owner --no-acl --format=plain \| gzip` |
| local path | `/opt/miempresa/backups/pre-actividades-name-cargo.sql.gz` |
| S3 URI | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-actividades-name-cargo.sql.gz` |
| bytes | **52075** (local and S3 `ContentLength` match) |
| sha256 | `bd56ae82c295501cf7e7d7a49b743f566df3b4718a7fb1fc10bc6912cfa2e705` |
| SSE | AES256 |

Restore: same pattern as `pre-empresa-telefono-recibo.sql.gz` (stop pm2, gunzip into psql, start pm2). Not expected to be needed.

---

## R4 — backend (actuals)

| field | value |
|---|---|
| zip | `/tmp/miempresa-staging-actividades-name-cargo-20260908-204920.zip` |
| bytes / sha256 | 445150 / `ac43ae03696c29f950657c066cf70e5b0b55b5fd4dc2ab6c061bba146274dc36` |
| generated/ | 0 matches |
| appspec.yml | restored into zip from HEAD (working tree still has `backend/appspec.yml` deleted; not part of this commit) |
| S3 | `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-actividades-name-cargo-20260908-204920.zip` |
| CodeDeploy group | `miempresa-staging` (NOT prod) |
| CodeDeploy id | **`d-FC043YNLL` Succeeded** |
| migrate | **32 / up to date** |
| pm2 | `miempresa-api` online, `restart_time` 0 |
| health | 200 post-deploy |

---

## R5 — frontend (actuals)

```
./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
Build: 15M output, 2.3M zip → s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260908-205109.zip
Amplify Job ID: 24 → SUCCEED
```

---

## QA (actuals)

| # | Check | Result |
|---|---|---|
| 1 | Local BE `registro-actividades-acl.spec.ts` | **9/9** |
| 2 | Local FE mocked R6 | **6/6** |
| 3 | Staging GET `/actividades` as `qa-gerontologa` | 200, n=2, `empleadoNombre` = `QA Auxiliar` / `STG PROF17`, `empleadoCargo` null (no contrato on those rows) |
| 4 | Staging GET `/actividades` as `qa-profesor` | 200, n=0 (own-item, no rows today) |
| 5 | FE `/` and `/actividades` | 200 / 200 |

**Staging smoke: PASS.** Cargo is null on current staging rows until those empleados have an active contrato; name is populated.

---

## Rollback (pre-staged, never auto)

- Backend: redeploy prior successful CodeDeploy `d-MRURUYMLL`.
- Frontend: prior Amplify job 23.
- Data: restore `pre-actividades-name-cargo.sql.gz` — not expected (no schema change).

---

## Grep hooks

```
actividades-name-cargo staging-release sep-8
d-FC043YNLL amplify-job-24 32-migrations-unchanged
pre-actividades-name-cargo.sql.gz
empleadoNombre empleadoCargo 935fe1d
```
