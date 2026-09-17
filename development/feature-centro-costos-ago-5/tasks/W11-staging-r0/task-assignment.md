# Task Assignment — W11 `pt-devops-infra` · Staging R0 ONLY

**Worker name**: `worker-11`  
**TaskList ID**: `8` (staging deploy — **this turn is R0 only**)  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address orchestrator as `team-lead`, never `main`.**

Developer approved: **proceed R0**, AWS profile **`disruptive`**, region **`us-east-1`**.

---

## HARD LIMITS

- **R0 is read-only.** Health curls, `describe`/`list`/`get`, SSH **SELECT** / `prisma migrate status`.  
- **Do NOT**: CodeDeploy, Amplify, `migrate deploy`, `pg_dump`, S3 put, `aws deploy create-deployment`, `aws s3 cp` upload, `pm2 restart`, SSM put, CloudFormation, any write.
- **Never** `--deployment-group-name miempresa-prod` or any `*prod*` stack/group.
- **One profile only**: `--profile disruptive`. Do not probe other profiles.
- After R0 evidence is in the runbook → send `CHECKPOINT: R0 complete` and **WAIT**. Do not start R1.

---

## FIRST ACTION

```bash
pwd
```
`TaskUpdate` task `8` → `in_progress`.

Read:
- `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` (fill **R0 actuals** in place)
- `.claude/skills/planify-team/release-protocol.md` (R0 section)
- Prior pattern: `context/implementation-plan/staging-release-qa-session-aug-17-runbook.md` §R0

---

## Commands you will run (and only these classes)

### Public health (no AWS)

```bash
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
```

### AWS read-only — profile `disruptive`, region `us-east-1`

```bash
aws deploy list-deployments --application-name miempresa-app \
  --deployment-group-name miempresa-staging --region us-east-1 --profile disruptive \
  --max-items 3

# NEVER miempresa-prod

aws deploy get-deployment --deployment-id <latest-staging-id> \
  --region us-east-1 --profile disruptive --query 'deploymentInfo.{id:deploymentId,status:status,createTime:createTime}'

aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
  --region us-east-1 --profile disruptive --max-items 3
```

### On-instance read-only (SSH as prior runbooks)

Host: `ec2-user@54.144.25.72` · key `~/.ssh/miempresa-lightsail-key.pem`  
App dir typically `/opt/miempresa/app`.

```bash
# migrate status (read-only)
cd /opt/miempresa/app && npx prisma migrate status

# L2 SQL — SELECT only
# Use the instance's local psql / DATABASE_URL the same way jul-31 / aug-17 R0 did.
```

SQL (verbatim from the runbook L2):

```sql
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;

SELECT to_regclass('public.productos_servicios') AS productos_servicios,
       to_regclass('public.prefacturas') AS prefacturas,
       to_regclass('public.egresos') AS egresos,
       to_regclass('public.centros_costos') AS centros_costos,
       to_regclass('public.centro_costos_items') AS centro_costos_items;

-- if centros_costos exists:
SELECT count(*) FROM centros_costos;
SELECT count(*) FROM centro_costos_items;
SELECT tipo, nombre, orden FROM centros_costos ORDER BY tipo, orden;

-- only if old tables exist:
-- SELECT count(*) FROM productos_servicios;
-- SELECT count(*) FROM prefacturas;
-- SELECT count(*) FROM egresos;

-- column presence (ago-5 RB-1 / aug-17):
-- \d centros_costos
-- \d centro_costos_items
```

Also record: local `npx prisma migrate status` in `backend/` (how many migrations local vs staging).

---

## What to write

Fill **R0 actuals** in `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` (update the “DRAFT / T9 not applied” header — local T9–T13 **are** done as of 2026-08-18; staging may still be at 29 mig).

Also `tasks/W11-staging-r0/completion-report.md` with **verbatim** command output.

Call out explicitly:

| Question | Answer from evidence |
|---|---|
| Is `20260805000000_centro_costos_ago5` on staging? | yes/no |
| If **no** and `centros_costos` rows > 0 | **RB-1 STOP** — do not recommend R4 |
| If old finance tables exist with rows | **O1 STOP** |
| Is `20260819025302_centro_costos_aug17_qa` on staging? | yes/no (expect **no**) |
| `Transporte` exact name still present? | yes/no |
| `fecha` / `precio_unitario` columns present? | yes/no |
| Last CodeDeploy / Amplify | ids + status |

Risk gate: LOW if ago-5 already applied and aug-17 not applied (additive). HIGH if ago-5 pending + rows > 0.

---

## Then STOP

```
CHECKPOINT: R0 complete. Risk=<LOW|HIGH>. RB-1=<ok|STOP>. O1=<ok|STOP>.
Awaiting PROCEED PHASE R1 (backup) from team-lead.
```

Do not run R1.

---

## Traps

- Never `prisma migrate diff --shadow-database-url`.
- Never `pkill`.
- If SSH key missing or instance unreachable → `BLOCKED:` with what you tried.
- Do not invent a second AWS profile if `disruptive` fails — `BLOCKED:`.
