# Worker deploy learning — staging release playbook for the next worker

**Audience**: future `pt-devops-infra` (or any worker) doing a staging release for `miempresa`.
**Source**: every trap I (worker-10) hit during the jul-9 (2026-07-09) release and how I bypassed them. Apply these BEFORE you start so you don't waste cycles on the same fixes.

---

## Section 1 — AWS + SSM traps (always hit)

### T1.1 — `aws` profile `disruptive` has NO default region → every aws call fails with exit 253
```bash
$ aws ssm get-parameter --name /miempresa/staging/... --profile disruptive
# → "You must specify a region" (exit code 253)
```
**Fix**: append `--region us-east-1` to EVERY aws call. Always.
```bash
aws ssm get-parameter --name /miempresa/staging/api/CORS_ORIGIN \
  --profile disruptive --region us-east-1 \
  --query Parameter.Value --output text
```
📚 **Tip**: build a shell wrapper or alias if you make many calls:
```bash
AWSP="aws --profile disruptive --region us-east-1"
${AWSP} cloudformation describe-stacks ...
```

### T1.2 — Task / runbook often quotes the SSM path WRONG for DB
```bash
# Task assignment v1 said:  /miempresa/staging/api/DATABASE_URL  ← wrong
# Reality is:              /miempresa/staging/db/DATABASE_URL     ← right
```
**Fix**: discover by listing the path first:
```bash
aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
  --region us-east-1 --profile disruptive --query 'Parameters[].Name' --output text | sort
# → has /miempresa/staging/api/*  AND  /miempresa/staging/db/*  (separate trees)
```

### T1.3 — CodeDeploy application name is `miempresa-app` — NOT `miempresa-api-staging`
The orchestrator's task assignments have historically used `<service>-<stage>` notation. **Reality** (run `aws deploy list-applications` to confirm):
```bash
aws deploy list-applications --region us-east-1 --profile disruptive
# → miempresa-app                      ← (NOT miempresa-api-staging)
aws deploy list-deployment-groups --application-name miempresa-app \
  --region us-east-1 --profile disruptive
# → miempresa-staging miempresa-prod   ← (use ONLY miempresa-staging)
```
**Consequence of using the wrong app name**: `aws deploy create-deployment --application-name miempresa-api-staging` → `ApplicationDoesNotExistException` and you sit for 30 min debugging the IAM role when the issue is just the name.

### T1.4 — `describe-stacks` `StackSummaries` query `--query` shape
If you filter with `'StackSummaries[?contains(...)]'` the output can come back empty even when stacks exist — the JMESPath filter is structurally correct but seems to fail silently in some credential contexts. **Workaround**: dump full JSON and parse with python:
```bash
aws cloudformation describe-stacks --region us-east-1 --profile disruptive --output json \
  | python3 -c "import json,sys; [print(s['StackName'], s['StackStatus']) for s in json.load(sys.stdin)['Stacks']]"
```

### T1.5 — Filter prod out of every listing (defense-in-depth)
Even with intent clear, a typo can leak prod into a command. Always filter:
```bash
# Lightsail
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
# CFN
aws cloudformation describe-stacks --region us-east-1 --profile disruptive --output json \
  | python3 -c "import json,sys; [print(s['StackName'], s['StackStatus']) for s in json.load(sys.stdin)['Stacks'] if 'prod' not in s['StackName'].lower()]"
```
📚 **Rule**: if any result line contains `prod`, STOP and report to orchestrator. Even if you think it's "in scope" — confirm.

---

## Section 2 — `ssh-to-instance.sh` is interactive-only

The script at `backend/infrastructure/db/utilities/ssh-to-instance.sh` takes a positional `<instance-name>` and starts an interactive shell. It does NOT support `--command` or `--cmd` for non-interactive use.

**Workaround**: use direct ssh with the dev key pair:
```bash
SSH="ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72"

${SSH} "echo hello"
${SSH} "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | tail -5"
```
📚 **Tip**: chain multi-line commands with `&&`:
```bash
${SSH} "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-julN.sql.gz && \
        ls -la /tmp/pre-julN.sql.gz && \
        aws s3 cp /tmp/pre-julN.sql.gz s3://...pre-julN.sql.gz && \
        aws s3 ls s3://..."
```

---

## Section 3 — `prisma migrate status` quirks

