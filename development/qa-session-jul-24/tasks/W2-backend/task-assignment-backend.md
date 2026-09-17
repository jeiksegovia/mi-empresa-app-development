# task-assignment-backend

## Your Role
You are **pt-backend-eng** — backend engineer. You implement route/service/middleware logic and
backend tests against the shared contract. You do NOT open schema.prisma; the contract doc is
your authoritative interface.

## Project Context
Task slug: qa-session-jul-24. You are Worker 2 of 3 (backend/**). Fresh session.
Local backend :3101, db :15432. NEVER touch port 4142 / prod. Use the project's existing
start/test scripts (`backend/package.json`) — do NOT spawn a generic `node --import tsx` backend.
Route→service pattern; Zod `validate()` middleware; errors = `Object.assign(new Error(msg), { status, field })`.

## Plan File
`development/qa-session-jul-24/orchestration-ctx/team-plan-qa-session-jul-24.md`

## AUTHORITATIVE CONTRACT (read FIRST, never open schema.prisma)
`development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`

## Task Type
IMPLEMENTATION — you own task IDs `2`, `3`, `4` (do them in this order; 3 blockedBy 2, 4 blockedBy 3).

## Your Tasks
### Task 2 — Employee partial-edit fix + CONTRATOS RBAC + Nequi validation (Items 1,2)
- Fix the bug where editing ONLY the payment fields (`medioPagoTipo`, `medioPagoNequi`,
  `bancoNombre`, `bancoTipoCuenta`, `bancoNumeroCuenta`) raises a backend error. Support partial
  update (patch only those fields without requiring the whole employee payload).
- Allow BOTH `ADMIN` and `CONTRATOS` to edit these fields. Check
  `backend/src/middleware/domainAccess.ts` (DOMAIN_ACCESS matrix) + the empleado update route/service.
- Nequi `medioPagoNequi` = the "llave": accept alphanumeric OR email (use the exact regex from the
  contract). Not numeric-only. EFECTIVO → no extra fields required (nequi/banco may be null).
- Locate the employee update route: check `backend/src/routes/patients.routes.ts` /
  `empleados` routes and `patientService.ts` / employee service (grep for medioPago).

### Task 3 — Asistencia RBAC by role/date + note (Item 6)
- `PUT /asistencia/dia` (`backend/src/routes/asistencia.routes.ts` + `asistenciaService.ts`):
  CONTRATOS may save ONLY for today (server-local America/Bogota per contract); fecha != today → 403
  (`{status:403, field:'fecha'}`). ADMIN → any date OK. Compute "today" exactly as the contract states.
- Ensure a justification note field persists on the attendance record (add if missing — the
  contract names the field). Used for non-attendance / double-pay reason.

### Task 4 — Contract valorMensual validation + nómina branch (Item 7)
- Contract create/edit: require `valorJornada` for OPS; require `valorMensual` for OBRA_O_LABOR/
  TERMINO_FIJO/TERMINO_INDEFINIDO (Zod + service). Per contract rule.
- `nominaService.ts`: branch on `tipoContrato` — OPS computes from jornadas (existing path);
  the other 3 compute from the monthly value. Existing non-OPS contracts with null valorMensual →
  handle gracefully (no crash; treat as 0 or skip with a clear path — document your choice).

## Source Files to Modify (grep to confirm exact paths first)
- Employee update route + service (payment fields) — `backend/src/routes/*.routes.ts`, `backend/src/services/*Service.ts`.
- `backend/src/middleware/domainAccess.ts` — CONTRATOS access for payment/employee edit.
- `backend/src/routes/asistencia.routes.ts`, `backend/src/services/asistenciaService.ts`.
- `backend/src/services/nominaService.ts`, contract create/edit route+service.
- `backend/tests/**` — new smoke specs per task.

## FIRST ACTION
0. `pwd`; if NOT project root → `BLOCKED: spawned with cwd=...` and STOP.
1. Fresh session — skip compact. Read this file, then the contract doc, then grep the routes/services.

## Worker Self-Check
- IMPLEMENTATION + Source Files present → proceed.
- If the contract doc is missing/empty → `BLOCKED: contract doc not found`.

## Pre-loaded traps
- Do NOT open `schema.prisma` — use the contract. Another worker (W1) already migrated; if a
  transient prisma-client mismatch appears, run the project's `prisma generate` ONCE, else classify.
- Date logic: use deterministic date math in tests; document the TZ assumption from the contract.
- Fix fixtures, never loosen assertions. Real bugs → gap report. Classify every failing test
  (BUG / TEST-ENV / FLAKE).
- Do NOT spawn a generic backend on :4142. If you need a running server for a spec, use a unique
  PORT and unique log path, or the project's test harness.

## Acceptance Criteria (verifiable)
1. PATCH/PUT employee changing ONLY payment fields → 200 for ADMIN and for CONTRATOS (curl each).
2. Nequi accepts `3001234567`, `mi.llave@correo.com`, `LlaveABC123`; EFECTIVO saves with null bank/nequi.
3. CONTRATOS `PUT /asistencia/dia` fecha != today → 403; fecha == today → 200; ADMIN any date → 200.
4. Attendance note persists (round-trip GET shows it).
5. Create TERMINO_FIJO without valorMensual → 400; with valorMensual → 200; OPS still requires valorJornada.
6. Nómina for a TERMINO_FIJO employee computes from monthly value; OPS from jornadas.
7. Each task ships ≥1 backend smoke spec in `backend/tests/**` following existing patterns; report before/after counts.

## Deliverables
1. `development/qa-session-jul-24/tasks/W2-backend/completion-report.md` — required (verbatim curl/test outputs per criterion).
2. Modified backend source files + new specs under `backend/tests/**`.

## Progress Reporting
`development/qa-session-jul-24/tasks/W2-backend/progress-report.md`

## Boundaries
- Work ONLY within `backend/src/**`, `backend/tests/**`. Do NOT touch `backend/prisma/schema.prisma`
  (W1) or `frontend/**` (W3) or `empresaService.ts` (W1).
- Another worker migrated in parallel earlier — retry transient prisma failures ONCE, then classify.

## Reporting Protocol
1. Start each task: `TaskUpdate(taskId, "in_progress")`. Do 2 → 3 → 4 in order (auto-unblocked).
2. Progress sections in progress-report.md. MAX 2 self-repair attempts per error → TURNING-POINT-STRATEGY.
3. On ALL tasks done: completion-report.md, `TaskUpdate` each to completed, then
   `SendMessage(to: "main", message: "COMPLETE: W2 backend (tasks 2,3,4) done. See tasks/W2-backend/completion-report.md", summary: "W2 complete")`.
4. BLOCKED template for missing input; WAIT, do not spin. After final COMPLETE, ignore task-echo wakes.
