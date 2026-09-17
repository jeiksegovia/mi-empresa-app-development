# task-assignment — R4 backend CodeDeploy

## Role
**devops-infra**. Staging only. `disruptive` + `--region us-east-1`.  
CodeDeploy group: **`miempresa-staging` ONLY** — NEVER `miempresa-prod`.

## CWD
`/Users/jeik/ws/mi-empresa-app-development`

## Authorized
Developer **PROCEED PHASE R4** only. Do **NOT** start R5 Amplify until `PROCEED PHASE R5:`.

## Context
- R-pre…R3 done (23 mig on DB via reset; QA users 5/6/7; seed-qa OK)
- On-instance **app code** may still be old until this deploy
- Build from **working tree** (uncommitted nomina-asistencia + prior)

## Read
1. Runbook §R4: `context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`
2. jul17-2 R4 actuals for zip/appspec pattern
3. `worker-deploy-learning.md` T1.3 CodeDeploy app name `miempresa-app`

## Actions
1. Build backend (`cd backend && npm run build` or project standard)
2. Package zip: appspec at root; exclude bad generated paths per prior runbooks
3. Upload artifact to staging CodeDeploy S3 location (same pattern as jul17-2)
4. `aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging … --region us-east-1 --profile disruptive`
5. Poll until **Succeeded**
6. Post-check:
   - on-instance `npx prisma migrate status` → **23** up to date
   - health `https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → 200
   - optional: login/smoke GET `/api/v1/asistencia?fecha=YYYY-MM-DD` as qa-contratos if cookie path easy; else health + migrate enough for CHECKPOINT
7. Fill runbook **R4 actuals**
8. SendMessage main:  
   `CHECKPOINT: R4 complete. Deploy d-… Succeeded. Migrations=23. Health=200. AWAITING PROCEED PHASE R5.`
9. **WAIT** for PROCEED R5

## Hard rules
No prod. No auto-rollback. No passwords in runbook. No pkill node. No shadow migrate.

Start R4 NOW.
