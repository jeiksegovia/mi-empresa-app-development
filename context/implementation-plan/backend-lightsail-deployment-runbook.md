# Backend Lightsail Deployment Runbook — Live Execution Log

**Plan**: [backend-lightsail-infrastructure-cloudformation-v2.md](backend-lightsail-infrastructure-cloudformation-v2.md)
**Account**: 540657241795 · Profile `disruptive` · Region `us-east-1` · Zone `disruptiveexp.com` (Z05031231XC6MYR0M5LX)

## How this document works
- Every AWS-mutating command executed is logged verbatim under its phase, with its outcome.
- 🔑 **Turning point** = a decision or discovery that changed the approach.
- 📚 **Learning** = something non-obvious worth remembering for prod / future projects.
- ✋ Every resource-creating step requires explicit developer confirmation BEFORE execution, with a diagram of what will be created.

---

## Phase 0 — Code Fixes (July 1, 2026) ✅

No AWS mutations (only read-only `validate-template` / `get-*` calls).

**What changed**: see v2 doc §5 + Phase 0 status. Summary: 5 CFN templates (2 new: `s3-stack`, `edge-stack`), `create-instance.sh` rewritten, PM2-as-ec2-user in all hooks, prebuilt-artifact deploy flow, `deploy.yml` switched SAM→CodeDeploy, origin-verify middleware, `set-env.sh` + `db-tunnel.sh` utilities.

**Verification commands ran** (all passed):
```bash
bash -n <all 18 scripts>
aws cloudformation validate-template --template-body file://<each of 5 templates> --profile disruptive
npx tsc --noEmit
ruby -ryaml -e "YAML.load_file('.github/workflows/deploy.yml')"
```

🔑 **Turning points**
1. Live account inspection showed **nothing was deployed** — every v1 "implemented" claim was code-only, so fixes were free of migration concerns.
2. `micro_2_0` bundle no longer exists in the Lightsail API — the whole `*_2_0` generation is retired; `micro_3_0` is the $7 tier (verified via `aws lightsail get-bundles`).
3. Chose to **fix** the CodeDeploy/STS pattern rather than replace it (developer decision), and to terminate TLS at **CloudFront + ACM** instead of on-instance certs.

📚 **Learnings**
1. Lightsail instances **cannot have IAM instance roles** — the bootstrap-user + `sts:AssumeRole` + cron refresh is the standard workaround, but the role session name must be **stable** because CodeDeploy on-prem registration binds to the exact assumed-role ARN.
2. `envsubst` is single-pass: variables inside substituted content are NOT expanded — a classic template-injection footgun. jq-built `--cli-input-json` payloads are safer than YAML string splicing.
3. With `tsconfig rootDir: src`, tsc does **not** copy Prisma's generated JS client to `dist/`; the client must land at `dist/generated` (mirroring the compiled import path), not `dist/src/generated`.
4. CodeDeploy requires `appspec.yml` at the **bundle root** — keeping it in a subdirectory silently produces undeployable artifacts.
5. CloudFormation cannot create `SecureString` SSM params; to convert a CFN-created `String` param, `delete-parameter` + `put-parameter` (type change via `--overwrite` is not allowed).
6. `*/45` cron fires at :00/:45 (not "every 45 min") — fine for a 60-min STS expiry; `*/50` (v1) also happened to work but was misleading.

---

## Phase 1 — Foundation Stacks ⏳ AWAITING CONFIRMATION

**Command to run** (single mutating command):
```bash
cd backend/infrastructure/db/scripts
./deploy-infrastructure.sh --stage staging --region us-east-1 --profile disruptive
```

**Resources to be created** (cost ≈ $0/month — IAM, SSM standard tier, CodeDeploy are free; S3 pennies once used):

