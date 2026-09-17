# task-assignment-t7-qa (W3, wave 4 — NEW-ASSIGNMENT, reused worker)

## Context you already have
You repaired the jul4 origin + port-3001 infra in T4 and classified the residuals. Now the full QA wave on everything this release shipped — plus closing your own T4 follow-up list.

## Task Type
IMPLEMENTATION (tests + report)

## Task ID
`31`. `TaskUpdate(taskId: "31", status: "in_progress")` on start.

## What shipped since your T4 (read these first)
1. `orchestration-ctx/decisions/schema-contract-jul10.md` — full contract incl. §5 C1/C4/C7/C6 (test against THIS)
2. `tasks/W1-backend/result.md` + `result-wave2.md` — backend evidence
3. `tasks/W2-frontend/result.md` + completion-report — frontend evidence + deviations (tipoEmpleado API-only; old Asignar button removed by design; e2e/paciente-fichas 7-fail pre-existing harness issue flagged to you)

## Scope

### 1. New backend specs (`backend/tests/`)
- `patients/ficha-single-step.spec.ts` — C1: atomic COMPLETADO create; legacy PENDIENTE (no archivoCompletado) still works; both round-trip
- `patients/ficha-vencido-flip.spec.ts` — C4: insert past-due PENDIENTE via API where possible (or document SQL setup), GET patient → VENCIDO
- `patients/fichas-vencimientos.spec.ts` — C7: shape (clienteNombre/instrumentoNombre/diasHastaVencimiento), ordering asc, days param, flip-before-report
- `instruments/gating.spec.ts` — C6 matrix: ADMIN 201, EMPLEADO+GERONTOLOGA 201, plain EMPLEADO 403, AUDITOR 403; GET open to all. Create/cleanup the gerontóloga user via /users API
- `users/tipo-empleado.spec.ts` — POST /users pairing rule (tipoEmpleado without rol=EMPLEADO → 400 field=tipoEmpleado); PATCH clears on rol change
- `contrato-cargo-notnull` — extend or add: missing cargoId → 400 errors.cargoId (already Zod-level)
- E1: `uppercase-transform.spec.ts` — lowercase POST on the 5 models → stored+returned UPPERCASE; descripcion preserves case

### 2. T4 follow-up closures (your own list)
- jul4 UI-selector refresh (10 tests) — refresh locators against current UI (page snapshots); do NOT weaken assertions
- P6-1/3/4 cargoId fixture — fetch seeded cargo id (`GET /empresa/cargos?activo=true` → first id) and pass it
- patient-notes B1 fixture — add `fechaIncidente` per `nota-fecha-incidente.spec.ts` template
- e2e/paciente-fichas harness (from W2's flag): the shared `goToPacientes()` sidebar-nav helper times out in collapsed-sidebar headless viewport — fix the HELPER (e.g., viewport size or direct `page.goto`), not the assertions

### 3. Uppercase fixture reconciliation
Any existing spec asserting mixed-case entity names now fails against UPPERCASE storage — update the FIXTURES/expected values (never loosen to case-insensitive unless the assertion's purpose is unrelated to naming).

### 4. Full regression + report
- Backend: full `backend/tests/` run
- Frontend: full `local-qa/` (jul4+jul8+jul9+jul10) + `e2e/paciente-fichas` with matching-host env vars
- `tasks/W3-test-quality/qa-report.md`: pass/fail/skip matrix per suite · requirements coverage for C1-C4, C6-C7, E1, hardening items (MET/PARTIAL/MISSING + evidence) · gap list w/ severity · classification (BUG/TEST-ENV/FLAKE) for every failure

## Constraints
- Do NOT modify source (`backend/src/`, `frontend/app/`) — bugs go in the gap report
- Do NOT restart services; clean up all test data; no git commit
- Env for frontend runs: `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1`

## Deliverables
1. New spec files + repaired jul4/e2e fixtures
2. `qa-report.md`
3. `result-t7.md`, completion-report Wave-4 section

## Acceptance Criteria
1. ≥6 of 7 new backend spec areas green (env-blocks documented)
2. jul4 suite ≥20/24 after selector+fixture refresh (the T4 target, now unblocked)
3. Full-suite regression: every failure classified; zero UNCLASSIFIED
4. Report covers all release items with evidence

## Reporting
Standard. On done: `SendMessage(to: "main", "COMPLETE: T7 QA done. {counts}. Gaps: {severities}. See tasks/W3-test-quality/qa-report.md", summary: "T7 complete")`.
