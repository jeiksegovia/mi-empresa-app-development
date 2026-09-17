# Feature Plan: security-audit-backend

**Team**: team-security · worker prefix `sec-*` · **Slug**: `security-audit-backend`
**Coexists with**: team-tenancy (`tnt-*`, slug `domain-and-multi-tenant`) — see
`development/orchestration-conventions.md` §Active teams.

## Objective

Deliver an evidence-backed, severity-ranked security audit of the mi-empresa backend, its Lightsail
runtime, the FE-to-origin communication path, and frontend client-side security. Output is a
findings report + prioritized remediation plan. No code/infra changes this cycle. Staging == prod
copy, so approved fixes port to prod in a later cycle.

## Assumptions & constraints

- Live probing: staging only (`54.144.25.72`). Prod (`44.195.227.44`) via IaC/config parity.
- AWS profile `disruptive`, region `us-east-1`, read-only, every command stated. No mutations.
- Orchestrator (Opus) does the selective delicate analysis + severity verdicts; workers do the
  token-heavy evidence collection + static mapping (the developer's efficiency requirement).
- Report + plan only. No fixes.

## Existing patterns used

- **Orchestration ↔ context wiring**: `development/orchestration-conventions.md` (plan pointer in
  `context/implementation-plan/`, distilled findings to context on completion).
- **Contract-first**: `orchestration-ctx/decisions/00-findings-contract.md` is the shared finding
  schema; workers annotate against it, orchestrator adjudicates, consolidation assembles.
- **Gate-the-irreversible**: evidence collection is read-only and ungated; the only sensitive
  actions (AWS/SSH) are read-only describe/log-pull and get a plan-approval checkpoint before W1
  runs anything against staging.
- **Repo conventions**: IaC in `backend/infrastructure/db/`, SSH utilities in `.../utilities/`,
  reporting style from `context/implementation-plan/prod-release/summary-2026-09-16-resume.md`.

## Requirements

R1-R17 in `01-requirements-security-audit-backend.md` (route/middleware map, authN/authZ, injection,
file-upload, input validation, XSS, secrets, CORS/headers, error leak, DB exposure, SSH/firewall,
least-priv IAM, S3/SSM, transport, log intrusion triage, dependency surface).

## Technical approach — three waves, selective orchestrator

The developer's efficiency model: workers burn tokens enumerating and collecting; the orchestrator
spends its context only on the delicate verdicts, guided by the precise references workers surface.

### Wave 1 — parallel evidence collection (heavy token, workers)

**sec-devops-1** (`pt-devops-infra`) — LIVE STAGING + AWS INFRA EVIDENCE (R11-R16)
- Plan-approval gate BEFORE any live command: writes `proposed-plan.md` listing every read-only
  SSH + `aws`/`lightsail` describe command it intends to run; waits for `APPROVED:`.
- After approval, read-only only:
  - Lightsail firewall / instance port state (SSH allow-list? 5432 exposed?) -> `evidence/infra/`
  - Postgres bind address + reachability from outside (config on instance, `ss -tlnp`) 
  - IAM role + policies used by the instance / on-prem CodeDeploy registration; STS session
    lifetime; credential-refresh cron scope -> least-privilege assessment
  - SSM parameter path access scope; S3 bucket policy (public? scoped?)
  - `x-origin-verify` enforcement: curl origin with/without header (read-only) 
  - Pull pm2 / nginx / system logs; triage for RCE attempts, injection probes, auth brute-force,
    anomalous IPs -> `evidence/logs/` + intrusion-triage note
- Deliverable: `evidence/infra/*`, `evidence/logs/*`, candidate findings in contract format,
  `progress-report.md`, `completion-report.md`.

**sec-code-1** (`pt-research-arch`) — STATIC CODE + FRONTEND SECURITY MAP (R1-R10, R17)
- No live access. Pure static enumeration with file:line precision:
  - Route x middleware-chain table for all 13 route groups (auth/role/domain/validate per route)
  - authN gaps + authZ/RBAC mismatches vs `DOMAIN_ACCESS`
  - Injection surfaces: every `$queryRaw`/raw Prisma/string-built query, `child_process`, `fs`
    path use (esp. `uploads.routes.ts`) -> parameterized vs interpolated
  - Input validation coverage (validate.ts/zod vs raw body)
  - XSS sinks in `frontend/app/**` (`v-html`/`innerHTML`/raw render); token storage; CSP/headers
  - Secret handling (grep for hardcoded secrets, env sample hygiene, token signing source)
  - CORS + security headers (app + IaC); `errorHandler.ts` leakage
  - Light dependency pass: `npm audit` high/critical count
- Deliverable: `evidence/code-map/*` inventories, candidate findings in contract format, a
  ranked "delicate items for orchestrator review" shortlist with exact file:line, reports.

### Wave 2 — selective delicate analysis (orchestrator, no worker)

- Orchestrator reads only the shortlists + cited references (not the whole codebase), reproduces or
  reasons through each high-signal candidate, and writes per-domain **verdict decision records** in
  `orchestration-ctx/decisions/` assigning `final_severity` and CONFIRMED/PLAUSIBLE.
- Any borderline item needing one more live check -> a single targeted NEW-ASSIGNMENT back to
  sec-devops-1 (same-author, exact-repro).

### Wave 3 — consolidation (worker, light)

**sec-consolidate** (reuse `sec-code-1` if PARKED, else `pt-docs-integration`)
- Assemble `development/security-audit-backend/security-audit-report.md` from all evidence +
  orchestrator verdicts: executive summary, findings ranked by final_severity, each with repro +
  remediation + prod-parity, plus a prioritized remediation roadmap for the next (fix) cycle.
- Drop the context distillation `context/implementation-plan/security-audit-backend-findings.md`
  and the plan pointer.

## Risk & unknowns

- AWS describe permissions on `disruptive` may be partial -> log as evidence gap, not failure.
- Live log volume/retention on staging unknown -> triage the available window, state the window.
- SSH access to staging assumed working via repo utilities; if not, W1 blocks at the gate.

## Implementation scope

3 workers max (within `--workers` default+1 justified by parallel evidence + separate consolidation).
Points: sec-devops-1 = 8 (live infra + logs), sec-code-1 = 8 (full static map), sec-consolidate = 3.

## New artifacts proposed

**None runtime.** This cycle produces only documents (evidence files, decision records, the audit
report, context pointers). No new source code, services, secrets, binds, or flags. The
`no-improvising` list is therefore the document set enumerated in the context-map "Writes" table.

## Open items

- Confirm SSH key + `disruptive` describe access before W1 leaves its gate.
- Whether frontend dependency audit (`npm audit` in `frontend/`) is included — folded into R17 light pass.

## References

- `00-intake-security-audit-backend.md`, `01-requirements-security-audit-backend.md`
- `orchestration-ctx/decisions/00-findings-contract.md`
- `orchestration-ctx/context-map.md`
- `development/orchestration-conventions.md`
- `context/implementation-plan/prod-release/summary-2026-09-16-resume.md`
