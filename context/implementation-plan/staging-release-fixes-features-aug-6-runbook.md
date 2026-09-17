# Staging Release Runbook — fixes-features-aug-6

**Status**: COMPLETE (2026-08-06)
**Scope**: full working tree (aug-6 + uncommitted centro-costos ago-5 ride-along — developer-approved)

## Account / targets
Profile `disruptive` · region `us-east-1` · BE `miempresa-backend-staging @ 54.144.25.72` · API `https://miempresa-api-stg.disruptiveexp.com/api/v1` · FE `https://miempresa-stg.disruptiveexp.com` · CodeDeploy group **`miempresa-staging` ONLY** · Amplify `d1nsxjyualdzdu`/staging · Backups `miempresa-backups-540657241795-staging`.

## Risk gate (R0)
- Staging was at **26** migrations; local **28**.
- Migrations shipped:
  - `#27 20260805000000_centro_costos_ago5` — drops empty `egresos`/`prefacturas`/`productos_servicios` (0 rows on staging) + creates `centro_costos_items`. **Data-safe.**
  - `#28 20260806035159_add_tipoempleado_profesores_auxiliares` — `ALTER TYPE ... ADD VALUE IF NOT EXISTS` PROFESORES + AUXILIARES. **Additive.**
- Preflight: API=200 FE=200; TipoEmpleado staging was `GERONTOLOGA,CONTRATOS`.

## R1 backup
- `s3://miempresa-backups-540657241795-staging/pre-releases/pre-aug6.sql.gz`
- 35,514 B (local=S3 ✓) · sha256 `3eb4a2615998d00e1d1b7d716bf34e72c445c56df945939d1ddcd950aa58a365`

## R4 backend
- Artifact `miempresa-staging-aug6-20260806-054018.zip` (appspec root; migrations 27+28; templates; centroCostos routes; domainAccess).
- CodeDeploy **`d-MR1QVXIZK` / Succeeded** (group `miempresa-staging` only).
- On-instance: **28 migrations / up to date**.
- TipoEmpleado live: `GERONTOLOGA,CONTRATOS,PROFESORES,AUXILIARES`.
- `centro_costos_items` present; `egresos` gone (as designed).
- Instruments upgrade (tunneled `FORCE_UPGRADE=true`):
  - SIGNOS_VITALES v1 active · roles `ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES`
  - BOLETIN_ANUAL v1 active · roles `ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES`
  - TINETTI v5 remains active

## R5 frontend
- Amplify **job 14 / SUCCEED**.
- Pages 200: `/ /login /empleados /nomina /instrumentos /pacientes /certificados /centro-costos`.

## Post-deploy smoke (PASS)
| Check | Result |
|---|---|
| API health | 200 |
| qa-admin / qa-gerontologa login | 200 |
| GERONTOLOGA GET /certificates | **200** (was forbidden) |
| GET /instruments/SIGNOS_VITALES/definition | 200 (admin + geronto) |
| GET /instruments/BOLETIN_ANUAL/definition | 200 |
| POST /instruments templateCodigo=TINETTI + codigo | 201, activeVersion attached |

## Rollback (manual only)
- Redeploy prior CodeDeploy `d-EDEN0GJYK` + Amplify job 13.
- DB restore from `pre-aug6.sql.gz` only if needed. Never auto-rollback.

## Grep hooks
staging-release-aug-6 d-MR1QVXIZK amplify-job-14 PROFESORES AUXILIARES SIGNOS_VITALES BOLETIN_ANUAL centro_costos_ago5 pre-aug6.sql.gz
