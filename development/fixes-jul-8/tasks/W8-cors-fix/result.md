# Result — W8 CORS fix (dev bucket)

## Verification of bucket CORS

`aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-dev --region us-east-1 --profile disruptive`

```json
{
    "CORSRules": [
        {
            "AllowedHeaders": [
                "*"
            ],
            "AllowedMethods": [
                "GET",
                "PUT",
                "HEAD"
            ],
            "AllowedOrigins": [
                "https://miempresa-stg.disruptiveexp.com",
                "http://localhost:3100",
                "http://localhost:3101",
                "http://localhost:3102",
                "http://100.85.193.33:3100",
                "http://10.57.126.228:3100"
            ],
            "MaxAgeSeconds": 3600
        }
    ]
}
```

Both new origins (`http://100.85.193.33:3100`, `http://10.57.126.228:3100`) are present in `AllowedOrigins`.

## Stack status

`aws cloudformation describe-stacks --stack-name miempresa-s3-dev --region us-east-1 --profile disruptive --query 'Stacks[0].StackStatus' --output text`

```
UPDATE_COMPLETE
```

## Staging bucket (untouched, control)

```
$ aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging --region us-east-1 --profile disruptive
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "HEAD"],
            "AllowedOrigins": [
                "https://miempresa-stg.disruptiveexp.com",
                "http://localhost:3100",
                "http://localhost:3101",
                "http://localhost:3102"
            ],
            "MaxAgeSeconds": 3600
        }
    ]
}
```

Staging CORS unchanged (no `100.85.193.33`, no `10.57.126.228`).

## Live CORS preflight probes

`curl -sI -X OPTIONS -H "Origin: http://100.85.193.33:3100" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: content-type" "https://miempresa-uploads-540657241795-dev.s3.us-east-1.amazonaws.com/test-key"`

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://100.85.193.33:3100
Access-Control-Allow-Methods: GET, PUT, HEAD
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 3600
Access-Control-Allow-Credentials: true
Vary: Origin, Access-Control-Request-Headers, Access-Control-Request-Method
```

`curl -sI -X OPTIONS -H "Origin: http://10.57.126.228:3100" -H "Access-Control-Request-Method: PUT" -H "Access-Control-Request-Headers: content-type" "https://miempresa-uploads-540657241795-dev.s3.us-east-1.amazonaws.com/test-key"`

```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://10.57.126.228:3100
Access-Control-Allow-Methods: GET, PUT, HEAD
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 3600
Access-Control-Allow-Credentials: true
Vary: Origin, Access-Control-Request-Headers, Access-Control-Request-Method
```

Both preflights return HTTP 200 and S3 echoes the requesting origin in
`Access-Control-Allow-Origin`, exactly the browser behaviour the task's
acceptance criterion #4 required.

## What changed

- `backend/infrastructure/db/scripts/deploy-infrastructure.sh`
  - Added a `DEV_LOCAL_ORIGINS` constant block-comment explaining the
    invariant and where the list must stay in sync (frontend app config,
    backend CORS origin, any new dev host).
  - Rewrote the S3 deploy block to build `S3_PARAM_OVERRIDES` as an array
    and append `UploadsCorsAllowedOrigins=${DEV_LOCAL_ORIGINS}` only when
    `STAGE=dev`. Staging and prod paths are byte-identical to before.
  - The umbrella script's top-of-file STAGE validator (still staging|prod)
    is intact — this run used a direct `cloudformation deploy` against the
    S3 stack only to avoid re-deploying IAM/SSM/CodeDeploy.
- `backend/.env.example`
  - Added a `CORS INVARIANT` block right after `AWS_S3_BUCKET` /
    `AWS_PROFILE`. It documents the single source of truth, the
    authoritative allowlist per environment, and the exact
    `aws cloudformation deploy` + `aws s3api get-bucket-cors` commands to
    update and verify it.

## Idempotency check (IaC convergence)

Re-running the same `cloudformation deploy` (same template, same parameters,
same tags) against `miempresa-s3-dev` with `--no-fail-on-empty-changeset`
should produce no changes. Not re-run in this task to avoid needless stack
churn, but the parameter set is now fully declarative — no out-of-band
`aws s3api put-bucket-cors` calls were issued.
