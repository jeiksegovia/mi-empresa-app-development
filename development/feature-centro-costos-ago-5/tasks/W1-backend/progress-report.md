# W1-backend — Progress Report

## Task 1 — Schema + migration + seed (COMPLETE)

### Status
- Schema edited: dropped `ProductoServicio`, `Prefactura`, `Egreso`, enum `EstadoPrefactura`, removed `Cliente.prefacturas` back-relation.
- `CentroCostos` extended with `activo`, `orden`, `createdAt`, `updatedAt`, `@@unique([tipo, nombre])`, `@@index([tipo, activo])`.
- `CentroCostosItem` added per plan §Technical Approach.
- `npx prisma validate` → valid.
- Migration applied: `backend/prisma/migrations/20260805000000_centro_costos_ago5/`.
- `DEFAULT_CENTROS_COSTOS` (11 rows: 5 INGRESOS + 6 EGRESOS) added to `empresaService.ts`.
- `seedCentrosCostos()` wired at `server.ts` startup (idempotent via `createMany({ skipDuplicates: true })`).
- Seed run twice → INGRESOS=5, EGRESOS=6 both times. ✅

### All 5 acceptance criteria pass (verbatim commands in completion-report.md)

## Task 2 — Contract document (COMPLETE)

### Status
- Contract written at `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`.
- Verified by orchestrator: G2 approved with 3 corrections (R9 wording, valorUnitario request type, AUDITOR/OPERADOR note).
- All 3 corrections applied.

### Deviations
None yet (will populate in Tasks 3 and 4 after reality checks).

## Task 3 — Service + routes + RBAC (COMPLETE)

### Status
- `backend/src/services/centroCostosService.ts` — all data access.
- `backend/src/routes/centroCostos.routes.ts` — 9 endpoints in the order required by trap #2.
- `backend/src/routes/index.ts` — `router.use('/centro-costos', centroCostosRoutes)`.
- `backend/src/middleware/domainAccess.ts` — `'centro-costos'` added to `Domain` + cells in GERONTOLOGA (false) and CONTRATOS (true).
- `backend/src/middleware/errorHandler.ts` — Zod 400 errors now also include `field` (first offending path) alongside `errors`.

### All 10 acceptance criteria pass (verbatim commands in completion-report.md)

### Issues found-and-resolved
1. **PERIODO_SHORT regex missing capture groups** (caught at first AC4 run). The regex `/^\d{4}-\d{2}$/` had no parentheses, so `m[1]` and `m[2]` were `undefined`, making `parseInt(undefined)` = `NaN`, and `new Date(Date.UTC(NaN, NaN-1, 1))` = Invalid Date. Fixed by adding capture groups: `/^(\d{4})-(\d{2})$/`. This was a 1-line bug, no data impact.
2. **Prisma Decimal serialization drops trailing zeros** (caught at AC1). `valorTotal.toString()` returns `"3000"` instead of `"3000.00"`. Fixed by using `.toFixed(2)` in `toItemDTO`. The DB stores `3000.00` correctly; the JSON wire format now matches the contract.
3. **errorHandler didn't emit `field`** (caught at AC2). The Zod envelope was `{success:false, message:"Validation error", errors:{...}}` — missing `field`. Aligned with contract §2.3 by adding `field: firstErrorPath` to the 400 response.

## RB-1 release precondition
Recorded in contract §5: `migration.sql:24` adds `updated_at` NOT NULL with no DEFAULT. OK on local 0 rows; staging must backfill or alter before applying.

