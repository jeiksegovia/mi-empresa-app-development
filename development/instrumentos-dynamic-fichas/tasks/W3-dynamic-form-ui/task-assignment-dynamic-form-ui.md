# task-assignment-dynamic-form-ui

## Your Role
You are **frontend-eng** — UI implementer focused on components, state, and UX. Prioritize component
reusability, predictable state, and matching the existing design system (Nuxt 4 SPA, PrimeVue
auto-import, Pinia, `useApi` composable). Write tests for user interactions.

## Project Context
Task slug: instrumentos-dynamic-fichas. Working directory: development/instrumentos-dynamic-fichas/.
You are Worker 3 of 5. Frontend dev on :3100, backend API base per `frontend/.env`
(`http://100.85.193.33:3101/api/v1` LAN QA; sameSite=strict — Playwright must use matching hosts,
helper `frontend/tests/helpers/auth.ts` is REQUIRED for login). UI language: Spanish.

## Plan File
`development/instrumentos-dynamic-fichas/orchestration-ctx/team-plan-instrumentos-dynamic-fichas.md` (background; do NOT re-create/extend)

## Task Type
IMPLEMENTATION

## THE CONTRACT (authoritative — your ONLY spec)
`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
(post-G2 revision). §1 definition format, §2 item-type registry (5 types), §4 API shapes, §5 answers
payload, §7 patient-field exclusion. **FORBIDDEN: reading `backend/prisma/schema.prisma`,
`backend/src/**`, or any backend source to answer questions — the contract answers them.** If the
contract is ambiguous or contradicts reality: non-breaking → file under `## Deviations — W3 (frontend)`
in the contract; breaking → TURNING-POINT-BREAKING + WAIT.
Fixture definitions (real, post-G2, checker-validated):
`development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/templates/*.v1.json` — COPY the
6 files to `frontend/tests/fixtures/instrument-templates/` and use them for dev/test rendering.

## Your Tasks (IDs literal): #16 → then #17 and #18

### Task #16 — DynamicInstrumentForm renderer
`frontend/app/components/instrument/DynamicInstrumentForm.vue` (+ small subcomponents in the same
dir as needed): props `definition` (contract §1 JSON) + `modelValue` (respuestas, contract §5.1
flat `{itemId: value}`); emits `update:modelValue`.
- Renders sections in order (titulo + instructions), items per §2 registry:
  `single-select-scored` → RadioButton group (2 opts) / RadioButton-or-SelectButton list (3+);
  `number-info` → InputNumber with constraints; `text-info` → InputText/Textarea (+placeholder);
  `single-select-info` → Dropdown/RadioButton; `group-info` → DataTable, one row per `rows[]`,
  a single-choice selector per row over `columns[]` (answer = array of `{rowId, columnId}`, §5.2).
- Live OPTIMISTIC subtotals per scored section + total + tentative classification (server remains
  authoritative — never send scores).
- `skipIf` MAY-skip UX (§1.4): when the condition is met against the live trigger-section subtotal,
  collapse/grey the dependent section, show its trigger-section classification hint, and offer
  "Completar de todos modos"; answering any item un-collapses and makes its required items required.
  All-or-nothing: warn if partially answered.
- Required-field validation before submit-enable; validation messages in Spanish.
- ⚠️ **Pre-loaded trap**: do NOT `v-model` into a `const reactive()` passed down — child emits get
  dropped. Use `:model-value` + explicit `@update:model-value` handlers up the tree (project memory:
  vmodel-const-reactive-pitfall).

### Task #17 — Schema↔render unit tests (hard requirement D1)
`frontend/tests/instruments-dynamic/schema-render.spec.ts`: for EACH of the 6 fixture definitions,
assert every item renders an element of the correct type and count (e.g., BARTHEL: 10 radio groups
with 2–4 options each; MNA_CUADRO: group-info renders 7 rows × 4 choices; FICHA_NUTRICIONAL: 13
info inputs, no scored elements; totals of rendered scored items match section counts). Use the
project's existing test tooling: if a component/unit runner (vitest) is NOT already configured, do
NOT introduce one — build a minimal dev-only preview route (e.g. `frontend/app/pages/dev/instrument-preview.vue`,
loads a fixture by `?codigo=`) and write the assertions as a Playwright spec against :3100.
Document the choice as a deviation note.

### Task #18 — Fill flow + results view + file-flow UI removal
- Fill flow from `frontend/app/pages/pacientes/[id]/index.vue` fichas area: choose instrument →
  form (renderer) → submit via contract §4.3 `POST /patients/:id/fichas` (respuestas present);
  pending fichas get "Completar" → §4.3b `PATCH .../:fichaId/completar`. Assign-only (PENDIENTE)
  flow stays available (POST without respuestas).
- Patient header band (read-only) above the form from patient data per §7 — NEVER as form items.
- `InstrumentResultView.vue`: ficha detail shows puntajeTotal + clasificacion badge; expanded view
  renders section→item→answer label→score rows + subtotals, skipped sections marked ("Omitida —
  cribaje ≥ 12"), clean and print-friendly.
- REMOVE file-based UI: plantilla download buttons, archivoCompletado upload inputs in instrument/
  ficha flows (`pages/instrumentos/**`, pacientes ficha components). Leave employee/cert uploads alone.
- Backend may lag you (W4 builds the API in parallel): build against contract shapes with `useApi`;
  if an endpoint 404s during dev, note it and verify with fixtures — final wiring is validated in
  the QA wave. Retry transient failures once; classify residuals, don't chase.
- Ship at least one smoke spec: `frontend/tests/instruments-dynamic/fill-flow.spec.ts` (happy path
  Barthel fill → submit → result view; mock/fixture-tolerant if API absent, marked accordingly).

## Worker Self-Check
- Contract exists and §2 lists exactly 5 types (no `boolean-scored`) → else BLOCKED
- 6 fixture JSONs exist at the W1 templates path → else BLOCKED
- TaskList shows #16, #17, #18 assigned to you → else BLOCKED

## Acceptance Criteria
1. All 6 fixtures render with ZERO instrument-specific code in the renderer (grep: no "BARTHEL"/"MNA" literals in components).
2. MNA: entering cribaje answers summing ≥ 12 collapses evaluación with hint + "Completar de todos modos"; < 12 keeps it required.
3. Respuestas emitted match contract §5.2 value shapes exactly (verified in schema-render or fill-flow spec).
4. Schema↔render spec passes for all 6 fixtures (verbatim run output in completion report).
5. No remaining plantilla/archivo UI in instrument/ficha flows (grep evidence: `plantilla`, `archivoCompletado` in `frontend/app/pages/instrumentos/**` + ficha components).
6. Uppercase-as-you-type NOT applied to answer inputs.

## Deliverables
1. `frontend/app/components/instrument/DynamicInstrumentForm.vue` (+ subcomponents), `InstrumentResultView.vue`
2. Page changes: `frontend/app/pages/pacientes/[id]/index.vue`, `frontend/app/pages/instrumentos/**` (cleanup), optional `dev/instrument-preview.vue`
3. `frontend/tests/fixtures/instrument-templates/*.v1.json` (6, copied verbatim)
4. `frontend/tests/instruments-dynamic/schema-render.spec.ts` + `fill-flow.spec.ts`
5. `development/instrumentos-dynamic-fichas/tasks/W3-dynamic-form-ui/completion-report.md` (+ progress-report.md during work)

## Boundaries
- Write ONLY: `frontend/**` and your task dir.
- Do NOT touch: `backend/**` (W2/W4), template source JSONs under W1's task dir (copy, don't move/edit),
  team-plan, other task dirs. Do NOT modify shared upload composables (`useFileUpload`, `useFileStash`) — removal is UI-level only.
- W2/W4 work backend in parallel — expect transient API instability; retry once, classify, move on.

## Completion Report Format
Deliverables table | Key decisions (incl. test-tooling deviation if any) | Verbatim spec run outputs |
Known issues NOT fixed (with repro) | Integration notes for W4/QA (exact endpoints consumed, any
contract ambiguity found) | Deferred items.

## Turning Points
Non-breaking: component decomposition, PrimeVue component substitutions (log in contract deviations §W3).
Breaking (STOP + WAIT): answers payload shape change, new item type needed, contract §4 shape unusable.
Format: `SendMessage(to: "main", message: "TURNING-POINT-BREAKING: {situation}. Options: A) … B) …", summary: "Breaking turning point")`

## Context Management
13 pts — after #16, write state to progress-report.md, `/compact`, re-read this assignment, continue.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "16", status: "in_progress")`. Per-task complete → `TaskUpdate(..., "completed")`, proceed to your next task in the SAME turn (#17 then #18; #17/#18 may interleave after #16).
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` in progress-report.md + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. All done: completion-report.md → `SendMessage(to: "main", message: "COMPLETE: W3-dynamic-form-ui done. …", summary: "W3 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: {exact}. Attempted: {…}. Need: {…}", summary: "W3 blocked")` + WAIT.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never idle silently.
6. Never TaskCreate. After final COMPLETE, ignore echoes/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
