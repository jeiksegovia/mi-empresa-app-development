# Feature Plan — Centro de Costos (ago-5)

**Slug**: `feature-centro-costos-ago-5`
**Inputs**: [00-intake](00-intake-centro-costos.md) · [01-requirements](01-requirements-centro-costos.md)
**Research**: skipped — no open questions requiring it; every pattern needed already exists in the repo.

---

## Objective

Ship the Centro de Costos module: organize ingresos and egresos into typed cost centers holding
uniform monthly ítems, so `Σ ingresos − Σ egresos = balance` is available per month. Replace the
dead FINANCE MODULE scaffolding with the model the user actually described.

---

## Assumptions & Constraints

- Local-first: this cycle lands and is verified on the local stack (BE :3101, FE :3100, PG :15432).
  Staging deployment is a **separate gated cycle** (release-protocol R0–R5).
- Migrations are gitignored and ship inside the CodeDeploy artifact — the migration directory must
  still be created locally and left in the working tree.
- **Nothing related to nómina or empleados may be touched.** Verified: the finance FK subgraph's only
  outbound edge is `prefacturas → clientes` (intake §4.3).
- Commit only on explicit user instruction.

---

## Existing Patterns Used

| Pattern | Exemplar | How this feature extends it |
|---|---|---|
| Route module + registration | `backend/src/routes/asistencia.routes.ts`; registered in `routes/index.ts` | New `centroCostos.routes.ts`, registered as `router.use('/centro-costos', centroCostosRoutes)` |
| Auth + domain RBAC | `router.use(authMiddleware())` then `router.use(requireDomain('asistencia'))` | Same two lines with a new `'centro-costos'` domain key |
| RBAC matrix | `backend/src/middleware/domainAccess.ts` `DOMAIN_ACCESS` | Add one `centro-costos` column to both profiles (GERONTOLOGA `false`, CONTRATOS `true`) |
| FE matrix mirror (intentional duplication) | `frontend/app/composables/useDomainAccess.ts` — "the flat literal IS the spec" | Add the same key + `DOMAIN_PREFIX_MAP` entry `{ prefix: '/centro-costos', domain: 'centro-costos' }` |
| Zod + `validate` middleware | `putDiaSchema` in `asistencia.routes.ts` | `createItemSchema` / `updateItemSchema` / `centroSchema` |
| Response envelopes | `{success:true,data}` · `{success:false,message,field}` · `e?.status` rethrow | Identical, no new error shape |
| Service layer | `backend/src/services/asistenciaService.ts` | New `centroCostosService.ts`; routes stay thin |
| Idempotent seed constant | `DEFAULT_CARGOS` in `empresaService.ts` + `createMany({skipDuplicates:true})` | `DEFAULT_CENTROS_COSTOS` with the 11 centros from R7/R8 |
| ESM imports | every backend import ends `.js` | Same |
| Money columns | `Decimal @db.Decimal(15,2)` throughout | Same (N1) |
| Sidebar nav | `frontend/app/app.config.ts` `sidebar.items`, filtered by `domainForPath` in `AppSidebar.vue` | Add `{ label: 'Centro de Costos', icon: 'pi pi-chart-pie', to: '/centro-costos' }` |
| FE page shell | `frontend/app/pages/nomina/index.vue` (`definePageMeta({middleware:'auth'})`, `useApi()`, `useToast()`, local interfaces) | Same shape for `pages/centro-costos/index.vue` |
| BE tests | `backend/tests/asistencia/asistencia-rbac.spec.ts` (`TEST_API_URL`, cookie login helper, `workers:1`) | New `backend/tests/centro-costos/*.spec.ts` reusing the login helper shape |
| FE tests | `frontend/tests/local-qa/jul31-*.spec.ts` | New `frontend/tests/centro-costos/*.spec.ts` |

---

## Technical Approach

### Schema (the "simple shape that works")

Two tables. The uniform-ítem decision (T§2.2, settled on-camera) is what keeps it to two — there is
no separate ingreso/egreso table, only a `tipo` on the parent centro.

