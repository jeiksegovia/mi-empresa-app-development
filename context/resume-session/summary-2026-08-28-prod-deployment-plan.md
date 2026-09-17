# Resume-Session Summary — 2026-08-28 (prod deployment PLAN — not yet executed)

**Purpose**: single entry point so a **new clean context** can resume the mi-empresa-app **first-time production deployment** without re-deriving this session's analysis. This session produced a **plan only** — zero AWS resources were created or modified for prod. Read this file, then open the plan doc (§1 below) before doing anything else.

**Status**: PLAN COMPLETE, EXECUTION NOT STARTED. Prod AWS account state is a confirmed clean slate as of 2026-08-28 (see §2).

---

## 0) Bootstrap (do this first in a new session)

```bash
# 1. Read the plan (the actual runbook — this file is a pointer + insights, not a substitute)
cat context/implementation-plan/prod-deployment-plan.md

# 2. Re-verify the account is still a clean slate before trusting the plan's P0 assumptions
#    (state the exact command, get consent, THEN run — see hard rules below)
aws cloudformation describe-stacks --profile disruptive --region us-east-1 --output json \
  | python3 -c "import json,sys; [print(s['StackName'], s['StackStatus']) for s in json.load(sys.stdin)['Stacks']]" | grep -i prod
aws lightsail get-instances --profile disruptive --region us-east-1 --query 'instances[].name' --output text | grep -i prod
aws deploy list-deployments --application-name miempresa-app --deployment-group-name miempresa-prod --profile disruptive --region us-east-1

# 3. Confirm local repo state hasn't drifted since the plan was written
cd backend && git rev-parse HEAD && npx prisma migrate status 2>&1 | grep -E "migrations found|Database"
# Plan was written against HEAD e86a0e4, 32 local migrations, "up to date"
```

**Hard rules (never skip — prod-specific, stricter than the staging convention this repo otherwise uses)**
- **No autonomous execution for prod.** Every phase (P1–P6) requires a separate explicit "yes, proceed" — unlike staging, where autonomous continuation was authorized after Phase 1 in an earlier session. Do not chain phases without asking.
- State the exact AWS command + target resource before running it, even read-only (`describe`/`list`/`get`). Never probe multiple profiles.
- Only profile `disruptive`, region `us-east-1` — pass both explicitly on every `aws` call (no implicit default profile on this machine).
- CodeDeploy group `miempresa-prod` exists (created empty in an earlier staging-era global stack deploy) but **zero deployments have ever run against it** — confirmed live 2026-08-28. Phase P3 is the actual first deployment.
- Never zip `backend/src/generated/prisma/` into a CodeDeploy artifact.
- Migrations are gitignored (`prisma/migrations/*.sql`) — ship only inside the deploy zip, applied via `npx prisma migrate deploy` in `after-install.sh`.
- `backend/prisma/prod-db/` is **entirely gitignored** (contains/will contain real business data) — never try to commit it, never assume it exists in a fresh checkout without re-verifying (see §4).
- Commit only on explicit instruction; never push unless asked (same as always).

---

## 1) Primary reference — read this, not just this summary

**`context/implementation-plan/prod-deployment-plan.md`** (318 lines) — the actual phased runbook (P0 → P1 → P2 → P3 → P4 → P5 → P-SEED → P6), decisions log, domain-consistency sanity report, cargos/email confirmations, rollback plan, and the full staging-era bug ledger (B1–B18) carried forward as "already fixed, re-verify anyway." This resume file summarizes and points at it — the plan doc is the source of truth for exact commands.

---

## 2) State at a glance

| Layer | State |
|---|---|
| **Plan** | Written and refined this session. Domain-consistency bugs found and **fixed** (not just flagged). Seed scripts written, syntax/type-checked. |
| **Prod AWS** | **Clean slate, confirmed 2026-08-28** — no CFN stacks, no Lightsail instance, no SSM params, no Route 53 records, no Amplify app for prod. `miempresa-prod` CodeDeploy deployment group exists (empty) from the original staging-era global stack. |
| **Local code changes (uncommitted, part of the 161-file working-tree delta already in progress)** | `backend/infrastructure/db/scripts/deploy-infrastructure.sh` (domain-consistency fix), `.gitignore` (+`backend/prisma/prod-db/`), two new gitignored files under `backend/prisma/prod-db/`. |
| **Execution** | **Not started.** No phase (P0–P6) has been run against AWS for prod. |