```
CloudFormation · us-east-1 · account 540657241795
│
├── Stack: miempresa-iam                        (global, CAPABILITY_NAMED_IAM)
│   ├── IAM Role   CodeDeployInstanceRole       ← assumed by instance via STS (1h sessions)
│   ├── IAM Policy CodeDeployInstancePolicy     ← S3 (artifacts/backups/uploads), SSM /miempresa/*,
│   │                                             CloudWatch Logs, KMS decrypt, CodeDeploy read
│   ├── IAM User   miempresa-bootstrap          ← only permission: sts:AssumeRole on the role above
│   ├── AccessKey  (for bootstrap user)
│   └── SSM params /miempresa/bootstrap/access-key-id, /miempresa/bootstrap/secret-access-key
│
├── Stack: miempresa-s3-staging
│   ├── S3 miempresa-artifacts-540657241795-staging   (deploy zips, 90-day expiry)
│   ├── S3 miempresa-backups-540657241795-staging     (pg_dump daily/, 30-day expiry, Retain)
│   └── S3 miempresa-uploads-540657241795-staging     (app uploads, Retain)
│       (all: BlockPublicAccess + SSE-S3)
│
├── Stack: miempresa-ssm-staging
│   └── ~27 SSM params under /miempresa/staging/{db,api}/*
│       (JWT_SECRET / SESSION_SECRET / ORIGIN_VERIFY_SECRET generated via openssl rand;
│        DB_PASSWORD + DATABASE_URL are placeholders until Phase 2)
│
└── Stack: miempresa-codedeploy                 (global, CAPABILITY_NAMED_IAM)
    ├── CodeDeploy Application  miempresa-app
    ├── Deployment Group        miempresa-staging   (tags: Environment=staging, Application=miempresa)
    ├── Deployment Group        miempresa-prod      (empty until Phase 6)
    └── IAM Role                miempresa-CodeDeployServiceRole
```

**Local side effect**: configures a `bootstrap` profile in `~/.aws/credentials` on this workstation (used later for debugging; same keys are pushed to the instance in Phase 2).

**Nothing else** — no Lightsail instance, no DNS, no CloudFront in this phase.

**Post-run verification checklist**:
```bash
aws cloudformation list-stacks --profile disruptive --region us-east-1 \
  --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE | grep miempresa    # 4 stacks
aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
  --profile disruptive --query "length(Parameters)"                          # ~27
aws s3 ls --profile disruptive | grep miempresa                              # 3 buckets
aws sts get-caller-identity --profile bootstrap                              # bootstrap user works
```

### Execution Log (July 2, 2026) ✅ COMPLETE — confirmed by developer before run

```bash
# Run 1 — partial: miempresa-iam ✓, miempresa-s3-staging ✓, then FAILED:
./deploy-infrastructure.sh --stage staging --region us-east-1 --profile disruptive
#   ValidationError: Parameters: [DBPassword] must have values

# Fix 1: ssm-parameters-stack.yml — DBPassword was NoEcho WITHOUT `Default: ''`
#        (v1's "leave empty to auto-generate" could never have worked)

# Run 2 — miempresa-ssm-staging ✓, then miempresa-codedeploy FAILED (ROLLBACK_COMPLETE):
./deploy-infrastructure.sh --stage staging --region us-east-1 --profile disruptive
aws cloudformation describe-stack-events --stack-name miempresa-codedeploy ...
#   "Policy arn:aws:iam::aws:policy/AWSCodeDeployRole does not exist" (404)

# Fix 2: codedeploy-stack.yml — correct managed policy ARN is
#        arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole  (service-role/ path)

# A CREATE_FAILED stack lands in ROLLBACK_COMPLETE and cannot be updated — delete first:
aws cloudformation delete-stack --stack-name miempresa-codedeploy --profile disruptive --region us-east-1
aws cloudformation wait stack-delete-complete --stack-name miempresa-codedeploy ...

# Run 3 — all 4 stacks CREATE_COMPLETE:
./deploy-infrastructure.sh --stage staging --region us-east-1 --profile disruptive
```

**Verification (all passed)**:
- 4 stacks `CREATE_COMPLETE`: `miempresa-iam`, `miempresa-s3-staging`, `miempresa-ssm-staging`, `miempresa-codedeploy`
- Exactly **27** SSM params under `/miempresa/staging/`
- 3 buckets: `miempresa-{artifacts,backups,uploads}-540657241795-staging`
- `aws sts get-caller-identity --profile bootstrap` → `user/miempresa-bootstrap`
- **End-to-end STS chain proven before any instance exists**:
  `aws sts assume-role --role-arn ...CodeDeployInstanceRole --role-session-name miempresa-backend-staging --profile bootstrap`
  → `assumed-role/CodeDeployInstanceRole/miempresa-backend-staging` ✓ (exact ARN CodeDeploy registration will use)
- JWT_SECRET / ORIGIN_VERIFY_SECRET are random hex (not stack-derived fallbacks)
- Deployment groups `miempresa-staging`, `miempresa-prod` exist

