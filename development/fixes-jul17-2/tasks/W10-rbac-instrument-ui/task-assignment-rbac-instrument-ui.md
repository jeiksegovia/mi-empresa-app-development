# task-assignment-rbac-instrument-ui

## Your Role
You are **frontend-eng**. Nuxt 4 SPA, PrimeVue auto-import, Pinia, `useApi`. Spanish UI. Match
existing component patterns; `:model-value` + explicit update handlers (never v-model into const
reactive — project memory pitfall).

## Project Context
Task slug: fixes-jul17-2. Working directory: development/fixes-jul17-2/. Worker 10 (fresh).
Frontend :3100; E2E env `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1`
+ helper `frontend/tests/helpers/auth.ts` (sameSite=strict). The dynamic-fichas renderer stack
already exists: `frontend/app/components/instrument/{DynamicInstrumentForm,InstrumentResultView}.vue`,
`scoring.ts`, `/dev/instrument-preview` route, fixtures `frontend/tests/fixtures/instrument-templates/`.

## Task Type
IMPLEMENTATION — Your task IDs: **#34 → #35 → #36**

## THE CONTRACT (your ONLY spec — backend source is FORBIDDEN)
`development/fixes-jul17-2/orchestration-ctx/decisions/contract-fixes-jul17-2.md` — §1.2 matrix,
§1.4 session tipoEmpleado, §1.5 frontend enforcement, §3.2 crear selector + sin-definición, §4
audit view + dry-run. Base API shapes: dynamic-fichas contract §4
(`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`).
W9 builds the backend in parallel from the same contract — endpoints may 404 briefly; build against
contract shapes, retry transient failures once, classify residuals.

### Task #34 — Domain gating (contract §1.5)
1. `frontend/app/composables/useDomainAccess.ts`: mirror the §1.2 matrix EXACTLY (cell-by-cell —
   QA validates parity); expose `can(domain)`, `canCreateOnly(domain)`. Session profile from the
   auth store; `tipoEmpleado` arrives per §1.4 (null → everything as today; ADMIN → all).
2. Sidebar (`frontend/app/layouts/default.vue`): hide forbidden sections per profile.
3. Route middleware: prefix→domain map (§1.5); forbidden → redirect `/` + toast "Acceso no permitido".
4. In `pacientes/[id]/index.vue`: fichas & evaluaciones tab + asignar/llenar controls require
   `can('fichas')`; notas section requires `can('notas')`; edit/delete controls hidden under
   create-only. 403 responses (`code: DOMAIN_FORBIDDEN`) surface as the same toast (no silent failure).
5. Smoke spec `frontend/tests/rbac/nav-gating.spec.ts`: stub/mock the session profile (or use dev
   users if W9's backend is ready) — per profile assert sidebar items + one forbidden-route redirect
   + fichas-tab visibility. Mark clearly which parts run mocked.

### Task #35 — Crear selector + sin-definición (contract §3.2)
1. `instrumentos/crear.vue` (+ shared component if editar needs awareness): selector "Tipo de
   instrumento (plantilla)": 6 template options with summary (nº ítems + puntaje máx or
   "informativo" — compute from `GET /instruments/:codigo/definition`) + "Sin plantilla (solo
   metadatos)". Send `templateCodigo` in POST when selected.
2. Sin-definición state: instruments whose list/detail payload lacks `activeVersion` get badge
   "Sin definición — no llenable" (list + details); excluded/disabled in the patient assign/llenar
   picker (pacientes detail).
3. Extend an existing spec or add `frontend/tests/instruments-dynamic/crear-template.spec.ts`:
   selector renders 6+1 options; creating with BARTHEL template (real backend if ready, else
   contract-mocked + marked) shows the new instrument as fillable; a legacy sin-definición
   instrument shows the badge and is not offered in the assign picker.

