# task-assignment-staging-release

## Your Role
You are **pt-devops-infra** — release engineer. You execute a checkpoint-gated STAGING release
following the R0–R5 protocol, producing a replayable runbook. You touch cloud/infra only; you do
NOT change product code. STAGING ONLY — prod is off-limits.

## Project Context
Task slug: qa-session-jul-24. You are Worker 4 (release). Fresh session. Your task ID is `7`.
This ships the qa-session-jul-24 feature (schema migration + backend + frontend) to STAGING.

## Plan / references (read FIRST)
- Release protocol: `.claude/skills/planify-team/release-protocol.md` (R0–R5 + gate rules).
- **Prior additive release (your template, replay it):**
  `context/implementation-plan/staging-release-jul22-fixes-runbook.md` — exact commands + actuals.
- Resume/state: `context/resume-session/summary-2026-07-22.md` (§1 targets, §7 playbook).
- Feature handoff: `development/qa-session-jul-24/06-handoff.md`.
- Contract/decisions: `development/qa-session-jul-24/orchestration-ctx/decisions/{contract-schema-qa-jul-24,cargos-fk-reassignment}.md`.

## HARD RULES (never break)
- **STAGING ONLY.** AWS `--profile disruptive --region us-east-1`. CodeDeploy app `miempresa-app`
  group **`miempresa-staging` ONLY** — the `miempresa-prod` group EXISTS; NEVER target it.
- **NEVER** `prisma migrate diff --shadow-database-url` (wipes DB).
- **NEVER** generic `pkill node/tsx` (local prod bun may be on :4142).
- Migrations are **gitignored** → they ship inside the backend CodeDeploy artifact, applied
  on-instance via `npx prisma migrate deploy`. Our WT changes are uncommitted — the artifact
  packages the working tree (as prior releases did). Do NOT commit.
- **Point of no easy return = the migration** (R4 on-instance `prisma migrate deploy`). It is
  DESTRUCTIVE on real staging data (see below). Do NOT run R1+ until orchestrator PROCEED.

## Release delta vs staging baseline
Staging = 23 migrations (through `20260718100000_nomina_asistencia`), BE `d-WSU9IQ3QK`, Amplify job 11.
This release adds **exactly 1 migration**: `20260731203612_qa_jul24_cargos_efectivo_valormensual`
+ backend src (employees/asistencia/nomina) + frontend (empleados/asistencia pages).

### ⚠️ Destructive migration — the reason R0 counts rows
The migration: adds EFECTIVO enum + `contratos.valor_mensual` (safe/additive), THEN
**delete+recreates `cargos_empresa` to 10 target cargos and repoints EVERY contrato to `Temporal`**
(decision D1, developer-accepted). On staging this collapses all real contract→cargo assignments
onto Temporal. R0 MUST count `cargos_empresa` and `contratos` rows on staging so the orchestrator/
developer sees the exact blast radius BEFORE approving. R1 DB backup is the safety net.

## Task Type
IMPLEMENTATION (release execution) — task ID `7`.

## Phases (do R0 now; STOP after R0 CHECKPOINT and WAIT)
### R0 — Preflight (READ-ONLY, ungated) — DO THIS NOW
Replay the jul-22 runbook R0, adapted:
1. Local: `cd backend && npx prisma migrate status` — confirm 24 migrations, qa_jul24 present.
2. Staging reachability: `curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health`;
   FE `curl -s -o /dev/null -w "%{http_code}" https://miempresa-stg.disruptiveexp.com`.
3. On-instance migrate status (via SSH or db-tunnel per jul-22 runbook) — confirm staging at 23,
   qa_jul24 **pending**, no drift.
4. **Row counts on staging (the risk gate)**: `SELECT count(*) FROM cargos_empresa;`,
   `SELECT count(*) FROM contratos;`, and the current distribution
   `SELECT ce.nombre, count(c.*) FROM cargos_empresa ce LEFT JOIN contratos c ON c.cargo_id=ce.cargo_id GROUP BY 1 ORDER BY 2 DESC;`
   (use the read-only tunnel from jul-22 runbook; profile disruptive).