🔑 **Turning points**
1. Two v1 template bugs only surfaced at deploy time (`DBPassword` missing default, wrong managed-policy ARN) — `validate-template` does NOT catch either class (parameter defaults, cross-service ARN existence).

📚 **Learnings**
1. AWS managed policies for service roles live under the `service-role/` ARN path: `arn:aws:iam::aws:policy/service-role/AWSCodeDeployRole`. The root-path variant 404s.
2. A stack whose FIRST create fails goes to `ROLLBACK_COMPLETE` and is un-updatable — `delete-stack` + re-deploy is the only path. Harmless when the stack holds no resources.
3. Testing `sts assume-role` from the workstation with the bootstrap profile validates the entire credential chain cheaply, before any instance exists.

---

## Phase 2 — Lightsail Instance ⏳ AWAITING CONFIRMATION

**Command to run**:
```bash
cd backend/infrastructure/db/scripts
./create-instance.sh --stage staging --bundle micro_3_0 --profile disruptive
```

**Resources to be created** (cost: **$7.00/month** — the only recurring cost of this phase):

```
Lightsail · us-east-1a                          AWS (non-Lightsail)
│                                               │
├── Instance: miempresa-backend-staging         ├── SSM overwrite (SecureString):
│   ├── micro_3_0: 1 GB RAM, 2 vCPU, 40 GB SSD  │   ├── /miempresa/staging/db/DB_PASSWORD
│   ├── Blueprint: amazon_linux_2023            │   └── /miempresa/staging/db/DATABASE_URL
│   ├── user-data bootstrap installs:           │
│   │   ├── 2 GB swapfile                       └── CodeDeploy on-prem registration:
│   │   ├── PostgreSQL 15 (systemd service)         ├── name: miempresa-backend-staging
│   │   │   └── DB miempresa_staging + user         ├── iam-session-arn: ...assumed-role/
│   │   ├── CodeDeploy agent (systemd)              │   CodeDeployInstanceRole/miempresa-backend-staging
│   │   ├── Node.js 20 + PM2                        └── tags: Environment=staging, Application=miempresa
│   │   └── AWS CLI v2
│   ├── post-boot (via SSH from workstation):
│   │   ├── /root/.aws [bootstrap] credentials (from SSM)
│   │   ├── cron: */45 refresh-credentials.sh, 02:00 backup-postgres-s3.sh
│   │   └── initial STS refresh + identity assertion
│   └── firewall: 22 (SSH/tunnel) + 3001 (origin) — 5432 CLOSED
│
└── Static IP: miempresa-ip-staging (attached; free while attached)
```

**No DNS/CloudFront yet** (Phase 4). No application deployed yet (Phase 3).

### Execution Log (July 2, 2026) — confirmed by developer before run

```bash
# Attempt 1:
./create-instance.sh --stage staging --bundle micro_3_0 --profile disruptive
#   ✓ instance created, static IP 54.144.25.72 attached, firewall 22+3001
#   ✗ TIMEOUT waiting for bootstrap (codedeploy-agent never came up)

# Debug 1 — SSH failed: "invalid format ... Permission denied (publickey)"
head -c 100 ~/.ssh/miempresa-lightsail-key.pem | cat -v      # binary garbage
aws lightsail download-default-key-pair --query privateKeyBase64 --output text | head -2
#   -----BEGIN RSA PRIVATE KEY-----   <- the field is PLAIN PEM despite its name!
# 🐛 B11: v1's `| base64 --decode` CORRUPTED the key. Fixed in create-instance.sh
#         + install-ssh-key.sh; key re-downloaded without decode → SSH OK.

# Debug 2 — on instance: postgresql-15 and codedeploy-agent both "inactive"
sudo tail /var/log/user-data.log
#   "package curl-minimal ... conflicts with curl" → dnf install failed → set -e
#   aborted the ENTIRE bootstrap at step 1.
# 🐛 B12: AL2023 preinstalls curl-minimal (provides /usr/bin/curl); installing
#         full `curl` conflicts. Fixed: removed curl from the dnf package list.

# Recovery — recreate cleanly with the fixed template (validates it end-to-end
# for prod later). Static IP kept allocated → same IP 54.144.25.72:
aws lightsail delete-instance --instance-name miempresa-backend-staging --profile disruptive --region us-east-1
./create-instance.sh --stage staging --bundle micro_3_0 --profile disruptive   # attempt 2
```

