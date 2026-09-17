# Team Plan: staging-release-jul18-nomina-asistencia

## Context
- Intake + feature plan approved pending developer go on execute
- Runbook: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`

## Objective
Execute gated staging release (R-pre → R6) for nomina-asistencia-jul-18 with clean reset.

## Implementation Location
- Script fix: `backend/prisma/test-db/seed-qa-staging.sh`
- Runbook actuals: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`
- Reports: `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/`

## Work Streams

| ID | Stream | Worker | Role | Points | Deps |
|----|--------|--------|------|--------|------|
| T1 | B34/B35 seed-qa fix + R-pre verify | W1 | devops-infra | 2 | — |
| T2 | R0 preflight | W1 | devops-infra | 2 | T1 |
| T3 | R1 backups | W1 | devops-infra | 2 | T2 + PROCEED |
| T4 | R2 clean reset | W1 | devops-infra | 3 | T3 + PROCEED |
| T5 | R3 seed-qa | W1 | devops-infra | 2 | T4 + PROCEED |
| T6 | R4 backend CodeDeploy | W1 | devops-infra | 3 | T5 + PROCEED |
| T7 | R5 Amplify FE | W1 | devops-infra | 2 | T6 + PROCEED |
| T8 | R6 canary + completion | W1 | devops-infra | 3 | T7 + PROCEED |

**Max workers**: 1 (sequential gated release — parallelization not useful).

## Dependency Graph
```
T1 → T2 → [PROCEED] T3 → [PROCEED] T4 → [PROCEED] T5 → [PROCEED] T6 → [PROCEED] T7 → [PROCEED] T8
```

## Interface Contracts
- Staging only; CodeDeploy `miempresa-app` / `miempresa-staging`
- Runbook phases and evidence format are the contract
- Feature canary per runbook §R6

## Communication Plan
Worker → main only: CHECKPOINT / COMPLETE / BLOCKED / TURNING-POINT-BREAKING  
Orchestrator → worker: `PROCEED PHASE R{N}:` after human approval

## File ownership
W1 owns: seed-qa-staging.sh, runbook actuals sections, task reports, temporary deploy zips under /tmp  
W1 must NOT: touch prod, commit git, modify feature app code except seed-qa script, auto-rollback

## Wave reuse
Single worker through all phases (context = runbook). No fresh respawn between phases unless LOST.
