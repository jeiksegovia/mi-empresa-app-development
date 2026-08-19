# W1 verify-report — qa-session-aug-17 (T2/T3)

**Worker:** pt-data-schema (worker-1-2, replacing defective worker-1)
**Date:** 2026-08-18
**Scope:** T2 (schema + migration) and T3 (seed) — verify only, no re-migration, no product work.

## Result: MATCH

All acceptance criteria from `task-assignment-verify-t2-t3.md` pass against the
contract (`development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`)
and the live local DB at `localhost:15432`.

---

## 1. `backend/prisma/schema.prisma` — model shapes

### 1.1 `NominaPeriodo.bonos` — Decimal(12,2) NULL

```prisma
// schema.prisma lines 426-452
model NominaPeriodo {
  …
  // qa-session-aug-17 R3: bonos only for TERMINO_FIJO | TERMINO_INDEFINIDO
  bonos             Decimal? @map("bonos") @db.Decimal(12, 2)
  totalPagado       Decimal? @map("total_pagado") @db.Decimal(12, 2)
  …
}
```

Contract §3.1: `Decimal? @db.Decimal(12, 2)` ✓ MATCH.

### 1.2 `RegistroActividad` — exact + `@@unique([empleadoId, fecha])` + `@@map`

```prisma
// schema.prisma lines 475-492
model RegistroActividad {
  id            Int      @id @default(autoincrement()) @map("registro_actividad_id")
  empleadoId    Int      @map("empleado_id")
  fecha         DateTime @db.Date
  texto         String   @db.Text
  registradoPor Int      @map("registrado_por")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  empleado    Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade)
  registrador Usuario  @relation("ActividadRegistrador", fields: [registradoPor], references: [id])

  @@unique([empleadoId, fecha])
  @@index([fecha])
  @@index([empleadoId])
  @@map("registro_actividades")
}
```

Contract §4.1: all fields, decorators, relations, indexes, and map — MATCH.

### 1.3 Back-references — exact relation names

```prisma
// schema.prisma line 145 (Empleado)
registrosActividad           RegistroActividad[]

// schema.prisma line 51 (Usuario)
actividadesRegistradas    RegistroActividad[]    @relation("ActividadRegistrador")
```

Contract §4.2 — MATCH.

---

## 2. Migration `20260818113726_add_nomina_bonos_and_registro_actividades/migration.sql`

File present; matches contract §8 verbatim. No shadow URL was used —
`migrate deploy` (additive) was the apply path.

| Contract §8 element | Migration file | MATCH |
|---|---|---|
| `ALTER TABLE nomina_periodos ADD COLUMN IF NOT EXISTS bonos DECIMAL(12,2)` | line 6-7 | ✓ |
| `CREATE TABLE IF NOT EXISTS registro_actividades` with PK `registro_actividad_id` | lines 10-24 | ✓ |
| FK `empleado_id → empleados ON DELETE CASCADE` | line 18-21 | ✓ |
| FK `registrado_por → usuarios ON DELETE RESTRICT` | line 22-24 | ✓ |
| `UNIQUE INDEX (empleado_id, fecha)` named `…_empleado_id_fecha_key` | line 26-27 | ✓ |
| `INDEX (fecha)` named `…_fecha_idx` | line 28-29 | ✓ |
| `INDEX (empleado_id)` named `…_empleado_id_idx` | line 30-31 | ✓ |
| Reversible `down.sql` (DROP TABLE / DROP COLUMN) | `down.sql` lines 4-5 | ✓ |

---

## 3. `cd backend && npx prisma migrate status` — up to date

Verbatim:

```text
warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please migrate to a Prisma config file (e.g., `prisma.config.ts`).
For more information, see: https://pris.ly/prisma-config

Environment variables loaded from .env
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "miempresa_dev", schema "public" at "localhost:15432"

29 migrations found in prisma/migrations

Database schema is up to date!
```

Independent DB check — migration recorded as applied in `_prisma_migrations`:

