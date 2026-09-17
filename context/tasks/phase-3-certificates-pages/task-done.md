# Task: B7 — Certificates Module Frontend Pages

## Task Definition
Implement three frontend pages for the Certificates module:
- B7a: Rewrite `certificados/index.vue` — list page with stats, DataTable, filters, admin delete
- B7b: Create `certificados/[id].vue` — detail page with view/edit modes and file download
- B7c: Create `certificados/crear.vue` — create form with presigned URL file upload

## Plan
1. Read existing stub `certificados/index.vue` and reference pages (instrumentos, pacientes)
2. Rewrite `index.vue` with full list implementation
3. Create `[id].vue` detail page
4. Create `crear.vue` create form page

## Files Produced
- `frontend/app/pages/certificados/index.vue` — rewritten
- `frontend/app/pages/certificados/[id].vue` — new
- `frontend/app/pages/certificados/crear.vue` — new

## Output Summary

### B7a: certificados/index.vue
- Stats row: 4 cards (Vigentes/success, Vencidos/danger, Pendientes/warn, Total/primary)
- Fetches from `GET /certificates/stats` endpoint
- DataTable columns: Nombre, Tipo, Estado (Tag badge), Fecha Vencimiento, Creado por, Acciones
- Filter bar: search input (debounced 400ms), tipo Select, estado Select
- "Nuevo Certificado" button shown only when `authStore.isAdmin`
- Row actions: View (pi-eye) navigates to `/certificados/:id`; Delete (pi-trash, admin only) opens inline Dialog confirmation
- Delete flow: Dialog → `DELETE /certificates/:id` → refreshes list + stats
- Subtitle changed from "certificados médicos" to "Certificados de empresa"
- Pagination with prev/next buttons

### B7b: certificados/[id].vue
- Loads `GET /certificates/:id` on mount
- Loading spinner, error state with back button
- Summary card showing name, tipo tag, estado badge, dates, createdBy
- Details card with grid layout: tipo, estado, fechaEmision, fechaVencimiento, creadorNombre, fechaRegistro, descripcion
- "Descargar Archivo" button (shown when archivoUrl exists): calls `GET /uploads/download-url?key=:archivoUrl`, opens `downloadUrl` in new tab
- "Editar" button (admin only) switches to inline edit mode using same page
- Edit form fields: nombre, tipoCertificado (Select), estado (Select), fechaEmision (date input), fechaVencimiento (date input), descripcion (Textarea)
- Edit submits via `PUT /certificates/:id`, updates local state on success
- Cancel edit returns to view mode without refetch

### B7c: certificados/crear.vue
- Form fields: nombre (required), tipoCertificado Select (required), descripcion Textarea (optional), fechaEmision date input (optional), fechaVencimiento date input (optional)
- File upload section: drag-click area when no file selected; file info row with name/size and status icon when selected
- Upload flow on submit: `POST /uploads/presigned-url` → `PUT uploadUrl` with file body → stores returned key as archivoUrl
- File upload state machine: idle | uploading | done | error
- Submit: `POST /certificates` with assembled payload; navigates to `/certificados` on success
- Cancel navigates back to `/certificados`

## Key Decisions
- Used inline `Dialog` component for delete confirmation (no `useConfirm` — not used anywhere in codebase)
- Used native `<input type="date">` consistently with other pages (pacientes pattern)
- Used `Textarea` PrimeVue component (consistent with pacientes/crear.vue pattern)
- Edit mode is inline on the same detail page (no separate `/editar` route) as specified
- File already uploaded in a prior run is cached in `uploadedKey` ref; re-submit reuses the key without re-uploading
- `authStore.isAdmin` from `~/stores/auth` used for all admin-only UI conditionals
- estadoSeverity helper function maps VIGENTE→success, VENCIDO→danger, PENDIENTE→warn

## Estado Badge Colors
| Estado   | Severity  | Color  |
|----------|-----------|--------|
| VIGENTE  | success   | green  |
| VENCIDO  | danger    | red    |
| PENDIENTE| warn      | orange |
