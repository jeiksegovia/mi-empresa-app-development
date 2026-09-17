# W8 · D14 GET /items/:itemId month guard — Completion Report

**Worker:** worker-8 (pt-backend-eng) · 2026-08-18
**Branch:** main
**Files touched:**
- `backend/src/routes/centroCostos.routes.ts` — added CONTRATOS month guard to GET `/items/:itemId` (same shape as PUT/DELETE).
- `backend/tests/centro-costos/centro-costos-smoke.spec.ts` — added 22nd test + tracking vars + cleanup.
- `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — RBAC row 7: `✅` → `only current month`.

---

## Acceptance verification

### 1. CONTRATOS on historical ítem → 403 `field=fecha`

Admin seeded a 1999-01-15 ítem (id 38) under centro 520. CONTRATOS GET against it:

```bash
$ curl -s -i -b /tmp/contratos.txt \
    "http://localhost:3101/api/v1/centro-costos/items/38" | head -1
HTTP/1.1 403 Forbidden

$ curl -s -b /tmp/contratos.txt \
    "http://localhost:3101/api/v1/centro-costos/items/38" | python3 -m json.tool
{
    "success": false,
    "message": "CONTRATOS solo puede consultar ítems del mes actual en curso",
    "field": "fecha"
}
```

`message` contains `mes actual`. `field === 'fecha'`. ✅

### 2. ADMIN on the same historical ítem → 200

```bash
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" \
    -b /tmp/admin.txt "http://localhost:3101/api/v1/centro-costos/items/38"
HTTP 200
```
✅

### 3. CONTRATOS on a current-month ítem → 200

Admin created a fresh EGRESOS ítem id 39 under seeded centro 22 with fecha `2026-08-18` (Bogotá today):

```bash
$ curl -s -o /dev/null -w "%{http_code}" -b /tmp/contratos.txt \
    "http://localhost:3101/api/v1/centro-costos/items/39"
200
$ curl -s -o /dev/null -w "%{http_code}" -b /tmp/admin.txt \
    "http://localhost:3101/api/v1/centro-costos/items/39"
200
```
✅

### 4. ADMIN on a missing ítem → 404 `field=itemId` (regression check, still works)

```bash
$ curl -s -i -b /tmp/admin.txt \
    "http://localhost:3101/api/v1/centro-costos/items/99999999" | head -1
HTTP/1.1 404 Not Found

$ curl -s -b /tmp/admin.txt \
    "http://localhost:3101/api/v1/centro-costos/items/99999999" | python3 -m json.tool
{
    "success": false,
    "message": "Ítem no encontrado",
    "field": "itemId"
}
```
✅

### 5. Playwright smoke suite green (21 → 22)

```bash
$ TEST_API_URL=http://localhost:3101 npx playwright test \
    tests/centro-costos --reporter=list
…
  ✓  20 tests/centro-costos/centro-costos-smoke.spec.ts:473:3 › … › CONTRATOS GET /items/:itemId with non-current-month fecha → 403 field=fecha (23ms)
…
  22 passed (1.3s)
