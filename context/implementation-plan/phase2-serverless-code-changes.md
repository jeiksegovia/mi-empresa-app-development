# Phase 2: Serverless Code Changes — Implementation Report

**Date**: 2026-03-03
**Status**: Completed
**Regression**: 128/128 tests passing

---

## Task Definition

Implement serverless-compatible code changes to the mi-empresa backend:
- Replace native bcrypt with bcryptjs (pure JS, no native bindings)
- Update config files for Lambda compatibility
- Create Lambda entry points (apiHandler + migration handler)
- Install serverless-http, @types/aws-lambda, esbuild
- Add SAM-related npm scripts

---

## Plan Executed

### 2A: Replace bcrypt with bcryptjs
- Changed `import bcrypt from 'bcrypt'` → `import bcrypt from 'bcryptjs'` in:
  - `backend/src/services/authService.ts`
  - `backend/prisma/seed.ts`
- Ran `npm uninstall bcrypt @types/bcrypt` (removed 4 packages including native bindings)
- bcryptjs was already listed in dependencies, no install needed

### 2B: Config files for Lambda compatibility

**env.ts**: Wrapped `dotenv.config()` with Lambda detection guard:
```typescript
if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dotenv.config()
}
```
Prevents dotenv from overwriting env vars already injected by Lambda runtime.

**database.ts**: Replaced `{ connectionString }` adapter pattern with explicit `pg.Pool` instance:
- Pool max: 1 on Lambda, 10 on non-Lambda
- idleTimeoutMillis: 10s on Lambda, 30s elsewhere
- connectionTimeoutMillis: 5000ms always
- Detects Lambda via `!!process.env.AWS_LAMBDA_FUNCTION_NAME`

### 2C: Lambda entry points created
- `backend/src/lambda.ts` — wraps Express app with `serverless-http`, tracks cold starts, sets `callbackWaitsForEmptyEventLoop = false`
- `backend/src/migrate.lambda.ts` — runs `prisma migrate deploy` via execSync, returns structured HTTP-style response for Lambda invocation

### 2D: Dependencies installed
- `serverless-http@4.0.0` (production dependency)
- `@types/aws-lambda@8.10.161` (dev dependency)
- `esbuild@0.27.3` (dev dependency)

### 2E: package.json scripts added
```json
"build:lambda": "sam build",
"local:lambda": "sam local start-api --env-vars env.local.json --warm-containers EAGER",
"test:serverless": "TEST_API_URL=http://127.0.0.1:3000 playwright test tests/serverless/",
"deploy:dev": "sam deploy",
"deploy:prod": "sam deploy --config-env prod"
```

---

## Files Changed

| File | Change |
|------|--------|
| `backend/src/services/authService.ts` | bcrypt → bcryptjs import |
| `backend/prisma/seed.ts` | bcrypt → bcryptjs import |
| `backend/src/config/env.ts` | Lambda-conditional dotenv.config() |
| `backend/src/config/database.ts` | Full rewrite — pg.Pool with Lambda-aware connection limits |
| `backend/src/lambda.ts` | NEW — serverless-http Express wrapper with cold start logging |
| `backend/src/migrate.lambda.ts` | NEW — Prisma migrate deploy Lambda handler |
| `backend/package.json` | Removed bcrypt/types, added serverless-http, @types/aws-lambda, esbuild, 5 new scripts |

---

## Regression Results

```
128 passed (3.2s)
0 failed
```

Tests covered: auth (23), employees (26), patients (28), instruments (42), dashboard (3), empresa (3), usuario-empleado link (5).

---

## Notes / Deviations

- `bcryptjs` was already present in `package.json` dependencies before this phase (added in an earlier pass), so no additional install was needed for it.
- `esbuild` was already listed in devDependencies after running `npm install -D @types/aws-lambda esbuild` — only 1 net new package (aws-lambda types) was added since esbuild was possibly already there.
- The existing dev server was already running on port 3001 at test time; killed it and restarted with new code to confirm bcryptjs works correctly before running the regression suite.
