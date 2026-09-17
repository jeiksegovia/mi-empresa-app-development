# Follow-up (Aug 04) — qa-session-jul-31

Continuation of qa-session-jul-31. Three items + prior fixes report (`fixes-aug-04-test-flake-and-rbac-session.md`, moved here).

## Locked decisions (developer-approved 2026-08-04)
- **TINETTI**: two per-foot gait items, **4 options each**, reworded so header+options correspond to the same foot; renumber gait items. Publish as **TINETTI.v3** (preserve v2 history — fichas reference `instrumentoVersionId`).
- **Lock scope**: "Core + contracts/payment only" — when an empleado is `bloqueado`, non-admins are blocked from: employee update (`PUT /employees/:id`) + delete + contratos (create/edit/delete). Nómina periodos, asistencia, certificados stay editable by CONTRATOS. ADMIN bypasses all.
- **Lock model**: `bloqueado` + `bloqueadoPor` + `bloqueadoEn` (audit). Icon on empleados list, detail header, and editar (locked state for non-admins; admin lock/unlock toggle).
- Only ADMIN can lock/unlock. Lock state is NOT settable via the normal employee update payload (Zod strips it; only dedicated admin endpoints mutate it).
- Final step after approval: **deploy to staging (aug-4)**.

## R-A — TINETTI v3
- New `backend/prisma/instrument-templates/TINETTI.v3.json` (version 3). Marcha items:
  - 11. Paso — pie derecho (4 opts, scores 0/1/1/2)
  - 12. Paso — pie izquierdo (4 opts, scores 0/1/1/2)
  - 13 simetría, 14 fluidez, 15 trayectoria, 16 tronco, 17 postura (renumbered labels; ids stable).
- Seed auto-picks highest version. Scoring unchanged (`total: sum`, same thresholds).

## R-B — Employee lock (bloqueador)
- Schema: `empleados.bloqueado BOOL default false`, `bloqueado_por INT? FK usuarios`, `bloqueado_en TIMESTAMP?`. Additive migration.
- Middleware `requireEmployeeUnlocked(param)` (domainAccess.ts): ADMIN→next; else 1 SELECT `bloqueado`; if true → 403 `EMPLOYEE_LOCKED`. Applied to PUT/DELETE `/employees/:id` and contratos mutations in nomina.routes.
- Admin endpoints: `PUT /employees/:id/lock`, `PUT /employees/:id/unlock` (`requireRole('ADMIN')`) → set/clear bloqueado + audit.
- Security: `bloqueado*` absent from create/update Zod → stripped by `validate` (writes parsed back to req.body). Service sets fields explicitly. No client path to flip lock except admin endpoints.
- FE: lock icon (list/detail/editar), admin toggle, non-admin locked banner + disabled form.

## Tests
- BE: contratos blocked on locked empleado (PUT + contratos POST) → 403 EMPLOYEE_LOCKED; admin can edit locked; only admin lock/unlock; `bloqueado` in normal PUT payload is ignored. TINETTI v3 seed/scoring.
- FE: lock icon + admin toggle + non-admin disabled state.

## Deploy
After developer approval → staging release (aug-4) per `.claude/skills/planify-team/release-protocol.md`. New migration additive; TINETTI v3 seeded.