🔑 **Turning points**
1. The bootstrap "timeout" was actually TWO stacked failures: a corrupt SSH key (so the poll could never see agent status) hiding a dnf package conflict that had killed the bootstrap minutes earlier.
2. Chose **delete + recreate** over patching the half-bootstrapped instance — the template must provision cleanly end-to-end before prod repeats it.

📚 **Learnings**
1. `privateKeyBase64` in `lightsail download-default-key-pair` returns the PEM as **plain text** — never pipe it through `base64 --decode`.
2. On Amazon Linux 2023, never `dnf install curl` — `curl-minimal` is preinstalled, provides `/usr/bin/curl`, and full curl conflicts with it (bootstrap-killer under `set -e`).
3. Additions this phase (developer request): user-data now runs with `set -x` + timestamped `PS4` into `/var/log/user-data.log`; PostgreSQL tuned for 1 GB RAM (shared_buffers 256MB, effective_cache_size 512MB, max_connections 50, work_mem 8MB, random_page_cost 1.1); new `utilities/validate-instance.sh` (remote 5-section validation: packages, system, IAM/creds/permissions, DB stack + tuning, API stack).

```bash
# Attempt 2: swap ✓, dnf packages ✓ (curl fix worked)... then step 2 died:
sudo tail /var/log/user-data.log
#   "sudo: /usr/bin/postgresql-15-setup: command not found"
# 🐛 B13: /usr/bin/postgresql-15-setup is the PGDG-repo layout. AL2023's NATIVE
#         postgresql15-server package uses:
#           initdb:   postgresql-setup --initdb
#           data dir: /var/lib/pgsql/data        (no 15/ segment)
#           service:  postgresql                 (not postgresql-15)
#         Fixed in user-data + validate-instance.sh + tests + v2 doc.
#         (v1 copied a PGDG-based blog tutorial without checking the AL2023 package layout.)

# Attempt 3 — clean recreate with fully fixed template:
aws lightsail delete-instance --instance-name miempresa-backend-staging --profile disruptive --region us-east-1
./create-instance.sh --stage staging --bundle micro_3_0 --profile disruptive
```

📚 **Learnings (continued)**
4. AL2023's native PostgreSQL differs from PGDG-repo installs in binary name, data dir, and systemd unit name — blog tutorials written for PGDG (`postgresql-15-setup`, `/var/lib/pgsql/15/data`, `postgresql-15.service`) fail silently-ish on AL2023 native packages.
5. `set -x` + timestamped `PS4` in user-data (added this phase) is what made B13 a 30-second diagnosis instead of guesswork.

```bash
# Attempt 3: user-data completed ALL 10 steps (postgres + agent active) — but the
# wrapper's post-boot phase failed:
#   "mv: target '/opt/miempresa/scripts/' is not a directory" ... "crontab: command not found"
# 🐛 B14: the wait-poll treated "codedeploy-agent active" as bootstrap-complete, but the
#         agent starts at step 3 — the wrapper raced ahead of directory creation (step 6).
#         Fixed: poll for the "User-data script completed successfully" marker instead.
# 🐛 B15: AL2023 does NOT preinstall cron. Fixed: dnf install cronie + systemctl enable --now crond
#         added to user-data.

# Recovery: user-data itself was clean, so the remaining wrapper steps were executed
# manually over SSH (identical commands): cronie install, script install, cron entries,
# initial refresh, identity assertion, DB password → SSM SecureString, CodeDeploy
# registration with the stable session ARN + tags. All succeeded.

# First full validation run:
./validate-instance.sh --stage staging --profile disruptive
#   26 passed / 1 FAILED: "[bootstrap] profile missing" in /root/.aws/credentials
# 🐛 B16 (CRITICAL, would have bricked staging within the hour):
#         refresh-credentials.sh OVERWROTE /root/.aws/credentials with only the [default]
#         STS section — deleting the [bootstrap] long-lived keys it needs for its NEXT run.
#         The first refresh works; every subsequent cron run would fail; all AWS access
#         (CodeDeploy agent, backups) dies when the 1-hour session expires.
#         Fixed: script now extracts and re-writes the [bootstrap] section, and refuses
#         to overwrite the file if [bootstrap] is missing.
# Proof: two consecutive refresh runs on the instance; [bootstrap] survives; identity
#        stays arn:...assumed-role/CodeDeployInstanceRole/miempresa-backend-staging.

# Final gate:
./validate-instance.sh --stage staging --profile disruptive
#   ✅ 27 passed / 0 failed / 1 pending (API — deployed in Phase 3)
```

