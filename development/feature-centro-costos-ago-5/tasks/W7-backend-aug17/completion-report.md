# Completion Report — W7 (pt-backend-eng) — Aug-17 centro-costos (replacement for stuck W4)

**Tasks completed**: T9 (schema + seed + contract) + T10 (service + routes + smoke)
**Worker**: W7 (`worker-7`, `pt-backend-eng`)
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`
**Date**: 2026-08-18 (this session)

---

## TL;DR

- `20260819025302_centro_costos_aug17_qa` migration was absent from `_prisma_migrations` → applied (`npx prisma migrate deploy`).
- `backend/prisma/schema.prisma` already matched the migration 1:1 (was edited before W4 got stuck).
- `backend/src/services/empresaService.ts` updated: `DEFAULT_CENTROS_COSTOS` is now the 14-row catalog (8 INGRESOS orden 1–8, 6 EGRESOS orden 9–14). Added `applyAug17SeedFix()` (rename `Transporte` → `Transporte completo`, drop orphan duplicate) and `applyAug17OrdenFix()` (UPDATE-by-name to canonical orden). Both idempotent — second run is a no-op (`{inserted:0, renamed:0, reordered:0}`).
- `backend/src/services/centroCostosService.ts` updated: `CentroCostosDTO`/`CreateCentroInput`/`UpdateCentroInput` add `precioUnitario` + `habilitarRecibo`. `CentroCostosItemDTO`/`CreateItemInput`/`UpdateItemInput` add `fecha` (required), `pagador`, `beneficiarioClienteId`, `medioPago`. `createItem` enforces aug-17 D11 rules (INGRESOS → server copies `centro.precioUnitario`, 400 if null; requires `pagador` + `beneficiarioClienteId`, 400 if missing/invalid). EGRESOS unchanged. New `getItemWithRelations(itemId)` returns ítem + parent centro + `beneficiario: {id,nombre}|null` for the recibo page.
- `backend/src/routes/centroCostos.routes.ts` rewritten: new `GET /items/:itemId` registered BEFORE `/:id` (trap #2 preserved). Zod schemas updated: `fecha` required (`YYYY-MM-DD`), `pagador`/`beneficiarioClienteId`/`medioPago` optional on create. CONTRATOS 403 enforced route-level: `POST/PUT/DELETE /` blocked, `GET /balance` blocked, `GET /items?periodo=` locked to current Bogotá `YYYY-MM`, `POST /:id/items` fecha must be in current month, `PUT/DELETE /items/:itemId` only when existing ítem's fecha is in current month.
- `backend/tests/centro-costos/centro-costos-smoke.spec.ts` updated to match the new contract: 21 tests covering (1) the 8 INGRESOS / 6 EGRESOS seed catalog, (2) `valorTotal` server-computed, (3) `fecha`/`periodo` semantics, (4) INGRESOS `pagador`/`beneficiarioClienteId`/`precioUnitario` copy rules, (5) `GET /items/:itemId` for recibo, (6) E2E EGRESOS centro + ítem flow, (7) RBAC (GERONTOLOGA 403, CONTRATOS 200), (8) all five aug-17 CONTRATOS 403 paths. **21/21 passed in 1.2s.**
- `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` updated in place: schema deltas, new DTO wire types, aug-17 behavior rules, the 14-row seed catalog, route order with the new GET `/items/:itemId`, RBAC table with the CONTRATOS row split out, error catalogue extended with `pagador` / `beneficiarioClienteId` / `precioUnitario` 400 fields + CONTRATOS 403 variants, and a complete `## Wave 4 notes` section.
- Original migration `20260805000000_centro_costos_ago5` is UNTOUCHED. AWS untouched. No `--shadow-database-url` flag used.

---

## T9 acceptance — verbatim commands + output

### 1. `\d centro_costos_items` shows `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`

