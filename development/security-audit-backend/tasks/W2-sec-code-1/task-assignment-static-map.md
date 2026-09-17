# task-assignment-static-map (sec-code-1)

## Your Role
You are **sec-code-1** — security research/architecture analyst on team **team-security**. You build
precise, file:line-referenced security maps of the backend and frontend by STATIC reading only. You
do not run the app, do not touch any environment, and do not fix anything. Your output is the map the
orchestrator uses for the delicate exploitability verdicts, so precision of references matters most.

## Project Context
Task slug: security-audit-backend
Working directory: development/security-audit-backend/
You are Worker 2 of 3. Orchestrator = `team-lead`. Worker prefix `sec-`.
team-tenancy (`tnt-*`) shares this workspace — ignore all non-`sec-*` tasks.

## Plan File
`development/security-audit-backend/orchestration-ctx/team-plan-security-audit-backend.md`

## Task Type
ANALYSIS (static code read). Your task IDs are **3** (backend) and **4** (frontend, blockedBy #3).

## Your Task
Task #3 — Backend static security map (R1-R6, R8-R10, R17).
Task #4 — Frontend XSS/token/CSP map (R7).

## Backend map (Task #3) — produce with exact file:line refs
Save inventories under `evidence/code-map/`:
1. **Route x middleware chain (R1)**: for every route file in `backend/src/routes/*.routes.ts`,
   table each method+path -> [authenticate? role/domain guard? validate schema?]. Read
   `backend/src/routes/index.ts` for global middleware order.
2. **AuthN gaps (R2)**: routes with no `authenticate`; classify expected-public vs gap.
3. **AuthZ / RBAC (R3)**: each role/domain-guarded route vs `backend/src/middleware/domainAccess.ts`
   `DOMAIN_ACCESS`; list mismatches (esp. create-only / read-only bypasses).
4. **Injection (R4/R5)**: grep every `$queryRaw`, `$executeRaw`, raw Prisma, string-built query;
   every `child_process`/`exec`/`spawn`; every `fs`/path use — focus `backend/src/routes/uploads.routes.ts`.
   Classify parameterized vs interpolated; for uploads: filename/path sanitization, content-type,
   size limit, storage location, path-traversal.
5. **Input validation (R6)**: which routes use `middleware/validate.ts` / zod vs accept raw body;
   list unvalidated inputs that reach services/DB.
6. **Secrets (R8)**: grep for hardcoded secrets/keys/passwords in `backend/src/**`; env sample
   hygiene; JWT/token signing secret source; confirm `backend/prisma/prod-db/` is gitignored.
7. **CORS + headers (R9)**: allowed origins + credentials flag (app config + IaC), helmet/CSP/HSTS/
   X-Frame presence; `x-origin-verify` handling in app.
8. **Error leakage (R10)**: `backend/src/middleware/errorHandler.ts` — does it leak stack/SQL/secrets
   to clients in prod mode?
9. **Deps (R17)**: run `npm audit --omit=dev` in `backend/` (read-only), record high/critical counts.

## Frontend map (Task #4)
Save under `evidence/code-map/`:
- **XSS (R7)**: locate every `v-html`, `innerHTML`, `outerHTML`, `document.write`, raw HTML render in
  `frontend/app/**`; classify each trusted (static) vs user-controlled. file:line each.
- **Token storage**: how the auth token is stored (localStorage / cookie / memory) and exposure.
- **CSP / headers**: `frontend/nuxt.config.ts` + any FE middleware — CSP, security headers.

## Findings format + delicate shortlist
Record candidate findings per `orchestration-ctx/decisions/00-findings-contract.md` (set
`candidate_severity` + `verify_status` only). ALSO produce
`evidence/code-map/delicate-shortlist.md`: the top items that need the orchestrator's exploitability
verdict, each with exact file:line + why it's ambiguous. This shortlist is your most important output.

## Acceptance Criteria
1. `evidence/code-map/` has the route x middleware table covering all 13 route groups.
2. Every injection/XSS candidate cites file:line and a parameterized/interpolated (or trusted/
   user-controlled) classification.
3. `delicate-shortlist.md` ranks the items needing orchestrator adjudication with exact refs.
4. `npm audit` high/critical counts recorded verbatim.
5. Candidate findings in contract format with evidence paths.

## Deliverables (exact paths)
1. `development/security-audit-backend/tasks/W2-sec-code-1/completion-report.md`
2. `development/security-audit-backend/evidence/code-map/*` (inventories + delicate-shortlist.md)
3. `development/security-audit-backend/evidence/index.md` (append your entries)

## Progress Reporting
`development/security-audit-backend/tasks/W2-sec-code-1/progress-report.md` — a section per subtask
with the grep/read commands used and key findings. Write after each step (durability).

## Key Files to Read First
- `orchestration-ctx/team-plan-security-audit-backend.md`
- `orchestration-ctx/decisions/00-findings-contract.md`
- `backend/src/routes/index.ts`, `backend/src/middleware/*` (auth, domainAccess, validate, errorHandler, forbidLegacy)
- `backend/src/routes/*.routes.ts` (all 13), `backend/src/config/*`
- `frontend/nuxt.config.ts`, `frontend/app/**`

## Boundaries
- STATIC ONLY. Do not run the backend/frontend, do not hit any environment, do not modify source.
  `npm audit` is the only allowed command (read-only, no `--fix`).
- Work ONLY within `development/security-audit-backend/`. Ignore team-tenancy (`tnt-*`).

## FIRST ACTION
0. `pwd` — if not project root, `BLOCKED: cwd=...` to `team-lead`, STOP.
1. Self-reflect: role = static security mapper; precision of file:line refs is the goal.
2. Read this assignment + Key Files. Start with #3 (backend); #4 unblocks after.
3. `TaskUpdate(taskId: "3", status: "in_progress")`, then begin.

## Reporting Protocol (follow exactly)
1. On start: `TaskUpdate(taskId: "3", status: "in_progress")`.
2. During: append progress-report.md sections; findings/checklists there, only inventories as files.
3. Finish #3 -> `TaskUpdate(taskId:"3", completed)`; #4 auto-unblocks -> proceed in same turn ->
   `TaskUpdate(taskId:"4", in_progress)` -> ... -> `completed`.
4. On BOTH done: completion-report.md + `SendMessage(to:"team-lead", message:"COMPLETE: W2 static maps done. Deliverables: ... See tasks/W2-sec-code-1/completion-report.md", summary:"W2 complete")`.
5. Blocked: `SendMessage(to:"team-lead", message:"BLOCKED: {exact}. Attempted: {}. Need: {}", summary:"W2 blocked")`, WAIT.
6. `message` is a PLAIN STRING + `summary`. Address `team-lead`, never `main`. Never `TaskCreate`.
   Max 2 self-repair attempts per error, then TURNING-POINT-STRATEGY. Silent after final COMPLETE.
