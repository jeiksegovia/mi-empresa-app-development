# T1 Result — Migrations + Contract (W1, wave 1)

**Date:** 2026-07-10
**Backend port:** :3101
**DB:** `miempresa_dev` at `localhost:15432`
**Migrations applied (new):** 4
**Total migrations after T1:** 18

---

## What changed

### `backend/prisma/schema.prisma`

1. `CertificadoUpdate`: added `comprobantePagoUrl String? @map("comprobante_pago_url") @db.VarChar(500)`.
2. `Cliente`: added `fechaCumpleanos DateTime? @map("fecha_cumpleanos") @db.Date`, `tipoSangre TipoSangre? @map("tipo_sangre")`, `eps String? @db.VarChar(200)`.
3. **New enum** `TipoSangre { A_POS A_NEG B_POS B_NEG AB_POS AB_NEG O_POS O_NEG }`.
4. `EducacionIdiomas.nivelEscritura` → nullable (was on `EducacionIdiomas`, not `Empleado` — assignment had a naming slip; corrected to actual model).
5. `Empleado`: added `documentoIdentificacionUrl String? @map("documento_identificacion_url") @db.VarChar(500)`. New relation `educacionEmpleado EducacionEmpleado[]`.
6. `Contrato`: added `archivoFirmadoUrl String? @map("archivo_firmado_url") @db.VarChar(500)`, `cargoId Int? @map("cargo_id")` + `cargo CargoEmpresa?` relation + `@@index([cargoId])`.
7. **New model** `EducacionEmpleado` with FK to `Empleado` (Cascade), per docs §D2.
8. **New model** `CargoEmpresa` (per-empresa catalog), per docs §D7 + L1, with FK to `Empresa` and reverse relation from `Contrato`.
9. `Empresa`: added `cargosEmpresa CargoEmpresa[]` relation.

### New migration files

| Slug | Path | Purpose |
|---|---|---|
| `jul9_additive_fields` | `prisma/migrations/20260710024539_jul9_additive_fields/migration.sql` | A4 + B3/B4/B5 + D1 + D3 + D6 |
| `jul9_nota_fecha_incidente` | `prisma/migrations/20260710024613_jul9_nota_fecha_incidente/migration.sql` | B1 column + backfill + NOT NULL (hand-edited) |
| `jul9_educacion_empleado` | `prisma/migrations/20260710024705_jul9_educacion_empleado/migration.sql` | D2 new table |
| `jul9_cargo_empresa` | `prisma/migrations/20260710024928_jul9_cargo_empresa/migration.sql` | D7 new table + Contrato FK + seed per existing empresa |

### Seed / backfill

- **`notas_clientes` `fecha_incidente`**: backfilled 4/4 rows from `fecha::date`.
- **`cargos_empresa`**: seeded 7 rows for `empresa_id = 6` (Mi Empresa S.A.S.): `Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro`.

### Schema contract

`development/improvements-jul-9/orchestration-ctx/decisions/schema-contract-jul9.md` — every new model/column/enum verbatim, all 5 JSON shapes Prisma will return for the new/changed endpoints, the D7 seed list actually applied, the D7 follow-up (`SET NOT NULL` deferred), and the legacy-payload break (cargoId only, no `cargo: string`).

---

## Verification output (commands + results)

### Migration status (after all 4 applied)

```text
$ npx prisma migrate status
Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "miempresa_dev", schema "public" at "localhost:15432"

18 migrations found in prisma/migrations

Database schema is up to date!
```

### M1 — new columns verified

```sql
SELECT COLUMN_NAME, data_type FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME IN ('certificados_empresa_updates','clientes','empleados','contratos')
   AND COLUMN_NAME IN ('comprobante_pago_url','fecha_cumpleanos','tipo_sangre','eps','documento_identificacion_url','archivo_firmado_url');
```

Returns 6 rows — all present.

```sql
SELECT COLUMN_NAME, is_nullable FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME='educacion_idiomas' AND COLUMN_NAME='nivel_escritura';
--  nivel_escritura | YES
```

### M2 — backfill verified

```sql
SELECT COUNT(*) AS total_notas,
       COUNT(fecha_incidente) AS con_fecha_incidente,
       COUNT(*) FILTER (WHERE fecha_incidente IS NULL) AS sin_fecha_incidente
  FROM notas_clientes;
-- 4 | 4 | 0
```

### M4 — D7 verification

```sql
SELECT e.nombre AS empresa, COUNT(c.*) AS cargos_seeded
  FROM empresas e LEFT JOIN cargos_empresa c ON c.empresa_id = e.id
  GROUP BY e.nombre;
-- Mi Empresa S.A.S. | 7

SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name='contratos' AND column_name='cargo_id';
-- cargo_id | integer | YES

SELECT conname FROM pg_constraint
  WHERE conname IN ('contratos_cargo_id_fkey','cargos_empresa_empresa_id_fkey');
-- contratos_cargo_id_fkey
-- cargos_empresa_empresa_id_fkey

SELECT nombre, activo FROM cargos_empresa ORDER BY nombre;
-- 7 rows (the seeded list)
```

### Backend health (after each migration)

```text
$ curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3101/api/v1/health
200
```

Verified after M1, M2, M3, and M4 — all returned 200. `tsx watch` picked up Prisma client regen without crashing.

---

## Deviations from the assignment (and where they were approved)

| # | Assignment said | What we did | Where it's documented |
|---|---|---|---|
| 1 | `Empleado.nivelEscritura` → nullable | `EducacionIdiomas.nivelEscritura` → nullable (the column was on idiomas, not empleado) | `tasks/W1-backend/proposed-plan.md` + `schema-contract-jul9.md §8` |
| 2 | Backfill `Contrato.cargoId` from `Contrato.cargo` strings | No backfill — `cargo` column never existed | `proposed-plan.md §1.1`; `decisions/d7-cargo-migration-approval.md`; `schema-contract-jul9.md §8` |
| 3 | `Contrato.cargoId` becomes NOT NULL after backfill | Stays nullable — defer NOT NULL to wave-3 UI ship (per orchestrator follow-up note) | `schema-contract-jul9.md §4.6` |

---

## Things explicitly NOT done (handoff notes)

- **No API code** — T2/T3/T4/T5 land in wave 2. Schema is the hand-off for those workers.
- **No UI** — done by W2 (certificados, empresa) and W3 (pacientes, empleados, contrato).
- **No cargo update endpoint** (`PATCH /api/v1/empresa/cargos/:id` to rename an existing cargo) — JSON shape is in the contract, but the API worker decides whether to ship rename or only archive.
- **No holiday calendar** — L6 says v1 stays weekday-only. T3 worker must leave a `// TODO(holidays)` near `businessDays.ts`.
- **`SET NOT NULL` on `cargoId`** — separate migration in wave 3.
- **No git commit** — per assignment and protocol.

---

## Cross-doc search keys

```
migrations jul9 schema-contract t1 result w1 backend
comprobantePagoUrl fechaIncidente fechaCumpleanos tipoSangre eps
CargoEmpresa archivoFirmadoUrl EducacionEmpleado nivelEscritura
documentoIdentificacionUrl backfill seed 2-business-day contrato
```
