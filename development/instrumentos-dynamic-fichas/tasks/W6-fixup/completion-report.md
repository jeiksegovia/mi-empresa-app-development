# W6-Fixup — Completion Report

> Worker: W6 (fullstack-impl) · Task: #29 · Date: 2026-07-17
> Source of truth: `task-assignment-fixup.md` + `../W5-qa-validation/gap-report.md` + contract §4.3 (G2-11/G2-12)

## Deliverables

| Path | Change |
|---|---|
| `backend/src/routes/patients.routes.ts` | `createFichaSchema.versionRegistro` → `.optional()` + G2-12 header comment block |
| `backend/src/services/patientService.ts` | `loadActiveVersion` returns `version: number`; `createFichaAtomic` defaults `versionRegistro` to `v{resolvedVersion}` when caller omitted; `completeFichaAtomic` re-derives for legacy assign rows; `CreateFichaInput.versionRegistro` → optional |
| `frontend/app/pages/instrumentos/[id]/index.vue` | Deleted `plantillaArchivo` (interface L34) + `versionPlantilla` (interface L35) + two template refs (L204, L274) + dead W3 comment (L125, L277) |
| `frontend/app/pages/pacientes/[id]/index.vue` | Removed `payload.instrumentoVersionId = formDialogInstrument.value.id` alias from `submitForm` assign branch (BUG-W5-01); added dedicated `resultDefinition` ref + `resolveInstrumentCodigo` + `loadResultDefinition` helpers + template guard on `resultDefinition` (BUG-W5-02); `closeResultDialog` clears both refs |
| `frontend/tests/instruments-dynamic/fill-flow.spec.ts` | Real-backend describe block now drives the REAL UI submit path (open dialog → fill radios → click `form-submit`) — removed API POST workaround (BUG-W5-01); removed "open assign dialog first" priming for BUG-W5-02 (clicks "Ver detalle" directly on the just-created COMPLETADO row) |
| `backend/tests/instruments-dynamic/qa-contract.spec.ts` | Added test case #6 — `G2-12: POST without versionRegistro → 201, persisted "v1"` + round-trip GET assertion |

## Per-bug: BEFORE → AFTER

### BUG-W5-01 (HIGH — patient page submit 400)
**BEFORE** (gap-report.md step 7): patient page submit clicked → dialog stays open; toast shows "Validation error"; backend log: `POST /api/v1/patients/<id>/fichas → 400 INVALID_ANSWER_PAYLOAD`.

**AFTER** (verbatim from `fill-flow.spec.ts` real-backend describe run):
```
✓  10 [chromium] › tests/instruments-dynamic/fill-flow.spec.ts:190:3 › Real-backend fill flow (W6) › BARTHEL real-backend: UI submit path → result dialog renders persisted total (4.2s)
```
The test exercises the REAL UI path: open assign dialog → fill 10 radios → click `[data-testid="form-submit"]` → dialog closes → ficha persists COMPLETADO → result dialog renders total=100, classification="Dependencia ligera" with no API POST workaround.

### BUG-W5-02 (MEDIUM — result dialog empty without prior form open)
**BEFORE** (gap-report.md step 4): clicking "Ver detalle" on a COMPLETADO row → dialog opens with "Esta ficha no tiene respuestas registradas (estado COMPLETADO)."

**AFTER** (same test, verbatim):
```
✓  10 [chromium] › tests/instruments-dynamic/fill-flow.spec.ts:190:3 › Real-backend fill flow (W6) › BARTHEL real-backend: UI submit path → result dialog renders persisted total (4.2s)
```
The test asserts `page.getByTestId('ficha-view-result').first().click()` directly after submit (no "open assign dialog first" priming). The result dialog fetches definition via `GET /instruments/BARTHEL/definition` into `resultDefinition` and renders `result-total=100`, `result-classification="Dependencia ligera"`.

### BUG-W5-03 (LOW — dead interface field)
**BEFORE**:
```
$ grep -n 'plantillaArchivo\|versionPlantilla' frontend/app/pages/instrumentos/\[id\]/index.vue
34:  plantillaArchivo: string | null
35:  versionPlantilla: string
204:                  {{ instrument.versionPlantilla }}
274:                <p class="font-medium font-mono">{{ instrument.versionPlantilla }}</p>
277:              <!-- W3: plantillaArchivo removed (contract §3.2). -->
```
**AFTER**:
```
$ grep -n 'plantillaArchivo\|versionPlantilla' frontend/app/pages/instrumentos/\[id\]/index.vue
(no output — zero hits)
```

### G2-12 (contract addendum — versionRegistro optional, server-derived)
**BEFORE**: `versionRegistro: z.string().min(1).max(20)` required on POST. Sending nothing → 400.

**AFTER** (verbatim from `qa-contract.spec.ts`):
```
✓  18 tests/instruments-dynamic/qa-contract.spec.ts:453:3 › W5 — qa-contract validations › G2-12: POST without versionRegistro → 201, persisted "v1" (28ms)
```
The test sends POST without `versionRegistro`, asserts:
- `status === 201`
- `body.data.estado === 'COMPLETADO'`
- `body.data.puntajeTotal === 100`
- `body.data.clasificacion === 'Dependencia ligera'`
- `body.data.versionRegistro === 'v1'` (server-derived)
- `body.data.instrumentoVersionId === barthelVersionId`
- Round-trip GET `versionRegistro === 'v1'`

