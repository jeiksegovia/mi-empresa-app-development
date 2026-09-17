# task-assignment-contract-schema

## Your Role
You are **pt-data-schema** — data and schema worker for planify-team.
Prioritize: exact field names, additive migrations, Prisma conventions matching this repo, and a contract document other workers can implement **without opening schema.prisma**. Never invent a second name for the same concept.

## Project Context
Task slug: qa-session-aug-17
Working directory: /Users/jeik/ws/mi-empresa-app-development (PROJECT ROOT)
You are Worker 1 of 3. Task IDs: **1** (contract), **2** (schema), **3** (seed).

## Plan File
`development/qa-session-aug-17/orchestration-ctx/team-plan-qa-session-aug-17.md`

## Task Type
IMPLEMENTATION (docs + schema + seed — no HTTP routes)

## Your Task
1. **Task 1**: Write the SSOT contract.
2. **Task 2** (after 1): Additive Prisma schema + migration.
3. **Task 3** (after 2): Local seed users for R6 tests.

Read `01-requirements-qa-session-aug-17.md` and `qa-session-aug-17-plan.md` then write the contract **before** touching Prisma.

## Implementation Location
- Contract: `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`
- Schema: `backend/prisma/schema.prisma`
- Migration: `backend/prisma/migrations/<timestamp>_add_nomina_bonos_and_registro_actividades/`
- Seed: `backend/prisma/seed.ts` (extend user/empleado section; do not revive deleted finance seed)

## Source Files to Modify
- `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md` — CREATE
- `backend/prisma/schema.prisma` — NominaPeriodo.bonos; new RegistroActividad; Usuario + Empleado relations
- `backend/prisma/migrations/.../` — CREATE additive SQL + migration.toml
- `backend/prisma/seed.ts` — profesor + auxiliar users + linked Empleado

## FIRST ACTION (before anything else)
0. **Cwd check**: run `pwd`. If it is NOT `/Users/jeik/ws/mi-empresa-app-development`, send `SendMessage(to: "team-lead", message: "BLOCKED: spawned with cwd={pwd}")` and STOP.
1. Self-reflect: data-schema only; no routes/vue.
2. Fresh session → skip compact.
3. Read this assignment fully, then the plan + requirements.

## Worker Self-Check
- IMPLEMENTATION + non-empty Source Files → proceed
- Do NOT recreate team-plan

## Acceptance Criteria
1. Contract lists exact Prisma field names (camelCase + @map), API JSON names, error `code`s, BONOS_ALLOWED = TERMINO_FIJO | TERMINO_INDEFINIDO, formulas:
   - FIJO/INDEF: `subtotalCalculado = valorMensual + bonos`; `totalPagado = valorMensual + bonos` (aportes stored, **not** added)
   - OBRA: no bonos; total = valorMensual
   - OPS: unchanged (medias * valorJornada; do not change OPS total formula this cycle)
2. Domain `actividades` cells: PROFESORES/AUXILIARES = `create-only`; GERONTOLOGA/CONTRATOS = `read-only`. ADMIN bypass. Own-item + today-only documented as **service rules**, not matrix values.
3. CONTRATOS.empresa stays `false`; GET `/empresa/cargos` is a **route exception** documented separately.
4. POST/PUT `/nomina/periodos`: `requireEmployeeUnlocked` on body `empleadoId`; not `requireRole('ADMIN')`.
5. `RegistroActividad`: id, empleadoId, fecha Date, texto Text, registradoPor, timestamps; `@@unique([empleadoId, fecha])`; @@map `registro_actividades`.
6. API:
   - GET `/actividades?fecha=&empleadoId=`
   - POST `{ fecha, texto, empleadoId? }` — non-admin cannot set another empleadoId
   - PUT/DELETE `/:id` ADMIN only
   - 400 `EMPLEADO_REQUIRED` if caller has no empleadoId
   - 403 today-only for PROFESORES/AUXILIARES when fecha !== America/Bogota today (`serverTodayBogota`)
   - 409 on unique violation
