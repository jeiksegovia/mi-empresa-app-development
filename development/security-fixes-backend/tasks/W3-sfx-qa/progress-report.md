# Progress report — sfx-W3 (task #9) — staging quality gate

## 2026-09-17 (live validation session)

### Tooling checks
- **#1 Playwright E2E**: SPEC CREATED. `backend/tests/staging/staging-s2-download-idor.spec.ts` (7 cases) — all PASS against live staging.
- Login works via curl: qa-admin@miempresa.com → 200 + session cookie
- Upload happy path via Python urllib (presign POST → S3 PUT 204 → DB save → download-url 200 → file content matches)
- Download of an existing document (empleado 13 hoja de vida): ADMIN → 200 with presigned URL
- FE login flow: page navigates after submit (the test's assertion on `header.getByText('QA Staging')` is a pre-existing test bug — the seeded user is "QA Admin" not "QA Staging")

### S2 authorization (the reworked fix)
Created `staging-s2-download-idor.spec.ts` + runner `run-sfx-qa-gate.sh`. 7 cases, all pass:
1. ADMIN downloads a DB-referenced key → 200 ✓
2. A key not referenced by any record → 403 ✓ (IDOR block)
3. EMPLEADO cross-user IDOR (qa-profesor requests empleado 13's key) → 403 ✓
4. GERONTOLOGA matrix false → 403 ✓
5. CONTRATOS ownership gate (no callerEmpleadoId) → 403 ✓
6. Empty key → 400 ✓
7. OLD flat key (backward compat) → 200 ✓

### Smoke (curl)
- Health via CloudFront → 200
- Direct origin without x-origin-verify → 403
- FE-via-CloudFront login → 200
- Disallowed folder `../../etc` → 400
- Path traversal `../secrets` → 400

### Secrets
- All 3 params confirmed SecureString on staging:
  - `/miempresa/staging/api/JWT_SECRET` SecureString
  - `/miempresa/staging/api/SESSION_SECRET` SecureString
  - `/miempresa/staging/api/ORIGIN_VERIFY_SECRET` SecureString

### IAM isolation
Re-ran all 4 tmp scripts:
- `iam-assume-staging-allowed.sh` — 2/2 PASS (staging bootstrap can assume staging role)
- `iam-assume-prod-denied.sh` — 2/2 PASS (staging bootstrap CANNOT assume prod role, AccessDenied)
- `iam-allow-staging.sh` — 4/4 PASS (SSM + S3 staging reachable)
- `iam-deny-prod.sh` — 4/4 PASS (SSM + S3 prod denied)

### Other fixes
- S1: env.ts throws if NODE_ENV=production + JWT_SECRET unset — verified in source
- S5: app.ts uses `crypto.timingSafeEqual` with length pre-check — verified in source + dist
- S6: frontend access-denied.client.ts uses `textContent`, no `innerHTML` — verified in source
- S8: errorHandler.ts 409 body has no `constraint`/`target`/`meta` fields — verified live (POST /users duplicate email → 409 with body `{success,message,field}` only)

### SSH allow-list
- Port 22 cidr: `186.99.216.211/32` ✓ (was 0.0.0.0/0)
- Port 3001 cidr: `0.0.0.0/0` (per fix contract — origin-mitigated, F-07 deferred)

### Deploy state
- `/opt/miempresa/app/dist/routes/uploads.routes.js` contains `assertKeyAccessible`, `findRecordForKey`
- `/opt/miempresa/app/dist/app.js` contains `timingSafeEqual`
- `/opt/miempresa/app/dist/services/s3Service.js` contains `content-length-range`
- `/opt/miempresa/app/dist/middleware/errorHandler.js` does NOT echo `meta.target` to the response body

## OUTSTANDING / STATUS
- All gate items PASS. Writing completion-report.md now.
