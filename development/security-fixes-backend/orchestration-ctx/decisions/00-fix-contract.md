# Decision: fix contract (authoritative spec)

Each fix has: target finding, files, exact change, acceptance (verifiable), env sequence. Workers
implement against THIS; do not re-derive from the audit report. Severities/finding IDs come from
`development/security-audit-backend/orchestration-ctx/decisions/02-infra-integrated-verdicts.md`.

Legend: [CODE]=app/frontend (sfx-W2) · [INFRA]=IaC/AWS (sfx-W1) · [QA]=validation (sfx-W3).

---

## A. IAM per-env scoping — CH-1 / F-05 / F-03 [INFRA]

**Goal**: staging role can reach ONLY `-staging` resources; prod role ONLY `-prod`; KMS scoped to the
SSM key. NO bucket/KMS resource changes — policy/role only.

**Approach (additive, reversible, prod-safe)**:
1. Edit `backend/infrastructure/db/cloudformation/iam-stack.yml`: make it Environment-aware. Add a
   `Environment` parameter and create a role `CodeDeployInstanceRole-${Environment}` with a policy
   whose ARNs are scoped:
   - S3: `miempresa-{artifacts,backups,uploads}-${AWS::AccountId}-${Environment}` (+ `/*`) + the
     `aws-codedeploy-${Region}` bucket.
   - SSM: `parameter/miempresa/${Environment}/*`.
   - KMS: scope `kms:Decrypt`/`DescribeKey` to the SSM key ARN only (get via
     `aws kms describe-key --key-id alias/aws/ssm` → its `Arn`). NOT `key/*`.
   - logs/codedeploy: unchanged (already scoped / service-level).
   - Keep the bootstrap user; its AssumeRole policy must allow assuming BOTH new role ARNs.
2. Deploy the iam-stack for staging first (creates `CodeDeployInstanceRole-staging` additively; the
   old wildcard `CodeDeployInstanceRole` stays until retired).
3. Point the STAGING instance's credential refresh at the new staging role ARN:
   `backend/infrastructure/db/scripts/refresh-credentials.sh` (and however the role ARN is passed).
   Restart the refresh cron; confirm `aws sts get-caller-identity` on-box shows the new role.
4. **tmp validation (REQUIRED, developer-mandated)**: write `tmp/iam-validate/` scripts that assume
   the staging role and prove:
   - CAN read `/miempresa/staging/*` + get object in `miempresa-uploads-...-staging`.
   - CANNOT read `/miempresa/prod/*` (AccessDenied) nor `miempresa-uploads-...-prod`.
   Capture verbatim allow+deny output.
5. Only after staging proven: retire the old wildcard role (remove from template OR leave until prod
   done, then remove) — do NOT remove while any instance still assumes it.

**Acceptance**: staging instance boots + serves normally on the new role; tmp tests show staging
allow + prod deny verbatim; no bucket/KMS resource was modified. prod mirrors in the prod release.

---

## B. SecureString conversion — F-02 [INFRA]

**Goal**: `JWT_SECRET`, `SESSION_SECRET`, `ORIGIN_VERIFY_SECRET` become `Type: SecureString` (values
unchanged, no rotation). Runtime already decrypts (`env.sh --with-decryption`).