### T3.1 — Returns success too eagerly
`prisma migrate status` prints `Database schema is up to date!` when there are NO pending migrations. But it does not always show the **count** of applied migrations in that summary line. Always grep:
```bash
npx prisma migrate status 2>&1 | grep -E 'migrations found|Database|warning|failed|drift'
# expected first line: "14 migrations found in prisma/migrations"
# expected last useful line: "Database schema is up to date!"
```

### T3.2 — Deprecation noise
Prints deprecation warnings about `package.json#prisma` config and a "major version available" notice. They pollute output but are NOT errors. Filter them:
```bash
npx prisma migrate status 2>&1 | grep -vE 'prisma 6|prisma 7|package.json#prisma|Update available|deprecation|pris.ly|migrate to|follow the guide|Run `npm|Run the following|This is a major' | head -10
```

### T3.3 — To verify a specific migration applied, read `_prisma_migrations` directly via `psql`
```bash
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT migration_name, finished_at IS NOT NULL AS applied FROM _prisma_migrations ORDER BY migration_name DESC LIMIT 5;\""
```
Note the `could not change directory to /home/ec2-user` warning is **benign** — postgres can't read ec2-user's home but the dump/query still runs.

### T3.4 — DO NOT USE `prisma migrate diff --shadow-database-url` against a live DB
```bash
# THIS WIPES THE DB WITHOUT WARNING:
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --shadow-database-url <URL>
# Drop in replacement (read-only):
npx prisma migrate diff \
  --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script
```

---

## Section 4 — `pg_dump` via `sudo -u postgres` from ssh

Always prints this benign warning:
```
could not change directory to "/home/ec2-user": Permission denied
```
The dump still succeeds. **Do not** try to fix the permission warning — the postgres user can't chdir to ec2-user home and doesn't need to.

---

## Section 5 — CodeDeploy artifact gotchas

### T5.1 — `appspec.yml` MUST be at the ZIP ROOT (not in a subdir)
If the appspec is at `backend/appspec.yml` inside the zip, CodeDeploy fails with "could not find appspec". Always copy it to root before zipping:
```bash
cd backend
cp infrastructure/db/appspec.yml ./appspec.yml
zip -r /tmp/artifact.zip appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities
```

### T5.2 — NO `permissions:` section in appspec.yml (B18 ledger)
CodeDeploy rejects appspecs where two `permissions` entries would overlap. The convention in this repo is to NOT declare any permissions block and instead have `after-install.sh` run `chown -R ec2-user:ec2-user /opt/miempresa/app && chmod 600 /opt/miempresa/app/.env`. If you're modifying appspec, keep it that way.

### T5.3 — DO NOT include `dist/generated` in the zip
`after-install.sh` regenerates the Prisma client on-instance:
- Run `npx prisma generate` → writes to `src/generated/prisma`
- `rm -rf dist/generated && cp -R src/generated dist/generated`
- Asserts `dist/generated/prisma` exists at line 142

If you pre-baked it locally, it would still work but it's pointless — and skipping the local generation step is what causes failures when the local `src/generated` is stale. **Generation must run on the instance** because engine binaries differ per arch.

### T5.4 — `dist/server.js` MUST exist after build
`after-install.sh` (line 89) checks: if `dist/server.js` is missing, it falls back to on-instance `npm install --include=dev && npm run build`. This fallback is slow (5+ minutes of extra install time) and bypasses CI-quality prebaked artifacts. Always verify locally before zipping:
```bash
cd backend && npm ci && npm run build
ls dist/server.js      # MUST exist
ls dist/generated      # MUST NOT exist
```

### T5.5 — The artifact zip should INCLUDE these directories
- `appspec.yml` (at root)
- `dist/` (compiled output, EXCLUDING `dist/generated`)
- `prisma/` (schema + migrations)
- `package.json` + `package-lock.json`
- `infrastructure/db/scripts/` (lifecycle hooks called from appspec)
- `infrastructure/db/utilities/` (helper scripts referenced in `env.sh`)
- ❌ `node_modules/` (instance runs `npm ci --omit=dev` on first install)
- ❌ `.env`, `.env.*` (the instance already has `.env` from a prior SSM-derived source — including a stale `.env` overwrites it and breaks auth)

---

## Section 6 — CloudFormation parameter passing

### T6.1 — `CommaDelimitedList` params must be ONE quoted string
```bash
# WRONG — CFN treats the spaces and commas as separate values:
--parameter-overrides UploadsCorsAllowedOrigins=https://a.com,https://b.com

