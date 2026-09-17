# Contract — Centro de Costos (ago-5 + aug-17)

**Status**: LIVE (aug-17 update — Wave 4)
**Author**: W1 `pt-backend-eng` (Wave 1 + Wave 4 maintainer)
**Read by**: W2 (frontend page + matrix mirror), W3 (test suite — must match exactly)
**Implementation files**: `backend/src/services/centroCostosService.ts`, `backend/src/routes/centroCostos.routes.ts`

This is the **single source of truth**. Two other workers will build the UI and the QA suite against this document without reading the backend source. Every field name, every wire type, every error `field` value must be exact. If you discover a discrepancy, append it to the **Deviations table** at the bottom — do NOT silently work around it.

---

## 1. Data model

### 1.1 Prisma schema (verbatim — additions bolded)

```prisma
enum TipoCentroCostos {
  INGRESOS
  EGRESOS
}

enum MedioPagoIngreso { EFECTIVO  TRANSFERENCIA }   // aug-17 D11

model CentroCostos {
  id             Int              @id @default(autoincrement()) @map("centro_id")
  nombre         String           @db.VarChar(200)
  tipo           TipoCentroCostos
  descripcion    String?          @db.Text
  activo         Boolean          @default(true)
  orden          Int              @default(0)
  // aug-17 D11: per-centro unit price for INGRESOS — copied into ítems on create
  precioUnitario Decimal?         @map("precio_unitario") @db.Decimal(15, 2)
  // aug-17 D13: enables print-recibo CTA after creating an ítem on this centro
  habilitarRecibo Boolean         @default(false) @map("habilitar_recibo")
  createdAt      DateTime         @default(now())  @map("created_at")
  updatedAt      DateTime         @updatedAt       @map("updated_at")

  // Relations
  items          CentroCostosItem[]

  @@unique([tipo, nombre])
  @@index([tipo, activo])
  @@map("centros_costos")
}

model CentroCostosItem {
  id                    Int       @id @default(autoincrement()) @map("item_id")
  centroCostosId        Int       @map("centro_costos_id")
  nombre                String    @db.VarChar(200)
  notas                 String?   @db.Text
  cantidad              Int       @default(1) // D5: integer (developer call, 2026-08-05)
  valorUnitario         Decimal   @map("valor_unitario") @db.Decimal(15, 2)
  valorTotal            Decimal   @map("valor_total")    @db.Decimal(15, 2) // persisted, server-computed
  // aug-17 D10: required day-level date. Periodo is still normalized to
  // first-of-month(fecha) for bucket queries. Existing rows backfilled from
  // periodo before adding NOT NULL.
  fecha                 DateTime  @db.Date
  periodo               DateTime  @db.Date                                   // normalized to day 1
  numeroFactura         String?   @map("numero_factura") @db.VarChar(100)    // egreso-only, optional
  proveedor             String?   @map("proveedor") @db.VarChar(200)         // egreso-only, optional
  fechaFactura          DateTime? @map("fecha_factura")  @db.Date            // egreso-only, optional
  // aug-17 D11: INGRESOS-only metadata. Stored null for EGRESOS.
  pagador               String?   @map("pagador") @db.VarChar(200)
  beneficiarioClienteId Int?      @map("beneficiario_cliente_id")
  medioPago             MedioPagoIngreso? @map("medio_pago")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt      @map("updated_at")

  // Relations
  centroCostos CentroCostos @relation(fields: [centroCostosId], references: [id], onDelete: Restrict)
  beneficiario Cliente?     @relation("ClienteBeneficiarioItems", fields: [beneficiarioClienteId], references: [id], onDelete: SetNull)

  @@index([periodo])
  @@index([centroCostosId, periodo])
  @@index([beneficiarioClienteId])
  @@map("centro_costos_items")
}

model Cliente {
  // …
  itemsComoBeneficiario CentroCostosItem[] @relation("ClienteBeneficiarioItems")  // aug-17 back-relation
}
```

### 1.2 JSON wire types — Read these before you write any TS interface

