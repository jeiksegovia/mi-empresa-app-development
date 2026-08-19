# task-assignment-frontend

## Your Role
You are **pt-frontend-eng** — frontend engineer.
Prioritize: match PrimeVue/existing pages, Spanish UI copy, `useDomainAccess` parity with the **contract** (not by reading domainAccess.ts), testids from the contract, mocked Playwright under `frontend/tests/**`.

## Project Context
Task slug: qa-session-aug-17
Working directory: /Users/jeik/ws/mi-empresa-app-development
You are Worker 3 of 3. Task IDs: **7** (tabs), **8** (nomina dialog), **9** (actividades UI).

## Plan File
`development/qa-session-aug-17/orchestration-ctx/team-plan-qa-session-aug-17.md`

## Task Type
IMPLEMENTATION

## Your Task
Implement R1, R3 UI, R6 UI against the contract. Do **not** open `schema.prisma` or `nominaService.ts` for names.

## Implementation Location
- `frontend/app/pages/empleados/index.vue`
- `frontend/app/pages/nomina/index.vue`
- `frontend/app/pages/actividades/index.vue` (new)
- `frontend/app/app.config.ts`
- `frontend/app/composables/useDomainAccess.ts`
- `frontend/shared/types/api.ts` (or `frontend/app/shared/types/api.ts` — use the existing path)
- `frontend/tests/local-qa/aug17-qa-frontend.spec.ts` (new)

## Source Files to Modify
- `frontend/app/pages/empleados/index.vue` — two tabs Activos/Inactivos; default ACTIVO; remove Todos
- `frontend/app/pages/nomina/index.vue` — bonos field FIJO/INDEF only; total = mensual+bonos; aportes helper “no se suma”
- `frontend/app/pages/actividades/index.vue` — CREATE
- `frontend/app/app.config.ts` — item **immediately after** Asistencia: `{ label: 'Registro de actividades', icon: 'pi pi-list', to: '/actividades' }` (contract §1.4)
- `frontend/app/composables/useDomainAccess.ts` — Domain + prefix `/actividades` + matrix cells from contract
- types file — RegistroActividad shapes
- `frontend/tests/local-qa/aug17-qa-frontend.spec.ts` — mocked: tabs default, nomina bonos visibility + total, nav item, hide write for GERONTOLOGA/CONTRATOS

## FIRST ACTION
0. cwd check → BLOCKED if not project root
1. Read contract: `development/qa-session-aug-17/orchestration-ctx/decisions/contract-schema-qa-aug-17.md`
2. `TaskUpdate` task 7 in_progress

## Acceptance Criteria
**T7**
- testids `empleados-tab-activos` / `empleados-tab-inactivos`
- First fetch uses `estado=ACTIVO`
- No Todos option

**T8**
- testid `nomina-bonos` visible only when contrato is TERMINO_FIJO or TERMINO_INDEFINIDO
- Subtotal = valorMensual + bonos; Total = same (aportes not added)
- POST/PUT body includes `bonos` for those tipos
- OPS/OBRA: no bonos control

**T9**
- Sidebar item below Asistencia; hidden when `can('actividades')` is false
- PROFESORES/AUXILIARES: form today + texto + guardar; list own
- GERONTOLOGA/CONTRATOS: list all, no form
- ADMIN: list all + can edit/delete (simple affordances)
- `isReadOnly('actividades')` hides writes

v-model pitfall: do not `v-model` on `const reactive()` — use `:model-value` + assign if needed.

## Deliverables
- Files above
- `frontend/tests/local-qa/aug17-qa-frontend.spec.ts`
- `development/qa-session-aug-17/tasks/W3-frontend/completion-report.md`

## Progress Reporting
`development/qa-session-aug-17/tasks/W3-frontend/progress-report.md`

## Key Files to Read First
- Contract (SSID for testids + matrix)
- `frontend/app/pages/asistencia/index.vue` (page chrome)
- `frontend/app/pages/nomina/index.vue` (`usaValorMensual`)
- `frontend/tests/local-qa/jul31-qa-frontend.spec.ts` (mock pattern)
- `frontend/app/components/AppSidebar.vue` (can() filter)

## Interface Contracts
Contract only.

## Boundaries
- Do NOT modify backend routes/services/prisma
- Do NOT git commit
- Do NOT implement R2 (BE only)

## Turning Point / Reporting
Same as worker-template. Address **team-lead**.
Start T7 then T8 then T9 autonomously.
Final: `SendMessage(to: "team-lead", message: "COMPLETE: W3-frontend done. Deliverables: tabs, nomina bonos UI, actividades page+nav+spec.")`
Never TaskCreate.