# RIGHT — single quoted string with embedded commas:
--parameter-overrides Environment=staging \
  "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102"
```

### T6.2 — If you don't need to change a param, still pass it for idempotency
CloudFormation compares ALL parameters, not just changed ones. If the original deploy used `Environment=staging` and you omit `Environment` on a follow-up, the new params won't match and CFN may try a needless update. Always pass all params verbatim.

---

## Section 7 — Amplify deploy via `deploy-frontend.sh`

### T7.1 — `nuxt generate` API base comes from SSM, NOT from `NUXT_PUBLIC_API_BASE` shell var
The script reads `/miempresa/<stage>/frontend/API_BASE` automatically. If you bypass the script and set `NUXT_PUBLIC_API_BASE` manually in your shell, the bundle bakes the right value — but if you set `NUXT_PUBLIC_API_BASE` AND the script reads from SSM and they DIFFER, the SSM value wins (script doesn't honor the env var override).

**Decision**: always use the script, don't bypass it. The script handles zip + upload + amplify-start-deployment + poll.

### T7.2 — Zip the CONTENTS of `.output/public/`, not the folder itself
A scripted deploy bug once zipped `.output/public/` (which becomes `public/index.html` at the root of the zip — Amplify serves it at `/public/index.html`, not `/index.html`). The script handles this correctly.

### T7.3 — Verify the bundle served actually has the right API_BASE
```bash
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1
# expected: miempresa-api-stg.disruptiveexp.com/api/v1
```
If this returns the prod URL (or empty), the build was wrong.

---

## Section 8 — Staging URL probes (the everyday gotchas)

### T8.1 — `https://miempresa-stg.disruptiveexp.com/` vs `https://d1nsxjyualdzdu.amplifyapp.com/`
Both serve the same bundle, but CloudFront routing differs (origin verify, CF-Connecting-IP, etc.). **Always test the custom domain** for e2e behavior. The amplifyapp.com URL is only useful for canary testing before domain propagation completes.

### T8.2 — Some routes are SPA fallbacks (Amplify rewrite rule)
```bash
curl -sI https://miempresa-stg.disruptiveexp.com/certificados/crear
# expected: 200 (serves index.html; SPA router does the rest)
```
A 404 here means the rewrite rule is broken (very rare; usually means the bundle is missing).

### T8.3 — `GET /fichas` does NOT exist
The fichas resource is **nested** under patients:
- ❌ `GET /fichas` → 404 (no top-level resource)
- ✅ `GET /patients/:id` returns `registrosFichas` inline
- ✅ `POST /patients/:id/fichas` to create
- ✅ `PATCH /patients/:id/fichas/:fichaId/status` to transition (jul-8 VENCIDO→COMPLETADO)
- ✅ `DELETE /patients/:id/fichas/:fichaId`
If you write a smoke loop probing top-level `/fichas`, you'll get 404s and waste time debugging — it's correct behavior.

---

## Section 9 — Discover useful IDs / endpoints

### T9.1 — Find the dev key pair
```bash
ls -la ~/.ssh/miempresa-lightsail-key.pem
# If missing, check `infrastructure/db/utilities/install-ssh-key.sh`
```

### T9.2 — Find every staging SSM param by path
```bash
aws ssm get-parameters-by-path --path /miempresa/staging/ --recursive \
  --region us-east-1 --profile disruptive \
  --query 'Parameters[].{Name:Name,Type:Type}' --output table
```

### T9.3 — Latest CodeDeploy deployment for an app
```bash
aws deploy list-deployments --application-name miempresa-app \
  --region us-east-1 --profile disruptive \
  --query 'deployments | sort(@) | [0]' --output text
# or (older CLI version):
aws deploy list-deployments --application-name miempresa-app \
  --region us-east-1 --profile disruptive \
  --create-time-after 2026-07-01 \
  --query 'deployments' --output table
```

### T9.4 — Find a specific Amplify job
```bash
aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
  --region us-east-1 --profile disruptive \
  --query 'jobSummaries | sort_by(@, &createTime) | reverse(@) | [0].{Id:jobId,Status:status,Created:createTime}'
```

