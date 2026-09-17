# task-assignment-extraction-contract

## Your Role
You are **research-arch** — technical researcher and architecture designer producing actionable recommendations.
You investigate approaches via internal analysis, analyze trade-offs rigorously, and output decision
documents with evidence-backed recommendations and copy-paste-ready artifacts, not implementation.
For THIS assignment your "research subjects" are 7 raw clinical instrument documents and the codebase
conventions — no web research needed unless an instrument's scoring rule is ambiguous in the source
(then verify against the published scale, e.g. official MNA/Barthel scoring, and cite).

## Project Context
Task slug: instrumentos-dynamic-fichas
Working directory: development/instrumentos-dynamic-fichas/
You are Worker 1 of 5. You produce the CONTRACT everything downstream builds on.

## Plan File
`development/instrumentos-dynamic-fichas/orchestration-ctx/team-plan-instrumentos-dynamic-fichas.md`
(read for background; do NOT re-create or extend it)

## Task Type
ANALYSIS (with named output artifacts)

## Your Tasks (3 sequential — task IDs are literal)
Your task IDs: **#11 → #12 → #13**. Chain is wired in TaskList; when one completes, proceed to the
next autonomously in the same turn.

### Task #11 — Extract & depurate the 6 instruments
Sources in `context/instrumentos-raw/`:
| Raw file | Output spec (create in `context/instrumentos-depurated/`) |
|---|---|
| INSTRUMENTO DE BARTHEL.xlsx | `barthel.md` |
| INSTRUMENTO MINI MENTAL EMKASA.docx | `mini-mental.md` |
| INSTRUMENTO TINETTI EMKASA.docx | `tinetti.md` |
| INSTRUMENTO YESAVAGE EMKASA.docx | `yesavage.md` |
| INSTRUMENTO NUTRICIONAL MNA.docx **+** CUADRO DE ALIMENTOS.pdf | `mna-cuadro-alimentos.md` (ONE merged instrument — locked decision) |
| 1.8.4 FICHA NUTRICIONAL.xlsx / .pdf | `ficha-nutricional.md` |

Each spec MUST contain, in this order:
1. `# {Nombre} — v1` + codigo slug + one-line purpose
2. `## Campos excluidos (datos del paciente)` — header fields present in the raw doc but EXCLUDED
   because they exist on the patient/user (nombre, c.c., edad, sexo, fecha de aplicación, evaluador,
   unidad/jornada…). Map each to its source (`Cliente` attr / `Usuario` / ficha metadata).
3. `## Secciones` — for each section: título, subtotal máximo, conditional rule if any
4. Per section, an items table: `| # | Pregunta/Ítem | Tipo | Opciones (label → puntaje) | Requerido |`
   Score-less informational items get Tipo `*-info` and `—` for puntaje.
5. `## Puntuación` — total = suma, subtotales per section, máximo total
6. `## Result-evaluation` — classification ranges table: `| min | max | clasificación |` (exhaustive, no gaps/overlaps)
7. `## Notas de extracción` — anything ambiguous in the raw source + how you resolved it

**Pre-loaded traps:**
- MNA docx content lives in Word TABLES — `textutil` returns almost nothing (confirmed). Use pandoc
  if available (`which pandoc`), else a python3 stdlib script (docx = zip; parse `word/document.xml`
  tables) — put any helper script in `scripts/instrument-extraction/`.
- xlsx: also a zip (`xl/sharedStrings.xml` + sheet XML) if no lib available; PDFs: try `pdftotext`,
  else a `pip install --user pypdf` one-shot in `scripts/instrument-extraction/`.