### Task #36 — Audit view + dry-run (contract §4)
1. `frontend/app/components/instrument/InstrumentAuditView.vue`: input = definition JSON. Per
   section: titulo, subtotal máx, skip rule text ("Se omite (opcional) si <sección> ≥ N"),
   section-level ranges table. Per item: label, tipo, requerido, options table (etiqueta → puntaje).
   Global result-evaluation table. Print-friendly, Spanish, collapsible sections.
2. Instrumento details (`instrumentos/[id]/index.vue`): expandable "Revisión de puntajes y lógica"
   (renders AuditView from the active definition; hidden for sin-definición) + button
   "Probar sin guardar" → dialog: `DynamicInstrumentForm` + live client scoring (`scoring.ts`) +
   banner "Vista de prueba — resultado no oficial, no se guarda". ZERO network writes from the
   dry-run (no POST/PATCH; definition fetch GET is fine).
3. Spec `frontend/tests/instruments-dynamic/audit-dryrun.spec.ts`: BARTHEL audit shows 10 items ×
   option scores (spot: Comida → 10/5/0) + ranges table; MNA audit shows skip rule + cribaje
   section ranges; dry-run: fill Barthel all-max → live total 100 + "Dependencia ligera", assert
   NO POST/PATCH requests fired during the dialog (route/request interception), nothing persisted.

## Pre-loaded traps
- PrimeVue RadioButton in Playwright: use `page.evaluate(() => input.click())` (established pattern).
- v-model const-reactive pitfall (above).
- Uppercase-as-you-type must NOT apply to any new inputs except entity `nombre` fields (existing E1 pattern applies on crear nombre — keep it).
- Backend may lag: NEVER read backend source to compensate — contract only; mark mocked test paths for QA to re-run live.

## Worker Self-Check
- Contract addendum exists with §1.5 + §4 → else BLOCKED
- `frontend/app/components/instrument/DynamicInstrumentForm.vue` + `scoring.ts` exist → else BLOCKED
- TaskList shows #34, #35, #36 assigned to you → else BLOCKED

## Acceptance Criteria
1. Matrix parity: useDomainAccess cells == contract §1.2 (QA-checkable constant, exported).
2. Per-profile nav gating + forbidden-route redirect + fichas-tab behavior proven by spec.
3. Crear with template → fillable instrument; sin-definición badge + picker exclusion proven.
4. Audit view shows every option score + ranges + skip rules for BARTHEL and MNA (spec evidence).
5. Dry-run: live scoring works, zero write requests (interception evidence), nothing persisted.
6. All specs' verbatim output in completion report; mocked-vs-live parts explicitly listed.

## Deliverables
1. `useDomainAccess.ts`, route middleware file, layout + page gating changes
2. crear.vue selector + sin-definición states (list/details/picker)
3. `InstrumentAuditView.vue` + details-page wiring + dry-run dialog
4. Specs: `frontend/tests/rbac/nav-gating.spec.ts`, `frontend/tests/instruments-dynamic/{crear-template,audit-dryrun}.spec.ts`
5. `development/fixes-jul17-2/tasks/W10-rbac-instrument-ui/{progress-report.md, completion-report.md}`

## Boundaries
Write ONLY `frontend/**` + your task dir. NOT `backend/**` (W9). Do not modify DynamicInstrumentForm/
scoring.ts behavior (consume as-is; defects → report, don't fix). Contract deviations → §Deviations W10.

## Context Management
13 pts — after #34, write state to progress-report.md, `/compact`, re-read this assignment, continue.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "34", status: "in_progress")`; per-task complete → TaskUpdate + proceed in the SAME turn.
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. All done: completion-report.md → `SendMessage(to: "main", message: "COMPLETE: W10-rbac-instrument-ui done. …", summary: "W10 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: …", summary: "W10 blocked")` + WAIT. If a shell permission prompt hangs a command, BLOCKED immediately with the exact command — never sit silent.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never TaskCreate. After final COMPLETE, end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