```text
                      migration_name                      | applied 
----------------------------------------------------------+---------
 20260818113726_add_nomina_bonos_and_registro_actividades | t
```

Independent DB column / table / indexes verification:

```text
table_name
----------------------
registro_actividades

 column_name | data_type | numeric_precision | numeric_scale | is_nullable
-------------+-----------+-------------------+---------------+-------------
 bonos       | numeric   |                12 |             2 | YES

                 indexname
--------------------------------------------
 registro_actividades_empleado_id_fecha_key
 registro_actividades_empleado_id_idx
 registro_actividades_fecha_idx
 registro_actividades_pkey
```

`\d registro_actividades` shows FKs:
- `registro_actividades_empleado_id_fkey` → `empleados(empleado_id)` `ON UPDATE CASCADE ON DELETE CASCADE`
- `registro_actividades_registrado_por_fkey` → `usuarios(id)` `ON UPDATE CASCADE ON DELETE RESTRICT`

All column types, nullability, defaults, and FK actions match the schema.prisma and contract §4.

---

## 4. `backend/prisma/seed.ts` — profesor / auxiliar with `empleadoId`

Seed file contains the durable create path (lines 106-154):

- `empleadoProfesor`: CC `900000001`, genero `Masculino`, `estado: 'ACTIVO'`
- `empleadoAuxiliar`: CC `900000002`, genero `Femenino`, `estado: 'ACTIVO'`
- `profesorUser`: `email: 'profesor@miempresa.com'`, `rol: 'EMPLEADO'`, `tipoEmpleado: 'PROFESORES'`, `empleadoId: empleadoProfesor.id`
- `auxiliarUser`: `email: 'auxiliar@miempresa.com'`, `rol: 'EMPLEADO'`, `tipoEmpleado: 'AUXILIARES'`, `empleadoId: empleadoAuxiliar.id`
- Console summary prints both new credentials alongside the existing four.
- `seed.ts` clean-slate block deletes `registroActividad` (line 77) before `empleado` (line 85) to avoid FK trips on re-seed.

### Live DB confirmation (read-only SELECT — `prisma db seed` not run)

```text
 id  |         email          |   rol    | tipo_empleado | empleado_id
-----+------------------------+----------+---------------+-------------
 277 | auxiliar@miempresa.com | EMPLEADO | AUXILIARES    |         396
 276 | profesor@miempresa.com | EMPLEADO | PROFESORES    |         395
```

`empleado_id` is non-null for both; `tipo_empleado` matches contract §7.
Password hash uses `bcrypt.hash('password123', 10)` (line 92) — same as the four existing seeded users.

---

## 5. Leftover `backend/scripts/_tmp-seed-profesor-auxiliar.ts`

NOT present. `ls backend/scripts/` shows only the pre-existing
`_tmp-bug-repro.ts`, `_tmp-check-users.ts`, `bootstrap-ssm.sh`, and
`instruments-upgrade.ts`. Nothing to delete; no new tmp scripts added.

---

## Acceptance criteria map

| AC (assignment) | Evidence | Status |
|---|---|---|
| `NominaPeriodo.bonos` Decimal(12,2) NULL | schema.prisma line 440 + DB column `numeric(12,2) YES` | ✓ |
| `RegistroActividad` exact + `@@unique([empleadoId, fecha])` + `@@map` | schema.prisma lines 475-492 | ✓ |
| Migration matches contract §8 (no shadow URL) | `migration.sql` line-by-line MATCH | ✓ |
| `npx prisma migrate status` up to date | "Database schema is up to date!" | ✓ |
| Seed has `profesor@` / `auxiliar@` / `password123` with `empleadoId` | seed.ts lines 106-154 + DB rows | ✓ |
| Delete `_tmp-seed-profesor-auxiliar.ts` if present | Not present; nothing to delete | ✓ (N/A) |

## Conclusion

T2 and T3 are correctly implemented and applied. Worker-1 was not defective
on these two tasks — its work matches the contract and the live DB state
exactly. No re-migration, no fix needed.

Result: **MATCH** → `COMPLETE` to team-lead.
