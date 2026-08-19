# qa-session-aug-17 implemented

**Date**: 2026-08-18  
**Staging**: CodeDeploy `d-YRWXPRH7L` (after `d-FD0BEVH7L`) · Amplify job 16 · 29 migrations

## High-level
QA cycle from `qa-feedbacl-aug-17.md`: empleados Activos/Inactivos tabs, CONTRATOS GET cargos, nómina bonos + total without aportes, periodos unlock for CONTRATOS, Registro de actividades under Asistencia.

## Key decisions
- `CONTRATOS.empresa` stays false; GET `/empresa/cargos` is a route exception.
- `totalPagado = valorMensual + bonos` for FIJO/INDEF; aportes stored, not added.
- OPS formula unchanged; OPS/OBRA still require `CUENTA_COBRO`.
- Domain `actividades`: PROFESORES/AUXILIARES create-only + own/today; GERONTOLOGA/CONTRATOS read-only; ADMIN full.
- Unique `(empleadoId, fecha)` → 409 `DUPLICATE_DAY`.
- `POST /users` `tipoEmpleado` accepts all MATRIX_TIPOS (QA-found hole, shipped `d-YRWXPRH7L`).

## Deviations
- Reported periodos 400 was not jornada-required; live FIJO POST was 201 with wrong total (`V+aportes`).
- `export { serverTodayBogota } from` is not a local binding — import required for `tsc`.
- Pendo `initial-ask.md` path was discarded (wrong repo).
