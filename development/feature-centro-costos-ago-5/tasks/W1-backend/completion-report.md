# W1-backend — Completion Report (T1 → T4)

**Feature**: centro-costos-ago-5
**Worker**: worker-1 (pt-backend-eng)
**Date**: 2026-08-05
**Status**: ALL 4 TASKS COMPLETE

---

## Task 1 — Schema + migration + seed (DONE)

### AC1: `npx prisma validate` exits 0

```bash
$ cd backend && npx prisma validate
```

```
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7...
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
The schema at prisma/schema.prisma is valid 🚀
```
✅ PASS

### AC2: `\dt` shows `centros_costos` and `centro_costos_items`, and does NOT show the 3 dropped tables

```bash
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT to_regclass('public.centros_costos') AS centros_costos, to_regclass('public.centro_costos_items') AS centro_costos_items, to_regclass('public.productos_servicios') AS productos_servicios, to_regclass('public.prefacturas') AS prefacturas, to_regclass('public.egresos') AS egresos;"
```

```
 centros_costos | centro_costos_items | productos_servicios | prefacturas | egresos
----------------+---------------------+---------------------+-------------+---------
 centros_costos | centro_costos_items |                     |             |
(1 row)
```
✅ PASS — new tables present, dead tables gone.

### AC3: `clientes` row count unchanged (before/after = 20)

```bash
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT count(*) FROM clientes;"
```

```
 count
-------
    20
(1 row)
```
✅ PASS — `clientes` identical before and after.

### AC4: Every nómina/empleado table still exists

```bash
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT to_regclass('public.empleados') AS empleados, to_regclass('public.contratos') AS contratos, to_regclass('public.nomina_periodos') AS nomina_periodos, to_regclass('public.asistencia_empleados') AS asistencia_empleados;"
```

```
 empleados | contratos | nomina_periodos | asistencia_empleados
-----------+-----------+-----------------+----------------------
 empleados | contratos | nomina_periodos | asistencia_empleados
(1 row)
```
✅ PASS — all 4 tables present.

### AC5: Seed run twice → INGRESOS=5, EGRESOS=6 both times

Twice — after backend PID 82766 startup and after PID 86422 startup:

```bash
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT tipo, count(*) FROM centros_costos GROUP BY tipo ORDER BY tipo;"
```

```
   tipo   | count
----------+-------
 INGRESOS |     5
 EGRESOS  |     6
(2 rows)
```
✅ PASS — idempotent across 2 startups.

### Seeded centros in orden

```bash
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT nombre, tipo, orden FROM centros_costos ORDER BY tipo, orden;"
```

```
         nombre          |   tipo   | orden
-------------------------+----------+-------
 Mensualidades completas | INGRESOS |     1
 Mensualidades por día   | INGRESOS |     2
 Transporte              | INGRESOS |     3
 Ingresos adicionales    | INGRESOS |     4
 Valoraciones            | INGRESOS |     5
 Refrigerios             | EGRESOS  |     6
 Aseo                    | EGRESOS  |     7
 Papelería               | EGRESOS  |     8
 Eventos                 | EGRESOS  |     9
 Nómina                  | EGRESOS  |    10
 Mantenimiento           | EGRESOS  |    11
(11 rows)
```

---

## Task 2 — Contract document (DONE)

Written at `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`.

G2 approved with 3 corrections applied:
1. **R9 wording** — rewritten to "inserts no duplicates; the 11 defaults remain 11 and any user-created centro is preserved." Typo "Fe insert" → "The insert."
2. **`valorUnitario` request type** — documented as `number | string` (Zod accepts both via `z.union([z.number(), z.string()])`).
3. **RBAC note** — AUDITOR/OPERADOR rows marked as "inherited pre-existing middleware behavior, not a decision of this feature — flagged to developer."

Sections covered: Schema (verbatim Prisma), JSON wire types table, 11-rows seed data, 9 endpoints with request/response/error shapes, RBAC matrix, error catalogue, RB-1 release preconditions, Wave 2 notes, Wave 3 notes, Deviations table.

---

## Task 3 — Service + routes + RBAC (DONE)

All 10 acceptance criteria pass. Each is shown below with its run command.

### AC1: POST with bogus valorTotal → stored valorTotal = "3000.00"

```bash
$ curl -s -b $COOKIE_ADMIN -X POST "$BASE/centro-costos/$CENTRO_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"AC1","cantidad":2,"valorUnitario":1500,"valorTotal":"999999.00","periodo":"2026-08"}'
```

```json
{"success":true,"data":{"id":8,"centroCostosId":62,"nombre":"AC1","notas":null,"cantidad":2,"valorUnitario":"1500.00","valorTotal":"3000.00","periodo":"2026-08-01",...}}
```
✅ PASS — stored `valorTotal = "3000.00"`, client-sent `999999.00` ignored.

### AC2: POST with `cantidad: 2.5` → 400 `field: "cantidad"`