## Regression — verbatim outputs

### Backend — instruments-dynamic suite (48/48 incl. new G2-12)
```
Running 48 tests using 1 worker
  ✓   1 tests/instruments-dynamic/api-fichas.spec.ts:92:3 › W4 — API endpoints for dynamic instruments › GET /instruments → 200, includes activeVersion metadata (§4.1) (15ms)
  ✓   2 tests/instruments-dynamic/api-fichas.spec.ts:112:3 › GET /instruments/BARTHEL/definition → 200 with full definition (§4.2) (14ms)
  ...
  ✓   9 tests/instruments-dynamic/api-fichas.spec.ts:268:3 › GET /patients/:id/fichas/:fichaId → 200 with respuestas + scoring + version (§4.4) (35ms)
  ✓  10 tests/instruments-dynamic/qa-contract.spec.ts:135:3 › G2-11: POST with bogus instrumentoVersionId → 201, version id matches real active (27ms)
  ✓  11 tests/instruments-dynamic/qa-contract.spec.ts:166:3 › 403 ROLE_NOT_ALLOWED: AUDITOR → GET /instruments/BARTHEL/definition (8ms)
  ✓  12 tests/instruments-dynamic/qa-contract.spec.ts:179:3 › ADMIN → GET /instruments/BARTHEL/definition → 200 (positive path) (10ms)
  ✓  13 tests/instruments-dynamic/qa-contract.spec.ts:192:3 › OPERADOR → GET /instruments/BARTHEL/definition → 403 (other non-allowed role) (80ms)
  ✓  14 tests/instruments-dynamic/qa-contract.spec.ts:215:3 › MINI_MENTAL boundary sweep (26/27, 23/24, 11/12, 8/9) (150ms)
  ✓  15 tests/instruments-dynamic/qa-contract.spec.ts:268:3 › TINETTI boundary sweep (24/25, 18/19) (107ms)
  ✓  16 tests/instruments-dynamic/qa-contract.spec.ts:359:3 › INVALID_STATE: PATCH completar on already-COMPLETADO → 400 (45ms)
  ✓  17 tests/instruments-dynamic/qa-contract.spec.ts:397:3 › MNA_CUADRO classification-source rule: cribaje ≥ 12 + evaluación absent → "Estado nutricional normal" (20ms)
  ✓  18 tests/instruments-dynamic/qa-contract.spec.ts:453:3 › G2-12: POST without versionRegistro → 201, persisted "v1" (28ms)
  ... (scoring-engine 19–44 all ✓; seed-definitions 45–48 all ✓)
  48 passed (2.1s)
```

### Backend — modernized legacy specs (53/53, 4 pre-existing skips)
```
Running 57 tests using 1 worker
  ✓  44 tests/patients/ficha-single-step.spec.ts:101:3 › Ficha single-step C1 (jul-10, modernized W5) › POST sin respuestas → legacy PENDIENTE (16ms)
  ✓  45 tests/patients/ficha-single-step.spec.ts:122:3 › POST con respuestas (BARTHEL all-max) → single-step COMPLETADO (47ms)
  ✓  46 tests/patients/jul11-date-normalization.spec.ts:68:3 › note with ISO-timestamp fechaIncidente is accepted (B2) (12ms)
  ✓  47 tests/patients/jul11-date-normalization.spec.ts:87:3 › single-step ficha with ISO-timestamp fechaVencimiento is accepted (B1) (18ms)
  ✓  48 tests/patients/jul11-date-normalization.spec.ts:125:3 › plain YYYY-MM-DD dates still accepted (no regression) (9ms)
  ✓  49 tests/patients/jul11-date-normalization.spec.ts:138:3 › garbage date strings still rejected with 400 (4ms)
  ✓  50 tests/patients/patient-fichas.spec.ts:132:5 › POST /api/v1/patients/:id/fichas - Create ficha › should create a ficha in PENDIENTE state (19ms)
  ✓  51 tests/patients/patient-fichas.spec.ts:167:5 › PATCH completar › should complete fichaId via PATCH /completar with respuestas (17ms)
  ✓  52 tests/patients/patient-fichas.spec.ts:186:5 › PATCH completar › should return 400 INVALID_STATE when completing already-COMPLETADO ficha (8ms)
  ✓  53 tests/patients/patient-fichas.spec.ts:204:5 › PATCH /status › should create a second ficha (fichaId2) for VENCIDO transition test (17ms)
  ✓  54 tests/patients/patient-fichas.spec.ts:221:5 › PATCH /status › should transition fichaId2 from PENDIENTE to VENCIDO via /status (18ms)
  ✓  55 tests/patients/patient-fichas.spec.ts:238:5 › DELETE › should create a third ficha (fichaId3) in PENDIENTE state (19ms)
  ✓  56 tests/patients/patient-fichas.spec.ts:255:5 › DELETE › should delete fichaId3 (PENDIENTE state) (9ms)
  ✓  57 tests/patients/patient-fichas.spec.ts:267:5 › DELETE › should return 400 when trying to delete fichaId2 (already VENCIDO) (6ms)
  4 skipped
  53 passed (1.7s)
```
The 4 skipped tests are `instruments.spec.ts` lines 418, 441, 490, 506 — pre-existing fixture-chain skips (each `test.skip()` triggered when its prerequisite `createdInstrumentId`/`createdRecordId` was undefined; verified via grep). Not regressions caused by this task.

