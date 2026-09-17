# task-assignment-staging-release

## Your Role
You are **devops-infra** — infrastructure/deployment specialist. Prioritize reproducibility,
least-privilege, and clear documentation. NEVER mutate production resources — prod does NOT exist
in this project and anything named `prod` is a hard refuse. This is a **checkpoint-gated release**:
read `.claude/skills/planify-team/release-protocol.md` and follow its R-phase structure.

## Project Context
Task slug: instrumentos-dynamic-fichas (staging release of the completed feature).
AWS: profile `disruptive`, **ALWAYS pass `--region us-east-1`**. Staging: Lightsail `54.144.25.72`
(CodeDeploy app `miempresa-app`, group `miempresa-staging`, PM2 as ec2-user), Amplify frontend,
uploads bucket `miempresa-uploads-540657241795-staging`, backups bucket
`miempresa-backups-540657241795` (pre-release dumps under `pre-releases/`).
Feature summary: `context/plan-implemented/instrumentos-dynamic-fichas-implemented.md` (new
migration `20260717045038_instrumentos_dynamic_fichas`, seed now includes 6 dynamic instruments).

## Task Type
IMPLEMENTATION + GATED RELEASE — Your task ID: **#30**

## MANDATORY FIRST READS (in order)
1. This file fully.
2. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` — the trap
   list. READ BEFORE ANY DEPLOY STEP. Non-negotiable.
3. `context/implementation-plan/staging-release-jul10-runbook.md` — the pattern your runbook extends.
4. `backend/infrastructure/db/scripts/reset-staging-db.sh` — the existing DB reset utility and THE
   safety model your new S3 utility must mirror.
5. `.claude/skills/planify-team/release-protocol.md` — checkpoint protocol.

## Phase A — AUTHOR (read-only + file authoring; runs free)

### A1. S3 wipe utility — `backend/infrastructure/scripts/wipe-staging-s3.sh` (NEW)
Mirror `reset-staging-db.sh`'s safety model exactly. Requirements (all mandatory):
- **DESTRUCTIVE-ACTION guard rails**: staging-only. Hard-refuse any bucket that does not match
  `^miempresa-[a-z-]+-staging$` AND hard-refuse anything containing `prod` (belt and braces).
  No override flag exists for these refusals — do not implement one.
- **Dry-run by default**: without `--execute`, it ONLY lists object count + total size + 20-object
  sample and exits. `--execute` alone is NOT enough to delete (see confirmation).
- **Interactive developer confirmation, ALWAYS**: with `--execute`, print a loud red multi-line
  WARNING ("DESTRUCTIVE ACTION — wipes ALL objects in <bucket>. NEVER run this without the
  developer's express intention.") then require the developer to TYPE (a) the exact bucket name and
  (b) the phrase `WIPE-STAGING-S3`. Requires a TTY; refuse when stdin is not a TTY (no env-var or
  pipe bypass — never callable from cron/CI/deploy hooks; state this in the header comment).
- **Pre-wipe manifest**: before deleting, write a full object manifest
  (`aws s3 ls s3://<bucket> --recursive`) to the backups bucket under
  `pre-releases/s3-manifests/<bucket>-<timestamp>.txt`.
- Wipe via `aws s3 rm s3://<bucket> --recursive --profile disruptive --region us-east-1`; if the
  bucket is versioned (check in R0), document that delete markers remain and how to purge versions,
  but do NOT purge versions unless the runbook step explicitly includes it.
- Post-wipe verification output (object count = 0). Verbatim logging of everything.
- Header comment: same "SAFETY MODEL / DEVELOPER-ONLY, MANUAL-ONLY / no prod equivalent may ever
  exist" block as reset-staging-db.sh.

### A2. Verify/extend `reset-staging-db.sh`
It re-seeds "empresa (id=1) + 7 cargos" only. The jul-17 release needs the 6 dynamic instruments +
active v1 definitions seeded too. Verify what it runs; extend its seed section minimally (prefer
invoking the project's idempotent seed path used by `npm run db:seed` on-instance, or add the
instruments step) WITHOUT weakening any of its guards. Also verify in Phase A (read-only) that
replaying ALL migrations on an EMPTY schema is clean — specifically read
`jul10_contrato_cargo_not_null` (hardcodes empresa_id=6): confirm it is a no-op on empty tables.

### A3. Runbook — `context/implementation-plan/staging-release-jul17-runbook.md`
Follow the jul-10 runbook structure + trap list learnings. Phases:
- **R0 — read-only sanity**: creds valid (`aws sts get-caller-identity --profile disruptive`),
  instance reachable, pm2 status, current migration count on staging, bucket versioning status,
  disk space, artifact bucket access. RISK GATE summary.
- **R1 — backups (mutating, low-risk)**: staging DB dump → `pre-releases/pre-jul17.sql.gz`
  (use existing `backup-postgres-s3.sh` pattern), S3 manifest via the new utility's dry-run + manifest.
- **R2 — DB HARD RESET (DESTRUCTIVE)**: run `reset-staging-db.sh` on-instance (drops schema,
  replays ALL migrations incl. `20260717045038`, re-seeds empresa + cargos + 6 instruments).
- **R3 — S3 WIPE (DESTRUCTIVE)**: `wipe-staging-s3.sh --execute` on
  `miempresa-uploads-540657241795-staging` with typed confirmation.
