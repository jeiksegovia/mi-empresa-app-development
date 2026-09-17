# Handoff: security-fixes-backend

**Cycle complete** 2026-09-17. Team team-security-fixes (`sfx-*`). Fixes implemented, validated on
staging (quality gate green), then released to prod. Shipped to BOTH environments.

## What shipped (staging + prod)

| Finding | Fix | Status |
|---|---|---|
| CH-1 / F-05 | Per-env scoped IAM roles (`CodeDeployInstanceRole-{staging,prod}`) + per-env bootstrap users + scoped trust; legacy wildcard role RETIRED (NoSuchEntity confirmed) | DONE both envs |
| F-03 | KMS Decrypt scoped to the single SSM key ARN (no `key/*`) | DONE |
| F-02 | JWT_SECRET / SESSION_SECRET / ORIGIN_VERIFY_SECRET → SecureString, values preserved (no rotation) | DONE both envs |
| F-01 | SSH port 22 → admin IP `186.99.216.211/32` + `ssh-allow-current-ip.sh` helper (preserves 3001) | DONE both envs |
| S2 | download-url record-scoped authz (`assertKeyAccessible`), flat keys, backward-compatible | DONE |
| S3 | Upload folder whitelist | DONE |
| S4 | Upload size cap via presigned POST `ContentLengthRange` | DONE |
| S1/S5/S6/S8 | JWT crash-fast, timingSafeEqual, textContent, no P2002 constraint leak | DONE |

Deferred (not this cycle): F-04 bootstrap key rotation (no-rotation policy), F-06 S3 CORS (resource
change avoided), F-07 origin:3001 exposure (header-mitigated), F-11 client-IP logging, S7 CSP, S11 deps.

## Validation

- Staging quality gate (sfx-qa, #9): 23/23 — E2E, S2 authz incl. EMPLEADO cross-user IDOR 403, IAM
  isolation 12/12, SecureString 3/3, smoke green.
- Prod smoke: FE-via-CloudFront login 200, direct origin no-header 403, download-url happy 200 /
  not-in-record 403, health 200. IAM tmp: prod assumes prod + denied staging (verbatim AccessDenied).
- IAM end state: stack 14 resources = 7 staging-scoped + 7 prod-scoped; legacy gone; both instances
  on scoped identities; env.sh decrypts SecureString under the scoped roles.

## Incidents (both recovered, documented)

1. Staging: secrets got rotated (delete+recreate + botched CFN de-manage order) → broke FE-via-CF
   (origin-verify mismatch). Fixed: restored originals from audit evidence; hardened the procedure.
2. Prod: deploying the resources-removed SSM template WITHOUT Retain-first → CFN deleted the 3 prod
   secret params (~5 min window, DB untouched, sessions survived via byte-identical JWT). Recovered by
   re-putting captured originals as SecureString (landed the intended end state). Full runbook:
   `context/implementation-plan/prod-release/2026-09-17-security-fixes.md`.

## Learnings

- CFN `AWS::SSM::Parameter` can't be SecureString; de-manage needs Retain-FIRST or CFN deletes on
  resource removal. Safer: put-parameter SecureString directly with a captured value.
- Bash tool calls are isolated shells — capture + persist-to-file must be one invocation.
- On-prem CodeDeploy registration is pinned to an `iam-session-arn`; changing the instance role
  requires re-registering with the new scoped session ARN (first prod deploys failed until re-reg).

## Deferred / follow-ups

- Prod read-only parity pass to re-confirm the remaining audit items on prod (out of scope earlier).
- The deferred findings above as a future hardening cycle.
- FE test-suite cleanup: `qa-canary`/`fichas`/`qa-upload-roundtrip` specs use non-whitelisted folders
  (now 400 by design) — test-data fix for the FE suite owner (not a product regression).