**Phase 2 result**: ✅ COMPLETE — instance `miempresa-backend-staging` @ `54.144.25.72` (static), PostgreSQL 15 tuned + `miempresa_staging` DB, agent registered, STS auto-refresh proven over multiple cycles.

🔑 **Turning points (continued)**
3. `validate-instance.sh` (built mid-phase on developer request) caught B16 — a time-bomb that only detonates 60 minutes after an apparently successful provisioning. Post-provision validation is not optional.

📚 **Learnings (continued)**
6. AL2023 minimal footprint strikes twice: no `cronie` (B15) and `curl-minimal` (B12). Never assume classic-AL2 packages exist.
7. "Service is active" ≠ "bootstrap finished" — always poll an explicit completion marker written at the END of user-data (B14).
8. Any script that rewrites a shared credentials file must round-trip ALL profiles in it, and refuse to write if the seed profile is absent (B16).

---
## Phase 3 — First Deployment ✅ COMPLETE (July 2, 2026)

> Developer authorized autonomous continuation of all remaining staging phases ("continue autonomously with all phases"); per-phase confirmations resumed only for prod (Phase 6, blocked on explicit DevOps approval).

```bash
# Artifact: prebuilt locally (mirrors what deploy.yml does in CI)
cd backend && npm ci && npx prisma generate && npm run build
cp infrastructure/db/appspec.yml ./appspec.yml    # appspec MUST be at bundle root (B10)
zip -r /tmp/miempresa-staging.zip appspec.yml dist prisma package.json package-lock.json \
      infrastructure/db/scripts infrastructure/db/utilities -x "*.log"
aws s3 cp /tmp/miempresa-staging.zip s3://miempresa-artifacts-540657241795-staging/releases/manual-phase3.zip --profile disruptive

# Deployment 1 (d-D1L21HECK): FAILED at Install —
#   "permissions setting for (...validate.sh) is specified more than once in the AppSpec"
# 🐛 B18: CodeDeploy forbids a file matching MULTIPLE permissions entries; v1's broad
#         "**" block + "*.sh" block overlapped. Fixed: permissions section REMOVED
#         entirely (after-install.sh already chowns the tree + chmods .env 600;
#         script exec bits are preserved by zip).

# Deployment 2 (d-41DIRIECK): ✅ SUCCEEDED
aws deploy create-deployment --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=releases/manual-phase3-r2.zip,bundleType=zip \
  --profile disruptive
aws deploy wait deployment-successful --deployment-id d-41DIRIECK --profile disruptive
```

**Verification (all passed)**:
- `validate-instance.sh --stage staging` → **30 passed / 0 failed / 0 pending** (API section now live)
- `curl http://54.144.25.72:3001/api/v1/health` → 200 (exempt path)
- `curl -X POST http://54.144.25.72:3001/api/v1/auth/login` (no `x-origin-verify`) → **403** — origin hardening works
- `npx prisma migrate status` on instance → "4 migrations found … Database schema is up to date!" (30 tables)
- **Reboot test** (`aws lightsail reboot-instance`): API back with HTTP 200 in <2 min, `postgresql`/`codedeploy-agent`/`crond`/`pm2-ec2-user` all active, pm2 process `online` — proves the B7 fix (v1 would have stayed down).

📚 **Learnings**
9. CodeDeploy appspec `permissions`: one file → one entry, no overlaps. With a hook already doing `chown -R`, the permissions section is pure liability — omit it.
10. zsh: `[ "$x" == "y" ]` fails ("= not found") — use POSIX `=` in ad-hoc shells.

---

## Phase 4 — Edge: DNS + TLS ✅ COMPLETE (July 2, 2026)

```bash
OVS=$(aws ssm get-parameter --name /miempresa/staging/api/ORIGIN_VERIFY_SECRET --with-decryption \
      --profile disruptive --query Parameter.Value --output text)
aws cloudformation deploy --template-file edge-stack.yml \
  --stack-name miempresa-edge-staging \
  --parameter-overrides Environment=staging StaticIp=54.144.25.72 OriginVerifySecret="$OVS" \
  --profile disruptive --region us-east-1
# CREATE_COMPLETE in ~11 min (ACM DNS validation was fast — the CFN-managed
# validation records in the same hosted zone make issuance near-immediate)
```