### T9.5 — Find stack outputs (e.g. artifacts bucket)
```bash
aws cloudformation describe-stacks --stack-name miempresa-frontend-staging \
  --region us-east-1 --profile disruptive \
  --query "Stacks[0].Outputs[?contains(OutputKey,'Bucket') || contains(OutputKey,'AppId') || contains(OutputKey,'AppUrl')].[OutputKey,OutputValue]" --output table
```

---

## Section 10 — Bash quoting traps

### T10.1 — Nested quotes in ssh commands
If you chain ssh with `python3 -c "..."` inside, the bash quoting will BITE you. Split into multiple ssh invocations:
```bash
# WRONG — unmatched " inside double-quoted ssh:
ssh ... "python3 -c \"import sys; print('a \"foo\"')\""  # ← bash confused

# RIGHT — split into separate ssh calls:
ssh ... "command_1"
ssh ... "command_2"
```

### T10.2 — `aws deploy wait` returns silently on success
```bash
DEPLOY_ID=$(aws deploy create-deployment ...)
aws deploy wait deployment-successful --deployment-id $DEPLOY_ID --region ...
# exit code 0 = success; no output. Verify with:
aws deploy get-deployment --deployment-id $DEPLOY_ID --region ... --output json \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['deploymentInfo']['status'])"
```

