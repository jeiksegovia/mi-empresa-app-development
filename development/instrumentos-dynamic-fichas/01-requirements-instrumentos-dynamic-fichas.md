# Requirements: instrumentos-dynamic-fichas

Derived from `00-intake-instrumentos-dynamic-fichas.md` + decision record
`orchestration-ctx/decisions/intake-decisions-2026-07-16.md` (D1–D4).

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|----|-------------|----------------------|-----------|
| R1 | Depurated markdown spec per instrument from `context/instrumentos-raw/` | 5 md files in `context/instrumentos-depurated/`: barthel, mini-mental, tinetti, yesavage, mna-cuadro-alimentos (merged), ficha-nutricional. Each lists every section, item/question, input type, options with score values, subtotals, max scores, classification ranges, and the patient-header fields EXCLUDED (mapped to `Cliente` attrs). Extraction from docx tables via pandoc/python-docx; xlsx via script; PDF via text extraction | No |
| R2 | Minimal item-type set | Contract doc names the smallest item-type set covering all 6 instruments (expected ≈ `boolean`, `single-select-scored`, `number`, `text-info`, `select-info`, `group/table-info`) with a coverage matrix instrument×type | No |
| R3 | DB schema redesign (BREAKING, hard reset per D2) | Versioned instrument-definition storage: JSONB definition (sections, items, types, option scores, conditional rules, result-evaluation ranges) with immutable versions; ficha completion stores answers JSONB + computed subtotals/total/classification + FK to the exact definition version. File columns (`plantillaArchivo`, `archivoCompletado`) removed. Migration resets legacy ficha data. Estado machine (PENDIENTE/COMPLETADO/VENCIDO), lazy VENCIDO flip, vencimientos report, `requireInstrumentWriter` all preserved | No |
| R4 | Base JSON templates + upgrade utility (D1) | Base JSON definition per instrument in repo (e.g. `backend/prisma/instrument-templates/*.json`); seed loads them; utility script (`npm run instruments:upgrade` or similar) programmatically upserts new versions from templates without wiping completions | No |
| R5 | Backend scoring engine (authoritative) | Given answers + definition version: validates answers against schema, computes per-section subtotals, total = sum of item scores, applies conditional section-skip (MNA screening ≥ 12), classifies via result-evaluation ranges. Frontend-sent scores are never trusted | No |
| R6 | API surface | Endpoints to: list active instrument definitions, get one definition (active version), submit a completed ficha (answers payload; single-step assign+complete pattern kept), get a completed ficha with answers + scores + classification. Zod-at-top-of-routes, service→route, structured errors | No |
| R7 | Frontend dynamic form renderer | A component transforms a definition JSON into a rendered PrimeVue form: sections, all item types from R2, required-field validation, conditional section behavior, Spanish labels. Works for all 6 seeded instruments with zero instrument-specific code | No |
| R8 | Patient fields de-duplicated | Header (nombre, c.c., edad, sexo, fecha aplicación, evaluador) rendered from patient/user data, never form items; depurated specs mark these excluded fields | No |
| R9 | Results UI | Ficha detail shows total score + classification label; expanded view renders every section/item/answer/score cleanly (read-only) | No |
| R10 | Schema↔render unit tests (D1) | Automated tests assert every item in each seeded JSON definition renders to a form element of the correct type (count + type match per instrument) | No |
| R11 | Scoring + E2E test suites | Backend: scoring engine specs per instrument incl. range boundary cases + API specs in `backend/tests/instruments-dynamic/`. Frontend: Playwright fill→submit→score→classification flow for at least Barthel, Yesavage, MNA-merged in `frontend/tests/instruments-dynamic/` | No |
| R12 | File-based flow removal | Plantilla download, archivo upload UI, and related endpoints/service code removed; no dead references (grep-clean) | No |

## Non-Functional Requirements
- Spanish UI text; English identifiers; existing conventions (Prisma v6 `src/generated`, Zod validation, `useApi`, PrimeVue auto-import).
- Definition versions immutable once any completion references them.
- NEVER `migrate diff --shadow-database-url`.
- Worker output < 127k tokens; task reports to `context/implementation-plan/`.

## Out of Scope
- Admin form-builder / definition-editing UI (D1).
- Legacy-data preservation or migration of old file completions (D2 hard reset).
- Staging/prod deployment (follow-up release cycle; runbooks exist).
- PDF export of completed fichas.
