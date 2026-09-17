# W1 Schema Contract — Progress Report

**Worker:** pt-data-schema (worker-1)
**Task:** 1 — Schema + cargos migration + contract doc
**Started:** 2026-07-31

## Subtask 0 — Context loaded ✅ Done

- Read assignment: `task-assignment-schema-contract.md`
- Read feature plan: `qa-session-jul-24-plan.md`
- Read team plan: `team-plan-qa-session-jul-24.md`
- Read `backend/prisma/schema.prisma` — confirmed enums `MedioPagoNomina` (line 1078) and
  `TipoContrato` (line 933); `Contrato.valorJornada` at line 375; FK on
  `cargoId`→`CargoEmpresa.id` `onDelete: Restrict` (line 373); unique
  `(empresaId, nombre)` on `CargoEmpresa` (line 400).
- Read `backend/src/services/empresaService.ts` — `DEFAULT_CARGOS` at line 35 currently
  contains 7 strings (Fisioterapeuta, Terapeuta Ocupacional, Educador Físico, Manualidades,
  Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro).
- Confirmed DB env (`postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev`).
- Confirmed docker container `miempresa-postgres` is up on :15432.
- `package.json` scripts: `db:migrate` = `prisma migrate dev`, `db:generate` = `prisma generate`.

## Subtask 1 — Deviation discovered ⚠ BLOCKED

`npx prisma migrate dev` not yet run. Inspecting the current DB to verify the guard
behaviour revealed an assignment-stated assumption does NOT hold on this local DB.

### Deviation evidence (verbatim `psql` output)

**`cargos_empresa` (target list differs from reality):**
```
 cargo_id | empresa_id |    nombre    | activo
----------+------------+--------------+--------
       42 |         14 | Auxiliar QA  | t
(1 row)
```
The 7 cargos seeded by `20260710024928_jul9_cargo_empresa` are **NOT** present (Fisioterapeuta,
Terapeuta Ocupacional, Educador Físico, Manualidades, Auxiliar de Enfermería, Auxiliar de
Servicios Generales, Otro). Only one row remains: `cargo_id=42 nombre='Auxiliar QA'`.

**`contratos` (all 24 rows depend on the non-target cargo):**
```
 cargo_id |   nombre    | count
----------+-------------+-------
       42 | Auxiliar QA |    24
```
24 of 24 contracts reference `cargo_id=42`. Zero NULLs. 100% dependency on the
non-target cargo.

**`MedioPagoNomina` enum (still 2 values — as expected pre-migration):**
```
 {NEQUI,TRANSFERENCIA_BANCARIA}
```

### Why this breaks the assignment

Assignment §4 says: "**GUARD**: before deleting, if any `contratos.cargo_id` references a
cargo row that would be removed, RAISE a clear SQL exception with the offending cargo
name — do NOT silently drop."

"Auxiliar QA" is NOT in the target list of 10 cargos. Therefore every contrato in the
local DB is a contract that "would be removed" → the guard will fire on the first DELETE.

Assignment §4 also says: "**On local this should pass clean; the guard protects staging.**"
That assumption does not hold for this DB.

### Status: BREAKING TURNING POINT

Sent `TURNING-POINT-BREAKING` to team-lead with 4 options (A: reassign-then-recreate,
B: temporary "Otro" cargo, C: destructive delete, D: skip guard). **No source files
modified**, no migration run, no contract doc written yet. Waiting for orchestrator
decision before proceeding.

## Strategy Request

See `TURNING-POINT-BREAKING` message to team-lead. Decision needed:
how to map "Auxiliar QA" → one of the 10 target cargos so the FK guard passes on local
while preserving the 24 contract rows. Option A with explicit orchestrator-approved
mapping is the recommended path; B is a safer fallback if the mapping is unclear.

## Subtask 2 — Safe edits applied ✅ Done (per team-lead WAITING directive)

Team-lead replied: "Hold cargos migration; proceed on enum+column safely." Did the
three independent, non-cargo edits:

1. **Enum EFECTIVO** — added `EFECTIVO` to `enum MedioPagoNomina` at
   `backend/prisma/schema.prisma:1081` (with comment `qa-session-jul-24 R1`).
2. **Contrato.valorMensual** — added nullable column at
   `backend/prisma/schema.prisma:377` (comment `qa-session-jul-24 R7`).
3. **DEFAULT_CARGOS** — replaced the 7-item list in
   `backend/src/services/empresaService.ts:35-49` with the 10-item target list
   (Base 5 + Profesional 5). Updated the comment to point at the future
   `qa_jul24_*` migration instead of the old `20260710024928_jul9_cargo_empresa`.

### Validation evidence

- `npx prisma validate` →
  ```
  The schema at prisma/schema.prisma is valid 🚀
  ```
- `npx prisma generate` →
  ```
  ✔ Generated Prisma Client (v6.19.2) to ./src/generated/prisma in 151ms
  ```
- `grep` confirms all three edits are in place (enum line 1081, column line 377,
  DEFAULT_CARGOS lines 35-49).

### What was NOT done (intentional hold)

- **No `prisma migrate dev` run** — the migration generation needs to bundle the
  enum + column additions with the cargos delete+recreate. Once NEW-APPROACH
  arrives, the migration will be created in one shot.
