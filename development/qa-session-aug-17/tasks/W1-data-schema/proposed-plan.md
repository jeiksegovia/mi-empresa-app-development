# Proposed plan — Task 2 schema + migration (qa-session-aug-17)

**Author:** W1 (pt-data-schema)
**Gate:** PLAN-APPROVAL required before `prisma migrate deploy`
**Contract:** `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md` §3 + §4 + §8

## Exact Prisma changes

### 1. `NominaPeriodo` — additive column

```prisma
bonos Decimal? @map("bonos") @db.Decimal(12, 2)
```

Placed after `aportesSociales` (or adjacent money fields). Nullable — existing rows get `NULL` (= 0 in formulas).

### 2. New model `RegistroActividad`

```prisma
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

### 3. Back-relations

- `Empleado.registrosActividad RegistroActividad[]`
- `Usuario.actividadesRegistradas RegistroActividad[] @relation("ActividadRegistrador")`

## Row-count / data risk

| Change | Risk | Why safe |
|---|---|---|
| `nomina_periodos.bonos` NULL | **Low** | Additive nullable; no backfill; existing calc paths treat null as 0 once W2 lands |
| `registro_actividades` CREATE | **None** | Empty new table; FKs to existing `empleados` / `usuarios` |
| Indexes / unique | **None** | New table only |

No renames, no drops, no enum changes, no NOT NULL on existing columns.

## Migration directory

`backend/prisma/migrations/<timestamp>_add_nomina_bonos_and_registro_actividades/`

Timestamp will be generated at apply time (local clock), name suffix fixed.

### SQL gist (up)

```sql
ALTER TABLE "nomina_periodos"
  ADD COLUMN IF NOT EXISTS "bonos" DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS "registro_actividades" (
  "registro_actividad_id" SERIAL PRIMARY KEY,
  "empleado_id" INTEGER NOT NULL,
  "fecha" DATE NOT NULL,
  "texto" TEXT NOT NULL,
  "registrado_por" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "registro_actividades_empleado_id_fkey"
    FOREIGN KEY ("empleado_id") REFERENCES "empleados"("empleado_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "registro_actividades_registrado_por_fkey"
    FOREIGN KEY ("registrado_por") REFERENCES "usuarios"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "registro_actividades_empleado_id_fecha_key"
  ON "registro_actividades"("empleado_id", "fecha");
CREATE INDEX IF NOT EXISTS "registro_actividades_fecha_idx"
  ON "registro_actividades"("fecha");
CREATE INDEX IF NOT EXISTS "registro_actividades_empleado_id_idx"
  ON "registro_actividades"("empleado_id");
```

### SQL gist (down — documented alongside, not auto-run)

```sql
DROP TABLE IF EXISTS "registro_actividades";
ALTER TABLE "nomina_periodos" DROP COLUMN IF EXISTS "bonos";
```

## Apply steps (after PROCEED)

1. Edit `backend/prisma/schema.prisma` (models above).
2. Write migration dir + `migration.sql` by hand (additive; no `migrate diff --shadow-database-url`).
3. Optional dry validation: `npx prisma validate` + `npx prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script` (read-only; **no** shadow URL) — record output in progress-report.
4. `cd backend && npx prisma migrate deploy` against local `:15432`.
5. `npx prisma generate` so client types include `bonos` / `RegistroActividad`.
6. Append evidence (command + output) to progress-report.md.

## Out of scope in this gate

- Seed users (Task 3, after migrate).
- Routes / services / FE (W2 / W3).
- Staging apply.
