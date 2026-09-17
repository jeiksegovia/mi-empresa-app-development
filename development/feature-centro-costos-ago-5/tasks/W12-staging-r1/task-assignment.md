# Task Assignment — W12 `pt-devops-infra` · Staging R1 backup (replacement)

**Worker name**: `worker-12`  
**TaskList ID**: `8`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

W11 finished R0 then stayed WAITING. **R1 is already approved.** Do not send PLAN-APPROVAL. Do not wait.

Developer: profile **`disruptive`**, region **`us-east-1`**, gate **2** (backup then stop before R4).

---

## FIRST ACTION

```bash
pwd
```
`TaskUpdate` task `8` stays `in_progress`. Owner conceptually you.

Then **run the backup immediately**.

---

## HARD LIMITS

- R1 = dump + S3 upload + verify only.
- **Do NOT**: CodeDeploy, Amplify, `migrate deploy`, `pm2 restart`, CloudFormation, SSM put.
- **Never** `miempresa-prod`.
- After evidence → `CHECKPOINT: R1 complete` and **WAIT**. Do not start R4.

---

## Do (same as jul-31 / aug-17 R1)

1. SSH `ec2-user@54.144.25.72` with `~/.ssh/miempresa-lightsail-key.pem`
2. On-instance `pg_dump` of **`miempresa_staging`** (gzip)
3. Upload:

```
s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz
```

On-instance upload uses instance IAM. Laptop AWS CLI uses `--profile disruptive --region us-east-1` for `s3 ls` / `head-object` only.

4. Verify **size + sha256** on the instance **and** via `aws s3api head-object` (two paths must match).
5. Write restore one-liner into `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` §R1 — **do not restore**.

---

## Write

- Runbook §R1 actuals: URI, bytes, sha256, restore command, timestamp.
- `tasks/W12-staging-r1/completion-report.md` with verbatim commands + output.

Then:

```
CHECKPOINT: R1 complete. Backup=<s3 uri> size=<n> sha256=<hex>.
Awaiting PROCEED PHASE R4 from team-lead.
```

---

## Traps

- Never `prisma migrate diff --shadow-database-url`.
- Never `pkill`.
- If SSH/S3 fails → `BLOCKED:` with exact error. Do not try another AWS profile.