Prisma serializes `Decimal` over JSON as a **string** (e.g. `"1500.00"`), NOT a number. The frontend must accept `number | string` for money fields and convert with `parseFloat` / `Number()` only at the rendering layer. Nomina already does this — copy the pattern.

| TS field (DB) | JSON wire type | Notes |
|---|---|---|
| `id` (centro) | `number` | integer |
| `id` (item) | `number` | integer |
| `centroCostosId` | `number` | integer |
| `nombre` | `string` | |
| `tipo` | `"INGRESOS" \| "EGRESOS"` | enum string |
| `descripcion` | `string \| null` | |
| `activo` | `boolean` | |
| `orden` | `number` | integer |
| `precioUnitario` (centro) | `string \| null` | aug-17 D11; Decimal serialized as string |
| `habilitarRecibo` (centro) | `boolean` | aug-17 D13; default `false` |
| `cantidad` | `number` | integer (validator: `z.number().int().positive()`) |
| `valorUnitario` (item request, EGRESOS only) | `number \| string` | Zod accepts both. The server coerces to a 2dp Decimal string before persisting. IGNORED on INGRESOS — server copies `centro.precioUnitario` (R26, D11). |
| `valorUnitario` (item response) | `string` | Decimal — e.g. `"1500.00"` |
| `valorTotal` (request) | ignored | Zod schema does NOT read `input.valorTotal`. The server always overwrites it with `cantidad × valorUnitario`. (D6) |
| `valorTotal` (response) | `string` | Decimal — server-computed, client-sent value ignored |
| `fecha` (item, aug-17 D10) | `string` | `YYYY-MM-DD`, required on every ítem |
| `periodo` | `string` | `YYYY-MM-DD`, always day 1 of fecha's month |
| `pagador` (item, aug-17 D11) | `string \| null` | required on INGRESOS, stored null on EGRESOS |
| `beneficiarioClienteId` (item, aug-17 D11) | `number \| null` | required on INGRESOS, must reference an existing `Cliente.id` |
| `medioPago` (item, aug-17 D11) | `"EFECTIVO" \| "TRANSFERENCIA" \| null` | optional on INGRESOS, stored null on EGRESOS |
| `numeroFactura`, `proveedor` | `string \| null` | egreso-only (optional on ingreso) |
| `fechaFactura` | `string \| null` | `YYYY-MM-DD`, egreso-only |
| `createdAt`, `updatedAt` | `string` | ISO 8601 |

### 1.3 Seed data — 14 default centros (R7/R8 + aug-17 D12)

| `nombre` | `tipo` | `orden` |
|---|---|---|
| Mensualidades completas | INGRESOS | 1 |
| Mensualidad por 4 días | INGRESOS | 2 |
| Mensualidad por 3 días | INGRESOS | 3 |
| Mensualidades por día | INGRESOS | 4 |
| Transporte completo | INGRESOS | 5 |
| Transporte por 3 días | INGRESOS | 6 |
| Ingresos adicionales | INGRESOS | 7 |
| Valoraciones | INGRESOS | 8 |
| Refrigerios | EGRESOS | 9 |
| Aseo | EGRESOS | 10 |
| Papelería | EGRESOS | 11 |
| Eventos | EGRESOS | 12 |
| Nómina | EGRESOS | 13 |
| Mantenimiento | EGRESOS | 14 |

The legacy `Transporte` row was renamed to `Transporte completo` via a startup data-fix (`empresaService.applyAug17SeedFix()`). Any ítems that belonged to Transporte now belong to `Transporte completo` (same row id, same foreign keys). The Nómina centro is manual only — `nominaService` is NOT imported (D3). R9 idempotency holds: a re-run is a no-op (rename matches zero rows; UPDATE-by-name matches 14 rows whose orden already equals the target; createMany skips 14 existing rows).

### 1.4 Behavior rules

