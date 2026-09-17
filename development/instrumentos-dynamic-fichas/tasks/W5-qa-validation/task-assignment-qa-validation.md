# task-assignment-qa-validation

## Your Role
You are **test-quality** — test suite author and quality validator. Cover happy paths, error paths,
boundary conditions. Test real behavior against the CONTRACT, not the implementation. You have
authority to file gaps but are **FORBIDDEN from modifying source code** (`backend/src/**`,
`frontend/app/**`, `backend/prisma/**`) — a failing test caused by a real bug goes in the gap
report. You MAY create/modify TEST files and fixtures.

## Project Context
Task slug: instrumentos-dynamic-fichas. You are Worker 5 of 5 (fresh spawn — everything is built and
individually validated; you are the integration/QA wave). Stack: backend :3101 (Express+Prisma),
frontend :3100 (Nuxt 4 + PrimeVue), DB :15432 docker. Admin login: admin@miempresa.com/<redacted>.
**Env quirk (sameSite=strict)**: browser E2E must use matching hosts — run frontend specs with
`TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1` and use
the origin-aware helper `frontend/tests/helpers/auth.ts`. Backend API specs use
`TEST_API_URL=http://localhost:3101`.

## Plan File
`development/instrumentos-dynamic-fichas/orchestration-ctx/team-plan-instrumentos-dynamic-fichas.md` (background only)

## Task Type
IMPLEMENTATION (test artifacts) — Your task ID: **#21**

## THE CONTRACT (test against THIS, not the code)
`development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`
Key sections: §1.3 classification-source rule, §1.4 MAY-skip, §2 five item types, §4 API shapes +
§4.5 error codes, §4.3 G2-11 (client instrumentoVersionId IGNORED — server resolves active), §5 payload.
Prior wave reports (read for integration notes + known gaps): `tasks/W3-dynamic-form-ui/completion-report.md`,
`tasks/W4-scoring-api/completion-report.md`.

## Scope (in order — simplest first)

### 1. Re-run existing suites as-is (evidence baseline)
`backend/tests/instruments-dynamic/` (39 tests) and `frontend/tests/instruments-dynamic/`
(schema-render 7). Verbatim outputs in progress report.

### 2. W3 fill-flow against the REAL backend (watch item)
W3's `frontend/tests/instruments-dynamic/fill-flow.spec.ts` ran with `mock=1` because W4 was
in-flight. Update/extend it to run WITHOUT mocks: real login, real patient (create one via API in
beforeAll if needed), BARTHEL fill → submit → server-computed result rendered. Keep a mocked variant
only if it adds value.

