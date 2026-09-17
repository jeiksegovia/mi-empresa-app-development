# W1 Completion Report — Schema + cargos migration + contract doc

**Worker:** pt-data-schema (worker-1)
**Task ID:** 1
**Status:** COMPLETE
**Date:** 2026-07-31

## Deliverables

1. ✅ `backend/prisma/schema.prisma` — added `EFECTIVO` to `MedioPagoNomina`; added
   nullable `valorMensual` to `Contrato`.
2. ✅ `backend/src/services/empresaService.ts` — replaced 7-item `DEFAULT_CARGOS` with
   the 10-item target list (lockstep with the new migration).
3. ✅ `backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql`
   — applied clean on local `:15432`.
4. ✅ `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`
   — authoritative contract for W2 and W3.
5. ✅ `development/qa-session-jul-24/orchestration-ctx/decisions/cargos-fk-reassignment.md`
   — referenced; written by team-lead during NEW-APPROACH.

## Acceptance criteria (every claim proven by verbatim command + output)

### AC1: `enum MedioPagoNomina` includes EFECTIVO
```sql
SELECT enum_range(NULL::"MedioPagoNomina");
-- → {NEQUI,TRANSFERENCIA_BANCARIA,EFECTIVO}
```
Schema source: `backend/prisma/schema.prisma:1078-1082`:
```prisma
enum MedioPagoNomina {
  NEQUI
  TRANSFERENCIA_BANCARIA
  // qa-session-jul-24 R1: cash payment option (no extra fields required)
  EFECTIVO
}
```
`npx prisma generate` succeeded.

### AC2: `model Contrato` has nullable `valorMensual`; existing rows unaffected
```sql
SELECT COUNT(*) FROM contratos WHERE valor_mensual IS NOT NULL;
-- → 0
SELECT column_name, data_type, is_nullable, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name='contratos' AND column_name='valor_mensual';
-- → valor_mensual | numeric | YES | 12 | 2
```
Schema source: `backend/prisma/schema.prisma:377`:
```prisma
// qa-session-jul-24 R7: monthly salary; required for non-OPS contract types at API layer
valorMensual  Decimal?   @map("valor_mensual") @db.Decimal(12, 2)
```

### AC3: `cargos_empresa` after migration = exactly 10 target cargos; guard clause present
```sql
SELECT cargo_id, empresa_id, nombre, activo FROM cargos_empresa ORDER BY nombre;
-- → 10 rows, exactly:
--    Administrador, Artes y Manualidades, Auxiliar de Enfermería, Educador Físico,
--    Fisioterapeuta, Gerontólogo/Gerontóloga, Psicólogo, Servicios Generales,
--    Temporal, Terapeuta Ocupacional
--    all empresa_id=14, all activo=t
```
Guard clause present in the migration SQL
(`backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql`
step 3: `RAISE EXCEPTION 'cargos delete+recreate guard: contrato(s) still reference non-target cargo: %'`).

### AC4: `DEFAULT_CARGOS` == target list
File: `backend/src/services/empresaService.ts:35-49`:
```ts
export const DEFAULT_CARGOS = [
  'Administrador',
  'Auxiliar de Enfermería',
  'Gerontólogo/Gerontóloga',
  'Servicios Generales',
  'Temporal',
  'Terapeuta Ocupacional',
  'Fisioterapeuta',
  'Psicólogo',
  'Educador Físico',
  'Artes y Manualidades',
] as const
```
10 items, exactly matching the migration seed and the contract doc §6.

### AC5: Migration applies clean; `migrate status` clean
```bash
$ npx prisma migrate dev
# → Applying migration `20260731203612_qa_jul24_cargos_efectivo_valormensual`
# → Your database is now in sync with your schema.
# → ✔ Generated Prisma Client (v6.19.2)

$ npx prisma migrate status
# → 24 migrations found in prisma/migrations
# → Database schema is up to date!
```

### AC6: Contract doc published
Path: `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`.
Sections present:
- §1 Enums (MedioPagoNomina, TipoContrato, TipoCuentaBanco)
- §2 Empleado payment fields (5 columns + per-medio required matrix)
- §3 Nequi llave regex: `/^(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{6,25})$/`
- §4 Contrato salary rule by tipoContrato
- §5 Asistencia RBAC (CONTRATOS today-only America/Bogota, ADMIN any date) + nota field
- §5.1 Exact "today" computation (Intl.DateTimeFormat en-CA + SQL fallback)
- §6 Target cargo list (10 strings)
- §7 Employee update (partial-update + merged-state validation)
- §8 Cross-cutting acceptance
- §9 Out of scope

## Deviation log (for the record)

### D1 (logged during execution)
- **What:** Local `cargos_empresa` state was `cargo_id=42 'Auxiliar QA' (empresa_id=14)`
  with 24 contratos referencing it; the 7 cargos seeded by `20260710024928_jul9_cargo_empresa`
  were absent. Assignment's premise "On local this should pass clean; the guard protects
  staging" did not hold.
- **Resolution:** `TURNING-POINT-BREAKING` to team-lead → `NEW-APPROACH` =
  reassign-ALL-to-fallback `Temporal`, then DELETE. Decision captured in
  `orchestration-ctx/decisions/cargos-fk-reassignment.md`. Implemented exactly as
  specified; verified with SELECTs.

### D2 (pre-flight fix, non-destructive)
- **What:** `prisma migrate dev` refused with
  "The migration `20260717045038_instrumentos_dynamic_fichas` was modified after it was
  applied." Investigation: a stale `rolled_back_at IS NOT NULL` row existed in
  `_prisma_migrations` for that name (a previous failed attempt); the on-disk file
  matched the successful `applied_steps_count=1` row's checksum.
- **Resolution:** `DELETE FROM _prisma_migrations WHERE migration_name='20260717045038_instrumentos_dynamic_fichas' AND finished_at IS NULL AND rolled_back_at IS NOT NULL;`
  (1 row deleted, no schema change, no data loss). Prisma then proceeded normally.

## Files changed/created

- **modified:** `backend/prisma/schema.prisma` (enum + column)
- **modified:** `backend/src/services/empresaService.ts` (`DEFAULT_CARGOS`)
- **created:** `backend/prisma/migrations/20260731203612_qa_jul24_cargos_efectivo_valormensual/migration.sql`
- **created:** `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`
- **created (write-up):** `development/qa-session-jul-24/tasks/W1-schema-contract/progress-report.md`
- **created (this file):** `development/qa-session-jul-24/tasks/W1-schema-contract/completion-report.md`
- **metadata:** `_prisma_migrations` table updated (1 row, applied=t)
- **metadata:** 1 stale rolled-back row removed from `_prisma_migrations` (D2 fix)

## Handoff to W2 / W3

- Read `orchestration-ctx/decisions/contract-schema-qa-jul-24.md` first.
- Do **not** read `backend/prisma/schema.prisma` for behavior — use the contract. The
  schema is the type-source for codegen only.
- W2 owns: backend routes/services/tests for employee update, Nequi validation, asistencia
  RBAC + note, contract valorMensual validation, nómina branch. Backend tests go in
  `backend/tests/qa-jul-24/`.
- W3 owns: frontend UI for payment (efectivo option, Nequi llave label + validation),
  remove Cargos block from Información Laboral tab, payment-method preview in profile,
  contract form monthly field, asistencia UI date-lock + nota field. Frontend tests go
  in `frontend/tests/qa-jul-24/`.

## Status
- W1 work fully complete on local DB.
- Wave 2 (W2 + W3) is unblocked: both have `blockedBy: 1` and task 1 is now done.
- Staging deploy remains a gated later step.
