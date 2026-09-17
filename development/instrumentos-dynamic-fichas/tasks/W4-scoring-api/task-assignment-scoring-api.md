# task-assignment-scoring-api

## Your Role
You are **backend-eng** — backend systems implementer. Prioritize API design consistency, input
validation, meaningful structured errors, and clean separation between HTTP layer, business logic,
and data access. This codebase: Express + Prisma v6 (client at `backend/src/generated`), Zod schemas
at top of route files with `validate()` middleware, service→route pattern, errors
`{success:false,message,field/code}`, Spanish user-facing messages.

## Project Context
Task slug: instrumentos-dynamic-fichas. Working directory: development/instrumentos-dynamic-fichas/.
You are Worker 4 of 5 (fresh spawn — waves 1–2a are DONE: schema migrated, 6 instruments seeded with
active v1 JSONB definitions, frontend renderer built in parallel by W3 against the same contract).
Local: backend :3101 (tsx watch, auto-reloads), DB :15432 docker.

## Plan File
`development/instrumentos-dynamic-fichas/orchestration-ctx/team-plan-instrumentos-dynamic-fichas.md` (background; do NOT re-create/extend)

## Task Type
IMPLEMENTATION

## THE CONTRACT (authoritative)
`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
(post-G2). Your sections: §1 definition format (incl. §1.3 classification-source rule + §1.4
MAY-skip semantics), §2 five item types, §4 API shapes + §4.5 error codes, §5 answers payload +
§5.3 recompute algorithm, §6 seed codes. You MAY read `backend/prisma/schema.prisma` and the
generated client (same layer), and W2's completion report
(`tasks/W2-schema-seed/completion-report.md`) for DB integration notes. The API RESPONSE SHAPES in
§4 are consumed by W3's already-built frontend — do NOT deviate from them; if forced, file under
`## Deviations — W4 (backend)` in the contract AND message the orchestrator. Locked decisions
D1–D4 + G2-1…G2-10: do not re-litigate.

## Your Tasks (IDs literal): #19 → #20

### Task #19 — Scoring engine + answer validation
`backend/src/services/instrumentScoringService.ts` — pure functions, no HTTP concerns:
1. `validateRespuestas(definition, respuestas)` → structured result. Rules (§5.2/§5.3):
   - Unknown keys (not an item id in the definition) → `INVALID_ANSWER_PAYLOAD` (+field)
   - Required items present per section; sections skipped per MAY-skip: a section with
     `condition.skipIf` counts as SKIPPED iff condition met (evaluated on the referenced section's
     computed subtotal) AND none of its items answered. Condition met + partial answers →
     `INVALID_ANSWER_PAYLOAD`. Condition NOT met → section fully required.
   - `single-select-scored`/`single-select-info`: value must be one of `options[].value` → else `INVALID_OPTION`
   - `number-info`: numeric + within `constraints` → else `OUT_OF_RANGE`
   - `text-info`: string
   - `group-info`: array of `{rowId, columnId}`, exactly one entry per `rows[].id`, columnId valid
2. `computeScore(definition, respuestas)` → `{ subtotales, puntajeTotal, clasificacion, skippedSections }`:
   - Per answered section: subtotal = Σ selected-option scores (Float — MNA has 0.5s)
   - `puntajeTotal` = Σ subtotales of ANSWERED sections; `null` when `scoring.total === "none"`
   - Classification-source rule (§1.3): ≥1 section skipped → classify the TRIGGER section's subtotal
     against its `subtotal.resultEvaluation`; none skipped → global `scoring.resultEvaluation` on total.
     No matching range → `clasificacion = null` + `console.warn` (never throw).
3. Unit spec `backend/tests/instruments-dynamic/scoring-engine.spec.ts` using the REAL seeded
   definitions (load via prisma): per instrument — all-min → 0/worst label; all-max → canonical max
   (BARTHEL 100, MINI_MENTAL 30, TINETTI 28, YESAVAGE 15, MNA 30) / best label; every
   resultEvaluation boundary (min and max of each range hit exactly); FICHA_NUTRICIONAL → null/null;
   MNA specials: cribaje=11 → evaluación required; cribaje=12 + evaluación absent → skipped,
   clasificacion "Estado nutricional normal", total=12; cribaje=12 + evaluación fully answered →
   global ranges apply; cribaje=12 + evaluación partial → INVALID_ANSWER_PAYLOAD; Yesavage
   reverse-scored items (1,5,7,11,13: "no" scores 1). Deterministic fixtures, no random data.

### Task #20 — API endpoints + file-flow removal + smoke specs
Extend `backend/src/services/instrumentService.ts` + `patientService.ts` and routes per contract §4:
1. `GET /instruments` — response adds `activeVersion` metadata (§4.1)
2. `GET /instruments/:codigo/definition` — active version + definition (§4.2); 404
   `INSTRUMENT_NOT_FOUND`/`NO_ACTIVE_VERSION`; 403 `ROLE_NOT_ALLOWED` via `rolesPermitidos` CSV check
3. `POST /patients/:clienteId/fichas` evolved (§4.3): `respuestas` OPTIONAL — absent → PENDIENTE
   assign (existing behavior incl. fechaVencimiento/periodicidad KEPT); present → validate + score +
   persist COMPLETADO (respuestas, subtotales, puntajeTotal, clasificacion, instrumentoVersionId =
   active version). Response 201 per §4.3 incl. `skippedSections`.
