# Intake: staging-release-jul18-nomina-asistencia

## Objective
Ship **nomina-asistencia-jul-18** (and full WT schema so clean reset lands at 23 migrations) to **staging only**, with full R0–R6 checkpoint gates, clean DB reset + seed-qa, and B34/B35 seed-qa script fixes in-wave.

## Developer decisions (2026-07-18)
1. DB: **full clean reset + seed**
2. Scope focus: **nomina-asistencia-jul-18** canary (package = working tree)
3. Gates: **full R0–R6** + feature canary
4. **Fix B34+B35** in same release

## Assumptions
- Staging still at post-jul17-2 (22 migrations) until R2/R4
- Local feature QA green (38/0)
- AWS profile `disruptive`, region `us-east-1`
- No prod

## Open questions resolved
See AskUserQuestion answers in conversation 2026-07-18.

## Known constraints
- No git commit unless asked
- Never auto-rollback
- Never shadow-database migrate diff
- Never CodeDeploy `miempresa-prod`
- OP-7 seed-qa required after reset

## Input sources
- jul17 / jul17-2 runbooks
- worker-deploy-learning.md
- nomina-asistencia-jul-18 handoff + contract
