# D7 CargoEmpresa Migration — Proposed Plan (PLAN-APPROVAL GATE)

**Task:** T1 (W1-backend), migration #4 of 4
**Author:** pt-backend-eng (W1)
**Date:** 2026-07-09
**Source-of-truth docs:** `context/user-feedback/improvements-jul-9-insights.md` §D7; `task-assignment-t1-migrations.md`.
**Gate:** Plan-approval required from orchestrator before executing any D7 migration SQL.

---

## 1. Findings from local DB inspection

### 1.1 `Contrato.cargo` does NOT exist in the live schema

**This is a meaningful deviation from the assignment.** Both the assignment and the insights doc §D7 phrase the migration as:

> "`cargo String` → `cargoId Int?` initially (nullable during migration), backfill via matching existing `cargo` strings to seeded `CargoEmpresa` rows, then `NOT NULL`."

Live `\d contratos` against `miempresa_dev` shows the actual columns:

```
 contrato_id, empleado_id, tipo_contrato, fecha_inicio, fecha_fin,
 archivo_url, activo, created_at, updated_at
```

There is **no `cargo` column** on `contratos` — never was. Confirmed by:

```sql
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
 WHERE TABLE_NAME = 'contratos'
 ORDER BY ORDINAL_POSITION;
-- 9 columns returned, none named `cargo`
```

Local `contratos` row count: 0. The assignment's `SELECT DISTINCT cargo FROM contratos` returns **zero rows**. There is no source data on `Contrato` to backfill from.

### 1.2 Source data that DOES exist (for context)

| Table.column | Distinct values | Row count | Notes |
|---|---|---|---|
| `nominas.cargo` | `Ingeniero de Software Senior` | 1 nomina | Single seeded row |
| `cargos.nombre_cargo` (legacy "Empleado cargo history") | 10× `P3 cargo 17…` (playwright-only) + `Gerente de Proyectos`, `Ingeniero de Software Senior`, `FIX-5 cargo` | 12 rows | Test/junk rows dominate; only 2 are real |

These are **not** valid backfill sources for `Contrato.cargoId`:
- `nominas.cargo` belongs to a payroll concept (one per payroll period), not a contract role.
- `cargos.nombre_cargo` is a per-empleado historical log with junk values.

The ground truth is: **no live `Contrato` rows exist, and none ever had a `cargo` attribute**. This is consistent with the schema's design — `Nomina` carried the cargo label until now; contracts became their own entity around the jul-4 nomina foundation migrations.

### 1.3 What the user actually requested (insights doc §D7, locked L1)

> "Cargo → new `CargoEmpresa` table (per-empresa). `Contrato.cargoId → CargoEmpresa.id`. Enum-like but per-tenant configurable + soft-deletable via `activo` flag. Seed with the 7 initial values; empresa admins add more via `/empresa/configuracion`."

> "Contrato migration: `cargo String` → `cargoId Int?` initially (nullable during migration), backfill via matching existing `cargo` strings to seeded `CargoEmpresa` rows, then `NOT NULL`."

The user assumed `Contrato.cargo` existed (likely a memory glitch from initial design). The intent is clear regardless:
- Cargo should become a per-empresa catalog (`CargoEmpresa`)
- Future contratos select from that catalog via FK
- The `cargo` text label (if it existed) is captured in the catalog row

---

## 2. Proposed approach (DEVIATION from assignment phrasing)

### 2.1 Deviations

| Assignment said | What we actually do | Rationale |
|---|---|---|
| `Contrato.cargo` → `Contrato.cargoId` | **No `cargo` column ever existed** → just add `Contrato.cargoId` (nullable, INT FK) | No source data; no `cargo→cargoId` mapping needed |
| "`SET NOT NULL` on `Contrato.cargoId`" | Leave `cargoId` **nullable**; UI prevents null at create time | Same rationale — no historical rows to enforce against; new contratos will always pick one |
| "KEEP `Contrato.cargo` column for now (deprecate later)" | Nothing to keep | Column never existed |

### 2.2 Migration scope

1. **Create `CargoEmpresa`** model exactly per insights doc §D7.
2. **Add `Contrato.cargoId Int? @map("cargo_id")`** with FK + `@@index`. Nullable (no NOT NULL in this migration).
3. **Seed `CargoEmpresa`** per existing empresa (currently 1: `Mi Empresa S.A.S.`) with the 7 user-listed values + `Otro`:
   - `Fisioterapeuta`
   - `Terapeuta Ocupacional`
   - `Educador Físico`
   - `Manualidades`
   - `Auxiliar de Enfermería`
   - `Auxiliar de Servicios Generales`
   - `Otro`
   Unique constraint `(empresa_id, nombre)` enforces the catalog. `activo=true` and `created_at=now()` defaults.