```prisma
enum TipoCentroCostos { INGRESOS  EGRESOS }        // KEPT — already correct

model CentroCostos {                                // KEPT + extended
  id          Int              @id @default(autoincrement()) @map("centro_id")
  nombre      String           @db.VarChar(200)
  tipo        TipoCentroCostos
  descripcion String?          @db.Text
  activo      Boolean          @default(true)
  orden       Int              @default(0)
  createdAt   DateTime         @default(now())  @map("created_at")
  updatedAt   DateTime         @updatedAt       @map("updated_at")
  items       CentroCostosItem[]
  @@unique([tipo, nombre])
  @@index([tipo, activo])
  @@map("centros_costos")
}

model CentroCostosItem {                            // NEW — replaces `Egreso`
  id             Int       @id @default(autoincrement()) @map("item_id")
  centroCostosId Int       @map("centro_costos_id")
  nombre         String    @db.VarChar(200)
  notas          String?   @db.Text
  cantidad       Int       @default(1)                                     // D5: integer (developer call)
  valorUnitario  Decimal   @map("valor_unitario") @db.Decimal(15, 2)
  valorTotal     Decimal   @map("valor_total")    @db.Decimal(15, 2)  // persisted, server-computed
  periodo        DateTime  @db.Date                                    // normalized to day 1
  numeroFactura  String?   @map("numero_factura") @db.VarChar(100)     // egreso-only, optional
  proveedor      String?   @db.VarChar(200)                            // egreso-only, optional
  fechaFactura   DateTime? @map("fecha_factura")  @db.Date             // egreso-only, optional
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt      @map("updated_at")
  centroCostos   CentroCostos @relation(fields: [centroCostosId], references: [id], onDelete: Restrict)
  @@index([periodo])
  @@index([centroCostosId, periodo])
  @@map("centro_costos_items")
}
```

**Dropped**: `ProductoServicio`, `Prefactura`, `Egreso`, enum `EstadoPrefactura`, and the
`Cliente.prefacturas` back-relation (`schema.prisma:593` — omitting this fails `prisma validate`).

**Why these choices**
- `periodo` as a normalized DATE, not `(anio, mes)` ints: one column, native ordering and range
  queries, and it matches how every other date in this schema is stored. Grouping by month is a
  `gte/lt` range, no extra index gymnastics.
- `valorTotal` persisted rather than computed on read: rows stay historically stable, and the
  monthly rollup is a plain `SUM` the DB can do without recomputation.
- `cantidad Int @default(1)` (**D5 — developer decision 2026-08-05**): matches the transcript
  literally (*"cantidad dos"*); quantities are counts of people, refrigerios, units. Consolidated
  spreadsheet rows become `cantidad = 1`, making them a one-field entry. Fractional quantities are
  deliberately NOT supported — if an hour-based entry is ever needed, it is expressed by folding the
  fraction into `valorUnitario`. Zod must validate `z.number().int().positive()`.
- `onDelete: Restrict` (R13) instead of `Cascade`: deleting a centro can never silently erase a
  month of financial history; `activo=false` is the intended way to retire a centro.
- `@@unique([tipo, nombre])`: makes the seed idempotent (R9) and blocks the exact problem the user
  complained about — Valoraciones getting mixed into another centro.

### API surface (`/api/v1/centro-costos`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | List centros (`?tipo=`, `?activo=`) |
| POST | `/` | Create centro |
| PUT | `/:id` | Update centro (nombre, descripcion, activo, orden) |
| DELETE | `/:id` | Delete centro — 409 if it has ítems (R13) |
| GET | `/items?periodo=YYYY-MM` | Ítems of a month, grouped by centro |
| POST | `/:id/items` | Create ítem under a centro |
| PUT | `/items/:itemId` | Update ítem |
| DELETE | `/items/:itemId` | Delete ítem |
| GET | `/balance?periodo=YYYY-MM` | `{ porCentro[], totalIngresos, totalEgresos, balance }` |

Route order matters: `/items/:itemId` must be registered before `/:id` would shadow it — called out
explicitly in the W1 assignment.

### Frontend

