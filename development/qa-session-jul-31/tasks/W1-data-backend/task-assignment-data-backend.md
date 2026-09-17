# task-assignment-data-backend

## Your Role
You are **worker-1 · pt-fullstack-impl** — you own the shared interface (contract) plus the data + backend layers for the qa-session-jul-31 cycle. You author the authoritative contract first, then implement schema, backend service/route changes, and backend tests. You do NOT touch frontend.

## Project Context
Task slug: `qa-session-jul-31`
Working directory (project root): `/Users/jeik/ws/mi-empresa-app-development`
You are Worker 1 of 2. Worker-2 (frontend) implements against the contract YOU publish in T1 — publish it early and correctly.

## Plan File
`development/qa-session-jul-31/orchestration-ctx/team-plan-qa-session-jul-31.md` (read for background; do not edit it)

## Task Type
IMPLEMENTATION

## Your Tasks (TaskList IDs — do them in order, respecting blockedBy)
- **T1 (id 1)** — Author `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md`. **After writing it, send `CHECKPOINT: contract published` so the orchestrator can spawn worker-2.** Then continue.
- **T2 (id 2, blockedBy 1)** — Schema columns + migration.
- **T3 (id 3, blockedBy 2)** — Backend R3 persistence.
- **T4 (id 4, blockedBy 1)** — Backend R2b nómina suggestion.
- **T5 (id 5, blockedBy 3,4)** — Backend Playwright tests.

## FIRST ACTION
0. **Cwd check**: run `pwd`. If NOT `/Users/jeik/ws/mi-empresa-app-development` → `SendMessage(to: "main", message: "BLOCKED: spawned with cwd=<pwd>, not project root — respawn me")` and STOP.
1. Fresh session → skip `/compact`. Read this file fully; it is your authoritative context.
2. Call `TaskUpdate(taskId: "1", status: "in_progress")`.

## Requirements (with origin)
- **R1** (transcript "nequi slash llave"; dev clarification "Cambiar el nombre de nequi por nequi/bre-b"): label `Nequi` → `Nequi/Bre-B`. **Display-only — enum value stays `NEQUI`.** No backend change; you only DOCUMENT this in the contract for worker-2.
- **R2/R2b** (transcript: nómina interface must change by contract type): nómina Registrar dialog uses **Valor Mensual** for `TERMINO_FIJO`/`TERMINO_INDEFINIDO`/`OBRA_O_LABOR`; OPS keeps `medias × valor jornada`. Aportes sociales apply to FIJO/INDEF only. Your backend job (R2b): ensure the GET /nomina row suggestion surfaces a valorMensual-derived base for non-OPS so the FE prefills without jornada.
- **R3** (dev clarification "agregar EPS, fondo de pensiones y ARL ... opcionales"): add optional `eps`, `fondoPensiones`, `arl` to Empleado.

## Locked decisions (do NOT re-litigate)
- D1: OBRA_O_LABOR → Valor Mensual in nómina, **no aportes**.
- D2: EPS/Fondo/ARL = free-text VARCHAR(100), optional, no catalog.
- D3: R1 display-only; enum `NEQUI` unchanged.
- D4: no new routes/services/tables; additive nullable migration.

## Key Files to Read First
- `development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md` — **template** for your contract; match its structure/tone.
- `backend/prisma/schema.prisma:77-131` — `Empleado` model (payment fields at :99-103 are the pattern for R3); `:375-377` Contrato valorJornada/valorMensual; `:935-939` TipoContrato enum.
- `backend/src/services/employeeService.ts` — create/update field passthrough (see medioPagoTipo/bancoNombre threading).
- `backend/src/routes/employees.routes.ts` — Zod create/update schemas.
- `backend/src/services/nominaService.ts` — `resolveCalcFields` (~:46 APORTES_ALLOWED; OPS vs others branch); already added in jul-24 R7.
- `backend/src/routes/nomina.routes.ts` — GET /nomina row assembly; find where `sugerencia`/`entrada`/`subtotalCalculado` is built (may be in nominaService).

