# Decision Record — G1: destructive finance migration approved (local)

**Date**: 2026-08-05 · **Gate**: G1 · **Decided by**: developer (explicit approval)
**Worker**: worker-1 · **Task**: 1 · **Migration**: `20260805000000_centro_costos_ago5`

---

## Decision

**APPROVED** — apply `20260805000000_centro_costos_ago5` to the **local dev database only**
(`miempresa_dev`, docker `miempresa-postgres` :15432). Staging is explicitly NOT in scope of this
approval and gets its own gated release cycle.

## What the migration does

| Action | Object |
|---|---|
| DROP TABLE | `egresos`, `prefacturas`, `productos_servicios` |
| DROP TYPE | `EstadoPrefactura` |
| DROP CONSTRAINT | the 4 FKs of the finance subgraph (incl. `prefacturas_cliente_id_fkey`) |
| ADD COLUMN | `centros_costos`: `activo`, `orden`, `created_at`, `updated_at` |
| CREATE TABLE | `centro_costos_items` (+2 indexes, FK `ON DELETE RESTRICT`) |
| CREATE INDEX | `centros_costos_tipo_activo_idx`, unique `centros_costos_tipo_nombre_key` |

## Evidence base

Row counts were gathered **twice independently** — once by worker-1, once by the orchestrator
re-running the query directly (P8 trust-but-verify, never validate from the worker's message alone):

```
 centros_costos      | 0
 productos_servicios | 0
 egresos             | 0
 prefacturas         | 0
```

Additional orchestrator verification before approving:
- `_prisma_migrations` latest row was still `20260804165919_add_empleado_bloqueado` → the worker
  genuinely waited at the gate and applied nothing.
- On-disk `migration.sql` matched the SQL quoted in `proposed-plan.md` exactly.
- `grep prefacturas backend/prisma/schema.prisma` → no matches (WI-4 satisfied; `prisma validate` would
  otherwise fail).
- The DDL references **no** nómina/empleado/contrato/asistencia object. Only the 4 finance tables
  appear. Intake §4.3 had already established the FK subgraph is self-contained apart from
  `prefacturas → clientes`.

## Why the drop is safe

The FINANCE MODULE was scaffolded in `20260218003359_initial_schema` for a product-catalog +
invoicing concept, has **zero** references in `backend/src`, `backend/tests`, `frontend/`, or
`seed.ts`, and never held a row. It is not a feature being removed — it is scaffolding that was
never built on. Its shape does not match the model the user described (intake §2.1).

---

## ⚠️ Carried-forward release blocker (RB-1)

`migration.sql:24` adds a NOT NULL column with **no default**:

```sql
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL;
```

- **Local**: succeeds — `centros_costos` has 0 rows.
- **Staging**: if `centros_costos` has **≥1 row**, PostgreSQL rejects this statement and the migration
  fails *after* the preceding `DROP TABLE`s have already run, leaving the schema half-migrated.

The developer chose to apply as-is locally rather than pre-emptively patch the DDL. Therefore:

**Before the staging release, R0 preflight MUST:**
1. `SELECT count(*) FROM centros_costos;` on staging.
2. If non-zero → amend the migration to `DEFAULT CURRENT_TIMESTAMP` (or backfill first) before deploy.
3. Confirm staging counts for `productos_servicios`, `egresos`, `prefacturas` are also 0 — intake §4.2
   verified **local only**; staging was never checked (open item O1).

This supersedes nothing; it adds a hard precondition to the next release runbook.

---

## Follow-through

worker-1 was released with `APPROVED` and instructed to: apply the migration, verify acceptance
criteria 1–5 (`\dt` before/after, `prisma validate`, seed idempotency), then seed the 11 centros and
proceed to task 2 (contract document).