- **`valorTotal` is server-computed (D6/R4)**: stored value = `cantidad × valorUnitario`. Always. A client-sent `valorTotal` is **ignored** — never trusted. The service never reads `input.valorTotal`.
- **`periodo` is derived from `fecha` (aug-17 D10/R24)**: `periodo = fecha.slice(0,7) + '-01'`. Periodo is **pure string math**: `"2026-08-17"` → `"2026-08-01"`. Never `new Date("2026-08-17")` (UTC drift risk in Bogotá). Balanced month range: `gte("2026-08-01")` and `lt("2026-09-01")`. `fecha` is REQUIRED on every create (D10). `periodo` is server-set — clients may not send it.
- **`cantidad` is Int (D5)**: validator `z.number().int().positive()` (default 1). Fractional values rejected with 400 `field: 'cantidad'`.
- **INGRESOS precioUnitario copy (aug-17 D11/R26)**: server ignores client `valorUnitario` on INGRESOS create/update; copies `centro.precioUnitario` to the ítem's `valorUnitario`. If the centro's `precioUnitario` is null → 400 `field: 'precioUnitario'`.
- **INGRESOS required fields (aug-17 D11/R25)**: `pagador` (non-empty string) and `beneficiarioClienteId` (must exist on `clientes`) are required on INGRESOS create/update. Missing → 400 with the field's name. EGRESOS stores these as null.
- **Centro delete is Restrict (D8/R13)**: deleting a centro with ≥1 ítem returns 409 with `field: 'centroCostosId'`. Use `activo: false` to retire.
- **CONTRATOS write scope (aug-17 D14)**: a CONTRATOS user may create / update / delete an ítem ONLY if its `fecha` is in the current Bogotá `YYYY-MM`. CONTRATOS may NOT create / update / delete centros. CONTRATOS may NOT call `/balance`. CONTRATOS may NOT call `/items?periodo=<non-current-month>`.

---

## 2. API surface

