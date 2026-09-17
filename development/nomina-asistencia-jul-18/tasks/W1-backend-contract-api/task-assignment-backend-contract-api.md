# task-assignment-backend-contract-api

## Your Role
You are **backend-eng** — Backend systems implementer focused on APIs, services, and data processing.
You are a backend engineer. Prioritize: API design consistency (REST), input validation (Zod), proper error handling with meaningful messages, efficient Prisma queries, and structured logging. Clean separation: routes → services → Prisma. Expose integration-ready interfaces. Own the **living schema contract document**.

## Project Context
Task slug: `nomina-asistencia-jul-18`
Working directory: project root `/Users/jeik/ws/mi-empresa-app-development` (NOT a subdirectory)
You are Worker 1 of 3. Wave 1 only — backend contract + schema + API + smoke tests.

## Plan File
`development/nomina-asistencia-jul-18/orchestration-ctx/team-plan-nomina-asistencia-jul-18.md`

Also read:
- `development/nomina-asistencia-jul-18/nomina-asistencia-jul-18-plan.md`
- `development/nomina-asistencia-jul-18/01-requirements-nomina-asistencia-jul-18.md` (R1–R25 backend subset)

## Task Type
IMPLEMENTATION

## Your Task
Implement the full backend for nomina-asistencia-jul-18:
1. Prisma schema + migration
2. Living contract document (authoritative for W2/W3)
3. Domain `asistencia` in domainAccess
4. Empleado medio de pago + pendiente sync
5. Contrato valorJornada (required on create)
6. Asistencia API (day board, batch PUT, month resumen)
7. Nómina month enrichment + period calc fields
8. Smoke API Playwright specs

## Implementation Location
- Source: `backend/`
- Contract: `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`
- Reports: `development/nomina-asistencia-jul-18/tasks/W1-backend-contract-api/`

## Source Files to Modify
- `backend/prisma/schema.prisma` — enums + fields + AsistenciaEmpleado
- `backend/prisma/migrations/20260718100000_nomina_asistencia/` (or next free timestamp) — SQL migration
- `backend/src/middleware/domainAccess.ts` — Domain `asistencia` matrix
- `backend/src/services/employeeService.ts` — medio pago + pendiente sync
- `backend/src/routes/employees.routes.ts` — Zod for medio fields
- `backend/src/services/nominaService.ts` — valorJornada contratos + nomina calc/enrichment
- `backend/src/routes/nomina.routes.ts` — Zod extensions
- `backend/src/services/asistenciaService.ts` — **NEW**
- `backend/src/routes/asistencia.routes.ts` — **NEW**
- `backend/src/routes/index.ts` — mount `/asistencia`
- `backend/tests/employees/medio-pago.spec.ts` — **NEW** smoke
- `backend/tests/employees/contrato-valor-jornada.spec.ts` — **NEW** or extend contrato-cargo
- `backend/tests/asistencia/asistencia-dia.spec.ts` — **NEW**
- `backend/tests/nomina/nomina-calc-asistencia.spec.ts` — **NEW**
- `development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md` — **NEW** living contract

## FIRST ACTION (before anything else)
0. **Cwd check**: run `pwd`. If NOT project root (contains `.claude/settings.json`), send `BLOCKED: spawned with cwd=...` and STOP.
1. Self-reflect on role/domain.
2. Compact only if unrelated prior context.
3. Read this assignment + team-plan + feature plan excerpts.
4. `TaskUpdate` task **1** → `in_progress`.

## Your TaskList IDs (use exactly)
| Task ID | Title | blockedBy |
|---------|-------|-----------|
| **1** | Schema migration + contract doc | — |
| **2** | Empleado medio pago + pendiente | 1 |
| **3** | Contrato valorJornada API | 1 |
| **4** | Asistencia service + routes | 1 |
| **5** | Nómina enrichment + calc | 1, 4 |
| **6** | Backend smoke API specs | 2, 3, 5 |

Proceed autonomously through 1→6 as each unblocks. Mark each completed before starting next.

## Worker Self-Check
- IMPLEMENTATION with non-empty Source Files list → OK
- Do NOT re-create team-plan
- Do NOT touch `frontend/**`

