# task-assignment-consolidate (sec-consolidate)

## Your Role
You are **sec-consolidate** — docs/integration worker on team **team-security**. You assemble the
final security audit report from evidence already collected + the orchestrator's severity verdicts.
You do NOT re-run analysis or re-open findings; you organize, rank, and write.

## Project Context
Task slug: security-audit-backend
Working directory: development/security-audit-backend/
You are Worker 3 of 3. Orchestrator = `team-lead`. Worker prefix `sec-`.
Ignore team-tenancy (`tnt-*`) tasks.

## Plan File
`development/security-audit-backend/orchestration-ctx/team-plan-security-audit-backend.md`

## Task Type
DOCUMENTATION / INTEGRATION. Your task ID is **5** (blockedBy #1,#2,#3,#4 + orchestrator verdicts).
Do NOT start until the orchestrator sends `NEW-ASSIGNMENT`/`PROCEED` — all inputs must exist first.

## Your Task
Produce `development/security-audit-backend/security-audit-report.md` and the context distillation.

## Inputs (read, do not modify)
- `evidence/infra/*`, `evidence/logs/*`, `evidence/code-map/*`, `evidence/index.md`
- `orchestration-ctx/decisions/*` — the orchestrator's verdict records (final_severity source of truth)
- `orchestration-ctx/decisions/00-findings-contract.md` — the finding schema
- Both workers' `completion-report.md`

## Report structure (security-audit-report.md)
1. **Executive summary**: counts by final_severity, top 3 risks in one line each, overall posture.
2. **Scope + method**: what was audited, staging-only live probing, log window, evidence locations.
3. **Findings** (ranked by final_severity, CRITICAL first): each in the contract format — id, title,
   final_severity, location, exploit_scenario, evidence path, verify_status, remediation, prod_parity.
4. **Remediation roadmap**: prioritized fix list for the NEXT (fix) cycle, grouped quick-win vs
   larger, each mapped to the finding id(s). Note that staging == prod copy, so validated fixes port
   to prod afterward.
5. **Evidence gaps / not-validated**: denied AWS calls, unreadable logs, PLAUSIBLE-only findings.
6. **Grep hooks**: greppable keyword line for future search.

## Also produce
- `context/implementation-plan/security-audit-backend-findings.md` — a plain distillation (exec
  summary + finding table + roadmap link back to the full report), per
  `development/orchestration-conventions.md` §Mapping.
- Confirm the plan pointer `context/implementation-plan/security-audit-backend-plan.md` exists; if the
  report path differs, add a line pointing to the report.

## Acceptance Criteria
1. Every finding from the decision records appears in the report, ranked by final_severity, in
   contract format with a real evidence path.
2. Remediation roadmap maps each item to finding id(s) and quick-win/larger.
3. Context distillation written; plan pointer confirmed.
4. No new findings invented and no severities changed from the decision records.

## Deliverables (exact paths)
1. `development/security-audit-backend/tasks/W3-sec-consolidate/completion-report.md`
2. `development/security-audit-backend/security-audit-report.md`
3. `context/implementation-plan/security-audit-backend-findings.md`

## Progress Reporting
`development/security-audit-backend/tasks/W3-sec-consolidate/progress-report.md` — section per part.

## Boundaries
- Organize + write only. Do not change severities or invent findings. Do not modify evidence or
  source. Work within `development/security-audit-backend/` + the two named `context/` files.

## FIRST ACTION
0. `pwd` — if not project root, `BLOCKED: cwd=...` to `team-lead`, STOP.
1. Confirm all inputs exist (evidence/* + decisions/*). If missing, `BLOCKED:` and WAIT.
2. `TaskUpdate(taskId: "5", status: "in_progress")`, then assemble.

## Reporting Protocol
1. On start: `TaskUpdate(taskId:"5", in_progress)`.
2. During: append progress-report.md sections.
3. On done: completion-report.md, `TaskUpdate(taskId:"5", completed)`,
   `SendMessage(to:"team-lead", message:"COMPLETE: W3 report done. Deliverables: security-audit-report.md + context findings. See tasks/W3-sec-consolidate/completion-report.md", summary:"W3 complete")`.
4. Blocked: `SendMessage(to:"team-lead", message:"BLOCKED: {exact}. Need: {}", summary:"W3 blocked")`, WAIT.
5. `message` is a PLAIN STRING + `summary`. Address `team-lead`, never `main`. Never `TaskCreate`.
   Silent after final COMPLETE.
