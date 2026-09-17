# Intake: instrumentos-dynamic-fichas

## Objective
Breaking change to the instrumentos domain: replace the file-based instrument/ficha system
(`Instrumento.plantillaArchivo` + `RegistroFichaCompletada.archivoCompletado` file uploads)
with **schema-driven dynamic forms**:

1. **Depurate raw instruments** — for each source in `context/instrumentos-raw/`, produce a
   clean markdown spec extracting every item/question, its input type, score points, section
   structure, and scoring/classification logic:
   - INSTRUMENTO DE BARTHEL.xlsx (ADL scale, 0–100)
   - INSTRUMENTO MINI MENTAL EMKASA.docx (MMSE, máx 30, sections with subtotals)
   - INSTRUMENTO TINETTI EMKASA.docx (balance 16 + marcha 12 = 28)
   - INSTRUMENTO YESAVAGE EMKASA.docx (GDS-15, yes/no, direction-scored)
   - INSTRUMENTO NUTRICIONAL MNA.docx + CUADRO DE ALIMENTOS.pdf → **merged into ONE instrument**
   - 1.8.4 FICHA NUTRICIONAL.xlsx/pdf
2. **Item-type minimization** — derive the smallest set of item types that covers all
   instruments (e.g., boolean/yes-no, single-select-with-scores, numeric, text-informational).
3. **DB schema redesign** — store instrument definitions as JSON schema in Postgres (JSONB)
   for flexibility; ficha completions store answers + computed scores.
4. **Scoring engine** — each item answer carries a score value; total = sum; per-instrument
   `result-evaluation` ranges classify the final score (e.g., Barthel 0–20 dependencia total).
5. **Frontend dynamic form renderer** — transform the JSON instrument schema into a dynamically
   rendered form component; fill, validate per instrument logic, submit, store in DB.
6. **Results UI** — final score shown in instrument/ficha details; opening the ficha renders all
   item answers + scores in a simple, clear read view.
7. **De-duplicate patient fields** — instrument headers (nombre, c.c., edad, sexo, fecha) are
   already available on `Cliente`/patient attrs; identify and exclude them from item schemas,
   render them from patient data instead.

## Assumptions
- Backend: Express + Prisma v6 (`src/generated`), Zod-at-top-of-routes, service→route pattern.
- Frontend: Nuxt 4 SPA, PrimeVue auto-import, Pinia; pages under `frontend/app/pages/instrumentos/`
  and `pacientes/[id]`.
- Current flow to replace: single-step assign+complete `POST /patients/:id/fichas` (jul-10),
  lazy PENDIENTE→VENCIDO flip, `requireInstrumentWriter` gating — state machine and role gating
  are KEPT; the file upload/download plantilla parts are REPLACED by dynamic forms.
- Prod does not exist; local + staging only. Staging has live seeded data (empresa id=1).
- UI language Spanish; code/identifiers English-or-existing-convention.
- MNA docx content is inside Word tables — textutil extraction fails; worker must use
  pandoc/python-docx. Barthel/Ficha Nutricional are xlsx; Cuadro de Alimentos is PDF.

## Open Questions
- [confirm-with-user] Q1: Instrument definitions — seed-only (6 fixed, versioned, changed via
  code/seed) vs full admin form-builder UI to create/edit instrument schemas? (Largest scope driver.)
- [confirm-with-user] Q2: Existing file-based records — keep legacy `RegistroFichaCompletada`
  rows/files read-only alongside new-format completions, or hard reset (drop/ignore legacy data)?
- [confirm-with-user] Q3: Scoring complexity — flat sum only, or sections with subtotals +
  conditional logic (MNA screening ≥12 → skip full assessment; Tinetti two sub-scales)?
- [confirm-with-user] Q4: Non-scored informational items (cuadro de alimentos frequency table,
  ficha nutricional anthropometric data) — supported as score-less item types within the schema?
- Definition versioning: completed fichas must remain renderable after a definition changes —
  snapshot the schema into the completion vs immutable versioned definition rows. (Architecture
  decision, orchestrator/worker to resolve; default: versioned definitions, completion FKs a version.)

## Known Constraints
- NEVER `migrate diff --shadow-database-url` (wipes DB).
- Breaking DB change is explicitly authorized by the user ("completely change db schema").
- Merged MNA + Cuadro de Alimentos = one instrument.
- Tests mandatory: backend `backend/tests/{set}/`, frontend `frontend/tests/{set}/` (Playwright).
- Keep output per worker < 127k tokens; report to `context/implementation-plan/{task}.md`.

## Input Source
User /planify-team invocation 2026-07-16 (typo-corrected in Objective above) + codebase scan
(`backend/prisma/schema.prisma` Instrumento/RegistroFichaCompletada, routes/services, pages) +
resume-session summary 2026-07-11.