Base path: `/api/v1/centro-costos`
All routes require `authMiddleware()` + `requireDomain('centro-costos')`. Routes are registered in this order (trap #2 — the `/:itemId` GET must precede the generic `/:id` so Express doesn't shadow it):

```
GET  /items/:itemId          ← BEFORE /:id
PUT  /items/:itemId          ← BEFORE /:id
DEL  /items/:itemId          ← BEFORE /:id
GET  /items?periodo=YYYY-MM
GET  /balance?periodo=YYYY-MM
POST /:id/items
PUT  /:id
DEL  /:id
GET  /
POST /
```

### 2.1 Endpoints

| # | Method | Path | Purpose | CONTRATOS |
|---|---|---|---|---|
| 1 | GET | `/` | List centros | ✅ |
| 2 | POST | `/` | Create centro | ❌ 403 |
| 3 | PUT | `/:id` | Update centro | ❌ 403 |
| 4 | DELETE | `/:id` | Delete centro — 409 if it has ítems | ❌ 403 |
| 5 | GET | `/items?periodo=YYYY-MM` | Ítems of a month grouped by centro | only current month |
| 6 | POST | `/:id/items` | Create ítem under a centro | only current month |
| 7 | GET | `/items/:itemId` | One ítem + centro + beneficiario for recibo | only current month |
| 8 | PUT | `/items/:itemId` | Update ítem | only current month |
| 9 | DELETE | `/items/:itemId` | Delete ítem | only current month |
| 10 | GET | `/balance?periodo=YYYY-MM` | `{ porCentro[], totalIngresos, totalEgresos, balance }` | ❌ 403 |

### 2.2 Global envelope

Success: `{ success: true, data: <payload> }`
Error:   `{ success: false, message: string, field?: string }` — `field` advertised by 400/409/403.

### 2.3 Request/response shapes

#### GET / — List centros

Query: `?tipo=INGRESOS|EGRESOS` (optional), `?activo=true|false` (optional, default `true`).

200 `{ success: true, data: CentroCostos[] }` — sorted by `tipo ASC, orden ASC, nombre ASC`.

```ts
interface CentroCostos {
  id: number
  nombre: string
  tipo: 'INGRESOS' | 'EGRESOS'
  descripcion: string | null
  activo: boolean
  orden: number
  precioUnitario: string | null   // aug-17 D11 (Decimal as string)
  habilitarRecibo: boolean        // aug-17 D13
  createdAt: string
  updatedAt: string
}
```

#### POST / — Create centro

Body:
```json
{
  "nombre": "string (1..200)",
  "tipo": "INGRESOS | EGRESOS",
  "descripcion": "string?",
  "orden": "number int (default 0)",
  "precioUnitario": "number | string | null?  (INGRESOS only)",
  "habilitarRecibo": "boolean?  (INGRESOS only)"
}
```

201 `{ success: true, data: CentroCostos }`
400 `{ success: false, message, field: 'nombre' | 'tipo' | 'orden' | 'precioUnitario' }`
403 (CONTRATOS) `{ success: false, message: 'CONTRATOS no puede crear centros de costos' }`

#### PUT /:id — Update centro

Path: `id: number`.
Body (all optional except type-strict):
```json
{
  "nombre": "string?",
  "descripcion": "string|null?",
  "activo": "boolean?",
  "orden": "number int?",
  "precioUnitario": "number | string | null?",
  "habilitarRecibo": "boolean?"
}
```

200 `{ success: true, data: CentroCostos }`
400 `{ success: false, message, field: '...' }`
403 (CONTRATOS) `{ success: false, message: 'CONTRATOS no puede editar centros de costos' }`
404 `{ success: false, message: 'Centro no encontrado', field: 'id' }`

#### DELETE /:id — Delete centro

204 (no body) on success.
403 (CONTRATOS) `{ success: false, message: 'CONTRATOS no puede eliminar centros de costos' }`
404 `{ success: false, message: 'Centro no encontrado', field: 'id' }`
409 `{ success: false, message: 'El centro tiene ítems; desactívelo en lugar de eliminarlo', field: 'centroCostosId' }`

#### GET /items?periodo=YYYY-MM — Items of a month

Query: `periodo` required, `YYYY-MM`.
403 (CONTRATOS, non-current month) `{ success: false, message: 'CONTRATOS solo puede consultar el mes actual en curso', field: 'periodo' }`.

200 `{ success: true, data: { periodo: "YYYY-MM-DD", grupos: GrupoCentro[] } }`

```ts
interface GrupoCentro {
  centro: CentroCostos
  items: CentroCostosItem[]
  subtotal: string // Decimal serialized as string
}
interface CentroCostosItem {
  id: number
  centroCostosId: number
  nombre: string
  notas: string | null
  cantidad: number
  valorUnitario: string // Decimal
  valorTotal: string     // Decimal
  fecha: string          // YYYY-MM-DD, aug-17 D10
  periodo: string        // YYYY-MM-DD, always day 1
  numeroFactura: string | null
  proveedor: string | null
  fechaFactura: string | null
  pagador: string | null                // aug-17 D11
  beneficiarioClienteId: number | null  // aug-17 D11
  medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | null  // aug-17 D11
  createdAt: string
  updatedAt: string
}
```

If a month has no ítems, returns `grupos: []` (NOT 404).
400 when `periodo` is missing/malformed: `{ success: false, message, field: 'periodo' }`.

#### GET /items/:itemId — Single ítem for recibo (aug-17 R31)

Path: `itemId: number`. MUST be registered before `/:id` (trap #2).

200 `{ success: true, data: ItemWithRelations }`

```ts
interface ItemWithRelations extends CentroCostosItem {
  centro: CentroCostos
  beneficiario: { id: number; nombre: string } | null
}
```

404 `{ success: false, message: 'Ítem no encontrado', field: 'itemId' }`.

#### POST /:id/items — Create ítem

Path: `id: number` (centro id).
Request body:
```json
{
  "nombre": "string (1..200)",
  "notas": "string?",
  "cantidad": "number int positive (default 1)",
  "valorUnitario": "number | string (EGRESOS only; ignored on INGRESOS)",
  "fecha": "YYYY-MM-DD (REQUIRED, aug-17 D10)",
  "numeroFactura": "string? (egreso-only)",
  "proveedor": "string? (egreso-only)",
  "fechaFactura": "YYYY-MM-DD? (egreso-only)",
  "pagador": "string? (required on INGRESOS, aug-17 D11)",
  "beneficiarioClienteId": "number? (required on INGRESOS, aug-17 D11)",
  "medioPago": "EFECTIVO|TRANSFERENCIA? (optional on INGRESOS, aug-17 D11)"
}
```

Server behavior:
- `fecha` is REQUIRED (`YYYY-MM-DD`). Missing/malformed → 400 `field: 'fecha'`. (D10)
- `periodo` is **always** computed as `fecha.slice(0,7) + '-01'`. Client-sent `periodo` is ignored. (D10)
- `valorTotal` is computed as `cantidad × valorUnitario` (D6). A client-sent `valorTotal` is dropped on the floor.
- INGRESOS: server copies `centro.precioUnitario` → ítem `valorUnitario`; client `valorUnitario` ignored. If `centro.precioUnitario` is null → 400 `field: 'precioUnitario'`.
- INGRESOS: server requires `pagador` (non-empty) and `beneficiarioClienteId` (existing Cliente). Missing → 400 with the field's name.
- EGRESOS: server requires client-sent `valorUnitario` (positive). The ingreso fields are stored null.
- `numeroFactura`, `proveedor`, `fechaFactura` are accepted on any centro but typically only set when centro.tipo === 'EGRESOS'.

403 (CONTRATOS, non-current-month fecha) `{ success: false, message: 'CONTRATOS solo puede registrar ítems del mes actual en curso', field: 'fecha' }`.

201 `{ success: true, data: CentroCostosItem }`
400 `{ success: false, message, field: 'nombre' | 'cantidad' | 'valorUnitario' | 'fecha' | 'pagador' | 'beneficiarioClienteId' | 'precioUnitario' | ... }`
404 `{ success: false, message: 'Centro no encontrado', field: 'id' }`

#### PUT /items/:itemId — Update ítem

Path: `itemId: number`.
Body:
```json
{
  "nombre": "string?",
  "notas": "string|null?",
  "cantidad": "number int positive?",
  "valorUnitario": "number | string (EGRESOS only; ignored on INGRESOS)?",
  "fecha": "YYYY-MM-DD?",
  "periodo": "YYYY-MM or YYYY-MM-DD? (server recomputes from fecha)",
  "numeroFactura": "string|null?",
  "proveedor": "string|null?",
  "fechaFactura": "YYYY-MM-DD|null?",
  "pagador": "string|null?",
  "beneficiarioClienteId": "number|null?",
  "medioPago": "EFECTIVO|TRANSFERENCIA|null?"
}
```

Server recomputes `valorTotal` whenever `cantidad` or `valorUnitario` change.
Server recomputes `periodo` from `fecha` whenever `fecha` changes (D10).
On INGRESOS, `valorUnitario` is server-managed — client-sent value is ignored.

403 (CONTRATOS, non-current-month ítem) `{ success: false, message: 'CONTRATOS solo puede editar ítems del mes actual en curso', field: 'fecha' }`.

200 `{ success: true, data: CentroCostosItem }`
400 / 404 same shape as POST.

#### DELETE /items/:itemId — Delete ítem

204 (no body).
403 (CONTRATOS, non-current-month ítem) `{ success: false, message: 'CONTRATOS solo puede eliminar ítems del mes actual en curso', field: 'fecha' }`.
404 `{ success: false, message: 'Ítem no encontrado', field: 'itemId' }`

#### GET /balance?periodo=YYYY-MM — Monthly rollup

Query: `periodo` required, `YYYY-MM`.

403 (CONTRATOS) `{ success: false, message: 'CONTRATOS no tiene acceso al balance del centro de costos' }` (no `field`).

200 `{ success: true, data: BalanceMes }`

```ts
interface BalanceMes {
  periodo: string          // YYYY-MM-DD (day 1)
  porCentro: BalancePorCentro[]
  totalIngresos: string    // Decimal as string
  totalEgresos: string     // Decimal as string
  balance: string          // Decimal as string — totalIngresos - totalEgresos
}
interface BalancePorCentro {
  centroId: number
  nombre: string
  tipo: 'INGRESOS' | 'EGRESOS'
  subtotal: string
}
```

Empty month: returns all zeros (`"0.00"`) and `porCentro: []` — **never 404**.

---

## 3. RBAC

| Profile | `centro-costos` access | Note |
|---|---|---|
| `ADMIN` | full (all methods) | hardcoded bypass in `requireDomain` step 2 |
| `CONTRATOS` | ítems of current month only | aug-17 D14/R21/R22 — POST/PUT/DELETE/balance blocked; GET `/items?periodo=` locked to current Bogotá `YYYY-MM` |
| `GERONTOLOGA` | none (false) | D4: matrix cell `false` |
| `AUDITOR` | full (matrix bypass) | inherited pre-existing middleware behavior, not a decision of this feature — flagged to developer |
| `OPERADOR` | full (matrix bypass) | inherited pre-existing middleware behavior, not a decision of this feature — flagged to developer |

Backend matrix location: `backend/src/middleware/domainAccess.ts` `DOMAIN_ACCESS`. New key `'centro-costos'` is added to the `Domain` union and one cell is inserted in each of `GERONTOLOGA` (false) and `CONTRATOS` (true) — D4. The `AUDITOR` / `OPERADOR` rows above are inherited from `requireDomain` step 3 (letting any non-EMPLEADO role through unchanged). Do NOT add any AUDITOR/OPERADOR restriction in this feature; if the developer changes that posture, it will come as a separate NEW-ASSIGNMENT. Frontend mirror is the responsibility of W2.

CONTRATOS 403 is enforced **per-route** inside `centroCostos.routes.ts` (not as a separate middleware) so the decision is explicit and visible alongside each handler. The check is `user.rol === 'EMPLEADO' && user.tipoEmpleado === 'CONTRATOS'` — the same shape asistencia uses.

403 shape: `{ success: false, message: '...', field?: 'fecha' | 'periodo' | ... }`.

---

## 4. Error catalogue

| Status | When | `field` |
|---|---|---|
| 400 | Validation failure (Zod) | the offending field name |
| 400 | Missing `periodo`/`fecha` query param | `periodo` / `fecha` |
| 400 | INGRESOS missing pagador | `pagador` |
| 400 | INGRESOS missing beneficiarioClienteId | `beneficiarioClienteId` |
| 400 | INGRESOS centro has no precioUnitario | `precioUnitario` |
| 403 | Profile lacks access (`requireDomain`) | — (no `field`, has `code: 'DOMAIN_FORBIDDEN'`) |
| 403 | CONTRATOS blocked by D14 (route-level) | `fecha` / `periodo` / — (no `field` for create-centro / balance) |
| 404 | Centro / ítem not found by id | `id` / `itemId` |
| 409 | Deleting a centro with ítems | `centroCostosId` |
| 500 | Unexpected server error | — |

---

## 5. RB-1 — Release preconditions (carry into release-protocol)

**Recorded 2026-08-05 by orchestrator during G1 review.**

`migration.sql:24` adds `updated_at TIMESTAMP(3) NOT NULL` **without a DEFAULT**. On 0 rows this succeeds; on a table with rows PostgreSQL rejects it. The migration was approved as-is locally because the dev DB has 0 centro rows. **Before staging**:

- Either pre-populate `updated_at` with `DEFAULT CURRENT_TIMESTAMP` on the live `centros_costos` table, then run the migration.
- Or edit the migration (in a new patch migration, NEVER in the original) before staging.

Going forward: when adding `NOT NULL` columns to a table that may have rows, prefer `DEFAULT CURRENT_TIMESTAMP` (or a backfill) to avoid a half-migrated state.

**aug-17 migration followup:** `20260819025302_centro_costos_aug17_qa/migration.sql` adds `fecha DATE NOT NULL` to `centro_costos_items` with the standard 3-step pattern (add nullable → backfill `fecha = periodo` → enforce NOT NULL). Same release precondition applies — staging must run it on a DB where existing ítems already have `periodo` set, which is always true post-ago-5.

---

## 6. Wave 2 notes (FILL IN after T3)

### T3 implementation — 2026-08-05

- Backend service: `backend/src/services/centroCostosService.ts` — all data access.
- Backend routes: `backend/src/routes/centroCostos.routes.ts` — 9 endpoints in the order required by trap #2 (`/items/:itemId` BEFORE `/:id`).
- `backend/src/routes/index.ts` — `router.use('/centro-costos', centroCostosRoutes)` added.
- `backend/src/middleware/domainAccess.ts` — `'centro-costos'` added to the `Domain` union + one cell in each of `GERONTOLOGA` (false) and `CONTRATOS` (true).
- `backend/src/middleware/errorHandler.ts` — Zod 400 errors now also include `field` (the first offending path) alongside `errors`. This aligns with the §2.3 envelope; UI consumers can read either shape.

### T3 acceptance — 10/10 verification

| AC | Result |
|---|---|
| AC1 `valorTotal` is server-computed | `POST {cantidad:2, valorUnitario:1500, valorTotal:"999999.00"}` → stored `"3000.00"` ✅ |
| AC2 `cantidad` integer | `POST {cantidad:2.5}` → 400 `{field: "cantidad"}` ✅ |
| AC3 `periodo` normalized | `POST {periodo:"2026-08-17"}` → stored `"2026-08-01"` ✅ |
| AC3b `periodo` month-boundary | `POST {periodo:"2026-08-31"}` → stored `"2026-08-01"` ✅ |
| AC4 balance math | `GET /balance?periodo=2026-08` → balance = totalIngresos − totalEgresos ✅ |
| AC5 empty month | `GET /balance?periodo=1999-01` → 200 with `"0.00"` zeros ✅ |
| AC6 delete with ítems | `DELETE /:id` → 409 `{field: "centroCostosId"}`; ítems still present ✅ |
| AC7 GERONTOLOGA RBAC | any `/centro-costos` route → 403 `DOMAIN_FORBIDDEN` ✅ |
| AC8 CONTRATOS RBAC | create + read + update → 200 ✅ |
| AC9 route ordering | `PUT /centro-costos/items/:itemId` reaches item handler (returns `notas`, `valorUnitario`, `valorTotal` etc.) ✅ |
| AC10 typecheck | `npx tsc --noEmit` exits 0 ✅ |

## 7. Wave 3 notes (FILL IN after T4)

### T4 smoke spec — 2026-08-05

- `backend/tests/centro-costos/centro-costos-smoke.spec.ts` — 10 Playwright tests covering the happy path end-to-end + gateway RBAC.
- Run: `cd backend && TEST_API_URL=http://localhost:3101 npx playwright test tests/centro-costos --reporter=list`
- Result: **10/10 passed** (910ms total).

### Gotchas W3 should know about

- The test env (local DB) accumulates test-created centros across runs. The seed's `@@unique([tipo, nombre])` allows user-created names to coexist. The smoke spec uses unique timestamped names so cleanup is deterministic (afterAll deletes the test centro + item).
- `GET /balance?periodo=YYYY-MM` returns 200 with all zeros for empty months — never 404. UI can rely on this.
- `valorUnitario` accepts both JSON number AND string in the request body. The server coerces both to a 2dp Decimal. UI `<input type="number">` posts as a number; an explicit string is also fine.
- `valorTotal` is server-computed: ALWAYS `cantidad × valorUnitario`. The client-sent value is dropped silently. The spec asserts this with a bogus `valorTotal: "999999.00"` against expected `3000.00`.
- `periodo` is normalized as **pure string math** (no `new Date` local parsing). The smoke spec asserts both `2026-08-17 → 2026-08-01` and the month-boundary `2026-08-31 → 2026-08-01` (WI-3).

---

## 8. Wave 4 notes (aug-17 — FILL IN after T9/T10)

### Migration applied — 2026-08-18

- `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/migration.sql` — additive only. Creates `MedioPagoIngreso` enum, adds `fecha` (required), `beneficiario_cliente_id`, `medio_pago`, `pagador` to `centro_costos_items`; adds `precio_unitario`, `habilitar_recibo` to `centros_costos`; creates FK + index on `beneficiario_cliente_id`. Backfill pattern: `fecha := periodo` before NOT NULL.
- `backend/prisma/schema.prisma` — model deltas match the migration 1:1. `Cliente` gains back-relation `itemsComoBeneficiario CentroCostosItem[] @relation("ClienteBeneficiarioItems")`.
- Original `20260805000000_centro_costos_ago5` is UNTOUCHED.

### Seed fix (idempotent)

- `backend/src/services/empresaService.ts` — `DEFAULT_CENTROS_COSTOS` is now the 14-row catalog (8 INGRESOS orden 1–8, 6 EGRESOS orden 9–14).
- `seedCentrosCostos()` runs `applyAug17SeedFix()` first (rename `Transporte` → `Transporte completo`, dropping an orphan duplicate if present), then `createMany({ skipDuplicates: true })`, then `applyAug17OrdenFix()` (UPDATE-by-name to canonical orden).
- A second startup of `seedCentrosCostos()` is a no-op (rename matches 0 rows; createMany skips all 14; orden UPDATE matches 0 rows whose orden ≠ target). Verified by running the function twice and observing `{inserted:0, renamed:0, reordered:0}` on both runs.

### Service deltas

- `CentroCostosDTO` adds `precioUnitario: string | null` and `habilitarRecibo: boolean`.
- `CreateCentroInput` / `UpdateCentroInput` accept both new fields (defaulted/null on EGRESOS).
- `CentroCostosItemDTO` adds `fecha: string` (YYYY-MM-DD), `pagador: string | null`, `beneficiarioClienteId: number | null`, `medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | null`.
- `CreateItemInput` / `UpdateItemInput` require `fecha` (was implicit `periodo`). `periodo` is server-computed from `fecha` — clients may not pass it.
- `createItem` enforces the D11 rules: INGRESOS → server copies `centro.precioUnitario` (400 if null), requires `pagador` + `beneficiarioClienteId` (400 with field name if missing, 400 if beneficiario doesn't exist on `clientes`). EGRESOS → unchanged (client `valorUnitario` required, ingreso fields stored null).
- `updateItem` re-applies the same D11 rules. INGRESOS `valorUnitario` is server-managed (ignored on update). On `fecha` change, server recomputes `periodo` deterministically.
- New `getItemWithRelations(itemId)` returns the ítem + parent centro + `beneficiario: {id,nombre}|null` for the recibo page (R31).

### Routes additions

- New `GET /items/:itemId` — registered BEFORE `/:id` (trap #2).
- `POST /:id/items` Zod schema now requires `fecha` (regex `^\d{4}-\d{2}-\d{2}$`) and adds optional `pagador`, `beneficiarioClienteId`, `medioPago`. Old `periodo`-only path is replaced; `periodo` is derived, not accepted from the client.
- CONTRATOS 403 (route-level, NOT in `requireDomain`):
  - `POST /:id/items` → 403 if `body.fecha.slice(0,7) !== today.slice(0,7)`.
  - `PUT /items/:itemId` / `DELETE /items/:itemId` → 403 if existing `item.fecha` is in a different month.
  - `GET /items?periodo=` → 403 if `periodo !== today.slice(0,7)`.
  - `GET /balance` → 403 (CONTRATOS never sees balance, R22).
  - `POST /` / `PUT /:id` / `DELETE /:id` → 403 (CONTRATOS never mutates centros, R21).

---

## Deviations table

| # | Wave | Assignment said | Actual | Resolution |
|---|---|---|---|---|
| — | — | — | — | (none yet) |