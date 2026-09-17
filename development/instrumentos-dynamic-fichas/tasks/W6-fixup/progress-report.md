# W6-Fixup — Progress Report

> Worker: W6 (fullstack-impl)
> Task: #29 — Fix-up wave — QA bugs BUG-W5-01/02/03 + G2-12 + test tightening
> Source of truth: `task-assignment-fixup.md` + `../W5-qa-validation/gap-report.md` + contract §4.3 (G2-11/G2-12)

## Plan
1. **BUG-W5-03 (LOW)** — Delete dead `plantillaArchivo`/`versionPlantilla` from `frontend/app/pages/instrumentos/[id]/index.vue`
2. **G2-12 (backend)** — `versionRegistro` → optional in routes; service defaults to `v{version}` from resolved active version
3. **BUG-W5-01 (HIGH)** — Remove `payload.instrumentoVersionId = formDialogInstrument.value.id` alias from patient page `submitForm`
4. **BUG-W5-02 (MEDIUM)** — Result dialog: fetch definition via `GET /instruments/:codigo/definition` into dedicated `resultDefinition` ref
5. **Test tightening** — Remove W5 workarounds; add G2-12 contract test (POST without versionRegistro → 201, `versionRegistro === "v1"`)
6. **Regression** — 48/48 backend + 17/17 frontend; 4 modernized legacy specs

## Steps

### Step 1 — BUG-W5-03 (DONE)
Deleted `plantillaArchivo` (interface line 34) + `versionPlantilla` (interface line 35) + two
template refs (lines 204, 274) + dead comment (line 277). Verified via `grep` — zero hits.

### Step 2 — G2-12 (DONE)
- `createFichaSchema`: `versionRegistro` → `.optional()` + comment block updated.
- `loadActiveVersion`: now returns `version: number` (the integer).
- `createFichaAtomic`: when `input.versionRegistro` is missing/empty, defaults to
  `v${resolvedVersionNumber}` for both PENDIENTE assign and COMPLETADO branches.
- `completeFichaAtomic`: re-derives `versionRegistro` from active version if the existing row's
  value is missing/empty (handles pre-G2-12 assign rows).

### Step 3 — BUG-W5-01 (DONE)
Removed `payload.instrumentoVersionId = formDialogInstrument.value.id` alias line from
`submitForm` `assign` branch. Now sends only `instrumentoId + respuestas (+ notasObservaciones)`.
Comment updated to reference G2-11/G2-12 rationale.

### Step 4 — BUG-W5-02 (DONE)
- Added dedicated `resultDefinition` ref (separate from `formDefinition`).
- New `resolveInstrumentCodigo()` helper: ficha.instrumentoCodigo → fallback to instruments list.
- New `loadResultDefinition(codigo)` calls `GET /instruments/:codigo/definition`.
- `openResultDialog` now fetches definition into `resultDefinition` after fetching the ficha detail.
- Result dialog template guards on `resultDefinition` instead of `formDefinition`.
- `closeResultDialog` clears both refs.

### Step 5 — Test tightening (DONE)
- `frontend/tests/instruments-dynamic/fill-flow.spec.ts` real-backend describe:
  - Removed API POST workaround for BUG-W5-01 — test now drives the REAL UI submit path
    (open dialog → fill radios → click `[data-testid="form-submit"]`).
  - Removed "open assign dialog first" priming for BUG-W5-02 — test now clicks
    "Ver detalle" directly on the just-created COMPLETADO row.
  - Ficha cleanup happens via `page.request.delete` after the test captures fichaId.
- `backend/tests/instruments-dynamic/qa-contract.spec.ts`:
  - Added G2-12 contract test (case #6): POST without versionRegistro → 201,
    persisted `versionRegistro === "v1"`. Plus a round-trip GET assertion
    against the persisted row.

### Step 6 — Regression re-run (in_progress)
Run backend + frontend suites, capture verbatim outputs.