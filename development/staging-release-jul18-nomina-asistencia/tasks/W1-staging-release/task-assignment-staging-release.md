# task-assignment-staging-release

## Your Role
You are **devops-infra** executing a **checkpoint-gated staging release**. Prod does not exist for this app; anything named `prod` is a **hard refuse**. AWS: profile `disruptive`, ALWAYS `--region us-east-1`.

## Project Context
Task slug: `staging-release-jul18-nomina-asistencia`  
Working directory: project root `/Users/jeik/ws/mi-empresa-app-development`  
You are Worker 1 (solo). Task IDs: **1** R-pre, **2** R0, **3** R1–R6 gated.

## MANDATORY FIRST READS (in order)
1. This file
2. `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` — **your runbook; fill actuals**
3. `context/implementation-plan/staging-deploy-checklist.md`
4. `context/implementation-plan/staging-release-jul17-2-runbook.md` — OP-1..OP-7, B27–B35
5. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md`
6. `development/nomina-asistencia-jul-18/06-handoff.md` — canary focus

## Task Type
IMPLEMENTATION (infra + one script fix)

## FIRST ACTION
0. `pwd` — must be project root (contains `.claude/settings.json`). Else BLOCKED.
1. `TaskUpdate(taskId: "1", status: "in_progress")`
2. Read runbook fully.

## Source Files to Modify
- `backend/prisma/test-db/seed-qa-staging.sh` — **B34 + B35 only**
- `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` — fill `## R* actuals`
- `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/progress-report.md`
- `development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/completion-report.md` (at end)

## Do NOT
- Touch prod / CodeDeploy group `miempresa-prod`
- `prisma migrate diff --shadow-database-url`
- Auto-rollback
- Git commit
- pkill node/tsx
- Proceed past a mutating phase without orchestrator message `PROCEED PHASE R{N}:`
- Paste QA passwords into runbook (emails + "password set" only)

---

## Task 1 — R-pre: Fix B34 + B35

### B34
Replace `declare -A EMAILS` / `PASSWORDS` with bash 3.2-safe storage (plain vars, parallel arrays, or case functions). Script must run under `/bin/bash` 3.2.

### B35
`put_param` must pass `--overwrite` to `aws ssm put-parameter`.

### Verify
```bash
bash -n backend/prisma/test-db/seed-qa-staging.sh
/bin/bash -n backend/prisma/test-db/seed-qa-staging.sh
! grep -n 'declare -A' backend/prisma/test-db/seed-qa-staging.sh
grep -n 'overwrite' backend/prisma/test-db/seed-qa-staging.sh
```

Fill runbook **R-pre actuals** + CHECKPOINT table.  
`TaskUpdate 1 completed` then start task 2.

---

## Task 2 — R0 preflight (read-only)

Execute runbook §R0.1–R0.9. Fill **R0 actuals** + checkpoint table.

Then:
```
SendMessage(to: "main", message: "CHECKPOINT: R0 complete. Local migrations=N, on-instance=M, health=… AWAITING PROCEED PHASE R1. See runbook R0 actuals.", summary: "R0 checkpoint")
```
`TaskUpdate 2 completed`.  
**WAIT** for `PROCEED PHASE R1:` before any R1 mutation.  
While waiting: `WAITING: for PROCEED PHASE R1` is OK.

---

## Task 3 — R1 through R6 (only after each PROCEED)

| Phase | Trigger | Action |
|---|---|---|
| R1 | `PROCEED PHASE R1:` | Backups; fill actuals; CHECKPOINT → wait R2 |
| R2 | `PROCEED PHASE R2:` | **Clean reset** (authorized). `AWS_PROFILE=disruptive`, BACKUP_BUCKET suffixed, PATH pg16. Fill actuals; CHECKPOINT → wait R3 |
| R3 | `PROCEED PHASE R3:` | seed-qa-staging.sh + get-qa-creds (no passwords in docs). CHECKPOINT → wait R4 |
| R4 | `PROCEED PHASE R4:` | Backend build + CodeDeploy **miempresa-staging only**. migrate status 23, health, asistencia domain smoke. CHECKPOINT → wait R5 |
| R5 | `PROCEED PHASE R5:` | Frontend Amplify. CHECKPOINT → wait R6 |
| R6 | `PROCEED PHASE R6:` | Feature canary C1–C4. completion-report. COMPLETE. |

### Hard constants
- Instance: `54.144.25.72` / `miempresa-backend-staging`
- Amplify: `d1nsxjyualdzdu`
- CodeDeploy: app `miempresa-app`, group `miempresa-staging`
- Backups: `miempresa-backups-540657241795-staging`
- After reset: **OP-7 seed-qa REQUIRED**
- Zip: appspec at root; no dist/generated in bad paths per prior runbooks

### CHECKPOINT message format
```
CHECKPOINT: R{N} complete. Key evidence: {1-3 bullets}. AWAITING PROCEED PHASE R{N+1}.
```

### On all done
```
COMPLETE: W1-staging-release done. Phases R-pre..R6 complete. See runbook actuals + tasks/W1-staging-release/completion-report.md
```
`TaskUpdate 3 completed`.

---

## Progress Reporting
`development/staging-release-jul18-nomina-asistencia/tasks/W1-staging-release/progress-report.md`

## Reporting Protocol
1. TaskUpdate on start of each task id
2. Append progress sections
3. Max 2 self-fix then TURNING-POINT-STRATEGY
4. Breaking → TURNING-POINT-BREAKING and WAIT
5. Never idle without COMPLETE/BLOCKED/WAITING/CHECKPOINT/TURNING-POINT-*
6. Never TaskCreate; never message other workers

## Pre-loaded traps (summary)
T1.1 region · T1.3 app name miempresa-app · B30 keyscan · B33 pg_dump PATH · B29 note() not log() · OP-7 seed-qa · never prod · never shadow migrate

Start NOW with task 1 (R-pre).
