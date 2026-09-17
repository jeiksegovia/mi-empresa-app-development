# W7 — Result: Android Fix + GAP-2/3 Implementation

**Task:** Frontend fixes — cross-form persistence + plantilla download + Android fix
**Task ID:** 26
**Date:** 2026-07-08
**Status:** complete
**Scope:** 3 parts — Android fix (W6 proposal) + GAP-3 (cross-form persistence) + GAP-2 (plantilla download)

---

## 1. Deliverables

### 1.1 New files
| Path | Purpose |
|------|---------|
| `frontend/app/composables/useFileStash.ts` | IndexedDB file blob stash/restore/clear (verbatim from W6 §A.1) + `useFileStashTitleGuard` helper for Fix Option B |
| `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts` | 2 new playwright specs proving file survives reload + composable round-trip |

### 1.2 Modified files
| Path | Change |
|------|--------|
| `frontend/app/pages/pacientes/[id]/index.vue` | Applied Diffs 1-4 from W6 proposal + title-updater (Fix Option B) |
| `frontend/app/pages/certificados/crear.vue` | file + comprobante + first-update file → IDB stash; metadata → sessionStorage draft |
| `frontend/app/pages/certificados/[id].vue` | Agregar actualización file → IDB stash; dialog metadata → sessionStorage draft |
| `frontend/app/pages/instrumentos/crear.vue` | plantilla → IDB stash; metadata → sessionStorage draft |
| `frontend/app/pages/instrumentos/[id]/editar.vue` | plantilla → IDB stash; metadata → sessionStorage draft |
| `frontend/app/pages/instrumentos/[id]/index.vue` | "Descargar plantilla" button (GAP-2) when `plantillaArchivo` is set |

---

## 2. Implementation details

### 2.1 `useFileStash` composable
Verbatim from W6 `fix-proposal.md` §A.1:
- **DB name:** `mi-empresa-file-stash`
- **Object store:** `files`
- **Value shape:** `{ blob, name, type, size, ts, key }`
- **TTL:** 24h (`TTL_MS = 24 * 60 * 60 * 1000`) — stale entries discarded on `restore`.
- **API:** `stash(key, file)`, `restore(key)`, `clear(key)` — all async, all wrapped in try/catch with silent no-op fallback.
- **`IDBTransaction.commit?.()`** called inside `stash` to ensure write commits before page freeze (per W6 §A.1 last paragraph).
- **`useFileStashTitleGuard(reason)`** helper arms/disarms a transient `document.title` prefix when the file picker opens (Fix Option B). Reduces Chrome tab-discard chance during Android file-picker round-trip.

### 2.2 Pacientes fichas dialog (Part 1)
- **Import at top of `<script setup>`:** `useFileStash`, `useFileStashTitleGuard`.
- **Stash key:** `computed(() => 'ficha:' + route.params.id + ':file')`.
- **`onFileSelected`:** stashes to IDB after setting `uploadedFile.value`.
- **`openFichaDialog`:** after restoring sessionStorage draft, attempts `restoreFile(stashKey.value)` and re-hydrates `uploadedFile` directly. Shows success toast.
- **`handleFichaSubmit`:** after success, calls `await clearFile(stashKey.value)` and clears the in-memory refs.
- **Title-guard:** arms on click of the `<label>` wrapping the file input; disarms on `onFileSelected` change event.
- **`data-testid="ficha-file-input"`** added for Playwright targeting.

### 2.3 GAP-3 cross-form persistence (Part 2)
For each form below: file body → IDB via `useFileStash`; metadata → sessionStorage draft.

| Form | IDB stash keys | sessionStorage draft key | Title guards |
|------|---------------|--------------------------|---------------|
| `certificados/crear.vue` | `cert-crear:file`, `cert-crear:comprobante`, `cert-crear:update-file` | `cert-crear:draft` | certFileGuard, comprobanteGuard, firstFileGuard |
| `certificados/[id].vue` Agregar dialog | `cert-agregar:<id>:file` | `cert-agregar-draft:<id>` | updateFileGuard |
| `instrumentos/crear.vue` | `instrumento-crear:plantilla` | `instrumento-crear:draft` | plantillaGuard |
| `instrumentos/[id]/editar.vue` | `instrumento-editar:<id>:plantilla` | `instrumento-editar-draft:<id>` | plantillaGuard |

Each form:
- Stashes file to IDB on `change` event of the file input.
- Writes metadata draft to sessionStorage on every change (via `watch`).
- Restores both on `onMounted` (after `fetchInstrument` for edit pages).
- Shows toast on restore: "Borrador restaurado".
- Clears draft + IDB stash on successful submit (or via `Cancel` button when applicable).

