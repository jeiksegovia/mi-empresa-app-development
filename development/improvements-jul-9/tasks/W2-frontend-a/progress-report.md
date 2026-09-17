# W2 Frontend-a (Wave 1) — Progress Report

Worker: pt-frontend-eng (W2, wave 1)
Assignment: `task-assignment-wave1-ui.md`

## T6 — Cert create form cleanup (A1–A3)

### Status: COMPLETED

- Removed top block date inputs (fechaEmision, fechaVencimiento) and the Periodo `<input type="month">`.
- Removed top block file upload + comprobante dropzones (Archiv + Comprobante de pago).
- Removed related state vars and handlers (`selectedFile`, `selectedComprobante`, `onFileChange`, `onComprobanteChange`, …).
- Stop sending removed fields in `/certificates` POST body.
- Trimmed `useFileStash` + sessionStorage draft to only the first-update file blob + the 4 metadata fields.
- "Primera actualización" `<Card>` at the bottom unchanged.
- File: `frontend/app/pages/certificados/crear.vue`

## T7 — Empresa save bug (A6)

### Status: COMPLETED

Investigation: confirmed backend works (`PUT /api/v1/empresa/6` with admin session cookie persists correctly across reads). Bug is frontend-only — likely one or more of:
- Silent `if (!empresaId.value) return` (no toast, no feedback).
- Top-level synchronous `navigateTo('/empresa')` in setup racing auth-store hydration.
- Empty-field values silently dropped from payload, so a user who clears a field sees it "not persist".

Fix: moved role guard to `onMounted`, replaced silent return with visible toast, added basic client-side validation mirroring Zod, kept `nombre`/`nit` in payload always, ensure `submit` fires from `<form @submit.prevent>` with Enter.

File: `frontend/app/pages/empresa/editar.vue`

## T8 — Dropzone cursor (D4) + Contrato tab (D5)

### Status: COMPLETED

#### D4 (dropzone cursor + hover)
- `EmpleadoCertificadosEditor.vue`: input wrapped in clickable label.
- `nomina/index.vue`: two inputs (slot + "agregar otro") wrapped.
- `empleados/[id]/index.vue`: novedad archivo wrapped.
- `empleados/[id]/editar.vue`: contrato dialog archivo wrapped.
- Pattern: `<label class="… cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors">` with a hidden `<input type="file">` inside.

#### D5 (Contrato tab)
- `tabs` array extended: `{ label: 'Contrato laboral', icon: 'pi pi-file-edit' }` (now index 5).
- Card + Dialog removed from `activeTab === 2` (Info. Laboral).
- New panel `activeTab === 5` with the byte-for-byte same Card + Dialog (data-testids preserved).
- `empleados/nuevo.vue`: no Contrato exists in the wizard — nothing to mirror.
- W3 (T12) will layer `archivoFirmadoUrl` and the `cargo` select on top of this scaffold.
