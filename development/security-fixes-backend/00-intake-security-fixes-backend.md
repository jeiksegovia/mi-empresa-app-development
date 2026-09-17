# Intake: security-fixes-backend

## Objective

Implement, test on staging, and then release to prod the recommended fixes from the
`security-audit-backend` cycle. Autonomous through staging quality gate, then prod release following
the prod runbook. Report + remediation was the prior cycle; THIS cycle changes code + IaC.

## Team

team-security-fixes · worker prefix `sfx-*` · slug `security-fixes-backend`.
Coexists with team-tenancy (`tnt-*`) and the prior team-security artifacts. See
`development/orchestration-conventions.md`.

## Locked decisions (developer, 2026-09-17)

1. **IAM (CH-1/F-05/F-03)**: narrow via POLICY/ROLE only — NO resource changes (do not touch S3
   buckets, KMS keys, etc.). Same access schema, scoped to each env's own resources (per-env). Prove
   the new access with step-by-step analysis + `tmp/` assume-role test scripts BEFORE prod.
2. **SecureString (F-02)**: convert exactly 3 params to SecureString, values UNCHANGED (NO rotation):
   `JWT_SECRET`, `SESSION_SECRET`, `ORIGIN_VERIFY_SECRET`. DB creds already SecureString. Leave all
   config params as String.
3. **SSH (F-01)**: restrict port 22 to the admin machine IP `186.99.216.211` (this machine). Build
   helper scripts that detect current public IP, update the allow-list on the target env, then
   connect — same flow for staging and prod. Add a learning.
4. **Prod**: fully autonomous after staging is green. Backup prod DB before release. NO data
   migration, NO SQL, NO prisma seed on prod (prod has real data).
5. **No secret rotation** anywhere (F-04 bootstrap-key rotation deferred).

## Confirmed mechanics (orchestrator scan)

- `CodeDeployInstanceRole` is a SINGLE global role (iam-stack.yml) shared by staging+prod with
  wildcard ARNs (`miempresa-*-*`, `parameter/miempresa/*`, `kms key/*`). Per-env fix = add scoped
  roles/policies; migrate each instance's assume-role; retire wildcard. No bucket changes.
- Runtime env loader `infrastructure/db/scripts/env.sh` already uses `--with-decryption` → SecureString
  conversion is transparent to the app at runtime.
- `set-env.sh --secure` already implements the String→SecureString delete+recreate.
- The 3 secrets are CFN-managed as `Type: String` in `ssm-parameters-stack.yml` → conversion needs a
  de-management step (DeletionPolicy: Retain, remove from template) or CFN will revert them.
- Admin IP: `186.99.216.211`.

## Constraints (hard rules)

- AWS profile `disruptive`, region `us-east-1`, state every mutating command. Staging fully validated
  before prod. IAM stack is GLOBAL (prod-affecting) — migrate additively, never break prod access
  (recall the CD tag-filter staging outage: shared global stacks are dangerous).
- No blanket pkill/kill; no prod bun :4142 impact; no `prisma migrate diff --shadow-database-url`.
- Prod: backup first, no data mutation.

## Out of scope

- F-04 bootstrap key rotation, F-06 S3 CORS (resource change), F-09/F-10/F-11 beyond logging fix,
  S7 CSP if it needs Amplify header changes (include only the safe FE meta), S10/S11 deferred unless trivial.

## Input source

Prior cycle: `development/security-audit-backend/` (report + decisions 01/02).
