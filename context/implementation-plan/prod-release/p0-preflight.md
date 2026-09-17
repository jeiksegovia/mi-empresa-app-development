# P0 — Preflight (read-only) — COMPLETE 2026-09-10

**Status**: PASS. Clean slate for prod. No AWS mutations this phase.
**Profile / region**: `disruptive` / `us-east-1`
**Account**: `540657241795` · caller `arn:aws:iam::540657241795:user/admin`

## Git / local

| Item | Value |
|---|---|
| HEAD | `d49573f` — VALORACION_INTEGRAL v2 |
| Dirty files | **192** (working-tree zip, same as staging) |
| `backend/appspec.yml` | present (restored 2026-09-10 from `infrastructure/db/appspec.yml`) |
| VALORACION v2 | tracked |
| `tsc --noEmit` (backend tsconfig) | **0** |
| Prisma migrate status (local `miempresa_dev` :15432) | **32** / up to date |
| Local API `:3101/health` | **200** |
| prod-db scripts `bash -n` | seed-prod / sync-catalog / seed-staff **ok** |

prod-db files (gitignored): `catalog-snapshot.ts`, `employee-roster.ts`, `seed-prod.sh`, `seed-prod-foundation.ts`, `sync-prod-catalog.ts/.sh`, `seed-prod-staff.ts/.sh`.

## AWS account (read-only)

| Check | Result |
|---|---|
| CFN `*-prod` stacks | **none**. Live: iam, codedeploy, s3-staging, ssm-staging, edge-staging, frontend-staging, s3-dev |
| Lightsail instances | only `miempresa-backend-staging` @ `54.144.25.72` running |
| Lightsail static IPs | only `miempresa-ip-staging` |
| CodeDeploy groups | `miempresa-staging` + `miempresa-prod` |
| Deployments on `miempresa-prod` | **[]** (never used) |
| SSM `/miempresa/prod/` | **empty** |
| Amplify `miempresa-frontend-prod` | **absent** (staging app `d1nsxjyualdzdu`) |
| S3 `*-prod` buckets | **none** (staging + uploads-dev only) |
| Route 53 `disruptiveexp.com` miempresa | only `-stg` records (`miempresa-stg`, `miempresa-api-stg`, `miempresa-api-origin-stg`) |

## Risk gate

LOW for P1: new empty stacks (`miempresa-s3-prod`, `miempresa-ssm-prod`). Global `miempresa-iam` / `miempresa-codedeploy` already exist (`--no-fail-on-empty-changeset`). Does **not** touch staging instance, staging buckets, or `miempresa-staging` CodeDeploy group.

## Commands actually run (all read-only)

```
aws sts get-caller-identity --profile disruptive --region us-east-1
aws cloudformation list-stacks ...
aws lightsail get-instances / get-static-ips
aws deploy list-deployment-groups / list-deployments --deployment-group-name miempresa-prod
aws ssm get-parameters-by-path --path /miempresa/prod/
aws amplify list-apps
aws s3api list-buckets
aws route53 list-resource-record-sets --hosted-zone-id Z05031231XC6MYR0M5LX
```

## Next

P1 needs explicit **yes, P1**. Command is in `p1-foundation.md`. Do not run it until then.
