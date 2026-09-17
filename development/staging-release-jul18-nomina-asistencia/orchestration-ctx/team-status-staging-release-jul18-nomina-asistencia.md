# Team Status: staging-release-jul18-nomina-asistencia
**Workers active**: 0  
**Last updated**: 2026-07-21 — RELEASE COMPLETE  
**Phase**: Converged — R-pre…R6 all green

## Worker Roster
| Name | Role | State | Prior |
|------|------|-------|-------|
| worker-staging | pt-devops-infra | SHUTDOWN | R-pre+R0 |
| worker-staging2 | pt-devops-infra | SHUTDOWN | R1 |
| worker-staging3 | pt-devops-infra | SHUTDOWN | R2 |
| worker-staging4 | pt-devops-infra | SHUTDOWN | R3 |
| worker-staging5 | pt-devops-infra | FORCE-KILLED | R4; shutdown tool schema bug |
| worker-staging6 | pt-devops-infra | SHUTDOWN | R5+R6 COMPLETE |

## Phase ledger
| Phase | Status | Key IDs |
|-------|--------|---------|
| R-pre | ✓ | B34/B35 seed-qa fixed |
| R0 | ✓ | 23 local / 22→23 instance after R2/R4 |
| R1 | ✓ | pre-jul18-nomina-asistencia.sql.gz 28726 B |
| R2 | ✓ | 23 mig, seed, pre-reset dump |
| R3 | ✓ | QA users 5/6/7 |
| R4 | ✓ | CodeDeploy **d-8OHAZOPOK** Succeeded |
| R5 | ✓ | Amplify **Job 10 SUCCEED** |
| R6 | ✓ | C1–C4 all PASS; nav-gating 5/5 |

## URLs
- API: https://miempresa-api-stg.disruptiveexp.com/api/v1
- FE: https://miempresa-stg.disruptiveexp.com
- Asistencia: https://miempresa-stg.disruptiveexp.com/asistencia

## Docs
- Runbook: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`
- Completion: `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/completion-report.md`
