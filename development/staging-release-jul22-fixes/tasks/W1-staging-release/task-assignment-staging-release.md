# task-assignment — staging-release-jul22-fixes (full auto-chain)

## Role
**devops-infra**. Staging only. Profile `disruptive`, ALWAYS `--region us-east-1`.  
CodeDeploy group **`miempresa-staging` ONLY** — NEVER `miempresa-prod`.

## CWD
`/Users/jeik/ws/mi-empresa-app-development` or BLOCKED.

## Authorized
Developer: **create runbook + execute from beginning to end**.  
**Auto-chain R0→R6** — do **not** wait for PROCEED between phases.  
Send `CHECKPOINT: R{N} complete…` after each phase, then continue.

## Runbook (fill actuals)
`context/implementation-plan/staging-release-jul22-fixes-runbook.md`

## Pre-reads
1. Runbook above  
2. `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md` (patterns)  
3. `development/fixes-jul-22/06-handoff.md`  
4. `worker-deploy-learning.md` traps  

## Phase summary

| Phase | Action |
|---|---|
| R0 | Read-only preflight (git, 23 mig local+instance, health, buckets, amplify, codedeploy) |
| R1 | DB dump → `pre-releases/pre-jul22-fixes.sql.gz`; sync uploads if any |
| R2 | **SKIP** clean reset — document why; verify 23 mig + QA user presence |
| R3 | `seed-qa-staging.sh` idempotent + get-qa-creds (no passwords in runbook) |
| R4 | BE build → zip **including** `prisma/instrument-templates/*` → CodeDeploy miempresa-staging → Succeeded → on-instance **`npm run instruments:upgrade`** → health 200 → optional API smokes estado/instruments |
| R5 | `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --profile disruptive --region us-east-1` → Amplify SUCCEED → domains 200 |
| R6 | Canary C1–C4 (admin/contratos/gerontologa estado + asistencia regression) |

## Critical R4 packaging
Zip MUST include:
- `dist/` (built)
- `appspec.yml` at root
- `prisma/instrument-templates/` (all v1+v2+VALORACION)
- `prisma/schema.prisma`, migrations if appspec uses them
- `scripts/instruments-upgrade.ts` / package.json scripts
- Exclude: `node_modules`, local `.env` secrets as per prior pattern; on-instance may npm ci

## Hard rules
- No prod  
- No auto-rollback  
- No shadow migrate  
- No pkill node/tsx  
- No passwords in runbook/logs  
- PATH pg16 for dumps  
- AWS_PROFILE=disruptive for S3  

## Deliverables
1. Runbook fully filled with actuals  
2. `development/staging-release-jul22-fixes/tasks/W1-staging-release/progress-report.md`  
3. `development/staging-release-jul22-fixes/tasks/W1-staging-release/completion-report.md`  
4. Final: `SendMessage main: COMPLETE: staging-release-jul22-fixes done. R0–R6. Deploy d-… Amplify job N. Canary PASS/FAIL. See runbook + completion-report.`

## Progress
Append continuously to progress-report.md.

Start R0 NOW and run through R6 without waiting.
