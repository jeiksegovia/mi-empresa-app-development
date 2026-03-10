# Task Report: AWS SAM Serverless Deployment + Prisma Upgrade

**Date:** 2026-03-03
**Status:** Complete
**Tests:** 128 existing + 8 new smoke tests all passing

---

## Task Definition

Deploy mi-empresa-backend (Express 4 + Prisma + TypeScript, Node 22) to AWS Lambda via SAM CloudFormation. Upgrade Prisma 6.5 → 6.19.2 (Query Compiler) to eliminate native binary for Lambda packaging.

---

## Plan Summary

6 phases: Prisma upgrade + QA → serverless code changes → SAM infrastructure → CI/CD → smoke tests → documentation

---

## Phase 1: Prisma Upgrade + QA

### 1A: Upgrade Dependencies
- Installed `prisma@^6` (resolved to 6.19.2), `@prisma/client@^6`, `@prisma/adapter-pg@^6`
- Added `engineType = "client"` to generator block in `backend/prisma/schema.prisma`
- `npx prisma generate` succeeds; produces `query_compiler_bg.wasm` confirming WASM Query Compiler active
- Note: `libquery_engine-darwin-arm64.dylib.node` still present in dev (macOS platform binary) — expected

### 1B: QA Test Suite (Issues Found & Fixed)

**Issue 1: PrismaPg adapter required for engineType="client"**
- Prisma 6 `engineType = "client"` requires explicit driver adapter
- QA agent fixed `database.ts` to use `PrismaPg({ connectionString })`
- QA agent fixed `seed.ts` to use same adapter pattern

**Issue 2: Cookie name mismatch in auth middleware**
- `auth.routes.ts` sets cookie as `session=<token>`
- `auth.ts` middleware was reading `req.cookies?.sessionToken` (old name)
- Fixed to `req.cookies?.session`

**Result:** 128/128 tests passing

---

## Phase 2: Serverless Code Changes

### 2A: bcrypt → bcryptjs
- `src/services/authService.ts` line 1: `bcrypt` → `bcryptjs`
- `prisma/seed.ts`: `bcrypt` → `bcryptjs`
- Removed `bcrypt` and `@types/bcrypt` packages

### 2B: Config changes for Lambda
- `src/config/env.ts`: Wrapped `dotenv.config()` with `if (!process.env.AWS_LAMBDA_FUNCTION_NAME)`
- `src/config/database.ts`: Full rewrite using `pg.Pool` with `max: 1` on Lambda, `max: 10` locally

**Final database.ts pattern (uses Pool not { connectionString }):**
```typescript
const pool = new Pool({
  connectionString,
  max: isLambda ? 1 : 10,
  idleTimeoutMillis: isLambda ? 10000 : 30000,
  connectionTimeoutMillis: 5000,
})
const adapter = new PrismaPg(pool)
```
This differs from the plan (which used `datasources` approach) because `engineType="client"` requires explicit adapter.

### 2C: New Lambda entry points
- `src/lambda.ts`: `serverless-http` wrapper, `callbackWaitsForEmptyEventLoop = false`, cold start logging
- `src/migrate.lambda.ts`: `prisma migrate deploy` Lambda handler

### 2D: Dependencies
- Added `serverless-http@4.0.0`, `@types/aws-lambda@8.10.161`, `esbuild@0.27.3`
- Removed `bcrypt`, `@types/bcrypt`

### 2E: Regression test
- 128/128 tests still passing after all changes

---

## Phase 3: SAM Infrastructure

### Files Created:
- `backend/template.yaml` — Full CloudFormation: VPC, 2-AZ subnets, NAT Gateway, RDS Proxy, Lambda, API Gateway HTTP v2, IAM, monitoring
- `backend/samconfig.toml` — dev/prod deploy configs
- `backend/env.local.json` — Local `sam local` env vars (uses `host.docker.internal:15432`)
- `backend/scripts/bootstrap-ssm.sh` — One-time SSM parameter setup (JWT_SECRET, CORS_ORIGIN)
- `backend/events/health.json` — API Gateway v2 test event for `sam local invoke`

### Key template decisions:
- `AppFunction` uses esbuild CJS bundling with `@prisma/engines` external (not needed with Query Compiler)
- `DATABASE_URL` in template uses pg Pool's `max:1` via code — no `connection_limit=1` query param needed
- `MigrationFunction` timeout: 300s, 256MB
- RDS Proxy: `MaxConnectionsPercent: 80`, `RequireTLS: true`
- `LambdaErrorAlarm` only deployed on prod (`Condition: IsProd`)

