# Feature Plan: staging-release-jul18-nomina-asistencia

## Objective
Checkpoint-gated staging release for nomina-asistencia-jul-18 with full DB reset, fixed seed-qa (B34/B35), CodeDeploy + Amplify, and RBAC/feature canary.

## Assumptions & Constraints
- Staging only (prod hard refuse)
- Runbook: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`
- Checklist: `context/implementation-plan/staging-deploy-checklist.md`
- Orchestrator never implements deploy mutations; devops worker does, gated by PROCEED

## Existing Patterns Used
| Pattern | Exemplar | Extension |
|---|---|---|
| R0–R6 release | jul17-2 runbook | Same phases + R-pre for B34/B35 |
| Trap preload | worker-deploy-learning.md | Include B34/B35 fix as code task |
| OP-7 seed-qa | jul17-2 R3 | After fix, re-run cleanly |
| Canary | RBAC 3 profiles | + Asistencia/Nómina feature paths |

## Requirements
1. B34/B35 fixed and verified before R3
2. Pre-reset backup in backups bucket
3. Clean reset → 23 migrations + canonical seed
4. seed-qa creates/updates 3 QA profiles
5. Backend deploy Succeeded; health 200; domain matrix on `/asistencia`
6. Frontend Amplify SUCCEED; custom domain 200
7. Canary C1–C4 pass or classified failures
8. Runbook actuals filled verbatim

## Technical Approach
Single **pt-devops-infra** worker, fresh spawn, assignment embeds full trap list + runbook path.  
Optional small **pt-backend-eng** or same devops worker for R-pre script edit (seed-qa only — isolated file).

Recommended: **one devops worker** owns R-pre code fix + all R phases (context is the runbook).

## Risk & Unknowns
| Risk | Mitigation |
|---|---|
| Clean reset wipes staging fichas/data | R1 dump + developer-authorized R2 |
| seed-qa still fails | B34/B35 fix + brew bash fallback documented |
| WT incomplete vs HEAD | R0 records migration count 23 |
| Cookie host for FE tests | Canary uses custom domain browser, not localhost |

## Implementation Scope
**In**: seed-qa script fix, staging AWS/DB/FE deploy, runbook actuals, canary  
**Out**: prod, git commit, auto-rollback, feature code changes (unless deploy blocker)

## New Artifacts Proposed
| Artifact | Why |
|---|---|
| Runbook jul18 | Instance of checklist for this ship |
| Optional patch `seed-qa-staging.sh` | B34/B35 |
| Task dir under `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/` | Worker reports |

## Open Items
None blocking after developer answers.

## References
- Runbook path above
- `development/nomina-asistencia-jul-18/06-handoff.md`

## Approval gate
**Approve** → create team-plan + spawn devops worker with R-pre first  
**Approve with changes** → revise  
**Cancel**