**CFN de-management dance (avoid drift/revert)**:
1. Edit `ssm-parameters-stack.yml`: the 3 secret param resources (`JWTSecretParameter`,
   `SessionSecretParameter`, `OriginVerifySecretParameter`) — this template CANNOT create
   SecureString. De-manage them: first add `DeletionPolicy: Retain` + `UpdateReplacePolicy: Retain`
   and deploy (so removal won't delete the live value), THEN remove the 3 resources from the template
   and deploy again (CFN drops them from the stack but retains the params). Also drop the now-unused
   `JWTSecret`/`SessionSecret`/`OriginVerifySecret` template Parameters + conditions, and update
   `deploy-infrastructure.sh` so it no longer passes these as String overrides.
2. Convert values in place preserving the current value:
   `V=$(aws ssm get-parameter --name /miempresa/staging/api/JWT_SECRET --with-decryption --query Parameter.Value --output text)`
   then `set-env.sh --stage staging JWT_SECRET "$V" --secure` (deletes String, recreates SecureString,
   same value). Repeat for SESSION_SECRET, ORIGIN_VERIFY_SECRET. **Never print these values to logs**;
   pass via variable only. Then regenerate `.env` + `pm2 restart` and confirm the app still boots +
   login works (JWT signs/verifies).

**Acceptance**: the 3 params show `Type: SecureString`; app login works post-restart; a later
`deploy-infrastructure.sh` dry/real run does NOT recreate them as String; values unchanged (login
tokens issued before still valid within expiry). No value appears in any committed file or log.

---

## C. SSH allow-list + helper scripts — F-01 [INFRA]

**Goal**: port 22 restricted to admin IP `186.99.216.211/32` (was `0.0.0.0/0`); repeatable helper
for IP drift; same flow staging+prod.

1. Firewall: use Lightsail `put-instance-public-ports` / the existing firewall mechanism in
   `create-instance.sh` to set port 22 `cidrs=["186.99.216.211/32"]` for the target instance. Keep
   3001 as-is this cycle (origin :3001 is header-mitigated; F-07 deferred).
2. New helper `backend/infrastructure/db/utilities/ssh-allow-current-ip.sh --stage <staging|prod>`:
   detects current public IP (`curl -s https://checkip.amazonaws.com`), reads current port-22 cidrs,
   if the IP is absent updates the allow-list (read-modify-write, never widening to 0.0.0.0/0), then
   optionally SSHes. Idempotent. Print the IP + resulting cidrs.
3. Update `ssh-to-instance.sh` / `db-tunnel.sh` to call the validate step first (or document it).

**Acceptance**: `aws lightsail get-instance-port-states` shows 22 cidr = `186.99.216.211/32`; SSH from
the admin IP works; the helper is idempotent (second run = no-op) and self-tested on staging.

**Learning**: add to `development/orchestration-learnings/` — before any SSH to staging/prod, run the
IP-validate helper (public IP can change); never widen 22 to 0.0.0.0/0.

---

## D. Upload authorization + limits — S2 / S3 / S4 [CODE]

Files: `backend/src/routes/uploads.routes.ts`, `backend/src/services/s3Service.ts`.
1. **S2** `GET /uploads/download-url`: reject keys the caller does not own. Enforce a prefix/ownership
   check (the key must belong to the authenticated user's tenant/entity per existing key convention).
   If ownership can't be derived from the key, require the caller to pass the owning record id and
   verify via the service layer before presigning. Add `validate()` on the query.
2. **S3** `POST /uploads/presigned-url`: whitelist `folder` against an allowed set (server-controls
   the prefix); reject arbitrary values. Keep the UUID filename.
3. **S4**: pass a `ContentLengthRange` (0..`config.upload.maxFileSizeBytes`) into the presigned PUT
   policy in `s3Service.generateUploadUrl` so oversize uploads are rejected by S3.

**Acceptance**: a Playwright/vitest spec proves: user A cannot presign-download user B's key (403);
disallowed folder → 400; presign policy includes the content-length range. Follows existing test
patterns in `backend/tests/`.

---

## E. Cheap code hardening — S1 / S5 / S8 / S6 [CODE]

1. **S1** `backend/src/config/env.ts`: remove the `|| 'dev-secret-change-me'` JWT fallback; if
   `JWT_SECRET` is unset in a non-dev NODE_ENV, throw at startup (crash-fast). Keep a local-dev path
   only when `NODE_ENV !== 'production'` AND explicitly dev.
2. **S5** `backend/src/app.ts:24`: replace `===` on `x-origin-verify` with a length-checked
   `crypto.timingSafeEqual`.
3. **S8** `backend/src/middleware/errorHandler.ts:14`: drop `errors.constraint` (meta.target) from the
   client response; keep the server-side log.
4. **S6** `frontend/app/plugins/access-denied.client.ts:25`: render via `textContent`, not `innerHTML`.

**Acceptance**: unit/smoke specs for S1 (missing secret throws), S5 (valid/invalid header still
403/passes), S8 (409 body has no `constraint`), S6 (no innerHTML). No behavior regressions.

---

## F. Deploy sequence + quality gate

**Staging (autonomous, internal gates)**:
1. sfx-W2 lands all [CODE] + implementer tests (T1).
2. sfx-W1 authors all [INFRA] IaC + helpers + tmp tests (T2).
3. sfx-W1 applies to staging in order: B (SecureString) → verify app boots → A (IAM per-env) → tmp
   IAM allow/deny tests → C (SSH allow-list) → deploy backend app (CodeDeploy) with [CODE] changes.
   CHECKPOINT to team-lead with the tmp IAM test output + smoke results (orchestrator confirms IAM
   pattern before continuing — developer-mandated step-by-step validation).
4. sfx-W3 runs the staging validation suite (T4): Playwright E2E (login, uploads happy path, upload
   IDOR blocked), curl smoke (health, origin-verify still 403 direct), and re-runs the tmp IAM
   deny tests. **Quality gate = all green.** Any failure → fix + iterate; do NOT proceed to prod.

**Prod (autonomous after staging green)** — follow `context/implementation-plan/prod-release/` runbook,
ONE dated file `YYYY-MM-DD-security-fixes.md`:
1. **Backup prod DB first** (dump + upload + verify), record restore command. NO data mutation, no
   seed, no SQL.
2. Apply the SAME sequence to prod: iam-stack prod role deploy → point prod instance refresh at prod
   role → tmp IAM allow(prod)/deny(staging) tests → SecureString conversion on `/miempresa/prod/*` →
   SSH allow-list (prod firewall, admin IP) → deploy backend app to prod (group `miempresa-prod`,
   Environment=prod tag only) → smoke.
3. Retire the old wildcard `CodeDeployInstanceRole` only after BOTH instances are on scoped roles.
4. Record commands/actuals/learnings/stack-state in the one runbook file.

**Rollback pre-staged**: prior CodeDeploy artifact id + DB backup key + `git revert` of the app
commit; IAM is additive so revert = repoint refresh to the old role (kept until step 3).
