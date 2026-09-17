# task-assignment-schema-contract

## Your Role
You are **pt-data-schema** — the data/schema owner. You define the shared interface (schema,
enums, migration, seed) that backend (W2) and frontend (W3) build against. You are the
contract-first wave-1 worker: your published contract doc is authoritative for the whole team.

## Project Context
Task slug: qa-session-jul-24
You are Worker 1 of 3 in a coordinated team. This is a fresh session (no prior context).
Local DB: `localhost:15432` (docker). Backend dir: `backend/`. Prisma at `backend/prisma/`.
NEVER touch port 4142 / prod. Use the project's existing scripts for prisma/migrate.

## Plan File
`development/qa-session-jul-24/orchestration-ctx/team-plan-qa-session-jul-24.md`

## Task Type
IMPLEMENTATION — your task ID is `1`.

## Your Task
Land the schema/enum/field changes + cargos catalog migration, then publish the authoritative
contract doc. Ordered scope (simplest first):

1. **Enum EFECTIVO** — add `EFECTIVO` to `enum MedioPagoNomina` (currently NEQUI,
   TRANSFERENCIA_BANCARIA) in `backend/prisma/schema.prisma` (~line 1078).
2. **Contract monthly value** — add `valorMensual Decimal? @map("valor_mensual") @db.Decimal(12, 2)`
   to `model Contrato` (near existing `valorJornada`, ~line 372). Nullable (existing rows keep null).
3. **DEFAULT_CARGOS** — update the list in `backend/src/services/empresaService.ts:35` to the
   target list (below). Keep it in lockstep with the migration seed (there is a comment saying so).
4. **Cargos migration** — write a new Prisma migration (`backend/prisma/migrations/<timestamp>_qa_jul24_cargos_efectivo_valormensual/migration.sql`)
   that: (a) adds the enum value + column (from steps 1–2 via `prisma migrate dev`), and
   (b) **delete+recreates** `cargos_empresa` to the target list. Decision D1 = delete+recreate.
   **GUARD**: before deleting, if any `contratos.cargo_id` references a cargo row that would be
   removed, RAISE a clear SQL exception (`RAISE EXCEPTION`) with the offending cargo name — do NOT
   silently drop (FK is `onDelete: Restrict`). On local this should pass clean; the guard protects staging.
5. **Run** the migration against local DB and confirm it applies + `prisma generate` succeeds.
6. **Publish contract doc** `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`.

### Target cargo list (exact strings)
Base: `Administrador`, `Auxiliar de Enfermería`, `Gerontólogo/Gerontóloga`, `Servicios Generales`,
`Temporal`. Profesional: `Terapeuta Ocupacional`, `Fisioterapeuta`, `Psicólogo`, `Educador Físico`,
`Artes y Manualidades`. (Removes: Cocinera if present, Otro. Renames handled by delete+recreate.)

## Source Files to Modify
- `backend/prisma/schema.prisma` — add EFECTIVO enum value; add Contrato.valorMensual.
- `backend/src/services/empresaService.ts` — update DEFAULT_CARGOS (line ~35).
- `backend/prisma/migrations/<new>/migration.sql` — enum + column + cargos delete+recreate (guarded).

## FIRST ACTION
0. Run `pwd`; if NOT `/Users/jeik/ws/mi-empresa-app-development` → `BLOCKED: spawned with cwd=...`.
1. Fresh session — skip compact. Read this assignment fully, then the two files above.

## Worker Self-Check
- Task Type IMPLEMENTATION and Source Files listed → proceed.
- Migration must be generated via prisma (not hand-written enum diff); verify against local DB.

## Pre-loaded traps
- **NEVER** run `prisma migrate diff --shadow-database-url` (wipes DB — global rule).
- Postgres cannot use a new enum value in the same transaction that adds it — if the migration
  needs the enum value, split ADD VALUE into its own step or use a separate statement.
- `cargos_empresa` unique = (empresa_id, nombre); FK `contratos.cargo_id` onDelete Restrict.
- Keep DEFAULT_CARGOS EXACTLY matching the migration seed strings (there is a lockstep comment).
- Use the project's existing migrate command (check `backend/package.json` scripts). Do not spawn
  a generic `node --import tsx` backend. Local db is on :15432.

## Acceptance Criteria
1. `enum MedioPagoNomina` includes EFECTIVO; `prisma generate` reflects it.
2. `model Contrato` has nullable `valorMensual`; existing rows unaffected (null).
3. `cargos_empresa` after migration = exactly the 10 target cargos for the empresa (verify with a
   SELECT); guard clause present and correct.
4. DEFAULT_CARGOS in empresaService.ts == target list.
5. Migration applies clean on local DB; `npx prisma migrate status` clean.
6. Contract doc published with all fields below.

## Contract doc — required contents
`development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`:
- **Enums**: `MedioPagoNomina` = NEQUI | TRANSFERENCIA_BANCARIA | EFECTIVO. `TipoContrato` = OPS |
  OBRA_O_LABOR | TERMINO_FIJO | TERMINO_INDEFINIDO.
- **Empleado payment fields**: `medioPagoTipo`, `medioPagoNequi` (VarChar 50 = the "llave"),
  `bancoNombre`, `bancoTipoCuenta` (AHORRO|CORRIENTE), `bancoNumeroCuenta`.
- **Nequi llave validation rule**: alphanumeric OR email (NOT numeric-only). State the exact regex
  W2/W3 should use. EFECTIVO → no extra fields required.
- **Contrato salary rule**: OPS → `valorJornada` required; OBRA_O_LABOR/TERMINO_FIJO/
  TERMINO_INDEFINIDO → `valorMensual` required. Both nullable in DB; validation is at API layer.
- **Asistencia RBAC**: CONTRATOS may PUT only fecha == today (server-local America/Bogota);
  ADMIN any date. Define how "today" is computed (exact TZ handling) so W2 matches.
- **Asistencia note**: field name for justification note on the attendance record.
- **Target cargo list** (the 10 strings above).
- **Employee update**: note that payment fields must support partial update by ADMIN + CONTRATOS.

## Deliverables
1. `development/qa-session-jul-24/tasks/W1-schema-contract/completion-report.md` — required.
2. Modified `schema.prisma`, `empresaService.ts`, new migration dir.
3. `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`.

## Progress Reporting
`development/qa-session-jul-24/tasks/W1-schema-contract/progress-report.md`

## Boundaries
- Work ONLY within `backend/prisma/**`, `backend/src/services/empresaService.ts`, and your task dir + decisions doc.
- Do NOT modify routes/other services (W2 owns those) or frontend (W3).
- Do NOT create files outside `development/**`, `backend/prisma/**`, `backend/src/services/empresaService.ts`.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId: "1", status: "in_progress")`.
2. During: append `## Subtask N — ✅ Done` sections to progress-report.md.
3. On error: MAX 2 self-repair attempts, then `SendMessage(to: "main", "TURNING-POINT-STRATEGY: ...")`.
4. On completion: write completion-report.md, `TaskUpdate(taskId: "1", status: "completed")`, then
   `SendMessage(to: "main", message: "COMPLETE: W1 schema+migration+contract done. Contract at orchestration-ctx/decisions/contract-schema-qa-jul-24.md", summary: "W1 complete")`.
5. Breaking change (e.g. FK guard trips on local, or enum/migration cannot apply) →
   `SendMessage(to: "main", "TURNING-POINT-BREAKING: ...")` and WAIT.
6. Never go idle silently. After final COMPLETE, ignore task-echo wakes.
