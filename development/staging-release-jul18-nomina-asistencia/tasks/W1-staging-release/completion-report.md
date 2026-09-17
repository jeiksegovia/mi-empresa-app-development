# R4 Completion Report — Staging Backend CodeDeploy

**Worker**: W1 devops-infra  
**Phase**: R4 only  
**Date**: 2026-07-20  
**Environment**: staging (`disruptive`, `us-east-1`)  
**Production safety**: no production resource was targeted; CodeDeploy group was `miempresa-staging` only.

## Resources

- CodeDeploy application: `miempresa-app`
- CodeDeploy deployment group: `miempresa-staging`
- Deployment ID: `d-8OHAZOPOK`
- Artifact bucket: `miempresa-artifacts-540657241795-staging`
- Artifact key: `deployments/jul20-nomina-asistencia-20260720-180836.zip`
- Artifact size: `351808` bytes
- Artifact ETag: `3f6edcd84775402f4e1afb44fcc6c739`
- Staging instance: `54.144.25.72` (`miempresa-backend-staging`)
- Health URL: `https://miempresa-api-stg.disruptiveexp.com/api/v1/health`

## Acceptance evidence

### Backend build and artifact

```text
$ cd backend && npm ci --no-audit --no-fund && npm run build
added 426 packages in 4s
> mi-empresa-backend@1.0.0 build
> tsc

$ test -f dist/server.js && test ! -d dist/generated
BUILD_OK
-rw-r--r-- 1 jeik staff 724 Jul 20 18:08 dist/server.js
```

Artifact `/tmp/miempresa-staging-jul20-nomina-asistencia-20260720-180836.zip` was created with `appspec.yml` at the ZIP root. `dist/generated`, `src/generated`, and `node_modules` were excluded; Prisma client generation remains an on-instance lifecycle step.

### Artifact upload

```text
upload: ../../../../../tmp/miempresa-staging-jul20-nomina-asistencia-20260720-180836.zip to s3://miempresa-artifacts-540657241795-staging/deployments/jul20-nomina-asistencia-20260720-180836.zip
ContentLength=351808
ETag="3f6edcd84775402f4e1afb44fcc6c739"
LastModified=2026-07-20T23:09:04+00:00
```

### CodeDeploy status

```text
$ aws deploy wait deployment-successful --deployment-id d-8OHAZOPOK --region us-east-1 --profile disruptive
# exit code 0

$ aws deploy get-deployment --deployment-id d-8OHAZOPOK --region us-east-1 --profile disruptive
{
    "id": "d-8OHAZOPOK",
    "status": "Succeeded",
    "application": "miempresa-app",
    "group": "miempresa-staging",
    "completeTime": "2026-07-20T18:10:39.044000-05:00"
}
```

### On-instance migrations

```text
$ ssh ... ec2-user@54.144.25.72 \
    'cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E "migrations found|Database schema|failed|drift"'
23 migrations found in prisma/migrations
Database schema is up to date!
```

### Health

```text
$ curl -sS -o /tmp/miempresa-staging-health-r4.json -w '%{http_code}' \
    https://miempresa-api-stg.disruptiveexp.com/api/v1/health
HTTP=200
BODY={"status":"ok","timestamp":"2026-07-20T23:11:31.884Z"}
```

## Verification summary

| Criterion | Result |
|---|---|
| Build from working tree | PASS — `tsc` exit 0; `dist/server.js` present |
| Root appspec and safe artifact contents | PASS — root `appspec.yml`; generated paths/node_modules excluded |
| Staging S3 upload | PASS — object head verified, 351808 bytes |
| CodeDeploy deployment | PASS — `d-8OHAZOPOK` Succeeded |
| On-instance migrations | PASS — 23 migrations; schema up to date |
| API health | PASS — HTTP 200, `status=ok` |
| Production safety | PASS — no `miempresa-prod` deployment target or mutation |
| Auto-rollback | NOT INVOKED — no rollback command/action issued |