### Target prod endpoints (per the confirmed no-suffix domain decision, D1)

| What | URL |
|---|---|
| Frontend | `https://miempresa.disruptiveexp.com` |
| Backend API | `https://miempresa-api.disruptiveexp.com` |
| Backend origin (SSH/tunnel entry, once P2 runs) | `miempresa-api-origin.disruptiveexp.com` |

### AWS constants (prod, once provisioned)

| Item | Value |
|---|---|
| Profile / region | `disruptive` / `us-east-1` |
| Instance name (P2) | `miempresa-backend-prod`, bundle `micro_3_0` ($7/mo — exact staging parity, confirmed) |
| CodeDeploy | app `miempresa-app` · group `miempresa-prod` (exists, unused) |
| Amplify | app to be created in P5 (`miempresa-frontend-prod`) |
| Buckets (P1) | `miempresa-artifacts-540657241795-prod`, `miempresa-backups-540657241795-prod`, `miempresa-uploads-540657241795-prod`, `miempresa-frontend-artifacts-540657241795-prod` |
| SSM prefix | `/miempresa/prod/*` (does not exist yet) |
| Founding-account credentials (once P-SEED runs) | `/miempresa/prod/founders/<ADMIN\|CONTRATOS\|GERONTOLOGA\|PROFESOR\|AUXILIAR>/{EMAIL,PASSWORD}` |

---

## 3) Key decisions this session (all confirmed by the developer)

| # | Decision | Why |
|---|---|---|
| D1 | Domain: **no `-prod` suffix** — `miempresa.disruptiveexp.com` (FE) / `miempresa-api.disruptiveexp.com` (API). The original task ask literally said `miempresa-prod.disruptiveexp.com`, but that doesn't match `edge-stack.yml`/`amplify-stack.yml`'s existing `IsProd` conditional (prod = no suffix, only staging gets `-stg`). Developer chose to follow the existing template pattern instead of the literal ask, with an explicit instruction to double-check the never-before-exercised `IsProd` branch — done, see §5.1. |
| D2 | Empresa seed data sourced **live from the staging DB** (queried via SSH, not assumed from memory) — still the original `prisma/seed.ts` placeholder (`Mi Empresa S.A.S.` / `900123456-1` / `Calle 100 # 15-20, Bogotá`), no admin has edited it on staging. Developer's explicit call: seed prod with it anyway; **ADMIN Paola Segovia corrects any wrong field via `/empresa/editar` after first login** — that's the intended correction path, not a script re-run. |
| D3 | **Seed-once safety, no bypass.** The prod foundation seed must never overwrite real user data. Implemented as an unconditional refusal (no `FORCE_*` flag) the moment `empresas` OR `usuarios` has any row — see §4. |
| D4 | Lightsail bundle: `micro_3_0` ($7/mo), exact staging parity — developer explicitly chose cost-minimalism over the original v2 plan's `small_3_0` headroom recommendation, citing "8 users is very light load." |
| D5 | Cargos catalog: **10-name list confirmed final** — `Administrador`, `Artes y Manualidades`, `Auxiliar de Enfermería`, `Educador Físico`, `Fisioterapeuta`, `Gerontólogo/Gerontóloga`, `Psicólogo`, `Servicios Generales`, `Temporal`, `Terapeuta Ocupacional`. Sourced from staging's live `cargos_empresa` table, minus 3 QA-test-residue rows. Developer asked to drop any `Aseo`/`Conserje` duplicates of `Servicios Generales` — none existed in the curated list, so no removal was needed. |
| D6 | Founding-account emails: **fixed, not prompted** — reuse the existing `qa-*@miempresa.com` pattern minus the `qa-` prefix: `admin@`, `contratos@`, `gerontologa@`, `profesor@`, `auxiliar@miempresa.com`. |