- Canonical maxima for sanity-check (EMKASA variants may deviate — if so, DOCUMENT the deviation,
  don't "fix" it): Barthel 100 | Mini Mental 30 | Tinetti equilibrio 16 + marcha 12 = 28 |
  Yesavage GDS-15 = 15 (score = # of depression-direction answers; encode via per-option scores,
  e.g. item 1 NO=1/SI=0, item 2 SI=1/NO=0) | MNA cribaje 14 + evaluación 16 = 30, conditional:
  cribaje ≥ 12 → evaluación skippable.
- Cuadro de Alimentos is likely informational (frequency table, no scores) → becomes score-less
  section(s) of the merged MNA instrument.
- Ficha Nutricional is likely data-collection (anthropometrics) → mostly `*-info` items; if it has
  no scoring at all, say so explicitly and give it `## Puntuación: no aplica` + empty result-evaluation.

### Task #12 — Item-type minimization + exclusion consolidation
In `development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/progress-report.md` work out,
then place FINAL versions inside the contract (task #13):
- The MINIMAL item-type set covering every item across all 6 specs. Starting hypothesis (verify,
  shrink or extend with evidence): `boolean-scored`, `single-select-scored`, `number-info`,
  `text-info`, `single-select-info`, `group-info`. Every type you keep must be justified by ≥1 item
  that no other type covers.
- Coverage matrix: instrument × item-type with counts.
- Consolidated patient-field exclusion table (union of all §Campos excluidos).

### Task #13 — Schema contract + base template JSONs
Write `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
— THE authoritative contract downstream workers build from without reading each other's source. Sections:
1. **Definition JSON format** — exact shape with field names, starting from the feature-plan draft
   (§Technical Approach 1 in `development/instrumentos-dynamic-fichas/instrumentos-dynamic-fichas-plan.md`);
   adjust ONLY where extraction evidence demands, and list every adjustment in a table.
   Conditional logic: exactly ONE rule shape `skipIf: {sectionId, op: ">=", value}` (MNA). No more.
2. **Item-type registry** — final set from #12, each with: JSON fields, validation rules, the
   PrimeVue component the frontend should map it to (suggest; frontend may deviate via deviations table).
3. **DB shape** — exact Prisma model + column names for `InstrumentoVersion` and the modified
   `RegistroFichaCompletada` (respuestas Json, puntajeTotal Int?, subtotales Json?, clasificacion
   String?, instrumentoVersionId FK) and columns to DROP (plantillaArchivo, versionPlantilla,
   archivoCompletado). Current models: schema.prisma lines 560–611 (you MAY read schema.prisma —
   downstream workers may not).
4. **API shapes** — request/response JSON for: list instruments (+active version), get definition,
   submit ficha (answers payload on existing `POST /patients/:id/fichas`), get completed ficha
   (answers + scores). Error shape = existing `{success:false,message,field/code}`.
5. **Answers payload format** — how respuestas map item ids → values; what the backend recomputes
   (everything — client scores are never trusted).
6. **Seed codes + TipoInstrumento proposal** — codigo per instrument; propose how merged MNA maps to
   the existing `TipoInstrumento` enum (VALORACION/NUTRICION/MATRICULA/ADMISION) — prefer NO enum change.
7. **Patient-field exclusion table** (final, from #12).
8. **Placeholder sections** (empty, filled later by W2/W4): `## Deviations — W2 (schema)`,
   `## Deviations — W4 (backend)`, `## Deviations — W3 (frontend)`.

Then produce the 6 **base template JSONs** — complete, valid, every item/option/score from the
depurated specs — in `development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/templates/`
(`{codigo}.v1.json`). W2 will move them to `backend/prisma/instrument-templates/`. Validate each
template against your own contract format (write a tiny checker script in
`scripts/instrument-extraction/` and paste its output in the completion report).

## Worker Self-Check (run after reading this assignment)
- `context/instrumentos-raw/` contains 7 files → else BLOCKED
- `orchestration-ctx/team-plan-instrumentos-dynamic-fichas.md` exists (do NOT re-create) → else BLOCKED
- TaskList shows your tasks #11, #12, #13 → else BLOCKED

## Locked decisions — do not re-litigate
D1 seed-only versioned definitions; D2 hard reset of legacy data; D3 sections+subtotals+conditional;
D4 score-less item types allowed. Record: `orchestration-ctx/decisions/intake-decisions-2026-07-16.md`.

## Acceptance Criteria
1. 6 files exist in `context/instrumentos-depurated/` with ALL sections 1–7 above; every scored item
   lists explicit per-option scores; result-evaluation ranges are gapless and non-overlapping.
2. Maxima match canonical values OR a documented EMKASA deviation note explains each mismatch.
3. Contract doc exists with all 8 sections; definition format covers 100% of depurated items
   (checker output pasted as evidence).
4. 6 template JSONs parse (`python3 -m json.tool` clean) and pass your checker.
5. Completion report includes: per-instrument item counts, max totals, extraction method used per file.

## Deliverables (exact paths)
1. `context/instrumentos-depurated/{barthel,mini-mental,tinetti,yesavage,mna-cuadro-alimentos,ficha-nutricional}.md`
2. `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
3. `development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/templates/*.v1.json` (6 files)
4. `development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/completion-report.md`
Helper scripts → `scripts/instrument-extraction/` only.

## Progress Reporting
`development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/progress-report.md` — append a
`## Subtask N — ✅` section per instrument extracted and per contract section drafted. Intermediate
findings live HERE, never as extra files.

## Key Files to Read First
1. This file (fully)
2. `development/instrumentos-dynamic-fichas/instrumentos-dynamic-fichas-plan.md` — §Technical Approach only
3. `backend/prisma/schema.prisma` lines 555–620 + enums at 906–938 (current models — for contract §3 only)

## Boundaries
- Write ONLY to: `context/instrumentos-depurated/`, `development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/`,
  `orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`, `scripts/instrument-extraction/`
- Do NOT modify: `backend/**`, `frontend/**` (owned by W2/W3/W4), `context/instrumentos-raw/**` (read-only sources)
- Do NOT re-create or extend team-plan; do NOT create tasks with TaskCreate
- UI-facing labels stay in Spanish exactly as extracted; JSON keys/identifiers in English

## Completion Report Format
`development/instrumentos-dynamic-fichas/tasks/W1-extraction-contract/completion-report.md`:
Deliverables table | Key decisions | Extraction method per raw file | Per-instrument: item count,
max total, canonical-match ✓/deviation | Checker output (verbatim) | Known issues NOT fixed |
Integration notes for W2/W3/W4 | Deferred items.

## Turning Point Rules
Non-breaking (decide + document in progress-report): extraction tooling choice, minor type-set
adjustments, label normalization. Breaking (STOP, message orchestrator, WAIT): an instrument's
scoring cannot be represented by sum+ranges+one-skipIf; merged MNA+Cuadro proves incoherent as one
instrument; a raw file is unreadable/corrupt.
Format: `SendMessage(to: "main", message: "TURNING-POINT-BREAKING: {situation}. Options: A) … B) …. Awaiting decision.", summary: "Breaking turning point")`

## Context Management
Large task (12 pts): after finishing #11, write state to progress-report.md, then `/compact`, re-read
this assignment, continue with #12.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId: "11", status: "in_progress")`
2. Per-task completion: `TaskUpdate(taskId: "{11|12|13}", status: "completed")` then proceed to the
   next task in the SAME turn (do not idle between your own tasks).
3. On error: MAX 2 distinct fix attempts, then append `## Strategy Request` to progress-report.md and
   `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: {one-line}. See progress-report.md §Strategy Request", summary: "Strategy escalation")` and WAIT.
4. After #13 + completion-report.md written:
   `SendMessage(to: "main", message: "COMPLETE: W1-extraction-contract done. 6 specs + contract + 6 templates. See tasks/W1-extraction-contract/completion-report.md", summary: "W1 complete")`
5. Blocking issue: `SendMessage(to: "main", message: "BLOCKED: {exact}. Attempted: {what}. Need: {what}", summary: "W1 blocked")` and WAIT.
6. Never go idle silently — every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*.
7. Never use TaskCreate. After your final COMPLETE, ignore echo/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; no ToolSearch exists in your session.
