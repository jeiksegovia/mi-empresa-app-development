# Prod app release — 2026-09-11 cert attach + patient email

**Type**: later prod *app* release (infra already exists).  
**Profile / region**: `disruptive` / `us-east-1`  
**CodeDeploy group**: **`miempresa-prod` ONLY** (never `miempresa-staging`)  
**Instance**: `miempresa-backend-prod` @ `44.195.227.44`  
**HEAD**: `36f27f2`  
**Status**: WAITING — run only after staging smoke PASS and an explicit "yes, proceed" in this conversation.

## Why

Prod logs 2026-09-11:

- `gerontologa@` POST `/certificates` 201 then POST `/:id/updates` **403** (empty cert; S3 presign 200).
- `contratos@` POST `/patients` **400** Zod `email` six times (not DOMAIN_FORBIDDEN).

## Do not run until staging is green

Staging runbook: `context/implementation-plan/staging-release-sep11-cert-paciente-runbook.md`.

## Commands (prod) — show, then wait

```bash
# R0 (read-only)
curl -sS https://miempresa-api.disruptiveexp.com/api/v1/health
aws deploy list-deployments --application-name miempresa-app \
  --deployment-group-name miempresa-prod --region us-east-1 --profile disruptive --max-items 3

# R1 backup on prod instance
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@44.195.227.44 '...'  # pg_dump miempresa_prod

# R4 zip from backend/, restore appspec.yml, exclude generated/
# S3: s3://miempresa-artifacts-540657241795-prod/deployments/
# create-deployment --deployment-group-name miempresa-prod

# R5
./frontend/infrastructure/scripts/deploy-frontend.sh --stage prod --region us-east-1 --profile disruptive
```

## Rollback

Prior prod CodeDeploy `d-EYN1OE0NL` (initial). Confirm latest successful prod id at R0 before overwrite.

## Grep hooks

```
sep-11 36f27f2 geronto-updates patient-email
miempresa-prod 44.195.227.44
```
