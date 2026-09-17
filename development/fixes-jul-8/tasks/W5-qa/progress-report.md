# W5-QA Progress Report — fixes-jul-8

**Date:** 2026-07-09
**Worker:** W5 (qa)
**Task ID (orchestrator):** 19

---

## Phase 1 — Audit (delivered code vs. original requirements)

### 1. Certificados (cert flow)

| Sub-requirement | Status | Evidence |
|---|---|---|
| Certificate `update` history rows (per-update audit trail) | **MET** | `prisma/schema.prisma` adds `CertificadoUpdate` model; `services/certificateService.ts:268-343` adds `listCertificateUpdates` + `addCertificateUpdate`; `routes/certificates.routes.ts:164-202` mounts `POST /certificates/:id/updates` + `GET /certificates/:id/updates` |
| `Agregar` button POSTs update to `/updates` | **MET** | `frontend/app/pages/certificados/[id].vue:551-559` renders "Agregar actualización" button → `submitAddUpdate` posts to `/certificates/:id/updates` |
| Edit form edits description / date (but no files) | **PARTIAL** | `frontend/app/pages/certificados/[id].vue:183-235` — edit form has `nombre`, `tipoCertificado`, `descripcion`, `estado` but does **NOT** include `fechaEmision` / `fechaVencimiento` / `periodo` / `periodicidad` per D2 (dates managed via updates). Original prompt says *"edit button could edit the actual certificado description and date"* — see **GAP-1**. |
| Create page supports optional first update in one flow | **MET** | `frontend/app/pages/certificados/crear.vue:268-296` runs POST `/certificates` then POST `/certificates/:id/updates` if `hasFirstUpdateContent()` is true |
| `certificados/:id` shows history of updates | **MET** | `frontend/app/pages/certificados/[id].vue:579-622` renders `cert-updates-list` with newest first |
| Snapshot rule: parent cert keeps current `estado`/`fechaVencimiento` | **MET** | `services/certificateService.ts:296-340` recomputes `estado` from `effectiveFechaVencimiento` |

### 2. Instrumentos

| Sub-requirement | Status | Evidence |
|---|---|---|
| Roles field is a predetermined tag selector (MultiSelect) | **MET** | `frontend/app/pages/instrumentos/crear.vue:262-270` uses `<MultiSelect>` with `ROLES_OPTIONS = ['ADMIN','EMPLEADO','AUDITOR','OPERADOR']` |
| API rejects bogus roles | **MET** | `routes/instruments.routes.ts:18-22,30-32` refines `rolesPermitidos` against `ROL_USUARIO_VALUES`; sends 400 |
| Plantilla file upload | **MET** | `frontend/app/pages/instrumentos/crear.vue:309-370` — dropzone + `useFileUpload().uploadFile(file, 'instrumentos')`; form data sent as `plantillaArchivo: key` |
| Edit page (`/instrumentos/:id/editar`) | **MET** | New file `frontend/app/pages/instrumentos/[id]/editar.vue` exists, populates from GET, PUTs |
| Edit page surfaces file replacement | **MET** | Per W4 result.md — `instrumentos/[id]/editar.vue` mirrors crear and includes plantilla upload |

### 3. Paciente (fichas)

| Sub-requirement | Status | Evidence |
|---|---|---|
| Bug 1 — Historial table renders `instrumentoNombre` | **MET** | `frontend/app/pages/pacientes/[id]/index.vue:704-710` reads `data.instrumento?.nombreInstrumento || data.instrumentoNombre || '—'` (dual-shape fallback) |
| Bug 2 — `handleFichaSubmit` sends `notasObservaciones` + `fechaVencimiento` | **MET** | `frontend/app/pages/pacientes/[id]/index.vue:456-464` builds PATCH body with `notasObservaciones` + `fechaVencimiento` only when non-empty |
| Bug 3 — Pencil enabled for VENCIDO row | **MET** | `frontend/app/pages/pacientes/[id]/index.vue:119-123` maps `validTransitions[VENCIDO] = ['COMPLETADO']`; button binding at line 759: `:disabled="!validTransitions[data.estado]?.length"` |
| `VENCIDO → COMPLETADO` backend transition allowed | **MET** | `routes/patients.routes.ts:272-276` `validTransitions[VENCIDO] = ['COMPLETADO']` |
| Backend requires `archivoCompletado` when transitioning to COMPLETADO | **MET** | `routes/patients.routes.ts:284-287` |
| Session persistence: ficha form draft in sessionStorage | **MET** | `frontend/app/pages/pacientes/[id]/index.vue:107-109,374-401` writes to `ficha-form-draft-${patientId}-${fichaId}`; restored in `openFichaDialog` at line 319-332 |