---

## 4) Prod foundation seed — delivered this session (not just designed)

Two **gitignored** files at `backend/prisma/prod-db/` (added to `.gitignore` this session — verify the directory still exists if resuming on a different checkout/machine, since it never syncs via git):

- **`seed-prod-foundation.ts`** — creates 1 empresa + 5 named users + 10 cargos. Hard-refuses (no override) if `empresas` or `usuarios` already has any row — this is D3's actual implementation. Also refuses if `DATABASE_URL` doesn't look like prod. Never deletes anything. Emails default to the D6 pattern via `envOr()`; passwords are always required via env var (`requireEnv()` — never hardcoded). Does **not** touch `instrumentos`/`centros_costos` — those are handled separately (see below), avoiding duplicate seed logic.
- **`seed-prod.sh`** — orchestrator: interactive typed-confirmation gate (`seed prod foundation`), ensures the 5 SSM credential pairs exist under `/miempresa/prod/founders/*` (email fixed per D6, password generated once via `openssl rand`), opens an SSH tunnel to the prod DB, runs the TS seed, then runs `FORCE_UPGRADE=true npm run instruments:upgrade`.

**Two things this seed deliberately does NOT do**, because better mechanisms already exist:
1. **Instrument catalog** — use `scripts/instruments-upgrade.ts` (already existing, project-wide tool, safe to re-run forever). It auto-discovers every `prisma/instrument-templates/*.v{n}.json` file and activates the highest version per codigo. As of this session that's 9 dynamic codigos (BARTHEL, MINI_MENTAL, TINETTI v5, YESAVAGE, MNA_CUADRO v2, FICHA_NUTRICIONAL, VALORACION_INTEGRAL, SIGNOS_VITALES v2, BOLETIN_ANUAL v2). **Open question carried into P-SEED**: whether the 3 legacy placeholder codes (`FVM-001`/`NUT-001`/`ADM-001`, not template-backed) should also exist in prod — flagged in the plan, not yet decided.
2. **`centros_costos` catalog** — needs zero manual seeding. `src/server.ts` calls `seedCentrosCostos()` unconditionally and idempotently on every server boot — it self-populates the instant P3's `pm2 start` runs.

