# task-assignment-code (sfx-code)

## Your Role
You are **sfx-code** — backend engineer on team **team-security-fixes**. You implement the app +
frontend security fixes and their tests. IMPLEMENTATION task. Match existing code patterns.

## Project Context
Slug: security-fixes-backend · Working dir: development/security-fixes-backend/ · Worker prefix `sfx-`.
Orchestrator = `team-lead`. Ignore non-`sfx-*` tasks (team-tenancy `tnt-*`, prior team-security).

## Task Type / IDs
IMPLEMENTATION. Task ID **6**.

## Spec (authoritative — read fully)
`development/security-fixes-backend/orchestration-ctx/decisions/00-fix-contract.md` sections **D** and **E**.

## Source Files to Modify
- `backend/src/routes/uploads.routes.ts` — S2 download-url ownership check + `validate()`; S3 folder whitelist.
- `backend/src/services/s3Service.ts` — S4 `ContentLengthRange` in the presigned PUT policy.
- `backend/src/config/env.ts` — S1 remove `'dev-secret-change-me'` fallback; crash-fast if JWT_SECRET unset in production.
- `backend/src/app.ts` — S5 `crypto.timingSafeEqual` for x-origin-verify (length-checked).
- `backend/src/middleware/errorHandler.ts` — S8 drop `errors.constraint` from client response (keep server log).
- `frontend/app/plugins/access-denied.client.ts` — S6 `textContent` instead of `innerHTML`.
- Tests under `backend/tests/**` (+ frontend spec if pattern exists) proving each acceptance in D/E.

## Acceptance Criteria (verifiable)
1. Upload IDOR: a spec shows user A cannot presign-download user B's key → 403.
2. Disallowed `folder` → 400; presign PUT policy includes content-length range (≤ maxFileSizeBytes).
3. Missing `JWT_SECRET` in production throws at startup (unit test); local dev still works.
4. x-origin-verify: valid header passes, invalid → 403 (timingSafeEqual, no regression).
5. 409 conflict body no longer contains `constraint`; server log still has it.
6. access-denied plugin uses textContent (no innerHTML); 403 UX unchanged.
7. All new/existing backend tests pass locally (state the command + before/after counts).

## Boundaries
- Do NOT deploy, do NOT touch AWS/IaC/scripts (that is sfx-devops). Do NOT touch DB data.
- Preserve public API shapes except the intended S2/S3/S8 changes. Match existing patterns/tests.
- Work in the repo source; report under development/security-fixes-backend/tasks/W2-sfx-code/.

## FIRST ACTION
0. `pwd` — if not project root, BLOCKED to team-lead, STOP.
1. `TaskUpdate(taskId:"6", in_progress)`.
2. Read the fix contract §D/§E + the six source files + a couple of existing `backend/tests/*` specs for pattern.

## Deliverables
1. `development/security-fixes-backend/tasks/W2-sfx-code/completion-report.md`
2. The modified source files + new test specs (list them with the acceptance each satisfies).

## Reporting Protocol
- `message` is a PLAIN STRING + `summary`. Address `team-lead`, never `main`. Never `TaskCreate`.
- progress-report.md after each fix (durability). Max 2 self-repair attempts/error → TURNING-POINT-STRATEGY.
- On done: completion-report.md, `TaskUpdate(taskId:"6", completed)`, `SendMessage(to:"team-lead", message:"COMPLETE: W6 code fixes done. Files: ... Tests: X/Y pass. See tasks/W2-sfx-code/completion-report.md", summary:"sfx-code complete")`.
- Blocked: `SendMessage(to:"team-lead", message:"BLOCKED: {exact}. Need: {}", summary:"sfx-code blocked")`, WAIT.
- If a fix needs a shared-contract/behavior change beyond §D/§E → TURNING-POINT-BREAKING, do not expand scope silently.
