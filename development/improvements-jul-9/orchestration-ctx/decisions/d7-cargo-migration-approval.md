# Decision: D7 CargoEmpresa migration — approved with deviations

**Date**: 2026-07-09 · **Gate**: PLAN-APPROVAL (W1, T1 migration #4)
**Proposal**: `tasks/W1-backend/proposed-plan.md`

## Context
Assignment + insights doc §D7 assumed `Contrato.cargo String` existed and required a string→FK backfill. W1's DB inspection proved otherwise: `contratos` has 9 columns, none named `cargo`, and 0 rows. The `cargo` fields that exist live on `nominas.cargo` (payroll concept) and the legacy `cargos` per-empleado history table (test junk) — neither is a valid backfill source.

## Approved (all 3 requested decisions)
1. **`Contrato.cargoId Int?` nullable, NO backfill, NO NOT NULL** — with zero rows NOT NULL would technically apply, but it would break the existing contrato-create flow until wave-2 API + wave-3 UI land. Nullable + UI-enforced selection is the correct sequencing.
2. **Seed list**: 7 user-locked cargos + `Otro`, per empresa, `ON CONFLICT DO NOTHING` idempotent.
3. **Migration order** per proposal §2.3 (guarded DDL, single transaction).

## Follow-ups recorded
- **Tighten later**: once wave-3 UI ships and all new contratos carry cargoId, a future migration may add `SET NOT NULL` (needs a data check first).
- **Wave-2 contract note**: new contrato Zod accepts `cargoId: number` — legacy `cargo: string` payloads are NOT accepted (break documented in schema-contract-jul9.md per proposal §2.5).
- **Insights doc correction**: `improvements-jul-9-insights.md` §D7 backfill paragraph is superseded by this decision (no backfill — column never existed).

## Rationale for autonomy
No business/product change: L1 intent (per-empresa configurable cargo catalog, FK from contrato) is preserved exactly. The deviation only removes a backfill step that had no source data. Risk class LOW (additive table + additive nullable column).
