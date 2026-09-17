# T1 Result — W1 wave 1, task #25

**Title**: Migrations (TipoEmpleado + D7 NOT NULL) + E1 backend transforms + contract
**Status**: ✅ complete
**Date**: 2026-07-10

---

## Deliverables (all shipped)

1. **2 migrations** applied to dev DB `:15432` (total: 20):
   - `20260710100000_jul10_contrato_cargo_not_null` — backfill 17 NULL `cargo_id` rows → cargo_id=7 (Otro); `SET NOT NULL`.
   - `20260710100100_jul10_tipo_empleado` — new enum `TipoEmpleado { GERONTOLOGA }`; nullable `usuarios.tipo_empleado` column.

2. **E1 Zod transforms** (5 routes):
   - `certificates.routes.ts` — `baseCertificateFields.nombre` (used by create + `.partial()` update).
   - `instruments.routes.ts` — `baseInstrumentFields.nombreInstrumento` + update mirror.
   - `patients.routes.ts` — `createPatientSchema.nombre`.
   - `employees.routes.ts` — `createEmployeeSchema.nombre + apellido`.
   - `empresa.routes.ts` — `updateEmpresaSchema.nombre`.

3. **Contrato Zod update**: `nomina.routes.ts contratoSchema.cargoId` REQUIRED (no `.optional()`).

4. **Schema contract**: `development/next-release-jul-10/orchestration-ctx/decisions/schema-contract-jul10.md`.

5. **Reports**: `progress-report.md`, `completion-report.md`, `result.md`.

---

## Verification (curl + psql)

```text
✓ npx prisma migrate status  → 20/20, "Database schema is up to date!"
✓ /api/v1/health  → 200 (final)
✓ information_schema: contratos.cargo_id is_nullable = NO
✓ SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL  → 0 (was 17)
✓ POST /certificates  lowercase → 201, returned UPPERCASE
✓ POST /instruments   lowercase → 201, returned UPPERCASE
✓ POST /employees     lowercase → 201, returned UPPERCASE
✓ POST /patients      lowercase → 201, returned UPPERCASE
✓ PUT  /empresa/6     lowercase → 200, returned UPPERCASE
✓ POST /nomina/employees/117/contratos  no cargoId → 400, field=cargoId
✓ POST /nomina/employees/117/contratos  cargoId:7 → 201
✓ Test rows cleaned; dev DB state matches pre-task for unaffected entities
```

---

## For wave-2

Contract §5 has placeholders for **T2 (#26, API)** and **T3 (#27, API)** — fill in during those pushes. Both arrive as `NEW-ASSIGNMENT` messages per the orchestrator's protocol.

---
