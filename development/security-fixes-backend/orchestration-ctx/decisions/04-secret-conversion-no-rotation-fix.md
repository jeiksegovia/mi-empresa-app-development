# Decision: SecureString conversion must PRESERVE values (no rotation) + staging remediation

## What went wrong at the #8 staging checkpoint

sfx-devops reported: "failed deploy attempts wiped the 3 staging secrets, so I regenerated them with
NEW random values." That is a ROTATION — explicitly forbidden by the developer ("dont rotate secret
its not require"; contract §B "values UNCHANGED"). Consequences on staging:
- `ORIGIN_VERIFY_SECRET` changed → CloudFront still injects the OLD value (edge-stack
  `OriginVerifySecret` → OriginCustomHeaders x-origin-verify, edge-stack.yml:129-131), app expects the
  NEW value → **403 for ALL FE traffic via CloudFront** (misdiagnosed by the worker as "CF has no
  header"; CF DOES inject it, the values just no longer match).
- `JWT_SECRET` / `SESSION_SECRET` changed → existing sessions invalidated (staging: re-login only).

## Likely root cause

The CFN de-management of the 3 secret params (ssm-parameters-stack) was done in the WRONG ORDER:
resources removed from the template BEFORE `DeletionPolicy: Retain` was in effect, so CFN DELETED the
live params. The worker then regenerated them instead of restoring. Order MUST be: (1) add
Retain + UpdateReplacePolicy Retain and deploy; (2) THEN remove the resources and deploy; (3) THEN
convert type. Skipping step 1 deletes the data.

## Staging remediation (do before #8 can pass)

1. Read the value CloudFront actually injects (authoritative for origin-verify):
   `aws cloudfront get-distribution-config` for the staging API distribution → OriginCustomHeaders
   `x-origin-verify` HeaderValue.
2. Restore the 3 secrets to their ORIGINAL values (honor no-rotation). Originals are recoverable from
   the audit evidence `development/security-audit-backend/evidence/infra/25-ssm-list-by-path-staging.json`
   (JWT_SECRET, SESSION_SECRET, ORIGIN_VERIFY_SECRET). Cross-check that the ORIGIN_VERIFY original ==
   the CloudFront-injected value from step 1 (they were in sync pre-cycle). Set each SSM param
   (SecureString) to its original value. NEVER print the values.
3. Regenerate .env + pm2 restart. Re-validate:
   - FE via CloudFront: real login through `https://miempresa-api-stg.disruptiveexp.com` → 200 (not 403).
   - Direct origin without header → 403 (unchanged).
   - download-url happy path (authorized) → 200; key not in any record → 403.

## PROD procedure hardening (MANDATORY before #10)

- **Never regenerate a prod secret.** If any value would be lost, HALT and TURNING-POINT-BREAKING —
  do NOT invent a new value on prod (rotation breaks the CloudFront chain + logs out all users).
- Correct order for the 3 prod params:
  1. Capture each current value: `V=$(aws ssm get-parameter --name ... --with-decryption --query Parameter.Value --output text)`; assert non-empty; hold in shell vars (never logged, never written to a committed file).
  2. Retain-then-remove the CFN management (deploy with Retain FIRST, verify Retain applied, THEN
     remove resources + deploy). Confirm the live params still exist after each deploy.
  3. Convert type preserving value (set-env.sh --secure with the captured `$V`); read-back verify the
     SecureString value equals `$V`.
  4. If any step loses a value, re-put the captured `$V` immediately (rollback) and HALT.
- Prod `ORIGIN_VERIFY_SECRET` value MUST remain byte-identical to what prod CloudFront injects (do
  not touch the edge-stack). Verify match before + after.

## Note

The IAM per-env work, tmp allow/deny (incl. assume-path deny), SSH allow-list (after the port-3001
merge fix), and the app deploy on staging all passed — those stand. Only the secret handling +
staging FE chain must be remediated + re-validated before #8 is accepted and before #10.
