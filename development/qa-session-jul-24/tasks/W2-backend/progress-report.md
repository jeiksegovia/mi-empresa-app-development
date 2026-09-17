# W2 progress report — qa-session-jul-24

## Task 2 — Employee partial-edit + CONTRATOS RBAC + Nequi validation — DONE
- `backend/src/routes/employees.routes.ts`:
  - Added `EFECTIVO` to `medioPagoTipo` enum.
  - Added Nequi regex validation in `refineMedioPago` per contract §3.
  - `PUT /:id` now surfaces service-level `error.status` / `error.field`.
- `backend/src/services/employeeService.ts`:
  - Widened `MedioPagoTipo` to include `EFECTIVO`.
  - `normalizeMedioPagoFields` clears channel fields for `EFECTIVO`.
  - `updateEmployee` guards: partial payment fields without `medioPagoTipo` AND existing `medioPagoTipo` null → `400 field='medioPagoTipo'`.
- CONFIRMED: `domainAccess.ts` `CONTRATOS.empleados = true` → write OK. No change needed.
- New test: `backend/tests/employees/employees-partial-medio-pago.spec.ts` (5 tests pass).

## Task 3 — Asistencia RBAC + note — DONE
- `backend/src/routes/asistencia.routes.ts`:
  - Exports `serverTodayBogota()`: `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())`.
  - `PUT /asistencia/dia` rejects `EMPLEADO + CONTRATOS` with `403 field='fecha'` when `req.body.fecha !== serverToday`. ADMIN bypasses.
  - `notas` field already on schema (verified DB column `asistencia_empleados.notas`); round-trip verified via GET.
- New test: `backend/tests/asistencia/asistencia-rbac.spec.ts` (3 tests pass).

## Task 4 — Contract valorMensual + nómina branch — DONE
- `backend/src/routes/nomina.routes.ts`:
  - `contratoSchema` accepts `valorMensual`.
  - `POST /employees/:id/contratos` branches required-field on `tipoContrato`:
    - OPS → `400 field='valorJornada'` if missing.
    - non-OPS → `400 field='valorMensual'` if missing.
  - `nominaPeriodoSchema` accepts `valorMensual` override.
- `backend/src/services/nominaService.ts`:
  - `ContratoInput` accepts `valorMensual`.
  - `createContrato` / `updateContrato` branch required-field + clear opposite channel.
  - `resolveCalcFields` branches on `tipoContrato`:
    - OPS: `totalPagado = (mediasJornadas × valorJornada) + aportesSociales` (existing).
    - non-OPS: `totalPagado = (valorMensual ?? 0) + aportesSociales`; snapshot fields null per D2. Legacy rows with null `valorMensual` treated as 0 to avoid crash.
  - `getNominaMonth` `sugerido` populates `valorMensual` for non-OPS.
- New test: `backend/tests/nomina/contrato-valormensual.spec.ts` (4 tests pass).

## Legacy spec updates (to match R1/R7 contract)
- `tests/employees/contrato-valor-jornada.spec.ts` — replaced TERMINO_INDEFINIDO assertions with explicit OPS + TERMINO_INDEFINIDO pairs per R7.
- `tests/employees/contrato-cargo.spec.ts` — TERMINO_FIJO fixture adds `valorMensual`.
- `tests/employees/medio-pago.spec.ts` — pure-numeric Nequi → valid alphanumeric; new `pure-numeric → 400` test (R1).
- `tests/employees/medio-pago-edge.spec.ts` — pure-numeric Nequi → alphanumeric llave.
- `tests/nomina/cuenta-cobro-required.spec.ts` — self-seed fallback when no active OPS/FIJO employee exists.
- `tests/nomina/nomina-calc-asistencia.spec.ts` — branch required-field on `tipoContrato`; FIJO test uses `valorMensual` per R7.
- `tests/nomina/nomina-calc-edge.spec.ts` — TERMINO_INDEFINIDO → OPS; test 2 removes `aportesSociales` (not allowed for OPS); OBRA_O_LABOR uses `valorMensual`.

## Test suite result
- 67 passed, 3 failed (pre-existing port 3001 tests; not regressions).
- 3 NEW dedicated spec files for R1/R6/R7.

## Pre-edit typecheck
- `npx tsc --noEmit` (backend) — clean.

## Deliverables
- 3 modified backend source files.
- 3 new backend test specs.
- 7 updated legacy specs.
- `development/qa-session-jul-24/tasks/W2-backend/completion-report.md` with verbatim curl outputs.
