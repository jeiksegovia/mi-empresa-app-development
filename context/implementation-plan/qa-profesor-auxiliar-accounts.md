# Plan: 5 QA profiles (add PROFESORES + AUXILIARES)

**Path**: `context/implementation-plan/qa-profesor-auxiliar-accounts.md`  
**Date**: 2026-08-27  
**Status**: LOCAL + staging seeded. Staging login 5/5 OK on `https://miempresa-api-stg.disruptiveexp.com/api/v1`.

## Recap (F2/F3, not this change)

- Plan: `context/implementation-plan/qa-aug-27-contratos-editar-plan.md`
- Runbook: `context/implementation-plan/staging-release-qa-aug-27-contratos-editar-runbook.md`
- Staging: `d-C9QWA4NDL` / job 18 then `d-1G7ST2PDL` / job 19

## Why

Staging QA accounts live in SSM + `seed-qa.ts` (3 profiles only). PROFESORES / AUXILIARES exist locally as `profesor@` / `auxiliar@` (`<redacted>`, linked empleado) but were never added to the canonical `qa-*` / SSM pattern. Staging tests create throwaway `qa-profesor-tmp-*` users.

## Canonical 5 (same emails local + staging)

| SSM slug | Email | rol | tipoEmpleado | Linked empleado |
|---|---|---|---|---|
| `qa-admin` | `qa-admin@miempresa.com` | ADMIN | null | no |
| `qa-gerontologa` | `qa-gerontologa@miempresa.com` | EMPLEADO | GERONTOLOGA | no |
| `qa-contratos` | `qa-contratos@miempresa.com` | EMPLEADO | CONTRATOS | no |
| `qa-profesor` | `qa-profesor@miempresa.com` | EMPLEADO | PROFESORES | yes (`900000101`) |
| `qa-auxiliar` | `qa-auxiliar@miempresa.com` | EMPLEADO | AUXILIARES | yes (`900000102`) |

SSM: `/miempresa/<stage>/qa/<slug>/{EMAIL,PASSWORD}`  
Print: `backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive`  
Provision staging: `backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive`

## Two layers (do not mix)

1. **Local wipe seed** `backend/prisma/seed.ts` — muscle-memory `admin@` / `profesor@` / `auxiliar@` (`<redacted>`) **plus** the 5 `qa-*` emails so one `db:seed` covers tests.
2. **Staging-safe QA seed** `backend/prisma/test-db/seed-qa.ts` — upsert 5 `qa-*` only; passwords from SSM; no deletes.
3. **Dev canary** `create-users-staging.sh` — still only `admin@` / `empleado@`. Not for specialized tipos.

Local aliases kept: `profesor@miempresa.com` / `auxiliar@miempresa.com` (existing actividades specs).

## Staging seed (2026-08-27)

Command: `backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive`

SSM created:
- `/miempresa/staging/qa/qa-profesor/{EMAIL,PASSWORD}`
- `/miempresa/staging/qa/qa-auxiliar/{EMAIL,PASSWORD}`

Existing 3 pairs reused (not regenerated).

| Email | staging usuario id | empleadoId |
|---|---|---|
| `qa-admin@miempresa.com` | 5 | null |
| `qa-gerontologa@miempresa.com` | 6 | null |
| `qa-contratos@miempresa.com` | 7 | null |
| `qa-profesor@miempresa.com` | 18 | 16 |
| `qa-auxiliar@miempresa.com` | 19 | 17 |

Login UI: `https://miempresa-stg.disruptiveexp.com/login` (custom domain only).  
Reprint passwords: `./prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive` (from `backend/`).

Local ACL spec `backend/tests/rbac/qa-profiles-five.spec.ts` 8/8. Not committed.
