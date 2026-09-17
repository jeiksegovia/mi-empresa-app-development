# task-assignment — R2 clean reset (respawn)

## Role
**devops-infra**. Staging only. `disruptive` + `--region us-east-1`. NEVER `miempresa-prod`.

## CWD
`/Users/jeik/ws/mi-empresa-app-development` or BLOCKED.

## State
- R-pre, R0, R1 **DONE**
- R1 dump: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul18-nomina-asistencia.sql.gz` (28726 B, SHA 6353cc8a…)
- Developer: **PROCEED PHASE R2** (2026-07-19)
- **Do NOT start R3+** until `PROCEED PHASE R3:`

## Read
1. `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` §R2
2. `backend/infrastructure/db/scripts/reset-staging-db.sh` --help / header
3. jul17-2 R2 actuals (AWS_PROFILE=disruptive for script S3)

## R2 actions (authorized destructive)
```bash
export AWS_PROFILE=disruptive
export BACKUP_BUCKET=miempresa-backups-540657241795-staging
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
# Use tunnel if script needs local DB URL — match jul17-2 / script docs

echo "reset staging" | ./backend/infrastructure/db/scripts/reset-staging-db.sh \
  --stage staging --profile disruptive --region us-east-1
# exact flags per --help; record verbatim
```

### Expect
- Pre-reset dump by script
- DROP + migrate deploy **23** migrations
- db:seed canonical
- OP-7 reminder at end (seed-qa = R3, not now)

### After R2
1. Fill runbook **R2 actuals** (migration count, seed, row samples)
2. SendMessage main:  
   `CHECKPOINT: R2 complete. Migrations=23, seed OK, rows=…. AWAITING PROCEED PHASE R3.`
3. Append progress-report.md
4. **WAIT** — do not seed-qa / deploy until PROCEED R3

## Hard rules
No prod, no auto-rollback, no passwords in docs, no shadow migrate, no pkill node.

Start R2 NOW.
