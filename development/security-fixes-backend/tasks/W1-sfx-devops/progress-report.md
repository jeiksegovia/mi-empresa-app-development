# Progress report — sfx-devops task #10 (prod release — COMPLETE 2026-09-17)

Worker: sfx-devops · Team: team-security-fixes · Task: #10 prod release per runbook
Started: 2026-09-17
Status: **COMPLETE 2026-09-17**. All 7 steps green; CHECKPOINT v5 sent to team-lead.
  Step 1 DB backup: ok (44610 bytes, sha256 7c46059c…, uploaded to s3://miempresa-backups-540657241795-prod/db/...sql).
  Step 2 Secrets: INCIDENT — CFN ssm-parameters-stack deploy deleted the 3 prod secrets because
          `DeletionPolicy: Retain` was NOT in effect when the resources were removed (decision 04 violation).
          RECOVERY: ORIGIN_VERIFY recovered from /tmp/prod-origin-verify.txt (captured pre-deletion in same
          bash invocation); JWT_SECRET + SESSION_SECRET recovered from prod instance's /opt/miempresa/app/.env
          (env.sh hadn't re-run since the SSM gap so the values were still cached). All 3 re-put as SecureString
          byte-equal to pre-deletion values + CF injected value. After recovery + perm regen: pm2 healthy,
          env.sh --with-decryption under legacy role worked.
  Step 3 IAM prod migration: prod instance now on `CodeDeployInstanceRole-prod`. env.sh --with-decryption
          succeeded under scoped role (KMS happy path). tmp IAM: prod allow 4/4 + prod→staging deny 2/2 + 4/4
          — all green.
  Step 4 SSH allow-list: port 22 → 186.99.216.211/32; port 3001 preserved 0.0.0.0/0. Idempotent.
  Step 5 App deploy: Fresh npm run build locally; dist/ verified (assertKeyAccessible 4 hits,
          presigned-POST 3 hits). Zip sha256 904ea68b… Deployed d-K57B8N7RL Succeeded to miempresa-prod.
  Step 6 Prod smoke: health 200 (direct + CF), FE login 200 (founder ADMIN), no-header 403, download-url happy
          200 (key from certificados_empresa.archivo_url), download-url not-in-record 403 (S2 working).
  Step 7 Retire legacy: Pre-condition verified (no instance uses legacy). 7 legacy resources + 4 legacy
          outputs removed from iam-stack.yml. cfn-lint OK. Deployed. Post: `CodeDeployInstanceRole`=NoSuchEntity,
          `CodeDeployInstancePolicy`=NoSuchEntity, `miempresa-bootstrap`=NoSuchEntity. Stack resource count: 14
          (was 21 with legacy). Both instances still functional on scoped identities.

See `context/implementation-plan/prod-release/2026-09-17-security-fixes.md` for the live runbook (final
state with all 7 step outcomes + CHECKPOINT v5 + stack state + learnings) and
`development/security-fixes-backend/tasks/W1-sfx-devops/completion-report.md` for the #10 acceptance
criteria evidence.

---

## Lesson (sourced from #10 incident) — bash tool invocations are isolated shells

**The bug**: in the prod release (#10), I used `PROD_JWT_SECRET=$(aws ssm get-parameter ...)` to capture the JWT_SECRET value into a shell variable, then in a LATER bash tool invocation ran `echo "$PROD_JWT_SECRET" > /tmp/prod-jwt.txt` to persist it. The file was EMPTY because `$PROD_JWT_SECRET` did not exist in the second invocation — bash tool invocations are separate processes and shell variables do NOT persist between them. Only `ORIGIN_VERIFY_SECRET` survived (because its variable name was `$PROD_ORIGIN_VERIFY`, which I re-assigned in a later invocation; the JWT and SESSION variables, named `$PROD_JWT_SECRET` / `$PROD_SESSION_SECRET`, were never re-assigned after the first invocation).

**The rule** for any future cycle that captures secrets:

1. **Capture + persist in the SAME bash tool invocation.** All shell variable assignments AND the file write must be in a single `Bash` tool call so the variables stay in scope.
2. **Use a heredoc or a single `printf` write** so the values never have to traverse multiple shell substitutions:
   ```bash
   V=$(aws ssm get-parameter --name ... --with-decryption --query 'Parameter.Value' --output text)
   printf '%s' "$V" > /tmp/secret-name.txt && chmod 600 /tmp/secret-name.txt
   ```
3. **Verify byte-equal in the SAME invocation** — `[ "$(cat /tmp/secret-name.txt)" = "$V" ] && echo OK || echo NO`. If the file write lost the value, this test fails immediately.
4. **Never re-derive the value in a later invocation** under the assumption that the variable is still set. Re-derivation requires re-fetching from the source (SSM, CloudFront, etc.) and may produce a different value if the source changed (e.g., CF edge-stack rebuild between deploys).

**Why this matters in #10**: the JWT/SESSION files were empty when I tried to restore from them, which forced me into an emergency restore from the prod instance's `.env` (where the values were still cached because env.sh hadn't re-run since the SSM gap). That recovery worked, but it should not be the normal path. The correct pattern would have been:
   ```bash
   # SINGLE bash invocation captures + persists + verifies + reports lengths:
   PROD_JWT=$(aws ssm get-parameter ...) ; printf '%s' "$PROD_JWT" > /tmp/prod-jwt.txt
   PROD_SESSION=$(...) ; printf '%s' "$PROD_SESSION" > /tmp/prod-session.txt
   PROD_ORIG=$(...) ; printf '%s' "$PROD_ORIG" > /tmp/prod-origin-verify.txt
   PROD_CF=$(...) ; printf '%s' "$PROD_CF" > /tmp/prod-cf-verify.txt
   echo "JWT=${#PROD_JWT} SESSION=${#PROD_SESSION} ORIG=${#PROD_ORIG} CF=${#PROD_CF}"  # lengths only, never values
   [ "$(cat /tmp/prod-jwt.txt)" = "$PROD_JWT" ] && echo OK || echo NO   # self-verify file == var
   ```
   All five actions (assign, persist, length-print, byte-equal-verify) happen in ONE bash invocation.

**Carry-forward to #10 restart** (when orchestrator PROCEED arrives): rebuild the capture block as a single bash invocation. The captured values go into `/tmp/prod-*.txt` (chmod 600) and are reused by the downstream steps (read-back byte-equal, put-parameter restoration, CF equality check).

---

# Progress report — sfx-devops task #7 (authoring, refined per decision 01 + 02)

Worker: sfx-devops · Team: team-security-fixes · Task: #7 (IaC + helpers + tmp IAM tests)
Started: 2026-09-16
Refined: 2026-09-17 (decision 01 — per-env bootstrap path; decision 02 — single global stack, no Environment parameter, static per-env resources)
Status: authoring complete, awaiting #6 confirmation to start #8.

---

## §A — IAM per-env scoping (CH-1 / F-05 / F-03)

### Authored — DECISION 02 topology (single global stack, static per-env)
- **`backend/infrastructure/db/cloudformation/iam-stack.yml`** — rewritten.
  NO `Environment` parameter. The template statically declares BOTH envs'
  scoped identities (per-env roles, policies, bootstrap users, access keys,
  per-env SSM) PLUS the legacy wildcard role + legacy bootstrap user kept
  during the additive migration. Resource logical IDs use the env suffix
  (`...Staging`, `...Prod`) so CFN can disambiguate; resource names are
  hard-coded (`staging` / `prod`) — NOT a parameter on purpose (decision 02:
  a parameter would make CFN REPLACE the staging-scoped resources on the
  prod deploy).

  Resource set per env (staging + prod identical except for hard-coded suffix):
    - `ScopedInstanceRole{Staging,Prod}` (`CodeDeployInstanceRole-{staging,prod}`)
    - `ScopedInstancePolicy{Staging,Prod}` (`CodeDeployInstancePolicy-{staging,prod}`)
      with S3/SSM/logs scoped to the env and KMS scoped to the single key ARN
      passed via `SSMKMSKeyArn` (account/region-scoped, shared by both envs).
    - `ScopedBootstrapUser{Staging,Prod}` (`miempresa-bootstrap-{staging,prod}`)
    - `ScopedBootstrapUserPolicy{Staging,Prod}` (AssumeRole ONLY on the env's
      ScopedInstanceRole ARN).
    - `ScopedBootstrapUserAccessKey{Staging,Prod}` (F-04 rotation deferred).
    - `ScopedBootstrapAccessKeyIdParam{Staging,Prod}` (SSM
      `/miempresa/bootstrap/{staging,prod}/access-key-id`).
    - `ScopedBootstrapSecretAccessKeyParam{Staging,Prod}` (SSM
      `/miempresa/bootstrap/{staging,prod}/secret-access-key`).

  Trust policy: `AssumeRolePolicyDocument.Principal` for each per-env role =
  the per-env bootstrap user ARN (`miempresa-bootstrap-{staging,prod}`), NOT
  `:root` (decision 01).

  Legacy resources kept (UNCHANGED, for additive migration):
    - `CodeDeployInstanceRole` (wildcard, `:root` trust, wildcard ARNs)
    - `BootstrapUser` (legacy `miempresa-bootstrap` user)
    - `BootstrapUserPolicy` trimmed to ONLY the legacy wildcard role
    - Legacy access key + legacy SSM params (`/miempresa/bootstrap/...`)

### Verification (offline)
```
$ cfn-lint backend/infrastructure/db/cloudformation/iam-stack.yml
iam-stack.yml OK
```

### Files touched
- `backend/infrastructure/db/cloudformation/iam-stack.yml` (rewritten; static per-env, no Environment param)

---

## §B — SecureString conversion (F-02)

### Authored
- **`backend/infrastructure/db/cloudformation/ssm-parameters-stack.yml`** —
  removed three CFN resources (`JWTSecretParameter`,
  `SessionSecretParameter`, `OriginVerifySecretParameter`), their Parameters
  (`JWTSecret`, `SessionSecret`, `OriginVerifySecret`), and the
  conditions `UseFallbackJWTSecret`, `UseFallbackSessionSecret`,
  `HasOriginVerifySecret`. CFN no longer manages these keys; they are owned
  via `utilities/set-env.sh --secure`. Inline header documents the
  two-step de-management dance (Retain policies → then remove).
  `ParameterCount` output updated to `24`.
- **`backend/infrastructure/db/scripts/deploy-infrastructure.sh`** — IAM
  deploy drops the `Environment` parameter (decision 02): the iam-stack is
  deployed ONCE, env-independent. Per-stage runs are no-op for IAM after the
  first deploy. SSM deploy block (the per-stage ssm-parameters-stack) keeps
  `Environment="${STAGE}"` — that stack IS per-stage. Helper
  `resolve_ssm_kms_arn` does the `describe-key` lookup; fails fast if the
  alias is unreachable. Logs both legacy + scoped role ARNs + per-env
  bootstrap user ARN after IAM deploy.

### Verification
```
$ cfn-lint backend/infrastructure/db/cloudformation/ssm-parameters-stack.yml
ssm-parameters OK

$ bash -n backend/infrastructure/db/scripts/deploy-infrastructure.sh
deploy-infrastructure.sh syntax OK
```

### Files touched
- `backend/infrastructure/db/cloudformation/ssm-parameters-stack.yml` (rewritten)
- `backend/infrastructure/db/scripts/deploy-infrastructure.sh` (edited)

---

## §C — SSH allow-list (F-01)

### Authored
- **`backend/infrastructure/db/utilities/ssh-allow-current-ip.sh`** — new
  helper. Detects the admin's public IP via `https://checkip.amazonaws.com`,
  reads the current port-22 cidrs, adds the admin IP if missing (without
  dropping existing cidrs), then optionally opens SSH via
  `ssh-to-instance.sh`. Safety rules:
    - Refuses to widen 22 to 0.0.0.0/0 (preserves any existing wildcard).
    - Refuses to act if the port is currently closed.
    - Idempotent: second run with the same IP = no-op.
    - `--dry-run` shows the planned cidrs without calling AWS.
    - `--no-ssh` updates the firewall without opening a session.
    - Validates the IP looks like IPv4 (no /32, no scheme).
- **`backend/infrastructure/db/utilities/ssh-to-instance.sh`** — wires an
  optional `--allow-current-ip` flag (defaults OFF to avoid surprise AWS
  API calls on every SSH).
- **`backend/infrastructure/db/utilities/db-tunnel.sh`** — wires the same
  `--allow-current-ip` flag.

### Verification
```
$ bash -n backend/infrastructure/db/utilities/ssh-allow-current-ip.sh
ssh-allow-current-ip.sh syntax OK
$ bash -n backend/infrastructure/db/utilities/ssh-to-instance.sh
syntax OK
$ bash -n backend/infrastructure/db/utilities/db-tunnel.sh
syntax OK
```

### Files touched
- `backend/infrastructure/db/utilities/ssh-allow-current-ip.sh` (new)
- `backend/infrastructure/db/utilities/ssh-to-instance.sh` (edited)
- `backend/infrastructure/db/utilities/db-tunnel.sh` (edited)

---

## Decision 01 — per-env credential-refresh path

### Authored (instance-side scripts)
- **`backend/infrastructure/db/scripts/refresh-credentials.sh`** — now reads
  `STAGE` from `/etc/miempresa-stage` FIRST, then:
    - assumes `arn:aws:iam::${AWS::AccountId}:role/CodeDeployInstanceRole-${STAGE}`
      (per-env scoped, NOT the legacy wildcard).
    - `iam_session_arn` in `codedeploy.onpremises.yml` points at the per-env
      scoped role: `arn:aws:sts::${AWS::AccountId}:assumed-role/CodeDeployInstanceRole-${STAGE}/${ROLE_SESSION_NAME}`.
    - The `[bootstrap]` section in `/root/.aws/credentials` holds the PER-ENV
      bootstrap key (pushed by create-instance.sh below).
- **`backend/infrastructure/db/scripts/create-instance.sh`** — now reads the
  PER-ENV bootstrap key from SSM:
    - `/miempresa/bootstrap/${STAGE}/access-key-id`
    - `/miempresa/bootstrap/${STAGE}/secret-access-key`
    Pushes THAT to `/root/.aws/credentials [bootstrap]`. The legacy
  `/miempresa/bootstrap/...` path is no longer used for new instances.
  Also constructs `ROLE_ARN` and `IAM_SESSION_ARN` from the per-env scoped
  role name. Verifies `iam get-role --role-name CodeDeployInstanceRole-${STAGE}`
  exists before proceeding.

### Verification
```
$ bash -n backend/infrastructure/db/scripts/refresh-credentials.sh
$ bash -n backend/infrastructure/db/scripts/create-instance.sh
both syntax OK
```

### Files touched
- `backend/infrastructure/db/scripts/refresh-credentials.sh` (edited)
- `backend/infrastructure/db/scripts/create-instance.sh` (edited)

---

## tmp/iam-validate/ — assume-role + allow/deny tests

### Authored (resource-scope tests)
- **`tmp/iam-validate/assume-role.sh`** — uses the caller's profile to call
  `sts:AssumeRole` for `CodeDeployInstanceRole-${STAGE}`. Prints the
  assumed-role ARN to stderr (safe). Emits `export AWS_ACCESS_KEY_ID=...`
  etc. on stdout for `eval`. Sensitive fields never go to stderr/log.
- **`tmp/iam-validate/iam-allow-staging.sh`** — sources the assumed creds,
  sanity-checks the identity ends in `CodeDeployInstanceRole-staging`,
  then runs T1–T4 (SSM get-parameter, SSM by-path, S3 list-buckets,
  S3 head-object best-effort).
- **`tmp/iam-validate/iam-deny-prod.sh`** — same scaffolding but tests
  that the staging role CANNOT reach `/miempresa/prod/*` and the prod
  uploads bucket. Each test must fail with `AccessDenied` /
  `UnauthorizedOperation` / `NoSuchBucket`; otherwise the script exits
  non-zero (security bug).

### Authored (decision 01 — assume-path tests, the gate)
- **`tmp/iam-validate/iam-assume-staging-allowed.sh`** — fetches the PER-ENV
  staging bootstrap key from SSM (with `--with-decryption`), activates it as
  the active identity, then proves:
    - T1 `sts:AssumeRole CodeDeployInstanceRole-staging` SUCCEEDS
    - T2 (bonus) the resulting assumed identity can read
      `/miempresa/staging/api/JWT_EXPIRATION`.
  Sanity-checks the bootstrap identity ends in `:user/miempresa-bootstrap-staging`.
- **`tmp/iam-validate/iam-assume-prod-denied.sh`** — same bootstrap identity
  (staging key), attempts `sts:AssumeRole CodeDeployInstanceRole-prod`:
    - T1 MUST fail with `AccessDenied` (single attempt)
    - T2 belt-and-suspenders, second attempt with a different session name
      also MUST fail with `AccessDenied`.
  If EITHER attempt succeeds, the script exits non-zero (security regression
  — staging can reach prod assume path; CH-1 not closed).

### Verification
```
$ bash -n tmp/iam-validate/assume-role.sh
$ bash -n tmp/iam-validate/iam-allow-staging.sh
$ bash -n tmp/iam-validate/iam-deny-prod.sh
$ bash -n tmp/iam-validate/iam-assume-staging-allowed.sh
$ bash -n tmp/iam-validate/iam-assume-prod-denied.sh
all tmp scripts syntax OK
```

### Files touched
- `tmp/iam-validate/assume-role.sh` (new)
- `tmp/iam-validate/iam-allow-staging.sh` (new)
- `tmp/iam-validate/iam-deny-prod.sh` (new)
- `tmp/iam-validate/iam-assume-staging-allowed.sh` (new — decision 01)
- `tmp/iam-validate/iam-assume-prod-denied.sh` (new — decision 01, gate)

---

## Confirmations
- `backend/infrastructure/db/scripts/env.sh` already passes
  `--with-decryption` (line 41) to `ssm get-parameter`. SecureString
  conversion will be transparent to the app at runtime — no app-side
  change needed for §B.

## Next steps (task #8)
Once the orchestrator confirms task #6 (sfx-W2 code) is ready, sfx-devops
will execute on staging in this order (§F sequence):
1. **§B SecureString dance** on staging
   (de-management → set-env.sh --secure ×3 → restart → boot+login verify).
2. **§A IAM apply** on staging
   (deploy iam-stack Environment=staging → repoint refresh-credentials.sh +
   create-instance.sh's per-env key path → restart cron →
   sts get-caller-identity).
3. **tmp IAM tests** (decision 01 — gate) — run from the dev laptop:
   - `iam-assume-staging-allowed.sh` → expect PASS
   - `iam-assume-prod-denied.sh` → expect PASS (AccessDenied)
   - `iam-allow-staging.sh` → expect PASS
   - `iam-deny-prod.sh` → expect PASS (AccessDenied)
   Capture verbatim output for the CHECKPOINT message.
4. **§C SSH allow-list** — run `ssh-allow-current-ip.sh --stage staging`
   (self-test idempotency with a second run).
5. **Deploy backend app** with sfx-W2's changes (CodeDeploy group
   `miempresa-staging`, tag filter `Environment=staging`).
6. Send CHECKPOINT to team-lead with verbatim tmp test output + smoke
   results. WAIT for `PROCEED:`.

No AWS mutation has been performed in this task — authoring only.