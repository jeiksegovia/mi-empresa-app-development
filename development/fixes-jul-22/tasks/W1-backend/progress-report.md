# Progress: W1-backend
**Worker**: backend-eng (W1)
**CWD verified**: `/Users/jeik/ws/mi-empresa-app-development`

## Working TODO
- [completed] Task 3: inspect patient create/update routes, enforce CONTRATOS create state and RBAC state edits, write living schema contract
- [completed] Task 4: add/upgrade TINETTI.v2 and MNA_CUADRO.v2 templates and document scoring/cell inputs
- [completed] Task 5: add VALORACION_INTEGRAL.v1, expose template code, and wire seed/upgrade path
- [completed] Task 6: add backend patient/instrument smoke specs and run available checks

## Task 3 — ✓

### Discovery (2026-07-22)
- `authMiddleware` verifies JWT/session and exposes `req.user` (JWT has `id`/`rol`, not `tipoEmpleado`). `requireDomain('pacientes')` looks up and attaches `tipoEmpleado` for EMPLEADO callers; ADMIN bypasses the lookup.
- `CONTRATOS` already receives create-only domain enforcement for PUT/DELETE. The patient service currently trusts `input.estado` on create and update and has no actor argument.
- Existing instrument contract uses immutable JSON definitions, active `InstrumentoVersion`, and `group-info` pair answers. New MNA text matrix needs an explicit `cellInput: "text"` extension and `{rowId,columnId,value}` cells.
- TINETTI source confirms item 8 source labels/scores (0/1/0/1); item 11 source has two binary dimensions per foot. v2 will combine each foot into four exclusive combinations scored 0/1/1/2, preserving marcha max 12.

### Design decisions (non-breaking)
- Add a required `PatientActor` context to patient service create/update calls. The HTTP route derives it from the authenticated request after `requireDomain('pacientes')` enriches EMPLEADO callers with `tipoEmpleado`.
- `CONTRATOS` create ignores requested `estado` and persists `ACTIVO`; ADMIN/other allowed creators retain existing default/explicit behavior.
- Only ADMIN or EMPLEADO+GERONTOLOGA can include `estado` in update payload. Route maps a structured `PATIENT_STATE_FORBIDDEN` error to HTTP 403.
- Patient services require an explicit `PatientActor`; the HTTP routes always pass the auth/domain-derived context, making missing actor data a compile-time error.
- Extend group-info validation only when `cellInput: "text"`; legacy pair shape remains valid for v1 definitions.

### Completion evidence
- Living contract created at `orchestration-ctx/decisions/schema-contract-fixes-jul-22.md` with API rules, item ids/scores, text-cell shape, errors, and deviations.
- Patient service now forces ACTIVO for CONTRATOS create and rejects unauthorized estado updates with `PATIENT_STATE_FORBIDDEN`.
- API smoke added: `backend/tests/patients/patient-estado-rbac.spec.ts` (5 cases).
- `npm --prefix backend run typecheck` → exit 0.
- `npm --prefix backend exec -- playwright test tests/patients/patient-estado-rbac.spec.ts --list` → 5 tests listed.

## Task 4 — ✓

### Implementation
- Added immutable `backend/prisma/instrument-templates/TINETTI.v2.json`: item 8 merged to `eq_vuelta_360` (4 exclusive options, scores 0/1/0/1); item 11 merged to `ma_pie_derecho` + `ma_pie_izquierdo` (4 combinations each, scores 0/1/1/2).
- Adjusted TINETTI v2 maxima to equilibrio 15, marcha 12, total 27; classification top range is 25–27.
- Added immutable `backend/prisma/instrument-templates/MNA_CUADRO.v2.json` with `frecuencia_grupos.cellInput = "text"`.
- Extended backend group-info validation for 7×4 `{rowId,columnId,value}` text cells while preserving legacy one-selection-per-row behavior for v1/definitions without the flag.
- Updated template upgrade validation to accept only `cellInput: "select" | "text"`, and updated seed selection to choose the highest filename version.
- Updated existing scoring-engine fixtures for active TINETTI/MNA v2 behavior.

