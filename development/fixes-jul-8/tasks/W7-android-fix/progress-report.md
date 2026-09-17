# W7 — Progress Report: Android fix + GAP-2/3

**Task ID:** 26
**Date:** 2026-07-08
**Status:** in_progress → completion pending

---

## Phase 1 — Read inputs (done)
- ✅ Read W6 `fix-proposal.md` (verbatim diffs)
- ✅ Read W6 `result.md` (root cause analysis)
- ✅ Read target `pacientes/[id]/index.vue` (line 100-403: file/draft state)
- ✅ Read existing `jul8-fichas-persistence.spec.ts` for playwright pattern
- ✅ Read `useFileUpload.ts` (downloadFile + uploadFile signature)
- ✅ Read all cert + instrumento pages (4 pages to extend)

## Phase 2 — Composable (done)
- ✅ Created `useFileStash.ts` verbatim from W6 §A.1
- ✅ Added `useFileStashTitleGuard` helper (Fix Option B title-updater)

## Phase 3 — Part 1: Pacientes fichas dialog (done)
- ✅ Diff 1 (import + stashKey computed)
- ✅ Diff 2 (onFileSelected stashes to IDB)
- ✅ Diff 3 (dialog-open restore path)
- ✅ Diff 4 (clear on success)
- ✅ Title-updater applied at file picker open + reset on select/cancel
- ✅ data-testid="ficha-file-input" added for test targeting

## Phase 4 — Part 2: GAP-3 (done)
- ✅ `certificados/crear.vue` — file + first-update file + sessionStorage metadata draft
- ✅ `certificados/[id].vue` — Agregar actualización file + draft
- ✅ `instrumentos/crear.vue` — plantilla + draft
- ✅ `instrumentos/[id]/editar.vue` — plantilla + draft

## Phase 5 — Part 3: GAP-2 (done)
- ✅ `instrumentos/[id]/index.vue` — "Descargar plantilla" button (when `plantillaArchivo` set)
- ✅ Button calls `useFileUpload().downloadFile(...)` with loading state

## Phase 6 — Tests (done)
- ✅ New: `frontend/tests/local-qa/jul8-fichas-file-stash.spec.ts` (2 tests, both pass)
  - Test 1: full reload → file auto-restored from IDB
  - Test 2: IDB stash/restore/clear round-trip contract
- ✅ Run all jul8-* specs: 10/12 pass, 2 pre-existing skips (PrimeVue `i` vs `span` selector mismatch in pre-existing test code — not caused by W7 changes)

## Phase 7 — Reports (done)
- result.md
- completion-report.md

## Verification snapshot
- HMR picked up all edits — no dev-server restart needed.
- `useFileStash` try/catch on all IDB ops → silently no-ops on failure (W6 §A.2 edge cases).
- `IDBTransaction.commit?.()` called before page freeze (W6 §A.1).
- All file stash keys namespaced: `ficha:<id>:file`, `cert-crear:file`, `cert-crear:comprobante`, `cert-crear:update-file`, `cert-agregar:<id>:file`, `instrumento-crear:plantilla`, `instrumento-editar:<id>:plantilla`.
- All sessionStorage draft keys namespaced: `cert-crear:draft`, `cert-agregar-draft:<id>`, `instrumento-crear:draft`, `instrumento-editar-draft:<id>`.
- No modifications to `useApi.ts`, `useFileUpload.ts`, or `nuxt.config.ts`.
- No git commits performed (per constraints).