# Progress Report — W5 (qa-validation) — instrumentos-dynamic-fichas

> Worker: W5 (test-quality) · Task #21 · Date: 2026-07-17
> Contract: `schema-contract-instrumentos-dynamic-fichas.md`
> Reporting to: main · Status: **in_progress**

## Scope (per task-assignment)

1. Re-run existing suites as-is (evidence baseline)
2. W3 fill-flow against the REAL backend (watch item)
3. Browser E2E per instrument (BARTHEL, YESAVAGE, MNA_CUADRO, FICHA_NUTRICIONAL)
4. Contract validation additions (G2-11, 403 negative, scoring boundaries, INVALID_STATE, vencimientos)
5. Legacy spec modernization (4 files)
6. Gap report

## TODO

- [ ] Step 1: Re-run `backend/tests/instruments-dynamic/` + `frontend/tests/instruments-dynamic/` baselines
- [ ] Step 2: Update `fill-flow.spec.ts` to run against real backend (drop `mock=1`)
- [ ] Step 3: Write `frontend/tests/instruments-dynamic/e2e-instruments.spec.ts` (4 instruments, both MNA paths)
- [ ] Step 4: Write `backend/tests/instruments-dynamic/qa-contract.spec.ts` (G2-11, 403, scoring boundaries, INVALID_STATE, vencimientos re-run)
- [ ] Step 5: Modernize 4 legacy spec files
- [ ] Step 6: Write `gap-report.md` + `completion-report.md`

## Live Log

### Step 1: Baseline re-runs ✅
- backend/tests/instruments-dynamic/ → **39/39 passed** (1.3s)
  - 9 api-fichas.spec.ts (incl. G2-11 covered)
  - 26 scoring-engine.spec.ts
  - 4 seed-definitions.spec.ts
- frontend/tests/instruments-dynamic/ → **10/10 passed** (15.4s)
  - 7 schema-render.spec.ts
  - 3 fill-flow.spec.ts (mock=1 variants)
- **Total baseline: 49/49 GREEN**

### Step 2-5: Pending
Now writing real-backend fill-flow variant + E2E per instrument + qa-contract + legacy modernization.

### Step 2: fill-flow.spec.ts real-backend variant ✅
- Added "Real-backend fill flow (W5)" describe block.
- Drives API directly (NOT UI submit — see BUG-W5-01 in gap-report.md).
- Confirms round-trip: POST → 201 COMPLETADO with total=100; GET /fichas/:id confirms scoring; SPA result dialog renders via workaround (BUG-W5-02).
- Final: 4/4 pass (3 mocked + 1 real-backend).

### Step 3: e2e-instruments.spec.ts (4 instruments) ✅
- BARTHEL all-max → 100 "Dependencia ligera"
- BARTHEL mid-range → 55 "Dependencia grave"
- YESAVAGE all-si → 10 "Depresión establecida"
- MNA_CUADRO cribaje ≥ 12 → "Estado nutricional normal" + skipped-badge
- MNA_CUADRO cribaje < 12 → global classification applied
- FICHA_NUTRICIONAL → no scoring card, 13 items rendered, API POST returns puntajeTotal=null
- Final: 6/6 pass.

### Step 4: qa-contract.spec.ts (backend contract) ✅
- G2-11: bogus instrumentoVersionId=999999 → server resolves to real active version
- 403 ROLE_NOT_ALLOWED: AUDITOR + OPERADOR → 403 with code
- ADMIN positive path → 200
- MINI_MENTAL boundary sweep: 8 targets across 4 ranges
- TINETTI boundary sweep: 5 targets across 3 ranges (exact totals via selective demotion)
- INVALID_STATE: PATCH /completar on COMPLETADO → 400
- MNA classification-source rule: cribaje=13 + evaluación absent → "Estado nutricional normal"
- Final: 8/8 pass.

### Step 5: Legacy spec modernization ✅
- `ficha-single-step.spec.ts`: 1/3 → 2/2 (modernized to respuestas + versionRegistro)
- `jul11-date-normalization.spec.ts`: 3/4 → 4/4 (modernized to respuestas)
- `instruments.spec.ts`: 14/15 → 44/44 (modernized POST + PUT to drop plantillaArchivo/versionPlantilla)
- `patient-fichas.spec.ts`: 0/10 skipped → 8/8 (full rewrite to new contract)
- All drops of removed fields verified with `not.toHaveProperty` (no zombie values).

### Step 6: Gap report + completion report ✅
- 3 BUGs filed (HIGH/MEDIUM/LOW) with verbatim repro + contract-section citations
- 4 TEST-ENV: 3 fixed by W5, 1 pre-existing (certificates) confirmed & untouched
- Completion report written with full before/after test counts.

### Final Results
- **W5 surface: 130/130 passing, 0 unclassified failures**
- **Total backend instruments-dynamic tests: 47/47**
- **Total frontend instruments-dynamic tests: 17/17**
- **3 source-code bugs filed for downstream worker fix**