## Phase gate

R4 is complete. Per assignment, R5 Amplify was not started. Awaiting explicit `PROCEED PHASE R5:` from the orchestrator.

---

# R5 + R6 Completion — Frontend Amplify + Feature canary

**Wave**: R5→R6 auto-chain (developer authorized) · **Completed**: 2026-07-20 (R5 19:49 local, R6 ~20:05 local)
**Hard rules honored**: no prod touched · no auto-rollback · no passwords in docs · no `pkill node`.

## Resources / IDs

| Resource | Value |
|---|---|
| Amplify app | `d1nsxjyualdzdu` (miempresa-frontend-staging), branch `staging` |
| Amplify job (R5) | **10 · SUCCEED** (19:49:33→19:49:41 local; independent `get-job` confirmed) |
| FE artifact | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260720-194930.zip` (2.1M) |
| FE custom domain | `https://miempresa-stg.disruptiveexp.com` → 200 |
| FE default domain | `https://staging.d1nsxjyualdzdu.amplifyapp.com` → 200 |
| API base | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| QA creds | SSM `/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/{EMAIL,PASSWORD}` (SecureString, never logged) |

## R5 — Frontend Amplify (acceptance = command + output)

- `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive` → exit 0. Nuxt 4.3.1 static; **18 routes prerendered incl. new `/asistencia`** (jul17-2 had 17); API base baked = staging.
- Amplify SUCCEED — independent: `aws amplify get-job --app-id d1nsxjyualdzdu --branch-name staging --job-id 10` → `["10","SUCCEED",19:49:33,19:49:41]`
- Domains (verbatim): custom **200**, default **200**, `/asistencia` **200**.
- Log: `/tmp/r5-logs/deploy-frontend.log`

## R6 — Feature canary (all PASS)

API canary (`/tmp/r6-logs/api-canary.out`) — logins 200 w/ correct rol/tipo:

| Check | Result |
|---|---|
| C1 admin: `/asistencia` · `/nomina` · `/instruments` | 200 · 200 · 200 |
| C2 contratos: `/asistencia` · `/asistencia/resumen` | 200 · 200 (domain allow) |
| C2 contratos: `/instruments` (instrumentos gated) | **403 DOMAIN_FORBIDDEN** |
| C3 gerontologa: `/asistencia` | **403 DOMAIN_FORBIDDEN** |
| C4 regression: `/instruments` admin + gerontologa | 200 · 200 |

Browser canary (`/tmp/r6-logs/nav-gating.out`) — `rbac/nav-gating.spec.ts` vs R5 bundle, **5/5 passed**:
GERONTOLOGA asistencia hidden · CONTRATOS asistencia visible + instrumentos hidden · ADMIN all visible incl. Asistencia · CONTRATOS forbidden-route redirect+toast · fichas tab gating.

**Failure classification: none.** Security posture matches contract (GERONTOLOGA.asistencia=false, CONTRATOS.asistencia=true).

## Re-runnable verification

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com   # 200
aws amplify get-job --app-id d1nsxjyualdzdu --branch-name staging --job-id 10 \
  --region us-east-1 --profile disruptive --query 'job.summary.status' --output text   # SUCCEED
bash /tmp/r6-logs/api-canary.sh                                                     # canary matrix
cd frontend && TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com \
  TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1 \
  npx playwright test rbac/nav-gating.spec.ts --reporter=list                       # 5 passed
```

## Deviations / notes
- Instruments API path is `/instruments` (route mount); `instrumentos` is the RBAC domain key — first canary pass used the wrong path (404), corrected.
- No staging DB rows mutated: API canary read-only; browser canary uses mocked session (real sidebar/middleware). Optional attendance toggle/save skipped to keep staging data clean.
- Full evidence: runbook `## R5 actuals` / `## R6 actuals`.

## Phase gate — R5 + R6 complete → **W1-staging-release DONE** (R-pre…R6 all complete).
