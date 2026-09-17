# Proposed plan — T9 (centro_costos_aug17_qa migration) — W4

**Worker**: W4 (pt-backend-eng) on `feature-centro-costos-ago-5`
**Gate**: G4 — orchestrator approval required before `migrate deploy`.

---

## 1. Pre-migration row counts (verbatim)

```
docker exec miempresa-postgres psql -U miempresa -d miempresa_dev -c \
  "SELECT tipo, nombre, orden, centro_id FROM centros_costos ORDER BY tipo, orden; SELECT count(*) AS items FROM centro_costos_items;"
```

Output:

```
   tipo   |         nombre          | orden | centro_id
----------+-------------------------+-------+-----------
 INGRESOS | Mensualidades completas |     1 |        17
 INGRESOS | Mensualidades por día   |     2 |        18
 INGRESOS | Transporte              |     3 |        19
 INGRESOS | Ingresos adicionales    |     4 |        20
 INGRESOS | Valoraciones            |     5 |        21
 EGRESOS  | Refrigerios             |     6 |        22
 EGRESOS  | Aseo                    |     7 |        23
 EGRESOS  | Papelería               |     8 |        24
 EGRESOS  | Eventos                 |     9 |        25
 EGRESOS  | Nómina                  |    10 |        26
 EGRESOS  | Mantenimiento           |    11 |        27
(11 rows)

 items
-------
    10
(1 row)
```

- `centros_costos`: **11** rows
- `centro_costos_items`: **10** rows
- Existing `periodo` values are all day-1 of their month (the service normalizes on write), so the backfill `fecha := periodo` is lossless.

---

## 2. Schema additions (exact delta on `backend/prisma/schema.prisma`)

```prisma
model CentroCostos {
  // …existing fields…
  precioUnitario  Decimal?  @map("precio_unitario") @db.Decimal(15, 2)
  habilitarRecibo Boolean   @default(false)        @map("habilitar_recibo")
  // …existing @@unique([tipo, nombre])…
}

model CentroCostosItem {
  // …existing fields…
  fecha                 DateTime           @db.Date   // NEW, required (D10)
  // …periodo stays…
  pagador               String?            @db.VarChar(200)                  // D11
  beneficiarioClienteId Int?               @map("beneficiario_cliente_id")   // D11
  medioPago             MedioPagoIngreso?  @map("medio_pago")                // D11
  // …relation to Cliente (new)…
  beneficiario          Cliente?  @relation("ClienteBeneficiarioItems", fields: [beneficiarioClienteId], references: [id], onDelete: SetNull)
  @@index([beneficiarioClienteId])   // NEW
}

model Cliente {
  // …
  itemsComoBeneficiario CentroCostosItem[] @relation("ClienteBeneficiarioItems")  // NEW back-relation
}

enum MedioPagoIngreso { EFECTIVO  TRANSFERENCIA }   // NEW enum (additive)
```

Verified by `npx prisma validate` ✅.

---

## 3. Migration SQL — verbatim (already created)

File: `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/migration.sql`

