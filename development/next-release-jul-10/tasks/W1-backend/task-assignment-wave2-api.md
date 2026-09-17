# task-assignment-wave2-api (W1, wave 2 — NEW-ASSIGNMENT, reused worker)

## Context you already have
Your migrations + `schema-contract-jul10.md` are live. Now the API wave. Fill contract §5 placeholders as you implement. Plan decisions D-C1 and D-C4 in `orchestration-ctx/team-plan-next-release-jul-10.md` are locked.

## Task Type
IMPLEMENTATION

## Task IDs (in order)
- `26` — T2: C1 single-step ficha + C4 lazy flip + C7 vencimientos
- `27` — T3: C6 instruments gating + usuario tipoEmpleado

## T2 (#26) scope

### C1 — atomic assign + first update
Origin: transcript lines 210–264 — "se asigna el instrumento y se carga el primer update en un solo paso".
- Extend `POST /patients/:id/fichas` (or sibling route per existing pattern in patients.routes.ts — your call, document in contract) to accept `{ instrumentoId, archivoCompletado, notasObservaciones?, fechaVencimiento? }` and atomically (one Prisma `$transaction`): create RegistroFichaCompletada + set `archivoCompletado` + `estado: COMPLETADO` + `fechaCompletado: now()`.
- The OLD flow (create PENDIENTE, later PATCH status) MUST keep working — renewals depend on it.
- Zod: `archivoCompletado` required min 1 (it's a completed evaluation, not a bare assignment). If the caller wants a bare PENDIENTE assignment (legacy), the old body shape (no archivoCompletado) still creates PENDIENTE — distinguish by presence of `archivoCompletado`.

### C4 — lazy PENDIENTE→VENCIDO flip (decision D-C4, no cron)
Origin: transcript lines 265–286.
- In the service path that lists a patient's fichas (used by GET /patients/:id — find it in patientService), before returning: `updateMany({ where: { clienteId, estado: 'PENDIENTE', fechaVencimiento: { lt: today } }, data: { estado: 'VENCIDO' } })` then read. Keep it ONE extra query, not per-row.
- Same flip inside the C7 endpoint.

### C7 — vencimientos report
Origin: transcript line 281 — "informe semanal que me muestre todo lo que se vence esta semana".
- `GET /api/v1/patients/fichas/vencimientos?days=7` (or route placement per existing pattern): returns fichas with `estado IN (PENDIENTE, VENCIDO)` AND `fechaVencimiento <= today+days`, including paciente nombre + instrumento nombre, ordered by fechaVencimiento asc. Run the C4 flip first so estados are truthful.

## T3 (#27) scope

### C6 — gating (locked L2)
Origin: transcript lines 189–193.
- `Usuario.tipoEmpleado` passthrough on the usuario create/update routes (auth.routes or users route — find it).
- Gate `/instruments/*` WRITE ops (POST/PUT/DELETE): allow `rol === 'ADMIN'` OR (`rol === 'EMPLEADO'` AND `tipoEmpleado === 'GERONTOLOGA'`); READs unchanged. Follow the existing `requireRole` middleware pattern — add a composable variant (e.g. `requireInstrumentWriter`) rather than inlining checks.
- Curl allow/deny matrix: ADMIN ✓, EMPLEADO+GERONTOLOGA ✓, plain EMPLEADO ✗ 403, AUDITOR ✗ 403.

## Constraints
Unchanged: patterns per team-plan, no blanket kills, no git commit, no staging/prod. Fill contract §5 as you go (C1 body/response, C7 response shape, gating matrix).

## Deliverables
1. Source changes + updated contract §5
2. `tasks/W1-backend/result-wave2.md` (curl outputs incl. allow/deny matrix)
3. completion-report.md Wave-2 section

## Acceptance Criteria
1. C1: one POST creates COMPLETADO ficha with file, atomically; legacy PENDIENTE flow intact (curl both)
2. C4: a PENDIENTE ficha with past fechaVencimiento reads back VENCIDO
3. C7: endpoint returns due/overdue fichas with paciente+instrumento names
4. C6: 4-row allow/deny matrix verified
5. Backend healthy; typecheck clean

## Reporting
Standard. On done: `SendMessage(to: "main", "COMPLETE: Wave-2 API done (T2+T3). See tasks/W1-backend/result-wave2.md", summary: "W1 wave 2 complete")`. Stay PARKED for QA fix-ups.
