# QA Validation Plan — qa-session-aug-17 on STAGING

**Date**: 2026-08-18  
**Source stories**: `context/user-feedback/qa-session-aug-17-cleaned.md`  
**Contract**: `orchestration-ctx/decisions/contract-schema-qa-aug-17.md`  
**Targets**: API `https://miempresa-api-stg.disruptiveexp.com/api/v1` · FE `https://miempresa-stg.disruptiveexp.com`  
**Creds**: `get-qa-creds.sh --stage staging --profile disruptive`

## How to QA (step by step)

1. **Health / deploy identity** — API 200, FE 200, `/actividades` 200, on-instance migrate = 29.
2. **R1 Empleados tabs** — browser: default Activos, no Todos, Inactivos switch. API: `GET /employees?estado=ACTIVO` as ADMIN + CONTRATOS.
3. **R2 Cargos** — CONTRATOS GET `/empresa/cargos` 200; POST/PATCH/DELETE 403; GERONTOLOGA GET 403. FE: unlocked empleado editar contrato dropdown has cargos.
4. **R3 Bonos + total** — FIJO/INDEF POST stores `bonos`; `totalPagado === valorMensual + bonos`; aportes stored not added. OPS/OBRA `bonos>0` → 400. FE: bonos only on FIJO/INDEF.
5. **R4 Periodos auth/validation** — FIJO without jornada 201; CONTRATOS unlocked 201; locked 403 `EMPLOYEE_LOCKED`; OPS still needs valorJornada.
6. **R5** — skip product work; confirm SIGNOS/BOLETIN v2 still have no patient personal fields.
7. **R6 Actividades** — ADMIN GET/POST/PUT/DELETE; GERONTOLOGA/CONTRATOS GET all + POST 403; PROFESORES/AUXILIARES own+today (needs staging users). FE nav under Asistencia.

## Pass / fail
Each row: PASS / FAIL / BLOCKED (missing fixture). FAIL → orchestrate fix → re-run that row.

## Out of scope this pass
- Email-admin backfill
- Asistencia↔log consistency warning
- Prod
- Git commit
