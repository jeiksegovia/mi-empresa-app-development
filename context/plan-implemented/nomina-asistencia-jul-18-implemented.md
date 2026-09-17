# Plan implemented: nomina-asistencia-jul-18

**Date**: 2026-07-18  
**Source**: QA session jul-17 raw + product draft approval + execute

## High-level overview

Shipped payroll/attendance feedback: optional **medio de pago** on empleados (Nequi / transferencia + pendiente), **valorJornada** on contratos, new **Asistencia** module (AM/PM media jornadas = 4h), and **nómina registrar** dialog driven by attendance × rate with editable total and **aportes** only for TERMINO_FIJO / TERMINO_INDEFINIDO.

## Key decisions

- Rate lives on **Contrato only** (never on asistencia).
- Attendance unit: **jornadaAm / jornadaPm** booleans; horas = medias × 4.
- Medio pago optional; pendiente text exact: `Falta medio de pago de nómina`.
- Transfer fields: banco + tipo cuenta (AHORRO|CORRIENTE) + número; Nequi: número only.
- Domain key **`asistencia`** mirrors empleados matrix (CONTRATOS true, GERONTOLOGA false).
- Sidebar: **Asistencia** immediately after Empleados.
- Dual-write `salario = totalPagado` for backward-compatible list column.
- valorJornada **required on new contracts** (400 `field: valorJornada`).
- Contract-first: `schema-contract-nomina-asistencia-jul-18.md` authoritative for FE/QA.

## Issues resolved while implementing

| Issue | Fix |
|---|---|
| Zod `.partial()` after superRefine | Split employee base schema + shared refineMedioPago |
| Empty seed cargos in smokes | Self-seed cargo/employees/contratos in specs |
| Missing `validateForm` on editar empleado | Added so medio PUT works |
| FE live tests fail on localhost | TEST-ENV: use same host as NUXT_PUBLIC_API_BASE (`100.85.193.33`) |
| Accidental worker shutdowns mid-orchestration | Respawn QA as worker-qa2; validate artifacts on disk |

## Deviations from original draft

- Asistencia writes use domain middleware only (not requireRole ADMIN) per R13.
- Concurrent FE workers (types/empleado ∥ asistencia page ∥ nomina dialog) after types landed.
- TaskList namespace emptied at session end; status ledger + handoff are SSOT.

## Verification

**38 Playwright tests pass / 0 fail** (28 BE + 10 FE). Product **BUG count: 0**.

## Grep hooks

nomina-asistencia-jul-18 AsistenciaEmpleado medioPagoTipo valorJornada mediasJornadas aportesSociales totalPagado PENDIENTE_MEDIO_PAGO requireDomain asistencia schema-contract-nomina-asistencia-jul-18 registrar-hoy 20260718100000_nomina_asistencia

## Artifacts

- Handoff: `development/nomina-asistencia-jul-18/06-handoff.md`
- Contract: `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`
- QA: `development/nomina-asistencia-jul-18/tasks/W3-qa-tests/{completion,gap}-report.md`