Single page `pages/centro-costos/index.vue`: month selector → two sections (Ingresos, Egresos) →
each centro a collapsible group with its ítems table and subtotal → footer balance card.
Add/edit via a dialog; egreso-only fields render only when the parent centro is `EGRESOS`.

**Known trap pre-loaded from memory**: `v-model` on a `const reactive()` object drops child emits —
use `:model-value` + `Object.assign`. UI specs must drive DatePickers and fill optional fields.

---

## Risk & Unknowns

| # | Risk | Mitigation |
|---|---|---|
| K1 | Destructive migration drops 3 tables | Local counts are **0/0/0/0** (verified). W1 still re-verifies and posts `PLAN-APPROVAL` before running (P3/N2). Staging counts re-checked at release R0. |
| K2 | Forgetting `Cliente.prefacturas` → `prisma validate` fails | Named explicitly in the W1 assignment |
| K3 | FE/BE matrix drift on the new domain | W3 QA runs an explicit cell-by-cell parity test (R15) |
| K4 | Decimal serialization — Prisma returns `Decimal` as string over JSON | Contract documents the wire type as `string`; FE interfaces use `number \| string` like `nomina/index.vue` already does |
| K5 | Route shadowing on `/items/:itemId` vs `/:id` | Ordering requirement stated in the assignment + a spec asserts it |
| K6 | Month boundary/TZ drift on `periodo` | Normalize as a pure string operation (`YYYY-MM` → `YYYY-MM-01`), never via `new Date()` local parsing — same discipline as `serverTodayBogota()` |

---

## Implementation Scope

**Backend**: `prisma/schema.prisma`, one migration dir, `services/centroCostosService.ts`,
`routes/centroCostos.routes.ts`, `routes/index.ts`, `middleware/domainAccess.ts`, seed wiring.
**Frontend**: `pages/centro-costos/index.vue`, `composables/useDomainAccess.ts`, `app.config.ts`.
**Tests**: `backend/tests/centro-costos/**`, `frontend/tests/centro-costos/**`.

---

## New Artifacts Proposed

**5 new files** — approval required:

| Artifact | Why needed | Alternative considered |
|---|---|---|
| `CentroCostosItem` model | No existing table has the uniform ítem shape; `Egreso` is egreso-only and lacks `cantidad`/`valorUnitario`/`periodo` | Extending `Egreso` in place — rejected: it would leave a table named `egresos` holding ingresos |
| `services/centroCostosService.ts` | New domain; every domain has its own service | Folding into `empresaService` — rejected, unrelated concern |
| `routes/centroCostos.routes.ts` | New route module, mirrors every other domain | — |
| `pages/centro-costos/index.vue` | New page | — |
| `'centro-costos'` domain key | Required for the standard `requireDomain` RBAC path | Reusing `'nomina'` — rejected: would grant nómina access implicitly and blur the matrix |

Everything else extends existing patterns. **No new abstractions, no new middleware, no new libraries.**

---

## Execution Shape (detail in `orchestration-ctx/team-plan-*.md`)

Contract-first (P1), 3 workers, 3 waves:

- **Wave 1 — W1 `pt-backend-eng`**: schema + migration + seed + **contract doc** (gated on the drop).
- **Wave 2 — W1 (reused, its context IS the spec)**: services + routes + RBAC + smoke spec.
  **∥ W2 `pt-frontend-eng`** (fresh): page + matrix mirror + nav + smoke spec — reads the contract only.
- **Wave 3 — W3 `pt-test-quality`** (fresh, no implementer context): full BE + FE suites against the
  contract, regression sweep, gap report. Forbidden from modifying source.

---

## Open Items

- O1 — Staging row counts for the dropped tables: verify in release R0 (next cycle, not this one).
- O2 — Nómina-spend ingestion into the Nómina egresos centro: deferred by D3.

## References
- [00-intake-centro-costos.md](00-intake-centro-costos.md) — incl. §4 full finance audit
- [01-requirements-centro-costos.md](01-requirements-centro-costos.md) — R1–R17, N1–N6
- `context/user-feedback/featured-ago-4-centro-costos-raw.md` — raw transcript
- `development/orchestration-learnings/01-orchestration-patterns.md` — P1/P2/P3/P5/P10
