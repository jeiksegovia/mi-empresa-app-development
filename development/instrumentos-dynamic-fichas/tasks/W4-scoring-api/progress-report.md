# Progress Report — W4 (backend)

> Worker: W4 (backend-eng) · Tasks #19 + #20 · Started 2026-07-17

## Plan recap

- #19: scoring engine + answer validation (pure functions in `backend/src/services/instrumentScoringService.ts`)
  + unit spec `backend/tests/instruments-dynamic/scoring-engine.spec.ts` using the real seeded definitions
- #20: API endpoints + backend file-flow removal + smoke spec

## Pre-flight checks (W4 Worker Self-Check)

- [x] Contract §4.3b exists — `PATCH /:clienteId/fichas/:fichaId/completar` documented.
- [x] `backend/src/generated` client has `instrumentoVersion` model (per W2 completion report §Integration Notes).
- [x] 6 seed codigos present with active v1 versions — confirmed via W2 spec passing.
- [x] TaskList: #19 + #20 assigned to W4.

## Working notes

- Scoring service signature:
  - `validateRespuestas(definition, respuestas) → { ok: true } | { ok: false, code, field?, message }`
  - `computeScore(definition, respuestas) → { subtotales, puntajeTotal, clasificacion, skippedSections, validation }`
  - Pure functions, no HTTP concerns — imported by both API layer and unit tests.
- Classification-source rule (§1.3): if any section skipped via `skipIf`, classification comes from
  TRIGGER section's `subtotal.resultEvaluation` applied to that section's subtotal; else global
  `scoring.resultEvaluation` on full total.
- MAY-skip semantics (§1.4): condition met + ZERO items answered → skipped (no subtotal entry);
  condition met + ANY items answered → required (validation rejects partial answers);
  condition NOT met → required as normal.

## Status (running)

- [x] Read assignment + contract + W2 completion report + schema.
- [x] Read instrument templates (BARTHEL, MNA_CUADRO, MINI_MENTAL, TINETTI, YESAVAGE, FICHA_NUTRICIONAL).
- [x] Read existing services + routes to understand integration points.
- [x] Task #19: write `instrumentScoringService.ts` + unit spec.
- [ ] Task #20: extend services + routes + remove file flow + write API smoke spec.
- [ ] Completion report.

## #19 Verbatim output

```
$ TEST_API_URL=http://localhost:3101 npx playwright test tests/instruments-dynamic/scoring-engine.spec.ts --reporter=list
Running 26 tests using 1 worker
  ✓   1 BARTHEL all-max → total=100, clasificacion="Dependencia ligera"
  ✓   2 BARTHEL all-min → total=0, worst classification
  ✓   3 MINI_MENTAL all-max → total=30, clasificacion="Normal"
  ✓   4 MINI_MENTAL all-min → total=0, worst classification
  ✓   5 TINETTI all-max → total=28, clasificacion="Riesgo bajo"
  ✓   6 TINETTI all-min → total=0, worst classification
  ✓   7 YESAVAGE all-max → total=15, clasificacion="Depresión establecida"
  ✓   8 YESAVAGE all-min → total=0, worst classification
  ✓   9 MNA_CUADRO all-max → total=30, clasificacion="Estado nutricional normal"
  ✓  10 MNA_CUADRO all-min → total=0, worst classification
  ✓  11 FICHA_NUTRICIONAL all-filled → puntajeTotal=null, clasificacion=null
  ✓  12 MNA MAY-skip: cribaje=11 → evaluación required (validation fails)
  ✓  13 MNA MAY-skip: cribaje=12 + evaluación absent → skipped, normal, total=12
  ✓  14 MNA MAY-skip: cribaje=12 + evaluación fully answered → global ranges (28, normal)
  ✓  15 MNA MAY-skip: cribaje=12 + evaluación partial → INVALID_ANSWER_PAYLOAD
  ✓  16 Yesavage reverse-scored: "no" x 15 → total=5 ("No depresión")
  ✓  17 Yesavage forward-scored: "si" x 15 → total=10 ("Depresión establecida")
  ✓  18 unknown key → INVALID_ANSWER_PAYLOAD
  ✓  19 INVALID_OPTION on single-select-scored
  ✓  20 OUT_OF_RANGE on number-info
  ✓  21 missing required item → INVALID_ANSWER_PAYLOAD
  ✓  22 group-info: missing a row → INVALID_ANSWER_PAYLOAD
  ✓  23 group-info: invalid columnId → INVALID_ANSWER_PAYLOAD
  ✓  24 text-info: number value rejected
  ✓  25 validateAndScore: valid payload returns ScoreResult
  ✓  26 validateAndScore: invalid payload throws InstrumentScoringError
26 passed (851ms)
```

All 26 cases from the task brief pass against the real seeded definitions.

## #20 plan

1. Extend `instrumentService.listInstruments` to include `activeVersion`.
2. Add `instrumentService.getInstrumentDefinition(codigo)` + `instrumentService.getActiveVersion(codigo)`.
3. Extend `patientService.createFichaAtomic` to accept `respuestas` + score + persist answers on COMPLETADO.
4. Add `patientService.completeFichaAtomic(fichaId, input)` for the PATCH .../completar endpoint.
5. Add `patientService.getFichaWithScores(fichaId)` for the GET .../fichas/:fichaId response.
6. Wire all 4 new endpoints (GET /instruments/:codigo/definition, POST updated, PATCH .../completar new, GET updated) into routes.
7. Remove file-flow leftovers in `backend/src/**` (Zod fields, route handling, service branches).
8. Smoke spec `api-fichas.spec.ts` — happy paths + INVALID_OPTION + INVALID_STATE + role check.

Pre-loaded constraint reminders:
- Vencimientos endpoint + estado machine must keep working (existing spec coverage).
- Backend dev is `tsx watch` on :3101 — auto-reloads on file save; do NOT touch :4142.
- W3's frontend already consumes the §4 response shapes — must be byte-compatible.