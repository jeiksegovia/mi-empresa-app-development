# W2 completion report — qa-session-jul-24 (tasks 2, 3, 4)

## Summary
All 3 backend tasks (employee partial-edit + Nequi validation, asistencia RBAC + note, contract valorMensual + nómina branch) implemented against the shared contract. 67 tests pass; 3 pre-existing tests fail because they hard-code port 3001 (no service runs there); these are not regressions from my changes.

## Files modified

### Source (Task 2 — Employee partial-edit + Nequi + CONTRATOS RBAC)
- `backend/src/routes/employees.routes.ts`
  - `employeeBaseSchema.medioPagoTipo` enum now includes `EFECTIVO` (R1).
  - `refineMedioPago` validates Nequi llave with the contract regex (§3): email OR alphanumeric(6-25) with ≥1 letter + ≥1 digit; rejects pure numeric.
  - `PUT /:id` handler now surfaces service-level `error.status` + `error.field` (e.g. `400 medioPagoTipo`).
- `backend/src/services/employeeService.ts`
  - `MedioPagoTipo` type widened to include `EFECTIVO`.
  - `normalizeMedioPagoFields` clears channel fields for `EFECTIVO`.
  - `updateEmployee` guards the partial-update case: when user sends payment fields WITHOUT `medioPagoTipo` AND existing `medioPagoTipo` is null → throws `400 field='medioPagoTipo'`.

### Source (Task 3 — Asistencia RBAC + note)
- `backend/src/routes/asistencia.routes.ts`
  - Exports `serverTodayBogota()`: `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())` (contract §5.1).
  - `PUT /asistencia/dia`: rejects `EMPLEADO + CONTRATOS` with `403 field='fecha'` when `req.body.fecha !== serverToday`. ADMIN bypasses. The `notas` field is already on the schema; round-trip verified.

### Source (Task 4 — Contract valorMensual + nómina branch)
- `backend/src/routes/nomina.routes.ts`
  - `contratoSchema` accepts `valorMensual`.
  - `POST /employees/:id/contratos` branches required-field on `tipoContrato`:
    - OPS → `400 field='valorJornada'` if missing.
    - non-OPS → `400 field='valorMensual'` if missing.
  - `nominaPeriodoSchema` accepts `valorMensual` override.
- `backend/src/services/nominaService.ts`
  - `ContratoInput` accepts `valorMensual`.
  - `createContrato` / `updateContrato` branch required-field + clear opposite (`valorJornada` null for non-OPS, `valorMensual` null for OPS).
  - `resolveCalcFields` branches on `tipoContrato`:
    - OPS: `totalPagado = (mediasJornadas × valorJornada) + aportesSociales` (existing).
    - non-OPS: `totalPagado = (valorMensual ?? 0) + aportesSociales`; `mediasJornadas`/`subtotalCalculado`/`valorJornada` snapshot = null (D2); legacy rows with null `valorMensual` treated as 0 to avoid crash.
  - `getNominaMonth` `sugerido` block populates `valorMensual` for non-OPS, `valorJornada` only for OPS.

### New tests (qa-session-jul-24)
- `backend/tests/employees/employees-partial-medio-pago.spec.ts` — 5 tests pass.
- `backend/tests/asistencia/asistencia-rbac.spec.ts` — 3 tests pass.
- `backend/tests/nomina/contrato-valormensual.spec.ts` — 4 tests pass.

### Existing tests updated to match new contract
- `backend/tests/employees/contrato-valor-jornada.spec.ts` — replaced TERMINO_INDEFINIDO test pair with explicit OPS/TERMINO_INDEFINIDO pairs (R7).
- `backend/tests/employees/contrato-cargo.spec.ts` — TERMINO_FIJO fixture adds `valorMensual`.
- `backend/tests/employees/medio-pago.spec.ts` — replace pure-numeric Nequi with valid alphanumeric; add `pure-numeric → 400` test (R1 regex).
- `backend/tests/employees/medio-pago-edge.spec.ts` — pure-numeric Nequi → alphanumeric llave.
- `backend/tests/nomina/cuenta-cobro-required.spec.ts` — self-seed fallback when no active OPS/FIJO employee exists.
- `backend/tests/nomina/nomina-calc-asistencia.spec.ts` — branch required-field on `tipoContrato`; FIJO test now uses `valorMensual` directly per R7.
- `backend/tests/nomina/nomina-calc-edge.spec.ts` — switch contrato type from TERMINO_INDEFINIDO to OPS (R7); test 2 removes `aportesSociales` (not allowed for OPS); OBRA_O_LABOR uses `valorMensual`.