```bash
$ curl -s -b $COOKIE_ADMIN -X POST "$BASE/centro-costos/$CENTRO_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"AC2","cantidad":2.5,"valorUnitario":1500,"periodo":"2026-08"}'
```

```json
{"success":false,"message":"Validation error","field":"cantidad","errors":{"cantidad":["Expected integer, received float"]}}
```
✅ PASS.

### AC3: POST with `periodo: "2026-08-17"` → stored `"2026-08-01"`

```bash
$ curl -s -b $COOKIE_ADMIN -X POST "$BASE/centro-costos/$CENTRO_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"AC3","valorUnitario":100,"periodo":"2026-08-17"}'
```

```json
{"success":true,"data":{"id":6,"...","periodo":"2026-08-01",...}}
```
✅ PASS — pure string math, no `new Date()` local parsing.

### AC3b (WI-3): POST with `periodo: "2026-08-31"` → stored `"2026-08-01"` (month boundary)

```bash
$ curl -s -b $COOKIE_ADMIN -X POST "$BASE/centro-costos/$CENTRO_ID/items" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"AC3b","valorUnitario":50,"periodo":"2026-08-31"}'
```

```json
{"success":true,"data":{"id":7,"...","periodo":"2026-08-01",...}}
```
✅ PASS — month boundary works.

### AC4: GET /balance?periodo=2026-08 → balance === totalIngresos − totalEgresos

```bash
$ curl -s -b $COOKIE_ADMIN "$BASE/centro-costos/balance?periodo=2026-08"
```

```json
{
  "success": true,
  "data": {
    "periodo": "2026-08-01",
    "porCentro": [...],
    "totalIngresos": "6375.00",
    "totalEgresos": "1.00",
    "balance": "6374.00"
  }
}
```
✅ PASS — balance = totalIngresos − totalEgresos (verified = 6374.00).

### AC5: GET /balance?periodo=1999-01 (empty) → 200 with zeros (NOT 404)

```bash
$ curl -s -b $COOKIE_ADMIN -w "HTTP %{http_code}\n" "$BASE/centro-costos/balance?periodo=1999-01"
```

```json
{"success":true,"data":{"periodo":"1999-01-01","porCentro":[],"totalIngresos":"0.00","totalEgresos":"0.00","balance":"0.00"}}
HTTP 200
```
✅ PASS.

### AC6: DELETE /:id on a centro with ítems → 409, ítems still present

```bash
$ curl -s -b $COOKIE_ADMIN -X DELETE "$BASE/centro-costos/$NEW_ID" -w "HTTP %{http_code}\n"
```

```json
{"success":false,"message":"El centro tiene ítems; desactívelo en lugar de eliminarlo","field":"centroCostosId"}
HTTP 409
```
✅ PASS. The item count for that centro in the post-failure items listing = 1 (still present).

### AC7: GERONTOLOGA → 403 DOMAIN_FORBIDDEN

```bash
$ curl -s -b $COOKIE_GERONTOLOGA -w "HTTP %{http_code}\n" "$BASE/centro-costos"
```

```json
{"success":false,"message":"Acceso no permitido para su perfil","code":"DOMAIN_FORBIDDEN"}
HTTP 403
```
✅ PASS.

### AC8: CONTRATOS → 200 (create + read + update)

```bash
$ curl -s -b $COOKIE_CONTRATOS -X POST "$BASE/centro-costos" -d '{"nombre":"Contratos Created","tipo":"INGRESOS"}' -w "HTTP %{http_code}\n"
HTTP 201
$ curl -s -b $COOKIE_CONTRATOS "$BASE/centro-costos" -w "HTTP %{http_code}\n" | head -c 200
{"success":true,"data":[...]} HTTP 200
$ curl -s -b $COOKIE_CONTRATOS -X PUT "$BASE/centro-costos/$CENTRO_ID" -d '{"descripcion":"updated by contratos"}' -w "HTTP %{http_code}\n"
HTTP 200
```
✅ PASS.

### AC9: PUT /centro-costos/items/:itemId reaches item handler (not shadowed by /:id)

```bash
$ curl -s -b $COOKIE_ADMIN -X PUT "$BASE/centro-costos/items/$ITEM_ID" \
  -H "Content-Type: application/json" \
  -d '{"notas":"AC9 marker"}'
```

```json
{"success":true,"data":{"id":4,"centroCostosId":61,"nombre":"x","notas":"AC9 marker","cantidad":1,"valorUnitario":"1.00","valorTotal":"1.00","periodo":"2026-08-01",...}}
```
✅ PASS — response includes item fields (`notas`, `valorUnitario`, `valorTotal`), proving it hit the item handler, not the centro handler.

### AC10: `npx tsc --noEmit` exits 0

```bash
$ cd backend && npx tsc --noEmit
$ echo "exit=$?"
exit=0
```
✅ PASS.

### Three issues found-and-resolved along the way