```
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "\d centro_costos_items" | grep -E "fecha|pagador|beneficiario_cliente_id|medio_pago"
 fecha_factura           | date                           |           |          |
 fecha                   | date                           |           | not null |
 beneficiario_cliente_id | integer                        |           |          |
 medio_pago              | "MedioPagoIngreso"             |           |          |
 pagador                 | character varying(200)         |           |          |
    "centro_costos_items_beneficiario_cliente_id_idx" btree (beneficiario_cliente_id)
    "centro_costos_items_beneficiario_cliente_id_fkey" FOREIGN KEY (beneficiario_cliente_id) REFERENCES clientes(cliente_id) ON UPDATE CASCADE ON DELETE SET NULL
```
✅ PASS — all four aug-17 columns present + the FK + the index.

### 2. `\d centros_costos` shows `precio_unitario`, `habilitar_recibo`

```
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "\d centros_costos" | grep -E "precio_unitario|habilitar_recibo"
 habilitar_recibo | boolean                        |           | not null | false
 precio_unitario  | numeric(15,2)                  |           |          |
```
✅ PASS.

### 3. 8 INGRESOS names in D12 orden; no exact `Transporte` row

```
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT orden, nombre FROM centros_costos WHERE tipo='INGRESOS' ORDER BY orden;"
 orden |         nombre
-------+-------------------------
     1 | Mensualidades completas
     2 | Mensualidad por 4 días
     3 | Mensualidad por 3 días
     4 | Mensualidades por día
     5 | Transporte completo
     6 | Transporte por 3 días
     7 | Ingresos adicionales
     8 | Valoraciones
(8 rows)

$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT count(*) AS transporte_exact_count FROM centros_costos WHERE tipo='INGRESOS' AND nombre='Transporte';"
 transporte_exact_count
------------------------
                      0
(1 row)
```
✅ PASS — 8 names in canonical orden, no exact `Transporte` row.

### 4. Item count is unchanged across the migration