### Verification
- `npm --prefix backend run typecheck` → exit 0.
- `npm --prefix backend exec -- playwright test tests/instruments-dynamic/fixes-jul-22-templates.spec.ts` → 8 passed.
- `npm --prefix backend exec -- playwright test tests/instruments-dynamic/scoring-engine.spec.ts --list` → 26 tests compiled/listed.

## Task 5 — ✓

### Implementation
- Extracted the first workbook sheet (`VALORACIÓN INTEGRAL`, 95×9 cells) to `tasks/W1-backend/tmp/valoracion-integral-sheet.txt`; excluded sheets 2–14 and static footer branding.
- Added `backend/prisma/instrument-templates/VALORACION_INTEGRAL.v1.json` with 11 sections, 47 unique informational items, and `scoring.total = "none"`.
- Added `VALORACION_INTEGRAL` to route Zod `TEMPLATE_CODIGOS` and the typed `InstrumentTemplateCodigo` service union.
- Seed now includes 7 dynamic instruments and selects the highest filename version per codigo.
- Upgrade now creates missing template `Instrumento` rows after a read-only VERSION_LOCKED probe, applies all versions, and explicitly activates the highest repo version per codigo.

### Verification
- `npm --prefix backend exec -- tsc --noEmit ... backend/scripts/instruments-upgrade.ts backend/prisma/seed.ts` → exit 0.
- `npm --prefix backend run typecheck` → exit 0.
- `npm --prefix backend run instruments:upgrade` (local `localhost:15432/miempresa_dev`) → created VALORACION_INTEGRAL v1; inserted/activated TINETTI v2 and MNA_CUADRO v2; exit 0.
- Second `npm --prefix backend run instruments:upgrade` → all 9 definition files unchanged/no-op, highest versions already active; exit 0.
- `seed-definitions.spec.ts` → 4 passed, including 7 codigos and active versions.
- `scoring-engine.spec.ts` → 26 passed against active v2 definitions.
- `fixes-jul-22-templates.spec.ts` → 11 passed, including VALORACION_INTEGRAL shape and null scoring.

## Task 6 — ✓

### Smoke coverage
- Added `backend/tests/patients/patient-estado-rbac.spec.ts`: CONTRATOS force ACTIVO, create-only denial, plain EMPLEADO 403 code, GERONTOLOGA allow, ADMIN allow.
- Added `backend/tests/instruments-dynamic/fixes-jul-22-templates.spec.ts`: immutable v1/v2 structure, TINETTI score maxima, MNA 28-cell validation, VALORACION first-sheet shape/null scoring.
- Added `backend/tests/instruments-dynamic/fixes-jul-22-api.spec.ts`: definition endpoints, templateCodigo copy, TINETTI total 27, MNA text persistence/round trip, VALORACION completion.
- Updated existing seed/scoring/QA contract regressions for active TINETTI/MNA v2.

### Final verification
- Started the project dev server with the existing script on unique `PORT=3197`; did not touch the existing service on 3101. Stopped the specific background task after tests; `PORT_3197_STOPPED` verified.
- `npm --prefix backend run typecheck` → exit 0.
- `npm --prefix backend run build` → exit 0.
- Script-specific `tsc --noEmit ... instruments-upgrade.ts seed.ts` → exit 0.
- `npm --prefix backend run instruments:upgrade` → 9 templates validated, highest versions active, idempotent no-op.
- Six scoped Playwright specs → `60 passed (3.5s)` against `http://localhost:3197` and local DB `localhost:15432/miempresa_dev`.
- `git diff --check -- backend development/fixes-jul-22` → PASS.
- Verbatim combined output: `tasks/W1-backend/tmp/final-verification.log`.

### Reporting
- Project task report: `context/implementation-plan/fixes-jul-22-backend.md` (mandatory CLAUDE.md location; documentation-only exception to W1 source boundary).
- Final acceptance evidence: `tasks/W1-backend/completion-report.md`.

