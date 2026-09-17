# Decision: jul-17 staging release — DEVELOPER APPROVED with amendments (2026-07-17)

## Approval
Developer selected **"Approve + backup S3 bytes first"** at the Phase B gate (AskUserQuestion,
this conversation). Covers the full destructive scope:
- Staging DB drop + reseed (21 migrations replayed; seed = 4 users, empresa, 7 cargos,
  3 legacy + 6 dynamic instruments with active v1)
- Staging uploads bucket wipe (47 objects / 65.6 MiB, versioning OFF)

## Mandatory amendments (conditions of the approval)
1. **A-1 (orchestrator, REVISION-REQUEST already sent)**: add backend CodeDeploy phase built from
   the LOCAL working tree — the feature is uncommitted; HEAD 48029ef does NOT contain it; the
   on-instance i123 artifact's Prisma client references dropped columns and would 500 after the
   DB reset. Sequence relative to DB reset must be stated with the outage window called out.
2. **A-2 (developer)**: BEFORE the wipe, back up the actual S3 object bytes:
   `aws s3 sync s3://miempresa-uploads-540657241795-staging s3://miempresa-backups-540657241795/pre-releases/s3-objects/uploads-staging-jul17/ --profile disruptive --region us-east-1`
   then verify synced object count == manifest count (47). The wipe is thereby fully reversible.

## Execution protocol
Worker-8 proceeds R-phases per the (revised) runbook. Each phase ends with CHECKPOINT + verbatim
output; orchestrator issues PROCEED for routine phases and escalates anomalies to the developer.
No auto-rollback — report and wait. No git commits.
