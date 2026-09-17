# Session Re-Anchor — security-audit + security-fixes — 2026-09-17
**Full-fidelity handoff. Re-anchor HERE.** Supersedes: (none — first reanchor for these cycles).
Covers TWO cycles this session: `security-audit-backend` (audit) → `security-fixes-backend`
(implement + staging + prod release). A future audit or devops-security session resumes from this.

## 0. ⚠️ CRITICAL first reads
- Fresh `/planify-team` session → address workers as `team-lead` (never `main`).
- Read `.claude/skills/planify-team/SKILL.md` + `worker-reuse.md`; `development/orchestration-learnings/00-index.md`.
- **Two teams share this repo**: team-security (`sec-*`/`sfx-*`) and team-tenancy (`tnt-*`). NEVER
  `git add -A` (would sweep the other team's WIP). See `development/orchestration-conventions.md`.
- **Developer standing rule**: ALWAYS seek explicit approval before ANY git action (add/commit/push).
- **IDENTITY CHANGES this session (highest-risk for a fresh session)**:
  - IAM: single `CodeDeployInstanceRole` (wildcard) → RETIRED. Now per-env
    `CodeDeployInstanceRole-{staging,prod}` + `miempresa-bootstrap-{staging,prod}` (separate keys per box).
  - Secrets: `/miempresa/{staging,prod}/api/{JWT_SECRET,SESSION_SECRET,ORIGIN_VERIFY_SECRET}` are now
    `Type: SecureString` (values UNCHANGED). No longer CFN-managed (removed from ssm-parameters-stack).
  - SSH: port 22 on both instances now restricted to admin IP `186.99.216.211/32` (was 0.0.0.0/0).

## 1. Where things stand (one paragraph)
Both cycles COMPLETE. The audit found 4 HIGH (cross-env IAM chain CH-1/F-05, secrets-as-String F-02,
KMS wildcard F-03) + MEDIUM/LOW; all 4 HIGH + the app-layer fixes (S1-S8) were implemented, validated
on staging (quality gate 23/23), and released to PROD. Two incidents during rollout (staging secret
rotation; prod SSM param deletion) were both caught and recovered with no data loss. Work committed to
`master` as `cd1eb6e` (NOT pushed). Deferred items + a from-scratch-deploy gap remain (see §9/§10).

## 2. Task ledger (TaskList resets — rebuild from here)
| Item | Durable key (task-dir) | Status |
|---|---|---|
| Audit: live infra + log evidence | `development/security-audit-backend/tasks/W1-sec-devops-1` | ✅ |
| Audit: static code+FE map | `.../W2-sec-code-1` | ✅ |
| Audit: consolidated report | `.../W3-sec-consolidate` | ✅ |
| Fix: app+frontend code+tests | `development/security-fixes-backend/tasks/W2-sfx-code` | ✅ |
| Fix: IaC/helpers/tmp-tests | `.../W1-sfx-devops` (#7) | ✅ |
| Fix: staging apply+validate | `.../W1-sfx-devops` (#8) | ✅ |
| Fix: staging quality gate | `.../W3-sfx-qa` (#9) | ✅ 23/23 |
| Fix: prod release | `.../W1-sfx-devops` (#10) + runbook | ✅ (incident recovered) |
(TaskList() now returns empty — all completed / namespace reset. Do NOT read empty as "not done".)

## 3. In-flight / incomplete
- Commit `cd1eb6e` on `master` — NOT pushed (developer gate).
- Working tree still has ~203 uncommitted paths = OTHER teams' WIP + unrelated + framework/temp. Leave them.
- S2 upload test specs are UNCOMMITTED (gitignored — see §7/§10): `backend/tests/uploads/{upload-ownership-idor,uploads-folder-whitelist}.spec.ts`.

## 4. External sync record
- No PRs/tickets. Commit only, on explicit instruction; NEVER push without approval. HEAD = `cd1eb6e`.
- Deploys use the working-tree-zip convention (not clean git tags) — repo pattern.

## 5. Live system state (VITAL)
- Account `540657241795`, region `us-east-1`, AWS profile `disruptive`. Staging live-probe only; prod by parity + explicit approval.
- Prod: Lightsail `miempresa-backend-prod` @ `44.195.227.44`; CF API dist for `miempresa-api.disruptiveexp.com`; FE `miempresa.disruptiveexp.com` (Amplify). Instance role now `CodeDeployInstanceRole-prod`. Prod CD group `miempresa-prod` (Environment=prod tag ONLY — never confuse with staging). Last prod deploy `d-K57B8N7RL`.
- Staging: `miempresa-backend-staging` @ `54.144.25.72`; CF API dist `EJOJ3UJPML3ZR` (`miempresa-api-stg.disruptiveexp.com`); FE `miempresa-stg.disruptiveexp.com`. Role `CodeDeployInstanceRole-staging`. Last staging deploy `d-6NK49I1RL`.
- CF injects `x-origin-verify` (edge-stack.yml:129-131, key must == SSM `/api/ORIGIN_VERIFY_SECRET`). Prod CF dist for origin-verify readback: `E1K9XVIXJIEX6S` (JMESPath key is `CustomHeaders`, NOT `OriginCustomHeaders`).
- DB: Postgres localhost-only on each instance (not internet-exposed, verified). Firewall: 22→admin IP, 3001→0.0.0.0/0 (CF origin, header-mitigated), 5432 closed. IMDSv2 required. STS temp creds via 45-min refresh cron.
- Secrets: SecureString under the aws/ssm KMS key. Values NEVER printed/committed. Raw audit evidence (has staging plaintext String secrets) is gitignored at `development/security-audit-backend/evidence/`.
- Prod founders/QA creds: SSM `/miempresa/prod/founders/*`; `backend/prisma/prod-db/accounts-prod.md` (gitignored). Staging QA creds: `backend/prisma/test-db/get-qa-creds.sh --profile disruptive`.

## 6. Decisions (do not re-litigate)
Audit: `development/security-audit-backend/orchestration-ctx/decisions/{00-findings-contract,01-static-verdicts-prelim,02-infra-integrated-verdicts}.md` (02 = final severities SSOT).
Fixes: `development/security-fixes-backend/orchestration-ctx/decisions/`:
- `00-fix-contract.md` — per-fix spec + deploy sequence.
- `01-iam-assume-path-isolation.md` — per-env bootstrap users + scoped trust (scoped roles alone don't isolate).
- `02-iam-stack-deploy-topology.md` — single global iam-stack declares BOTH envs statically, NO Environment param (else prod deploy deletes staging role).
- `03-s2-download-authz-corrected.md` — FLAT keys + record-scoped `assertKeyAccessible` (NOT per-uploader prefix; that broke existing files + cross-user access).
- `04-secret-conversion-no-rotation-fix.md` — SecureString conversion PRESERVES values, no rotation; capture→verify; NEVER regenerate a prod secret.

## 7. Learnings / insights (load-bearing)
**Tools ALREADY built — DO NOT rebuild:**
- `backend/infrastructure/db/utilities/ssh-allow-current-ip.sh` — detect public IP, read-modify-write port-22 cidrs, PRESERVES all other ports (incl 3001), idempotent, `--dry-run`/`--no-ssh`.
- `tmp/iam-validate/{assume-role.sh,iam-allow-staging.sh,iam-deny-prod.sh,iam-assume-staging-allowed.sh,iam-assume-prod-denied.sh}` — assume-role + allow/deny probes (staging allow, prod deny + assume-path deny).
- `set-env.sh --secure` — String→SecureString delete+recreate preserving value + optional restart.
**Gotchas (cost real prod/staging incidents this session):**
- CFN `AWS::SSM::Parameter` CANNOT be SecureString. De-managing needs `DeletionPolicy: Retain` FIRST, else deploying the resources-removed template DELETES the live params (happened on prod, ~5min outage). Safest: `put-parameter --type SecureString` directly with a captured value.
- **Bash tool calls are isolated shells** — a var captured in one call is GONE in the next. Capture + persist-to-file + verify in the SAME invocation. (This nearly lost the prod secrets.)
- On-prem CodeDeploy registration is pinned to an `iam-session-arn`; changing the instance role requires RE-REGISTERING with the new scoped session ARN (first 2 prod deploys failed until re-reg → `d-K57B8N7RL` succeeded).
- A KMS explicit-Deny with `kms:ResourceArn` condition broke legit SSM decrypt — removed; the scoped Allow (single SSM key ARN) is sufficient.
- Secret rotation breaks the CF↔app origin-verify chain (403 for all FE) — keep ORIGIN_VERIFY byte-identical to CF. "no header" was a `--query` typo (`CustomHeaders`).
- Deploy zip must contain a FRESH `npm run build` dist/ — a stale dist shipped code without the S2 fix once; verify `assertKeyAccessible` + `createPresignedPost` in dist/ BEFORE smoke.
**Developer directives:** no secret rotation; flat S3 keys (backend enforces ownership by record, not key format); IAM narrowing via policy/role only (no bucket/KMS resource changes); staging fully green before prod; backup prod DB first, no data/SQL/seed on prod; always seek approval for git.

## 8. Key files to read (ordered)
1. `development/security-fixes-backend/06-handoff.md` — what shipped + incidents + deferred.
2. `development/security-audit-backend/security-audit-report.md` — full findings.
3. `development/security-fixes-backend/orchestration-ctx/decisions/*` (00→04).
4. `context/implementation-plan/prod-release/2026-09-17-security-fixes.md` — prod runbook + actuals + §9-11 learnings.
5. `backend/infrastructure/db/cloudformation/iam-stack.yml` — per-env scoped IAM end state.
6. `backend/src/routes/uploads.routes.ts` — S2 `assertKeyAccessible` (record-scoped).
7. `development/orchestration-conventions.md` — team registry + dev↔context wiring.
8. `context/implementation-plan/security-audit-backend-findings.md` — client distillation.

## 9. Next steps
1. (Developer gate) Push `cd1eb6e` if desired.
2. Fix the uploads-tests gitignore collision (`backend/.gitignore:50 uploads/` catches `backend/tests/uploads/`): add `!backend/tests/uploads/` negation + commit the S2 specs.
3. Add the fresh-prod-stack addendum (see §NOT-validated): a `p-secrets` step (generate+`set-env --secure` the 3 SecureString secrets + sync ORIGIN_VERIFY with edge-stack) and default `create-instance.sh` SSH to admin IP (currently `create-instance.sh:272` = 0.0.0.0/0).
4. Optional next cycle: deferred findings (F-04 key rotation, F-06 S3 CORS, F-07 origin:3001, F-11 client-IP logging, S7 CSP, S11 deps) + a prod read-only parity pass.
5. FE test-suite cleanup: `qa-canary`/`fichas`/`qa-upload-roundtrip` staging specs use non-whitelisted folders (now 400 by design).

## 10. Developer gates (open)
- Push `cd1eb6e`? (held per git-approval rule)
- Approve uploads-tests gitignore negation + commit?
- Approve the fresh-deploy addendum (p-secrets + create-instance SSH default)?

## 11. Task / agent traceability
> TaskList IDs reset per session; agent IDs session-scoped. Durable key = task-dir.
| TaskList ID (this session) | Work | Worker | Durable key | State | Task dir |
|---|---|---|---|---|---|
| 1,2 | audit live evidence + logs | sec-devops-1 (SHUTDOWN) | audit-W1 | ✅ | W1-sec-devops-1 |
| 3,4 | audit static map | sec-code-1 (SHUTDOWN) | audit-W2 | ✅ | W2-sec-code-1 |
| 5 | audit report | sec-code-1 reused | audit-W3 | ✅ | W3-sec-consolidate |
| 6 | fix app+FE code | sfx-code (SHUTDOWN) | fix-W2 | ✅ | W2-sfx-code |
| 7,8,10 | IaC + staging apply + prod release | sfx-devops (TaskStop reaped) | fix-W1 | ✅ | W1-sfx-devops |
| 9 | staging quality gate | sfx-qa (SHUTDOWN) | fix-W3 | ✅ | W3-sfx-qa |

## 12. Additional details missed on first pass
- Admin machine public IP (SSH allow-list): `186.99.216.211`.
- Prod CF dist `E1K9XVIXJIEX6S`; staging CF dist `EJOJ3UJPML3ZR`.
- SSM path prefixes: `/miempresa/{staging,prod}/api/*`, `/db/*`, `/bootstrap/{staging,prod}/*` (per-env bootstrap keys), `/miempresa/prod/{founders,staff,frontend}/*`.
- iam-stack now: 14 resources = 7 staging-scoped + 7 prod-scoped; no legacy; no `Environment` param; `SSMKMSKeyArn` param (aws/ssm key, account/region-wide).
- KMS SSM key arn (staging run): `arn:aws:kms:us-east-1:540657241795:key/43cf9787-1079-43c3-8bcd-57324be0375c`.
- App runtime env loader: on-instance `infrastructure/db/scripts/env.sh` (uses `--with-decryption`).
- Upload folder whitelist (uploads.routes.ts): certificados-empleado, certificados, nomina, empleado-documentos, novedades, hojas-vida, contratos, contratos-firmados, documents, uploads.
- New dep: `@aws-sdk/s3-presigned-post@^3.1134.0` (S4 presigned POST).

### NOT validated / known-unknowns (S31)
- **From-scratch prod stack deploy NEVER exercised** with the new state — confidence LOW-MEDIUM. Known gaps: (a) the 3 secrets are no longer auto-created (app would crash on missing JWT_SECRET via S1); (b) `create-instance.sh:272` still opens SSH 22 to 0.0.0.0/0. Fix before any greenfield deploy (§9.3).
- Prod was validated only by the devops worker's own smoke (login/IDOR/health) — no INDEPENDENT prod QA pass; orchestrator did NOT live-probe prod (staging-only rule). A prod read-only parity pass is recommended.
- S2 upload IDOR/whitelist specs ran green on staging but are NOT in the repo (gitignored).
- EMPLEADO cross-user IDOR verified on STAGING (23/23); the equivalent live prod check was ADMIN-happy + not-in-record only.