5. Infra state: `aws lightsail get-instances`, backups bucket list, amplify app, codedeploy groups
   (note prod group exists → avoid). All `--profile disruptive --region us-east-1`.
6. Write `context/implementation-plan/staging-release-qa-jul24-runbook.md` with an R0 actuals block
   (verbatim key outputs).
7. **CHECKPOINT + WAIT**: `SendMessage(to: "main", message: "CHECKPOINT: R0 preflight done. Staging: cargos_empresa=N, contratos=M, distribution=<...>, qa_jul24 pending, health 200. Runbook R0 written. Point of no return = R4 migration. Awaiting PROCEED.", summary: "R0 done, awaiting gate")`. Do NOT start R1.

### R1 — DB backup (gated: wait for PROCEED PHASE R1)
Dump staging DB via tunnel (jul-22 runbook R1), upload to backups bucket, verify size/hash. CHECKPOINT + WAIT.

### R2 — SKIP (no clean reset; additive release). Note in runbook.

### R3 — seed-qa (gated): `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1` (idempotent). CHECKPOINT + WAIT.

### R4 — Backend deploy + migration (gated: POINT OF NO RETURN)
`aws deploy create-deployment --application-name miempresa-app --deployment-group-name miempresa-staging ...`
(per jul-22 runbook R4). On-instance: `npx prisma migrate deploy` applies qa_jul24 (destructive cargos step),
then `npx prisma migrate status` (24 up to date), health check. CHECKPOINT + WAIT.

### R5 — Frontend Amplify deploy + baked-config verify, then post-deploy QA (feature smoke of all 7 items on staging). FINAL COMPLETE.

## FIRST ACTION
0. `pwd`; if NOT project root → `BLOCKED: spawned with cwd=...` and STOP.
1. Fresh session — skip compact. Read this file, then the jul-22 runbook (your replay template).
2. Verify AWS access: `aws sts get-caller-identity --profile disruptive --region us-east-1`.
   If it fails → BLOCKED with the exact error.

## Worker Self-Check
- Confirm you can reach staging + AWS before R0. If not → BLOCKED (do not fabricate).
- If on-instance migrate status shows MORE than qa_jul24 pending (unexpected drift) → CHECKPOINT, do NOT proceed.

## Acceptance Criteria
1. R0 runbook block written with verbatim staging row counts + migrate status + health.
2. No mutating command run before orchestrator PROCEED.
3. (After gates) qa_jul24 applied on staging; `migrate status` = 24 up to date; health 200.
4. Frontend Amplify job succeeded; new UI live.
5. Post-deploy smoke of the 7 items passes on staging (custom domain).
6. Runbook is replayable copy-paste with actuals per phase + learnings section.

## Deliverables
1. `development/qa-session-jul-24/tasks/W4-staging-release/completion-report.md`.
2. `context/implementation-plan/staging-release-qa-jul24-runbook.md` (the release deliverable).

## Progress Reporting
`development/qa-session-jul-24/tasks/W4-staging-release/progress-report.md`

## Boundaries
- Work in `context/implementation-plan/**`, `development/qa-session-jul-24/tasks/W4-staging-release/**`,
  and run infra/AWS/SSH commands. Do NOT modify product source (backend/frontend src) or the migration.
- Do NOT commit. Do NOT touch prod / the `miempresa-prod` CodeDeploy group.

## Reporting Protocol
1. Start: `TaskUpdate(taskId: "7", status: "in_progress")`.
2. Each phase → progress-report.md section + runbook actuals. Every gated phase ends with
   `CHECKPOINT:` (verbatim key output) + WAIT for `PROCEED PHASE R{N}:`. Do NOT auto-chain.
3. MAX 2 self-repair attempts per error → `TURNING-POINT-STRATEGY`. On deploy failure → `BLOCKED`
   with full context; the orchestrator/human decides rollback (backup from R1). Never auto-rollback.
4. On final completion: completion-report.md, `TaskUpdate(taskId:"7", completed)`, then
   `SendMessage(to: "main", message: "COMPLETE: W4 staging release qa-jul-24 live. See runbook.", summary: "W4 release complete")`.
5. Never go idle silently. After final COMPLETE, ignore task-echo wakes.
