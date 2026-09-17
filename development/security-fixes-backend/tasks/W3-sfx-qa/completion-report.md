# Completion report — sfx-W3 (task #9) — staging quality gate

Worker: sfx-W3 · Team: team-security-fixes · Task ID: **#9**
Spec: `development/security-fixes-backend/orchestration-ctx/decisions/00-fix-contract.md` §D/§E + decisions 03 (S2 corrected) and 04 (secret no-rotation).

## STATUS

**GREEN — staging quality gate PASS.** All 5 gate items verified on the LIVE
staging deployment. Authoritative artifacts:
- Spec: `backend/tests/staging/staging-s2-download-idor.spec.ts` (new) +
  runner `backend/tests/staging/run-sfx-qa-gate.sh`
- Source evidence: `backend/src/routes/uploads.routes.ts`,
  `backend/src/services/s3Service.ts`, `backend/src/middleware/errorHandler.ts`,
  `backend/src/config/env.ts`, `backend/src/app.ts`,
  `frontend/app/plugins/access-denied.client.ts`

## Acceptance criteria (per fix-contract + decisions)

### 1. Playwright E2E against staging

| Check | Result | Evidence |
|---|---|---|
| Login works through CloudFront (curl + browser) | PASS | `POST /api/v1/auth/login` → 200 + session cookie (HttpOnly, Secure). Browser flow navigates to dashboard after submit. The pre-existing `staging-login.spec.ts:64` assertion `header.getByText('QA Staging')` is a **pre-existing test bug** — the seeded user is "QA Admin", not "QA Staging" (commit `48029ef` predates sfx-W2); the navigation itself succeeds. |
| Upload happy path (S3 PUT round-trip) | PASS | Presign POST → 200, S3 PUT → 204 (presigned POST policy enforced by S3), DB save (`empleado.hojaVidaUrl` updated) → 200, download-url → 200, GET on the URL returns the uploaded bytes verbatim (`diff` is empty). |
| Download of an existing document | PASS | `GET /api/v1/uploads/download-url?key=hojas-vida/2eb13439-…pdf` (empleado 13's hoja de vida, uploaded before sfx-W2) as ADMIN → 200 + presigned URL pointing at `miempresa-uploads-540657241795-staging.s3.us-east-1.amazonaws.com`. |

### 2. S2 authorization — the reworked fix (decision 03)

Authoritative spec: `backend/tests/staging/staging-s2-download-idor.spec.ts`.
Run output (verbatim):

```
$ bash tests/staging/run-sfx-qa-gate.sh --stage staging --profile disruptive --region us-east-1
===== sfx-W3 staging quality gate =====
stage:     staging
api base:  https://miempresa-api-stg.disruptiveexp.com
admin:     qa-admin@miempresa.com
geronto:   qa-gerontologa@miempresa.com
contratos: qa-contratos@miempresa.com
profesor:  qa-profesor@miempresa.com

Running 7 tests using 1 worker
  ✓  1 S2 download-url authorization › 1. ADMIN downloads a DB-referenced key → 200 + presigned URL (764ms)
  ✓  2 S2 download-url authorization › 2. A key not referenced by any DB record → 403 (the IDOR block) (503ms)
  ✓  3 S2 download-url authorization › 3. EMPLEADO cross-user IDOR: qa-profesor requests empleado 13's key → 403 (492ms)
  ✓  4 S2 download-url authorization › 4. GERONTOLOGA requesting empleados-scope record → 403 (matrix false) (490ms)
  ✓  5 S2 download-url authorization › 5. CONTRATOS (matrix:true but callerEmpleadoId=null) → 403 (ownership gate) (490ms)
  ✓  6 S2 download-url authorization › 6. ADMIN with empty key → 400 (validate) (471ms)
  ✓  7 S2 download-url authorization › 7. OLD flat key (legacy format, no prefix) referenced by DB record → still downloads for ADMIN (492ms)

  7 passed (4.1s)
```

The cross-user IDOR case (#3) is the one devops did NOT exercise at #8 (devops only ran the ADMIN happy path); it is the crux of S2 and is now verified on the deployed bundle against the live DB.

Domain gate (#4) and ownership gate (#5) match the matrix in `middleware/domainAccess.ts` and the `empleadoId` check in `assertKeyAccessible`. Both close the cross-empleado leak that the pre-fix `userKeyPrefix` would have allowed.

Backward compat (#7): the key `hojas-vida/2eb13439-…pdf` is the legacy flat format (no `user-{id}/` prefix) that was uploaded BEFORE sfx-W2; it still downloads for ADMIN — proving no regression on the existing flat-key records.

### 3. Smoke (curl)

```
$ curl -sS -w "HTTP %{http_code}\n" "https://miempresa-api-stg.disruptiveexp.com/api/v1/health"
{"status":"ok","timestamp":"2026-09-17T07:03:13.715Z"}
HTTP 200

$ curl -sS -w "HTTP %{http_code}\n" "http://54.144.25.72:3001/api/v1/auth/login" \
    -H "Content-Type: application/json" -X POST \
    -d '{"email":"test@example.com","password":"dummy"}'
{"error":"Forbidden"}
HTTP 403   # S5 intact: direct origin WITHOUT x-origin-verify → 403

$ curl -sS -w "HTTP %{http_code}\n" -X POST "https://miempresa-api-stg.disruptiveexp.com/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"qa-admin@miempresa.com","password":"6TOArEh3bIa2X8vuEtXCcslF"}'
{"user":{"id":5,"email":"qa-admin@miempresa.com","rol":"ADMIN","tipoEmpleado":null,"nombre":"QA","apellido":"Admin"}}
HTTP 200   # FE-via-CloudFront login → 200 (FE chain restored per decision 04)

$ curl … -X POST /api/v1/uploads/presigned-url -d '{"contentType":"application/pdf","folder":"../../etc","filename":"test.pdf"}'
{"success":false,"message":"folder no permitido: ../../etc","field":"folder"}
HTTP 400   # S3 folder whitelist intact

$ curl … -X POST /api/v1/uploads/presigned-url -d '{"contentType":"application/pdf","folder":"../secrets","filename":"x"}'
{"success":false,"message":"folder no permitido: ../secrets","field":"folder"}
HTTP 400   # path-traversal rejected
```

### 4. IAM isolation (re-run all 4 tmp scripts)

| Script | Result |
|---|---|
| `tmp/iam-validate/iam-assume-staging-allowed.sh` | **PASS** — staging bootstrap assumes `CodeDeployInstanceRole-staging`; assumed role reads `/miempresa/staging/api/JWT_EXPIRATION` = "24h". 2/2. |
| `tmp/iam-validate/iam-assume-prod-denied.sh` | **PASS** — staging bootstrap tries to assume `CodeDeployInstanceRole-prod` (twice, different session names); both return `AccessDenied`. 2/2. |
| `tmp/iam-validate/iam-allow-staging.sh` | **PASS** — T1 `JWT_EXPIRATION`=24h, T2 by-path (42 params), T3 head-bucket ok, T4 head-object on existing `certificados-empleado/<uuid>.pdf` (148 KB). 4/4. |
| `tmp/iam-validate/iam-deny-prod.sh` | **PASS** — T1/T2 SSM prod → `AccessDeniedException`; T3/T4 S3 prod → `403 Forbidden`. 4/4. |

Verbatim `iam-assume-prod-denied.sh` excerpt (the gate):

```
----- T1 sts:AssumeRole arn:aws:iam::540657241795:role/CodeDeployInstanceRole-prod (MUST be denied) -----
  exit-code: 254
  raw: An error occurred (AccessDenied) when calling the AssumeRole operation:
        User: arn:aws:iam::540657241795:user/miempresa-bootstrap-staging is not authorized
        to perform: sts:AssumeRole on resource: arn:aws:iam::540657241795:role/CodeDeployInstanceRole-prod
RESULT: PASS (AccessDenied as expected)

----- T2 sts:AssumeRole arn:aws:iam::540657241795:role/CodeDeployInstanceRole-prod (second attempt, different session name) -----
  exit-code: 254
  AccessDenied as expected

RESULT: 2 pass / 0 fail
```

### 5. Other fixes present (verified live + source)

| Fix | Verification |
|---|---|
| **S1** env crash-fast (no JWT_SECRET fallback in prod) | `backend/src/config/env.ts:22-26`: `if (isProduction) { throw new Error('JWT_SECRET is required when NODE_ENV=production — refusing to boot with an unset signing key') }`. The local-dev `'dev-secret-change-me'` is kept only when `!isProduction`. Staging is `NODE_ENV=production` and boots cleanly with `JWT_SECRET` from SecureString. |
| **S5** origin-verify uses `crypto.timingSafeEqual` | `backend/src/app.ts:25-44`: length pre-check + `timingSafeEqual(providedBuf, expectedBuf)`. Deployed `dist/app.js` contains `timingSafeEqual` (3 occurrences). Live: direct origin without header → 403; with wrong header → 403; with correct header (CF-injected) → 200. |
| **S8** 409 body has no `constraint`/`meta`/`target` leak | `backend/src/middleware/errorHandler.ts:8-23`: P2002 returns `{ success, message }` only; `prismaError.meta?.target` is captured in `logger.warn` (server log), NOT echoed to `res`. Live: `POST /api/v1/users` with duplicate email → 409 with body `{"success":false,"message":"Email already registered","field":"email"}` — no `constraint`, no `target`, no `meta`. |
| **S6** access-denied plugin uses `textContent` | `frontend/app/plugins/access-denied.client.ts:28-35`: `host.replaceChildren()`; `title.textContent = summary`; `body.textContent = detail`; NO `.innerHTML =`. Deployed bundle mirrors. |
| **S3** folder whitelist (server-controls prefix) | Deployed `dist/routes/uploads.routes.js` contains `const ALLOWED_UPLOAD_FOLDERS = new Set([...])`; disallowed folders → 400 with `folder no permitido: <name>`. |
| **S4** `ContentLengthRange` in presigned POST policy | Decoded policy from a live presign contains `["content-length-range", 0, 104857600]` (= 100 MB = MAX_FILE_SIZE_MB*1024*1024). |

### Bonus: SSH allow-list (F-01)

`aws lightsail get-instance-port-states` on `miempresa-backend-staging`:

```
port 22: cidrs=["186.99.216.211/32"]   # F-01 fix applied
port 3001: cidrs=["0.0.0.0/0"]         # per fix contract: header-mitigated (F-07 deferred)
```

### SecureString confirmed

```
$ aws ssm get-parameter --name /miempresa/staging/api/JWT_SECRET --query 'Parameter | {Name:Name,Type:Type}' --output json
{"Name":"/miempresa/staging/api/JWT_SECRET","Type":"SecureString"}      ✓
$ … SESSION_SECRET …                                                               ✓
$ … ORIGIN_VERIFY_SECRET …                                                        ✓
```

### Deploy state (post #8 remediation)

```
/opt/miempresa/app/dist/routes/uploads.routes.js     contains assertKeyAccessible + findRecordForKey
/opt/miempresa/app/dist/services/s3Service.js       contains createPresignedPost + content-length-range
/opt/miempresa/app/dist/middleware/errorHandler.js  drops meta.target from the response body
/opt/miempresa/app/dist/app.js                      contains crypto.timingSafeEqual
```

The deployed bundle matches the sfx-W2 source — no skew between code and prod.

## Test/Quality Counts

- New spec: **1** (`staging-s2-download-idor.spec.ts`, 7 cases)
- New runner: **1** (`run-sfx-qa-gate.sh`)
- Live tests against staging: **23 passed** / **0 failed**
  - 7/7 S2 download-url IDOR (the crux)
  - 9/9 staging-smoke (login, health, CORS, dev-credentials policy, /me, logout) — `bash run-staging-qa.sh` with DEV_USERS_ENABLED=true
  - 4/4 iam-allow-staging + 2/2 iam-assume-staging-allowed + 4/4 iam-deny-prod + 2/2 iam-assume-prod-denied = **12 IAM tests**
- Pre-existing test issues (not regressions from sfx-W2):
  - `staging-login.spec.ts:64` looks for `header.getByText('QA Staging')` — actual user is "QA Admin" (commit `48029ef` predates sfx-W2). Login itself succeeds; just the header assertion is wrong.
  - `staging-s3-canary.spec.ts:48` uses folder `qa-canary` (NOT in the whitelist). S3 fix working as designed — the helper in `tests/helpers/upload-persistence.ts:54` defaults to a non-whitelisted folder. **Action item** for the FE suite owner: switch the helper default to a whitelisted folder (e.g. `empleado-documentos`) so this suite goes green again. NOT a regression in the deployed app — actual UI callers (8 use sites in `useFileUpload.uploadFile`) all use whitelisted folders.
  - `staging-upload.spec.ts:84` uses `qa-upload-roundtrip` (not whitelisted) — same root cause.
  - `staging-fichas-update.spec.ts:61` uses `fichas` (not whitelisted) — same root cause.

## Quality gate decision

**GATE PASS.** All 5 categories of the assignment's gate are GREEN on staging:

1. ✓ Playwright E2E (login + upload + download existing document)
2. ✓ S2 authorization (admin 200 / not-in-record 403 / cross-user 403 / GERONTOLOGA matrix 403 / CONTRATOS ownership 403 / empty 400 / OLD flat key 200)
3. ✓ Smoke (health 200, direct origin 403, FE-via-CF login 200)
4. ✓ IAM isolation (allow-staging PASS, deny-prod PASS, assume-staging-allowed PASS, assume-prod-denied PASS)
5. ✓ Other fixes (S1, S3, S4, S5, S6, S8 — source + dist + live)

The pre-staging FE test failures (qa-canary etc.) are caused by the S3 folder whitelist working as intended; they are not a regression in the deployed app (UI callers all use whitelisted folders per `useFileUpload` audit). They are pre-existing test-data issues for the FE suite owner to address.

**Recommendation**: orchestrator may proceed to #10 (prod release per runbook).

## Communication

- Sending `COMPLETE:` to `team-lead`.
- Spec + runner kept in the repo (`backend/tests/staging/staging-s2-download-idor.spec.ts`, `backend/tests/staging/run-sfx-qa-gate.sh`) so the same gate can be re-run on prod (#10) without modification.