Both prod-db files were syntax/type-checked during this session (`bash -n`, `tsc --noEmit -p tsconfig.json` against the project's real tsconfig) — clean.

---

## 5) Insights, learnings, patterns (the point of this file)

### 5.1 — A template's untested conditional branch is a real risk, not a formality
`edge-stack.yml` and `amplify-stack.yml` both have an `IsProd` condition that has **existed in code since the original v2 infra design but never actually been exercised** — every prior deploy in this repo's history passed `Environment=staging`. The developer explicitly called this out and asked for independent verification rather than trusting template symmetry. Method used: **trace every `!If [IsProd, X, Y]` usage across both templates by hand** (6 in edge-stack, 4 in amplify-stack), confirm each resolves to the same domain literal within its template, then cross-check backend↔frontend agreement (CORS_ORIGIN must equal the frontend's AppUrl; API_BASE must equal the backend's actual public URL). This caught two real bugs (5.2) that a "just read it once" pass had missed on the first draft of the plan.

### 5.2 — A prod branch that's just an `else` is a silent trap
`deploy-infrastructure.sh`'s CORS_ORIGIN logic was `if staging ... else <hardcoded value>` — the `else` was clearly meant for "everything that isn't staging," but the actual literal (`https://app.disruptiveexp.com`) was copy-pasted from some other project's domain and never updated. Because CloudFormation deploys are always overridable via `--parameter-overrides`, this kind of bug **never breaks staging** (staging has its own branch) and would only surface the first time someone actually ran `--stage prod` — i.e., exactly now, on a genuinely new path with no precedent to compare against. Same shape of bug, same fix pattern, found independently in the S3 bucket's `UploadsCorsAllowedOrigins` (only had a `dev` override, no `prod` one). **Fix applied**: explicit `elif` branches for `prod` in both places, backed by one shared `PROD_FRONTEND_URL` variable instead of two separately-typed literals — eliminates the class of bug (a future third stage or a domain change now has exactly one place to edit per script).

### 5.3 — Read the live data before trusting what a runbook says the data is
An earlier runbook (aug-28, same day) recorded staging's empresa row as `Mi Empresa S.A.S.` from a prior read. Rather than reusing that recorded value for the prod seed's design, this session **re-queried the live staging DB via SSH** as part of applying the developer's D2 instruction ("read the staging DB to get that data from there"). It returned the identical value — confirming no admin edit had happened since — but the distinction matters: a runbook is a point-in-time snapshot, and "the plan says X" is not the same claim as "X is still true." Same principle applied to the cargos catalog (queried live, found 13 rows including 3 unexpected QA-test rows the developer hadn't mentioned) and to the AWS account state generally (§2 was a fresh read, not reused from the staging rollout's original Phase-1 log).

### 5.4 — A "run once, never overwrite" seed script needs an *unconditional* guard, not a flag
Every other seed/reset utility in this repo (`prisma/seed.ts`, `reset-staging-db.sh`, `instruments-upgrade.ts`) uses a `FORCE_*` env var to bypass its safety check when the operator really means it. The prod foundation seed **deliberately has no such bypass** — `seed-prod-foundation.ts` refuses the moment `empresas`/`usuarios` has any row, full stop. This was an explicit requirement from the developer ("the seed must NOT be applied if it overrides user data... prod seed is different and only designed to be applied once"), not a default judgment call — worth preserving if this script is ever touched again: adding a `FORCE_SEED_PROD` escape hatch would defeat the entire point of the design.

### 5.5 — Business-catalog data (cargos, empresa data) belongs in "confirm with a human," not "infer and ship"
The cargos list and empresa fields were both **inferred from staging's live data**, not stated directly by the developer at any point. Both were explicitly surfaced back to the developer for confirmation before being treated as final (D2, D5) — and one of the two rounds of confirmation (cargos) resulted in "actually fine as-is, no `Aseo`/`Conserje` duplicates existed" rather than a change. The lesson isn't "always ask" (that would be excessive for e.g. a bundle-size default) — it's that **evidence inferred from a live system, when it will become permanent real-world data** (a real company's org chart, a real company's legal name/NIT), crosses the threshold where a confirmation round is worth the friction, even when the inference turns out correct.

### 5.6 — Consent-gated read-only AWS checks are cheap and worth doing before finalizing a plan
This session asked for and received one-time consent to run a batch of read-only `describe`/`list`/`get` calls (CFN stacks, Lightsail instances, CodeDeploy groups/deployments, Amplify apps, SSM param names, Route 53 records) plus one read-only SSH `SELECT` against staging, all stated explicitly before execution. The result (§2) turned "the plan assumes prod doesn't exist yet" into "confirmed: prod doesn't exist yet, here's the exact evidence" — a stronger claim for near-zero additional risk, since every command was non-mutating and pre-approved as a batch rather than probed stack-by-stack without consent.

---

## 6) Referenced files (full list, for a fresh session)

**Plan (primary reference)**
- `context/implementation-plan/prod-deployment-plan.md` — the actual runbook, read this first.

**New, gitignored (prod-only, real data — verify presence before assuming they exist)**
- `backend/prisma/prod-db/seed-prod-foundation.ts`
- `backend/prisma/prod-db/seed-prod.sh`

**Modified this session (tracked, part of the working tree)**
- `backend/infrastructure/db/scripts/deploy-infrastructure.sh` — domain-consistency fixes (§5.2).
- `.gitignore` — added `backend/prisma/prod-db/`.

**Source runbooks analyzed to build the plan** (all in `context/implementation-plan/`)
- `backend-lightsail-deployment-runbook.md` — original staging provisioning execution log, 18 numbered bugs (B1–B18) fixed along the way.
- `backend-lightsail-infrastructure-cloudformation-v2.md` — the audited/corrected infra design (architecture diagram, stack table, bug ledger by ID).
- `staging-release-jul17-runbook.md` — full R0–R6 destructive-release pattern (DB hard reset + S3 wipe precedent — **explicitly NOT applicable to prod**, no prod equivalent should ever exist).
- `staging-release-jul11-fixes-runbook.md` — a zero-migration code-only release, shows the lighter-weight R0/R2/R3/R4/R5 shape.
- `staging-release-qa-aug-27-contratos-editar-runbook.md` — another code-only release precedent.
- `staging-release-aug28-recibo-impresion-runbook.md` — most recent staging release (same day as this planning session), backend `d-FZP4YFCEL` / Amplify job 21 / 32 migrations.

**Unmodified reference files read during planning** (paths worth knowing for the actual P1–P6 execution)
- `backend/infrastructure/db/cloudformation/{iam,s3,ssm-parameters,codedeploy,edge}-stack.yml`
- `backend/infrastructure/db/scripts/{create-instance,after-install,before-install,start-service,stop-service,validate,env,refresh-credentials,reset-staging-db}.sh`
- `backend/infrastructure/db/templates/user-data-postgresql.sh`
- `backend/infrastructure/db/utilities/{db-tunnel,set-env,ssh-to-instance,validate-instance,get-instance-ip,install-ssh-key,check-credentials}.sh`
- `frontend/infrastructure/cloudformation/amplify-stack.yml`
- `frontend/infrastructure/scripts/{deploy-infrastructure,deploy-frontend}.sh`
- `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`, `backend/scripts/instruments-upgrade.ts`, `backend/prisma/instrument-templates/*.v{n}.json`
- `backend/prisma/test-db/{seed-qa,create-users}.ts` + `{seed-qa-staging,create-users-staging,get-qa-creds}.sh` — the staging QA pattern the prod P6 phase reuses (dual-mode env-var-driven specs).
- `backend/src/config/env.ts` (CORS handling — confirmed single source, no hardcoded domains), `frontend/nuxt.config.ts` (confirmed localhost-only dev default, no hardcoded domains).

---

## 7) Pending / not done — what a resumed session should do next

**Nothing has been executed against AWS for prod.** In order, per the plan's §10 sequencing:

1. **P0** — re-run the read-only preflight (§0 bootstrap commands above) to confirm the account state hasn't changed since 2026-08-28.
2. **P1** — foundation stacks (`deploy-infrastructure.sh --stage prod`). Requires explicit "yes, proceed." Will create `miempresa-s3-prod` and `miempresa-ssm-prod` (new); `miempresa-iam` and `miempresa-codedeploy` are no-op updates (already exist, global).
3. **P2** — Lightsail instance (`create-instance.sh --stage prod --bundle micro_3_0`). Explicit approval. Re-verify the B16 credential round-trip (two consecutive manual refresh cycles) on the prod instance specifically — don't assume "it worked on staging" transfers.
4. **P3** — first backend deploy (build from the current working tree, per this repo's established convention — see the plan's §6 "Deploy source decision" for the reasoning, and confirm with the developer if a clean-tag release is preferred for this specific first prod release instead).
5. **P4** — edge stack (DNS+TLS). **First real exercise of the `IsProd` branch** — verify the rendered domain literals directly via `describe-stacks`, not just by assuming symmetry with staging.
6. **P5** — frontend (Amplify). Same first-exercise caveat for `amplify-stack.yml`'s `IsProd` branch.
7. **P-SEED** — run `seed-prod.sh` once, after P3 (needs the DB) and ideally after P4/P5 (so the founding ADMIN can log in immediately to correct empresa data per D2). **Two open items remain here** (not blocking, just unresolved): (a) whether the 3 legacy instrument placeholder codes should exist in prod, (b) the ~3 additional users beyond the 5 named founders — explicitly out of scope for the seed, to be added later via the ADMIN's own Usuarios UI.
8. **P6** — QA, reusing the dual-mode staging specs pointed at prod URLs + the 5 founder SSM credentials, plus a new stricter "prod residue" check (no QA-created records left behind — stricter than the staging convention, per the plan).

No commit has been made this session (only working-tree edits, per standing policy). Confirm with the developer whether to commit the `deploy-infrastructure.sh` fix + `.gitignore` change before or as part of P1.