## Acceptance criteria evidence (verbatim)

### C1. PATCH/PUT employee changing ONLY payment fields → 200 for ADMIN and CONTRATOS
```
$ curl -s -b /tmp/cookie.txt -X PUT http://localhost:3101/api/v1/employees/237 -H "Content-Type: application/json" -d '{"medioPagoNequi":"mi.llave@correo.com"}' -w "%{http_code}"
{"success":true,"data":{"id":237,...,"medioPagoTipo":"NEQUI","medioPagoNequi":"mi.llave@correo.com",...}}
200

$ curl -s -b /tmp/cookie-contratos.txt -X PUT http://localhost:3101/api/v1/employees/237 -H "Content-Type: application/json" -d '{"medioPagoNequi":"X1Y2Z3A4B5"}' -w "%{http_code}"
{"success":true,"data":{"id":237,...,"medioPagoTipo":"NEQUI","medioPagoNequi":"X1Y2Z3A4B5",...}}
200
```

### C2. Nequi accepts valid formats; EFECTIVO saves with null bank/nequi
```
$ echo '{"nombre":"T","apellido":"EF","tipoDocumento":"CC","numeroDocumento":"EF2'$(date +%s)'","genero":"M","fechaNacimiento":"1990-01-15","medioPagoTipo":"EFECTIVO"}' | curl -b /tmp/cookie.txt -X POST http://localhost:3101/api/v1/employees -d @- -H "Content-Type: application/json" -w "%{http_code}"
{"success":true,"data":{"id":239,"medioPagoTipo":"EFECTIVO","medioPagoNequi":null,"bancoNombre":null,"bancoTipoCuenta":null,"bancoNumeroCuenta":null,...}}
201

$ echo '{"nombre":"T","apellido":"NUM","tipoDocumento":"CC","numeroDocumento":"NUM'$(date +%s)'","genero":"M","fechaNacimiento":"1990-01-15","medioPagoTipo":"NEQUI","medioPagoNequi":"3001234567"}' | curl -b /tmp/cookie.txt -X POST http://localhost:3101/api/v1/employees -d @- -H "Content-Type: application/json" -w "%{http_code}"
{"success":false,"message":"Validation error","errors":{"medioPagoNequi":["Nequi llave no válida: debe ser email o alfanumérica (6-25) con al menos una letra y un dígito"]}}
400
```

### C3. CONTRATOS `PUT /asistencia/dia` fecha != today → 403; fecha == today → 200; ADMIN any date → 200
```
$ curl -s -b /tmp/cookie-contratos.txt -X PUT http://localhost:3101/api/v1/asistencia/dia -d '{"fecha":"2026-07-31","items":[{"empleadoId":237,"jornadaAm":true,"jornadaPm":false,"notas":"test hoy"}]}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":true,"data":[{"id":50,"empleadoId":237,"fecha":"2026-07-31T00:00:00.000Z","jornadaAm":true,"jornadaPm":false,"notas":"test hoy",...}]}
200

$ curl -s -b /tmp/cookie-contratos.txt -X PUT http://localhost:3101/api/v1/asistencia/dia -d '{"fecha":"2026-07-30","items":[{"empleadoId":237,"jornadaAm":true,"jornadaPm":false,"notas":"ayer"}]}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":false,"message":"CONTRATOS only puede registrar asistencia del día actual","field":"fecha"}
403

$ curl -s -b /tmp/cookie.txt -X PUT http://localhost:3101/api/v1/asistencia/dia -d '{"fecha":"2026-07-30","items":[{"empleadoId":237,"jornadaAm":true,"jornadaPm":false,"notas":"admin ayer"}]}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":true,"data":[{"id":51,"empleadoId":237,"fecha":"2026-07-30T00:00:00.000Z","jornadaAm":true,"jornadaPm":false,"notas":"admin ayer",...}]}
200
```

