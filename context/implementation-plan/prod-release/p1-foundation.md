# P1 — Foundation stacks — WAITING FOR YES

**Status**: PASS 2026-09-10. Actuals in `2026-09-10-initial-deploy.md`.
**Mutates**: new `miempresa-s3-prod` + `miempresa-ssm-prod`. Updates global `miempresa-iam` / `miempresa-codedeploy` only if the template differs (expected no-op).

## Command (not run)

```bash
cd backend/infrastructure/db/scripts
./deploy-infrastructure.sh --stage prod --region us-east-1 --profile disruptive
```

This script:

1. `cloudformation deploy` `miempresa-iam` (global, already CREATE_COMPLETE)
2. Writes local `bootstrap` AWS profile from SSM bootstrap keys (existing staging-era keys)
3. `cloudformation deploy` `miempresa-s3-prod` — buckets `miempresa-artifacts/backups/uploads-540657241795-prod`. Uploads CORS override: `https://miempresa.disruptiveexp.com`
4. `cloudformation deploy` `miempresa-ssm-prod` — `/miempresa/prod/{db,api}/*`. Generates JWT/SESSION/ORIGIN secrets if missing. `CORS_ORIGIN=https://miempresa.disruptiveexp.com`, `LOG_LEVEL=info`
5. `cloudformation deploy` `miempresa-codedeploy` (global, already has `miempresa-prod` group)

**Does not**: create Lightsail, CodeDeploy a zip, touch staging, seed DB.

## Verify after run

- Stacks `miempresa-s3-prod` + `miempresa-ssm-prod` CREATE_COMPLETE
- `aws ssm get-parameters-by-path --path /miempresa/prod/ --recursive --profile disruptive --region us-east-1`
- `CORS_ORIGIN` value is `https://miempresa.disruptiveexp.com` (not `app.disruptiveexp.com`)
- Three new buckets exist; no staging bucket names changed
- CodeDeploy group `miempresa-prod` still has **zero** deployments

## Rollback

`aws cloudformation delete-stack --stack-name miempresa-s3-prod` and `miempresa-ssm-prod` (only if P2 has not started). Never delete `miempresa-iam` / `miempresa-codedeploy`.
