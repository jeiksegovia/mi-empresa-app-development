# task-assignment — CORS: add dev IPs + IaC consistency

## Task Type
IMPLEMENTATION (IaC + docs)

## Task ID
`39`. Call `TaskUpdate(taskId: "39", status: "in_progress")` on start.

## Your Task
When uploading files from external dev IPs (`http://100.85.193.33:3100`, `http://10.57.126.228:3100`) against the dev S3 bucket, browsers get a CORS error. The dev bucket allowlist currently uses the CFN default (`https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102`). Add both dev IPs to the dev bucket's CORS allowlist via IaC (not a one-off `aws s3api put-bucket-cors`), redeploy, and document the invariant that frontend origins + S3 CORS must stay consistent.

## Source Files to Modify
1. `backend/infrastructure/db/scripts/deploy-infrastructure.sh` — add a `DEV_LOCAL_ORIGINS` variable and pass it as `UploadsCorsAllowedOrigins` override to `cloudformation deploy` when `STAGE=dev` (only). Current call is at line ~129.
2. `backend/.env.example` — add a comment block near `AWS_S3_BUCKET` explaining the invariant: any host in `NUXT_PUBLIC_API_BASE` / frontend serving origin MUST be present in the S3 dev bucket CORS allowlist (`UploadsCorsAllowedOrigins` in `s3-stack.yml`), otherwise browser PUT preflights will fail with CORS 403.

## Deploy step (authorized by user — "apply that simple fix in IaC")
After IaC edit, run:
```bash
STAGE=dev PROFILE=disruptive AWS_PROFILE=disruptive REGION=us-east-1 \
  bash backend/infrastructure/db/scripts/deploy-infrastructure.sh --stage dev
```
Or if the script needs stack-specific args, call the exact aws cloudformation deploy command against `miempresa-s3-dev` stack with the new parameter override. Confirm the stack update succeeds (`UPDATE_COMPLETE`).

Then verify:
```bash
aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-dev --region us-east-1 --profile disruptive
```
Expected: the AllowedOrigins array now includes `http://100.85.193.33:3100` and `http://10.57.126.228:3100` alongside the existing origins.

## Recommended Approach
1. Read `backend/infrastructure/db/cloudformation/s3-stack.yml:25-33` — understand the `UploadsCorsAllowedOrigins` CommaDelimitedList param and its default
2. Read `backend/infrastructure/db/scripts/deploy-infrastructure.sh:127-137` — see the current cloudformation deploy call for the S3 stack
3. Add a variable near the top of the script (right after `PROJECT_NAME`/`STAGE` are resolved):
   ```bash
   # Extra origins for STAGE=dev — every dev machine testing against the dev
   # bucket from a non-localhost origin must be listed here. Wire matters:
   # frontend NUXT_PUBLIC_API_BASE / serving origin MUST appear in this list.
   DEV_LOCAL_ORIGINS="https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102,http://100.85.193.33:3100,http://10.57.126.228:3100"
   ```
4. Modify the S3 stack deploy block: if `STAGE=dev`, append `UploadsCorsAllowedOrigins="${DEV_LOCAL_ORIGINS}"` to the `--parameter-overrides` line. IMPORTANT: CFN `CommaDelimitedList` params must be passed as ONE quoted `Key=Value` string.
5. Deploy + verify.
6. Add the `.env.example` comment.

## Constraints
- **AWS profile**: `disruptive`. **Region**: `us-east-1` explicitly (`disruptive` profile has no default region).
- Never `--no-verify` or `--force`.
- CFN stack name is `miempresa-s3-dev` (NOT `*-prod` — safe to deploy).
- Do NOT change staging or prod CORS.
- Do NOT git-commit.

## Deliverables
1. Modified `deploy-infrastructure.sh` + `backend/.env.example`
2. Successful stack deploy (`UPDATE_COMPLETE`)
3. `aws s3api get-bucket-cors` output pasted into `result.md` proving new origins present
4. `development/fixes-jul-8/tasks/W8-cors-fix/result.md`
5. `development/fixes-jul-8/tasks/W8-cors-fix/completion-report.md`
6. `development/fixes-jul-8/tasks/W8-cors-fix/progress-report.md`

## Acceptance Criteria
1. `get-bucket-cors` shows `100.85.193.33:3100` + `10.57.126.228:3100` in AllowedOrigins
2. Redeploying via the deploy script produces the same result (idempotent IaC)
3. `.env.example` comment clearly states the invariant
4. Manual browser PUT from `http://100.85.193.33:3100` to a presigned URL returns 200 (or if that test is impractical, a curl OPTIONS preflight from `http://100.85.193.33:3100` origin returns 200)

## Reporting Protocol
1. **On start**: `TaskUpdate(taskId: "39", status: "in_progress")`
2. **Progress**: append to progress-report.md per step
3. **On completion**:
   - `TaskUpdate(taskId: "39", status: "completed")`
   - `SendMessage(to: "main", message: "COMPLETE: CORS fix + docs done. See tasks/W8-cors-fix/result.md", summary: "CORS complete")`

## Tools
Read, Edit, Write, Bash (aws cli). SendMessage + TaskUpdate are native.
