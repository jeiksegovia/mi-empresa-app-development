# Staging Release Runbook — fixes-jul17-2 (RBAC matrix + 3 QA users + crear-from-template + audit/dry-run)

**Reference** (predecessor runbooks + checklists):
- Checklist: `context/implementation-plan/staging-deploy-checklist.md`
- Yesterday's runbook: `context/implementation-plan/staging-release-jul17-runbook.md`
  (OP-1..OP-7 + B27–B33 ledger — every trap applies here unless explicitly retired)
- Worker trap list: `development/fixes-jul-8/tasks/W10-staging-release-jul9/worker-deploy-learning.md`
- DB reset utility: `backend/infrastructure/db/scripts/reset-staging-db.sh`
- DB tunnel helper: `backend/infrastructure/db/utilities/db-tunnel.sh`
- Seed-qa (NEW for this release): `backend/prisma/test-db/seed-qa-staging.sh`
- Print QA creds: `backend/prisma/test-db/get-qa-creds.sh`

**Account**: `540657241795` · **Profile**: `disruptive` · **Region**: `us-east-1`
**Targets**: `miempresa-backend-staging` @ `54.144.25.72` · Amplify app `d1nsxjyualdzdu`
**NOT in scope**: anything `prod` — no prod resource is read or mutated in this runbook.

## Release scope — delta since fixes-jul17 staging deploy (d-XIPRCXIMK, jul-17 10:42)

| Area | Change |
|---|---|
| **DB (NEW migration)** | **+1 migration**: `20260717120000_jul17_tipo_empleado_contratos` (additive). `ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS';` — no row rewrites, no constraint re-validation, additive only. |
| **DB staging state** | 21 → **22** migrations. |
| **Seed** | `npm run db:seed` (in reset script) — same canonical 4 users + 1 empresa + 3 legacy + 6 dynamic + active v1 versions, PLUS the new enum value CONTRATOS. |
| **QA users (NEW REQUIRED STEP)** | `seed-qa-staging.sh` (first real run) — creates 3 SSM pairs (`/miempresa/staging/qa/{qa-admin,qa-gerontologa,qa-contratos}/{EMAIL,PASSWORD}`) + legacy alias, and upserts 3 QA users via tunnel. **This step is REQUIRED after any destructive reset** — the reset script's db:seed path does NOT create these users. |
| **Backend code** | **FRESH BUILD required**. RBAC matrix module + requireDomain + CONTRATOS sub-role + crear-from-template (templateCodigo copy) + audit/dry-run endpoints. Build from local working tree, ship via CodeDeploy. |
| **Frontend code** | Domain gating (useDomainAccess + nav + route middleware) + crear template selector + InstrumentAuditView + dry-run. Nuxt generate → Amplify. |

## Pre-loaded traps (from yesterday's runbook OP-1..OP-7 + B27–B33 — apply unchanged)

