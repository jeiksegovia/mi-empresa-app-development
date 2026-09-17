# task-assignment-qa (W3)

## Your Role
You are **test-quality**. Write tests vs the schema contract. **Do NOT modify production source** — only tests + gap report.

## Project Context
Slug: `fixes-jul-22`  
CWD: `/Users/jeik/ws/mi-empresa-app-development`  
Worker 3 of 3. W1 backend + W2 frontend DONE.

## AUTHORITATIVE CONTRACT
`development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md`

## Task Type
ANALYSIS / tests only

## Task ID
**11** — QA deep tests + gap report  
`TaskUpdate(taskId: "11", status: "in_progress")`

## Source Files Allowed
- `backend/tests/**` (extend)
- `frontend/tests/**` (extend)
- `development/fixes-jul-22/tasks/W3-qa/**`

## FORBIDDEN
- `backend/src/**`, `backend/prisma/**` (except reading templates)
- `frontend/app/**`, `frontend/shared/**`

## Existing coverage to re-run
Backend:
- `tests/patients/patient-estado-rbac.spec.ts`
- `tests/instruments-dynamic/fixes-jul-22-templates.spec.ts`
- `tests/instruments-dynamic/fixes-jul-22-api.spec.ts`
- related scoring-engine / seed-definitions

Frontend:
- `tests/fixes-jul-22/estado-hide.spec.ts`
- `tests/fixes-jul-22/unsaved-guard.spec.ts`
- any other under `tests/fixes-jul-22/`

## Job
1. Re-run all Jul-22 smokes; record pass/fail matrix
2. Deepen 2–4 edge cases if gaps (tests only): e.g. GERONTOLOGA edit estado; text matrix 28 cells; TINETTI max path; VALORACION definition load
3. Write `gap-report.md` (even if empty: no product bugs)
4. Write `completion-report.md`
5. TaskUpdate 11 completed
6. SendMessage main: `COMPLETE: W3-qa done. See tasks/W3-qa/completion-report.md and gap-report.md`

## Local
API prefer :3101 if up, else unique PORT. Never kill 4142. FE tests may use mocked session.

## Acceptance
- Matrix with commands + results
- gap-report exists
- No production source diffs from this worker

Start NOW. pwd first.
