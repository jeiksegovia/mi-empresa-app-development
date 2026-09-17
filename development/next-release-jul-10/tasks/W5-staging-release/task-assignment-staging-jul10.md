# task-assignment-staging-jul10 (W5 — staging release, gated)

## Task Type
IMPLEMENTATION (staging deployment)

## Task ID
`32`. `TaskUpdate(taskId: "32", status: "in_progress")` on start.

## Your Task
Create `context/implementation-plan/staging-release-jul10-runbook.md` following the structure/pattern of the successful jul-9 runbook, then execute the release phase-by-phase with orchestrator approval gates, filling each phase's section with VERBATIM commands + outputs as you go.

## MANDATORY reading before anything (in order)
1. `context/implementation-plan/staging-release-jul9-runbook.md` — the pattern to replicate (structure, phases, verbatim logging, issues table, learnings)
2. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` — 14 trap sections + copy-paste command reference written specifically for you (CodeDeploy names, SSM paths, appspec-at-root, dist/generated, CommaDelimitedList quoting, ssh patterns, prod-filter discipline)
3. `context/plan-implemented/improvements-jul-9-implemented.md` + `context/plan-implemented/next-release-jul-10-implemented.md` — WHAT ships in this release

## Release content (what's new on staging since jul-9 release `d-M8XBER0HK`... actually jul-9 was `d-M8XBER0HK`? NO — verify: jul-9 runbook says CodeDeploy `d-M8XBER0HK` backend + Amplify Job 3)
- **6 new migrations** (staging currently at 14, local at 20 — VERIFY both in R0):
  `jul9_additive_fields`, `jul9_nota_fecha_incidente` (**backfill + SET NOT NULL on notas_clientes**), `jul9_educacion_empleado`, `jul9_cargo_empresa` (**seeds 8 cargos per empresa**), `jul10_contrato_cargo_not_null` (**backfills NULL cargo_id → Otro; depends on cargo seed from previous migration**), `jul10_tipo_empleado`
- Backend: new routes (users, educacion, cargos, vencimientos), C1 atomic ficha, C4 lazy flip, C6 gating, E1 uppercase transforms, forbidLegacy middleware, businessDays util
- Frontend: single-step ficha dialog, CertificateUpdateForm shared component, cert create simplified, empresa save fix + cargos manager, pacientes/empleados new fields, contrato-laboral tab, uppercase-as-you-type

## Known facts (verified by orchestrator jul-10)
- Local HEAD `48029efc0b46306d396f4763e0f4bef7644e4363`, working tree dirty (123 files — expected; deployment builds from working tree per established pattern)
- Local backend healthy; local migrations 20/20 clean
- AWS profile `disruptive`, region `us-east-1` ALWAYS explicit
- CodeDeploy: application `miempresa-app`, deployment group `miempresa-staging` (NOT miempresa-api-staging; NEVER miempresa-prod)
- Staging instance was `54.144.25.72` at jul-9 — re-verify in R0
- IaC delta since jul-9 release: `deploy-infrastructure.sh` DEV_LOCAL_ORIGINS (dev-only, staging path untouched) → R1 expected no-op

## Phase plan (gates identical to jul-9 pattern)

### R0 — Sanity + migration risk gate (READ-ONLY, no approval needed)
1. Baseline: `git rev-parse HEAD`; `git stash create` + `git tag staging-jul10-snapshot <sha>` for traceability (tag the stash commit of the dirty tree — jul-5/jul-9 pattern)
2. Local: `npx prisma migrate status` (expect 20/20), health 200, spot-run a couple of jul10 backend specs
3. Staging DB via SSM DATABASE_URL: `prisma migrate status` → expect 14 applied, 6 pending
4. **Migration risk data** (staging DB, read-only):
   - `SELECT COUNT(*) FROM notas_clientes;` (fecha_incidente backfill scope)
   - `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL;` — wait, column doesn't exist on staging yet → instead `SELECT COUNT(*) FROM contratos;` (all rows will need cargo backfill)
   - `SELECT COUNT(*) FROM empresas;` (cargo seed multiplier)
   - `SELECT COUNT(*) FROM clientes;`, `SELECT COUNT(*) FROM usuarios;`
5. Staging infra: lightsail instance state+IP, CFN stacks status (all `miempresa-*-staging` + shared), CodeDeploy app/group names, Amplify app id
6. CHECKPOINT to main: migration risk summary + any anomalies. WAIT for `PROCEED PHASE R1:`

### R1 — IaC verify (expect no-op)
`aws cloudformation deploy` s3-stack for staging → expect "No changes". Verify `UPDATE_COMPLETE`. CHECKPOINT + WAIT.

### R2 — DB backup
pg_dump via ssh → gzip → `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul10.sql.gz` → verify size + head-object + SHA256. CHECKPOINT + WAIT. (Note: sudo -u postgres "could not change directory" warning is benign.)

### R3 — Backend deploy (POINT OF NO EASY RETURN — migrations run on-instance)
1. Build artifact per learning doc (appspec at bundle root; dist/generated intentionally absent — after-install.sh regenerates on-instance)
2. Upload zip → `create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging` → `wait deployment-successful`
3. Post-deploy on-instance verification: `prisma migrate status` → 20/20; verify backfills: `SELECT COUNT(*) FROM notas_clientes WHERE fecha_incidente IS NULL;` → 0; `SELECT COUNT(*) FROM cargos_empresa;` → 8×empresas; `SELECT COUNT(*) FROM contratos WHERE cargo_id IS NULL;` → 0; pm2 online; health via CloudFront 200
4. CHECKPOINT + WAIT

### R4 — Frontend deploy
`NUXT_PUBLIC_API_BASE=https://miempresa-api-stg.disruptiveexp.com/api/v1 npx nuxt generate` → zip CONTENTS of .output/public → upload → `amplify start-deployment` → wait job success → verify staging URL 200 + baked apiBase grep. CHECKPOINT + WAIT.

