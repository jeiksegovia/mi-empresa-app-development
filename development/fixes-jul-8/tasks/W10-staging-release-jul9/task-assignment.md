# task-assignment — Staging release jul-9

## Task Type
IMPLEMENTATION (IaC + DB migration + backend + frontend deploy against staging)

## Task ID
Your task ID is `41`. Call `TaskUpdate(taskId: "41", status: "in_progress")` on start.

## Your Task
Plan, sanity-check, and execute the release of the jul-7/8 changes to the STAGING environment, following the pattern established in `context/implementation-plan/staging-release-jul5-runbook.md`. Produce a jul-9 runbook that captures every command executed and its verbatim output. **Stop and report between phases** — the orchestrator (main) reviews and explicitly says "PROCEED PHASE R{N+1}:" before you continue.

## Context
- **Baseline HEAD**: `48029ef` — the "jul-7 storage + jul-8 UX fixes + Android tab-discard" commit
- **Prior release tag**: `staging-jul5-snapshot` — Amplify Job 2, deployment `d-4652ODYEK` at that state
- **Local baseline**: backend :3101 + frontend :3100 both healthy; 14 migrations applied; DB up-to-date
- **New Prisma migration to deploy on staging**: `20260709025844_add_certificado_update` (the only migration since jul-5 that isn't already on staging — verify with `prisma migrate status` against staging DB)
- **Staging AWS**: profile `disruptive`, region `us-east-1` (MUST pass `--region us-east-1` — profile has no default region)
- **Staging instance IP** (from jul-5 runbook): `54.144.25.72` — verify still current via `aws lightsail get-instances` before ssh
- **CodeDeploy application**: `miempresa-api-staging` (from jul-5)
- **Amplify app**: (see jul-5 runbook — same app id)

## Learnings from jul-5 runbook (apply these)
1. **SSM/aws commands always take `--region us-east-1`** — `disruptive` profile has no default region → exit code 253 without it
2. **`ssh-to-instance.sh` is interactive-only** (positional arg, no `--command` support). For remote command exec, use direct SSH:
   ```
   ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 "command"
   ```
3. **CFN `CommaDelimitedList` params** — pass as ONE quoted `Key=Value` string in `--parameter-overrides`
4. **`after-install.sh` handles Prisma client on-instance** — `dist/generated` is intentionally absent from artifact zip (script runs `npx prisma generate` then `cp -R src/generated dist/generated`, validated at line 142). Do NOT attempt to include it in the zip.
5. **Prisma migration lock gotcha** — the jul-8 W2 delete-one-row cleanup may already have been performed on local DB (row `20260704173358_f2_cert_empleado_generic`). If applying migrations on STAGING fails with the same shape, run the same single-statement cleanup on the staging Postgres.
6. **`sudo -u postgres pg_dump`** prints "could not change directory to /home/ec2-user" — this is a permission warning, NOT an error; the dump still succeeds.
7. **`deploy-frontend.sh`** runs `nuxt generate`, zips `.output/public` CONTENTS (not the folder itself), uploads to the frontend artifacts bucket, calls `amplify start-deployment`.
8. **Migration risk gate at R0** — check row counts on tables that a migration touches before applying. New `CertificadoUpdate` table is greenfield (empty by design), so risk is essentially zero, but confirm no other pending migration exists.

## IaC delta since jul-5 (analyze in R1)
- **`s3-stack.yml`** — was already deployed to staging in jul-5. Staging bucket allowlist already scoped to staging domain + localhost. **No change needed** unless a new staging origin was added (verify via `aws s3api get-bucket-cors` on `miempresa-uploads-540657241795-staging`).
- **`edge-stack.yml`** (NEW file in tree) — verify whether this is already deployed to staging. If NOT deployed on staging, this is a new stack and needs `cloudformation deploy` with careful review (report to orchestrator BEFORE deploying, since new stack = new resources).
- **`deploy-infrastructure.sh`** — added `DEV_LOCAL_ORIGINS` block for STAGE=dev. Staging path unchanged. Confirm by reading the current script.
- **`backend/src/*` app code** — many changes (cert routes/service, patients Zod + VENCIDO transition, instruments Zod refine, nomina service). Non-IaC — deploys via CodeDeploy in R3.

## Phase plan (report + wait for approval between EACH mutating phase)

### R0 — Local sanity + risk gate (READ-ONLY, no wait)
1. Confirm baseline: `git rev-parse HEAD` = `48029ef*`, working tree state summarized
2. Local: `npx prisma migrate status` in backend/ → expect "Database schema is up to date"
3. Local: run full `local-qa` suite (or spot-check jul8-*.spec.ts) → capture pass/skip count
4. Local: `curl /api/v1/health` → 200
5. Staging: `aws ssm get-parameter --name /miempresa/staging/api/DATABASE_URL --with-decryption --region us-east-1 --profile disruptive` to get connection string
6. Staging: from a tunnel or local, verify `prisma migrate status` against STAGING DB (use DATABASE_URL from SSM). Expect: all pre-jul-8 migrations applied, `20260709025844_add_certificado_update` pending.
7. Staging: `SELECT COUNT(*) FROM certificados_empresa;` on staging DB (row count for migration risk analysis)
8. Staging: `aws lightsail get-instances --region us-east-1 --profile disruptive` — verify instance name + current public IP
9. Staging: `aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging --region us-east-1 --profile disruptive` — record current CORS
10. Staging: `aws cloudformation describe-stacks --stack-name miempresa-s3-staging --region us-east-1 --profile disruptive` — verify `UPDATE_COMPLETE`
11. Check if `miempresa-edge-staging` stack exists — describe-stacks; if NOT, edge-stack.yml has never been deployed to staging → report to orchestrator BEFORE R1

**End R0**: SendMessage `CHECKPOINT: R0 sanity done. Migration risk: {row-count}. Edge stack status: {exists|absent}. Pending migrations: {list}. Report + waiting.` Do NOT proceed until orchestrator says "PROCEED PHASE R1:".

### R1 — IaC deploy (WAIT for approval)
1. If `miempresa-edge-staging` stack does NOT exist: DO NOT deploy it in this release — flag to orchestrator, defer for a dedicated release
2. Otherwise: `aws cloudformation deploy --template-file backend/infrastructure/db/cloudformation/s3-stack.yml --stack-name miempresa-s3-staging --parameter-overrides ProjectName=miempresa Environment=staging` → typically "No changes to deploy" (staging CORS should be unchanged)
3. Verify: `describe-stacks` → `UPDATE_COMPLETE` (or "No changes")
4. Send CHECKPOINT and wait

### R2 — DB backup (WAIT for approval before proceeding to R3)
1. SSH to instance, run `sudo -u postgres pg_dump miempresa | gzip > /tmp/pre-jul9-migration.sql.gz`
2. Check size: `ls -la /tmp/pre-jul9-migration.sql.gz` (expect >5KB)
3. Upload to staging backups bucket: `aws s3 cp /tmp/pre-jul9-migration.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz`
4. Verify: `aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/`
5. Send CHECKPOINT and wait

### R3 — Backend deploy (WAIT for approval)
1. From project root: `cd backend && npm ci && npm run build`
2. Verify `dist/` produced. Verify `dist/generated` is NOT in the tree (as expected).
3. Package: create zip with `appspec.yml` at bundle ROOT + `dist/` + `prisma/` + `node_modules/` + `package.json`, following prior artifact pattern
4. Upload artifact zip to `s3://miempresa-artifacts-540657241795-staging/deployments/jul9-{timestamp}.zip`
5. Create CodeDeploy deployment: `aws deploy create-deployment --application-name miempresa-api-staging --deployment-group-name <group> --s3-location bucket=miempresa-artifacts-540657241795-staging,key=<uploaded-key>,bundleType=zip --region us-east-1 --profile disruptive`
6. Wait: `aws deploy wait deployment-successful --deployment-id <id>` (up to 10 min)
7. Post-deploy verification via SSH:
   - `npx prisma migrate status` on-instance → expect ALL migrations applied including `20260709025844_add_certificado_update`
   - `SELECT COUNT(*) FROM certificados_empresa_updates;` — should be 0 (new table, empty)
   - `pm2 list` — expect miempresa-api online
   - `curl -sI https://miempresa-api-stg.disruptiveexp.com/api/v1/health` (with any needed CloudFront origin verify header) → 200
8. Send CHECKPOINT and wait

### R4 — Frontend deploy (WAIT for approval)
1. `cd frontend && npm ci` (skip if already fresh)
2. `NUXT_PUBLIC_API_BASE=https://miempresa-api-stg.disruptiveexp.com/api/v1 npx nuxt generate` (verify NUXT_PUBLIC_API_BASE bakes into the bundle)
3. Package: zip CONTENTS of `.output/public/` (NOT the folder — per jul-5 learning)
4. Use `deploy-frontend.sh` if the script is available; otherwise upload manually to the frontend artifacts bucket and `amplify start-deployment`
5. Wait for Amplify job to succeed
6. Verify: `curl -sI https://miempresa-stg.disruptiveexp.com/` → 200; grep the bundled apiBase to confirm it points at staging API
7. Send CHECKPOINT and wait

### R5 — Post-deploy QA (WAIT for approval before considering release done)
1. `qa-staging.sh` if present, or run the `tests/staging/` playwright specs against the staging URL
2. Login smoke (QA user creds from SSM `/miempresa/staging/qa/*`)
3. Cover jul-8 features (each is a REAL user-visible behavior on staging):
   - Certificados: create + Agregar update + Detalle historial renders
   - Instrumentos: MultiSelect roles + upload plantilla + editar page
   - Fichas: VENCIDO → COMPLETADO transition (create a VENCIDO ficha, transition it)
   - Nomina: filter by tipoContrato + verify cuenta-cobro required error
4. Log any failures — do NOT auto-rollback; report to orchestrator
5. Send FINAL COMPLETE with summary

## Rollback plan (execute ONLY if requested by orchestrator)
- Frontend: `amplify rollback` (or re-deploy prior job via `amplify start-deployment` with the pre-jul9 artifact)
- Backend: re-deploy the pre-jul9 CodeDeploy artifact (find prior key in the staging artifacts bucket)
- DB: restore from `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul9.sql.gz` — LAST RESORT, will lose any staging data written after backup

## Deliverables
1. `context/implementation-plan/staging-release-jul9-runbook.md` — the actual runbook with every command + verbatim output, one section per phase R0-R5 + issues + learnings + rollback plan
2. `development/fixes-jul-8/tasks/W10-staging-release-jul9/result.md` — summary of what shipped + verification summary
3. `development/fixes-jul-8/tasks/W10-staging-release-jul9/completion-report.md` — handoff
4. `development/fixes-jul-8/tasks/W10-staging-release-jul9/progress-report.md` — phase-by-phase progress

## Constraints
- **NEVER** target prod resources — this is staging only. If any command output has "prod" in stack/bucket/instance name, STOP immediately and report
- **NEVER** run `prisma migrate diff --shadow-database-url` (silently wipes DB — global rule)
- **NEVER** `pkill -f node` or generic patterns — never touch local dev processes
- **Region always explicit**: every aws command needs `--region us-east-1`
- **Report between phases** — do NOT auto-progress from R{N} to R{N+1} on your own after R0. R0 is the only read-only phase you may complete without waiting
- Follow existing patterns: use existing scripts (`deploy-infrastructure.sh`, `deploy-frontend.sh` if present, `qa-staging.sh` if present) instead of re-implementing
- Do NOT git-commit
- All CFN CommaDelimitedList params must be passed as ONE quoted string
- Kill only specific PIDs (`lsof -i :PORT -t`), never generic patterns

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "41", status: "in_progress")`
2. **R0 completion (no gate)**: append to progress-report.md, then `SendMessage(to: "main", message: "CHECKPOINT: R0 sanity done. Migration risk: ..., Edge stack: ..., Pending: ... Ready for R1.", summary: "R0 complete")`
3. **Between R1-R5**: after each phase, append verbatim log to `staging-release-jul9-runbook.md` AND send `SendMessage(to: "main", message: "CHECKPOINT: R{N} done. {verbatim key output}. Ready for R{N+1}.", summary: "R{N} complete")` and WAIT for `PROCEED PHASE R{N+1}:` reply
4. **On any error/anomaly**: `SendMessage(to: "main", message: "BLOCKED: R{N} step {X} failed. Attempted: ..., Need: ...", summary: "Blocked")` and WAIT
5. **Final completion**: after R5 QA all green:
   - Write result.md + completion-report.md
   - Update the runbook with the release outcome + issues + learnings sections
   - `TaskUpdate(taskId: "41", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: jul-9 staging release done. See context/implementation-plan/staging-release-jul9-runbook.md", summary: "Release complete")`

## Tools Available
Read, Edit, Write, Bash (aws, ssh, curl, npm, docker if needed for pg_dump verification). `TaskUpdate` and `SendMessage` are native.
