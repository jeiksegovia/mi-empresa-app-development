# Task: B5 + B6 — Patient Instrument Selection & Ficha Status Dialog
**File modified**: `frontend/app/pages/pacientes/[id]/index.vue`

---

## Task Definition

### B5: Patient Instrument Assignment
Add UI inside Tab 1 (Fichas & Evaluaciones) to:
1. Show a searchable dropdown populated from `GET /api/v1/instruments?estado=ACTIVO&limit=100`
2. "Asignar Instrumento" button calling `POST /api/v1/patients/:id/fichas`
3. "Eliminar" (trash) button on each row where `estado === 'PENDIENTE'` calling `DELETE /api/v1/patients/:id/fichas/:fichaId`
4. Reload fichas after each mutation

### B6: Instrument Status Dialog with File Upload
Replace the old free-form status dialog with a transition-aware dialog:
1. Show current estado as a read-only Tag badge
2. Offer only valid next states via computed `transitionOptions`:
   - PENDIENTE → [COMPLETADO, VENCIDO]
   - COMPLETADO → [VENCIDO]
   - VENCIDO → (terminal state, no options, button disabled)
3. When transitioning to COMPLETADO:
   - Show a styled file-picker `<input type="file">` (hidden behind a label)
   - On submit: call `POST /api/v1/uploads/presigned-url` with `{ contentType, folder: 'fichas' }`
   - Direct PUT to the returned `uploadUrl` using native `fetch`
   - Pass the returned S3 `key` as `archivoCompletado` in the PATCH body
4. Call `PATCH /api/v1/patients/:id/fichas/:fichaId/status` with `{ estado, archivoCompletado? }`

---

## Plan

1. Read existing file and backend routes to understand data shapes
2. Add `Instrument` interface and `fetchInstruments()` function
3. Add B5 reactive state: `instruments`, `selectedInstrumentId`, `assigningInstrument`, `deletingFichaId`
4. Replace old `fichaForm` (free-form fields) with transition-focused form: `currentEstado`, `newEstado`
5. Add B6 state: `uploadedFile`, `uploadingFile`, `uploadedFileKey`
6. Add computed `availableTransitions`, `transitionOptions`, `requiresFileUpload`
7. Implement `assignInstrument()`, `deleteFicha()`, updated `openFichaDialog()`, `onFileSelected()`, new `handleFichaSubmit()`
8. Add "Asignar Instrumento" Card above the fichas DataTable in Tab 1
9. Add trash button column in fichas DataTable (conditional on `estado === 'PENDIENTE'`)
10. Replace old Ficha dialog with new B6 dialog
11. Switch `onMounted` to also call `fetchInstruments()`
12. Replace `alert()` calls with `useToast()` throughout

---

## Output Summary

### Changes Made

**Script section**
- Added `Instrument` interface (`id`, `nombreInstrumento`, `tipo`, `estado`)
- Added `const toast = useToast()` — replaces all `alert()` calls
- Added `fetchInstruments()` — calls `GET /instruments?estado=ACTIVO&limit=100`, reads `.data` from response
- Added B5 state: `instruments`, `selectedInstrumentId`, `assigningInstrument`, `deletingFichaId`
- Replaced old `fichaForm` (5 fields: estado, fechaCompletado, fechaVencimiento, etc.) with slim form (`id`, `currentEstado`, `newEstado`, `instrumentoNombre`)
- Removed old `estadoFichaOptions` static array (replaced by computed)
- Added `validTransitions` map (mirrors backend): `{ PENDIENTE: [...], COMPLETADO: [...], VENCIDO: [] }`
- Added computed `availableTransitions`, `transitionOptions`, `requiresFileUpload`
- Added file upload state: `uploadedFile`, `uploadingFile`, `uploadedFileKey`
- Added `assignInstrument()` — POST fichas, clear selection, reload, toast
- Added `deleteFicha(fichaId)` — DELETE fichas/:id (only shown for PENDIENTE), reload, toast
- Rewrote `openFichaDialog(ficha)` — sets `currentEstado`, clears `newEstado` and file state
- Added `onFileSelected(event)` — reads file from input, resets key
- Rewrote `handleFichaSubmit()` — 3-step flow: presigned URL → S3 PUT → PATCH status; guards for missing file when COMPLETADO
- Updated `onMounted` to call both `fetchPatient()` and `fetchInstruments()`
- Removed old `handleFichaSubmit()` that called `/instruments/records/:id` (PUT)

**Template section**
- Tab 1 now has two cards: "Asignar Instrumento" (new) + "Historial de Fichas" (existing, enhanced)
- "Asignar Instrumento" card: filterable PrimeVue `Select` (option-label=`nombreInstrumento`, option-value=`id`) + "Asignar Instrumento" button
- Fichas DataTable actions column: changed icon from `pi-eye` to `pi-pencil`; added `pi-trash` button with `v-if="data.estado === 'PENDIENTE'"` and per-row loading via `deletingFichaId`
- New B6 dialog (replaces old): shows current estado Tag; shows transition Select only if `availableTransitions.length > 0`, else shows terminal-state message; shows file picker section `v-if="requiresFileUpload"`; submit button disabled until newEstado selected and (if COMPLETADO) file attached

### Key Decisions
- `fetchInstruments` uses `(res as any).data` because the list endpoint returns `{ success, data, total, page }` at root level, not nested under `.data.data`
- File input is a native `<input type="file" class="hidden">` wrapped in a styled `<label>` — avoids PrimeVue FileUpload complexity while keeping consistent visual design
- The edit/status-change button is disabled for VENCIDO fichas (no valid transitions) rather than hiding it — gives visual feedback that the row exists but is terminal
- `deletingFichaId` tracks which specific ficha row is loading so multiple delete requests don't collide and the correct row shows a spinner
- `uploadedFileKey` ref is kept for potential future use (e.g. showing a link to the uploaded file)
- All `alert()` calls replaced with `useToast()` for consistent UX