### C4. Attendance note persists (round-trip GET shows it)
```
$ curl -s -b /tmp/cookie.txt "http://localhost:3101/api/v1/asistencia?fecha=2026-07-31" | python3 -c "..."
{'id': 50, 'empleadoId': 237, 'fecha': '2026-07-31', 'jornadaAm': True, 'jornadaPm': False, 'notas': 'test hoy', 'empleado': {...}}
```

### C5. Create TERMINO_FIJO without valorMensual → 400; with valorMensual → 201; OPS still requires valorJornada
```
$ curl -s -b /tmp/cookie.txt -X POST "http://localhost:3101/api/v1/nomina/employees/$EMP/contratos" -d '{"tipoContrato":"TERMINO_FIJO","fechaInicio":"2026-01-01","fechaFin":"2027-01-01","cargoId":43,"activo":true}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":false,"message":"valorMensual es requerido para TERMINO_FIJO","field":"valorMensual"}
400

$ curl -s -b /tmp/cookie.txt -X POST "http://localhost:3101/api/v1/nomina/employees/$EMP/contratos" -d '{"tipoContrato":"TERMINO_FIJO","fechaInicio":"2026-01-01","fechaFin":"2027-01-01","cargoId":43,"activo":true,"valorMensual":1500000}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":true,"data":{"id":178,"tipoContrato":"TERMINO_FIJO","valorJornada":null,"valorMensual":"1500000",...}}
201

$ curl -s -b /tmp/cookie.txt -X POST "http://localhost:3101/api/v1/nomina/employees/$EMP/contratos" -d '{"tipoContrato":"OPS","fechaInicio":"2026-01-01","fechaFin":"2027-01-01","cargoId":43,"activo":true}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":false,"message":"valorJornada es requerido para OPS","field":"valorJornada"}
400
```

### C6. Nómina for a TERMINO_FIJO employee computes from monthly value; OPS from jornadas
```
$ curl -s -b /tmp/cookie.txt -X POST "http://localhost:3101/api/v1/nomina/periodos" -d '{"empleadoId":248,"periodo":"2099-09","valorMensual":500000,"aportesSociales":100000}' -H "Content-Type: application/json" -w "%{http_code}"
{"success":true,"data":{"id":81,"empleadoId":248,"tipoContrato":"TERMINO_FIJO","mediasJornadas":null,"valorJornada":null,"subtotalCalculado":null,"aportesSociales":"100000","totalPagado":"600000","salario":"600000",...}}
201
```

### C7. Each task ships ≥1 backend smoke spec + report before/after counts
- **Before** (Task 2 / 3 / 4 specs): 0 dedicated spec files for the R1/R6/R7 acceptance criteria.
- **After** (3 new specs):
  - `tests/employees/employees-partial-medio-pago.spec.ts` — 5 tests pass.
  - `tests/asistencia/asistencia-rbac.spec.ts` — 3 tests pass.
  - `tests/nomina/contrato-valormensual.spec.ts` — 4 tests pass.
- Updated 7 legacy specs to match the R1/R7 contract changes.

## Test suite result (full local run)
```
67 passed, 3 failed (pre-existing port 3001 tests), 38 did not run (different describe blocks)
```

## Notes / deviations
- The Prisma client `NominaPeriodo` model does NOT have a `valorMensual` column (contract §4: snapshot is null for non-OPS per D2). The `valorMensual` is stored on the `Contrato` row only. The Zod schema accepts `valorMensual` on `POST /nomina/periodos` as an optional override for the calc (`nominaPeriodoSchema`).
- The `domainAccess.ts` matrix already granted CONTRATOS full access on `empleados` (matrix[empleados] = true). No change needed there.
- The attendance `notas` column already existed on `asistencia_empleados` per the contract; verified round-trip via GET.
- The CONTRATOS password was originally read from `QA_CONTRATOS_PASSWORD` env (SSM on staging). For local dev a one-off `seed-contratos-tmp.ts` was used to reset it to `<redacted>` so the test spec could log in.