7. FE testids (so W3 does not invent): `empleados-tab-activos`, `empleados-tab-inactivos`, `nomina-bonos`, `nomina-subtotal`, `nomina-aportes`, `nomina-total`, `actividades-fecha`, `actividades-texto`, `actividades-guardar`.
8. Seed: `profesor@miempresa.com` / `auxiliar@miempresa.com` / `<redacted>`, rol EMPLEADO, tipoEmpleado set, **empleadoId** pointing at a real Empleado (minimal required fields).
9. Migration applied locally (`npx prisma migrate deploy` in `backend/`). Never `--shadow-database-url`.
10. After T1: `TaskUpdate` completed + `COMPLETE:` for T1 then continue T2→T3 in the same session.

## Deliverables
1. `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`
2. Schema + migration on disk
3. Seed users in `seed.ts`
4. `development/qa-session-aug-17/tasks/W1-data-schema/completion-report.md`

## Progress Reporting
`development/qa-session-aug-17/tasks/W1-data-schema/progress-report.md` after EACH step.

## Key Files to Read First
- `development/qa-session-aug-17/orchestration-ctx/team-plan-qa-session-aug-17.md`
- `development/qa-session-aug-17/01-requirements-qa-session-aug-17.md`
- `backend/prisma/schema.prisma` models Usuario, Empleado, NominaPeriodo, AsistenciaEmpleado (pattern only)
- `backend/prisma/seed.ts` user-create section
- Prior contract style: `development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`

## Interface Contracts
You **author** the contract. Locked product decisions are in requirements — do not reopen them.

## Boundaries
- Do NOT modify `backend/src/routes/**`, `backend/src/services/**`, `frontend/**`
- Do NOT git commit
- Do NOT touch centro-costos or instrument templates

## Plan Approval Required
Before applying the migration: write `development/qa-session-aug-17/tasks/W1-data-schema/proposed-plan.md` with: exact Prisma models, row-count risk (NominaPeriodo existing rows get bonos=null — safe), SQL gist. Send `PLAN-APPROVAL:` to team-lead and WAIT. After `PROCEED:` apply migrate.

T1 contract does **not** need that gate — publish it immediately.

## Completion Report Format
Write `completion-report.md` with Deliverables table, Key Decisions, Issues, Integration Notes (tell W2/W3 exact contract path).

## Turning Point Rules
Breaking → `SendMessage(to: "team-lead", message: "TURNING-POINT-BREAKING: ...")` and WAIT.
Non-breaking: document in progress-report.

## Dependencies
T1 none. T2 blocked by 1. T3 blocked by 2.
When T1 is done, mark it completed and continue T2 only after PLAN-APPROVAL for the migration.

## Available Tools
file read/write, bash, TaskUpdate, TaskList, TaskGet, SendMessage

**Team tools are native**. Address orchestrator as **`team-lead`**, never `main`.

> **DURABILITY**: write progress-report.md after EACH step. COMPLETE to team-lead.

## Reporting Protocol
1. Start: `TaskUpdate(taskId: "1", status: "in_progress")`
2. During: append `## Subtask N` to progress-report.md
3. Errors: max 2 fix attempts then TURNING-POINT-STRATEGY
4. After ALL of T1–T3: completion-report + TaskUpdate completed on each + `SendMessage(to: "team-lead", message: "COMPLETE: W1-data-schema done. Deliverables: contract, migration, seed. See tasks/W1-data-schema/completion-report.md")`
   Also send a CHECKPOINT after T1 alone: `SendMessage(to: "team-lead", message: "CHECKPOINT: T1 contract published at orchestration-ctx/decisions/contract-schema-qa-aug-17.md — W2/W3 may start")` so they can spawn without waiting for migrate.
5. BLOCKED / WAITING / TURNING-POINT as specified in worker-template
6. Never idle silently
7. Never TaskCreate
