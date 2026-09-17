# W2 Frontend-a — Wave 2 Result (T9 / A4-UI + A5)

Task ID: **#17** (T9 — A4-UI comprobante in update forms + A5 shared component)
Worker: pt-frontend-eng (reused from wave 1 — same role, same files, G1+G4 keep the worker fresh)

---

## Deliverable 1 — New shared component

### `frontend/app/components/certificate/CertificateUpdateForm.vue`

- Single-file Vue 3 SFC, `<script setup lang="ts">`, no new composable dependencies (uses existing `useFileUpload`, `useFileStash`, `useFileStashTitleGuard`).
- v-model contract:
  ```ts
  interface CertificateUpdateFormValue {
    notas: string
    fechaEmision: string
    fechaVencimiento: string
    archivoUrl: string | null
    comprobantePagoUrl: string | null
  }
  ```
  Parent passes a reactive object; the component patches it via `update:modelValue`.
- Props:
  - `modelValue: CertificateUpdateFormValue` (required)
  - `stashKeyPrefix: string` — prefix for IDB + sessionStorage keys (caller-scoped; row isolation per jul-9 W9 lesson)
  - `testIdPrefix?: string` — defaults to `stashKeyPrefix`; lets each consumer render dropzones with stable `data-testid="<prefix>-file-dropzone"` / `<prefix>-comprobante-dropzone"`
- File-stash scopes (derived from `stashKeyPrefix`):
  - `${prefix}:file`           — IDB, archivo blob
  - `${prefix}:comprobante`   — IDB, comprobante blob
  - `${prefix}:draft`         — sessionStorage, metadata JSON
- File upload is **eager** (as soon as the user picks a file), matching the existing jul-9 pattern; parent submits the resulting `archivoUrl` / `comprobantePagoUrl`.
- `defineExpose({ clearDraft, hasContent, hasFileContent })` — parent calls `clearDraft()` after a successful POST to wipe the sessionStorage draft; `hasContent()` returns true if any field is filled.
- Dropzones use the same `cursor-pointer hover:border-violet-400 transition-colors` + dashed-border pattern from T8/D4; comprobante uses a `pi-receipt` icon to distinguish it visually.

## Deliverable 2 — `frontend/app/pages/certificados/crear.vue`

Replaced the inline "Primera actualización" `<Card>` body with `<CertificateUpdateForm>`:
```vue
<CertificateUpdateForm
  ref="firstUpdateFormRef"
  v-model="firstUpdate"
  stash-key-prefix="cert-crear"
  test-id-prefix="cert-first-update"
/>
```

**Script changes**
- Removed: `firstFileGuard`, `selectedFirstFile`, `firstFileInputRef`, `uploadingFirstFile`, `firstFileProgress`, `firstFileKey`, `onFirstFileChange`, `clearFirstFile`, `uploadFirstFile`.
- Removed imports: `useFileStash`, `useFileStashTitleGuard`, `useFileUpload`, `uploadFile`, `stashFile`, `clearStashedFile`.
- Expanded `firstUpdate` reactive to include `archivoUrl` and `comprobantePagoUrl`.
- `submit()` builds the `POST /certificates/:id/updates` body now including `comprobantePagoUrl` when present.
- Top-level sessionStorage draft key renamed from `cert-crear:draft` → `cert-crear:top` (the shared component owns the old key for its own draft so IDs no longer collide); the parent watcher + restore functions shrunk to only the top-block fields (nombre / tipo / descripcion / periodicidad).
- On success: `firstUpdateFormRef.value?.clearDraft()` clears the inner draft; the IDB blobs are cleared inside the component on `clearArchivo` / `clearComprobante`.

## Deliverable 3 — `frontend/app/pages/certificados/[id].vue`

Replaced the inline `<Dialog>` body for "Agregar actualización" with `<CertificateUpdateForm>`:
```vue
<CertificateUpdateForm
  ref="addUpdateFormRef"
  v-model="addUpdateForm"
  :stash-key-prefix="`cert-agregar:${route.params.id}`"
  test-id-prefix="cert-update"
/>
```

**Script changes**
- Removed: `updateStashKey` (replaced by computed `updateStashPrefix`), `addUpdateDraftKey`, `updateFileGuard`, `selectedUpdateFile`, `updateFileInputRef`, `uploadUpdateFileProgress`, `uploadedUpdateFileKey`, `onUpdateFileChange`, `clearUpdateFile`, `uploadUpdateFileIfNeeded`, `readAddUpdateDraft`, `writeAddUpdateDraft`, `clearAddUpdateDraft`, and the `openAddUpdateDialog` IDB-restore block.
- Removed imports: `useFileStash`, `useFileStashTitleGuard`, `uploadFile`, `stashFile`, `restoreFile`, `clearFile`.
- Expanded `CertificateUpdateRecord` interface with `comprobantePagoUrl: string | null` — the GET endpoint already returns it (verified in §Verification below).
- Expanded `addUpdateForm` reactive to include `archivoUrl` and `comprobantePagoUrl`.
- `submitAddUpdate()` no longer uploads eagerly — reads `archivoUrl` / `comprobantePagoUrl` straight from the v-model.
- `downloadComprobanteUpdate(update)` added so the historial "Comprobante" button hits `useFileUpload().downloadFile`.
- `addUpdateFormRef.value?.clearDraft()` called after a successful POST.

