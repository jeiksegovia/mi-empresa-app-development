# Proposed Plan — Centro de Costos migration (W1 Task 1)

## Pre-migration row count verification (2026-08-05)

```bash
docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c \
  "SELECT 'centros_costos' t, count(*) FROM centros_costos UNION ALL SELECT 'productos_servicios', count(*) FROM productos_servicios UNION ALL SELECT 'egresos', count(*) FROM egresos UNION ALL SELECT 'prefacturas', count(*) FROM prefacturas;"
```

Output (verbatim):
```
          t          | count
---------------------+-------
 centros_costos      |     0
 productos_servicios |     0
 egresos             |     0
 prefacturas         |     0
(4 rows)
```

All 4 tables empty. Drop is safe (R1/N2).

## Schema edits applied to `backend/prisma/schema.prisma`

| Change | Detail |
|---|---|
| DROP models | `ProductoServicio`, `Prefactura`, `Egreso` |
| DROP enum | `EstadoPrefactura` |
| EDIT `Cliente` | removed `prefacturas Prefactura[]` back-relation (line 593 area) |
| KEEP | enum `TipoCentroCostos` (`INGRESOS`, `EGRESOS`) |
| KEEP + extend | `CentroCostos` — added `activo`, `orden`, `createdAt`, `updatedAt`, `@@unique([tipo, nombre])`, `@@index([tipo, activo])` |
| ADD | `CentroCostosItem` — exact fields per plan §Technical Approach |

## Validation

```bash
cd backend && npx prisma validate
# → "The schema at prisma/schema.prisma is valid 🚀"
cd backend && npx prisma generate
# → "✔ Generated Prisma Client (v6.19.2) to ./src/generated/prisma"
```

## Migration SQL (the migration is NOT yet applied — gating on approval)

Migration file: `backend/prisma/migrations/20260805000000_centro_costos_ago5/migration.sql`

```sql
-- Drop FKs first
ALTER TABLE "egresos" DROP CONSTRAINT "egresos_centro_costos_id_fkey";
ALTER TABLE "prefacturas" DROP CONSTRAINT "prefacturas_cliente_id_fkey";
ALTER TABLE "prefacturas" DROP CONSTRAINT "prefacturas_producto_servicio_id_fkey";
ALTER TABLE "productos_servicios" DROP CONSTRAINT "productos_servicios_centro_costos_id_fkey";

-- Extend CentroCostos
ALTER TABLE "centros_costos" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- Drop dead finance tables
DROP TABLE "egresos";
DROP TABLE "prefacturas";
DROP TABLE "productos_servicios";

-- Drop unused enum
DROP TYPE "EstadoPrefactura";

-- Create CentroCostosItem
CREATE TABLE "centro_costos_items" (
    "item_id" SERIAL NOT NULL,
    "centro_costos_id" INTEGER NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "notas" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "valor_unitario" DECIMAL(15,2) NOT NULL,
    "valor_total" DECIMAL(15,2) NOT NULL,
    "periodo" DATE NOT NULL,
    "numero_factura" VARCHAR(100),
    "proveedor" VARCHAR(200),
    "fecha_factura" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "centro_costos_items_pkey" PRIMARY KEY ("item_id")
);

-- Indexes
CREATE INDEX "centro_costos_items_periodo_idx" ON "centro_costos_items"("periodo");
CREATE INDEX "centro_costos_items_centro_costos_id_periodo_idx" ON "centro_costos_items"("centro_costos_id", "periodo");
CREATE INDEX "centros_costos_tipo_activo_idx" ON "centros_costos"("tipo", "activo");
CREATE UNIQUE INDEX "centros_costos_tipo_nombre_key" ON "centros_costos"("tipo", "nombre");

-- FK with onDelete RESTRICT
ALTER TABLE "centro_costos_items" ADD CONSTRAINT "centro_costos_items_centro_costos_id_fkey" FOREIGN KEY ("centro_costos_id") REFERENCES "centros_costos"("centro_id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

## Nomina/empleado tables — confirmation they are untouched

The migration does **not** touch: `empleados`, `contratos`, `nomina_periodos`, `asistencia_empleados`, `usuarios`, `cargos_empresa`, `clientes`, `contactos_emergencia_clientes`, `instrumentos`, `instrumentos_versiones`, `registros_fichas_completadas`, `notas_clientes`, `certificados_empresa`, `certificados_empleado`, `certificados_cliente`, `empresas`, `hojas_vida_empleado`, `pendientes_empleado`, `novedades_empleado`, `medio_pago_nomina`, `contratos_pagos`, `cert_*`. The full list of tables will be verified by `\dt` before and after the migration.

## Seed plan (post-approval, still in Task 1)

Add `DEFAULT_CENTROS_COSTOS` to `backend/src/services/empresaService.ts` with the 11 ordered centros:

```ts
// INGRESOS (5)
{ nombre: 'Mensualidades completas',  tipo: 'INGRESOS', orden: 1 },
{ nombre: 'Mensualidades por día',    tipo: 'INGRESOS', orden: 2 },
{ nombre: 'Transporte',               tipo: 'INGRESOS', orden: 3 },
{ nombre: 'Ingresos adicionales',     tipo: 'INGRESOS', orden: 4 },
{ nombre: 'Valoraciones',             tipo: 'INGRESOS', orden: 5 },
// EGRESOS (6)
{ nombre: 'Refrigerios',              tipo: 'EGRESOS',  orden: 6 },
{ nombre: 'Aseo',                     tipo: 'EGRESOS',  orden: 7 },
{ nombre: 'Papelería',                tipo: 'EGRESOS',  orden: 8 },
{ nombre: 'Eventos',                  tipo: 'EGRESOS',  orden: 9 },
{ nombre: 'Nómina',                   tipo: 'EGRESOS',  orden: 10 },
{ nombre: 'Mantenimiento',            tipo: 'EGRESOS',  orden: 11 },
```

Wired via `createMany({ skipDuplicates: true })` keyed by the new `@@unique([tipo, nombre])`, so running the seed twice is idempotent (R9) and user-created centros are preserved.

## Deviations from the assignment

None. The schema, the migration direction, and the locked decisions D1/D5/D6/D7/D8 are followed verbatim from the feature plan.

## What I will do immediately after approval

1. `cd backend && npx prisma migrate deploy` to apply `20260805000000_centro_costos_ago5`.
2. Verify acceptance criteria 1–5 with `\dt`, `prisma validate`, and the seed re-run.
3. Add `DEFAULT_CENTROS_COSTOS` + seed wiring to `empresaService.ts`.
4. Write `progress-report.md` and move to Task 2 (contract doc).
