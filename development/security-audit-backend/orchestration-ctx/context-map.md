# Context map: security-audit-backend

context/ and repo files this cycle reads (never edits, except the pointer it drops). Per
`development/orchestration-conventions.md`.

## Reads (canonical sources)

| Purpose | Path |
|---|---|
| Prod/staging live state, IDs, endpoints | `context/implementation-plan/prod-release/summary-2026-09-16-resume.md` |
| Staging release process (R0-R5) | `context/resume-session/summary-2026-09-08-prod-release.md` |
| Prod release runbooks + hard rules | `context/implementation-plan/prod-release/00-overview.md` |
| Backend app code | `backend/src/**` (routes, middleware, services, config) |
| IaC + deploy/cred scripts | `backend/infrastructure/db/**` |
| Frontend client code | `frontend/app/**`, `frontend/nuxt.config.ts` |
| Portable orchestration lessons | `development/orchestration-learnings/00-index.md` |

## Writes (this cycle)

| Artifact | Path |
|---|---|
| Comprehensive plan | `development/security-audit-backend/security-audit-backend-plan.md` |
| Plan pointer (context) | `context/implementation-plan/security-audit-backend-plan.md` |
| Evidence | `development/security-audit-backend/evidence/**` |
| Final report | `development/security-audit-backend/security-audit-report.md` |
| Report distilled to context | `context/implementation-plan/security-audit-backend-findings.md` (on completion) |
| Handoff | `development/security-audit-backend/06-handoff.md` |

## Live-target guardrails

- Staging only for probing: `54.144.25.72` (origin). Prod `44.195.227.44` = IaC parity only.
- AWS profile `disruptive`, region `us-east-1`, read-only, state every command.
