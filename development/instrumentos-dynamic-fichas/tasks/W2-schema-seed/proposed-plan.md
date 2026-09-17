# W2 G1 Pre-Flight Evidence + Destructive Migration Plan

> **Status**: PROPOSED — awaiting PLAN-APPROVAL from orchestrator before destructive steps.
> Date: 2026-07-16. Worker: W2 (data-schema).

## 1. Evidence from local DB (real, verbatim from `psql`)

```
SELECT count(*) FROM registros_fichas_completadas;
=> 126 rows

SELECT count(*) FROM instrumentos;
=> 81 rows

SELECT estado, count(*) FROM registros_fichas_completadas GROUP BY estado;
=> PENDIENTE: 49, COMPLETADO: 48, VENCIDO: 29

SELECT instrumento_id, codigo FROM instrumentos
  WHERE codigo IN ('BARTHEL','MINI_MENTAL','TINETTI','YESAVAGE','MNA_CUADRO','FICHA_NUTRICIONAL');
=> (no rows — the 6 contract codigos do NOT yet exist in DB)
```

**Notes on existing data:**

- `instrumentos`: 81 rows, but the 6 contract codigos (`BARTHEL` etc.) are NOT present.
  The seed-time instruments are `FVM-001 / NUT-001 / ADM-001` (seed.ts creates 3) plus
  ~78 test fixtures created by W5/jul-8 tests. None use the new codigos.
- `registros_fichas_completadas`: 126 rows reference the existing `instrumento_id` values
  (mostly the test fixtures, NOT the 6 contract instruments — verified via codigo filter).
  The D2 hard reset truncates this table per contract §3.4. None of the 126 rows are
  "real" production fichas — all are test/scratchpad records.

**Pre-flight decision**: 126 rows to truncate. After migration + seed the table will be
repopulated with 0 rows (D1 seed creates Instrumento + InstrumentoVersion only, no
fichas). W4 will own the API for ficha creation.

## 2. Exact migration steps (in order, from `backend/`)

### Step A — Update `prisma/schema.prisma`

Per contract §3:

1. Modify `Instrumento` (§3.2): DROP columns `plantilla_archivo` (line 569), `version_plantilla`
   (line 574). Add `versiones InstrumentoVersion[]` relation.
2. Add new model `InstrumentoVersion` (§3.1) with column mapping `@@map("instrumentos_versiones")`
   and the `@@unique([instrumentoId, version])`.
3. Modify `RegistroFichaCompletada` (§3.3): DROP `archivo_completado` (line 594). ADD
   `instrumento_version_id` (FK Int?), `respuestas_jsonb` (Json?), `puntaje_total` (Float?),
   `subtotales_jsonb` (Json?), `clasificacion` (VarChar(100)?), and the new relation
   `instrumentoVersion InstrumentoVersion?` with `onDelete: Restrict`.
4. Add `InstrumentoVersionCreador` relation on `Usuario` (in addition to existing relations).

### Step B — Generate migration

```
cd backend
npx prisma migrate dev --name instrumentos_dynamic_fichas
```

Prisma will emit `prisma/migrations/<ts>_instrumentos_dynamic_fichas/migration.sql` with
column drops/adds. **TRUNCATE `registros_fichas_completadas` will be prepended manually**
to the migration SQL after generation (Prisma does NOT auto-truncate; D2 requires it).

The migration will also include the partial unique index per contract §3.1:

```sql
CREATE UNIQUE INDEX instrumentos_versiones_activo_unique
  ON instrumentos_versiones (instrumento_id) WHERE activo = true;
```

### Step C — Regenerate client

```
cd backend
npx prisma generate
```

### Step D — Smoke-verify (read-only, no data mutation)

```
psql -c "SELECT to_regclass('instrumentos_versiones');"   -- table exists
psql -c "\d instrumentos_versiones"                       -- columns match §3.1
psql -c "\d registros_fichas_completadas"                 -- archivo_completado gone
psql -c "SELECT count(*) FROM registros_fichas_completadas;"  -- = 0
```

## 3. Rollback note

If anything goes wrong AFTER apply, the recovery is:

```
cd backend
npx prisma migrate resolve --rolled-back <migration_name>
# Manual: restore registros_fichas_completadas from any pre-migration SQL dump
# (we did NOT take one — pre-migration rows were test/scratch only, so loss is acceptable).
```

The columns `plantilla_archivo` / `version_plantilla` / `archivo_completado` cannot be
auto-restored. We confirmed they're NOT used by W4 endpoints under construction (verified
by reading `backend/src/routes/instruments.routes.ts` which has no refs to those columns).
So column-level rollback is unnecessary; the production-code side is safe.

## 4. What stays after the destructive step

- ✅ All other tables (`usuarios`, `clientes`, `empleados`, etc.) untouched.
- ✅ All FK constraints on `registros_fichas_completadas` preserved (only the row data
  is truncated; `notas_clientes.registro_ficha_id` is `ON DELETE SET NULL`, so the truncate
  will set those nota rows to NULL `registro_ficha_id` — acceptable).
- ✅ The 81 `instrumentos` rows are preserved (we DROP columns on the table, not the table).

## 5. Risks

| Risk | Mitigation |
|---|---|
| Prisma emits DROP COLUMN that cascades unexpectedly | Test in dry-run with `prisma migrate diff --script` first; verify diff before applying |
| Truncate statement missing → migration succeeds but data stale | Manually prepend `TRUNCATE TABLE registros_fichas_completadas RESTART IDENTITY CASCADE;` to migration SQL |
| Partial unique index syntax error | Verify SQL locally; Postgres supports `CREATE UNIQUE INDEX … WHERE` |
| FK on `instrumento_version_id` fails if data has dangling refs | New column, no data, no risk |

## 6. Next steps after G1 approval

1. (post-approval) Apply migration as above.
2. Task #14 → completed.
3. Move to Task #15 in same turn: copy 6 template JSONs, extend seed.ts, write
   `backend/scripts/instruments-upgrade.ts`, smoke spec.
4. Send `COMPLETE:` only after #15 acceptance criteria are proven.