---

## Phase 4: CI/CD

### Files Created:
- `.github/workflows/ci.yml` — Runs on all pushes: postgres service container, npm ci, prisma generate, typecheck, migrate, seed, playwright tests, sam validate
- `.github/workflows/deploy.yml` — Triggers on push to main (backend/** path), deploys dev then prod (with environment protection/manual approval)

### Required GitHub Secrets:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — dev environment
- `AWS_PROD_ACCESS_KEY_ID`, `AWS_PROD_SECRET_ACCESS_KEY` — prod environment

---

## Phase 5: Smoke Tests

### Files Created:
- `backend/tests/serverless/smoke.spec.ts` — Playwright API tests (8 tests, 1 skipped requiring credentials)
- `backend/tests/serverless/smoke.test.sh` — Bash curl tests (6 checks)

### Fixes from original plan:
- Routes are English (`/employees`, `/patients`, `/dashboard/stats`) not Spanish (`/empleados`, `/pacientes`)
- Dashboard base path `/api/v1/dashboard` returns 404; sub-path `/api/v1/dashboard/stats` returns 401

### Test results:
- Playwright: 8 passed, 1 skipped (auth flow — requires TEST_USER_EMAIL/TEST_USER_PASSWORD)
- Bash: 6/6 passed

---

## Final File Manifest

### New Files (11)
| File | Phase |
|------|-------|
| `backend/src/lambda.ts` | 2 |
| `backend/src/migrate.lambda.ts` | 2 |
| `backend/template.yaml` | 3 |
| `backend/samconfig.toml` | 3 |
| `backend/env.local.json` | 3 |
| `backend/scripts/bootstrap-ssm.sh` | 3 |
| `backend/events/health.json` | 3 |
| `.github/workflows/ci.yml` | 4 |
| `.github/workflows/deploy.yml` | 4 |
| `backend/tests/serverless/smoke.spec.ts` | 5 |
| `backend/tests/serverless/smoke.test.sh` | 5 |

### Modified Files (6)
| File | Change |
|------|--------|
| `backend/package.json` | Prisma upgrade, removed bcrypt, added serverless-http/esbuild/@types/aws-lambda, 5 new scripts |
| `backend/prisma/schema.prisma` | Added `engineType = "client"` to generator block |
| `backend/src/services/authService.ts` | `bcrypt` → `bcryptjs` import |
| `backend/prisma/seed.ts` | `bcrypt` → `bcryptjs` import + PrismaPg adapter |
| `backend/src/config/env.ts` | Lambda guard for `dotenv.config()` |
| `backend/src/config/database.ts` | Full rewrite with pg.Pool + Lambda connection limits |
| `backend/src/middleware/auth.ts` | Fixed cookie name `sessionToken` → `session` |

---

## Verification Commands

```bash
# Verify Prisma upgrade
cd backend && npx prisma --version  # 6.19.2

# Run full test suite
cd backend && npm run dev & sleep 4 && npm run test:api  # 128 passed

# Smoke tests
TEST_API_URL=http://localhost:3001 bash tests/serverless/smoke.test.sh  # 6 passed
TEST_API_URL=http://localhost:3001 npx playwright test tests/serverless/  # 8 passed

# SAM (requires sam CLI installed)
cd backend && sam validate --lint
sam build
```

---

## Deviations from Plan

1. **Prisma 7 installed initially** — `prisma@latest` resolved to 7.x (breaking changes). Corrected to `prisma@^6` → 6.19.2.
2. **database.ts uses pg.Pool not datasources** — Plan specified `datasources: { db: { url: ... connection_limit=1 } }` approach. Since `engineType="client"` requires explicit adapter, used `new Pool({ max: 1 })` instead — equivalent behavior, cleaner approach.
3. **auth middleware cookie bug fixed** — Cookie name `sessionToken` → `session` was a pre-existing bug unrelated to serverless work; fixed during QA.
4. **Route paths are English** — Plan's smoke tests used Spanish paths (`/empleados`). Corrected to actual paths (`/employees`).
5. **`bcrypt` already in dependencies** — Only import swap needed; package was already listed in package.json.
