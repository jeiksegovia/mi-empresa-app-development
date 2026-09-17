# Completion Report — W1-backend-contract-api

**Worker**: backend-eng (W1)  
**Slug**: nomina-asistencia-jul-18  
**Date**: 2026-07-18  
**Status**: COMPLETE

---

## Deliverables

| Deliverable | Path | Status |
|---|---|---|
| Prisma schema | `backend/prisma/schema.prisma` | Done |
| Migration | `backend/prisma/migrations/20260718100000_nomina_asistencia/migration.sql` | Applied |
| Living contract | `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md` | Done |
| Domain matrix | `backend/src/middleware/domainAccess.ts` | `asistencia` added |
| Employee medio | `employeeService.ts`, `employees.routes.ts` | Done |
| Contrato valorJornada | `nominaService.ts`, `nomina.routes.ts` | Done |
| Asistencia module | `asistenciaService.ts`, `asistencia.routes.ts`, `routes/index.ts` | Done |
| Nómina enrichment/calc | `nominaService.ts`, `nomina.routes.ts` | Done |
| Smoke: medio | `backend/tests/employees/medio-pago.spec.ts` | Green |
| Smoke: valorJornada | `backend/tests/employees/contrato-valor-jornada.spec.ts` | Green |
| Smoke: asistencia | `backend/tests/asistencia/asistencia-dia.spec.ts` | Green |
| Smoke: nomina calc | `backend/tests/nomina/nomina-calc-asistencia.spec.ts` | Green |

---

## Acceptance Criteria Evidence

### 1. Migration applied locally without shadow DB
```text
$ cd backend && npx prisma migrate deploy
Applying migration `20260718100000_nomina_asistencia`
All migrations have been successfully applied.
```

### 2. Contract doc
Path: `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`  
Contains: field names, enums, request/response JSON, errors, pendiente constant, calc algorithm, deviations table.

### 3–5. Medio pago + pendiente
```text
$ npx playwright test tests/employees/medio-pago.spec.ts --reporter=line
  4 passed
```
- POST without medio → 201 + open pendiente `Falta medio de pago de nómina`
- NEQUI without number → 400
- Transfer missing bank → 400
- Completing medio → pendiente RESUELTO

### 6. valorJornada required on create
```text
$ npx playwright test tests/employees/contrato-valor-jornada.spec.ts --reporter=line
  2 passed
```
- without valorJornada → 400 `field: 'valorJornada'`
- with valor → 201

### 7. Asistencia API
```text
$ npx playwright test tests/asistencia/asistencia-dia.spec.ts --reporter=line
  3 passed
```
- PUT /dia upserts; GET ?fecha= returns actives + flags; GET resumen sums medias

### 8–9. Nómina enrichment + calc
```text
$ npx playwright test tests/nomina/nomina-calc-asistencia.spec.ts --reporter=line
  3 passed
```
- GET /nomina includes medio, asistenciaMes, contrato valorJornada, sugerido
- FIJO aportes allowed; total default medias×valor+aportes; salario dual-write
- OPS aportes > 0 → 400 field aportesSociales

### 10. All smoke green
```text
$ npx playwright test tests/employees/medio-pago.spec.ts \
    tests/employees/contrato-valor-jornada.spec.ts \
    tests/asistencia/asistencia-dia.spec.ts \
    tests/nomina/nomina-calc-asistencia.spec.ts --reporter=line
  12 passed (1.4s)
```
API: `http://localhost:3101` (project `npm run dev`). Did not touch port 4142.

### 11. No frontend modifications
W1 only touched `backend/**` + `development/nomina-asistencia-jul-18/**`.

---

## Key Decisions

1. **Additive-only migration** — all new columns nullable; no backfill; no PLAN-APPROVAL gate.
2. **Domain key `asistencia`** mirrors empleados matrix (CONTRATOS true, GERONTOLOGA false).
3. **valorJornada CREATE** enforced by explicit route check + service so response has top-level `field: 'valorJornada'` (not only Zod `errors` map).
4. **Asistencia writes** use domain middleware only (not requireRole ADMIN) per R13.
5. **GET day board** returns synthetic rows (`id: null`, flags false) for ACTIVO employees without attendance.
6. **GET /nomina** adds computed `asistenciaMes` + `sugerido` (not persisted).
7. **Calc defaults**: medias from asistencia sum; valor from active contract; total = subtotal + aportes; dual-write salario when total set; client total override allowed.
8. **Pendiente** text exact match / startsWith; idempotent open; resolve on complete medio.

---

## Issues Encountered / Resolved

| Issue | Resolution |
|---|---|
| ZodEffects blocks `.partial()` | Split `employeeBaseSchema` + shared `refineMedioPago` |
| Empty local cargos/contratos seed | Smoke specs self-seed cargo + employees + contratos |
| Need top-level `field` for valorJornada | Explicit route 400 before service |

---

## Known Issues NOT Fixed

None blocking W2. Legacy contracts may have `valorJornada = null` (by design); dialog should warn (FE).

---

## Integration Notes for W2

**Authoritative contract**:  
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`

### FE-critical shapes

**GET `/api/v1/asistencia?fecha=YYYY-MM-DD`**
```json
{ "success": true, "data": [{
  "id": null | number,
  "empleadoId": number,
  "jornadaAm": boolean,
  "jornadaPm": boolean,
  "notas": string | null,
  "empleado": { "id", "nombre", "apellido", "numeroDocumento", "estado" }
}]}
```

**PUT `/api/v1/asistencia/dia`**
```json
{ "fecha": "YYYY-MM-DD", "items": [{ "empleadoId", "jornadaAm", "jornadaPm", "notas?" }] }
```

**GET `/api/v1/nomina?periodo=YYYY-MM` row**
```json
{
  "empleado": { "id", "nombre", "apellido", "numeroDocumento",
    "medioPagoTipo", "medioPagoNequi", "bancoNombre", "bancoTipoCuenta", "bancoNumeroCuenta" },
  "contratoActivo": { "...", "valorJornada" } | null,
  "entrada": { "...calc fields...", "archivos" } | null,
  "asistenciaMes": { "mediasJornadas", "horas" },
  "sugerido": { "mediasJornadas", "valorJornada", "subtotalCalculado", "aportesSociales", "totalPagado" }
}
```

**Domain**: add `'asistencia'` to FE `useDomainAccess` mirror (CONTRATOS true, GERONTOLOGA false).

**Pendiente text**: `Falta medio de pago de nómina`

**Enums**: `NEQUI | TRANSFERENCIA_BANCARIA`, `AHORRO | CORRIENTE`

---

## Deferred Items

- Month lock after liquidación
- Auto-patch NominaPeriodo when attendance changes later
- Relax ADMIN write role on nomina/contratos for CONTRATOS
- Legal aportes % auto-calc / bank export

---

## Typecheck

```text
$ npx tsc --noEmit
(exit 0)
```
