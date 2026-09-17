# task-assignment-asistencia-page

## Your Role
You are **frontend-eng**. Build only the Asistencia Registrar hoy page. Match PrimeVue/Nuxt patterns, Spanish UI, English code, large AM/PM checkboxes, data-testid.

## Project Context
Slug: `nomina-asistencia-jul-18`
CWD must be project root `/Users/jeik/ws/mi-empresa-app-development`
You own **Task 9 only**. Other workers own empleado forms and nómina dialog — do not touch those files.

## AUTHORITATIVE CONTRACT
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`
Types already in `frontend/shared/types/api.ts` (`AsistenciaDiaRow`, `AsistenciaDiaPutBody`, etc.).

## Task Type
IMPLEMENTATION

## Source Files to Modify
- `frontend/app/pages/asistencia/index.vue` — **NEW** (primary)
- Optionally small shared helper under `frontend/app/composables/` only if needed and not conflicting
- `frontend/tests/asistencia/registrar-hoy.spec.ts` — **NEW** smoke

## Do NOT touch
- `frontend/app/pages/empleados/**`
- `frontend/app/pages/nomina/**`
- `frontend/app/app.config.ts` (another worker)
- `backend/**`

## Task ID
**9** — Asistencia Registrar hoy page  
`TaskUpdate(taskId: "9", status: "in_progress")` then complete when done.

## FIRST ACTION
0. `pwd` — must be project root.
1. TaskUpdate 9 in_progress
2. Read contract §Asistencia + types + `useApi.ts` + a simple list page for patterns.

## Page requirements (`/asistencia`)
1. `definePageMeta({ middleware: 'auth', layout: 'default' })`
2. Date input default **today** (YYYY-MM-DD local); button "Hoy"
3. Search input filters matrix by nombre/apellido/documento client-side
4. On date change: `GET /asistencia?fecha=` via `useApi().apiFetch`
5. Table/matrix: Empleado | Documento | AM checkbox | PM checkbox | Notas
6. Large checkboxes; `data-testid` e.g. `asistencia-am-{empleadoId}`, `asistencia-pm-{empleadoId}`, `asistencia-guardar`, `asistencia-fecha`, `asistencia-buscar`
7. **Guardar asistencia** → `PUT /asistencia/dia` with `{ fecha, items: all visible or all loaded rows with current flags }`
8. Toast success/error; after save reload GET to confirm
9. Empty state if no employees
10. Spanish labels: Asistencia de empleados, Registrar hoy, Guardar asistencia, Jornada AM, Jornada PM

## Smoke test
Playwright: login admin, goto /asistencia, toggle AM on first row, save, reload, assert checked (or API assert). Follow `frontend/tests/e2e` auth helpers.

## Acceptance
- Page loads without error when API up
- Save persists AM/PM
- No edits to empleado/nomina pages
- completion-report.md written

## Progress / completion paths
- `development/nomina-asistencia-jul-18/tasks/W2b-asistencia-page/progress-report.md`
- `development/nomina-asistencia-jul-18/tasks/W2b-asistencia-page/completion-report.md`

## Reporting Protocol
1. TaskUpdate 9 in_progress
2. Work + progress-report
3. TaskUpdate 9 completed
4. SendMessage main: `COMPLETE: W2b-asistencia-page done. Deliverables: pages/asistencia/index.vue + smoke. See tasks/W2b-asistencia-page/completion-report.md`
5. Never idle without COMPLETE/BLOCKED/WAITING/TURNING-POINT-*

Start now.