## Acceptance Criteria
1. Migration applied locally (`npx prisma migrate deploy` or project’s usual migrate) without shadow DB flag.
2. Contract doc lists exact field names, enums, request/response JSON shapes, error shapes, pendiente constant, calc algorithm, deviations table (can start with placeholders filled as you implement).
3. POST employee without medio → 201 + open pendiente `Falta medio de pago de nómina`.
4. POST employee Nequi without number → 400; transfer missing bank fields → 400.
5. Completing medio resolves matching open pendiente.
6. POST contrato without valorJornada → 400 field valorJornada; with valor → 201.
7. PUT `/asistencia/dia` upserts AM/PM; GET `?fecha=` returns active employees + flags; GET resumen sums medias for month.
8. GET `/nomina?periodo=` includes medio, asistenciaMes.mediasJornadas, contrato valorJornada.
9. POST periodos: default total = medias×valor + aportes; aportes >0 on OPS → 400; FIJO allows aportes; dual-write salario=totalPagado.
10. Smoke specs green against local API (or documented skip if API down — try start with project `npm run dev` only if needed on PORT 3101; never kill prod on 4142).
11. No frontend file modifications.

## Deliverables
1. `development/nomina-asistencia-jul-18/tasks/W1-backend-contract-api/completion-report.md`
2. All source files listed above
3. Contract decision markdown
4. Smoke specs under `backend/tests/**`

## Progress Reporting
`development/nomina-asistencia-jul-18/tasks/W1-backend-contract-api/progress-report.md`

## Key Files to Read First
- team-plan (interface contracts section)
- `backend/prisma/schema.prisma` Empleado/Contrato/NominaPeriodo
- `backend/src/services/employeeService.ts` createEmployee + pendientes
- `backend/src/services/nominaService.ts` createContrato + createNominaPeriodo + getNominaMonth
- `backend/src/middleware/domainAccess.ts`
- `backend/src/routes/index.ts`
- `backend/tests/nomina/cuenta-cobro-required.spec.ts` — test pattern

## Interface Contracts (must freeze in decision doc)

### Empleado medio
```
medioPagoTipo: 'NEQUI' | 'TRANSFERENCIA_BANCARIA' | null
medioPagoNequi?: string
bancoNombre?: string
bancoTipoCuenta?: 'AHORRO' | 'CORRIENTE'
bancoNumeroCuenta?: string
PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina'
```

### Contrato
```
valorJornada: number  // required on CREATE
```

### Asistencia
```
// GET ?fecha= → { success, data: [{ empleado: {id,nombre,apellido,...}, jornadaAm, jornadaPm, notas, id? }] }
// PUT /dia → { fecha: 'YYYY-MM-DD', items: [{ empleadoId, jornadaAm, jornadaPm, notas? }] }
// GET /resumen?periodo=YYYY-MM → { data: [{ empleadoId, mediasJornadas, horas }] }
// medias = (am?1:0)+(pm?1:0); horas = medias*4
```

### NominaPeriodo extra
```
mediasJornadas?, valorJornada?, subtotalCalculado?, aportesSociales?, totalPagado?
// salario dual-write = totalPagado when total set
// aportes only TERMINO_FIJO | TERMINO_INDEFINIDO
```

### Domain
```
Domain += 'asistencia'
GERONTOLOGA.asistencia = false
CONTRATOS.asistencia = true
```

## Boundaries
- Work ONLY backend + development/{slug}/ tasks + decisions
- Do NOT modify frontend/**
- Do NOT modify files other workers will own later beyond domainAccess (you own domainAccess BE; FE mirror is W2)
- Do NOT use `migrate diff --shadow-database-url`
- Do NOT pkill node/tsx generically
- Do NOT commit git
- Prefer `npm` (project already uses it in backend)

## Plan Approval Required
For the migration SQL (data-touching): if any backfill is non-trivial, write `proposed-plan.md` in your task dir, message `PLAN-APPROVAL:`, and WAIT. Pure additive nullable columns + new table = proceed without gate after documenting in progress-report.

## Completion Report Format
Write `completion-report.md` with Deliverables table, Key Decisions, Issues, Known Issues NOT Fixed (with repro), Integration Notes for W2 (contract path + any FE-critical response shapes), Deferred Items.

## Turning Point Rules
Non-breaking: document in progress-report.
Breaking: `TURNING-POINT-BREAKING:` to main and WAIT.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId: "1", status: "in_progress")`
2. During: append sections to progress-report.md; complete TaskUpdate per task id 1–6
3. Errors: max 2 self-fix attempts then TURNING-POINT-STRATEGY
4. On all 6 done: completion-report.md + `SendMessage(to: "main", message: "COMPLETE: W1-backend-contract-api done. Deliverables: contract + migration + APIs + smoke specs. See tasks/W1-backend-contract-api/completion-report.md", summary: "W1 complete")`
5. BLOCKED: message main with exact need
6. Never idle silently without COMPLETE/BLOCKED/WAITING/TURNING-POINT-*
7. Never TaskCreate; never message other workers

## Dependencies
None for task 1. Tasks 2–6 chain via TaskList blockedBy — harness unblocks automatically.

## Available Tools
file read/write, bash, google-search MCP, playwright MCP, TaskUpdate, TaskList, TaskGet, SendMessage
