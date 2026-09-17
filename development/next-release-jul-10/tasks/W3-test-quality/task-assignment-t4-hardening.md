# task-assignment-t4-hardening (W3, wave 1)

## Plan File
`development/next-release-jul-10/orchestration-ctx/team-plan-next-release-jul-10.md` — read first.
Origin: `development/improvements-jul-9/tasks/W4-test-quality/qa-report.md` §3.2 + §6 (items 1–3).

## Task Type
IMPLEMENTATION (test infra — tests are code)

## Task ID
`28`. `TaskUpdate(taskId: "28", status: "in_progress")` on start. Task #31 (QA wave) arrives later as NEW-ASSIGNMENT.

## Scope

### 1. jul4 suite origin migration (fixes 22 pre-existing TEST-ENV failures)
Root cause (qa-report §3.2): jul4 specs hardcode `http://localhost:3101/api/v1/...` in `page.request.*` calls while `loginAsAdmin(page)` sets the sameSite=strict cookie on the IP host (per `NUXT_PUBLIC_API_BASE`) → cross-origin → cookie not sent → 401.
Fix: in every `frontend/tests/local-qa/jul4-*.spec.ts`, replace hardcoded API URLs with the origin-aware helpers from `frontend/tests/helpers/auth.ts` (`getApiOrigin()` / `getApiBase()` — read the helper first for exact exports). Do NOT change what the tests assert — only where they point.

### 2. Port-3001 fixes
`backend/tests/patients/patient-notes.spec.ts` (`localhost:3001` — wrong port), `backend/tests/dashboard/*.spec.ts`, `backend/tests/auth/auth-empleado-link.spec.ts` — same treatment: env-var/helper-driven base URL, correct default `:3101`.

### 3. D3 spec (~30 lines)
NEW `backend/tests/employees/documento-identificacion.spec.ts`: PUT empleado with `documentoIdentificacionUrl` → 200; GET returns it; cleanup.

### 4. Verification run
- `TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 npx playwright test tests/local-qa/jul4-*.spec.ts` — target: the 22 TEST-ENV failures resolve (any residual failure = classify BUG vs TEST-ENV in report, do NOT fix source)
- Backend: run the repaired suites + new D3 spec

## Constraints
- Do NOT modify source code under `backend/src/` or `frontend/app/` — test files + helpers only
- Do NOT restart backend/frontend. Note: W1 is running migrations in parallel — if a run hits a transient 500, retry once
- Do NOT loosen assertions to force passes; classify residual failures
- No git commit

## Deliverables
1. Repaired spec files + new D3 spec
2. `tasks/W3-test-quality/result.md` — before/after pass counts per suite + residual-failure classification
3. `completion-report.md`, `progress-report.md`

## Acceptance Criteria
1. jul4 suite: ≥20 of 24 passing (was 2/24); every residual failure classified with evidence
2. Port-3001 suites runnable and green (or classified)
3. D3 spec passes
4. Zero source-code diffs outside tests/

## Reporting Protocol
Standard: TaskUpdate start/done; MAX 2 self-repair → TURNING-POINT-STRATEGY; BLOCKED + WAIT. On done: `SendMessage(to: "main", "COMPLETE: Hardening done. jul4 {before}→{after}. See tasks/W3-test-quality/result.md", summary: "T4 complete")`. Stay available for the wave-4 QA NEW-ASSIGNMENT (#31).
