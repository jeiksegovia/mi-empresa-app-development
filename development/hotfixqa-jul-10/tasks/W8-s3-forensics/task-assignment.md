# task-assignment — staging S3/STS forensics + repair + symptom re-test (W8)

## Task Type
IMPLEMENTATION (infra forensics + repair)

## Task ID
`1`. `TaskUpdate(taskId: "1", status: "in_progress")` on start.

## Context (read first)
1. `context/user-feedback/qa-session-jul-10-hotfixqa-reinterpreted.md` — the 12 symptoms + root-cause hypothesis (§Root-cause) — this IS your brief
2. `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md` — ssh/SSM command reference
3. `backend/infrastructure/db/scripts/refresh-credentials.sh` — the STS refresh design (cron :00/:45, 1h sessions, writes /root/.aws + /home/ec2-user/.aws; PM2 runs as ec2-user)
4. `backend/src/services/s3Service.ts` — presign expiries (upload 300s, download 3600s)

## Hypothesis to prove/disprove
Staging's STS session creds expired (cron not refreshing) → every presigned URL is signed with expired creds → "token expirado" on ALL downloads + failed browser PUTs → cascading "nothing saves" symptoms. Time-dependent: release QA passed minutes after deploy (fresh creds); this QA failed later.

## Phase 1 — Diagnosis (read-only on instance 54.144.25.72, verify IP first via lightsail)
Collect evidence, verbatim in progress-report.md:
1. `date` on instance vs local (clock drift?)
2. As ec2-user: `aws sts get-caller-identity` → does it succeed? expired?
3. `ls -la /home/ec2-user/.aws/credentials /root/.aws/credentials` → mtime vs the :00/:45 cron schedule (stale mtime = cron dead)
4. `sudo crontab -l` + `crontab -l` as ec2-user → is the refresh entry present? correct path?
5. `sudo grep -i refresh /var/log/cron* | tail -20` + any refresh-credentials log file → last successful run? errors?
6. Bootstrap profile validity: does the assume-role source still authenticate? (`aws sts get-caller-identity --profile bootstrap` as configured on-instance)
7. Live presign test: curl the API for a download-url (QA creds via SSM), then GET the presigned URL → capture the exact S3 error XML
8. PM2 env: `pm2 env 0 | grep -i aws` — is the API process holding stale env creds instead of reading ~/.aws? (SDK caches creds in-process! If the SDK cached the STS creds at process start and never refreshes, a long-lived PM2 process outlives the 1h session even when the files are fresh — CHECK the SDK credential provider behavior: file-based creds ARE refreshed by the SDK provider chain, but only if fileCache invalidation works. Compare creds file content vs what the process presigns with.)

**CHECKPOINT after Phase 1**: send diagnosis + proposed repair to main. Cred/cron repair is PRE-AUTHORIZED (reversible, restores designed state): re-running refresh-credentials.sh, fixing the crontab entry, pm2 restart of miempresa-api (record PID before/after). Anything beyond that (IAM changes, script rewrites, instance ops) → WAIT for approval.

## Phase 2 — Repair (within pre-authorized scope)
Execute the minimal fix. Verify: `sts get-caller-identity` OK as ec2-user, fresh creds file mtime, presign→GET returns 200.
**If the root cause is the PM2 process caching creds in-SDK** (files fresh but process signs stale): pm2 restart fixes the instance NOW, but document that every cred rotation will re-break it → the durable fix is code-level (SDK provider with refresh) or cron-driven pm2 reload — put the durable-fix recommendation in the report for W6's wave (do NOT implement backend code yourself).

## Phase 3 — Symptom re-test + classification
With S3 healthy, re-test each symptom S1–S11 from the reinterpreted doc via curl (QA creds; create throwaway entities, clean up after):
- Upload path: presigned-url POST → PUT file → entity save with key → GET entity → key present?
- Download path: download-url → GET → 200?
- Per-symptom verdict table: **INFRA-FIXED** (works now) vs **STILL-BROKEN** (code bug — goes to W6) vs **NOT-CURL-TESTABLE** (UI-only, flag for W6 browser verification)
- S2 (notas) and S7 (empleado-certificados persistence) deserve special attention — hypothesis says these may be real code bugs.

## Deliverables
1. `tasks/W8-s3-forensics/{result.md,progress-report.md,completion-report.md}` — result.md must contain the classification table (the input that scopes W6's assignment)
2. Durable-fix recommendation if applicable
3. On done: `SendMessage(to: "main", "COMPLETE: S3 forensics done. Root cause: {one-liner}. Symptoms: {n} infra-fixed, {m} still-broken. See tasks/W8-s3-forensics/result.md", summary: "W8 complete")`

## Constraints
`--region us-east-1 --profile disruptive` always · nothing 'prod' (STOP if it appears) · no migrate diff · no git commit · direct ssh (`-i ~/.ssh/miempresa-lightsail-key.pem ec2-user@<ip>`) · clean up throwaway test entities · pm2 actions: record PID before/after, never pkill patterns.
