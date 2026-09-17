# T1 Progress Report — W1 wave 1, task #25

**Date**: 2026-07-10
**Worker**: pt-backend-eng (W1, FRESH)
**Assignment**: `tasks/W1-backend/task-assignment-t1.md`

---

## §0 Pre-flight DB inspection (2026-07-10 07:14 local)

Verified state BEFORE any DDL runs:

| Metric | Value |
|---|---|
| `SELECT COUNT(*) FROM contratos;` | **18** |
| `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL;` | **17** |
| `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NOT NULL;` | 1 |
| Empresas (count) | 1 (`id=6`, nombre=`Mi Empresa S.A.S.`) |
| `cargos_empresa` rows | 13 (7 seed + 6 QA-added titles) |
| `Otro` cargo_id | **7** (empresa_id=6) |

**Decision**: all 17 NULL cargo_id rows belong to the single existing empresa (id=6). They will be backfilled to `cargo_id=7` (the "Otro" catch-all that the jul-9 plan promised per-empresa is seeded for every empresa). Pre-flight satisfied — clearing migration B.

---

## §1 Schema changes (done)

- New enum `TipoEmpleado { GERONTOLOGA }` added to `schema.prisma`.
- `Usuario.tipoEmpleado TipoEmpleado? @map("tipo_empleado")` added.
- `Contrato.cargoId` changed from `Int?` → `Int` (NOT NULL) after migration B applies.

---

## §2 Migration files (done)

| File | Purpose |
|---|---|
| `prisma/migrations/20260710100000_jul10_contrato_cargo_not_null/migration.sql` | D7 tighten: backfill NULL → Otro (cargo_id=7), SET NOT NULL |
| `prisma/migrations/20260710100100_jul10_tipo_empleado/migration.sql` | New enum + Usuario.tipo_empleado column |

A precedes B in alphabet but B must apply BEFORE the Prisma client re-validates `Contrato.cargoId` as non-nullable. Order chosen: B (`jul10_contrato_cargo_not_null`) first because the backend tsx-watch running alongside needs cargoId NOT NULL after the schema change lands.

---

## §3 E1 backend transforms (done)

Zod `.transform(v => v.trim().toUpperCase())` applied on:
- `certificates.routes.ts` — `baseCertificateFields.nombre` (used by BOTH create + update schemas since update is `partial()` of base)
- `instruments.routes.ts` — `baseInstrumentFields.nombreInstrumento` (used by create + partial update)
- `patients.routes.ts` — `createPatientSchema.nombre`
- `employees.routes.ts` — `createEmployeeSchema.nombre + apellido`
- `empresa.routes.ts` — `updateEmpresaSchema.nombre`

NOT transformed (per user spec):
- `descripcion`, `notas`, any long Text field
- `CargoEmpresa.nombre` (catalog values — title-case seeded; keep as-is — front-end will pass uppercase too, that's fine, but not strict-required)

---

## §4 Verification (pending — will run)

- `npx prisma migrate status` → 20 migrations, "Database schema is up to date!"
- `information_schema.columns WHERE table_name='contratos' AND column_name='cargo_id'` → `is_nullable=NO`
- `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL;` → 0
- `curl POST` cert/instrumento/cliente/empleado/empresa with lowercase → 201 with uppercase body
- `curl POST /contratos` without cargoId → 400

---

## §5 Schema contract (pending — will write)

`orchestration-ctx/decisions/schema-contract-jul10.md` will extend jul-9's `schema-contract-jul9.md` with:
- §A: TipoEmpleado enum + field
- §B: D7 NOT NULL confirmed
- §C: E1 exact fields
- §D: Placeholders for T2 (#26) and T3 (#27)

---
