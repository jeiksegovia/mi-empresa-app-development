# Feature Plan: instrumentos-dynamic-fichas

## Objective
Replace the file-based instrumentos/fichas system with schema-driven dynamic forms: instrument
definitions stored as versioned JSONB in Postgres, a backend scoring engine (sum → subtotals →
total → result-evaluation classification), a frontend renderer that turns a definition into a
fillable PrimeVue form, and a clean read-only results view. Breaking change, hard reset of
legacy file data (D2).

## Assumptions & Constraints
- Decisions D1–D4 locked (`orchestration-ctx/decisions/intake-decisions-2026-07-16.md`).
- Fichas state machine (PENDIENTE→COMPLETADO/VENCIDO, lazy flip), single-step assign+complete,
  `requireInstrumentWriter`, vencimientos report are preserved semantics — only the payload
  changes from file to answers.
- MNA + Cuadro de Alimentos merge into ONE instrument; patient-header fields excluded from
  schemas (R8).
- Local dev only this cycle; staging release is a follow-up.

## Existing Patterns Used
- **Route/service split**: `backend/src/routes/instruments.routes.ts` + `services/instrumentService.ts`,
  Zod schemas at top of route file, `validate()` middleware, structured errors
  `{success:false,message,field/code}` → new endpoints extend these files/patterns.
- **Prisma v6, generated client at `src/generated`**, migrations via `prisma migrate dev`,
  seed at `backend/prisma/seed.ts` (`npm run db:seed`) → definition seeding hooks in here.
- **Ficha flow**: `POST /patients/:id/fichas` atomic assign+complete in `patients.routes.ts` /
  `patientService.ts` → same endpoint evolves to accept `answers` instead of `archivoCompletado`.
- **Frontend**: Nuxt 4 SPA, PrimeVue auto-import, `useApi`, pages `frontend/app/pages/instrumentos/**`
  and `pacientes/[id]/index.vue` fichas tab; uppercase-as-you-type NOT applied to answers.
- **Tests**: Playwright API specs under `backend/tests/{set}/`, frontend suites under
  `frontend/tests/{set}/`, auth helper `tests/helpers/auth.ts` (origin-aware, sameSite=strict).

## Requirements
R1–R12 in `01-requirements-instrumentos-dynamic-fichas.md`.

## Technical Approach

### 1. Definition format (the contract — single most important artifact)
One JSON document per instrument version (stored JSONB + repo template):
```
{ codigo, nombre, version, tipo, mergeOf?, sections: [ { id, titulo, subtotal?: {max},
    condition?: { skipIf: { sectionId, op: ">=", value } },  // MNA screening rule
    items: [ { id, label, type, required, score?: null,     // null → informational (D4)
               options?: [{ value, label, score }],          // single-select-scored / boolean
               constraints?: { min, max } } ] } ],
  scoring: { total: "sum", resultEvaluation: [ { min, max, label, severity } ] } }
```
Item types (R2, minimal set — final set decided by W1 from real extraction):
`boolean` (two scored options), `single-select-scored`, `number-info`, `text-info`,
`single-select-info`, `group-info` (cuadro de alimentos table). Yesavage direction-scoring is
just per-option scores (SI=1/NO=0 or inverted per item) — no special type.

### 2. DB schema (breaking, hard reset)
- `Instrumento` loses `plantillaArchivo`/`versionPlantilla`; gains relation to
  `InstrumentoVersion { id, instrumentoId, version, definition Json, activo, createdAt }`
  (immutable once referenced).
- `RegistroFichaCompletada` loses `archivoCompletado`; gains `instrumentoVersionId FK`,
  `respuestas Json`, `puntajeTotal Int?`, `subtotales Json?`, `clasificacion String?`.
- Migration drops legacy ficha rows (D2) — plan-approval gate with row counts before running.

### 3. Backend
- Scoring engine module (pure function): `computeScore(definition, respuestas)` →
  `{subtotales, total, clasificacion, skippedSections}`; answers validated against the
  definition (dynamic validation, not per-instrument Zod).
