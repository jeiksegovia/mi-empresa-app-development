# Backend Lightsail Infrastructure v2 — Audit Findings & Corrected Plan

**Date**: July 1, 2026
**Status**: ✅ Phases 0–4 COMPLETE (staging live at https://miempresa-api-stg.disruptiveexp.com) · Phase 5 blocked on GitHub repo hosting · Phase 6 (prod) pending approval
**Execution log**: [backend-lightsail-deployment-runbook.md](backend-lightsail-deployment-runbook.md) — every command, 18 bugs found/fixed, all learnings
**Supersedes**: `backend-lightsail-infrastructure-cloudformation.md` (v1)
**AWS Account**: 540657241795 (profile `disruptive`) · Region `us-east-1`
**Hosted Zone**: `disruptiveexp.com` (`Z05031231XC6MYR0M5LX`) — note the double "e"; earlier docs said "disruptivexp.com"

---

## 1. Audit Verdict

The v1 plan and implemented code are **consistent with each other but would NOT work if deployed today**. Verified against the live `disruptive` account:

- ❌ No `miempresa-*` CloudFormation stacks exist
- ❌ No Lightsail instances exist
- ✅ Blueprint `amazon_linux_2023` is active and current (version 2023.12.20260629.0) — correct base image choice
- ❌ Bundle `micro_2_0` (v1 default) is **retired**. Current generation is `*_3_0`; the $7 tier is `micro_3_0` (1 GB RAM, 2 vCPU, 40 GB SSD)

Conclusion: v1 was never deployed, so every fix below is a code change with zero live-resource risk.

---

## 2. Findings — Blocking Bugs

| # | Severity | File | Problem |
|---|----------|------|---------|
| B1 | Blocker | `scripts/create-instance.sh:27`, `templates/lightsail-instance.yml` | Default bundle `micro_2_0` no longer exists → `create-instances` fails. Must be `micro_3_0` ($7). |
| B2 | Blocker | `scripts/refresh-credentials.sh`, `scripts/create-instance.sh` | **Credential chicken-and-egg.** `refresh-credentials.sh` requires an AWS profile named `bootstrap` *on the instance*, but nothing ever installs those keys there (`deploy-infrastructure.sh` configures the profile only on the developer workstation). The CodeDeploy agent never gets credentials → **no deployment can ever succeed**. |
| B3 | Blocker | `scripts/create-instance.sh:412`, `scripts/refresh-credentials.sh:55` | `register-on-premises-instance` is called without `--iam-session-arn` (CLI errors out). Even if fixed, the refresh script generates a **new timestamped session name every run** (`lightsail-$(hostname)-$(date +%s)`), which can never match the one-time registration ARN. Session name must be **stable**. |
| B4 | Blocker | `scripts/create-instance.sh:207-218`, `templates/lightsail-instance.yml:31` | `envsubst` does a single pass: `${STAGE}` inside the injected `USER_DATA_CONTENT` is never substituted, so **every instance boots as `dev`** (a prod instance would create DB `miempresa_dev`). Also the `sed 's/^/  /'` + template indentation produces an invalid YAML block scalar (first line 4 spaces, rest 2) → the AWS CLI rejects the rendered file. |
| B5 | Blocker | `cloudformation/iam-stack.yml`, `scripts/backup-postgres-s3.sh`, v1 Quick Start | **No S3 buckets are created anywhere.** IAM grants access to `codedeploy-artifacts-*`, `miempresa-backups-*`, `miempresa-uploads-*`, but no stack creates them. The Quick Start uploads to `s3://codedeploy-artifacts-us-east-1/` — a bucket name we don't own. |
| B6 | Blocker | (missing) | **No DNS, no TLS.** Task requires a backend record in the `disruptiveexp.com` zone. v1 exposes plain HTTP on `:3001` — unusable once the frontend runs on HTTPS (Amplify) due to mixed-content blocking. |
| B7 | High | `scripts/start-service.sh` | PM2 processes are started **as root** (hooks `runas: root`) but boot persistence is configured for **ec2-user** (`sudo -u ec2-user pm2 startup`). After a reboot the ec2-user PM2 daemon has no saved processes → **API does not come back after reboot**. |
| B8 | High | `scripts/after-install.sh` | Full `npm ci` + `tsc` build on a 1 GB instance with **no swap** → likely OOM. Also uses deprecated npm flags (`--production`, `--only=dev`). |
| B9 | High | `scripts/after-install.sh` (found during Phase 0) | Prisma client copied to `dist/src/generated`, but `tsconfig` uses `rootDir: src` so compiled code resolves `../generated/prisma` to **`dist/generated`** → runtime "module not found". Fixed: copy to `dist/generated`. |
| B10 | High | v1 Quick Start / packaging (found during Phase 0) | `appspec.yml` lives at `infrastructure/db/appspec.yml`, but CodeDeploy requires it at the **bundle root** — every v1-packaged deployment would be rejected. Fixed: CI copies it to the zip root. |

## 3. Findings — Design / Consistency Issues

| # | File | Issue | v2 Decision |
|---|------|-------|-------------|
| D1 | `iam-stack.yml:167-173` | Bootstrap **secret access key exposed in stack Outputs** (visible to anyone with `cloudformation:DescribeStacks`) and stored as plain `String` SSM param. | Remove the Output. Keep the SSM param (CloudFormation cannot create `SecureString`) but scope `ssm:GetParameter` on `/miempresa/bootstrap/*` to admin use only; documented as accepted "good enough" trade-off. |
| D2 | all scripts/templates | Stage names `dev`/`prod` vs. rollout plan "staging first". | **Rename `dev` → `staging`** everywhere (SSM paths, deployment group, instance name, DNS). Nothing deployed, rename is free. |
| D3 | `create-instance.sh:127` | Instance named `miempresa-db-<stage>-1` but hosts DB **and** API. | Rename to `miempresa-backend-<stage>`. |
| D4 | `.github/workflows/deploy.yml` | Deploys backend via **SAM/Lambda** — conflicts with Lightsail plan. | **Lightsail replaces SAM.** Rewrite `deploy.yml` (build artifact in CI → S3 → CodeDeploy). SAM template stays in repo, unused. |
| D5 | `refresh-credentials.sh:18` | Cron `*/50 * * * *` actually fires at :00 and :50 (not "every 50 min"). It happens to stay under the 60-min expiry, but is misleading. | Use `*/45 * * * *` (fires :00/:45, max gap 45 min) and document it. |
| D6 | `user-data-postgresql.sh` | PostgreSQL 15 — fine and matches CI (`postgres:15-alpine`) and `docker-compose.yml`. AL2023 also ships 16/17. | **Keep 15** for parity with CI/local; upgrading is a one-line dnf change + `pg_dump`/restore later. |
| D7 | `ssm-parameters-stack.yml` | Prod CORS default `https://app.miempresa.com` — wrong domain. | Parameterized; staging default set when the Amplify frontend URL exists (frontend out of scope here). |
| D8 | (missing) | Task asks for env-var/DB utility scripts. `env.sh` (SSM → `.env`) exists; nothing to *set* params or reach the DB. | Add `utilities/set-env.sh` and `utilities/db-tunnel.sh` (below). |

## 4. What v1 Got Right (kept as-is)

- **Amazon Linux 2023** blueprint — current, dnf-based, best CodeDeploy-agent support. ✓
- **CloudFormation for IAM / SSM / CodeDeploy**, shell scripts only for Lightsail provisioning (Lightsail instances aren't first-class CFN citizens worth the pain). ✓
- **SSM Parameter Store** namespacing `/miempresa/{stage}/db/*` vs `/miempresa/{stage}/api/*` — clean tier separation; moving DB to RDS later = update `/db/*` params + redeploy. ✓
- **Bootstrap user + STS AssumeRole** — this is the standard workaround because **Lightsail does not support IAM instance roles**. Complexity is inherent; v2 fixes it instead of replacing it (confirmed decision). ✓
- Postgres as a **systemd service** (`postgresql`) and the API as a **PM2-managed process** — two independent service stacks on one instance. ✓
- `prisma migrate deploy` in AfterInstall (correct non-interactive migration command). ✓

---

## 5. v2 Architecture

```
                      ┌─────────────────────────────────────────┐
   HTTPS (TLS @ edge) │ CloudFront distribution                 │
 miempresa-api-stg.   │  - ACM cert (us-east-1, DNS-validated)  │
 disruptiveexp.com ──▶│  - CachingDisabled + AllViewerExceptHost│
                      │  - custom header x-origin-verify        │
                      └───────────────┬─────────────────────────┘
                                      │ HTTP :3001 (origin)
                      ┌───────────────▼─────────────────────────┐
   origin record      │ Lightsail  miempresa-backend-staging    │
 miempresa-api-origin-│  micro_3_0 ($7) · amazon_linux_2023     │
 stg.disruptiveexp.com│                                          │
   → static IP        │  Service stack 1: postgresql (systemd)│
                      │  Service stack 2: miempresa-api (PM2,    │
                      │                   ec2-user, :3001)      │
                      │  CodeDeploy agent + STS refresh (cron)  │
                      │  Daily pg_dump → S3 (cron 2 AM)         │
                      └─────────────────────────────────────────┘

 DB debugging: ssh -L 5432:localhost:5432 ec2-user@miempresa-api-origin-stg.disruptiveexp.com
 (port 5432 NEVER opened in the firewall; tunnel only)
```

**TLS decision (confirmed)**: no SSL inside the instance. CloudFront terminates TLS with an ACM certificate. Two Route 53 records per stage:
1. `miempresa-api-origin-<stg|prod>.disruptiveexp.com` — A record → Lightsail static IP (CloudFront origins require a hostname, and this is also the SSH/tunnel entry point)
2. `miempresa-api-stg.disruptiveexp.com` / `miempresa-api.disruptiveexp.com` — alias → CloudFront

**Origin hardening (cheap)**: CloudFront injects a secret header `x-origin-verify`; an Express middleware rejects requests without it, so `:3001` being world-open is harmless in practice. Secret stored at `/miempresa/<stage>/api/ORIGIN_VERIFY_SECRET`.

**Future migration paths (unchanged by v2)**:
- **DB → RDS/Lightsail-DB**: update `/miempresa/<stage>/db/*` SSM params (host, URL), `pm2 restart` — nothing else references localhost.
- **API → ECS**: CodeDeploy application swaps compute platform; SSM params and the CloudFront origin change; DB tier untouched.
- **Frontend → Amplify** (out of scope): only needs `CORS_ORIGIN` param updated.

### Stacks (CloudFormation)

| Stack | Name | Scope | Contents |
|---|---|---|---|
| IAM | `miempresa-iam` | global | `CodeDeployInstanceRole`, instance policy, bootstrap user + key (no secret Output — D1) |
| S3 | `miempresa-s3-<stage>` | per stage | **NEW (B5)**: `miempresa-artifacts-540657241795-<stage>`, `miempresa-backups-540657241795-<stage>` (30-day lifecycle), `miempresa-uploads-540657241795-<stage>`; all BlockPublicAccess + SSE-S3 |
| SSM | `miempresa-ssm-<stage>` | per stage | env params (staging/prod AllowedValues — D2), + `ORIGIN_VERIFY_SECRET` |
| CodeDeploy | `miempresa-codedeploy` | global | app + `miempresa-staging` / `miempresa-prod` deployment groups |
| Edge | `miempresa-edge-<stage>` | per stage | **NEW (B6)**: ACM cert (DNS-validated via `Z05031231XC6MYR0M5LX`), CloudFront distribution, both Route 53 records. Parameters: `StaticIp`, `Stage`. Deployed **after** the instance exists. |

### Script fixes (same files, corrected)

- `create-instance.sh` — default `--bundle micro_3_0`; instance name `miempresa-backend-<stage>` (D3); build the create-instances payload with **jq → `--cli-input-json`** instead of envsubst-into-YAML, and prepend a literal `export STAGE=<stage>` header to the user-data script before injection (fixes B4 entirely); after boot, **push bootstrap credentials to the instance** (read `/miempresa/bootstrap/*` from SSM on the workstation, write `[bootstrap]` profile into `/root/.aws/credentials` via SSH, `chmod 600`) — fixes B2; register with `--iam-session-arn arn:aws:sts::540657241795:assumed-role/CodeDeployInstanceRole/miempresa-backend-<stage>` — fixes B3.
- `refresh-credentials.sh` — stable session name `miempresa-backend-<stage>` (B3); cron `*/45 * * * *` (D5).
- `user-data-postgresql.sh` — add **2 GB swapfile** before any install step (B8, mandatory on 1 GB RAM); everything else unchanged.
- `after-install.sh` — expects a **prebuilt artifact** (CI runs `npm ci`, `prisma generate`, `tsc` and ships `dist/`); on-instance work reduces to `npm ci --omit=dev`, `prisma generate` (cheap — schema uses `engineType = "client"`, no native engine binary), `env.sh`, `prisma migrate deploy` (B8).
- `start-service.sh` / `stop-service.sh` / `validate.sh` — run every `pm2` command as **ec2-user** (`sudo -u ec2-user pm2 ...`), so the process, `pm2 save`, and `pm2 startup systemd -u ec2-user` all agree (fixes B7).
- `deploy-infrastructure.sh` — add S3 + edge stacks, `--stage staging|prod`, `--profile disruptive` support.

### New utility scripts (D8)

- `utilities/set-env.sh --stage staging KEY VALUE [--secure] [--restart]` — `aws ssm put-parameter --overwrite`, optionally SSH in, re-run `env.sh`, `pm2 restart miempresa-api`.
- `utilities/db-tunnel.sh --stage staging [--port 5433]` — opens `ssh -N -L <port>:localhost:5432` against `miempresa-api-origin-<stage>.disruptiveexp.com`; prints the local `DATABASE_URL` for psql / Prisma Studio. Works unchanged if the DB later moves to RDS (tunnel target comes from `/db/DB_HOST`).

### CI/CD (D4 — replaces SAM path)

`deploy.yml` v2: on push to `main` (paths `backend/**`) → build & test → zip `{appspec.yml, dist/, prisma/, package*.json, infrastructure/db/scripts/}` → `aws s3 cp` to artifacts bucket → `aws deploy create-deployment --deployment-group miempresa-staging` → poll until `Succeeded`. Prod = `workflow_dispatch` with GitHub environment approval targeting `miempresa-prod`.

### Cost (staging)

| Item | Monthly |
|---|---|
| Lightsail `micro_3_0` (incl. static IP while attached) | $7.00 |
| CloudFront (low traffic, free tier) | ~$0–1 |
| S3 (backups + artifacts, <10 GB) | ~$0.25 |
| ACM cert, SSM standard params, Route 53 records (zone already exists) | $0 |
| **Total staging** | **~$7.50** |

Prod later on `small_3_0` ($12) or another `micro_3_0` ($7).

---

## 6. Execution Runbook — Staging First, Confirm Every Step

> All commands run with `--profile disruptive --region us-east-1`. Every phase ends with a **verify** block and an explicit ✋ **STOP — confirm before continuing**. No prod resources are touched anywhere in this runbook.

### Phase 0 — Code fixes ✅ DONE (July 1, 2026)
All §5 fixes applied to `backend/infrastructure/db/**`, `.github/workflows/deploy.yml`, and the origin-verify middleware to `src/app.ts` + `src/config/env.ts`. Also: obsolete `templates/lightsail-instance.yml` deleted (payload is now jq-built JSON); `NODE_ENV` SSM param set to `production` for both stages (the app gates dev behavior on it); new `utilities/set-env.sh` and `utilities/db-tunnel.sh`; README + test suite references updated.
**Verified**: `bash -n` clean on all 18 scripts; `aws cloudformation validate-template` passes on all 5 templates; `npx tsc --noEmit` clean; greps confirm no `micro_2_0`, no `dev` stage strings, no secret Outputs, stable session name consistent across `create-instance.sh`/`refresh-credentials.sh`; `deploy.yml` parses as valid YAML.
✋ **STOP — review the diff, confirm.**

### Phase 1 — Foundation stacks
```bash
cd backend/infrastructure/db/scripts
./deploy-infrastructure.sh --stage staging --region us-east-1 --profile disruptive
```
Deploys `miempresa-iam`, `miempresa-s3-staging`, `miempresa-ssm-staging`, `miempresa-codedeploy`.
**Verify**: 4 stacks `CREATE_COMPLETE`; `aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive` lists ~27 params; 3 buckets exist; local `bootstrap` profile answers `sts get-caller-identity`.
✋ **STOP — confirm.**

### Phase 2 — Instance
```bash
./create-instance.sh --stage staging --bundle micro_3_0 --profile disruptive
```
**Verify** (script prints each): instance `running`; static IP attached; SSH works; `/var/log/user-data.log` ends with success; `systemctl is-active postgresql` and `codedeploy-agent` both `active`; swap `2G` in `free -h`; `[bootstrap]` profile present in `/root/.aws/credentials`; `sudo /opt/miempresa/scripts/refresh-credentials.sh` succeeds and `aws sts get-caller-identity` on the instance shows `assumed-role/CodeDeployInstanceRole/miempresa-backend-staging`; on-prem instance registered & tagged (`aws deploy get-on-premises-instance`); `DB_PASSWORD` + `DATABASE_URL` updated in SSM (no `PLACEHOLDER`).
✋ **STOP — confirm.**

### Phase 3 — First application deployment (manual, from workstation)
```bash
cd backend && npm ci && npx prisma generate && npm run build
zip -r /tmp/miempresa-staging.zip appspec.yml dist prisma package.json package-lock.json infrastructure/db/scripts
aws s3 cp /tmp/miempresa-staging.zip s3://miempresa-artifacts-540657241795-staging/releases/ --profile disruptive
aws deploy create-deployment --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=releases/miempresa-staging.zip,bundleType=zip \
  --profile disruptive --region us-east-1
```
**Verify**: deployment `Succeeded`; on instance `sudo -u ec2-user pm2 list` shows `miempresa-api online`; `curl http://localhost:3001/health` OK; migrations applied (`npx prisma migrate status` clean); reboot test → API back online (B7 fixed).
✋ **STOP — confirm.**

### Phase 4 — Edge (DNS + TLS)
```bash
aws cloudformation deploy --template-file ../cloudformation/edge-stack.yml \
  --stack-name miempresa-edge-staging \
  --parameter-overrides Stage=staging StaticIp=<IP from Phase 2> \
  --profile disruptive --region us-east-1
```
ACM DNS-validation records are created automatically in zone `Z05031231XC6MYR0M5LX`; cert issuance typically < 30 min.
**Verify**: stack `CREATE_COMPLETE`; `dig miempresa-api-origin-stg.disruptiveexp.com` → static IP; `curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health` → 200 over TLS; direct `curl http://<IP>:3001/api/v1/empresas` **without** `x-origin-verify` → 403. (Note: `/api/v1/health` is deliberately exempt from origin verification — CodeDeploy's `validate.sh` probes it via localhost — so test the 403 with any other path.)
✋ **STOP — confirm.**

### Phase 5 — CI/CD cutover
Merge the rewritten `deploy.yml`; confirm repo secrets `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` belong to the `disruptive` account. Push a trivial backend change to `main`.
**Verify**: Actions run green end-to-end; new revision live at `https://miempresa-api-stg.disruptiveexp.com`.
✋ **STOP — staging sign-off.**

### Phase 6 — Prod (separate session, requires explicit DevOps approval per safety rules)
Repeat Phases 1–5 with `--stage prod`, bundle `small_3_0` (or `micro_3_0`), DNS `miempresa-api.disruptiveexp.com`. **Every prod command requires explicit "yes, proceed" first.**

---

## 7. Post-deploy Operations (staging)

```bash
# change an env var and hot-reload
utilities/set-env.sh --stage staging CORS_ORIGIN https://<amplify-url> --restart

# DB access from laptop (psql / Prisma Studio) — port 5432 stays closed
utilities/db-tunnel.sh --stage staging          # then: psql postgresql://miempresa:***@localhost:5433/miempresa_staging

# logs
utilities/ssh-to-instance.sh miempresa-backend-staging
sudo -u ec2-user pm2 logs miempresa-api
sudo tail -f /var/log/credential-refresh.log /var/log/postgres-backup.log

# manual backup / restore — see v1 doc §Disaster Recovery (procedure unchanged, bucket name updated)
```

**Maintenance**: creds auto-refresh (*/45); backups daily 2 AM, 30-day S3 lifecycle; rotate bootstrap key ~quarterly (update `miempresa-iam` stack, re-push `[bootstrap]` profile to instance via `create-instance.sh --refresh-bootstrap` helper).

---

## 8. Open Items (deferred, not blockers)

1. `CORS_ORIGIN` staging value — set once the Amplify frontend URL exists (frontend task).
2. Optional: CloudWatch alarm on `/health` failures (adds ~$0.10/mo) — revisit after staging burn-in.
3. Postgres 15 → 16/17 upgrade window — only if a feature demands it.
