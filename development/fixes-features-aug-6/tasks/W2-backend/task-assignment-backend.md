# task-assignment-backend

## Your Role
You are **worker-2 · pt-backend-eng** — backend for fixes-features-aug-6, implementing to the published contract. You do NOT touch frontend or schema.prisma (W1 owns the enum). You MAY edit `backend/scripts/instruments-upgrade.ts`, `backend/src/**`, and `backend/tests/**`.

## Project Context
Project root: `/Users/jeik/ws/mi-empresa-app-development`. Worker 2 of 3. W1 published the contract. Implement to it — do NOT read schema/matrix for facts; the contract has them.

## THE CONTRACT (authoritative — read FULLY first)
`development/fixes-features-aug-6/orchestration-ctx/decisions/contract-fixes-features-aug-6.md`
- §1 enum · §2 DOMAIN_ACCESS matrix + `read-only` value + MATRIX_TIPOS · §3 rolesPermitidos fix + create-default · §4 notes privacy · §5 templates validation · §6 acceptance.

## Task Type
IMPLEMENTATION

## Your Tasks (TaskList ids)
- **T4 (id 4)** — `domainAccess.ts`: add `read-only` value + branch, PROFESORES/AUXILIARES rows, GERONTOLOGA certificados→true, extend MATRIX_TIPOS (contract §2).
- **T5 (id 5)** — rolesPermitidos fix + gerontologa create bug (contract §3).
- **T6 (id 6)** — notes privacy: autor filter + block PUT/DELETE for new roles (contract §4).
- **T7 (id 7, blockedBy 2,3,4,5,6)** — backend Playwright tests (all of the above + 2 new instruments upgrade).

## FIRST ACTION
0. `pwd` = project root (else BLOCKED + STOP). 1. Fresh session → skip /compact. Read this file + the contract fully. `TaskUpdate(taskId:"4", status:"in_progress")`.

## ⚠️ T5 — diagnose the bug by REPRODUCTION before fixing (do NOT trust a single hypothesis)
The contract §3.1 offers ONE hypothesis (rolesPermitidos intersection). **Verify it — it may be incomplete**: the caller CSV `EMPLEADO,GERONTOLOGA` WOULD intersect the `ADMIN,EMPLEADO` seed on the `EMPLEADO` token, so that alone may not 403. The user's symptom is **"instrument created WITHOUT definition / 'no instrument selected'"** — which points to the **definition/version not being attached** (templateCodigo not reaching the service, or the deep-copy path), possibly PLUS the rolesPermitidos gate on fill.
- Reproduce with qa-gerontologa locally (login qa-gerontologa@miempresa.com; local backend :3101; get password from local seed — check `backend/prisma/test-db/seed-qa.ts` defaults or use admin to inspect). POST /instruments with `templateCodigo:'TINETTI'`, then GET the created instrument + `/instruments/TINETTI/definition`, and the fill/records path. Capture verbatim which step fails and why.
- Fix the ACTUAL root cause of the missing definition AND implement the contract §3 rolesPermitidos hardening (explicit ADMIN bypass + correct token match + create-default includes creator tokens). Document repro + true root cause in progress-report.md.

## Key files
- `backend/src/middleware/domainAccess.ts` (T4).
- `backend/src/services/instrumentService.ts` (~552-585 getInstrumentDefinition; create endpoint ~340-380) + `backend/src/routes/instruments.routes.ts` (~165 definition GET, ~204 POST create, records paths) (T5).
- `backend/scripts/instruments-upgrade.ts` (~313 rolesPermitidos seed default; extend to read template top-level `rolesPermitidos`) (T5/T7).
- `backend/src/routes/patients.routes.ts` (notes endpoints; T6).
- Test patterns: `backend/tests/rbac/*.spec.ts`, `backend/tests/instruments-dynamic/*.spec.ts`, `backend/tests/employees/empleado-bloqueo.spec.ts` (auth/login pattern).

## Acceptance criteria (contract §6)
1. domainAccess: `read-only` honored (GET ok, other→403 DOMAIN_FORBIDDEN); PROFESORES/AUXILIARES rows match contract §2.2; GERONTOLOGA certificados=true; MATRIX_TIPOS extended.
2. Gerontologa repro fixed: create instrument from TINETTI → definition present → fillable (GET definition 200, was failing). Explicit ADMIN bypass; new-role tokens recognized.
3. Notes: PROFESORES/AUXILIARES LIST returns only own; POST ok; PUT/DELETE→403; ADMIN+GERONTOLOGA unfiltered.
4. `npm run instruments:upgrade` activates SIGNOS_VITALES + BOLETIN_ANUAL with `rolesPermitidos = ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES` (from template top-level field).
5. Backend specs green; classify any failure BUG/TEST-ENV/FLAKE (pre-existing port-3001 = TEST-ENV).

## Traps
- Never pkill node/tsx (prod bun :4142); local backend :3101 (tsx watch auto-reloads); db :15432. instruments:upgrade guards deployed-stage DBs (local fine). W1's enum migration must be applied before your tests reference the new tipos — T7 is blockedBy T2.

## Reporting protocol
TaskUpdate in_progress/completed. Per subtask append to `development/fixes-features-aug-6/tasks/W2-backend/progress-report.md`. MAX 2 self-repair then TURNING-POINT-STRATEGY. If the true bug root cause contradicts the contract §3.1 → note it in progress-report and proceed with the real fix (not a breaking contract change unless the field names/matrix change). On completion: completion-report.md + `SendMessage(to:"main","COMPLETE: W2 done. Deliverables + true bug root cause: {…}")`. Never TaskCreate.

## Deliverables
1. `development/fixes-features-aug-6/tasks/W2-backend/completion-report.md`
2. Edited domainAccess.ts, instrumentService.ts, instruments-upgrade.ts, patients.routes.ts + new backend specs.