### T10.3 — Heredoc / multi-line inside `$()` substitution breaks
If your deployment ID contains a newline (it shouldn't, but if the `aws deploy query` is wrong), the `$(...)` capture corrupts. Always use `--query deploymentId --output text` and a known field.

---

## Section 11 — QA suite gotchas

### T11.1 — `scripts/qa-staging.sh` orchestrates all three tiers (DB / API / FE)
```bash
cd /Users/jeik/ws/mi-empresa-app-development
./scripts/qa-staging.sh --stage staging --profile disruptive
# → DB QA result: 18 passed / 0 failed
# → Backend API: 9 passed (~3s)
# → Frontend browser: 6 passed (~20s, since it spins up real Chromium)
```
**Total ~30s. Run it as the FIRST smoke after every backend deploy.**

### T11.2 — local-QA specs (`tests/local-qa/jul8-*.spec.ts`) use `admin@miempresa.com` (local seed)
They do NOT run against staging. They are local-only. For staging behavior, the tests/staging/ suite + manual jul-8 endpoint smoke is the coverage.

### T11.3 — `pm2 logs --nostream` is your friend for post-deploy error scan
```bash
ssh ... ec2-user@54.144.25.72 \
  "pm2 logs miempresa-api --lines 200 --nostream --err 2>/dev/null | \
   grep -iE 'error|exception|fatal' | grep -v 'ZodError' | tail -10"
```
The `grep -v 'ZodError'` is intentional — the origin-hardening smoke fires intentional ZodErrors and we don't want them in the noise.

---

## Section 12 — Don't do, ever

1. ❌ `pkill -f node` or `pkill -f tsx` → can kill local dev backend AND prod bun service on port 4142. Use `lsof -i :PORT -t | xargs kill` to target a specific PID.
2. ❌ `prisma migrate diff --shadow-database-url` against a live DB → silently wipes the DB.
3. ❌ Modify `miempresa-prod` deployment group, `*-prod` buckets, or anything with `prod` in the name → STOP and message orchestrator.
4. ❌ `git commit` after a release unless the user explicitly asks.
5. ❌ `npm install -g prisma@latest` (upgrade mid-deploy on the instance) — break the API surface.

---

## Section 13 — Quick command reference (the entire release in 1 page)

```bash
# R0 sanity (read-only)
git rev-parse HEAD
cd backend && npx prisma migrate status
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
aws lightsail get-instances --region us-east-1 --profile disruptive \
  --query 'instances[?contains(name,`prod`)==`false`].[name,publicIpAddress,state.name]' --output table
aws cloudformation describe-stacks --region us-east-1 --profile disruptive --output json \
  | python3 -c "import json,sys; [print(s['StackName'], s['StackStatus']) for s in json.load(sys.stdin)['Stacks'] if 'prod' not in s['StackName'].lower()]"
aws s3api get-bucket-cors --bucket miempresa-uploads-540657241795-staging \
  --region us-east-1 --profile disruptive

# R1 IaC no-op
cd backend/infrastructure/db/cloudformation
aws cloudformation deploy --template-file s3-stack.yml --stack-name miempresa-s3-staging \
  --parameter-overrides Environment=staging \
    "UploadsCorsAllowedOrigins=https://miempresa-stg.disruptiveexp.com,http://localhost:3100,http://localhost:3101,http://localhost:3102" \
  --region us-east-1 --profile disruptive

# R2 backup
ssh -i ~/.ssh/miempresa-lightsail-key.pem -o StrictHostKeyChecking=no \
  -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR ec2-user@54.144.25.72 \
  "sudo -u postgres pg_dump miempresa_staging | gzip > /tmp/pre-julN.sql.gz && \
   sha256sum /tmp/pre-julN.sql.gz && \
   aws s3 cp /tmp/pre-julN.sql.gz s3://miempresa-backups-540657241795-staging/pre-releases/pre-julN.sql.gz && \
   aws s3 ls s3://miempresa-backups-540657241795-staging/pre-releases/"

# R3 backend
cd backend && npm ci && npm run build
npx prisma generate
ls dist/server.js && ! ls dist/generated
cp infrastructure/db/appspec.yml ./appspec.yml
zip -r /tmp/artifact.zip appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities
TS=$(date +%Y%m%d-%H%M%S)
aws s3 cp /tmp/artifact.zip s3://miempresa-artifacts-540657241795-staging/deployments/${TS}.zip \
  --region us-east-1 --profile disruptive
DEPLOY_ID=$(aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/${TS}.zip,bundleType=zip \
  --region us-east-1 --profile disruptive --query deploymentId --output text)
aws deploy wait deployment-successful --deployment-id $DEPLOY_ID --region us-east-1 --profile disruptive

# R3 verify
ssh ... ec2-user@54.144.25.72 \
  "cd /opt/miempresa/app && npx prisma migrate status 2>&1 | grep -E 'migrations found|Database'"
ssh ... ec2-user@54.144.25.72 \
  "sudo -u postgres psql -d miempresa_staging -c \
   \"SELECT to_regclass('public.<new_table>'), (SELECT count(*) FROM <new_table>);\""
ssh ... ec2-user@54.144.25.72 \
  "pm2 jlist | python3 -c \"import json,sys; p=[x for x in json.load(sys.stdin) if x['name']=='miempresa-api'][0]; print(p['pm2_env']['status'], p['pm2_env']['restart_time'])\""
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-api-stg.disruptiveexp.com/api/v1/health

# R4 frontend
cd frontend && ./infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com/
curl -s https://miempresa-stg.disruptiveexp.com/ | grep -oE 'miempresa-api-stg[^"]*' | head -1

# R5 QA
cd /Users/jeik/ws/mi-empresa-app-development && ./scripts/qa-staging.sh --stage staging --profile disruptive
QA_EMAIL=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_EMAIL --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
QA_PASS=$(aws ssm get-parameter --name /miempresa/staging/qa/QA_USER_PASSWORD --with-decryption --region us-east-1 --profile disruptive --query Parameter.Value --output text)
API=https://miempresa-api-stg.disruptiveexp.com/api/v1
curl -s -c /tmp/jar -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$QA_EMAIL\",\"password\":\"$QA_PASS\"}" -o /dev/null
for ep in certificates certificates/stats instruments nomina?periodo=2026-07 employees?limit=1 auth/me patients?limit=1; do
  curl -s -b /tmp/jar -o /dev/null -w "GET /$ep: %{http_code}\n" "$API/$ep"
done
rm -f /tmp/jar
```

---

## Section 14 — When to STOP and escalate

- `aws deploy get-deployment` returns `status: Failed`
- `prisma migrate status` returns `drift detected` or `failed migrations`
- `_prisma_migrations` has a row with `finished_at IS NULL` and the deployment hasn't recovered in 5 min
- pm2 `restart_time` increases without you restarting
- Any error in `pm2 logs --err` that isn't `ZodError` from the intentional hard probe
- A `*-prod-*` resource appears in any command output you didn't expect
- A `rm`/`drop`/`delete`/`prisma migrate reset` command is about to run

In any of those, append `## Strategy Request` to progress-report.md and send `BLOCKED:` or `TURNING-POINT-STRATEGY:` to main and WAIT.

---

*Compiled by worker-10 on 2026-07-09 for the jul-9 staging release of `miempresa`. Update after every release with new lessons.*