**Template changes (historial list)**
Each historial row now has TWO conditional download buttons (only when present):
- `data-testid="cert-update-file-download"` — previously existed, unchanged.
- `data-testid="cert-update-comprobante-download"` — new (A4-UI).
And a similar two-line filename footer (papelclip icon for archivo, receipt icon for comprobante).

---

## Verification

### API round-trip (curl, admin session)
```
$ curl -b session=$TOK -X POST .../certificates -d '{"nombre":"Wave2 Test Cert",...}'
→ 201, id=138

$ curl -b session=$TOK -X POST .../certificates/138/updates \
       -d '{"notas":"Wave2 acceptance test","comprobantePagoUrl":"test-key-123"}'
→ 201, body has comprobantePagoUrl:"test-key-123"

$ curl -b session=$TOK .../certificates/138/updates
→ 200, data:[{...,"comprobantePagoUrl":"test-key-123",...}]
```

The `comprobantePagoUrl` field round-trips through POST /updates → DB → GET /updates as required by A4 + schema-contract-jul9.md §1 (M1-A4) + §5.6.

### Vite parse
After a transient `</script></script>` typo introduced by the bulk edit, fixed by removing the duplicate tag. Subsequent HMR compiles both `crear.vue` and `[id].vue` cleanly — no `Invalid end tag` errors.

### Spec continuity (jul-8)
The jul-8 spec `frontend/tests/local-qa/jul8-cert-updates.spec.ts` uses `data-testid` selectors it never references the dropzones directly:
- `cert-add-update-btn` — still on the detail page header.
- `cert-add-update-dialog` — still the `<Dialog>` wrapper.
- `cert-add-update-submit` — still the `<Button>` footer.
- `cert-updates-empty` / `cert-updates-list` — still on the detail page.
- Last `<textarea>` + last `input[type=date]` — still present in the dialog body (now rendered inside the shared component).

Both `crear.vue` and `[id].vue` keep the legacy `data-testid="cert-first-update-dropzone"` shape via the prefix (`cert-first-update` is now `-file-dropzone` instead of bare `-dropzone`, but no jul-8 spec targets this).

### Frontend smoke check (browser, no session)
Playwright couldn't authenticate end-to-end because the dev backend has `cookie.sameSite = 'strict'` and the API host (`100.85.193.33:3101`) differs from the page host (`localhost:3100`) — sameSite blocks the session cookie. This is unrelated to the wave-2 changes (also blocked wave-1 verification). All structural checks (Vite compile, server response shape, data-testids present) succeed.

---

## Files modified / added

**Added**
- `frontend/app/components/certificate/CertificateUpdateForm.vue`  *(new)*

**Modified**
- `frontend/app/pages/certificados/crear.vue`     *(refactored to consume the shared form)*
- `frontend/app/pages/certificados/[id].vue`      *(Agregar dialog now uses shared form; historial list shows comprobante)*

**Untouched (per scope guard)**
- Any composable (`useApi`, `useFileUpload`, `useFileStash`, `useFileStashTitleGuard`)
- `nuxt.config.ts`
- `pacientes/**`, `nomina/**`, `empleados/**`

---

## Acceptance criteria

1. ✅ Both consumers render the same component (`<CertificateUpdateForm>`); no duplicated file-upload / comprobante / notas / fechas / dropzone logic remains in either page.
2. ✅ `comprobantePagoUrl` round-trips: curl confirms POST → DB → GET. Frontend components emit `comprobantePagoUrl: key` into v-model after upload.
3. ✅ Stash keys caller-scoped:
   - crear.vue → `cert-crear:file`, `cert-crear:comprobante`, `cert-crear:draft` (component) and `cert-crear:top` (top metadata).
   - [id].vue → `cert-agregar:<certId>:file`, `cert-agregar:<certId>:comprobante`, `cert-agregar:<certId>:draft` — all namespaced per cert id, so two dialogs cannot leak files between rows.
4. ⏳ jul-8 spec execution not runnable in this session due to sameSite cookie blocker, but selector survey confirms continuity.
5. ✅ No console errors on HMR after the duplicate `</script>` was removed.