1. **PERIODO_SHORT regex missing capture groups** (caught at first AC4 run). The regex `/^\d{4}-\d{2}$/` had no parens, so `m[1]`/`m[2]` were `undefined`, producing `NaN` and `Invalid Date`. Fixed: `/^(\d{4})-(\d{2})$/`. 1-line bug, no data impact.
2. **Prisma Decimal serialization drops trailing zeros** (caught at AC1). `valorTotal.toString()` returned `"3000"`. Fixed with `.toFixed(2)` in `toItemDTO` so the JSON wire matches the contract.
3. **errorHandler didn't emit `field`** (caught at AC2). Zod 400 was `{success:false, message:"Validation error", errors:{...}}`. Fixed to also include `field: firstErrorPath`, matching contract §2.3.

---

## Task 4 — Backend smoke spec (DONE)

```bash
$ cd backend && TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list
```

```
Running 10 tests using 1 worker

  ✓   1 tests/centro-costos/centro-costos-smoke.spec.ts:77:3 › Centro de Costos — backend smoke (ago-5) › GET /centro-costos?tipo=INGRESOS → exactly 5 seeded centros in orden (10ms)
  ✓   2 tests/centro-costos/centro-costos-smoke.spec.ts:99:3 › Centro de Costos — backend smoke (ago-5) › GET /centro-costos?tipo=EGRESOS → exactly 6 seeded centros in orden (8ms)
  ✓   3 tests/centro-costos/centro-costos-smoke.spec.ts:117:3 › Centro de Costos — backend smoke (ago-5) › POST /:id/items with bogus valorTotal → stored valorTotal = "3000.00" (10ms)
  ✓   4 tests/centro-costos/centro-costos-smoke.spec.ts:135:3 › Centro de Costos — backend smoke (ago-5) › POST /:id/items with periodo="2026-08-17" → stored periodo = "2026-08-01" (9ms)
  ✓   5 tests/centro-costos/centro-costos-smoke.spec.ts:149:3 › Centro de Costos — backend smoke (ago-5) › POST /:id/items with periodo="2026-08-31" (month boundary) → stored 2026-08-01 (WI-3) (9ms)
  ✓   6 tests/centro-costos/centro-costos-smoke.spec.ts:163:3 › Centro de Costos — backend smoke (ago-5) › GET /balance?periodo=2026-08 → balance = totalIngresos - totalEgresos (9ms)
  ✓   7 tests/centro-costos/centro-costos-smoke.spec.ts:175:3 › Centro de Costos — backend smoke (ago-5) › GET /balance?periodo=1999-01 (empty) → 200 with all zeros, not 404 (8ms)
  ✓   8 tests/centro-costos/centro-costos-smoke.spec.ts:189:3 › Centro de Costos — backend smoke (ago-5) › E2E: create EGRESOS centro + ítem → balance rollup reflects it (27ms)
  ✓   9 tests/centro-costos/centro-costos-smoke.spec.ts:244:3 › Centro de Costos — backend smoke (ago-5) › GERONTOLOGA → 403 DOMAIN_FORBIDDEN on any /centro-costos route (6ms)
  ✓  10 tests/centro-costos/centro-costos-smoke.spec.ts:253:3 › Centro de Costos — backend smoke (ago-5) › CONTRATOS → 200 on GET /centro-costos (7ms)

  10 passed (897ms)
```

✅ ALL 10 PASS.

---

## Summary

| Task | Status | Evidence |
|---|---|---|
| T1 schema + migration + seed | ✅ | 5/5 AC pass, 11 seeded centros in orden |
| T2 contract doc | ✅ | G2 approved (with 3 corrections applied) |
| T3 service + routes + RBAC | ✅ | 10/10 AC pass, 3 issues found-and-fixed |
| T4 smoke spec | ✅ | 10/10 Playwright tests pass in 897ms |

**Files created/modified (W1 only)**:
- `backend/prisma/schema.prisma` (modified)
- `backend/prisma/migrations/20260805000000_centro_costos_ago5/migration.sql` (new)
- `backend/src/services/centroCostosService.ts` (new)
- `backend/src/services/empresaService.ts` (modified — seed constant + function only)
- `backend/src/routes/centroCostos.routes.ts` (new)
- `backend/src/routes/index.ts` (modified — added router.use)
- `backend/src/middleware/domainAccess.ts` (modified — added domain + matrix cells)
- `backend/src/middleware/errorHandler.ts` (modified — added field to 400 envelope)
- `backend/src/server.ts` (modified — startup seed hook)
- `backend/tests/centro-costos/centro-costos-smoke.spec.ts` (new)
- `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` (new)
- `development/feature-centro-costos-ago-5/tasks/W1-backend/{proposed-plan,progress-report,completion-report}.md` (new)

**Out of scope (not touched)**:
- `frontend/` (worker-2)
- `nominaService.ts`, `asistenciaService.ts`, `employeeService.ts`, nómina/empleado/contrato models
- Staging / AWS
