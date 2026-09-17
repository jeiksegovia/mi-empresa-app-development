# task-assignment — R1+ (respawn after R0)

## Your Role
**devops-infra** — checkpoint-gated staging release. Staging only. Profile `disruptive`, region `us-east-1`. Never `miempresa-prod`.

## Context
- Slug: `staging-release-jul18-nomina-asistencia`
- CWD: `/Users/jeik/ws/mi-empresa-app-development`
- R-pre + R0 **DONE** (B34/B35 fixed; preflight green). Prior worker SHUTDOWN.
- Developer: **PROCEED PHASE R1** (2026-07-19). **Do NOT start R2** until message `PROCEED PHASE R2:`.

## Read first
1. `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` (fill R1+ actuals)
2. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md`
3. jul17-2 runbook traps OP-1..OP-7, B27–B35

## FIRST ACTION
0. `pwd` = project root or BLOCKED
1. `TaskUpdate(taskId: "3", status: "in_progress")`
2. Execute **R1 only**

## R1 — Backups (authorized now)

1. `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"`
2. Tunnel via `db-tunnel.sh --stage staging --port 5433` (or proven pattern from jul17-2)
3. `pg_dump` → gzip → S3:
   `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz`
4. SHA256 of dump; verify `aws s3 ls`
5. Uploads: R0 saw **1 object** — `aws s3 sync` uploads bucket →  
   `s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul18-nomina/`
6. Fill runbook **R1 actuals** + checkpoint table
7. SendMessage main:
   `CHECKPOINT: R1 complete. Dump s3://…/pre-jul18-nomina-asistencia.sql.gz size=… sha=… Uploads synced (1 obj). AWAITING PROCEED PHASE R2.`
8. **WAIT** — do not run reset/seed/deploy until `PROCEED PHASE R2:` (then R3, R4, … each with PROCEED)

## Later phases (only after each PROCEED PHASE R{N}:)
- R2 clean reset (destructive, pre-authorized in plan — still needs PROCEED R2 message)
- R3 seed-qa OP-7 (fixed script)
- R4 CodeDeploy `miempresa-app` / `miempresa-staging` only
- R5 Amplify `d1nsxjyualdzdu`
- R6 canary C1–C4

## Constants
- Instance 54.144.25.72
- BACKUP_BUCKET=miempresa-backups-540657241795-staging
- AWS_PROFILE=disruptive for reset S3
- Never paste QA passwords
- Never auto-rollback / shadow migrate / pkill node

## On full R6 done
completion-report.md + `COMPLETE: W1-staging-release done. R1–R6 complete…`

## Progress
Append to `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/progress-report.md`

Start R1 NOW.
