# task-assignment-frontend-a — fichas + nomina + 401 UX

## Plan File
`development/fixes-jul-8/orchestration-ctx/team-plan-fixes-jul-8.md`

## Task Type
IMPLEMENTATION

## Your Task
Frontend fixes for **paciente historial de fichas** (3 bugs + form-state persistence for Android tab-unload), **nomina** (contract-type filter + cuenta-de-cobro error), and **401 UX** improvement. Does NOT touch certificados or instrumentos — those are W4's scope.

## Task ID
Your task ID is `3`. Call `TaskUpdate(taskId: "3", status: "in_progress")` on start.

## Implementation Location
- Source: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Source Files to Modify (concrete list)
1. `frontend/app/composables/useApi.ts` — improve 401 handler (skip redirect if already on /login; toast "Sesión expirada")
2. `frontend/app/pages/pacientes/[id]/index.vue` — 3 bugs:
   - a. Instrument name — verify `data.instrumentoNombre` renders; if empty from backend, W3 must send BLOCKED (backend contract issue)
   - b. `handleFichaSubmit` — add `notasObservaciones` + `fechaVencimiento` inputs to dialog + include in PATCH body
   - c. `validTransitions[VENCIDO] = ['COMPLETADO']`; replace `:disabled="data.estado === 'VENCIDO'"` on pencil with `:disabled="!validTransitions[data.estado]?.length"`
   - d. Form-state persistence: on dialog open, restore `fichaForm` + `uploadedFile.name` from `sessionStorage.getItem('ficha-form-draft')`; on every field change, save; on successful save OR dialog close, `sessionStorage.removeItem('ficha-form-draft')`. (Do NOT persist the File object — that requires IndexedDB and is over-scope. Only persist the name so user knows to re-select on tab reload.)
3. `frontend/app/pages/nomina/index.vue` — filter + error handling:
   - a. Add `<MultiSelect>` at top: options = `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO','SIN_CONTRATO']`. Default value = `['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']` (all contract types, no "sin contrato"). Send to `GET /nomina?periodo=X&tipoContrato=comma,joined,list` (map `SIN_CONTRATO` → `NONE` for the API).
   - b. In `saveEntrada` catch block: parse `e?.data?.field` — if `'archivos.CUENTA_COBRO'`, additionally set a local `cuentaCobroError.value = e.data.message` and show a `<Message severity="error">` inline near the CUENTA_COBRO slot.

## Worker Self-Check
- Task Type is IMPLEMENTATION and "Source Files to Modify" is non-empty ✓
- Plan File exists ✓
- NOT asked to "create a plan" ✓

## Recommended Approach
1. Read the W1 research report: `development/fixes-jul-8/02-research-fixes-jul-8.md` (Domains A, D, E)
2. Read scope decisions: `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` (D1, D3, D4, D5)
3. **Order of implementation**:
   a. 401 UX in useApi.ts
   b. Fichas — VENCIDO transition + disabled condition (Bug 3) — simplest
   c. Fichas — handleFichaSubmit add notasObservaciones + fechaVencimiento (Bug 2)
   d. Fichas — instrumentoNombre check (Bug 1) — likely just needs `|| '—'` fallback
   e. Fichas — form-state sessionStorage persistence
   f. Nomina — MultiSelect filter
   g. Nomina — inline error rendering for CUENTA_COBRO
4. **Verify each in browser**: local frontend running on PID 56667 (port 3100). If you need to restart, target only that PID.
5. If any fetch call requires the backend to have been updated by W2 (specifically: nomina tipoContrato filter, ficha VENCIDO→COMPLETADO transition, nomina cuenta-de-cobro field response), COORDINATE via `BLOCKED:` message if W2 hasn't completed yet. Otherwise, implement the frontend for the expected API contract from the plan and it will Just Work when W2 finishes.

## Key Files to Read First
1. `development/fixes-jul-8/02-research-fixes-jul-8.md` — full W1 research (§Domain A, D, E)
2. `development/fixes-jul-8/orchestration-ctx/decisions/scope-decisions.md` — D1, D3, D4, D5
3. `frontend/app/pages/pacientes/[id]/index.vue` — the file has 866 lines; focus on lines 105-109 (transitions), 312-379 (handleFichaSubmit), 541-663 (historial tab), 635-644 (pencil button), 850-859 (save button)
4. `frontend/app/pages/nomina/index.vue`
5. `frontend/app/composables/useApi.ts`

## Deliverables
1. All source-file modifications listed above (files written to disk — DO NOT git-commit)
2. `development/fixes-jul-8/tasks/W3-frontend/result.md` — summary of what was changed + manual browser verification notes
3. `development/fixes-jul-8/tasks/W3-frontend/completion-report.md`

## Progress Reporting
`development/fixes-jul-8/tasks/W3-frontend/progress-report.md`

## Acceptance Criteria
1. Fichas: pencil enabled on VENCIDO rows (able to open modal after backend transition change); modal submits notas + fechaVencimiento to backend; sessionStorage restores draft on dialog re-open
2. Nomina: MultiSelect filter renders + fires request; inline error appears when cuenta-de-cobro missing
3. 401 UX: /login page does not double-redirect; toast appears
4. TypeScript check passes (`cd frontend && npx nuxt typecheck` if available, otherwise no red squigglies)
5. Frontend dev server on 3100 hot-reloads cleanly (no console errors)

## Constraints
- Local frontend already running PID 56667. Kill only that PID if needed.
- Follow existing patterns: PrimeVue components, `useApi().apiFetch`, `useToast`
- Do NOT modify `frontend/app/composables/useFileUpload.ts` (this session already fixed CRITICAL-2 there)
- Do NOT modify `frontend/nuxt.config.ts` (local-network changes already committed in-session)
- Do NOT commit anything
- Do NOT touch certificados or instrumentos pages — W4 owns those

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "3", status: "in_progress")`
2. **During work**: append sections to progress-report.md per domain (401 / Fichas / Nomina)
3. **On error**: MAX 2 self-repair attempts, then `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary: "Strategy escalation")`
4. **If blocked** (e.g., need W2's endpoint before you can test): `SendMessage(to: "main", message: "BLOCKED: {problem}. Attempted: {tries}. Need: {unblocker}", summary: "Blocked")` then WAIT
5. **On completion**:
   - Write result.md + completion-report.md
   - `TaskUpdate(taskId: "3", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: Frontend-A done. See tasks/W3-frontend/result.md", summary: "Frontend-A complete")`
6. After COMPLETE: ignore further messages unless NEW-ASSIGNMENT or NEW-APPROACH

## Tools Available
Read, Edit, Write, Bash (targeted PID kill, curl, npm). `TaskUpdate` and `SendMessage` are native.
