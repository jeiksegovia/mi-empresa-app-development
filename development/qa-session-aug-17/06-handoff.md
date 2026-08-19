# Handoff: qa-session-aug-17

**Date**: 2026-08-18 · **Status**: implementation COMPLETE + verified + **deployed to staging**.

## Delivered
| Item | Summary | Verified |
|---|---|---|
| R1 | Empleados tabs Activos \| Inactivos, default Activos | FE 11/11 mocked |
| R2 | CONTRATOS GET `/empresa/cargos` 200; writes 403; matrix.empresa false | BE 6/6 + staging 200/403 |
| R3 | FIJO/INDEF bonos; `totalPagado = valorMensual + bonos` | BE 6/6 + staging POST 201 `2150000 = 2000000+150000` |
| R4 | Periodos no jornada for non-OPS; CONTRATOS POST unlocked; locked 403 | staging 201 / 403 EMPLOYEE_LOCKED |
| R6 | Domain `actividades` + API + FE under Asistencia | BE ACL 7/7 + matrix 4/4; staging GET 200 / POST 403 for geronto+contratos |

## Staging
| Layer | Value |
|---|---|
| CodeDeploy | **`d-YRWXPRH7L`** (fix) after **`d-FD0BEVH7L`** · group `miempresa-staging` only |
| Amplify | **job 16 SUCCEED** |
| Migrations | **29** (`20260818113726_add_nomina_bonos_and_registro_actividades`) |
| Backup | `s3://…/pre-releases/pre-aug17.sql.gz` 38912 B sha256 `4b07235e…` |
| Rollback | `d-13RWC0Q4L` / Amplify job 15 + `pre-aug17.sql.gz` |

## Followup fix (`d-YRWXPRH7L`)
`POST/PATCH /users` `tipoEmpleado` now accepts all MATRIX_TIPOS (was GERONTOLOGA-only). Staging QA: PROFESORES + linked empleado POST `/actividades` today **201**.

## Not on staging
- Permanent SSM QA users for PROFESORES/AUXILIARES (`seed-qa.ts` still 3 profiles). Writer path proven via ephemeral user.
- No git commit (developer commits).

## Tests (orchestrator independent)
- BE: 23/23 (ACL 7 + cargos 6 + bonos 6 + matrix 4)
- FE: 11/11 `aug17-qa-frontend.spec.ts`

## Protocol notes
- W1 first process self-approve envelope rejected; T2/T3 later MATCH via worker-1-2.
- W3 completed T7–T9 before pause. W2-2 finished T6.
- `tsc` needed `serverTodayBogota` import in `asistencia.routes.ts` (re-export was not a local binding).
