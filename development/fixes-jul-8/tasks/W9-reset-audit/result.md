# W9 — File-reset audit + fixes — result

## Outcome

**Bug fixed.** New regression spec added. Full jul8 suite still passes.

## Verdict per acceptance criterion

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Ficha dialog: switching between fichas on the same patient page shows a CLEAN file input every time | ✓ — verified via `jul8-ficha-file-reset.spec.ts` test #1 |
| 2 | Existing playwright specs still pass (`jul8-fichas-*.spec.ts`, `jul8-*.spec.ts`) | ✓ — 17 passed, 2 unrelated skips |
| 3 | New spec proves no leak | ✓ — `jul8-ficha-file-reset.spec.ts` |
| 4 | Audit report enumerates every page with a clear status | ✓ — see `audit-report.md` |
| 5 | Any other leak found is either fixed or reported as safe-to-defer | ✓ — 1 leak fixed, 2 cosmetic touch-ups, 0 deferred |

## Files changed

- `frontend/app/pages/pacientes/[id]/index.vue`
  - `stashKey` now includes `fichaForm.id`.
  - `openFichaDialog()` now resets `uploadedFile`, `uploadedFileName`,
    `uploadedFileKey` at the very top, before reading the draft and
    awaiting `restoreFile()`.
  - Added explanatory comments.
- `frontend/app/pages/empleados/[id]/editar.vue`
  - `resetContratoForm()` now also clears
    `contratoArchivoInputRef.value.value` (cosmetic hardening).
- `frontend/app/pages/certificados/[id].vue`
  - `openAddUpdateDialog()` now also clears
    `updateFileInputRef.value.value` (cosmetic hardening).
- `frontend/tests/local-qa/jul8-ficha-file-reset.spec.ts` — NEW.
- `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts`
  - Updated `stashKey` assertion to use the ficha-scoped key.
  - Updated pencil-button selector to `table button:has(span.pi-pencil)`
    (scoped to table rows; excludes the page-header "Editar" button).
  - Switched to creating a scratch patient so the DataTable only contains
    fichas owned by this test (avoids cross-test pollution on the seeded
    patient 72 which had 50+ fichas).

## Files NOT changed (per constraint)

- `frontend/app/composables/useApi.ts` — untouched.
- `frontend/app/composables/useFileUpload.ts` — untouched.
- `frontend/app/composables/useFileStash.ts` — untouched.
- `frontend/nuxt.config.ts` — untouched.

## Test run

```
Running 19 tests using 1 worker
✓  1 [chromium] › tests/local-qa/jul8-cert-crear-with-update.spec.ts
✓  2 [chromium] › tests/local-qa/jul8-cert-crear-with-update.spec.ts
✓  3 [chromium] › tests/local-qa/jul8-cert-updates.spec.ts
✓  4 [chromium] › tests/local-qa/jul8-ficha-file-reset.spec.ts  ← NEW
✓  5 [chromium] › tests/local-qa/jul8-ficha-file-reset.spec.ts  ← NEW
✓  6 [chromium] › tests/local-qa/jul8-fichas-file-stash.spec.ts  ← updated to new key
✓  7 [chromium] › tests/local-qa/jul8-fichas-file-stash.spec.ts
-   8 [chromium] › tests/local-qa/jul8-fichas-persistence.spec.ts (pre-existing skip)
✓  9 [chromium] › tests/local-qa/jul8-fichas-vencido-to-completado.spec.ts
-  10 [chromium] › tests/local-qa/jul8-fichas-vencido-to-completado.spec.ts (pre-existing skip)
✓ 11-14 [chromium] › tests/local-qa/jul8-instrumentos-*.spec.ts
✓ 15-19 [chromium] › tests/local-qa/jul8-nomina-*.spec.ts

17 passed (49.3s)
```

## Constraints respected

- Local frontend :3100 NOT touched (HMR never broke).
- Backend :3101 untouched.
- No useApi / useFileUpload / useFileStash / nuxt.config edits.
- No `git commit`.
- Existing tests updated ONLY where the key shape changed (i.e. the
  contract was modified by the bug fix itself).

## What the regression test catches

Without the fix, the test `opening ficha #2 dialog does not leak ficha #1 file`
would fail at:
1. `expect(leak, ...)` — ficha-A's filename would be visible inside
   ficha-B's dialog because the IDB stash returned the previous file.
2. `staleEntry` would NOT be null — IDB still has the un-scoped
   `ficha:<patient>:file` entry written by ficha-A's stash.

With the fix:
- The stash key is `ficha:<patient>:<fichaId>:file` per ficha.
- `openFichaDialog()` nulls the in-memory state before any restore.
- The test passes.