- Endpoints: `GET /instruments` (+active version), `GET /instruments/:id/definition`,
  evolved `POST /patients/:id/fichas` (answers), `GET /patients/:id/fichas/:fichaId`
  (answers + scores). File endpoints removed (R12).
- Seed + `instruments:upgrade` script (D1): reads `backend/prisma/instrument-templates/*.json`,
  validates, upserts new `InstrumentoVersion` rows without touching completions.

### 4. Frontend
- `components/instrument/DynamicInstrumentForm.vue` (renderer: definition → form) +
  `InstrumentResultView.vue` (read-only breakdown) + item-type subcomponents as needed.
- Fill flow from paciente detail (assign+complete); live subtotal/total display; MNA
  conditional skip; results in ficha detail. Patient header injected from `Cliente` (R8).
- **Known pitfall pre-loaded**: v-model on `const reactive()` drops child emits — use
  `:model-value` + explicit update handlers in the renderer tree (memory: vmodel-const-reactive-pitfall).

### 5. Tests
Schema↔render unit tests (R10, D1), scoring boundary specs per instrument, API specs,
Playwright E2E fill flows (R11).

## Risk & Unknowns
- **Extraction fidelity**: MNA docx tables resist textutil (confirmed) — worker must use
  pandoc/python-docx; xlsx via script; PDFs may need OCR-quality review. Depurated specs get a
  human-readable review gate before seeding.
- **Conditional-logic scope creep**: only MNA needs `skipIf` — engine supports exactly one rule
  shape, nothing more.
- **Hard-reset migration on staging later**: dev-tuned migration must not hardcode IDs
  (lesson: `jul10_contrato_cargo_not_null`).
- **Renderer/emit pitfall** (see above) — pre-loaded into assignment.

## Implementation Scope
3 waves, ≤2 concurrent workers (default), contract-first:
- **Wave 1 — W1 (pt-research-arch)**: extract/depurate 6 instruments → md specs (R1, R8) +
  item-type matrix (R2) + authoritative contract `orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
  (definition JSON format, DB shape, API shapes, base template JSONs as draft artifacts).
- **Wave 2 — W2 (pt-backend-eng) ∥ W3 (pt-frontend-eng)**, both build from the contract only:
  W2: Prisma migration (gated), templates+seed+upgrade script, scoring engine, endpoints,
  backend tests (R3–R6, R11-backend, R12-backend).
  W3: renderer + fill flow + results view + schema↔render unit tests against contract fixture
  JSONs (R7–R10, R12-frontend), integrates real API at wave end.
- **Wave 3 — W4 (pt-test-quality, fresh)**: E2E suites, contract-vs-implementation validation,
  gap report (R10/R11 verification).

## New Artifacts Proposed (require approval)
1. `InstrumentoVersion` model + JSONB columns on `RegistroFichaCompletada` (schema redesign core).
2. `backend/prisma/instrument-templates/*.json` — 6 base definition templates.
3. `backend/src/services/instrumentScoringService.ts` (or module in instrumentService) — scoring engine.
4. `backend/scripts/instruments-upgrade/` (or npm script) — programmatic definition upgrader (D1).
5. `frontend/app/components/instrument/DynamicInstrumentForm.vue` + `InstrumentResultView.vue` (+ item subcomponents).
6. `context/instrumentos-depurated/*.md` — 6 depurated instrument specs.
All other work extends existing files/patterns.

## Open Items
- Exact final item-type set: W1 decides from real extraction (bounded by R2).
- Whether `tipo`/`TipoInstrumento` enum needs new values for merged MNA — W1 proposes in contract.

## References
- 00-intake / 01-requirements / decisions/intake-decisions-2026-07-16.md
- Resume summary 2026-07-11; orchestration-learnings 01 (P1 contract-first, P3 migration gate, P5 QA wave).