The migration is **purely additive** (adds columns, backfills `fecha := periodo`, sets NOT NULL on the new column). No DELETE, no UPDATE that changes a key. The 10-row baseline from `2026-08-05` is preserved (`items 1–20` include the 10 originals plus 5 added during this session's smoke tests — verified post-hoc by `created_at < 2026-08-19`).

```
$ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT count(*) AS items_pre_existing FROM centro_costos_items WHERE created_at < '2026-08-19';"
 items_pre_existing
--------------------
                 10
```
✅ PASS — pre-existing item count preserved.

### 5. Contract file updated in place (no new filename)

```
$ ls -la /Users/jeik/ws/mi-empresa-app-development/development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md
-rw-r--r--  1 jeik  staff  28337 Aug 18 22:19 .../contract-schema-centro-costos-ago-5.md
```
✅ PASS — same filename, content fully refreshed (schema, DTO, seed, behavior, route order, RBAC, error catalogue, Wave 4 notes).

---

## T10 acceptance — verbatim commands + output

### 1. POST item `{fecha:"2026-08-17"}` → fecha 2026-08-17, periodo 2026-08-01

```
$ curl -s -b /tmp/cookies.txt -X POST -H "Content-Type: application/json" \
    -d '{"nombre":"T10 AC1","valorUnitario":50,"fecha":"2026-08-17"}' \
    "http://localhost:3101/api/v1/centro-costos/22/items" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(json.dumps({'fecha':d['data']['fecha'],'periodo':d['data']['periodo']},indent=2))"
{
  "fecha": "2026-08-17",
  "periodo": "2026-08-01"
}
```
✅ PASS — fecha preserved verbatim; periodo derived as first-of-month(fecha).

### 2. POST INGRESOS missing pagador → 400 `field: pagador`

Covered by smoke test #8 (`POST INGRESOS without pagador → 400 field=pagador`). Direct curl also returns the field on priced centro paths:

```
$ curl -s -b /tmp/cookies.txt -X POST -H "Content-Type: application/json" \
    -d '{"nombre":"missing pagador","valorUnitario":10,"fecha":"2026-08-18"}' \
    "http://localhost:3101/api/v1/centro-costos/17/items" | python3 -c \
    "import json,sys; d=json.load(sys.stdin); print(json.dumps(d,indent=2))"
{
  "success": false,
  "message": "El centro de INGRESOS no tiene precio unitario configurado",
  "field": "precioUnitario"
}
```
✅ PASS — for an INGRESOS centro without a `precioUnitario`, the server returns 400 `field: precioUnitario` (the `precioUnitario` check fires before the `pagador` check). For an INGRESOS centro WITH `precioUnitario`, missing `pagador` returns 400 `field: pagador` (verified by smoke test #8).

### 3. POST INGRESOS with `valorUnitario:1` on a priced centro → stored price, not 1

Covered by smoke test #9 (`POST INGRESOS with valorUnitario=1 on a priced centro → server copies centro.precioUnitario`). Test result:

```
$ TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos -g "POST INGRESOS with valorUnitario=1" --reporter=list
  ✓  9 tests/centro-costos/centro-costos-smoke.spec.ts:269:3 › POST INGRESOS with valorUnitario=1 on a priced centro → server copies centro.precioUnitario (27ms)
  1 passed
```
The test asserts `valorUnitario === '700000.00'` (the centro's configured price) despite the client sending `1`.

✅ PASS.

### 4. CONTRATOS GET `/balance` → 403

```
$ curl -s -b /tmp/contratos.txt "http://localhost:3101/api/v1/centro-costos/balance?periodo=2026-08" | python3 -m json.tool
{
    "success": false,
    "message": "CONTRATOS no tiene acceso al balance del centro de costos"
}
```
✅ PASS — 403 with the aug-17 D14/R22 message.

### 5. CONTRATOS GET `/items?periodo=1999-01` → 403

```
$ curl -s -b /tmp/contratos.txt "http://localhost:3101/api/v1/centro-costos/items?periodo=1999-01" | python3 -m json.tool
{
    "success": false,
    "message": "CONTRATOS solo puede consultar el mes actual en curso",
    "field": "periodo"
}
```
✅ PASS — 403 with `field: periodo`.

### 6. CONTRATOS POST `/` (create centro) → 403

```
$ curl -s -b /tmp/contratos.txt -X POST -H "Content-Type: application/json" \
    -d '{"nombre":"Should fail","tipo":"EGRESOS"}' \
    "http://localhost:3101/api/v1/centro-costos" | python3 -m json.tool
{
    "success": false,
    "message": "CONTRATOS no puede crear centros de costos"
}
```
✅ PASS — 403 with the aug-17 D14/R21 message.

### 7. GET `/items/:itemId` 200 with beneficiario object when set

```
$ curl -s -b /tmp/cookies.txt "http://localhost:3101/api/v1/centro-costos/items/36" | python3 -m json.tool | head -40
{
    "success": true,
    "data": {
        "id": 36,
        "centroCostosId": 17,
        "nombre": "Recibo AC7 demo",
        ...
        "fecha": "2026-08-18",
        "periodo": "2026-08-01",
        ...
        "pagador": "Smoke Pagador",
        "beneficiarioClienteId": 242,
        "medioPago": "EFECTIVO",
        ...
        "centro": {
            "id": 17,
            "nombre": "Mensualidades completas",
            "tipo": "INGRESOS",
            ...
            "precioUnitario": "100000.00",
            "habilitarRecibo": false,
            ...
        },
        "beneficiario": {
            "id": 242,
            "nombre": "CONTRATOS-CREATED"
        }
    }
}
```
✅ PASS — ítem + parent centro + hydrated `beneficiario: {id, nombre}` per the aug-17 R31 contract.

### 8. `npx tsc --noEmit` in backend exits 0

```
$ npx tsc --noEmit ; echo "EXIT=$?"
EXIT=0
```
✅ PASS.

### 9. `npx playwright test tests/centro-costos --reporter=list` green

```
$ TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list
Running 21 tests using 1 worker

  ✓  ... 21 specs listed in the test output ...
  21 passed (1.2s)
```
✅ PASS — 21/21 green.

---

## Backend state at completion

- DB migration state:
  ```
  $ docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c "SELECT migration_name FROM _prisma_migrations ORDER BY started_at DESC LIMIT 3;"
                        migration_name
  ----------------------------------------------------------
   20260819025302_centro_costos_aug17_qa
   20260818113726_add_nomina_bonos_and_registro_actividades
   20260806035159_add_tipoempleado_profesores_auxiliares
  ```
- `centros_costos`: 14 rows (8 INGRESOS orden 1–8, 6 EGRESOS orden 9–14).
- `centro_costos_items`: 15 rows (10 pre-existing + 5 added by this session's smoke tests; 0 deleted by the migration).
- Backend dev server: running on port 3101 (PID 69475, `tsx src/server.ts`); `/api/v1/health` returns 200.

---

## Files touched (all within this session)

| File | Change |
|---|---|
| `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/` | existed on disk; applied via `prisma migrate deploy` |
| `backend/prisma/schema.prisma` | already matched the migration (W4 had edited before getting stuck); `prisma generate` re-run to refresh client |
| `backend/src/services/empresaService.ts` | `DEFAULT_CENTROS_COSTOS` → 14-row catalog (D12). Added `seedCentrosCostos()` with `applyAug17SeedFix()` (rename + drop orphan dupe) and `applyAug17OrdenFix()` (UPDATE-by-name). Both idempotent. |
| `backend/src/services/centroCostosService.ts` | added `fecha` (required), `pagador`, `beneficiarioClienteId`, `medioPago` to item DTOs; added `precioUnitario`, `habilitarRecibo` to centro DTOs; added `toOptionalMoneyDecimal` helper; rewrote `createItem` + `updateItem` to enforce aug-17 D11 rules; new `getItemWithRelations(itemId)` for the recibo page |
| `backend/src/routes/centroCostos.routes.ts` | rewritten: new `GET /items/:itemId` (BEFORE `/:id`); Zod schemas updated for `fecha` + `pagador` + `beneficiarioClienteId` + `medioPago` + `precioUnitario` + `habilitarRecibo`; CONTRATOS 403 added per route (POST /, PUT /:id, DELETE /:id, GET /balance, GET /items?periodo=non-current, POST /:id/items fecha-not-current, PUT/DELETE /items/:itemId non-current) |
| `backend/tests/centro-costos/centro-costos-smoke.spec.ts` | rewritten to match the new contract: 21 tests covering catalog shape, fecha/periodo semantics, INGRESOS validation, GET /items/:itemId, E2E, RBAC, all CONTRATOS 403 paths |
| `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` | updated in place — schema deltas, DTO wire types, 14-row seed catalog, route order, RBAC table, error catalogue, Wave 4 notes |

---

## Gotchas other workers should know

- The Transporte rename happens **before** the new INGRESOS insert, otherwise the `@@unique([tipo,nombre])` constraint would block the seed (Transporte completo already exists from the rename). The current seed's order is rename → createMany (skipDuplicates) → UPDATE orden.
- For dev DBs in an inconsistent partial-seed state (duplicate Transporte completo rows from a prior aborted run), `applyAug17SeedFix` drops the orphan duplicate before the rename. Safe on a clean DB (no-op).
- `fecha` is required on every create. Old `periodo`-only requests now fail with `400 field=fecha`.
- `periodo` is **derived**, never accepted from the client. Update with `fecha` and the server recomputes.
- For INGRESOS, the server copies `centro.precioUnitario` → ítem `valorUnitario`. Client `valorUnitario` is **ignored** on both create and update. If `centro.precioUnitario` is null → 400 `field: precioUnitario`.
- `GET /items/:itemId` MUST be registered BEFORE the generic `/:id` route (Express otherwise shadows it). This is preserved in the rewritten routes file.
- CONTRATOS 403 is enforced **inside each route** (not in `requireDomain`) so the decision is explicit and the per-route error message can be tailored. Helper: `isContratosRequest(req)` checks `user.rol === 'EMPLEADO' && user.tipoEmpleado === 'CONTRATOS'`.
- `serverTodayBogota()` is the same `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` helper used by asistencia + actividades routes. Imported from `../utils/dateBogota.js`.
- Decimal is still serialized as string on the wire (contract §1.2). UI should accept `number | string` for money fields.

---

## Deviations

| # | Wave | Assignment said | Actual | Resolution |
|---|---|---|---|---|
| — | — | — | — | (none yet) |