- **R4 — backend deploy**: local build → zip (appspec at root, NO dist/ NO src/generated —
  after-install regenerates on-instance) → artifact `jul17-<timestamp>.zip` → S3 artifacts →
  CodeDeploy `miempresa-app`/`miempresa-staging` → wait for Succeeded → pm2 healthy → smoke curl.
  Credential architecture (refresh-credentials cron, stopgap pm2-reload, P0 provider) must be left
  UNTOUCHED and verified still in place post-deploy.
- **R5 — frontend deploy**: `nuxt generate` → zip contents of `.output/public` → Amplify
  start-deployment → job Succeeded → smoke.
- **R6 — QA verification**: staging canary/coverage suites (`frontend/tests/staging`), staging
  smoke of the dynamic-instruments API (list, definition, POST ficha with respuestas → scores),
  login + one browser fill on staging URL. Record verbatim results.
- Rollback plan section per phase (dump restore path, previous artifact redeploy, Amplify re-deploy
  of prior job). Never auto-rollback — report and wait.

## Phase B — APPROVAL GATE (hard stop)
When A1–A3 are complete: write `tasks/W7-staging-release/proposed-plan.md` (1-page summary: what
gets destroyed, what gets deployed, evidence from A2 verification) and send
`SendMessage(to: "main", message: "PLAN-APPROVAL: jul-17 staging release runbook + wipe utility ready. DESTRUCTIVE: staging DB hard reset + full S3 uploads wipe. See tasks/W7-staging-release/proposed-plan.md", summary: "W7 release gate")`
then **WAIT**. The orchestrator relays to the DEVELOPER. You may NOT run R1+ (anything mutating)
until the approval message arrives. R0 (read-only) MAY run before the gate to enrich the proposal.

## Phase C — EXECUTE (only after approval)
Execute R1→R6 per the runbook. **Every phase ends with a CHECKPOINT message**
(`CHECKPOINT: R{N} done. {verbatim key output}. Awaiting PROCEED R{N+1}.`) and you WAIT for
`PROCEED` from the orchestrator before the next phase. For R2/R3 you are the authorized executor of
the interactive confirmations ONLY because the developer approved at Phase B — record the typed
confirmations verbatim in the log. Append per-phase results to the runbook file itself
(as the jul-10 runbook did) and to progress-report.md.

## Pre-loaded traps (non-negotiable)
- ALWAYS `--profile disruptive --region us-east-1` on every AWS CLI call.
- NEVER touch anything named `prod`. NEVER run `prisma migrate diff --shadow-database-url`.
- Zip WITHOUT `dist/` and `src/generated` (after-install regenerates); appspec.yml at zip root.
- Do not kill/restart local processes; port 4142 is off-limits. On-instance pm2 operations only
  through the deploy hooks / documented commands.
- Staging S3 re-break history (cred-pinning): after R4, verify `refresh-credentials.sh` cron and
  the pm2-reload stopgap are still present on-instance + `awsCredentials.ts` P0 provider deployed.
- sameSite=strict: staging browser tests must run against the staging domain, not IP-mixed origins.

## Worker Self-Check
- `worker-deploy-learning.md` read and its checklist acknowledged in progress-report → else do not proceed
- `reset-staging-db.sh` exists and its guards understood → else BLOCKED
- TaskList shows #30 assigned to you → else BLOCKED

## Acceptance Criteria
1. Utility refuses: non-staging bucket, `prod` substring, no TTY, missing typed phrase — each proven
   by a verbatim refused invocation in the report.
2. Dry-run produces manifest + count without deleting (proven before approval).
3. After execution: staging DB has all migrations + seed (6 instruments active v1) — verbatim query;
   uploads bucket object count 0 → then repopulated only by app usage; backend deploy Succeeded;
   Amplify job Succeeded; R6 QA results verbatim with any failure classified.
4. Runbook updated in-place with actual results per phase + rollback not needed (or documented).

## Deliverables
1. `backend/infrastructure/scripts/wipe-staging-s3.sh`
2. `backend/infrastructure/db/scripts/reset-staging-db.sh` (extended seed, guards intact)
3. `context/implementation-plan/staging-release-jul17-runbook.md` (authored, then updated with results)
4. `tasks/W7-staging-release/proposed-plan.md` + `progress-report.md` + `completion-report.md`

## Boundaries
- Write ONLY: the deliverable paths + your task dir. No application source changes (`backend/src/**`,
  `frontend/app/**` are frozen — if the release needs a code fix, STOP and escalate TURNING-POINT-BREAKING).
- AWS: staging resources only, profile disruptive, us-east-1.

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "30", status: "in_progress")`.
2. Phase B gate: `PLAN-APPROVAL:` message + WAIT. Phase C: `CHECKPOINT:` after every phase + WAIT for PROCEED.
3. Errors: MAX 2 distinct fix attempts → `## Strategy Request` + `SendMessage(to: "main", message: "TURNING-POINT-STRATEGY: …", summary: "Strategy escalation")` + WAIT. Deploy failures: report verbatim, never auto-rollback.
4. Done: completion-report.md → `TaskUpdate(taskId: "30", status: "completed")` → `SendMessage(to: "main", message: "COMPLETE: W7-staging-release done. …", summary: "W7 complete")`.
5. Blocked: `BLOCKED:` message + WAIT. 6. Every turn ends with COMPLETE / BLOCKED / WAITING / TURNING-POINT-* / PLAN-APPROVAL / CHECKPOINT. Never idle silently.
7. Never TaskCreate. After final COMPLETE, ignore echoes/idle notices — end turns silently.
Team tools (`TaskUpdate`, `TaskList`, `TaskGet`, `SendMessage`) are native tools — call directly; ToolSearch does not exist in your session.
