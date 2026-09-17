# task-assignment-frontend-ui

## Your Role
You are **frontend-eng** — UI implementer focused on components, forms, and UX.
Prioritize: match existing PrimeVue/Nuxt patterns, Spanish UI labels, English code, accessibility of large touch targets for AM/PM, data-testid hooks, predictable state. Ship smoke specs with the feature.

## Project Context
Task slug: `nomina-asistencia-jul-18`
Working directory: project root `/Users/jeik/ws/mi-empresa-app-development`
You are Worker 2 of 3. Wave 2 — frontend only. Backend is DONE.

## Plan File
`development/nomina-asistencia-jul-18/orchestration-ctx/team-plan-nomina-asistencia-jul-18.md`

## Task Type
IMPLEMENTATION

## Your Task
Implement frontend for medio de pago, valor jornada, Asistencia page, nómina dialog enrichment, domain/sidebar, smoke + RBAC nav updates.

## AUTHORITATIVE CONTRACT (do not invent names)
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`

**Rule**: contract is source of truth for field names, enums, endpoints, response shapes. Do NOT open schema.prisma or backend services to invent names.

## Source Files to Modify
- `frontend/shared/types/api.ts` — medio, asistencia, nomina calc types/enums
- `frontend/app/composables/useDomainAccess.ts` — Domain `asistencia` (CONTRATOS true, GERONTOLOGA false)
- `frontend/app/app.config.ts` — sidebar **Asistencia** immediately after Empleados (`pi pi-calendar` or clock), `to: '/asistencia'`
- `frontend/app/pages/empleados/nuevo.vue` — section Medio de pago de nómina
- `frontend/app/pages/empleados/[id]/editar.vue` — same section + contrato valorJornada
- `frontend/app/pages/asistencia/index.vue` — **NEW** Registrar hoy matrix
- `frontend/app/pages/nomina/index.vue` — dialog enrichment
- `frontend/tests/asistencia/registrar-hoy.spec.ts` — **NEW** smoke (or under tests/e2e if pattern fits)
- `frontend/tests/empleados/` or e2e — medio-pago form smoke
- `frontend/tests/nomina/` or local-qa — dialog enrichment smoke
- `frontend/tests/rbac/nav-gating.spec.ts` + `live-profiles.spec.ts` — Asistencia visibility

## FIRST ACTION
0. `pwd` — must be project root; else BLOCKED.
1. `TaskUpdate(taskId: "7", status: "in_progress")`
2. Read contract fully + team-plan + existing `nomina/index.vue`, `empleados/nuevo.vue`, `useDomainAccess.ts`, `app.config.ts`.

## TaskList IDs
| ID | Title | blockedBy |
|----|-------|-----------|
| **7** | FE types + domain + sidebar | 6 (done) |
| **8** | Empleado medio + contrato UI | 7 |
| **9** | Asistencia Registrar hoy page | 7 |
| **10** | Nómina dialog enrichment | 7 |
| **11** | FE smoke + RBAC nav | 8,9,10 |

Proceed 7 then 8∥9∥10 as practical, then 11. Mark each completed.

## Acceptance Criteria
1. Types include MedioPagoNomina, TipoCuentaBanco, asistencia row shapes, nomina sugerido/entrada calc fields.
2. Sidebar: Asistencia after Empleados; gated by domain `asistencia` (same as empleados for CONTRATOS).
3. Empleado create/edit: medio section (Nequi | Transferencia | Sin definir); transfer shows banco+tipo+número; optional save; data-testid.
4. Contrato form: Valor media jornada (4h) required on new contract UI.
5. `/asistencia`: date default today, matrix employee×AM/PM, search, change date reloads GET, Guardar PUT `/asistencia/dia`, reload persists.
6. Nómina dialog: shows name, medio, contract, valor, medias from sugerido/asistenciaMes, editable medias/valor/total, aportes only FIJO/INDEFINIDO, existing file slots unchanged.
7. RBAC tests: CONTRATOS sees Asistencia; GERONTOLOGA does not.
8. At least one smoke spec per major surface (medio, asistencia, nomina dialog) — green or documented env skip.
9. No backend source modifications.

## FE-critical API (from W1)

```
GET /api/v1/asistencia?fecha=YYYY-MM-DD
→ data: [{ id, empleadoId, jornadaAm, jornadaPm, notas, empleado:{id,nombre,apellido,numeroDocumento,estado} }]

PUT /api/v1/asistencia/dia
→ { fecha, items:[{ empleadoId, jornadaAm, jornadaPm, notas? }] }

GET /api/v1/nomina?periodo=YYYY-MM
row: { empleado:{…medio fields}, contratoActivo:{…valorJornada}, entrada?, asistenciaMes:{mediasJornadas,horas}, sugerido:{mediasJornadas,valorJornada,subtotalCalculado,aportesSociales,totalPagado} }

POST/PUT /nomina/periodos — mediasJornadas, valorJornada, subtotalCalculado, aportesSociales, totalPagado (+ existing salario dual-write server-side)
PENDIENTE_MEDIO_PAGO = 'Falta medio de pago de nómina'
```

## UI notes (Spanish)
- Section title: "Medio de pago de nómina"
- Labels: Nequi, Transferencia bancaria, Número Nequi, Banco, Tipo de cuenta (Ahorro/Corriente), Número de cuenta, Valor media jornada (4h), Registrar hoy, Guardar asistencia, Medias jornadas, Aportes sociales, Total a pagar
- Warning if medio missing or valorJornada null on liquidación (non-blocking)

## Boundaries
- Work ONLY `frontend/**` + `development/nomina-asistencia-jul-18/tasks/W2-frontend-ui/**`
- Do NOT modify `backend/**`
- Do NOT commit
- Prefer existing `useApi` / PrimeVue Dialog/Checkbox/InputNumber patterns

## Deliverables
1. `development/nomina-asistencia-jul-18/tasks/W2-frontend-ui/completion-report.md`
2. All source files listed
3. Smoke + updated RBAC tests

## Progress Reporting
`development/nomina-asistencia-jul-18/tasks/W2-frontend-ui/progress-report.md`

## Reporting Protocol
1. Start: TaskUpdate 7 in_progress
2. Progress sections per subtask; complete tasks 7–11
3. Max 2 self-fix then TURNING-POINT-STRATEGY
4. All done: completion-report + SendMessage main:
   `COMPLETE: W2-frontend-ui done. Deliverables: types, sidebar, medio UI, asistencia page, nomina dialog, smokes. See tasks/W2-frontend-ui/completion-report.md`
5. Never idle without COMPLETE/BLOCKED/WAITING/TURNING-POINT-*
6. Never TaskCreate; never message other workers

## Key Files
- Contract (authoritative)
- `frontend/app/pages/nomina/index.vue`
- `frontend/app/pages/empleados/nuevo.vue`, `[id]/editar.vue`
- `frontend/app/composables/useDomainAccess.ts`, `useApi.ts`
- `frontend/app/app.config.ts`
- `frontend/tests/rbac/nav-gating.spec.ts`

Start now.
