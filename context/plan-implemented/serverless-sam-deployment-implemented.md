# AWS SAM Serverless Deployment — Implemented

**Date:** 2026-03-03
**Plan:** AWS SAM Serverless Deployment + Prisma Upgrade
**Status:** Complete — all tests passing

---

## Overview

mi-empresa-backend (Express 4 + Prisma + TypeScript, Node 22) is now configured for AWS Lambda deployment via SAM CloudFormation. Prisma upgraded 6.5 → 6.19.2 with WASM Query Compiler (no native binary in Lambda bundle).

---

## Stack

- **Runtime:** Node 22.x ARM64
- **Lambda adapter:** serverless-http@4.0.0
- **Prisma:** 6.19.2 + engineType="client" (WASM Query Compiler)
- **DB adapter:** @prisma/adapter-pg + pg.Pool (max:1 on Lambda)
- **IaC:** AWS SAM CloudFormation
- **Build:** esbuild CJS bundling
- **API:** HTTP API Gateway v2

---

## Key Decisions

### Prisma Query Compiler (not native binary)
- `engineType = "client"` in `schema.prisma` enables WASM Query Compiler
- Eliminates 14MB native binary from Lambda bundle
- Required explicit `PrismaPg` adapter wiring (not auto-connect from URL)
- `pg.Pool({ max: 1 })` on Lambda; `max: 10` locally

### bcrypt → bcryptjs
- Pure-JS replacement eliminates native module Lambda packaging issues
- API identical: `bcrypt.hash()`, `bcrypt.compare()` signatures unchanged

### Database connection pooling
- Lambda: `pg.Pool max: 1` → RDS Proxy pools → RDS PostgreSQL
- RDS Proxy: `MaxConnectionsPercent: 80`, `RequireTLS: true`
- `callbackWaitsForEmptyEventLoop = false` prevents Lambda timeout waiting for pg pool

### env.ts Lambda guard
- `dotenv.config()` only runs when `AWS_LAMBDA_FUNCTION_NAME` is not set
- Lambda receives env vars from CloudFormation SSM/SecretsManager resolvers

---

## Infrastructure Provisioned (template.yaml)

- VPC 10.0.0.0/16, 2 public + 2 private subnets (us-east-1a/b)
- NAT Gateway (single, public subnet)
- Security group chain: LambdaSG → ProxySG → RDSSG (port 5432 only)
- RDS PostgreSQL 15.4, db.t3.micro (dev) / db.t3.medium (prod)
- RDS Proxy with Secrets Manager auth
- Lambda AppFunction: 512MB, 29s timeout, esbuild CJS
- Lambda MigrationFunction: 256MB, 300s timeout
- API Gateway HTTP API v2 with CORS
- IAM: VPC execution + CloudWatch + SSM + SecretsManager
- CloudWatch error alarm (prod only)

---

## CI/CD

- `ci.yml`: all-branch CI with postgres service container + playwright tests + sam validate
- `deploy.yml`: main branch → deploy-dev → deploy-prod (requires GitHub environment approval)
- Required secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_PROD_*` variants

---

## Files Changed/Created

**New files (11):**
`src/lambda.ts`, `src/migrate.lambda.ts`, `template.yaml`, `samconfig.toml`,
`env.local.json`, `scripts/bootstrap-ssm.sh`, `events/health.json`,
`.github/workflows/ci.yml`, `.github/workflows/deploy.yml`,
`tests/serverless/smoke.spec.ts`, `tests/serverless/smoke.test.sh`

**Modified (7):**
`package.json`, `prisma/schema.prisma`, `src/services/authService.ts`,
`prisma/seed.ts`, `src/config/env.ts`, `src/config/database.ts`, `src/middleware/auth.ts`

---

## Test Results

- Existing suite: 128/128 passing
- Playwright smoke: 8 passed, 1 skipped (auth flow; requires test credentials)
- Bash smoke: 6/6 passed

---

## Deviations from Plan

| Plan | Actual | Reason |
|------|--------|--------|
| `prisma@latest` (6.16+) | `prisma@^6` → 6.19.2 | `@latest` resolved to Prisma 7 (breaking changes) |
| `datasources: { db: { url: ...connection_limit=1 } }` | `pg.Pool({ max: 1 })` | engineType="client" requires explicit adapter; Pool approach is equivalent |
| Spanish route paths in smoke tests | English paths (`/employees`, `/patients`) | Backend uses English paths only |
| Cookie name in auth middleware | Fixed `sessionToken` → `session` | Pre-existing bug discovered during QA |

---

## First Deploy Checklist

```bash
# 1. Bootstrap SSM parameters (one-time)
bash backend/scripts/bootstrap-ssm.sh dev

# 2. Create S3 artifact bucket (one-time)
aws s3 mb s3://mi-empresa-sam-artifacts-dev --region us-east-1

# 3. Build and deploy
cd backend && sam build --config-env dev
sam deploy --config-env dev

# 4. Run migrations
aws lambda invoke --function-name mi-empresa-dev-migration --payload '{}' /tmp/out.json

# 5. Health check
API_URL=$(aws cloudformation describe-stacks --stack-name mi-empresa-dev \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
curl -f "${API_URL}/api/v1/health"
```

---

## Searchable Keywords

serverless lambda sam aws express prisma prisma-query-compiler engineType-client
bcryptjs pg-pool rds-proxy connection-limit serverless-http cold-start
api-gateway-http-v2 cloudformation vpc nat-gateway rds-postgresql
github-actions ci-cd playwright smoke-tests
