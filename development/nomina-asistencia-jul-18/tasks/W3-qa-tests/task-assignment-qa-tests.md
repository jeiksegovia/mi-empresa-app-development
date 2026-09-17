# task-assignment-qa-tests

## Your Role
You are **test-quality**. Write comprehensive tests vs the schema contract. Validate acceptance criteria. **Do NOT modify production source** — only tests + gap report. Failing tests caused by real bugs go in the gap report.

## Project Context
Slug: `nomina-asistencia-jul-18`
CWD: `/Users/jeik/ws/mi-empresa-app-development` (project root)
Wave 3 — QA only. Backend + FE implementation done.

## AUTHORITATIVE CONTRACT
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`

Also: `development/nomina-asistencia-jul-18/01-requirements-nomina-asistencia-jul-18.md` R1–R25

## Task Type
ANALYSIS / IMPLEMENTATION (tests only)

## Task ID
**12** — QA deep tests + gap report  
`TaskUpdate(taskId: "12", status: "in_progress")`

## Source Files to Modify (tests ONLY)
- Extend/add under `backend/tests/employees/`, `backend/tests/asistencia/`, `backend/tests/nomina/`
- Extend/add under `frontend/tests/asistencia/`, `frontend/tests/nomina/`, `frontend/tests/rbac/`, `frontend/tests/e2e/` if needed
- Gap report: `development/nomina-asistencia-jul-18/tasks/W3-qa-tests/gap-report.md`
- completion-report.md in same task dir

## Do NOT touch
- `backend/src/**`, `backend/prisma/**` (except reading)
- `frontend/app/**`, `frontend/shared/**` (except reading)
- Any production implementation

## Existing smoke (already green on BE)
- backend/tests/employees/medio-pago.spec.ts
- backend/tests/employees/contrato-valor-jornada.spec.ts
- backend/tests/asistencia/asistencia-dia.spec.ts
- backend/tests/nomina/nomina-calc-asistencia.spec.ts
- frontend/tests/asistencia/registrar-hoy.spec.ts
- frontend/tests/nomina/dialog-enrichment.spec.ts
- frontend/tests/rbac/* already mentions Asistencia

## Your job
1. Re-run all existing smoke suites; record results.
2. Deepen coverage against contract: edge cases (aportes on OPS 400, dual-write salario, resumen sums, pendiente idempotent, day board without contract, valorJornada missing on create).
3. FE: if frontend :3100 up, run registrar-hoy + dialog + rbac; else document skip + API-level verification.
4. Write gap-report.md: each gap with exact repro, expected vs actual, severity. Do NOT fix.
5. Classify failures: BUG / TEST-ENV / FLAKE.

## Acceptance
- All runnable specs executed; pass/fail matrix in completion-report
- gap-report.md exists (even if empty: "no gaps")
- No production source diffs from your session

## Reporting Protocol
1. TaskUpdate 12 in_progress
2. progress-report.md sections
3. On done: completion-report + gap-report + TaskUpdate 12 completed
4. SendMessage main: `COMPLETE: W3-qa-tests done. See tasks/W3-qa-tests/completion-report.md and gap-report.md`
5. Never idle without COMPLETE/BLOCKED/WAITING/TURNING-POINT-*

## Local
- API: http://localhost:3101 — do not kill port 4142
- FE: http://localhost:3100
- Login: admin@miempresa.com / <redacted>

Start now. Cwd check first.