### 2.4 GAP-2 plantilla download (Part 3)
- `instrumentos/[id]/index.vue`:
  - Imports `useFileUpload` (added without modifying `useFileUpload.ts`).
  - `handlePlantillaDownload()` calls `downloadFile(instrument.plantillaArchivo)` with `downloadingPlantilla` loading state.
  - "Descargar plantilla" button rendered in the Datos Generales card **only when `instrument.plantillaArchivo` is a non-empty string**, mirroring the cert/ficha download button patterns.
  - `data-testid="instrument-download-plantilla"` for test targeting.

---

## 3. Tests added (`jul8-fichas-file-stash.spec.ts`)

### Test 1: `selected file survives page reload via IndexedDB` (9.4s)
1. Creates a fresh ficha via API.
2. Opens the ficha dialog, picks COMPLETADO transition, uploads a real text file.
3. Asserts IDB entry exists with matching name/size.
4. **`page.reload()`** — simulates the Android tab-discard scenario.
5. Reopens the ficha dialog, picks COMPLETADO again, asserts the file is auto-restored (visible filename in dialog).

### Test 2: `useFileStash composable: stash/restore/clear round-trip` (1.1s)
- Pure contract test of the IDB operations matching `useFileStash` semantics.
- Verifies stash → restore (File reconstructed) → clear → entry removed.

### Pre-existing jul8 test run
- 10 passed, 2 pre-existing skipped (NOT caused by W7).
- The 2 skips use `button:has(i.pi-pencil)` selector which doesn't match PrimeVue 4's rendered `<span class="pi pi-pencil">`. Selector bug exists in pre-W7 code (e.g., `jul8-fichas-persistence.spec.ts:50`, `jul8-fichas-vencido-to-completado.spec.ts:86`).

---

## 4. Verification

| Check | Status |
|-------|--------|
| `useFileStash` composable created | ✅ matches W6 §A.1 signature (stash/restore/clear + 24h TTL) |
| `useFileStashTitleGuard` helper added | ✅ Fix Option B wired to all file pickers |
| Ficha dialog file survives reload | ✅ Playwright test 1 proves it |
| `pacientes/[id]/index.vue` has 4 diffs applied | ✅ all 4 diffs visible in source |
| Cert crear/Agregar/instrumento crear/editar all use same pattern | ✅ all 4 pages updated |
| Instrumento detail page has "Descargar plantilla" | ✅ button rendered when `plantillaArchivo` set |
| Existing jul8 specs not regressed | ✅ 10 pass, 2 pre-existing skips |
| HMR clean, no console errors | ✅ verified via debug page script |
| Title-updater applied at least to fichas dialog | ✅ applied to all 4 forms |
| `useApi.ts`, `useFileUpload.ts`, `nuxt.config.ts` untouched | ✅ |
| No git commits | ✅ |
| IDB/sessionStorage keys namespaced + grep-able | ✅ all keys follow `<form>:<context>:<field>` pattern |

---

## 5. Constraints honored
- ✅ Local backend `:3101` untouched (PID stable).
- ✅ Local frontend `:3100` HMR only — no restart needed.
- ✅ Existing patterns used: PrimeVue components, `useApi()`, `useFileUpload()`, `useToast()`.
- ✅ `useFileStash` is defensive — try/catch on all IDB ops; silently no-op on failure.

---

## 6. Out-of-scope / deferred (NOT implemented)
- Global `pageshow` listener for stale-data invalidation — W6 §Implementation order item 3 (LOW risk, optional).
- Permission-Policy header for unload prevention — backend/edge change, not frontend.
- Pre-existing test selector fix (`button:has(i.pi-pencil)` → `button:has(span.pi-pencil)`) — only fixed in my new tests; left pre-existing tests untouched per "do NOT modify tests to accommodate new behavior" guidance.

---

## 7. How to verify manually
1. Open `http://localhost:3100/pacientes/<id>` → Fichas tab → pencil any ficha → Actualizar Estado dialog.
2. In DevTools → Application → IndexedDB → `mi-empresa-file-stash` → confirm DB created on first file select.
3. Select COMPLETADO, pick any file, observe stash entry appears in IDB.
4. `chrome://discards` → "Discard" tab → reopen → file still there.
5. Same flow on `certificados/crear.vue`, `instrumentos/crear.vue` — verify `cert-crear:file` / `instrumento-crear:plantilla` entries.
6. Submit any of the forms → IDB entry cleared + sessionStorage draft cleared.