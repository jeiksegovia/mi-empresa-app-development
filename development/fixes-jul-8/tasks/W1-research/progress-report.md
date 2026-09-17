# W1-Research Progress Report

## Status: COMPLETE

## Task
Research across 5 domains in `/Users/jeik/ws/mi-empresa-app-development`:
- A: SPA Reload root cause
- B: Certificados empresa
- C: Instrumentos
- D: Paciente historial de fichas
- E: Nomina

Read-only. Output to `result.md`, `completion-report.md`, and `02-research-fixes-jul-8.md`.

## Plan
1. Explore domain A (SPA reload) — search for reload triggers
2. Explore domain B (Certificados) — schema, routes, services, pages
3. Explore domain C (Instrumentos) — schema, service, form, roles
4. Explore domain D (Paciente fichas) — pages, components, handler
5. Explore domain E (Nomina) — pages, modal, API
6. Synthesize into result.md

## Domain A — SPA Reload
**Finding:** No reload triggers found anywhere. Only forced nav is `navigateTo('/login')` on 401 in `app/composables/useApi.ts`. Test comments in e2e specs warn about "full-page reload auth issues" — but the source does not reload. Recommendation: improve 401 interceptor (retry + toast).

## Domain B — Certificados
**Finding:** PUT endpoint + Zod schema ALREADY EXIST at `backend/src/routes/certificates.routes.ts`. No `updateCertificateSchema` rewrite needed. Frontend `certificados/[id].vue` has inline edit mode but `editForm` omits `archivoUrl`, `comprobantePagoUrl`, `periodicidad`, `periodo` — these are the gaps W3 needs to fill. No `components/certificate/` files exist.

## Domain C — Instrumentos
**Finding:** `rolesPermitidos` is `String @db.VarChar(255)` (comma-separated), NOT an enum. Frontend uses plain `<InputText>` with placeholder `Ej: ADMIN,EMPLEADO`. No `/instrumentos/[id]/editar.vue` exists. Plantilla file field exists in schema/service but no UI for upload.

## Domain D — Paciente Fichas
**Finding:** `pacientes/[id]/historial.vue` does NOT exist — historial is inline Tab 1 of `[id]/index.vue`. `handleFichaSubmit` body captured verbatim (D.3). Disabled condition captured verbatim: `:disabled="data.estado === 'VENCIDO'"` at line 642. Backend PATCH has no Zod; allows `estado, archivoCompletado, notasObservaciones, fechaVencimiento`. Frontend only sends first two.

## Domain E — Nomina
**Finding:** No `/nomina/crear.vue` or `[id].vue` — entire CRUD UI in `index.vue`. `archivos` field is `.optional()` in backend Zod — cuenta-de-cobro NOT enforced. Frontend `requiredSlotsForTipo` defines required slots but save button does not check. Frontend list fetches all `ACTIVO` empleados for period — no client filter.

## Final outputs
- `tasks/W1-research/result.md` (557 lines, under 600 limit)
- `tasks/W1-research/completion-report.md` — handoff summary
- `development/fixes-jul-8/02-research-fixes-jul-8.md` — orchestrator copy (identical to result.md)
- `tasks/W1-research/progress-report.md` — this file (progress sections appended)