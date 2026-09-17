# Progress Report — W12-staging-release (fixes-jul17-2)

**Task ID**: #38 · **Worker**: pt-devops-infra · **Phase**: R0/R1/R2/R3/R4/R5 COMPLETE → R6 awaiting PROCEED

## Phase R0 — Preflight (read-only) — COMPLETE

### Pre-flight
- ssh-keyscan staging instance (B30 mitigation) — done.
- Loaded all 5 mandatory first reads (assignment, checklist, yesterday's runbook, deploy-learning, reset + seed-qa scripts).

### Key findings
- **HEAD**: `a169460b5d468d7b973a82f6ed8b5fc76ac38392` (unchanged since jul-17 release)
- **Working tree** (uncommitted): 22 files, +1636/-1027 (authService + RBAC matrix + requireDomain + CONTRATOS + crear-from-template + audit/dry-run + tests)
- **Migrations**: local=22, on-instance=21 (1 pending = `20260717120000_jul17_tipo_empleado_contratos`)
- **New migration risk**: purely additive (`ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS'`) — zero data loss
- **Instance**: `miempresa-backend-staging @ 54.144.25.72` running; `/api/v1/health → 200`
- **On-instance rows**: empresas=1, cargos=7, contratos=0, notas=0, fichas=3, usuarios=4, instrumentos=9
- **Uploads bucket**: 0 objects (post-jul-17-wipe) — R1 sync skipped
- **Backups bucket**: reachable; `pre-releases/`, `s3-manifests/`, `s3-objects/` prefixes present
- **Amplify**: app `d1nsxjyualdzdu` (miempresa-frontend-staging)
- **CodeDeploy**: app `miempresa-app`, groups `miempresa-staging` + `miempresa-prod` (will use ONLY staging)
- **SSM**: 32 staging params; NO `qa-*` profile pairs yet (only legacy `QA_USER_*` + `DEV_USERS_ENABLED`) — R3 creates them
- **QA scripts present**: `seed-qa-staging.sh` (5936B), `seed-qa.ts` (4634B), `get-qa-creds.sh` (2428B)
- **6 v1 templates** present in `backend/prisma/instrument-templates/`

### Runbook authored
- `context/implementation-plan/staging-release-jul17-2-runbook.md` — references yesterday's runbook + checklist + deploy-learning; does NOT duplicate them. R0 actuals + checkpoint table appended.

### Traps pre-loaded
- expect-PTY only for TTY-guarded scripts (S3 wipe does; reset script's confirm is pipeable) — R2 needs NO expect, R3 needs NO expect.
- `--profile disruptive --region us-east-1` on every AWS call.
- pg_dump PATH: `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` (B33 / OP-4) — R2 must use this.
- Helper name `note()` not `log()` (B29 / OP-6).
- Zip WITHOUT dist/generated + src/generated; appspec at root.
- CodeDeploy group: ALWAYS `miempresa-staging` (NEVER `miempresa-prod`).
- SSM writes ONLY under `/miempresa/staging/qa/*` (R3 only).
- BACKUP_BUCKET override = `miempresa-backups-540657241795-staging` (suffixed) per OP-3.

### R0 CHECKPOINT (verbatim table)

| Check | Expected | Actual |
|---|---|---|
| Git HEAD | `a169460b…` | ✓ `a169460b5d468d7b973a82f6ed8b5fc76ac38392` |
| Working tree diff | non-empty | ✓ 22 files, +1636/-1027 |
| Local migrations | 22 | ✓ 22 |
| On-instance migrations | 21 | ✓ 21 |
| New migration risk | additive | ✓ ADD VALUE IF NOT EXISTS 'CONTRATOS' |
| Lightsail staging | running @ 54.144.25.72 | ✓ |
| API health | 200 | ✓ |
| Uploads count | 0 (post-wipe) | ✓ 0 |
| Backups reachable | yes | ✓ |
| Amplify app | d1nsxjyualdzdu | ✓ |
| CodeDeploy groups | staging + prod | ✓ |
| SSM qa-* profiles | not yet | ✓ none (legacy only) |
| On-instance rows | 1/7/0/0/3/4/9 | ✓ |
| 6 v1 templates | yes | ✓ |

**AWAITING PROCEED PHASE R1** (DB dump → `pre-releases/pre-jul17-2.sql.gz`; uploads sync skipped because bucket empty).

---

## Phase R1 — DB backup — COMPLETE

### Self-fix: pg_dump URI parsing
First invocation failed because `pg_dump` with URI form fell back to Unix socket. Fix: switched to `conninfo` form (`-h localhost -p PORT -U USER -d DB`) with `PGPASSWORD` env. Worked on second attempt.

### Actual output
- Tunnel: localhost:5434 → 54.144.25.72:5432
- pg_dump: PostgreSQL 16.13 (PATH override per B33)
- Local: `/tmp/pre-jul17-2-20260717-152607.sql.gz` (25,265 bytes)
- SHA256: `2cf7cea216dd3003285994b3ade65bfc026dadd100218853d1c8c7df8846861d`
- S3: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` (24.7 KiB verified)
- Uploads sync: SKIPPED (bucket empty post-jul-17-wipe)

---

## Phase R2 — STAGING CLEAN RESET — COMPLETE (developer pre-authorized)

### Self-fix: AWS_PROFILE env propagation
reset-staging-db.sh's internal `aws s3 cp` does NOT honor `--profile`; relies on `AWS_PROFILE` env. First invocation failed with `Unable to locate credentials`. Fix: passed `AWS_PROFILE=disruptive` to the script invocation env. Retried successfully.

### Actual output
- Tunnel: localhost:5433 → 54.144.25.72:5432 (port 5433 to match R3)
- BACKUP_BUCKET=miempresa-backups-540657241795-staging (suffixed per OP-3)
- pg_dump PATH: /opt/homebrew/opt/postgresql@16/bin (per B33 / OP-4)
- Typed confirmation: `reset staging` piped via stdin (per OP-5)

- Pre-reset dump: `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260717-152735.sql.gz` (25.2 KiB)
- Schema: DROP SCHEMA public CASCADE (70 cascade objects) + CREATE SCHEMA public
- Migrations: 22 of 22 applied (including new `20260717120000_jul17_tipo_empleado_contratos`)
- Seed: 4 users + 1 empresa + 3 legacy + 6 dynamic + 6 active v1 versions + 7 cargos

### Post-reset verification (read-only via tunnel)
```
empresas=1 | cargos=7 | contratos=0 | notas=0 | fichas=0 | usuarios=4 | instrumentos=9
```
- 9 instrumentos: 3 legacy (ADM-001/FVM-001/NUT-001 with 0 versions) + 6 dynamic (each with 1 active v1)
- 4 canonical seed usuarios: admin/empleado/auditor/operador@miempresa.com (all <redacted>)

---

## Phase R3 — seed-qa-staging.sh first real run — COMPLETE

### Self-fix #1: bash version mismatch
macOS system bash is 3.2.57; script uses `declare -A` (bash 4+). Fix: `brew install bash` (5.3.15). Local tool install only.

### Self-fix #2: legacy alias ParameterAlreadyExists
Script's `put_param` lacks `--overwrite`; legacy `/miempresa/staging/qa/QA_USER_*` existed from yesterday. Script exited at line 93 BEFORE running tunnel + seed-qa.ts.
- 3 main SSM pairs WERE created (visible in stdout before failure)
- Fix: manual mirror of legacy alias using `--overwrite`, then ran `npx tsx prisma/test-db/seed-qa.ts` directly with 6 env vars from SSM
- **No script patch** — orchestration-layer fix only

### Actual output
SSM pairs created (NAMES only — passwords SecureString, generated):
- `/miempresa/staging/qa/qa-admin/EMAIL` = `qa-admin@miempresa.com`
- `/miempresa/staging/qa/qa-admin/PASSWORD` (SecureString, password set)
- `/miempresa/staging/qa/qa-gerontologa/EMAIL` = `qa-gerontologa@miempresa.com`
- `/miempresa/staging/qa/qa-gerontologa/PASSWORD` (SecureString, password set)
- `/miempresa/staging/qa/qa-contratos/EMAIL` = `qa-contratos@miempresa.com`
- `/miempresa/staging/qa/qa-contratos/PASSWORD` (SecureString, password set)
- Legacy alias mirrored: `/miempresa/staging/qa/QA_USER_EMAIL` = `qa-admin@miempresa.com` (was stale `qa@miempresa.com`)
- Legacy alias mirrored: `/miempresa/staging/qa/QA_USER_PASSWORD` (SecureString, mirrored)

3 QA user rows upserted via tunnel (verbatim from seed-qa.ts):
- id=5 email=qa-admin@miempresa.com rol=ADMIN tipoEmpleado=null
- id=6 email=qa-gerontologa@miempresa.com rol=EMPLEADO tipoEmpleado=GERONTOLOGA
- id=7 email=qa-contratos@miempresa.com rol=EMPLEADO tipoEmpleado=CONTRATOS

get-qa-creds.sh prints all 3 profiles (emails visible; passwords redacted in CHECKPOINT message).

**AWAITING PROCEED PHASE R4** (backend deploy — closes staging 500-window).

---

## Phase R4 — Backend deploy — COMPLETE

### Build (verbatim from R4 deploy log)
- HEAD: `a169460b5d468d7b973a82f6ed8b5fc76ac38392`
- `npm ci` → 426 packages in 4s
- `npm run build` → tsc OK; dist/server.js 724 bytes
- `npx prisma generate` → Generated Prisma Client ✓
- Zip size: 336,426 bytes (328.5 KiB); NO dist/generated or src/generated ✓
- Uploaded to `s3://miempresa-artifacts-540657241795-staging/deployments/jul17-2-20260717-153212.zip`

### CodeDeploy
- deploymentId: **d-8E7JTGNMK**
- Status: **Succeeded** ✓
- Group: `miempresa-staging` (NEVER prod)

### On-instance verification
- `prisma migrate status`: 22 migrations, schema up to date ✓
- `pm2 jlist`: name=miempresa-api pid=881793 status=online restarts=0 ✓ (NEW PID)
- `/api/v1/health`: HTTP 200 ✓
- after-install log: all green (artifacts present, permissions set, migrations applied)

### Credential architecture intact
- awsCredentials.ts P0 provider evidence present ✓
- cron `*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh` (root) ✓
- .env mode 600 ✓
- ownership ec2-user:ec2-user ✓

### RBAC smokes (post-deploy)
- qa-admin: login 200; GET /instruments 200 ✓
- qa-contratos: login 200; **GET /instruments → 403 DOMAIN_FORBIDDEN** ✓
- qa-contratos: **DELETE /patients/1 → 403 DOMAIN_FORBIDDEN** ✓
- qa-contratos allowed domains sanity: employees/certificates/nomina/auth/me all 200 ✓

### Note on smoke
First probe `/patients/1/fichas` returned 404 "Route not found" (path doesn't exist in deployed schema). Retried with actual instrument + patient endpoints — both correctly return 403 DOMAIN_FORBIDDEN.

**AWAITING PROCEED PHASE R5** (frontend deploy — Amplify).

---

## Phase R5 — Frontend deploy — COMPLETE

Driver: `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`.

### Build
- Stack: Nuxt 4.3.1 + Nitro 2.13.1 + Vite 7.3.1 + Vue 3.5.28; Nitro preset: static
- API base baked in: `https://miempresa-api-stg.disruptiveexp.com/api/v1`
- Client: 4,662 ms · Server: 77 ms · Prerendered: 17 routes in 1.493 s
- Build size: 13 M

### Package + upload
- Zip: 2.1 M at `/tmp/miempresa-frontend-staging-20260717-153511.zip`
- Uploaded to `s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260717-153511.zip`

### Amplify job 9
- **Status: SUCCEED** ✓ (DEPLOY 15:35:14 → 15:35:29; VERIFY 15:35:29.624 → 15:35:29.645)
- Source: ZIP
- Independent verification via `aws amplify get-job` matches script output

### HTTP checks
- `https://miempresa-stg.disruptiveexp.com` → HTTP 200 ✓
- `https://staging.d1nsxjyualdzdu.amplifyapp.com` → HTTP 200 ✓
- API base in bundle: `miempresa-api-stg.disruptiveexp.com/api/v1` ✓

**AWAITING PROCEED PHASE R6** (three-profile browser QA).

---

## Bugs ledger (continues B27-B33 from yesterday)

| # | Phase | Issue | Mitigation (orchestration-layer; scripts NOT patched per W9 frozen-deliverable rule) |
|---|---|---|---|
| **B34** | R3 | `backend/prisma/test-db/seed-qa-staging.sh` line 67 uses `declare -A` (associative array) — requires bash 4+. macOS system bash is 3.2.57 (last GPLv2 release); Homebrew ships bash 5.x at `/opt/homebrew/bin/bash`. Script as shipped is broken on every fresh macOS workstation without manual `brew install bash`. | Installed bash 5.3.15 via Homebrew; ran script with explicit `/opt/homebrew/bin/bash`. Future fix: change the script to use parallel arrays (`EMAILS_ADMIN`, `EMAILS_GERONTOLOGA`, `EMAILS_CONTRATOS`) or use a single flat env-var-driven path; OR change shebang to `#!$(brew --prefix bash)/bin/bash` and document the brew dep. |
| **B35** | R3 | `put_param` helper in `seed-qa-staging.sh` (line 57-60) omits `--overwrite` on the `aws ssm put-parameter` call. SSM `put-parameter` defaults to `Overwrite=false`, so when ANY of the legacy alias params (`/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}`) already exist, the script aborts BEFORE running the tunnel + seed-qa.ts (the 3 main SSM pairs are created before the alias write fails; but the DB user upsert never happens). Re-running the script after a successful first run also fails for the same reason → script is non-idempotent across environments that already have the legacy alias. | Mirrored legacy alias with `aws ssm put-parameter --overwrite`; ran `npx tsx prisma/test-db/seed-qa.ts` directly with the 6 env vars from SSM. Future fix: add `--overwrite` to the `put_param` helper, OR use `aws ssm get-parameter` first and skip the put if the value already matches. |

Both bugs affect the script's correctness on every environment — not just staging. Follow-up to be raised in completion report.