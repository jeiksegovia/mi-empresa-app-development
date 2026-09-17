# task-assignment-qa-validation (fixes-jul17-2)

## Your Role
You are **test-quality** — test against the CONTRACT, not the implementation. FORBIDDEN from
modifying source (`backend/src/**`, `backend/prisma/**` except test fixtures noted below,
`frontend/app/**`); test files + fixtures + gap report only. Real bugs → gap report with exact repro.

## Project Context
Task slug: fixes-jul17-2. Worker 11 (fresh). Your task ID: **#37**.
Local: backend :3101, frontend :3100, DB :15432. E2E env: `TEST_FRONTEND_URL=http://100.85.193.33:3100
TEST_API_URL=http://100.85.193.33:3101/api/v1` + `frontend/tests/helpers/auth.ts` (sameSite=strict).
Everything is implemented + individually validated MOCKED/unit-level; your job is LIVE integration.

## Contracts (test against these)
1. `development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md` (matrix §1.2,
   semantics §1.3, §3 crear-from-template, §4 audit/dry-run)
2. Base: `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
Prior reports (integration notes + handoff): `tasks/W9-rbac-seed-backend/completion-report.md`,
`tasks/W10-rbac-instrument-ui/completion-report.md`.

## Scope (ordered)
1. **Baseline re-runs**: `backend/tests/rbac/` + `backend/tests/instruments-dynamic/` +
   `frontend/tests/rbac/` + `frontend/tests/instruments-dynamic/` as-is; verbatim counts.
2. **Matrix parity (programmatic)**: new spec comparing `DOMAIN_ACCESS` in
   `backend/src/middleware/domainAccess.ts` vs `frontend/app/composables/useDomainAccess.ts`
   cell-by-cell (read both files as text/import — this is a test READING source, allowed). Any
   mismatch = BUG.
3. **Live RBAC e2e** (`frontend/tests/rbac/live-profiles.spec.ts`): create the 3 QA profiles
   locally (run `backend/prisma/test-db/seed-qa.ts` with local env pairs, W9's documented pattern
   — cleanup after). Then in the browser, per profile: login → sidebar contents; forbidden direct
   URL → redirect + toast; a LIVE 403 DOMAIN_FORBIDDEN toast (e.g., CONTRATOS calling a fichas API
   via the UI); GERONTOLOGA: fichas tab visible + can fill an instrument; CONTRATOS: pacientes
   create works, Editar hidden, fichas tab hidden; method-level via API: CONTRATOS PUT paciente 403.
4. **Crear-from-template live e2e** (`frontend/tests/instruments-dynamic/crear-template-live.spec.ts`):
   as qa-admin (or admin): crear page → select BARTHEL template → create → new instrument fillable:
   assign+fill from a patient → server-scored total/clasificación; legacy sin-definición instrument
   shows badge + excluded in picker; source BARTHEL definition unchanged (GET before/after compare).
5. **Audit + dry-run live** (extend `audit-dryrun` or new live spec): real seeded BARTHEL — audit
   shows Comida 10/5/0 + global ranges; MNA audit shows skip rule + cribaje ranges; dry-run all-max
   → live 100/"Dependencia ligera" with ZERO POST/PATCH (interception) and no new ficha rows after.
6. **Regression + folded item**: run `backend/tests/patients/` + `backend/tests/instruments/`
   suites; the known pre-existing `ficha-transitions.spec.ts` failure (W9-classified data-drift:
   picks a placeholder instrument without active version) — fix the TEST FIXTURE (filter for
   activeVersion, same pattern W5 used) so intent is preserved; do NOT touch source. Anything else
   failing: classify (BUG/TEST-ENV/FLAKE), zero unclassified.
7. **Gap report** `tasks/W11-qa-validation/gap-report.md` (exact repro + contract citation per gap;
   "no gaps" is a valid outcome).

## Pre-loaded traps
- PrimeVue RadioButton: `page.evaluate(() => input.click())`. Origin-aware login helper REQUIRED.
- Session mocking patterns from W10's specs exist — reuse for determinism only where live isn't feasible; prefer LIVE.
- seed-qa local run creates local-qa-* users — clean them up in afterAll (W9's pattern).
- tipoEmpleado-null dev users (admin@ etc.) must behave exactly as before — spot-check one.

## Acceptance Criteria
1. Matrix parity spec green (or mismatch filed as BUG with the exact cells).
2. Live per-profile evidence for all 3 QA users (steps 3 items) — verbatim run output.
3. Crear-from-template live e2e green incl. source-unchanged compare.
4. Dry-run live: zero write requests + row-count unchanged.
5. ficha-transitions fixture fixed + green (before/after counts); all suites classified, zero unclassified.
6. gap-report.md exists.

## Deliverables
1. `frontend/tests/rbac/live-profiles.spec.ts`, `frontend/tests/instruments-dynamic/crear-template-live.spec.ts`, matrix-parity spec (backend or frontend tests dir), audit/dry-run live additions
2. Fixed `backend/tests/patients/ficha-transitions.spec.ts` fixture
3. `development/fixes-jul17-2/tasks/W11-qa-validation/{gap-report.md, progress-report.md, completion-report.md}`

## Boundaries
Tests + fixtures + your task dir ONLY. No source. No staging (local only — #38 owns staging). No SSM calls.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "37", status: "in_progress")`.
2. Errors: MAX 2 fix attempts → `## Strategy Request` + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. Done: completion-report.md → `TaskUpdate(taskId: "37", status: "completed")` → `SendMessage(to: "main", message: "COMPLETE: W11-qa-validation done. Gaps: {N}. …", summary: "W11 complete")`.
4. Blocked (incl. hung permission prompt — report the exact command): `SendMessage(to: "main", message: "BLOCKED: …", summary: "W11 blocked")` + WAIT.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never TaskCreate. After final COMPLETE, end turns silently.
Team tools are native tools — call directly; ToolSearch does not exist in your session.
