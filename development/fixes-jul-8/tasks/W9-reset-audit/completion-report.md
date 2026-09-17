# W9 — Completion report

## What was delivered

1. **Root-cause fix** in `frontend/app/pages/pacientes/[id]/index.vue`:
   - `stashKey` changed from `ficha:${route.params.id}:file` →
     `ficha:${route.params.id}:${fichaForm.id || 'new'}:file`.
   - `openFichaDialog()` now resets `uploadedFile`, `uploadedFileName`,
     `uploadedFileKey` at the very top, before reading the draft or
     calling `restoreFile()`.

2. **Two minor cosmetic hardening touch-ups**:
   - `frontend/app/pages/empleados/[id]/editar.vue` — clear
     `contratoArchivoInputRef.value.value` in `resetContratoForm()`.
   - `frontend/app/pages/certificados/[id].vue` — clear
     `updateFileInputRef.value.value` in `openAddUpdateDialog()`.

3. **New regression spec** `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts`:
   - Test #1: opening ficha #2's dialog after picking a file in
     ficha #1's dialog → no filename leak, no IDB cross-ficha write.
   - Test #2: opening two fresh ficha dialogs on a clean patient →
     both have empty file input ("Seleccionar archivo").

4. **Updated existing test** `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts`:
   - Updated `stashKey` assertion to use the ficha-scoped key.
   - Tightened pencil-button selector to `table button:has(span.pi-pencil)`
     so it ignores the page-header "Editar" button (same icon).
   - Created a scratch patient so the table only contains the test's
     own fichas (avoids the seeded patient 72 which had 50+ fichas).

5. **Audit report** (`audit-report.md`) covers every page under
   `frontend/app/pages/` with a verdict per page.

6. **Progress + result + completion reports** written.

## Test results

```
Running 19 tests using 1 worker
17 passed (49.3s)   [2 pre-existing skips unrelated to W9]
```

The new spec passes, the updated existing spec passes, and no other
spec regressed.

## Constraints respected

- Backend :3101 untouched.
- Frontend :3100 HMR was not broken (auto-reload handled the fix).
- Did NOT modify `useApi.ts`, `useFileUpload.ts`, `useFileStash.ts`,
  or `nuxt.config.ts`.
- Did NOT `git commit`.

## Files I touched

- frontend/app/pages/pacientes/[id]/index.vue
- frontend/app/pages/empleados/[id]/editar.vue
- frontend/app/pages/certificados/[id].vue
- frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts (new)
- frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts (updated)

## Files I created in this task directory

- progress-report.md
- audit-report.md
- result.md
- completion-report.md (this file)