### Frontend — instruments-dynamic suite (17/17)
```
TEST_FRONTEND_URL=http://100.85.193.33:3100 \
TEST_API_URL=http://100.85.193.33:3101/api/v1 \
  npx playwright test tests/instruments-dynamic/

Running 17 tests using 1 worker
  ✓   1 e2e-instruments.spec.ts:102:3 › BARTHEL all-max → total=100 "Dependencia ligera" (1.1s)
  ✓   2 e2e-instruments.spec.ts:121:3 › BARTHEL mid-range → total in (45, 79], classification matches contract (1.1s)
  ✓   3 e2e-instruments.spec.ts:149:3 › YESAVAGE all-si → total=10 "Depresión establecida" (reverse-scoring) (1.1s)
  ✓   4 e2e-instruments.spec.ts:172:3 › MNA_CUADRO cribaje ≥ 12 → evaluación skipped, classification "Estado nutricional normal" (1.1s)
  ✓   5 e2e-instruments.spec.ts:221:3 › MNA_CUADRO cribaje < 12 → full path, global classification applied (1.1s)
  ✓   6 e2e-instruments.spec.ts:273:3 › FICHA_NUTRICIONAL → no scoring card; data submitted & persisted (1.1s)
  ✓   7 fill-flow.spec.ts:68:3  › Fill flow smoke (T8) — mocked preview › BARTHEL happy path (1.0s)
  ✓   8 fill-flow.spec.ts:102:3 › Fill flow smoke (T8) — mocked preview › MNA_CUADRO skippable (956ms)
  ✓   9 fill-flow.spec.ts:138:3 › Fill flow smoke (T8) — mocked preview › Renderer emits clean respuestas payload (946ms)
  ✓  10 fill-flow.spec.ts:190:3 › Real-backend fill flow (W6) › BARTHEL real-backend: UI submit path → result dialog renders persisted total (4.2s)
  ✓  11 schema-render.spec.ts:40:3  › BARTHEL — 10 single-select-scored items, 1 section (1.1s)
  ✓  12 schema-render.spec.ts:66:3  › MINI_MENTAL — 30 single-select-scored items across 11 sections (1.1s)
  ✓  13 schema-render.spec.ts:76:3  › TINETTI — 20 single-select-scored items across 2 sections (1.1s)
  ✓  14 schema-render.spec.ts:84:3  › YESAVAGE — 15 single-select-scored items, 1 section (1.1s)
  ✓  15 schema-render.spec.ts:92:3  › MNA_CUADRO — 18 scored + 2 number-info + 1 group-info (1.2s)
  ✓  16 schema-render.spec.ts:132:3 › FICHA_NUTRICIONAL — 7 text + 3 single-select-info + 3 number-info (1.1s)
  ✓  17 schema-render.spec.ts:147:3 › All 6 fixtures render with ZERO instrument-specific code in renderer (4.5s)
  17 passed (26.3s)
```

## Acceptance criteria — all met

| # | Criterion | Evidence |
|---|---|---|
| 1 | UI repro of BUG-W5-01 (gap report steps 1–8) now succeeds: dialog closes, ficha COMPLETADO, result shows server-computed total | `fill-flow.spec.ts` real-backend test drives REAL UI submit path; passes in 4.2s; no API POST workaround |
| 2 | UI repro of BUG-W5-02 succeeds without opening the assign dialog first | Same test: clicks "Ver detalle" directly on the just-created COMPLETADO row; result dialog renders total=100, classification="Dependencia ligera" |
| 3 | POST without versionRegistro → 201, persisted `v1` (new test green) | `qa-contract.spec.ts` case #6 — `G2-12: POST without versionRegistro → 201, persisted "v1"` — 28ms ✓ |
| 4 | `grep -n "plantillaArchivo\|versionPlantilla" frontend/app/pages/instrumentos/[id]/index.vue` → no hits | Verified — zero output |
| 5 | Full regression from scope step 6 green; zero unclassified failures | 48/48 backend instruments-dynamic + 53/53 modernized legacy (4 pre-existing skips) + 17/17 frontend. Pre-existing TEST-ENV-W5-01 (certificates 500) is out of scope. |

## Known issues NOT fixed (out of scope per task boundaries)
- `tests/certificates/certificates.spec.ts:108` — pre-existing `GET /certificates` 500 with `tipo + estado` filter (TEST-ENV-W5-01). Out of scope for this feature.
- `instruments.spec.ts` legacy `/instruments/records` endpoint has 4 pre-existing `test.skip()`s (fixture-chain skips for tests that depended on the `createdRecordId` set by a prior test). Not regressions.

## Deferred items
- None.