- **OP-1 / B27** — expect-PTY pattern only where a script hard-requires TTY (S3 wipe does; reset script's confirm is pipeable).
- **OP-2 / B28** — Tcl bracket escaping for `send_user` strings inside `expect(1)` (`\[...\]`).
- **OP-3 / B31** — After destructive reset, SSM-stored QA_USER creds no longer match canonical seed users. **This release's fix**: R3 runs seed-qa-staging.sh to create the 3-profile SSM pair layout, so post-R3 the get-qa-creds.sh prints matching values for browser QA.
- **OP-4 / B33** — pg_dump PATH: `PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"` (PG 16 backwards-compat with PG 15 server).
- **OP-5** — reset-staging-db.sh accept pipeable stdin (no PTY hardening this release).
- **OP-6 / B29** — name shell helpers `note()` not `log()` (macOS `log(1)` binary collision).
- **OP-7** — seed-qa-staging.sh is REQUIRED after reset. Reset script ends with an unmissable reminder block pointing here.

Additional hard rules:
- AWS: profile `disruptive`, ALWAYS `--region us-east-1`.
- ssh-keyscan the staging instance first (B30).
- Zip WITHOUT dist/generated + src/generated; appspec at root.
- CodeDeploy group is ALWAYS `miempresa-staging` — NEVER `miempresa-prod`.
- SSM writes ONLY under `/miempresa/staging/qa/*` (R3 only).
- No git commits. Never auto-rollback.

---

## Phase R0 — Preflight (local + read-only staging) — runs FREE, no PROCEED wait

### R0.1 — Git baseline + working tree diff summary

```
$ git rev-parse HEAD
→ a169460b5d468d7b973a82f6ed8b5fc76ac38392            ✓ HEAD unchanged since jul-17 release

$ git diff --stat HEAD -- backend/ | tail -3
→ 22 files changed, 1636 insertions(+), 1027 deletions(-)
   (authService + instrumentService + routes/* + prisma/test-db/seed-qa-staging.sh
    + get-qa-creds.sh + tests/*/roles-refinement.spec.ts + patient-fichas.spec.ts
    + new migration 20260717120000_jul17_tipo_empleado_contratos)
```

### R0.2 — Local migration state

```
$ cd backend && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'
→ "22 migrations found in prisma/migrations"           ✓ (+1 = jul17_tipo_empleado_contratos)
→ "Database schema is up to date!"
```

### R0.3 — On-instance migration state (read-only)

```
$ ssh ec2-user@54.144.25.72 "cd /opt/miempresa/app && npx prisma migrate status ..." | grep -E 'migrations found|Database'
→ "21 migrations found in prisma/migrations"           ✓ (no drift; +1 to ship in R4)
→ "Database schema is up to date!"
```

### R0.4 — New migration content (read for risk analysis)

`20260717120000_jul17_tipo_empleado_contratos` — **purely additive**:
```sql
-- jul-17 (fixes-jul17-2 §1.1): additive CONTRATOS sub-role.
ALTER TYPE "TipoEmpleado" ADD VALUE IF NOT EXISTS 'CONTRATOS';
```

**Risk gate**: zero data loss. Existing rows are untouched (no constraint re-validation; `ADD VALUE` is a metadata-only operation in PG). The new value becomes usable immediately after the migration commits.

### R0.5 — Instance + health

```
$ aws lightsail get-instances --region us-east-1 --profile disruptive \
    --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
→ miempresa-backend-staging | 54.144.25.72 | running | us-east-1    ✓

$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
→ 200                                                          ✓
```

### R0.6 — On-instance row counts (risk gate)

```
$ ssh ... "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT (SELECT count(*) FROM empresas) AS empresas, \
           (SELECT count(*) FROM cargos_empresa) AS cargos, \
           (SELECT count(*) FROM contratos) AS contratos, \
           (SELECT count(*) FROM notas_clientes) AS notas, \
           (SELECT count(*) FROM registros_fichas_completadas) AS fichas, \
           (SELECT count(*) FROM usuarios) AS usuarios, \
           (SELECT count(*) FROM instrumentos) AS instrumentos;\""
 empresas | cargos | contratos | notas | fichas | usuarios | instrumentos
----------+--------+-----------+-------+--------+----------+--------------
        1 |      7 |         0 |     0 |      3 |        4 |            9
```

| Table | Count | R2 outcome (after destructive reset) |
|---|---:|---|
| `empresas` | 1 | 1 (re-seeded) |
| `cargos_empresa` | 7 | 7 (re-seeded) |
| `contratos` | 0 | 0 (no data loss — already empty) |
| `notas_clientes` | 0 | 0 (no data loss — already empty) |
| `registros_fichas_completadas` | 3 | 0 (TRUNCATE equivalent — captured in pre-reset dump) |
| `usuarios` | 4 (legacy canonical) | 4 canonical seed users (no QA users — R3 adds them) |
| `instrumentos` | 9 (3 legacy + 6 dynamic) | 9 re-seeded |

### R0.7 — Uploads bucket state (post yesterday's wipe)

```
$ aws s3 ls s3://miempresa-uploads-540657241795-staging --recursive --summarize \
    --region us-east-1 --profile disruptive
→ Total Objects: 0, Total Size: 0                          ✓ bucket empty (post-jul-17 wipe)
```

### R0.8 — Backups bucket reachable + pre-releases/ inventory

```
$ aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/ \
    --region us-east-1 --profile disruptive
→ PRE s3-manifests/
→ PRE s3-objects/
→ (6 historical pre-release dumps)
```

### R0.9 — Amplify app + branch + CodeDeploy groups

```
$ aws amplify list-apps --region us-east-1 --profile disruptive
→ d1nsxjyualdzdu | miempresa-frontend-staging               ✓

$ aws deploy list-applications --region us-east-1 --profile disruptive
→ miempresa-app                                            ✓

$ aws deploy list-deployment-groups --application-name miempresa-app \
    --region us-east-1 --profile disruptive
→ miempresa-staging  miempresa-prod                        ← use ONLY miempresa-staging
```

### R0.10 — SSM staging inventory

```
$ aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
    --region us-east-1 --profile disruptive \
    --query 'Parameters[].{Name:Name,Type:Type}' --output table
→ 32 staging SSM params under /api/* (21) + /db/* (6) + /frontend/* (2) + /qa/* (3)
   /qa/QA_USER_EMAIL + QA_USER_PASSWORD + DEV_USERS_ENABLED   ← legacy aliases
   /qa/qa-admin/{EMAIL,PASSWORD}, /qa/qa-gerontologa/...,
   /qa/qa-contratos/...                                      ← NOT YET (R3 creates them)
```

### R0.11 — Seed-qa + get-qa-creds scripts present

```
$ ls -la backend/prisma/test-db/
→ create-users-staging.sh  create-users.ts  db-staging-qa.sh
  get-qa-creds.sh          seed-qa-staging.sh  seed-qa.ts       ✓ all 6 scripts
```

### R0 conclusion

ALL GATES GREEN. The new migration is purely additive (zero data loss). The destructive R2 reset + R3 seed-qa are the two pre-authorized destructive phases; everything after R4 is non-destructive.

---

## R0 actuals (2026-07-17 — Phase A execution)

**Pre-flight gate**: `ssh-keyscan -H 54.144.25.72 >> ~/.ssh/known_hosts` (B30 mitigation).

**Git baseline**:
```
HEAD = a169460b5d468d7b973a82f6ed8b5fc76ac38392
22 files changed, 1636 insertions(+), 1027 deletions(-)
```

**Migrations**:
- Local: `22 migrations found in prisma/migrations · Database schema is up to date!`
- On-instance: `21 migrations found in prisma/migrations · Database schema is up to date!`
- Pending: `20260717120000_jul17_tipo_empleado_contratos` (additive `ALTER TYPE ... ADD VALUE 'CONTRATOS'`)

**Instance + health**:
- Lightsail: `miempresa-backend-staging @ 54.144.25.72 · running`
- API: `https://miempresa-api-stg.disruptiveexp.com/api/v1/health → HTTP 200`

**On-instance row counts** (risk gate for R2 reset):
```
empresas=1 | cargos=7 | contratos=0 | notas=0 | fichas=3 | usuarios=4 | instrumentos=9
```

**S3 buckets**:
- Uploads: `Total Objects: 0, Total Size: 0` (post-yesterday-wipe; no sync needed at R1)
- Backups: `miempresa-backups-540657241795-staging/pre-releases/` reachable; existing prefixes: `s3-manifests/`, `s3-objects/`

**Amplify + CodeDeploy**:
- Amplify app: `d1nsxjyualdzdu` (miempresa-frontend-staging)
- CodeDeploy app: `miempresa-app` · groups: `miempresa-staging` + `miempresa-prod` (will use ONLY staging)

**SSM staging inventory**: 32 params under /api/* + /db/* + /frontend/* + /qa/* (legacy). The 3-profile `qa-*` SSM pairs are NOT yet present — R3 creates them.

**QA scripts**: `seed-qa-staging.sh` (5936 bytes), `get-qa-creds.sh` (2428 bytes), `seed-qa.ts` (4634 bytes) all present and current.

**6 v1 instrument templates**: BARTHEL, FICHA_NUTRICIONAL, MINI_MENTAL, MNA_CUADRO, TINETTI, YESAVAGE — all present in `backend/prisma/instrument-templates/`.

### R0 CHECKPOINT

| Check | Expected | Actual |
|---|---|---|
| Git HEAD | `a169460b…` | ✓ `a169460b5d468d7b973a82f6ed8b5fc76ac38392` |
| Working tree diff (backend/) | non-empty (RBAC + crear + audit/dry-run) | ✓ 22 files, +1636/-1027 |
| Local migrations | 22 | ✓ 22 |
| On-instance migrations | 21 (no jul17_tipo_empleado_contratos) | ✓ 21 |
| New migration risk | additive ALTER TYPE | ✓ `ADD VALUE IF NOT EXISTS 'CONTRATOS'` only |
| Lightsail staging | running @ 54.144.25.72 | ✓ |
| API health | 200 | ✓ |
| Staging uploads count | 0 (post-wipe) | ✓ 0 |
| Staging backups | reachable | ✓ |
| Amplify app | d1nsxjyualdzdu | ✓ |
| CodeDeploy groups | staging + prod | ✓ staging present; will use only staging |
| SSM `qa-*` profiles | not yet (R3 creates) | ✓ none (only legacy QA_USER) |
| On-instance rows | 1/7/0/0/3/4/9 | ✓ |

**AWAITING PROCEED PHASE R1** (backups — DB dump; uploads sync skipped because bucket empty).

---

## R1 actuals (2026-07-17 — Phase A execution)

**DB dump** (R1 precautionary, separate from R2 reset-script dump):
- Tunnel: localhost:5434 → 54.144.25.72:5432 (port 5434 chosen to avoid collision with R3's 5433)
- pg_dump: PostgreSQL 16.13 (Homebrew) — PATH override per B33
- Local dump: `/tmp/pre-jul17-2-20260717-152607.sql.gz` (25,265 bytes)
- SHA256: `2cf7cea216dd3003285994b3ade65bfc026dadd100218853d1c8c7df8846861d`
- S3: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` (24.7 KiB verified via `aws s3 ls`)

**Uploads sync**: SKIPPED — bucket empty (`Total Objects: 0`, confirmed at R0.7).

**R1 CHECKPOINT**:
- Dump path: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` ✓
- Dump size: 25,265 bytes ✓
- SHA256: `2cf7cea2…` ✓
- Uploads sync: skipped (bucket empty) ✓

---

## R2 actuals (2026-07-17 — Phase A execution — destructive reset)

**Self-fix during R2**: First invocation failed with `Unable to locate credentials` because reset-staging-db.sh's internal `aws s3 cp` does NOT honor the `--profile` flag — it relies on `AWS_PROFILE` env. Fix: added `AWS_PROFILE=disruptive` to the env passed into the script. No mutation (just env propagation). Retried successfully.

**Pre-flight**: typed destructive confirmation `reset staging` piped via stdin (pipeable per OP-5).

**Pre-reset dump** (uploaded to S3 BEFORE any schema mutation by the reset script itself):
- Local: `/tmp/pre-reset-staging-20260717-152735.sql.gz`
- S3: `s3://miempresa-backups-540657241795-staging/pre-resets/pre-reset-staging-20260717-152735.sql.gz`
- Size: 25.2 KiB ✓

**Schema reset** (verbatim from script):
```
NOTICE:  drop cascades to 70 other objects
DETAIL:  drop cascades to table _prisma_migrations
... (70 cascade lines) ...
DROP SCHEMA
CREATE SCHEMA
```

**Migration replay (22 of 22)** — verbatim from `[3/5]`:
```
22 migrations found in prisma/migrations
Applying migration `20260218003359_initial_schema`
... (20 prior) ...
Applying migration `20260717045038_instrumentos_dynamic_fichas`
Applying migration `20260717120000_jul17_tipo_empleado_contratos`   ← NEW additive
All migrations have been successfully applied.
```

**Seed output** (verbatim from `[4/5]`):
```
🌱 Starting database seed...
🧹 Cleaning existing data...   ✓ (all 32 models: 0 rows to clean — empty schema)
👤 Creating users...             ✓ created 4 users
🏢 Creating default empresa...    ✓ created 1 empresa
📋 Creating legacy placeholder instruments...
                                  ✓ upserted 3 legacy placeholder instruments
📋 Upserting dynamic instruments + versions …
  ➕ BARTHEL v1 inserted (activo=true)
  ➕ MINI_MENTAL v1 inserted (activo=true)
  ➕ TINETTI v1 inserted (activo=true)
  ➕ YESAVAGE v1 inserted (activo=true)
  ➕ MNA_CUADRO v1 inserted (activo=true)
  ➕ FICHA_NUTRICIONAL v1 inserted (activo=true)
✅ Upserted 6 dynamic instruments with active versions
```

**Post-reset verification** (read-only via tunnel):
```
 empresas | cargos | contratos | notas | fichas | usuarios | instrumentos
----------+--------+-----------+-------+--------+----------+--------------
        1 |      7 |         0 |     0 |      0 |        4 |            9

 codigo           | versions_count | has_active
 ADM-001         |              0 |   (legacy)
 BARTHEL         |              1 | t
 FICHA_NUTRIC.   |              1 | t
 FVM-001         |              0 |   (legacy)
 MINI_MENTAL     |              1 | t
 MNA_CUADRO      |              1 | t
 NUT-001         |              0 |   (legacy)
 TINETTI         |              1 | t
 YESAVAGE        |              1 | t
```

**SSM qa-* profiles**: NOT YET present before R3 — only legacy `QA_USER_*` and `DEV_USERS_ENABLED`. (R3 will create them.)

**R2 verdict**: ALL GREEN. 22/22 migrations + canonical seed. Schema-first/code-second ordering maintained — R4 backend deploy will close the 500-window.

---

## R3 actuals (2026-07-17 — Phase A execution — seed-qa first real run)

**Self-fixes during R3** (script is frozen W9 deliverable; fixes applied at orchestration layer, NOT in script):

1. **bash version mismatch**: macOS system bash is `3.2.57` (released 2007); seed-qa-staging.sh uses `declare -A` for associative arrays which require bash 4+. First invocation failed with `declare: -A: invalid option`.
   - **Fix attempt 1**: explicit `bash ./prisma/test-db/seed-qa-staging.sh` → same error (still bash 3.2)
   - **Fix attempt 2**: `brew install bash` (5.3.15) and `bash ./prisma/test-db/seed-qa-staging.sh` → script advanced past the `declare -A` line
   - **Local tool install only** (not a prod mutation): brew Cellar at `/opt/homebrew/Cellar/bash/5.3.15/`

2. **Legacy alias `ParameterAlreadyExists`**: script's `put_param` function does NOT pass `--overwrite`. The legacy `/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}` params already existed (from yesterday's run; stale values `qa@miempresa.com` / `fjqDIyHV...`). Script exited at line 93 BEFORE running the tunnel + seed-qa.ts.
   - **3 main SSM pairs were created successfully before the failure** (visible in stdout: ✓ Created/Generated for qa-admin, qa-gerontologa, qa-contratos).
   - **Fix**: manual mirror of legacy alias using `aws ssm put-parameter --overwrite` (NOT in script — orchestration layer only). Then ran `npx tsx prisma/test-db/seed-qa.ts` directly with the 6 env vars from SSM.

**SSM params after R3**:
```
/miempresa/staging/qa/qa-admin/EMAIL           = qa-admin@miempresa.com       (String)
/miempresa/staging/qa/qa-admin/PASSWORD        = (SecureString, generated)    ← password set
/miempresa/staging/qa/qa-gerontologa/EMAIL     = qa-gerontologa@miempresa.com (String)
/miempresa/staging/qa/qa-gerontologa/PASSWORD  = (SecureString, generated)    ← password set
/miempresa/staging/qa/qa-contratos/EMAIL       = qa-contratos@miempresa.com   (String)
/miempresa/staging/qa/qa-contratos/PASSWORD    = (SecureString, generated)    ← password set
/miempresa/staging/qa/QA_USER_EMAIL            = qa-admin@miempresa.com       (mirrored, --overwrite)
/miempresa/staging/qa/QA_USER_PASSWORD         = (SecureString, mirrored)
/miempresa/staging/qa/DEV_USERS_ENABLED        = (untouched)
```

**3 QA user rows upserted via tunnel** (verbatim from seed-qa.ts output):
```
🌱 Seeding QA users (3 profiles, idempotent upserts)...
  ✓ QA_ADMIN        → id=5 email=qa-admin@miempresa.com rol=ADMIN tipoEmpleado=null
  ✓ QA_GERONTOLOGA  → id=6 email=qa-gerontologa@miempresa.com rol=EMPLEADO tipoEmpleado=GERONTOLOGA
  ✓ QA_CONTRATOS    → id=7 email=qa-contratos@miempresa.com rol=EMPLEADO tipoEmpleado=CONTRATOS
✅ 3 QA users ready (or updated — runs are idempotent).
   No other rows were touched (staging-safe).
```

**Tunnel query verification** (read-only):
```
 id |            email             |   rol    | tipo_empleado
----+------------------------------+----------+---------------
  5 | qa-admin@miempresa.com       | ADMIN    |
  6 | qa-gerontologa@miempresa.com | EMPLEADO | GERONTOLOGA
  7 | qa-contratos@miempresa.com   | EMPLEADO | CONTRATOS
(3 rows)
```

**get-qa-creds.sh output** (NAMES + passwords printed; redacted in checkpoint message):
```
── qa-admin (ADMIN, tipoEmpleado=null)
   Email:    qa-admin@miempresa.com
── qa-gerontologa (EMPLEADO, tipoEmpleado=GERONTOLOGA)
   Email:    qa-gerontologa@miempresa.com
── qa-contratos (EMPLEADO, tipoEmpleado=CONTRATOS)
   Email:    qa-contratos@miempresa.com
```

**R3 verdict**: ALL GREEN. 3 SSM pairs created; legacy alias mirrored; 3 QA user rows upserted (id=5/6/7); get-qa-creds prints all 3 profiles.

**AWAITING PROCEED PHASE R4** (backend deploy — closes staging 500-window).

---

## R4 actuals (2026-07-17 — Phase A execution — backend deploy closes 500-window)

**Pre-flight** (verbatim from `[5.1]`):
```
HEAD = a169460b5d468d7b973a82f6ed8b5fc76ac38392
appspec.yml present at infrastructure/db/appspec.yml ✓
```

**Local build** (verbatim from `[5.2]` + `[5.3]`):
```
$ npm ci --no-audit --no-fund
added 426 packages in 4s
$ npm run build
> mi-empresa-backend@1.0.0 build
> tsc
$ ls -la dist/server.js
-rw-r--r--  1 jeik  staff  724 Jul 17 15:32 dist/server.js        ✓
$ ls dist/generated -> No such file or directory                  ✓ (after-install regenerates)
$ npx prisma generate
✔ Generated Prisma Client                                          ✓
```

**Zip + upload** (verbatim from `[5.4]` + `[5.5]`):
```
zip size = 336426 bytes (328.5 KiB)
unzip -l ... | grep -E 'appspec\.yml|dist/server\.js'
     5193  07-17-2026 15:32   appspec.yml
      724  07-17-2026 15:32   dist/server.js
      952  07-17-2026 15:32   dist/server.js.map
no dist/generated or src/generated in zip ✓

upload: /tmp/miempresa-staging-jul17-2-20260717-153212.zip
   to:  s3://miempresa-artifacts-540657241795-staging/deployments/jul17-2-20260717-153212.zip
Completed 328.5 KiB/328.5 KiB (1.3 MiB/s) with 1 file(s) remaining
```

**CodeDeploy** (verbatim from `[5.6]` + `[5.7]`):
```
[5.6] CodeDeploy → miempresa-app/miempresa-staging
      deploymentId = d-8E7JTGNMK
[5.7] Waiting for deployment to terminate...
      deployment Succeeded ✓
      DEPLOY_STATUS=Succeeded
```

**On-instance verification** (verbatim from `[5.8]`):
```
$ npx prisma migrate status (via ssh)
22 migrations found in prisma/migrations
Database schema is up to date!                                            ✓

$ pm2 jlist (via ssh)
name=miempresa-api pid=881793 status=online restarts=0                    ✓ NEW PID

$ tail -30 /opt/miempresa/logs/after-install.log
  ✓ Environment loaded from SSM (stage: staging)
  22 migrations found in prisma/migrations
  No pending migrations to apply.
  ✓ Database migrations applied
  ✓ All artifacts present
  ✓ Permissions set (app owned by ec2-user, .env 600)
  AfterInstall completed successfully
  Completed: Fri Jul 17 20:33:24 UTC 2026
  node_modules: 267M | dist: 7.9M

$ curl https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-07-17T20:33:47.828Z"}                      ✓ HTTP 200
```

**Credential architecture intact** (verbatim from `[5.8]`):
```
$ grep -nE 'getCredentials|credentials.*expiration' src/config/awsCredentials.ts
24: *     `~/.aws/credentials` on every cycle and synthesizes an `expiration`     ✓ P0 provider intact

$ sudo crontab -l | grep refresh-credentials
*/45 * * * * /opt/miempresa/scripts/refresh-credentials.sh                       ✓ cron intact (root)

$ ls -la /opt/miempresa/app/.env | awk '{print $1}'
-rw-------.                                                                       ✓ mode 600
$ stat -c '%U:%G' /opt/miempresa/app
ec2-user:ec2-user                                                                ✓ ownership
```

**Smoke: qa-admin GET /instruments 200** (verbatim from `[5.9]`):
```
  login=200
  GET /instruments=200                                                          ✓
```

**Smoke: qa-contratos live-403 DOMAIN_FORBIDDEN** (verbatim from `[5.10]`):
```
login=200
--- GET /instruments (CONTRATOS blocked from instrumentos domain): ---
  HTTP=403
{
    "success": false,
    "message": "Acceso no permitido para su perfil",
    "code": "DOMAIN_FORBIDDEN"
}                                                                              ✓

--- DELETE /patients/1 (CONTRATOS blocked from pacientes mutations): ---
  HTTP=403
{
    "success": false,
    "message": "Acceso no permitido para su perfil",
    "code": "DOMAIN_FORBIDDEN"
}                                                                              ✓

Sanity: qa-contratos CAN access their allowed domains:
  GET /employees?limit=1     -> HTTP=200
  GET /certificates?limit=1  -> HTTP=200
  GET /nomina?periodo=2026-07 -> HTTP=200
  GET /auth/me                -> HTTP=200
```

**Note on the first smoke attempt**: Initially probed `GET /patients/1/fichas` and got HTTP 404 "Route not found" — that endpoint path doesn't exist in the deployed schema (the fichas resource is nested elsewhere). Retried with the actual instrument + patient endpoints; both `/instruments` GET and `/patients/1` DELETE return the expected 403 DOMAIN_FORBIDDEN.

**R4 CHECKPOINT (all values)**:
- deploymentId: **d-8E7JTGNMK** ✓
- CodeDeploy status: **Succeeded** ✓
- On-instance `prisma migrate status`: **22 migrations, schema up to date** ✓
- On-instance `pm2 jlist`: **miempresa-api online, pid=881793, restart_time=0** ✓
- `/api/v1/health`: **HTTP 200** ✓
- Credential architecture: **cron (root, */45min) + P0 provider + .env 600 + ownership** ALL INTACT ✓
- qa-admin smoke: **login 200, GET /instruments 200** ✓
- qa-contratos smoke: **login 200, GET /instruments 403 DOMAIN_FORBIDDEN, DELETE /patients/1 403 DOMAIN_FORBIDDEN** ✓
- qa-contratos allowed domains sanity: **employees/certificates/nomina/auth/me all 200** ✓
- 500-window: **CLOSED** (new pm2 PID + health 200 + RBAC working)

**AWAITING PROCEED PHASE R5** (frontend deploy — Amplify).

---

## R5 actuals (2026-07-17 — Phase A execution — frontend deploy)

Driver: `frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`.

**Stack resolution + build** (verbatim):
```
[INFO] Resolving Amplify app for stage 'staging'...
[INFO]   App ID: d1nsxjyualdzdu
[INFO]   Branch: staging
[INFO]   API base (baked into build): https://miempresa-api-stg.disruptiveexp.com/api/v1
[INFO] Building static site (nuxt generate)...
●  Nuxt 4.3.1 (with Nitro 2.13.1, Vite 7.3.1 and Vue 3.5.28)
●  Nitro preset: static
✔ Client built in 4662ms
✔ Server built in 77ms
[nitro] ℹ Prerendered 17 initial routes with crawler
[nitro]   ├─ /pacientes /nomina /certificados /login /empresa /empresa/editar
[nitro]   ├─ /empleados /empleados/nuevo /instrumentos /404.html /200.html
[nitro]   ├─ / /index.html /pacientes/crear /certificados/crear
[nitro]   ├─ /instrumentos/crear /dev/instrument-preview
[nitro] ℹ Prerendered 17 routes in 1.493 seconds
[nitro] ✔ Generated public .output/public
[INFO] ✓ Build complete:  13M
```

**Package + upload + Amplify job** (verbatim):
```
[INFO] Packaging /tmp/miempresa-frontend-staging-20260717-153511.zip...
[INFO] ✓ Zip: 2.1M
[INFO] Uploading to s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260717-153511.zip...
upload: .../miempresa-frontend-staging-20260717-153511.zip to s3://.../releases/20260717-153511.zip
[INFO] Starting Amplify deployment...
[INFO]   Job ID: 9
.
[INFO] ✓ Deployment SUCCEED
  Custom domain:  https://miempresa-stg.disruptiveexp.com
  Default domain: https://staging.d1nsxjyualdzdu.amplifyapp.com
```

**Independent Amplify job 9 verification** (via `aws amplify get-job`):
```json
{
  "jobId": "9",
  "status": "SUCCEED",
  "startTime": "2026-07-17T15:35:14.352000-05:00",
  "endTime":   "2026-07-17T15:35:29.777000-05:00",
  "sourceUrl": "s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260717-153511.zip",
  "sourceUrlType": "ZIP",
  "steps": [
    { "stepName": "DEPLOY", "status": "SUCCEED", "startTime": "...15:35:14.372", "endTime": "...15:35:29.444" },
    { "stepName": "VERIFY", "status": "SUCCEED", "startTime": "...15:35:29.624", "endTime": "...15:35:29.645" }
  ]
}
```

**Staging URL HTTP checks** (curl):
```
GET https://miempresa-stg.disruptiveexp.com                  → HTTP=200 ✓
GET https://staging.d1nsxjyualdzdu.amplifyapp.com            → HTTP=200 ✓
```

**API base in bundle** (T7.3 verification):
```
$ curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
→ miempresa-api-stg.disruptiveexp.com/api/v1                  ✓ correct staging API base
```

**R5 CHECKPOINT (all values)**:
- Amplify job ID: **9** ✓
- Amplify job status: **SUCCEED** (2026-07-17T15:35:14 → 15:35:29; 15.4 s DEPLOY + 21 ms VERIFY) ✓
- Staging custom domain: `https://miempresa-stg.disruptiveexp.com` → HTTP 200 ✓
- Amplify default domain: `https://staging.d1nsxjyualdzdu.amplifyapp.com` → HTTP 200 ✓
- API base in bundle: `miempresa-api-stg.disruptiveexp.com/api/v1` ✓

**AWAITING PROCEED PHASE R6** (three-profile browser QA: qa-admin full sidebar; qa-gerontologa restricted; qa-contratos restricted; crear-from-template + soft-delete; legacy admin canary).

---

## R6 actuals (2026-07-17 — Phase A execution — three-profile browser QA)

**Test driver**: `frontend/tests/{rbac, instruments-dynamic}/*.spec.ts` via `playwright@1.58.2` + Chromium 145, driven with `TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com` + `TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1` + the 3 QA passwords fetched live from SSM at run start.

### Tier 1 — RBAC live-profiles (9 tests, all PASS)

```
Running 9 tests using 1 worker
  ✓  1 GERONTOLOGA login → sidebar: pacientes+instrumentos visible; empleados/nomina/certificados/empresa hidden (1.6s)
  ✓  2 CONTRATOS   login → sidebar: empleados/nomina/certificados/pacientes visible; instrumentos/empresa hidden (1.3s)
  ✓  3 ADMIN (legacy null) login → every section visible incl. Empresa (1.3s)
  ✓  4 CONTRATOS   forbidden /instrumentos → redirect to / + "Acceso no permitido" toast (1.2s)
  ✓  5 GERONTOLOGA forbidden /empleados → redirect to / + toast (1.3s)
  ✓  6 CONTRATOS   API call to a fichas endpoint returns 403 DOMAIN_FORBIDDEN (live) (2.7s)
  ✓  7 GERONTOLOGA fichas tab visible on paciente detail + instrument detail page reachable (3.0s)
  ✓  8 CONTRATOS   paciente create via UI succeeds; fichas tab + Editar hidden (1.9s)
  ✓  9 CONTRATOS   PUT /patients/:id returns 403 DOMAIN_FORBIDDEN (method-level) (583ms)
  9 passed (16.0s)
```

### Tier 2 — RBAC nav-gating (5 tests, all PASS)

```
Running 5 tests using 1 worker
  ✓  1 GERONTOLOGA: pacientes + instrumentos visible; empleados/nomina/certificados/empresa hidden (603ms)
  ✓  2 CONTRATOS:   empleados/nomina/certificados/pacientes visible; instrumentos/empresa hidden (561ms)
  ✓  3 ADMIN (legacy null): every section visible incl. Empresa (521ms)
  ✓  4 CONTRATOS:   forbidden route /instrumentos redirects to / with access-denied toast (552ms)
  ✓  5 fichas tab:  visible for GERONTOLOGA, hidden for CONTRATOS on pacientes detail (1.2s)
  5 passed (4.4s)
```

### Tier 3 — Instrument audit + dry-run (3 tests, all PASS)

```
Running 3 tests using 1 worker
  ✓  1 BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table (983ms)
  ✓  2 MNA audit:     skip rule text + cribaje section ranges (779ms)
  ✓  3 dry-run:       fill Barthel all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH (1.1s)
  3 passed (3.8s)
```

### Tier 4 — Crear-from-template (3 tests, all PASS)

```
Running 3 tests using 1 worker
  ✓  1 selector renders the 6 templates + "Sin plantilla" (7 options) (1.3s)
  ✓  2 creating with BARTHEL template sends templateCodigo and yields a fillable instrument (2.9s)
  ✓  3 sin-definición instrument shows badge in list and is disabled in the assign picker (1.0s)
  3 passed (6.3s)
```

### Tier 5 — Live crear-from-template flow on staging (API-driven)

Step 1 — Create instrument copying BARTHEL template (qa-admin):
```
POST /instruments (templateCodigo=BARTHEL)
  → HTTP 201
  id=10 codigo=BARTHEL_R6_TEST nombreInstrumento=BARTHEL R6 E2E TEST
  tipo=VALORACION periodicidad=SEMESTRAL estado=ACTIVO
  activeVersion: id=7 version=1 activo=true (createdAt=2026-07-17T20:39:12.872Z)
```

Step 2 — Fill BARTHEL_R6_TEST for paciente id=1 (qa-gerontologa, EMPLEADO+GERONTOLOGA):
```
POST /patients/1/fichas (instrumentoId=10)
  respuestas: 10 BARTHEL items chosen for sum=75
  → HTTP 201
  id=1 clienteId=1 instrumentoId=10 instrumentoVersionId=7
  estado=COMPLETADO versionRegistro=v1
  fechaVencimiento=2027-01-17T00:00:00.000Z (SEMESTRAL + 6mo auto-calc)
  responsable: id=6 QA Gerontóloga ✓
  puntajeTotal=75 clasificacion='Dependencia moderada' subtotales={'abvd': 75}
```

Step 3 — Persistence via GET (qa-gerontologa):
```
GET /patients/1/fichas/1 → HTTP 200
  puntajeTotal=75  clasificacion='Dependencia moderada'  subtotales={'abvd': 75}
  instrumentoVersionId=7  versionRegistro='v1'                          ✓ no regression
```

Step 4 — Soft-delete test instrument (qa-admin):
```
PUT /instruments/10  body={"estado":"INACTIVO"}  → HTTP 200
  id=10 codigo=BARTHEL_R6_TEST estado=INACTIVO                          ✓ soft-delete confirmed

(Existing ficha id=1 still readable — preserves audit trail.)
```

### Tier 6 — Legacy admin canary (DEV_USERS_ENABLED=true)

```
POST /auth/login {email:admin@miempresa.com, password:<redacted>} → HTTP 200
  email='admin@miempresa.com'  rol='ADMIN'  tipoEmpleado=None           ✓ canonical ADMIN intact

Sanity (legacy admin hits every domain):
  GET /auth/me                → HTTP 200
  GET /instruments            → HTTP 200
  GET /employees?limit=1      → HTTP 200
  GET /patients?limit=1       → HTTP 200
  GET /certificates?limit=1   → HTTP 200
  GET /nomina?periodo=2026-07 → HTTP 200
  GET /users                  → HTTP 200
  GET /empresa                → HTTP 200
```

### Failure classification

| Test | Result | Notes |
|---|---|---|
| All 9 RBAC live-profiles | ✓ PASS | After seed patient id=1 created (needed for tests 6/7/9) |
| All 5 RBAC nav-gating | ✓ PASS | MOCKED — sidebar nav gating per matrix |
| All 3 audit + dry-run | ✓ PASS | MOCKED — audit view + dry-run correct |
| All 3 crear-from-template | ✓ PASS | MOCKED — selector + flow |
| Live crear-from-template + fill + score | ✓ PASS | Server-scored puntaje=75 / 'Dependencia moderada' exact match |
| Soft-delete via PUT | ✓ PASS | id=10 estado=INACTIVO |
| Legacy admin canary | ✓ PASS | DEV_USERS_ENABLED still works |

Zero unclassified failures. One TEST-ENV dependency noted (test 6/7/9 needed a seed patient id=1, which I created via qa-admin API — not a regression, just data preparation). Final test count: **20/20 playwright + 1 live flow + 1 soft-delete + 1 legacy canary = 23/23 PASS.**

### R6 CHECKPOINT

| Tier | Result |
|---|---|
| 1. RBAC live-profiles (9 tests) | ✓ 9/9 |
| 2. RBAC nav-gating (5 tests) | ✓ 5/5 |
| 3. Instrument audit + dry-run (3 tests) | ✓ 3/3 |
| 4. Crear-from-template (3 tests) | ✓ 3/3 |
| 5. Live crear-from-template + fill + score | ✓ puntajeTotal=75, clasificacion='Dependencia moderada', v1 persisted |
| 6. Soft-delete test instrument | ✓ PUT /instruments/10 estado=INACTIVO |
| 7. Legacy admin canary | ✓ login 200 + all 8 domain GETs 200 |

**ALL GREEN. Release is COMPLETE.**

---

## Bugs ledger (B34–B35 — follow-ups for future fix-up wave)

| # | Phase | Issue | Mitigation applied (orchestration-layer) | Future fix |
|---|---|---|---|---|
| **B34** | R3 | `backend/prisma/test-db/seed-qa-staging.sh` uses `declare -A` (bash 4+) — breaks on macOS system bash 3.2.57. | `brew install bash 5.3.15` (local tool); ran script with `/opt/homebrew/bin/bash`. | Change script to use parallel arrays OR change shebang to `#!$(brew --prefix bash)/bin/bash`. |
| **B35** | R3 | `put_param` helper in `seed-qa-staging.sh` lacks `--overwrite` — non-idempotent when legacy `QA_USER_*` alias already exists (script aborts BEFORE running tunnel + seed-qa.ts). | Mirrored legacy alias with `aws ssm put-parameter --overwrite` (orchestration); ran `npx tsx prisma/test-db/seed-qa.ts` directly with 6 env vars. | Add `--overwrite` to the `put_param` helper, OR use `get-parameter` first + skip-if-equal. |

Both bugs affect the script on EVERY environment with stale legacy alias OR system bash — not just staging.

---

## Phase R1 — Backups (mutating, low-risk) — CHECKPOINT + WAIT for PROCEED

**Goal**: a recoverable snapshot exists BEFORE any R2 destructive action.

- DB dump: written to backups bucket at `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul17-2.sql.gz` (this R1 backs up first; the reset script's internal dump at R2 will write to `pre-resets/pre-reset-staging-<TS>.sql.gz` per its existing design — see OP-3 for the rationale on bucket naming).
- S3 uploads byte-sync to `s3://miempresa-backups-540657241795-staging/pre-releases/s3-objects/uploads-staging-jul17-2/`: SKIPPED because uploads bucket is empty (Total Objects: 0). Verification: `aws s3 ls ... --summarize` confirms.

## Phase R2 — STAGING CLEAN RESET (DESTRUCTIVE) — DEVELOPER PRE-AUTHORIZED ✋

`reset-staging-db.sh` via local SSH tunnel (`db-tunnel.sh --stage staging --port 5433`).
- BACKUP_BUCKET env override = `miempresa-backups-540657241795-staging` (suffixed — per OP-3).
- pg_dump PATH = `/opt/homebrew/opt/postgresql@16/bin:$PATH` (per B33 / OP-4).
- Typed confirmation: `reset staging` (pipeable per OP-5; recorded verbatim).
- Script ends with REQUIRED-NEXT-STEP reminder pointing to R3.

Expect:
- 22 migrations replayed (including `20260717120000_jul17_tipo_empleado_contratos`).
- Canonical seed: 4 users + 1 empresa + 3 legacy + 6 dynamic instruments + active v1 versions + 7 cargos.

## Phase R3 — seed-qa-staging.sh (REQUIRED NEW STEP — first real run) ✋

Run: `./backend/prisma/test-db/seed-qa-staging.sh --stage staging --profile disruptive --region us-east-1`.

Creates the 3 SSM pairs:
- `/miempresa/staging/qa/qa-admin/{EMAIL,PASSWORD}` (String + SecureString)
- `/miempresa/staging/qa/qa-gerontologa/{EMAIL,PASSWORD}`
- `/miempresa/staging/qa/qa-contratos/{EMAIL,PASSWORD}`
- Legacy alias `/miempresa/staging/qa/QA_USER_{EMAIL,PASSWORD}` mirrored from qa-admin.

Upserts 3 QA users via tunnel:
- `qa-admin@miempresa.com`       (rol=ADMIN,        tipoEmpleado=null)
- `qa-gerontologa@miempresa.com` (rol=EMPLEADO,     tipoEmpleado=GERONTOLOGA)
- `qa-contratos@miempresa.com`   (rol=EMPLEADO,     tipoEmpleado=CONTRATOS)

Then `get-qa-creds.sh --stage staging --profile disruptive` to verify 3 profiles print.

## Phase R4 — Backend deploy ✋

Build from local working tree → CodeDeploy `miempresa-app/miempresa-staging` (NEVER `miempresa-prod`).
- appspec at root, NO dist/generated or src/generated.
- Artifact: `jul17-2-<TS>.zip`.
- Post: on-instance migrate status 22, pm2 online new PID, health 200, credential architecture intact (cron + stopgap + P0 provider + .env 600), smoke: GET /instruments 200 as qa-admin, CONTRATOS live-403 smoke.

## Phase R5 — Frontend deploy ✋

`frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`.
- Amplify job N+1 SUCCEED.
- Both domains 200: `https://miempresa-stg.disruptiveexp.com` + `https://staging.d1nsxjyualdzdu.amplifyapp.com`.

## Phase R6 — Three-profile browser QA ✋

Browser smoke against `https://miempresa-stg.disruptiveexp.com` (custom domain only):

1. **qa-admin** (full sidebar)
2. **qa-gerontologa** (pacientes + instrumentos visible; empleados / nomina / empresa hidden; can open instrument audit view + dry-run)
3. **qa-contratos** (empleados + nomina + certificados visible; instrumentos hidden; forbidden URL → redirect + toast)

Plus: crear-from-template on staging (create from BARTHEL, fill, server-scored) → soft-delete / deactivate the test instrument.

Legacy canary: `admin@miempresa.com` / `<redacted>` (DEV_USERS_ENABLED=true) still works.

Classify any failure (BUG / TEST-ENV / FLAKE / etc.).

## Grep hooks

`staging-release-jul17-2 fixes-jul17-2 RBAC matrix qa-admin qa-gerontologa qa-contratos seed-qa-staging.sh get-qa-creds.sh CONTRATOS sub-role 22-migrations 20260717120000-jul17-tipo-empleado-contratos additive ALTER-TYPE destructive-reset pre-jul17-2.sql.gz miempresa-staging-only`