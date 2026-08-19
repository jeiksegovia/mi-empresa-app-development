# task-assignment-t6-actividades

## Your Role
You are **pt-backend-eng** named **worker-2-2**.
T4 and T5 are done. You finish **T6 only**: actividades ACL Playwright spec + any contract gaps in the already-drafted routes/service.

## planify-team protocol (mandatory — read before any tool)

You are a **planify-team worker**, not a solo agent.

1. **Orchestrator is `team-lead`**. Every status: `SendMessage(to: "team-lead", message: "<plain string>")`. Never `"main"`.
2. **You cannot approve plans.** Never send `plan_approval_response` or `plan_approval_request`. If rejected “Only the team lead can approve”, do **not** retry. WAITING.
3. **Never TaskCreate.** Your task ID is **6**.
4. **Never git commit.** Never prod AWS. Never `migrate diff --shadow-database-url`.
5. **Do not improvise.** Contract is SSOT: `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md` §1, §4, §5.
6. **Durability:** append `development/qa-session-aug-17/tasks/W2-backend/progress-report.md` after EACH step.
7. **Idle:** before every turn ends send one of COMPLETE / BLOCKED / WAITING / TURNING-POINT-* as plain text to team-lead.
8. **Cwd:** `/Users/jeik/ws/mi-empresa-app-development` or BLOCKED.

## Task Type
IMPLEMENTATION

## FIRST ACTION
0. `pwd` must be project root.
1. `TaskUpdate(taskId: "6", status: "in_progress")`
2. Read contract §1, §4, §5. Then existing `backend/src/routes/actividades.routes.ts` + `actividadService.ts` — fill gaps vs contract; do not rewrite from scratch if they already match.

## Source Files to Modify
- `backend/src/routes/actividades.routes.ts` (exists — only if contract gap)
- `backend/src/services/actividadService.ts` (exists — only if contract gap)
- `backend/src/middleware/domainAccess.ts` (actividades cells — already added; verify)
- `backend/src/routes/index.ts` (already mounted)
- `backend/tests/rbac/matrix-parity.spec.ts` — actividades cells; empresa stays false
- `backend/tests/actividades/registro-actividades-acl.spec.ts` — **CREATE** (missing)

## Do NOT touch
- schema / migrations / seed
- frontend
- nomina / empresa cargos (T4/T5)
- git commit

## Acceptance
Login: `profesor@miempresa.com` / `auxiliar@miempresa.com` / `password123` (seeded).
- ADMIN full CRUD
- PROFESORES/AUXILIARES: own GET+POST, today-only Bogotá, no PUT/DELETE
- GERONTOLOGA/CONTRATOS: GET all, POST 403
- 400 `EMPLEADO_REQUIRED` if writer has no empleadoId
- 409 `DUPLICATE_DAY` second POST same day
- Spec file exists and Playwright passes

If :3101 is stale after route edits: `lsof -ti :3101` then restart that PID only — never `pkill`.

## Reporting
On done: `development/qa-session-aug-17/tasks/W2-backend/completion-report.md` + `TaskUpdate` 6 completed +
`SendMessage(to: "team-lead", message: "COMPLETE: worker-2-2 T6 actividades API + ACL spec done. See tasks/W2-backend/completion-report.md")`
