# QA Validation Report — qa-session-aug-17 on STAGING

**Date**: 2026-08-18  
**Stories**: `context/user-feedback/qa-session-aug-17-cleaned.md`  
**Plan**: `development/qa-session-aug-17/qa-validation-plan.md`  
**Targets**: API `https://miempresa-api-stg.disruptiveexp.com/api/v1` · FE `https://miempresa-stg.disruptiveexp.com`

## Deploy identity
| Layer | Value |
|---|---|
| First ship | CodeDeploy `d-FD0BEVH7L` / Amplify **job 16** / mig **29** |
| Fix ship | CodeDeploy **`d-YRWXPRH7L`** (users `tipoEmpleado` MATRIX_TIPOS) |
| Backup | `pre-aug17.sql.gz` |

## Results (after one fix-up cycle)

| Story | Check | Result |
|---|---|---|
| R1 | API `GET /employees?estado=ACTIVO` only ACTIVO | **PASS** |
| R1 | FE tabs Activos/Inactivos, no Todos | **PASS** (UI spec) |
| R2 | CONTRATOS GET cargos 200; POST 403; GERONTO GET 403 | **PASS** |
| R2 | CONTRATOS editar empleado → no cargos 403 | **PASS** (UI spec) |
| R3 | FIJO `bonos=150000` `totalPagado=2150000` (aportes not added) | **PASS** |
| R3 | OBRA `bonos>0` → 400 `field=bonos` (after attaching cuenta cobro) | **PASS** |
| R4 | Locked empleado → CONTRATOS POST periodos 403 `EMPLOYEE_LOCKED` | **PASS** |
| R5 | SIGNOS/BOLETIN v2 no personal fields | **PASS** |
| R6 | ADMIN GET 200; GERONTO/CONTRATOS POST 403 | **PASS** |
| R6 | Nav after Asistencia + form testids | **PASS** |
| R6 | PROFESORES user + linked empleado POST today 201; past 403 | **PASS** after `d-YRWXPRH7L` |

**Specs**: `backend/tests/staging/qa-aug17-staging.spec.ts` **8/8** · `frontend/tests/staging/qa-aug17-staging-ui.spec.ts` **3/3**

## Issues found and closed

1. **`POST /users` Zod `tipoEmpleado` was `GERONTOLOGA` only**  
   Blocked provisioning PROFESORES/AUXILIARES (R6 writers) on staging.  
   **Fix**: `users.routes.ts` create+update enum = `GERONTOLOGA \| CONTRATOS \| PROFESORES \| AUXILIARES`. Removed PATCH leftover that rejected non-GERONTOLOGA.  
   **Test**: `backend/tests/users/tipoempleado-matrix.spec.ts` (local 1/1) + staging R6 writer test.  
   **Shipped**: `d-YRWXPRH7L`.

2. **QA test defects (not product)**  
   - OPS/OBRA periodo without `CUENTA_COBRO` 400s first (pre-existing jul-18 rule). Bonos assert now sends dummy archivo.  
   - Sidebar is a drawer — nav test must open hamburger.  
   - `.or()` locator matched 2 visible nodes (strict mode).

## Residual / not a fail
- No permanent staging QA users for PROFESORES/AUXILIARES in SSM/`seed-qa.ts`. Writer path proven via ephemeral `POST /users` + linked empleado, then deleted. Seed-qa extension is a later deploy task if desired.
- Working tree still uncommitted (developer commits).

## Verdict
**Staging matches cleaned stories R1–R6.** No open product FAIL.
