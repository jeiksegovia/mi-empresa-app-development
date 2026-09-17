# Decision: preliminary static verdicts (Wave 2, part 1)

Orchestrator adjudication of sec-code-1's shortlist S1-S11. Items whose severity is PURE STATIC are
finalized here. Items whose severity DEPENDS on infra/runtime state are marked PENDING-W1 and will be
finalized once sec-devops-1 evidence lands. Spot-checks below were verified by the orchestrator
directly against source.

## Orchestrator spot-checks (CONFIRMED against source)

- S1 `env.ts:16` `secret: process.env.JWT_SECRET || 'dev-secret-change-me'` — CONFIRMED. Also noted:
  `database.url` has a hardcoded local-dev fallback (env.ts:12) and `originVerifySecret` defaults to
  `''` which **disables the origin check** (env.ts:34).
- S2 `uploads.routes.ts:64-86` — CONFIRMED. `/download-url` takes `req.query.key` verbatim, no
  `validate()`, no prefix check, passes straight to `generateDownloadUrl(key)`. Auth-gated (router.use(authMw)).
- S3 `uploads.routes.ts:8-12,45` — CONFIRMED. `folder` unvalidated; key = `${folder||'uploads'}/${uuid}.${ext}`.
- S8 `errorHandler.ts:14` `constraint: prismaError.meta?.target` — CONFIRMED.
- S9 `errorHandler.ts:49` non-prod returns raw `err.message` — CONFIRMED.

## Finalized (pure static)

| id | final_severity | verify | rationale |
|---|---|---|---|
| S5 x-origin-verify `===` not timingSafeEqual (app.ts:24) | LOW | CONFIRMED | Defense-in-depth; only CloudFront path injects header; long secret. |
| S6 innerHTML in access-denied.client.ts:25 | LOW | CONFIRMED | Fed only by hardcoded 403 strings today; becomes HIGH if a 403 ever echoes user input. Flag as latent. |
| S8 P2002 `meta.target` leak | LOW | CONFIRMED | Leaks constraint column names; omit from client response, keep server log. |
| S10 AUDITOR/OPERADOR bypass requireDomain (domainAccess.ts:160-163) | INFO | CONFIRMED | Product decision, not a defect until product says those roles must be matrix-gated. |
| S11 npm audit 0 crit / 8 high transitive | MEDIUM | CONFIRMED | Cumulative; cheap to fix on a branch paired with a deploy; regression-test S3 presign after. |

## PENDING-W1 (severity depends on infra evidence)

| id | pivot question for sec-devops-1 |
|---|---|
| S1 JWT_SECRET | Is `JWT_SECRET` set (strong) in staging/prod SSM/env.sh? If unset -> CRITICAL (forgeable JWT). If set -> still HIGH-latent: recommend removing the `||` fallback + crash-on-missing. |
| S2 download-url arbitrary key | Does the uploads bucket policy/OAC restrict keys to a backend-controlled prefix? If any key readable -> MEDIUM (PII disclosure). |
| S3 arbitrary folder | Does the bucket restrict writes to a single prefix? If any prefix writable -> MEDIUM. |
| S4 MAX_FILE_SIZE_MB unused | Does the bucket enforce a content-length range? If not -> MEDIUM (DoS via huge upload). |
| S7 CSP | Do Amplify response headers include a CSP? If not -> LOW (add CSP). |
| S9 err.message leak | Is staging `NODE_ENV=production`? If not -> LOW (raw errors leak on staging). |

## Also confirmed clean by sec-code-1 (no finding)

- No exploitable RBAC bypass in the EMPLEADO matrix; token storage clean (httpOnly cookie +
  in-memory Pinia); no `v-html`/`eval`/`new Function` in frontend.
