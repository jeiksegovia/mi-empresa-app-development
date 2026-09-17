# task-assignment-staging-release (fixes-jul17-2)

## Your Role
You are **devops-infra** executing a **checkpoint-gated staging release**. Read
`.claude/skills/planify-team/release-protocol.md`. Prod does not exist; anything named `prod` is a
hard refuse. AWS: profile `disruptive`, ALWAYS `--region us-east-1`.

## Project Context
Task slug: fixes-jul17-2. Worker 12 (fresh). Your task ID: **#30**→ no: **#38**.
This releases the fixes-jul17-2 cycle (RBAC + 3 QA users + crear-from-template + audit/dry-run) to
staging, INCLUDING the developer-pre-authorized STAGING CLEAN RESET and the FIRST REAL execution of
the new mandatory seed-qa step (which also fixes the currently-broken staging QA login).
Everything is QA-green locally (W11: 0 gaps).

## MANDATORY FIRST READS (in order)
1. This file.
2. `context/implementation-plan/staging-deploy-checklist.md` — the NEW reusable checklist (your
   runbook instance follows it; this release is its first real exercise).
3. `context/implementation-plan/staging-release-jul17-runbook.md` — yesterday's release actuals:
   §Operator notes OP-1..OP-7 (OP-3 canonical creds, OP-7 seed-qa REQUIRED), issues B27–B33
   (B27 expect-PTY pattern for TTY-guarded scripts, B29 log() collision, B30 ssh-keyscan, B33
   pg_dump PATH). These traps WILL recur — pre-load them.
4. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` — deploy trap list.
5. `backend/infrastructure/db/scripts/reset-staging-db.sh` + `backend/prisma/test-db/seed-qa-staging.sh` (updated versions).

## Phases (each mutating phase: CHECKPOINT + WAIT for orchestrator PROCEED)

### R0 — read-only sanity (runs free)
Creds; instance + health; current on-instance migration count (expect 21; local has 22 with
`20260717120000_jul17_tipo_empleado_contratos`); working-tree diff summary (this cycle's files);
uploads bucket state (object count — it was wiped 47→0 yesterday; whatever exists now is post-release
app data); backups bucket reachable; Amplify app/branch; CodeDeploy groups (staging only).
Write your runbook instance: `context/implementation-plan/staging-release-jul17-2-runbook.md`
(follow the checklist structure; reference, don't duplicate, yesterday's runbook). CHECKPOINT.

### R1 — backups (mutating, low-risk)
DB dump → backups bucket `pre-releases/pre-jul17-2.sql.gz` (or via reset script's built-in dump at
R2 — state which); S3 uploads byte-sync to `pre-releases/s3-objects/uploads-staging-jul17-2/` IF
object count > 0 (count-verified), else record "bucket empty, no sync needed". CHECKPOINT.

### R2 — STAGING CLEAN RESET (DESTRUCTIVE — developer pre-authorized in plan approval)
`reset-staging-db.sh` via local SSH tunnel (db-tunnel.sh --stage staging --port 5433; BACKUP_BUCKET
suffixed override; pg_dump PATH per B33; typed `reset staging` — pipeable, record verbatim).
Expect: 22 migrations replayed, canonical seed (users/empresa/cargos/3 legacy/6 dynamic + v1),
counts verbatim. The script now ends with the REQUIRED-NEXT-STEP reminder — your R3. CHECKPOINT.

### R3 — seed-qa-staging.sh (REQUIRED step, first real run)
Run `backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`.
This CREATES the 3 SSM pairs (`/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/…`,
SecureString, generated) + legacy alias, and upserts the 3 QA users through the tunnel. Then
`get-qa-creds.sh` → verify 3 profiles print (do NOT paste passwords into the checkpoint — emails +
"password set" only). CHECKPOINT with: SSM params created (names only), 3 user rows (id/email/rol/
tipoEmpleado) from a tunnel query.

### R4 — backend deploy (working-tree build → CodeDeploy miempresa-app/miempresa-staging)
Standard pipeline (appspec at root, NO dist/generated, artifact `jul17-2-<TS>.zip`, NEVER
miempresa-prod). Post: on-instance migrate status 22, pm2 online new PID, health 200, credential
architecture intact (cron + stopgap + P0 + .env 600), smoke: GET /instruments 200 as qa-admin;
CONTRATOS live-403 smoke: login qa-contratos → GET a fichas endpoint → 403 DOMAIN_FORBIDDEN. CHECKPOINT.

### R5 — frontend deploy (nuxt generate → Amplify start-deployment)
Job N+1 SUCCEED; both domains 200. CHECKPOINT.

### R6 — QA verification
Browser: login as EACH of the 3 QA profiles via get-qa-creds values (custom domain only):
qa-admin full sidebar; qa-gerontologa → pacientes+instrumentos visible, empleados/nomina/empresa
hidden, can open an instrument's audit view + dry-run; qa-contratos → empleados/nomina/certificados
visible, instrumentos hidden, forbidden URL redirect+toast. Plus: crear-from-template on staging
(create from BARTHEL, fill, server-scored) — then soft-delete/deactivate the test instrument.
Legacy canary: admin@miempresa.com/<redacted> (DEV_USERS_ENABLED=true) still works. Classify any
failure. CHECKPOINT → then completion-report.md, `TaskUpdate(taskId: "38", status: "completed")`,
COMPLETE message, end turns silently.

## Pre-loaded traps (from yesterday — do not rediscover)
- expect-PTY pattern only where a script hard-requires TTY (S3 wipe does; reset script's confirm is
  pipeable). No script-guard weakening ever.
- `--profile disruptive --region us-east-1` on EVERY AWS call. ssh-keyscan the instance first (B30).
- pg_dump: `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` (B33). Name shell helpers `note()` not `log()` (B29).
- Zip without dist/ + src/generated; appspec at root. No git commits. Never auto-rollback — report + WAIT.
- SSM writes ONLY under /miempresa/staging/qa/*.

## Boundaries
Write ONLY: your runbook instance file, your task dir, /tmp scripts. NO source changes; NO edits to
prior runbooks (reference only); scripts are frozen deliverables of W9 — if one is defective, BLOCKED
with evidence (do not patch silently).

## Reporting Protocol (follow exactly)
1. Start: `TaskUpdate(taskId: "38", status: "in_progress")`. R0 free; every phase after: CHECKPOINT
   (verbatim key output) + WAIT for `PROCEED PHASE R{N+1}` from main. If a PROCEED seems missing,
   re-check your inbox before re-asking (message crossings were common yesterday).
2. Errors: MAX 2 distinct fix attempts → Strategy Request + TURNING-POINT-STRATEGY + WAIT. Hung
   permission prompt → BLOCKED with the exact command immediately.
3. Done: completion-report.md → TaskUpdate completed → `SendMessage(to: "main", message: "COMPLETE: W12-staging-release done. …", summary: "W12 complete")` → silent turns.
4. Never TaskCreate. Team tools are native tools — call directly; no ToolSearch in your session.