```
✅ (Test #20 is the new W8 case. All 21 pre-existing cases still green.)

---

## What changed

### `backend/src/routes/centroCostos.routes.ts` (lines ~257–296)

The GET handler previously had no role check. It now mirrors the PUT/DELETE guard block already in the same file:

```ts
// aug-17 D14: CONTRATOS may only fetch ítems whose fecha is in the current Bogotá month.
if (isContratosRequest(req)) {
  const prisma = (await import('../config/database.js')).getPrisma()
  const item = await prisma.centroCostosItem.findUnique({
    where: { id: itemId },
    select: { fecha: true },
  })
  if (!item) {
    res.status(404).json({ success: false, message: 'Ítem no encontrado', field: 'itemId' })
    return
  }
  const today = serverTodayBogota()
  const itemYYYYMM = item.fecha.toISOString().slice(0, 7)
  if (itemYYYYMM !== today.slice(0, 7)) {
    res.status(403).json({
      success: false,
      message: 'CONTRATOS solo puede consultar ítems del mes actual en curso',
      field: 'fecha',
    })
    return
  }
}
```

- 404 if missing (same envelope as PUT/DELETE — `{ success:false, field:'itemId' }`).
- 403 with `field:'fecha'` and `message` containing `mes actual`.
- ADMIN / AUDITOR / OPERADOR skip the guard via `isContratosRequest()` short-circuit.
- Service-level `getItemWithRelations(itemId)` still throws `404` itself; the guard sits in front so CONTRATOS never sees a 200 for historical data.

Route order preserved: `/items/:itemId` stays **before** `/:id` (trap #2 still satisfied).

### `backend/tests/centro-costos/centro-costos-smoke.spec.ts`

Added two tracking vars (with cleanup) and one new test:

```ts
let historicalItemId: number;       // aug-17 D14: for GET /items/:itemId month-guard test
let historicalCentroId: number;
```

```ts
test('CONTRATOS GET /items/:itemId with non-current-month fecha → 403 field=fecha', async ({ request }) => {
  const createCentro = await request.post(`${API_BASE}/api/v1/centro-costos`, {
    headers: { Cookie: adminCookie },
    data: { nombre: `Test CC Hist ${Date.now()}`, tipo: 'EGRESOS', orden: 99 },
  });
  expect(createCentro.status()).toBe(201);
  historicalCentroId = (await createCentro.json()).data.id;

  const createItem = await request.post(`${API_BASE}/api/v1/centro-costos/${historicalCentroId}/items`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'Historical ítem',
      valorUnitario: 10,
      fecha: '1999-01-15',
      numeroFactura: 'D14-HIST-1',
      proveedor: 'Proveedor D14 Hist',
    },
  });
  expect(createItem.status()).toBe(201);
  historicalItemId = (await createItem.json()).data.id;

  const resp = await request.get(`${API_BASE}/api/v1/centro-costos/items/${historicalItemId}`, {
    headers: { Cookie: contratosCookie },
  });
  expect(resp.status()).toBe(403);
  const body = await resp.json();
  expect(body.field).toBe('fecha');
  expect(body.message).toMatch(/mes actual/);
});
```

`afterAll` deletes the historical ítem then centro (admin, so both succeed).

### Contract RBAC row updated

`development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` row 7:

```diff
-| 7 | GET | `/items/:itemId` | One ítem + centro + beneficiario for recibo | ✅ |
+| 7 | GET | `/items/:itemId` | One ítem + centro + beneficiario for recibo | only current month |
```

One-sentence rationale added implicitly: aligns the GET column with PUT (row 8) and DELETE (row 9).

---

## Operations

- `npx tsc --noEmit -p backend/tsconfig.json` → clean (no output, no errors).
- Restarted the `:3101` process: `kill 69475` (old tsx-watch PID returned by `lsof -i :3101`), then `nohup npm run dev > /tmp/backend-dev-w8.log 2>&1 &`. New PID 14595 now serves the updated route.
- No blanket `pkill`. No touching of the prod `:4142` bun service. No `migrate diff`. No frontend changes. No schema changes.

---

## Deviations / notes

- The new test follows the existing `fecha: '1999-01-15'` convention already used by sibling CONTRATOS 403 tests (`items?periodo=1999-01`, `POST /:id/items fecha=1999-01-15`). Using a deterministic fixed date keeps the test stable across month boundaries (e.g. on the 1st of a month Bogotá-time).
- The new test creates both the EGRESOS centro and the historical ítem in-test as admin rather than relying on a pre-seeded historical record — keeps the spec self-contained and reproducible on a fresh DB.
- `historicalCentroId` defaults to `undefined` until the test runs; `afterAll` already guards each cleanup with an `if (historicalItemId)` / `if (historicalCentroId)` short-circuit (matching the existing pattern for the other managed resources).