**Resources created**: ACM cert (`miempresa-api-stg.disruptiveexp.com`), CloudFront distribution `EJOJ3UJPML3ZR`, Route53 A `miempresa-api-origin-stg.disruptiveexp.com` → 54.144.25.72, alias `miempresa-api-stg.disruptiveexp.com` → CloudFront.

**Verification (all passed)**:
- `dig` origin record → 54.144.25.72; api alias → CloudFront edge IPs
- `curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → **200, valid TLS**
- `POST /api/v1/auth/login` via CloudFront → 400 (Zod validation on empty body — proves the injected `x-origin-verify` header passes and the request reaches the app)
- `POST /api/v1/auth/login` direct to `IP:3001` without header → **403**

📚 **Learning**: CloudFormation-managed ACM DNS validation (`DomainValidationOptions` + `HostedZoneId`) is dramatically simpler than manual cert flows — the stack creates the validation records itself and waits for issuance.

---

## Phase 5 — CI/CD Cutover ⛔ BLOCKED — needs developer action (repo hosting)

**Discovery**: the project has **no git remote** (`git remote -v` empty; `gh secret list` → "no git remotes found"). The GitHub Actions workflows (`ci.yml`, `deploy.yml`) have never run anywhere — CI/CD was aspirational in v1.

**Ready**: the rewritten `deploy.yml` is validated, and its exact pipeline (build → zip with appspec at root → S3 → `create-deployment` → wait → health check) was executed manually end-to-end in Phase 3, succeeding as deployment `d-41DIRIECK`.

**Developer TODO to unblock**:
1. Create the GitHub repo and connect it: `git remote add origin git@github.com:<org>/<repo>.git`
2. Commit and push (working tree currently holds all Phase 0–4 changes, uncommitted by policy)
3. Create a **dedicated CI IAM user** (recommended, instead of reusing admin keys) with: `s3:PutObject` on `miempresa-artifacts-*`, `codedeploy:CreateDeployment/Get*` on `miempresa-app`
4. `gh secret set AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; create GitHub environments `staging` and `prod` (prod with required reviewers)
5. Push any backend change to `main` → verify the Actions run deploys to staging

---

## Phase 6 — Production ⏸ NOT STARTED (requires explicit DevOps "yes, proceed")

Repeat Phases 1→4 with `--stage prod` (recommended bundle `small_3_0` $12, or `micro_3_0` $7), DNS `miempresa-api.disruptiveexp.com`. The staging run has now validated every template and script end-to-end, including all 18 bugs fixed along the way. Per safety policy, every prod-mutating command will be individually confirmed.

---

## Final State (staging) — July 2, 2026

```
https://miempresa-api-stg.disruptiveexp.com      (CloudFront EJOJ3UJPML3ZR, ACM TLS)
        │ x-origin-verify header
        ▼ HTTP :3001
miempresa-backend-staging @ 54.144.25.72         (micro_3_0, $7/mo, AL2023)
  ├── postgresql (systemd)  db miempresa_staging — tuned, 4 migrations, 30 tables
  ├── miempresa-api (pm2/ec2-user, boot-persistent) — reboot-proven
  ├── codedeploy-agent — registered, deployment d-41DIRIECK Succeeded
  └── cron: STS refresh */45 (multi-cycle proven), pg_dump 02:00 → S3
SSH/db:  utilities/ssh-to-instance.sh · utilities/db-tunnel.sh --stage staging
Deploy:  utilities/validate-instance.sh --stage staging  (30/30 checks)
Cost:    ~$7.50/month
```

**Bug ledger (all fixed & verified)**: B1–B10 audit (see v2 doc §2) + found during execution: B11 `privateKeyBase64` is plain PEM · B12 curl-minimal conflict · B13 AL2023 native PostgreSQL layout · B14 agent-active ≠ bootstrap-done race · B15 no cronie on AL2023 · B16 refresh script wiped its own bootstrap profile · B17/CFN `DBPassword` missing default + wrong `AWSCodeDeployRole` ARN path · B18 appspec overlapping permissions.

---
---

# FRONTEND — Amplify Static Hosting (July 3, 2026)

**Plan**: [frontend-amplify-infrastructure-cloudformation.md](frontend-amplify-infrastructure-cloudformation.md) · Developer confirmed F1–F3 in one approval.