### 4. Nomina

| Sub-requirement | Status | Evidence |
|---|---|---|
| Default filter = only employees **with** contract | **MET** | `frontend/app/pages/nomina/index.vue:55` default `selectedTipoFilter = ['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO']` (no `SIN_CONTRATO`). Service default behaviour confirmed in `nominaService.ts:155-160` |
| Filter UI includes contract-type + "sin contrato" option | **MET** | `frontend/app/pages/nomina/index.vue:48-54` `TIPO_FILTER_OPTIONS` includes SIN_CONTRATO (wireValue=NONE) |
| OPS employee w/o cuenta-de-cobro shows **inline** error (not just toast) | **MET** | `frontend/app/pages/nomina/index.vue:206-208,369-378` — `cuentaCobroError` set when backend returns `field: 'archivos.CUENTA_COBRO'`; `<Message>` rendered inline next to slot via `data-testid="nomina-cuenta-cobro-error"` |
| Backend rejects OPS/OOL without cuenta de cobro | **MET** | `services/nominaService.ts:219-230` throws `{ status: 400, field: 'archivos.CUENTA_COBRO' }`; route at `nomina.routes.ts:126-130` surfaces to client |

### 5. 401 UX (replaces SPA-reload mitigation per D1)

| Sub-requirement | Status | Evidence |
|---|---|---|
| Single redirect to `/login` when JWT expires | **MET** | `composables/useApi.ts:22-37` dispatches `app:session-expired` event; `plugins/session-expired.client.ts:34-58` clears auth + navigates |
| Skip redirect when already on `/login` | **MET** | `plugins/session-expired.client.ts:40-42` |
| Toast message "Sesión expirada" | **MET** | `plugins/session-expired.client.ts:46-55`; falls back to a DOM banner if PrimeVue `<Toast>` not mounted |

### Code-pattern conformance

- ✅ Backend follows `service→route` pattern (`nominaService.ts` ↔ `nomina.routes.ts`, `certificateService.ts` ↔ `certificates.routes.ts`)
- ✅ Zod schemas declared at top of route files (`nomina.routes.ts:11-33`, `patients.routes.ts:15-54`)
- ✅ Errors via `Object.assign(new Error(...), { status, field })` then surfaced in catch — consistent with prior pattern (see `nominaService.ts:259`)
- ✅ Frontend uses `useApi()` for HTTP, `useFileUpload()` for S3
- ✅ Frontend uses `AppPageHeader`, `<Card>`, `<Button>` (PrimeVue), consistent with existing pages
- ✅ i18n consistent — labels in Spanish, error messages in Spanish, types/logic in English

**No deviations from existing project conventions found.**

---

## Phase 2 — Write missing tests (in progress)

Backend tests to write (per task assignment priorities):
1. `backend/tests/certificates/updates.spec.ts` — POST/GET update history + 400/404
2. `backend/tests/instruments/roles-refinement.spec.ts` — 400 on bogus role
3. `backend/tests/patients/ficha-transitions.spec.ts` — VENCIDO→COMPLETADO + missing file
4. `backend/tests/nomina/cuenta-cobro-required.spec.ts` — 400 with `field: 'archivos.CUENTA_COBRO'`
5. `backend/tests/nomina/tipo-contrato-filter.spec.ts` — query filter isolation
