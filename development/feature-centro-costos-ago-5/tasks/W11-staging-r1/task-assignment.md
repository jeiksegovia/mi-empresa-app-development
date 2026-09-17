# Task Assignment — W11 · Staging R1 backup ONLY

**Worker**: `worker-11` (reuse — you just finished R0)  
**TaskList ID**: `8`  
**CWD**: `/Users/jeik/ws/mi-empresa-app-development`  
**Address `team-lead`, never `main`.**

Developer: **PROCEED PHASE R1** then **STOP**. Profile **`disruptive`**. Region **`us-east-1`**.

---

## HARD LIMITS

- R1 = **on-instance `pg_dump` + upload to staging backups bucket + verify**.  
- **Do NOT**: CodeDeploy, Amplify, `migrate deploy`, `pm2 restart`, CloudFormation, SSM put, any other write.  
- **Never** `miempresa-prod`.  
- After evidence is in the runbook → `CHECKPOINT: R1 complete` and **WAIT**. Do not start R4.

---

## Pattern (copy prior runbooks)

Same as `staging-release-qa-session-aug-17-runbook.md` R1 / jul-31 R1:

1. SSH `ec2-user@54.144.25.72` with `~/.ssh/miempresa-lightsail-key.pem`
2. On-instance dump of `miempresa_staging` (pg tools match the DB; instance has S3 IAM)
3. Upload to:

```
s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz
```

4. Verify **size + sha256** on the instance **and** after `aws s3 ls` / `aws s3api head-object` (two paths).
5. Write the **restore one-liner** into the runbook (do not execute restore).

Use `--profile disruptive --region us-east-1` for any AWS CLI from the laptop. On-instance S3 upload uses the instance role (no profile spray).

---

## Write

- Fill **R1** section in `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md` with verbatim size, sha256, S3 URI, restore command.
- `tasks/W11-staging-r1/completion-report.md` with verbatim commands + output.

Then:

```
CHECKPOINT: R1 complete. Backup=<s3 uri> size=<n> sha256=<hex>.
Awaiting PROCEED PHASE R4 (CodeDeploy + migrate) from team-lead.
```

Do not run R4.
