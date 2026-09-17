# Progress Report — W8 CORS fix (dev bucket)

## Step 1 — Read sources
- `backend/infrastructure/db/cloudformation/s3-stack.yml:25-33` exposes
  `UploadsCorsAllowedOrigins: CommaDelimitedList` with a default of
  `https://miempresa-stg.disruptiveexp.com,http://localhost:3100,...`. The
  default is a string with embedded commas; CloudFormation parses by comma
  when the type is `CommaDelimitedList`.
- `backend/infrastructure/db/scripts/deploy-infrastructure.sh:127-137` calls
  `cloudformation deploy` for the S3 stack but does NOT pass
  `UploadsCorsAllowedOrigins`. The script's `STAGE` validator on lines 57-60
  rejects `--stage dev` — must be expanded carefully so we don't accidentally
  re-deploy IAM/SSM/CodeDeploy during a dev-only S3 patch.
- `backend/.env.example` has an `AWS S3` comment block at lines 11-19
  pointing at `cloudformation/s3-stack.yml`. That is the natural place to
  document the CORS invariant.

## Step 2 — Baseline state
`get-bucket-cors` against `miempresa-uploads-540657241795-dev`:
```
AllowedOrigins: [ http://localhost:3100, http://localhost:3101, http://localhost:3102 ]
```
No `100.85.193.33:3100`, no `10.57.126.228:3100` — confirms the bug.

## Step 3 — Plan
- Modify `deploy-infrastructure.sh` to (a) carry a `DEV_LOCAL_ORIGINS`
  block right after `PROJECT_NAME` is resolved (line ~26), (b) pass
  `UploadsCorsAllowedOrigins` override ONLY when `STAGE=dev` in the S3
  deploy block (line ~127). Staging/prod untouched (no parameter override).
  This preserves IaC idempotency: re-running the script applies the same set.
- For this run, do NOT use the umbrella script's STAGE=dev path even
  though we edited it — the umbrella script also re-touches IAM, SSM
  parameters, CodeDeploy (way too much blast radius for a CORS tweak).
  Call `cloudformation deploy` directly against the `miempresa-s3-dev`
  stack with the same parameter override the script would build. The IaC
  edit ensures future invocations converge on the same state.
- Add the `.env.example` invariant comment block right after `AWS_S3_BUCKET`.

## Step 4 — IaC edits applied
- `backend/infrastructure/db/scripts/deploy-infrastructure.sh`:
  * Added `DEV_LOCAL_ORIGINS` constant + CORS invariant block-comment
    explaining where else the list must stay in sync.
  * Rewrote the S3 deploy section to build a `S3_PARAM_OVERRIDES` array
    and append `UploadsCorsAllowedOrigins=${DEV_LOCAL_ORIGINS}` when
    `STAGE=dev`. Staging and prod keep template defaults. This is
    backwards-compatible: re-running the existing `staging`/`prod`
    flow is byte-identical to before.
- `backend/.env.example`:
  * Added a `CORS INVARIANT` block right after `AWS_S3_BUCKET`/`AWS_PROFILE`
    documenting the single-source-of-truth rule, who owns the override,
    and the exact `aws cloudformation deploy` + `get-bucket-cors` commands
    to update and verify it.

Both edits are changes to source-controlled files. No `git commit` was made.

## Step 5 — Deploy (direct cloudformation deploy against S3 stack only)

```bash
aws cloudformation deploy \
  --template-file backend/infrastructure/db/cloudformation/s3-stack.yml \
  --stack-name miempresa-s3-dev \
  --parameter-overrides \
    ProjectName=miempresa \
    Environment=dev \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102,http://100.85.193.33:3100,http://10.57.126.228:3100" \
  --region us-east-1 --profile disruptive \
  --no-fail-on-empty-changeset \
  --tags Project=miempresa Environment=dev ManagedBy=CloudFormation
```

Result: `Waiting for changeset to be created.. Waiting for stack create/update to complete Successfully created/updated stack - miempresa-s3-dev`

`describe-stacks` returned `UPDATE_COMPLETE`.

## Step 6 — Verification

`get-bucket-cors` shows the new IPs in `AllowedOrigins` (full output in
`result.md`). Staging bucket CORS unchanged (control). Staging and prod
CFN stacks were not referenced.

Preflight probes:
```
Origin: http://100.85.193.33:3100  -> 200, Access-Control-Allow-Origin: http://100.85.193.33:3100
Origin: http://10.57.126.228:3100  -> 200, Access-Control-Allow-Origin: http://10.57.126.228:3100
```

## Step 7 — Done

Acceptance criteria 1-4 all met. No git commit. Task marked completed.

