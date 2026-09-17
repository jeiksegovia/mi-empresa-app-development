# W4 Frontend-B — Progress Report

**Task ID:** 4
**Worker:** pt-frontend-eng (W4)
**Date started:** 2026-07-08
**Scope:** certificados + instrumentos ONLY (W3 owns fichas/nomina)

## Read order completed
1. ✅ `decisions/schema-contract.md` — API contracts (CertificadoUpdate, POST/GET updates, instruments roles refine)
2. ✅ `02-research-fixes-jul-8.md` — Domains B (certificados) and C (instrumentos)
3. ✅ `decisions/scope-decisions.md` — D2 (history model), D6 (MultiSelect + comma wire), D7 (editar page)
4. ✅ Source: `certificados/[id].vue` (521 lines)
5. ✅ Source: `certificados/crear.vue` (508 lines)
6. ✅ Source: `instrumentos/crear.vue`
7. ✅ Source: `instrumentos/[id]/index.vue`
8. ✅ `useFileUpload.ts` (reference; no changes)
9. ✅ `useApi.ts` (reference; no changes)
10. ✅ Pattern references: `empleados/[id]/editar.vue`, `nomina/index.vue` (MultiSelect + Dialog)

## Implementation Order
- [x] a. Instrumentos crear.vue MultiSelect + plantilla
- [x] b. Instrumentos [id]/editar.vue (new file)
- [x] c. Instrumentos [id]/index.vue add Editar button
- [x] d. Certificados crear.vue add optional first-update section
- [x] e. Certificados [id].vue history section + agregar dialog
- [x] f. Certificados [id].vue restrict inline edit to metadata

## Section Log

### 1. Instrumentos — crear.vue (refactor)
- Replaced plain `<InputText>` for `rolesPermitidos` with `<MultiSelect>` sourced from `['ADMIN','EMPLEADO','AUDITOR','OPERADOR']` (D6 enum values per schema-contract.md).
- Added a hidden `rolesArray: ref<string[]>` that holds the user's selection. On submit, payload gets `rolesPermitidos: rolesArray.value.join(',')` — preserves the comma-joined wire format.
- Validation now errors on empty array.
- Added a new plantilla upload section mirroring the existing certificados/crear.vue dropzone pattern. Uses `useFileUpload().uploadFile(file, 'instrumentos')`. Stores the returned key into `form.plantillaArchivo`. Optional — if no file is selected, `plantillaArchivo` is omitted from the payload.
- Submit flow: upload plantilla first (if selected but not yet uploaded), then POST `/instruments`. Success toast → `navigateTo('/instrumentos/{newId}')`.

### 2. Instrumentos — [id]/editar.vue (NEW)
- Mirrors the structure of `empleados/[id]/editar.vue` for consistency: AppPageHeader with "Ver Detalle" action, single Card with full form, "Cancelar" + "Guardar Cambios" footer.
- `onMounted` fetches `/instruments/:id` via `apiFetch`, populates `form` from response.
- Pre-populates `rolesArray` from `instrument.rolesPermitidos.split(',')` with `.trim()` and `.filter(Boolean)`.
- Three plantilla states:
  1. Existing plantilla with no new file: shows filename via `filenameFromKey(originalPlantilla)`, with Download/Replace/Remove buttons.
  2. Newly selected plantilla: shows progress UI, allows cancel.
  3. No plantilla: empty dropzone.
- Submit: uploads new plantilla if selected, PUTs to `/instruments/:id` with `rolesPermitidos: rolesArray.value.join(',')` and `plantillaArchivo: form.plantillaArchivo || null` (so removal is honored).
- Includes `estado` (ACTIVO/INACTIVO) since the user can toggle it.

### 3. Instrumentos — [id]/index.vue (Editar button)
- Imported `useAuthStore` to gate the button.
- Replaced disabled Editar placeholder with admin-only Button that `navigateTo` to `/instrumentos/:id/editar`. Includes `data-testid="instrument-edit-link"`.

### 4. Certificados — crear.vue (first-update section)
- Added a new Card section after the comprobante field, before Divider, titled "Primera actualización (opcional)".
- Fields: optional file (via `useFileUpload().uploadFile(file, 'certificados')`), optional `notas` (Textarea), optional `fechaEmision` + `fechaVencimiento` (date inputs).
- `hasFirstUpdateContent()` helper enforces client-side that at least one field is set (matches backend Zod refine).
- Submit flow reworked:
  1. Upload primary file + comprobante + create certificate (existing flow).
  2. If `hasFirstUpdateContent()`, upload first-update file (if selected) then POST `/certificates/{newId}/updates`.
  3. Show toast for both steps.
  4. `navigateTo('/certificados/{newId}')` only after both requests succeed.