4. **No backfill step** (zero contratos in DB).
5. **No `cargo` column** on `Contrato`.

### 2.3 Migration order (single transaction, idempotent guards)

```
1. CREATE TABLE cargos_empresa ...           -- guarded IF NOT EXISTS
2. CREATE UNIQUE INDEX cargos_empresa_empresa_id_nombre_key ...   -- guarded
3. CREATE INDEX cargos_empresa_empresa_id_idx ...   -- guarded
4. ALTER TABLE contratos ADD COLUMN cargo_id INTEGER;   -- guarded IF NOT EXISTS
5. CREATE INDEX contratos_cargo_id_idx ...
6. ALTER TABLE contratos ADD CONSTRAINT contratos_cargo_id_fkey ...   -- guarded
7. INSERT INTO cargos_empresa (empresa_id, nombre, activo, created_at)
       SELECT e.id, s.nombre, true, NOW()
       FROM empresas e
       CROSS JOIN (VALUES
         ('Fisioterapeuta'),
         ('Terapeuta Ocupacional'),
         ('Educador Físico'),
         ('Manualidades'),
         ('Auxiliar de Enfermería'),
         ('Auxiliar de Servicios Generales'),
         ('Otro')
       ) AS s(nombre)
       ON CONFLICT (empresa_id, nombre) DO NOTHING;       -- idempotent
```

The `ON CONFLICT … DO NOTHING` makes the seed safe under repeat runs against staging.

### 2.4 API impact (informational — W1 wave-2 owns the routes)

- `GET    /api/v1/empresa/cargos?activo=true|false|all` → list `CargoEmpresa` rows for current empresa
- `POST   /api/v1/empresa/cargos` → create `{ nombre: string }`, returns the created row
- `PATCH  /api/v1/empresa/cargos/:id` → soft-archive (`activo=false`) or rename (rename is a separate concern; v1 only archives)
- No DELETE endpoint (soft-delete via `activo`).
- `POST /api/v1/contratos` body gains `{ cargoId: number }` (or accepts legacy `cargo` text and warns — see below).
- `POST /api/v1/empleados/:id/contrato` (or whatever the current path is) gains the same.

### 2.5 Legacy graceful-degradation (recommendation for wave-2 API worker)

`Contrato.cargoId` is nullable. During a transition window (or if API does not yet expose cargo UI), wave-2 may keep accepting the old `cargo: string` body param and store it as either a side-channel or as a follow-up migration. **For this migration, ONLY add the FK column and the catalog. Legacy `cargo` payloads will fail Zod validation in the new API; document the break in `schema-contract-jul9.md`.**

### 2.6 Verification commands (to be run after `migrate dev`)

```sql
-- Catalog seeded per empresa
SELECT e.nombre AS empresa, COUNT(c.*) AS cargos_seeded
  FROM empresas e LEFT JOIN cargos_empresa c ON c.empresa_id = e.id
  GROUP BY e.nombre;
-- Expect: 1 row, "Mi Empresa S.A.S.", cargos_seeded=8

-- Contrato.cargo_id column added
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_name='contratos' AND column_name='cargo_id';
-- Expect: cargo_id | integer | YES

-- Index + FK exist
SELECT conname FROM pg_constraint WHERE conname='contratos_cargo_id_fkey';
-- Expect: 1 row

-- No NOT NULL on cargo_id (intentional)
SELECT is_nullable FROM information_schema.columns
  WHERE table_name='contratos' AND column_name='cargo_id';
-- Expect: YES
```

`npx prisma migrate status` → clean.
`curl http://localhost:3101/api/v1/health` → 200.

---

## 3. Risks & rollback

- **Rollback:** drop `cargos_empresa` and `cargo_id` (single migration folder; new table + column, no permanent data lost — first tenants are seeded, not user-generated).
- **Risk class:** LOW — additive table, additive nullable column, idempotent seed.
- **No staging/prod touch:** this plan runs against `miempresa_dev` (port 15432, dev DB) only.

---

## 4. Pending orchestrator decisions

**SendMessage(to="main", message="PLAN-APPROVAL: D7 cargo migration plan ready. See tasks/W1-backend/proposed-plan.md")**

Decisions requested from orchestrator:
1. Approve proceeding with the deviation in §2.1 (add `Contrato.cargoId` nullable instead of the NOT NULL + backfill the assignment said).
2. Approve the seed list of 7 cargos + `Otro`.
3. Approve the migration order in §2.3.

If any of the three is rejected, this worker halts at the D7 step; migrations #1-3 are already complete and remain in place.