4. `PATCH /patients/:clienteId/fichas/:fichaId/completar` NEW (§4.3b): completes PENDIENTE or
   VENCIDO (existing VENCIDO→COMPLETADO transition); 400 `INVALID_STATE` if already COMPLETADO.
5. `GET /patients/:clienteId/fichas/:fichaId` — response adds respuestas/scores/instrumentoVersion (§4.4).
6. REMOVE file-based flow (backend side): plantilla download endpoint/service code,
   `archivoCompletado` handling in ficha create/update paths, related Zod fields. Grep-clean:
   `plantillaArchivo|archivo_completado|archivoCompletado|plantilla` in `backend/src/**` → only
   legitimate leftovers (none expected). PRESERVE: estado machine, lazy PENDIENTE→VENCIDO flip,
   `GET /patients/fichas/vencimientos`, `requireInstrumentWriter` gating, `records/by-instrument`.
7. Smoke spec `backend/tests/instruments-dynamic/api-fichas.spec.ts` (Playwright API style, existing
   auth helpers): list+definition happy paths; 403 role; Barthel single-step POST → 201 with correct
   total/clasificacion; assign-PENDIENTE → completar PATCH → COMPLETADO; INVALID_OPTION 400;
   INVALID_STATE 400.

**Pre-loaded traps:**
- Backend dev (:3101) is `tsx watch` — auto-reloads; do NOT kill anything on port 4142 (prod bun),
  no blanket pkill node/tsx. Target specific PIDs via `lsof -i :3101` only if truly needed.
- Prisma client import pattern: from `src/generated` (grep existing services for exact import).
- W3's frontend already consumes §4 shapes — response field names are FROZEN.
- Some legacy backend tests reference removed file fields — do NOT chase unrelated suites; if an
  EXISTING spec fails because of the removed file flow, update only specs directly covering the
  removed behavior; classify anything else (BUG/TEST-ENV/FLAKE) in your report, don't fix.
- Zod: reuse `validate()` middleware; answers validation itself is the scoring service's job
  (definition-driven), Zod only validates envelope shapes.

## Worker Self-Check
- Contract §4.3b (completar endpoint) exists in the contract → else BLOCKED (wrong contract revision)
- `backend/src/generated` client has `instrumentoVersion` model (regenerated by W2) → else BLOCKED
- Seed present: 6 rows in `instrumentos_versiones` (query or run W2's smoke spec) → else BLOCKED
- TaskList shows #19, #20 assigned to you → else BLOCKED

## Acceptance Criteria
1. `scoring-engine.spec.ts`: all listed cases pass (verbatim run output in completion report).
2. `api-fichas.spec.ts` passes against local :3101.
3. Grep evidence: no `plantilla|archivoCompletado` references left in `backend/src/**` (output pasted).
4. Vencimientos endpoint + estado transitions still pass: re-run the existing ficha-related suites
   touching them and report results with classification of any failure.
5. Response shapes byte-compatible with contract §4 examples (field names/nesting).

## Deliverables
1. `backend/src/services/instrumentScoringService.ts`
2. Modified `backend/src/services/{instrumentService,patientService}.ts` + `backend/src/routes/{instruments,patients}.routes.ts`
3. `backend/tests/instruments-dynamic/scoring-engine.spec.ts` + `api-fichas.spec.ts`
4. `development/instrumentos-dynamic-fichas/tasks/W4-scoring-api/completion-report.md` (+ progress-report.md during work)

## Boundaries
- Write ONLY: `backend/src/**`, `backend/tests/**` (NOT `tests/instruments-dynamic/seed-definitions.spec.ts` — W2's), your task dir, contract W4-deviations section.
- Do NOT touch: `backend/prisma/**` (schema/migrations/seed/templates frozen — issues → deviation note + orchestrator), `frontend/**`, other task dirs, team-plan.
- W3 works `frontend/**` in parallel; frontend Playwright runs may hit your restarting backend — irrelevant to you; don't investigate frontend failures.

## Completion Report Format
Deliverables table | Key decisions | Verbatim outputs per acceptance criterion | Failure
classification table (BUG/TEST-ENV/FLAKE — zero unclassified) | Known issues NOT fixed (with repro)
| Integration notes for QA (exact endpoints, seeded codigos, auth needed) | Deferred items.

## Turning Points
Non-breaking: internal service structure, helper extraction (document in progress-report).
Breaking (STOP + message + WAIT): any §4 response shape change, schema/migration need, estado-machine
change. Format: `SendMessage(to: "main", message: "TURNING-POINT-BREAKING: {situation}. Options: A) … B) …", summary: "Breaking turning point")`

## Context Management
~10 pts — after #19, write state to progress-report.md, `/compact`, re-read this assignment, continue with #20.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "19", status: "in_progress")`. Per-task complete → `TaskUpdate(..., "completed")`, proceed to #20 in the SAME turn.
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` in progress-report.md + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. All done: completion-report.md → `SendMessage(to: "main", message: "COMPLETE: W4-scoring-api done. …", summary: "W4 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: {exact}. Attempted: {…}. Need: {…}", summary: "W4 blocked")` + WAIT.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never idle silently.
6. Never TaskCreate. After final COMPLETE, ignore echoes/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