- **No migration file created** under `backend/prisma/migrations/`.
- **No contract doc published** — cargo list section depends on the final mapping
  decision. Will publish after NEW-APPROACH.
- **No `migrate status`** run.

## Status: WAITING for team-lead `NEW-APPROACH` on the cargo mapping.

## Subtask 3 — Cargo delete+recreate migration ✅ Done (per team-lead NEW-APPROACH)

Team-lead delivered the approved `NEW-APPROACH`:
- Fallback cargo = `Temporal`, full delete+recreate with reassign-ALL-to-fallback.
- 4-step FK-safe ordering documented in
  `orchestration-ctx/decisions/cargos-fk-reassignment.md`.

### Pre-flight fix (drift, non-destructive)

`prisma migrate dev` initially refused with
"The migration `20260717045038_instrumentos_dynamic_fichas` was modified after it was
applied." Investigation showed a stale `rolled_back_at IS NOT NULL` row in
`_prisma_migrations` for that migration (an earlier failed attempt). File on disk matched
the successful `applied_steps_count=1` row's checksum
(`e7ff6c5c86fa81e83f95497462295a74b6782627da0e918aa446e4da3032e19f`). Resolution: single
`DELETE FROM _prisma_migrations WHERE migration_name='20260717045038_instrumentos_dynamic_fichas'
AND finished_at IS NULL AND rolled_back_at IS NOT NULL` (1 row deleted). After that, Prisma
could proceed. No DB schema touched, no data lost.

### Migration authored

File: `backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql`
- Prisma-generated diff: `ALTER TYPE ... ADD VALUE 'EFECTIVO'` + `ADD COLUMN valor_mensual`.
  Hand-edited to `IF NOT EXISTS` for idempotency (Prisma's default omits it).
- Appended 4 cargo steps (insert 10 target cargos per empresa; UPDATE contratos →
  Temporal; defensive guard; DELETE non-target). Both raw SQL `IF NOT EXISTS` and
  Prisma-style ALTERs are used consistently with the project's existing migration
  patterns (e.g. `20260710024928_jul9_cargo_empresa`, `20260717120000_jul17_tipo_empleado_contratos`).

### Apply + verification (verbatim `psql` output)

`npx prisma migrate dev` →
```
Applying migration `20260731203612_qa_jul24_cargos_efectivo_valormensual`
The following migration(s) have been applied:
migrations/
  └─ 20260731203612_qa_jul24_cargos_efectivo_valormensual/
    └─ migration.sql
Your database is now in sync with your schema.
✔ Generated Prisma Client (v6.19.2) to ./src/generated/prisma in 142ms
```

`SELECT cargo_id, empresa_id, nombre, activo FROM cargos_empresa ORDER BY nombre;` →
```
 cargo_id | empresa_id |         nombre          | activo
----------+------------+-------------------------+--------
       43 |         14 | Administrador           | t
       52 |         14 | Artes y Manualidades    | t
       44 |         14 | Auxiliar de Enfermería  | t
       51 |         14 | Educador Físico         | t
       49 |         14 | Fisioterapeuta          | t
       45 |         14 | Gerontólogo/Gerontóloga | t
       50 |         14 | Psicólogo               | t
       46 |         14 | Servicios Generales     | t
       47 |         14 | Temporal                | t
       48 |         14 | Terapeuta Ocupacional   | t
(10 rows)
```
Exactly 10 rows; matches the target list. Old `cargo_id=42 'Auxiliar QA'` gone.

`SELECT c.contrato_id, ce.nombre FROM contratos c JOIN cargos_empresa ce ...` →
24 rows, every `nombre=Temporal`. Reassignment worked.

`SELECT enum_range(NULL::"MedioPagoNomina");` →
`{NEQUI,TRANSFERENCIA_BANCARIA,EFECTIVO}` (3 values, EFECTIVO added).

`SELECT COUNT(*) FROM contratos WHERE valor_mensual IS NOT NULL;` → `0` (all NULL
initially, per the "nullable" contract — backfill deferred).

`SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale
FROM information_schema.columns WHERE table_name='contratos' AND column_name='valor_mensual';` →
```
 valor_mensual | numeric | YES | 12 | 2
```

`npx prisma migrate status` → `Database schema is up to date!`

### All 6 acceptance criteria proven

1. ✓ `enum MedioPagoNomina` includes EFECTIVO; `prisma generate` reflects it.
2. ✓ `model Contrato` has nullable `valorMensual`; existing rows unaffected (0 non-null).
3. ✓ `cargos_empresa` after migration = exactly the 10 target cargos for the empresa;
   guard clause present and correct in the migration SQL.
4. ✓ `DEFAULT_CARGOS` in `empresaService.ts` == target list (10 items, in expected order).
5. ✓ Migration applies clean on local DB; `npx prisma migrate status` clean.
6. ✓ Contract doc published: `orchestration-ctx/decisions/contract-schema-qa-jul-24.md`.

## Subtask 4 — Contract doc published ✅ Done

Path: `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`.
Covers all 8 sections required by the assignment: enums, payment fields, Nequi regex,
contrato salary rule, asistencia RBAC + TZ handling + nota field, target cargo list,
employee update behavior, cross-cutting acceptance, out-of-scope. W2/W3 should read
this BEFORE opening schema.prisma.