## Phase F0 — Code ✅
`ssr: false` in `nuxt.config.ts` · `frontend/infrastructure/{cloudformation/amplify-stack.yml, scripts/{deploy-infrastructure.sh, deploy-frontend.sh}}` · verified: `bash -n`, `validate-template`, `nuxt generate` produces SPA bundle with `NUXT_PUBLIC_API_BASE` baked in (grep-verified in `.output/public`).

## Phases F1–F3 ✅ COMPLETE — zero failed attempts

```bash
# F1 — stack (first try):
./deploy-infrastructure.sh --stage staging --profile disruptive
#   miempresa-frontend-staging CREATE_COMPLETE
#   AppId d1nsxjyualdzdu · bucket miempresa-frontend-artifacts-540657241795-staging
#   SSM /miempresa/staging/frontend/{API_BASE, APP_URL}

# F2 — first publish (first try):
./deploy-frontend.sh --stage staging --profile disruptive
#   nuxt generate (12M output, 1.9M zip) → S3 releases/20260703-001959.zip
#   → amplify start-deployment (S3 source) → job 1 SUCCEED in <1 min
#   NOTE: the S3-sourced deploy worked WITHOUT the presigned-URL fallback —
#   the ACL-enabled bucket (ObjectOwnership: ObjectWriter) satisfied Amplify.

# F3 — integration:
backend/infrastructure/db/utilities/set-env.sh --stage staging \
  CORS_ORIGIN "https://miempresa-stg.disruptiveexp.com,http://localhost:3100" --restart --profile disruptive
#   ✓ SSM updated, .env regenerated, pm2 restarted (first real-world use of set-env.sh)
```

**Verification (all passed)**:
- Default domain `https://staging.d1nsxjyualdzdu.amplifyapp.com` → 200; SPA fallback on `/empleados` → 200
- Domain association: `AWAITING_APP_CNAME` → `PENDING_DEPLOYMENT` → **`AVAILABLE`** in ~4 min — Amplify auto-created the Route 53 records (zone in same account), zero manual DNS
- `https://miempresa-stg.disruptiveexp.com/` → **200, valid TLS**; `/login` SPA fallback → 200; served bundle contains `apiBase:"https://miempresa-api-stg.disruptiveexp.com/api/v1"`
- CORS preflight (`OPTIONS` with `Origin: https://miempresa-stg.disruptiveexp.com`) → 204 with `access-control-allow-origin` echoing the exact origin + credentials

📚 **Learnings**
11. Amplify S3-sourced manual deploys DO work headless via `start-deployment --source-url s3://…` — provided the bucket has ACLs enabled (`ObjectOwnership: ObjectWriter`); with the default `BucketOwnerEnforced` this fails, which is why the frontend has its own bucket separate from the backend artifacts bucket.
12. `AWS::Amplify::Domain` on a Route 53 zone in the same account is fully hands-off: verification + alias records are created automatically (status walks AWAITING_APP_CNAME → PENDING_DEPLOYMENT → AVAILABLE).
13. Zip the CONTENTS of `.output/public` (`cd .output/public && zip -r out.zip .`) — zipping the folder itself breaks the site root (documented Amplify pitfall).

---

# QA PHASE — Three-Tier Staging Verification (July 3, 2026) ✅

**Decisions (developer-confirmed)**: minimal QA seed (one dedicated user, no sample data, no wipes) · smoke+integration subset against live staging (full CRUD suites stay local) · QA credentials in SSM (`/miempresa/staging/qa/*`).

## Artifacts created (per tier, following existing test patterns)

```
backend/prisma/test-db/                 DB tier (per developer request: prisma/test-db subfolder)
├── seed-qa.ts                          idempotent QA-admin upsert (no deletes)
├── seed-qa-staging.sh                  SSM creds (generate-once) + SSH tunnel + tsx seed
└── db-staging-qa.sh                    on-instance: migrate status, 30 tables, usuarios
                                        login-contract columns, unique email idx, QA user row
backend/tests/staging/                  Backend tier (Playwright API, TEST_API_URL pattern)
├── staging-smoke.spec.ts               health, origin-hardening, CORS preflight, login/session
└── run-staging-qa.sh                   SSM → env → playwright test tests/staging
frontend/tests/staging/                 Frontend tier (Playwright browser, TEST_FRONTEND_URL)
├── staging-login.spec.ts               login flow e2e against deployed SPA + XHR assertion
└── run-staging-qa.sh
scripts/qa-staging.sh                   orchestrator: DB → backend → frontend, summary + exit code
backend/prisma/seed.ts                  ✎ SAFETY GUARD added: refuses to run (it wipes all data)
                                        against miempresa_staging/prod DBs unless FORCE_SEED=true
```