### 3. Browser E2E per instrument (frontend/tests/instruments-dynamic/e2e-instruments.spec.ts)
At least BARTHEL (total=100 path + a mid-range path), YESAVAGE (reverse-scoring: answer all "si" →
total 10 "Depresión establecida"), MNA_CUADRO (cribaje ≥ 12 skip path: result shows "Estado
nutricional normal" + skipped section marked; and cribaje < 12 full path), FICHA_NUTRICIONAL
(no scoring card; data persisted). Verify InstrumentResultView shows total + clasificacion +
per-section breakdown. **PrimeVue RadioButton trap**: Playwright .check()/.click() fails on
p-radiobutton-box (inner input display:none) — use `page.evaluate(() => input.click())` (W3's
documented pattern in its specs).

### 4. Contract validation additions (backend/tests/instruments-dynamic/qa-contract.spec.ts)
- G2-11: POST ficha with bogus `instrumentoVersionId: 999999` → 201, response shows the REAL active
  version id (verify against GET /instruments activeVersion).
- 403 ROLE_NOT_ALLOWED negative path (W4 known-gap #4): login as a non-allowed role (see seeded
  users in `backend/prisma/seed.ts` — AUDITOR/OPERADOR account if present, else create via API) →
  GET /instruments/BARTHEL/definition → 403 with code.
- resultEvaluation boundary sweeps for MINI_MENTAL (26/27 Normal edge, 23/24, 11/12, 8/9) and
  TINETTI (24/25, 18/19) via POST — server classification matches contract ranges.
- INVALID_STATE: completar on COMPLETADO → 400.
- Vencimientos + lazy flip still intact: re-run `tests/patients/ficha-vencido-flip.spec.ts`.

### 5. Legacy spec modernization (fold-forward from W4 — test files ONLY)
These legacy specs assert the REMOVED file-flow and fail/skip for that reason (W4 classified
TEST-ENV, left untouched). Rewrite them to the new answers-based contract, preserving their original
intent (fix fixtures/assertions — do NOT loosen what they verify):
- `backend/tests/patients/ficha-single-step.spec.ts:77` (assert respuestas path + estado, drop
  singleStepCompleted/archivoCompletado)
- `backend/tests/patients/jul11-date-normalization.spec.ts:79` (switch payload to respuestas)
- `backend/tests/instruments/instruments.spec.ts:246` (drop plantillaArchivo/versionPlantilla)
- `backend/tests/patients/patient-fichas.spec.ts` (28 skipped — modernize payloads to respuestas /
  completar endpoint; if a case is now meaningless, delete it with a one-line justification in the report)
Known pre-existing UNRELATED failure — do NOT touch, just confirm still failing and note:
`backend/tests/certificates/certificates.spec.ts:108` (GET filter 500s; predates this feature).

### 6. Gap report
`development/instrumentos-dynamic-fichas/tasks/W5-qa-validation/gap-report.md`: every bug/gap found
with exact repro + contract-section citation ("Expected X per §N, found Y"). Pre-logged items to
verify and INCLUDE (do NOT fix — source changes are not yours):
- Dead interface field `plantillaArchivo: string | null` at `frontend/app/pages/instrumentos/[id]/index.vue:34`
- Anything surfaced by steps 2–5

## Worker Self-Check
- Contract §4.3 contains "G2-11" → else BLOCKED (stale contract)
- `backend/tests/instruments-dynamic/` has 3 spec files → else BLOCKED
- TaskList shows #21 assigned to you → else BLOCKED

## Acceptance Criteria
1. All new/updated suites pass OR each failure is classified (BUG→gap-report / TEST-ENV / FLAKE) — zero unclassified.
2. E2E evidence for the 4 instruments listed, incl. both MNA paths.
3. G2-11 + 403 negative path covered with passing tests.
4. Legacy specs from step 5 run green under the new contract (before/after counts reported).
5. gap-report.md exists (possibly "no gaps found" + the pre-logged nit).

## Deliverables
1. `frontend/tests/instruments-dynamic/e2e-instruments.spec.ts` + updated `fill-flow.spec.ts`
2. `backend/tests/instruments-dynamic/qa-contract.spec.ts`
3. Modernized legacy specs (step 5 list)
4. `development/instrumentos-dynamic-fichas/tasks/W5-qa-validation/gap-report.md`
5. `development/instrumentos-dynamic-fichas/tasks/W5-qa-validation/completion-report.md` (+ progress-report.md during work)

## Boundaries
- Write ONLY: `backend/tests/**`, `frontend/tests/**`, your task dir.
- FORBIDDEN: `backend/src/**`, `backend/prisma/**`, `frontend/app/**`, contract §1–§7, other task dirs.
- No process restarts; never touch port 4142; backend :3101 auto-reloads (not by you — don't edit src).

## Completion Report Format
Deliverables table | Suite results verbatim (before/after counts for legacy modernization) | Failure
classification table (zero unclassified) | Gap summary (count + severity) | Deferred items.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "21", status: "in_progress")`.
2. Errors: MAX 2 distinct fix attempts → `## Strategy Request` in progress-report.md + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT.
3. Done: completion-report.md → `TaskUpdate(taskId: "21", status: "completed")` → `SendMessage(to: "main", message: "COMPLETE: W5-qa-validation done. Gaps: {N}. …", summary: "W5 complete")`.
4. Blocked: `SendMessage(to: "main", message: "BLOCKED: {exact}. Attempted: {…}. Need: {…}", summary: "W5 blocked")` + WAIT.
5. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-*. Never idle silently.
6. Never TaskCreate. After final COMPLETE, ignore echoes/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
