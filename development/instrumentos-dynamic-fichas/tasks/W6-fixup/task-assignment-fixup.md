# task-assignment-fixup

## Your Role
You are **fullstack-impl** — you own a small vertical fix slice across backend and frontend.
Keep the client/server boundary explicit, test the full path. This codebase: Express + Prisma v6
(client at `backend/src/generated`), Zod-at-top-of-routes, service→route; Nuxt 4 SPA + PrimeVue,
`useApi` composable. Spanish UI text.

## Project Context
Task slug: instrumentos-dynamic-fichas. You are Worker 6 (fix-up wave — the feature is BUILT and
QA-validated; you fix exactly the 3 bugs QA filed + one contract addendum, nothing else).
Local: backend :3101 (tsx watch), frontend :3100, DB :15432. Admin: admin@miempresa.com/<redacted>.
E2E env: `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1`
(sameSite=strict; helper `frontend/tests/helpers/auth.ts`). Backend specs: `TEST_API_URL=http://localhost:3101`.

## Task Type
IMPLEMENTATION — Your task ID: **#29**

## Authoritative inputs (read in this order)
1. This file.
2. `development/instrumentos-dynamic-fichas/tasks/W5-qa-validation/gap-report.md` — your bug specs
   with exact repros (BUG-W5-01/02/03). Fix EXACTLY these.
3. Contract `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
   §4.3 — note **G2-11** (instrumentoVersionId server-resolved) and NEW **G2-12** (versionRegistro
   optional, server-derived `v{version}` from the resolved active version).

## Scope (ordered — simplest first)

### 1. BUG-W5-03 (LOW, 2-line change)
Delete dead `plantillaArchivo: string | null` at `frontend/app/pages/instrumentos/[id]/index.vue:34`
and the dead comment at ~line 277. ALSO the cosmetic C2 item from W5's report: the same page still
renders `versionPlantilla` in its template (~lines 204, 274) — remove those display remnants.

### 2. G2-12 (backend, enables the clean BUG-W5-01 fix)
- `backend/src/routes/patients.routes.ts`: `versionRegistro` → `.optional()` in `createFichaSchema`
  (and the completar schema if it requires it).
- `backend/src/services/patientService.ts`: where the active version is resolved (G2-11 code,
  ~lines 704–742 and the completar path ~794–806), default `versionRegistro` to
  `` `v${resolvedVersion.version}` `` when the caller omitted it. Persist as before.
- Do NOT touch `backend/prisma/**` — column stays as-is.

### 3. BUG-W5-01 (HIGH — patient page submit 400)
`frontend/app/pages/pacientes/[id]/index.vue` `submitForm` (~457–505):
- REMOVE the `payload.instrumentoVersionId = formDialogInstrument.value.id` alias line (G2-11:
  server ignores it; sending a wrong-family id is noise).
- Do NOT add a hardcoded versionRegistro — with G2-12 the server derives it. Just stop failing:
  after step 2, the existing payload (instrumentoId + respuestas + notasObservaciones) is valid.
- Verify the completar path (`openCompleteForm` submit) the same way.

### 4. BUG-W5-02 (MEDIUM — result dialog empty without prior form open)
Same page, result dialog (~1175–1196): rendering `InstrumentResultView` must not depend on
`formDefinition` populated by the assign/complete dialog. Preferred fix (QA option a): when opening
the result dialog, fetch the definition via `GET /instruments/:codigo/definition` (resolve codigo
from the ficha row's instrument summary; verify what the fichas list/detail response exposes — §4.4
includes an instrumento summary) into a dedicated ref (e.g. `resultDefinition`), and guard on that.
Loading state while fetching; keep the true empty-state message only for fichas without respuestas.

### 5. Tighten W5's workaround tests (test files)
- `frontend/tests/instruments-dynamic/fill-flow.spec.ts` (real-backend describe): make it exercise
  the REAL UI submit path (fill in the dialog → click `[data-testid="form-submit"]` → success),
  removing the drive-the-API workaround for BUG-W5-01.
- Same file / e2e specs: remove the "open assign dialog first" workaround for BUG-W5-02 — "Ver
  detalle" directly on a COMPLETADO row must render total + clasificacion.
- `backend/tests/instruments-dynamic/qa-contract.spec.ts` or api-fichas: add one case — POST
  without `versionRegistro` → 201 and persisted `versionRegistro === "v1"` (G2-12).

### 6. Regression re-run (evidence)
`backend/tests/instruments-dynamic/` (expect 48/48 incl. your new case) + the 4 modernized legacy
specs (`ficha-single-step`, `jul11-date-normalization`, `patient-fichas`, `instruments.spec.ts`) +
`frontend/tests/instruments-dynamic/` (expect 17/17 with workarounds removed). Verbatim outputs.

## Worker Self-Check
- gap-report.md exists with BUG-W5-01/02/03 → else BLOCKED
- Contract §4.3 contains "G2-12" → else BLOCKED
- TaskList shows #29 assigned to you → else BLOCKED

## Acceptance Criteria
1. UI repro of BUG-W5-01 (gap report steps 1–8) now succeeds: dialog closes, ficha COMPLETADO,
   result shows server-computed total — proven by the updated real-backend fill-flow spec.
2. UI repro of BUG-W5-02 succeeds without opening the assign dialog first — proven by updated spec.
3. POST without versionRegistro → 201, persisted `v1` (new test green).
4. `grep -n "plantillaArchivo\|versionPlantilla" frontend/app/pages/instrumentos/[id]/index.vue`
   → no code/template hits (comments gone too).
5. Full regression from scope step 6 green; any failure classified (BUG/TEST-ENV/FLAKE), zero unclassified.

## Deliverables
1. Modified: `backend/src/routes/patients.routes.ts`, `backend/src/services/patientService.ts`,
   `frontend/app/pages/pacientes/[id]/index.vue`, `frontend/app/pages/instrumentos/[id]/index.vue`
2. Updated tests per scope step 5
3. `development/instrumentos-dynamic-fichas/tasks/W6-fixup/completion-report.md` (+ progress-report.md)

## Boundaries
- Write ONLY the files listed in Deliverables (+ your task dir). NOTHING else: no prisma, no other
  pages/components (`DynamicInstrumentForm.vue` etc. are correct — bugs are in the page wiring),
  no contract edits (orchestrator owns it), no scope creep ("nearby thing looks off" → report, don't fix).
- Never touch port 4142; no process kills; :3101 auto-reloads.

## Completion Report Format
Deliverables table | Per-bug: repro BEFORE (from gap report) → evidence AFTER (verbatim) | Regression
outputs | Known issues NOT fixed | Deferred items.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "29", status: "in_progress")`.
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` in progress-report.md + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. Done: completion-report.md → `TaskUpdate(taskId: "29", status: "completed")` → `SendMessage(to: "main", message: "COMPLETE: W6-fixup done. …", summary: "W6 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: {exact}. Attempted: {…}. Need: {…}", summary: "W6 blocked")` + WAIT.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never idle silently.
6. Never TaskCreate. After final COMPLETE, ignore echoes/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