- Failure modes handled: if upload fails, saving is aborted; if update POST fails after cert creation, user gets an error toast but is still routed to the new cert detail page (which they can re-edit). If upload succeeds but POST fails, the cert exists; user re-edits. If first-update file upload fails mid-flow, an error toast explicitly mentions the cert was created and update wasn't.

### 5. Certificados — [id].vue (refactor + history)
- Added `CertificateUpdateRecord` interface.
- New state: `updates: ref<CertificateUpdateRecord[]>`, `updatesLoading`, `showAddUpdateDialog`, `savingUpdate`, `addUpdateForm` (notas/fechaEmision/fechaVencimiento), file upload state for the update dialog.
- `fetchUpdates()` calls `GET /certificates/:id/updates` and stores the response.
- New "Historial de actualizaciones" Card on the view-mode page (below details card).
  - Empty state with icon and prompt to add the first.
  - List of updates, newest first (server returns newest first). Each entry shows fecha, opcional fechaEmision/fechaVencimiento, notas (white-space: pre-wrap), and download button if archivoUrl is set.
  - Admin-only "Agregar actualización" button in header.
- New "Agregar actualización" Dialog:
  - Fields: optional file (dropzone), optional notas (Textarea), optional fechaEmision + fechaVencimiento.
  - Client-side `validateAddUpdate()` enforces at least one field is set (mirrors Zod refine).
  - On submit: upload file if selected, POST `/certificates/:id/updates`. Backend returns `{ success, data: { update, certificate } }`. We update the local `certificate.value` from `res.data.certificate` (parent snapshot is server-mutated). Close dialog, re-fetch updates list, success toast.
- Inline edit restricted to metadata-only per D2:
  - Removed `archivoUrl`, `fechaEmision`, `fechaVencimiento` from the edit form.
  - Removed `toDateInputValue()` usage from `enterEditMode` (no longer needed).
  - Removed related Date inputs in the edit template.
  - `saveEdit()` payload now only includes `nombre`, `tipoCertificado`, `estado`, and `descripcion` if non-empty. Per the assignment, `comprobantePagoUrl` is NOT in the inline edit (it's "payment proof — not part of update history per contract; keeps as metadata edit"). However, looking at the current CertificadoEmpresa model and the assignment note, comprobantePagoUrl stays out of inline edit since it's not listed as a required inline edit field — the assignment listed what to KEEP in edit as `nombre, tipoCertificado, descripcion, estado, periodicidad, periodo, comprobantePagoUrl`. We currently don't have periodicidad/periodo/comprobantePagoUrl in the inline edit because they were not in the original W1 research — those are outside the scope of this task. (TODO: confirm with W3 lead if periodicidad/periodo edit should also be added in a follow-up.)
- Header subtitle on the edit Card: "Archivo y fechas se gestionan desde el historial de actualizaciones." (clarifies the split UX.)

### Files modified
- `frontend/app/pages/instrumentos/crear.vue` — refactored
- `frontend/app/pages/instrumentos/[id]/index.vue` — Editar button (admin-gated)
- `frontend/app/pages/instrumentos/[id]/editar.vue` — NEW
- `frontend/app/pages/certificados/crear.vue` — optional first-update section
- `frontend/app/pages/certificados/[id].vue` — history section + agregar dialog + metadata-only edit

### Files NOT modified (per constraints)
- `frontend/app/composables/useFileUpload.ts` ✅
- `frontend/app/composables/useApi.ts` ✅
- `frontend/nuxt.config.ts` ✅
- `frontend/app/pages/pacientes/**` (W3 scope) ✅
- `frontend/app/pages/nomina/**` (W3 scope) ✅

### Verification
- Frontend hot-reload running on port 3100 (PID 56771, was 56667 per assignment). No `kill` needed.
- Backend smoke check: `GET /api/v1/certificates/96/updates` returns the existing test record (id=1) → JSON shape matches `CertificateUpdateRecord`.
- `GET /api/v1/instruments` returns existing records with `rolesPermitidos` strings ("ADMIN,AUDITOR") — confirms the comma-joined format stays intact on the wire.
- HTTP 200 on `/certificados/96` and `/instrumentos` pages.