## Execution

```bash
backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive
#   ✓ SSM qa/QA_USER_EMAIL + qa/QA_USER_PASSWORD (generated SecureString)
#   ✓ QA user upserted: id=1 (first row — confirmed staging DB was empty; login was
#     IMPOSSIBLE on staging until this step)

./scripts/qa-staging.sh --stage staging --profile disruptive
#   Run 1: DB 17/17 ✓ · Backend 8/8 ✓ · Frontend 4/5 (logout test failed)
#   Fix:   sidebar is off-canvas by default (translate-x-full) — the logout button
#          exists in the DOM but can never enter the viewport; spec now clicks the
#          header "Toggle menu" first (real user path).
#   Run 2: ✅ DB 17/17 · Backend 8/8 · Frontend 5/5 — 30/30 ALL TIERS GREEN
```

**What the green run proves end-to-end**: schema + 4 migrations clean on staging · session cookie is HttpOnly+Secure in production mode · origin hardening + CORS-with-credentials correct from the real frontend origin · **a real Chromium browser logged into `https://miempresa-stg.disruptiveexp.com`, the XHR hit `miempresa-api-stg` with status 200, dashboard rendered the QA user, and logout invalidated the session**.

📚 **Learnings**
14. `SameSite=Strict` session cookies work across `miempresa-stg` ↔ `miempresa-api-stg` because both are subdomains of the same site (`disruptiveexp.com`) — but QA MUST target the custom domain; the default `*.amplifyapp.com` domain is cross-site and login would silently fail there.
15. A dev seed that wipes data (`deleteMany` when `NODE_ENV !== 'production'`) is a staging landmine when run through a DB tunnel (local shell has no NODE_ENV) — guard by database *name*, not environment variables.
16. Accessibility-tree "visible" ≠ clickable: off-canvas elements (CSS `translate-x-full`) match locators but never enter the viewport — drive the real UI path (open the menu) instead of forcing clicks.

**Follow-up (July 3, developer report)**: dev tried `admin@miempresa.com/<redacted>` on staging → `{"error":"Credenciales inválidas"}`. Verified live: NOT a credential change — that user only exists in local dev DBs; staging has only the QA user (by design) and QA login returned 200. Hardened the suite so this class is explicit: new backend test **"dev-seed credentials must NOT work on a deployed stage"** (doubles as a security canary if anyone ever runs the dev seed on a stage), new DB check **[5/5] SSM password verifies against the DB bcrypt hash** (catches SSM↔DB credential drift), diagnostic hints on the QA-login assertion, and `prisma/test-db/get-qa-creds.sh` for manual logins. Suite now **32/32 green** (DB 18 · API 9 · browser 5).

**Follow-up 2 (July 4, developer decision)**: dev users deliberately enabled on staging for manual testing. New `prisma/test-db/create-users.ts` + `create-users-staging.sh` upserted `admin@miempresa.com` (id=2, ADMIN) and `empleado@miempresa.com` (id=3, EMPLEADO) with `<redacted>`, and set the new per-stage policy flag SSM `qa/DEV_USERS_ENABLED=true`. The security canary test became **policy-aware**: it now asserts dev creds SUCCEED where the flag is true and are REJECTED (401) everywhere else — prod stays protected by default. Verified live (`admin@` login returns the user object) and suite re-ran **32/32 green**.

## Final State — Full Stack (staging) — July 3, 2026

```
https://miempresa-stg.disruptiveexp.com          Amplify (SPA, app d1nsxjyualdzdu)
        │ XHR (CORS: exact-origin allowed)
        ▼
https://miempresa-api-stg.disruptiveexp.com      CloudFront + ACM
        ▼ x-origin-verify, HTTP :3001
miempresa-backend-staging @ 54.144.25.72         Lightsail micro_3_0 ($7/mo)
  ├── miempresa-api (pm2)  ├── postgresql (tuned)  └── cron: STS refresh + backups
Total staging cost: ~$7.50–8/month
Publish frontend:  frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --profile disruptive
Publish backend:   zip → S3 → aws deploy create-deployment (or GitHub Actions once repo is hosted)
```