## Source Files to Modify
- `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md` (T1, create)
- `backend/prisma/schema.prisma` (T2)
- `backend/prisma/migrations/<new>/migration.sql` (T2, via `prisma migrate dev`)
- `backend/src/services/employeeService.ts` (T3)
- `backend/src/routes/employees.routes.ts` (T3)
- `backend/src/routes/nomina.routes.ts` and/or `backend/src/services/nominaService.ts` (T4 — only if suggestion doesn't already surface valorMensual)
- `backend/tests/employees/*.spec.ts`, `backend/tests/nomina/*.spec.ts` (T5, create new specs)

## Contract content required (T1)
The contract must specify, unambiguously for worker-2:
1. **R1 label map**: every UI surface (empleados/nuevo, empleados/[id]/index, empleados/[id]/editar, nomina/index) shows `Nequi/Bre-B`; option `value` stays `"NEQUI"`.
2. **R2 nómina interface matrix** by `tipoContrato`:
   | tipoContrato | base shown | jornada inputs | aportes |
   |---|---|---|---|
   | OPS | medias × valor jornada | shown | no |
   | OBRA_O_LABOR | valorMensual | hidden | no |
   | TERMINO_FIJO | valorMensual | hidden | yes |
   | TERMINO_INDEFINIDO | valorMensual | hidden | yes |
   Total a pagar = base (+ aportes where allowed), manually adjustable.
3. **R2b**: exact field the FE reads for the valorMensual base (name it — e.g. `contratoActivo.valorMensual` and/or `sugerencia.subtotalCalculado`); state the GET /nomina response shape for it.
4. **R3 fields**: DB columns `eps`/`fondo_pensiones`/`arl` VARCHAR(100) nullable; API camelCase `eps`/`fondoPensiones`/`arl`; optional in create/update; returned in detail. Which employee-form step they belong to (Datos personales).

## Acceptance Criteria
1. Contract file exists and covers items 1–4 above; worker-2 can implement without reading schema.prisma.
2. `npx prisma migrate status` clean against local `:15432`; 3 new nullable columns exist on `empleados`; prisma client regenerated.
3. Employee create AND update accept/persist/return `eps`,`fondoPensiones`,`arl`; omitting them does not error (optional).
4. GET /nomina suggestion returns a valorMensual base for a non-OPS contract (verbatim curl/response in completion report).
5. Backend specs pass locally; every failure classified BUG/TEST-ENV/FLAKE (pre-existing port-3001 failures are TEST-ENV per jul-24).

## Backend run/test notes (pre-loaded traps)
- **Do NOT** use `node --import tsx src/start.ts`/`server.ts` or blanket `pkill node/tsx` — prod bun may sit on :4142. Local backend is :3101; use the project's existing dev script; target specific PID via `lsof -i :3101` if a restart is needed.
- **Never** run `prisma migrate diff --shadow-database-url`. Use `prisma migrate dev --name add_empleado_eps_fondo_arl` for the additive migration against local :15432.
- DB local docker :15432. Migrations are gitignored — that's expected.

## Deliverables
1. `development/qa-session-jul-31/tasks/W1-data-backend/completion-report.md` (required)
2. Contract doc, schema+migration, backend edits, new backend specs (paths above)

## Progress Reporting
Append subtask sections to `development/qa-session-jul-31/tasks/W1-data-backend/progress-report.md`.

## Boundaries
- Work ONLY in: `backend/**`, `backend/prisma/**`, and your task dir + the contract file.
- Do NOT modify `frontend/**` (worker-2 owns it) or the team-plan.
- Do NOT create files outside `development/**`, `backend/**`, `scripts/**`.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId, status:"in_progress")`.
2. **After T1 contract written**: `SendMessage(to:"main", message:"CHECKPOINT: T1 contract published at decisions/contract-schema-qa-jul-31.md", summary:"Contract published")`, then continue to T2/T4 autonomously.
3. Per subtask: append `## Subtask N: {name} — ✅ Done` to progress-report.md. Proceed to next unblocked task in the same turn; do not idle for acknowledgment.
4. On error: MAX 2 self-repair attempts, then append `## Strategy Request` and `SendMessage(to:"main", message:"TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary:"Strategy escalation")` and WAIT.
5. On completion of ALL your tasks: write completion-report.md, `TaskUpdate` each to completed, then `SendMessage(to:"main", message:"COMPLETE: W1 data+backend done. Deliverables: {list}. See tasks/W1-data-backend/completion-report.md", summary:"W1 complete")`.
6. Breaking change (affects worker-2's contract): STOP, `SendMessage(to:"main", "TURNING-POINT-BREAKING: ...")`, WAIT.
7. Idle discipline: never end a turn without having sent COMPLETE / BLOCKED / WAITING / CHECKPOINT / TURNING-POINT. Never use TaskCreate. After final COMPLETE, ignore task-echo wakes silently.

## Completion Report Format
Use the standard format: Deliverables table, Key Decisions, Issues Encountered (one-line), Known Issues NOT Fixed (with repro), Integration Notes (what worker-2/orchestrator must know), Deferred Items. Include verbatim curl/test output for acceptance criteria 2–5.