```sql
-- centro_costos_aug17_qa: aug-17 centro-costos QA feedback (additive)
-- Decisions D10 / D11 / D13 / D14.
--   - fecha DATE required on every item (D10)
--   - ingreso columns on CentroCostosItem (D11)
--   - precioUnitario + habilitarRecibo on CentroCostos (D11/D13)
-- Pre-migration row counts (captured 2026-08-18):
--   centros_costos: 11 rows, centro_costos_items: 10 rows.

-- CreateEnum
CREATE TYPE "MedioPagoIngreso" AS ENUM ('EFECTIVO', 'TRANSFERENCIA');

-- Step 1: add `fecha` as NULLable, backfill from `periodo`, then enforce NOT NULL.
ALTER TABLE "centro_costos_items" ADD COLUMN "fecha" DATE;

UPDATE "centro_costos_items"
   SET "fecha" = "periodo"
 WHERE "fecha" IS NULL;

ALTER TABLE "centro_costos_items" ALTER COLUMN "fecha" SET NOT NULL;

-- Step 2: add the rest of the additive columns.
ALTER TABLE "centro_costos_items" ADD COLUMN "beneficiario_cliente_id" INTEGER,
ADD COLUMN                     "medio_pago" "MedioPagoIngreso",
ADD COLUMN                     "pagador" VARCHAR(200);

ALTER TABLE "centros_costos" ADD COLUMN "habilitar_recibo" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN                    "precio_unitario" DECIMAL(15,2);

CREATE INDEX "centro_costos_items_beneficiario_cliente_id_idx"
  ON "centro_costos_items"("beneficiario_cliente_id");

ALTER TABLE "centro_costos_items"
  ADD CONSTRAINT "centro_costos_items_beneficiario_cliente_id_fkey"
  FOREIGN KEY ("beneficiario_cliente_id")
  REFERENCES "clientes"("cliente_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

### Why a 3-step NOT NULL pattern

PostgreSQL rejects `ADD COLUMN … NOT NULL` on a non-empty table without a DEFAULT. The two safe options are documented in the contract RB-1 footnote: backfill before NOT NULL, or add with DEFAULT then drop. The 3-step pattern is **add nullable → backfill from `periodo` → enforce NOT NULL**, which keeps the column shape the application expects (no transient DEFAULT).

### Safety invariants

- **Additive only**: no DROP, no rename of existing columns, no NOT NULL on pre-existing columns.
- **No destructive flag**: I am NOT touching `prisma migrate diff --shadow-database-url`.
- **No edit to** `20260805000000_centro_costos_ago5` (the original ago-5 migration is untouched).
- **Item count before/after migration is identical**: zero rows are deleted, no UPDATE changes a key.

---

## 4. Post-migration data fix + DEFAULT_CENTROS_COSTOS update

Run **after** `npx prisma migrate deploy` succeeds. Sequence (each step is idempotent / safe to re-run):

1. Rename existing `Transporte` → `Transporte completo` (preserves any ítems already attached to it):
   ```sql
   UPDATE centros_costos
      SET nombre = 'Transporte completo'
    WHERE tipo = 'INGRESOS' AND nombre = 'Transporte';
   ```

2. Insert the three new INGRESOS rows (uses the same `@@unique([tipo, nombre])` + `createMany({ skipDuplicates: true })` pattern that already exists):
   - `Mensualidad por 4 días` (orden 2)
   - `Mensualidad por 3 días` (orden 3)
   - `Transporte por 3 días` (orden 6)

3. Resequence all 14 centros to the D12 ordering:

   | orden | nombre | tipo |
   |---|---|---|
   | 1 | Mensualidades completas | INGRESOS |
   | 2 | Mensualidad por 4 días | INGRESOS |
   | 3 | Mensualidad por 3 días | INGRESOS |
   | 4 | Mensualidades por día | INGRESOS |
   | 5 | Transporte completo | INGRESOS |
   | 6 | Transporte por 3 días | INGRESOS |
   | 7 | Ingresos adicionales | INGRESOS |
   | 8 | Valoraciones | INGRESOS |
   | 9 | Refrigerios | EGRESOS |
   | 10 | Aseo | EGRESOS |
   | 11 | Papelería | EGRESOS |
   | 12 | Eventos | EGRESOS |
   | 13 | Nómina | EGRESOS |
   | 14 | Mantenimiento | EGRESOS |

   Implementation: a small data-fix function in `empresaService.ts` that runs as part of `seedCentrosCostos()` (single source of truth, runs on every startup, second startup is a no-op). UPDATE-by-name keeps any user-created centro out of the rewrite (its `nombre` won't match).

4. Update `DEFAULT_CENTROS_COSTOS` constant in `empresaService.ts` to the **final 14-row catalog** so new environments get it from the seed and existing environments converge on it after the first startup.

5. **Idempotency check**: run the data-fix twice on the dev DB; the second run is a no-op (zero UPDATEs affected).

---

## 5. T9 acceptance — how each will be verified (verbatim)

1. `\d centro_costos_items` lists columns `fecha`, `pagador`, `beneficiario_cliente_id`, `medio_pago`.
2. `\d centros_costos` lists columns `precio_unitario`, `habilitar_recibo`.
3. `SELECT nombre FROM centros_costos WHERE tipo='INGRESOS' ORDER BY orden;` returns the 8 D12 names; no exact `Transporte` row remains.
4. `SELECT count(*) FROM centro_costos_items;` before vs after migration: identical.
5. Contract file `orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` is **edited in place** (no new filename).

---

## 6. Risks + traps addressed

- `@@unique([tipo, nombre])` collision on the Transporte rename → rename happens **before** inserting `Transporte completo` (handled in step 1 vs step 2 ordering above).
- `precioUnitario` default NULL is intentional — the service returns 400 when a centro price is missing on INGRESOS create, not a silent 0.
- `beneficiario` FK uses `onDelete: SetNull` so deleting a Cliente doesn't cascade-delete historical income items.
- `habilitar_recibo` defaults to `false` so existing INGRESOS centros behave unchanged; ADMIN flips per centro.
- Decimal still serializes as string (contract §1.2); no code path was changed.

---

## 7. Files I will touch in T9 (post-approval)

- `backend/prisma/schema.prisma` — already edited (validate ✅)
- `backend/prisma/migrations/20260819025302_centro_costos_aug17_qa/migration.sql` — already edited
- `backend/src/services/empresaService.ts` — `DEFAULT_CENTROS_COSTOS` (14 rows) + a `applyAug17SeedFix()` helper run from `seedCentrosCostos()`
- `development/feature-centro-costos-ago-5/orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md` — `## Wave 4 notes` section filled in

---

**Awaiting `APPROVED` before running `npx prisma migrate deploy`.**