### R5 — Post-deploy QA
1. `tests/staging/` suite (staging-login, staging-upload + any others) with staging env vars/SSM QA creds
2. Curl smoke of NEW endpoints (authed session): POST single-step ficha (then clean up), GET /patients/fichas/vencimientos, GET /empresa/cargos (expect 8 seeded), POST /users pairing-rule 400, uppercase round-trip on one entity, contrato-without-cargoId → 400
3. Browser-level sanity if practical (staging URL loads, login works)
4. pm2 log scan for errors; stability check
5. FINAL COMPLETE with full summary

## Rollback plan (execute ONLY on explicit orchestrator instruction)
- Backend: redeploy prior artifact (jul-9 zip still in artifacts bucket)
- Frontend: redeploy prior Amplify job artifact
- DB: restore pre-jul10.sql.gz — LAST RESORT. NOTE: jul9/jul10 migrations include SET NOT NULL + new tables; a code-only rollback (old backend + new schema) is expected to be compatible EXCEPT old code writing notas without fecha_incidente will fail — document this asymmetry in the runbook's rollback section.

## Hard constraints
- NEVER touch any resource with `prod` in the name — STOP + report if one appears in any output
- NEVER `prisma migrate diff --shadow-database-url`
- `--region us-east-1` on EVERY aws command
- Direct ssh for remote commands (ssh-to-instance.sh is interactive-only)
- Do NOT git-commit (the snapshot TAG is allowed — tags don't modify the tree)
- After R0, WAIT for explicit `PROCEED PHASE R{N}:` before EVERY mutating phase (orchestrator may bundle approvals — follow whatever the PROCEED message authorizes)

## Deliverables
1. `context/implementation-plan/staging-release-jul10-runbook.md` — complete, verbatim commands + outputs, issues table, learnings, rollback section
2. `development/next-release-jul-10/tasks/W5-staging-release/{result.md,completion-report.md,progress-report.md}`

## Reporting Protocol
Standard planify protocol. CHECKPOINTs between phases as specified. On final: `TaskUpdate(taskId: "32", status: "completed")` + `SendMessage(to: "main", "COMPLETE: jul-10 staging release done. See context/implementation-plan/staging-release-jul10-runbook.md", summary: "Release complete")`.
