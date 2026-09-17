# Production Deployment Plan — Mi Empresa (backend + frontend + infrastructure)

**Status**: PLAN — not started. Every phase requires explicit "yes, proceed" before any AWS-mutating command (per standing prod-safety rule).
**Prepared**: 2026-08-28. **Account**: `540657241795` · **Profile**: `disruptive` · **Region**: `us-east-1` (must be passed explicitly — profile has no default region).

**Sources analyzed**: `backend-lightsail-deployment-runbook.md`, `backend-lightsail-infrastructure-cloudformation-v2.md`, `staging-release-jul17-runbook.md`, `staging-release-jul11-fixes-runbook.md`, `staging-release-qa-aug-27-contratos-editar-runbook.md`, `staging-release-aug28-recibo-impresion-runbook.md`, plus a live read of every `backend/infrastructure/**` script/template, `backend/prisma/{seed.ts,schema.prisma}`, `scripts/instruments-upgrade.ts`, and `backend/prisma/test-db/*`.

**Read-only AWS state check performed 2026-08-28** (profile `disruptive`, region `us-east-1` — nothing mutated): confirmed the account is a **clean slate for prod**:
- No `miempresa-*-prod` / `miempresa-s3-prod` / `miempresa-ssm-prod` / `miempresa-edge-prod` / `miempresa-frontend-prod` CloudFormation stacks exist.
- No Lightsail instance or static IP named `*-prod` exists (only `miempresa-backend-staging` @ `54.144.25.72`, running).
- CodeDeploy application `miempresa-app` already has a `miempresa-prod` deployment group (created by the global `miempresa-codedeploy` stack in Phase 1 of the staging rollout) — **zero deployments have ever run against it**.
- No `/miempresa/prod/*` SSM parameters exist.
- No Route 53 records under `disruptiveexp.com` reference anything other than `-stg`/`-origin-stg`.
- No Amplify app for `miempresa-frontend-prod` exists.

This means **every prod phase below is a true first deployment** — there is nothing to reconcile or clean up first.

---

## 1. Decisions confirmed with the developer (2026-08-28)

| # | Question | Decision |
|---|---|---|
| D1 | Domain naming | **Follow the existing template pattern exactly** (no code changes needed): frontend `https://miempresa.disruptiveexp.com`, backend API `https://miempresa-api.disruptiveexp.com`. The `-prod` suffix mentioned in the original task ask is **not** used — it doesn't match `edge-stack.yml`/`amplify-stack.yml`'s `IsProd` conditional (`IsProd` ⇒ *no* suffix; only staging gets `-stg`). **The developer explicitly flagged that the `IsProd` branch has never been exercised in production before (staging-only history) — Phase P4/P5 must independently verify both conditional branches render correctly, not just assume the template is correct.** |
| D2 | Empresa seed data | Sourced live from the staging DB on 2026-08-28 (`SELECT nombre, nit, direccion, telefono, email FROM empresas`) — currently `Mi Empresa S.A.S.` / `900123456-1` / `Calle 100 # 15-20, Bogotá` / `6014567890` / `info@miempresa.com`. **This is the same placeholder `prisma/seed.ts` originally wrote and no admin has edited it on staging.** Developer confirmed: seed prod with these values anyway; **ADMIN (Paola Segovia) will correct any wrong field via the app's own `/empresa/editar` screen after first login** — this is the intended correction path, not a script re-run. |
| D3 | Seed script re-run safety | **Critical, explicit requirement**: "the seed must NOT be applied if it overrides user data" — the prod foundation seed **only ever runs once, against an empty DB**, and hard-refuses (no bypass flag) the moment `empresas` or `usuarios` has any row. See §5. |
| D4 | Lightsail bundle | `micro_3_0` ($7/mo) — exact staging parity, confirmed by developer ("use the exact staging setup to keep cost low", 8 users is light load). |
| D5 | AWS read-only preflight | Approved and executed (see account-state summary above). |

**Cargos catalog — UPDATED 2026-09-10**: `Servicios Generales` is **not** seeded. Replaced by `Auxiliar` (Yeny / Daissy). Canonical 10 + 5 roster names live in `catalog-snapshot.ts` / `DEFAULT_CARGOS` and are applied by `sync-prod-catalog.ts`.

**Founding-account emails — CONFIRMED FINAL (developer decision, 2026-08-28), scope reduced 2026-08-31**: reuse the existing `qa-*@miempresa.com` pattern minus the `qa-` prefix — `admin@miempresa.com`, `contratos@miempresa.com`, `gerontologa@miempresa.com`. Baked into `seed-prod.sh` as fixed defaults (§5) — no interactive prompt, no guessed domain. **`profesor@`/`auxiliar@` generic placeholder accounts are explicitly OUT of scope (developer decision, 2026-08-31)** — the client will name specific real profesores/auxiliares hires; ADMIN creates those accounts individually via the Usuarios UI once known, not from a seed script.

## 2. Open items — confirm before running Phase P-SEED (not blocking for P0–P5)

1. **Staff accounts**: 12 people in `employee-roster.ts` with approved placeholders (DOB 1990-01-01, INDEF, valorMensual=1, emails `{nombre}.{apellido}@miempresa.com`). Seeded by `seed-prod-staff.sh` after catalog. Replace real values via UI later.
2. **Prod catalog sync tool is BUILT (2026-09-10)** — `sync-prod-catalog.ts` + `sync-prod-catalog.sh`. Snapshot: EMKASA, 15 cargos (`Auxiliar` not `Servicios Generales` + 5 roster names), 14 centros + 2 prices.
3. Empresa email still `info@miempresa.com` (placeholder). ADMIN can correct via `/empresa/editar`.

---

## 3. Target architecture (identical shape to staging, `--stage prod`)

```
                      https://miempresa.disruptiveexp.com        (frontend)
                              │
                        Amplify app miempresa-frontend-prod
                        (manual deploy, no Git — same as staging)
                              │ XHR (CORS: exact-origin)
                              ▼
                      https://miempresa-api.disruptiveexp.com     (backend)
                              │
                      CloudFront dist (ACM cert, x-origin-verify header)
                              │ HTTP :3001 (origin, plain HTTP by design)
                      ┌───────▼─────────────────────────────┐
   miempresa-api-origin.disruptiveexp.com → static IP        │
                      │  Lightsail  miempresa-backend-prod    │
                      │  micro_3_0 ($7/mo) · amazon_linux_2023│
                      │  ├── postgresql (systemd, tuned)      │
                      │  │     DB miempresa_prod              │
                      │  ├── miempresa-api (PM2, ec2-user)     │
                      │  ├── codedeploy-agent + STS refresh    │
                      │  └── cron: */45 refresh, 02:00 backup  │
                      └────────────────────────────────────────┘
DB access: SSH tunnel only (5432 never public) — utilities/db-tunnel.sh --stage prod
```

### Cost

| Item | Monthly |
|---|---|
| Lightsail `micro_3_0` (incl. static IP while attached) | $7.00 |
| CloudFront (low traffic, 8 users) | ~$0–1 |
| S3 (backups + artifacts + uploads, low volume) | ~$0.25 |
| Amplify hosting (static, manual deploy) | ~$0–1 |
| ACM cert, SSM standard params, Route 53 records | $0 |
| **Total prod** | **~$8–9/month** |

---

## 4. Phased runbook (mirrors the proven staging pattern exactly, `--stage prod`)

Every phase ends with a verification block. Every AWS-mutating command requires an explicit "yes, proceed" first — no autonomous execution for prod, per the standing safety rule (unlike the staging precedent where autonomous continuation was authorized after Phase 1).

### Phase P0 — Preflight (read-only, no mutations)

- Re-run the account-state checks from the header (stacks, instances, CodeDeploy, SSM, Route 53) immediately before starting, in case time has passed since this plan was written.
- `git rev-parse HEAD`; record the exact commit + dirty-file count that will be shipped (see §6 — Deploy source decision).
- `cd backend && npx tsc --noEmit` clean.
- `cd backend && npx prisma migrate status` — confirm local migration count (**32** as of 2026-08-28) and "up to date."
- Confirm `backend/prisma/prod-db/seed-prod-foundation.ts` + `seed-prod.sh` exist and pass `bash -n` / `tsc --noEmit -p tsconfig.json` (already done while writing this plan — see §5).
- Local `curl http://localhost:3101/api/v1/health` → 200 (sanity only).

### Phase P1 — Foundation stacks (IAM, S3, SSM, CodeDeploy)

```bash
cd backend/infrastructure/db/scripts
./deploy-infrastructure.sh --stage prod --region us-east-1 --profile disruptive
```

**What this touches**:
- `miempresa-iam` — **global**, already exists (from staging rollout); `cloudformation deploy` is a no-op update (`--no-fail-on-empty-changeset`). No new resources.
- `miempresa-codedeploy` — **global**, already exists; also a no-op update. The `miempresa-prod` deployment group it manages already exists (confirmed P0), unused until P3.
- `miempresa-s3-prod` — **NEW**: creates `miempresa-artifacts-540657241795-prod`, `miempresa-backups-540657241795-prod`, `miempresa-uploads-540657241795-prod` (all BlockPublicAccess + SSE-S3; backups 30-day lifecycle on `daily/` prefix; uploads bucket CORS **now correctly set to `https://miempresa.disruptiveexp.com` — fix applied in §7**, `deploy-infrastructure.sh` passes an explicit `UploadsCorsAllowedOrigins` override for `STAGE=prod`, no manual override needed at run time).
- `miempresa-ssm-prod` — **NEW**: ~20 params under `/miempresa/prod/{db,api}/*`. `CORS_ORIGIN` **now correctly resolves to `https://miempresa.disruptiveexp.com`, `LOG_LEVEL=info` — fix applied in §7**, no manual override needed at run time.
- `JWT_SECRET` / `SESSION_SECRET` / `ORIGIN_VERIFY_SECRET` freshly generated via `openssl rand` — **independent secrets from staging**, never shared.

**Verify**: 4 stacks show `CREATE_COMPLETE` (`miempresa-s3-prod`, `miempresa-ssm-prod`) or `UPDATE_COMPLETE`/unchanged (`miempresa-iam`, `miempresa-codedeploy`); `aws ssm get-parameters-by-path --path /miempresa/prod/ --recursive` lists the new params; 3 new buckets exist; `CORS_ORIGIN` param value is the corrected prod frontend URL, not the stale `app.disruptiveexp.com` template default.

### Phase P2 — Lightsail instance

```bash
cd backend/infrastructure/db/scripts
./create-instance.sh --stage prod --bundle micro_3_0 --profile disruptive
```

Identical bootstrap sequence proven on staging (all 18 staging-era bugs B1–B18 already fixed in this script — see §8 learnings ledger): 2GB swap, native AL2023 PostgreSQL 15 (`postgresql-setup --initdb`, NOT the PGDG layout), CodeDeploy agent + stable-session-name STS registration, bootstrap credentials pushed to `/root/.aws`, cron (`*/45` refresh, `02:00` backup), firewall `22`+`3001` open / `5432` closed, static IP `miempresa-ip-prod` allocated and attached.

**Verify**: instance `miempresa-backend-prod` running; `/var/log/user-data.log` ends with the completion marker; `[bootstrap]` profile present and round-trips across two refresh cycles (the B16 time-bomb check — confirm explicitly, don't just trust one refresh); on-instance identity = `assumed-role/CodeDeployInstanceRole/miempresa-backend-prod`; `DB_PASSWORD`/`DATABASE_URL` in SSM are real values, not `PLACEHOLDER`; CodeDeploy on-premises registration succeeds and is tagged `Environment=prod`.

### Phase P3 — First backend deployment

```bash
cd backend
npm ci && npx prisma generate && npm run build
cp infrastructure/db/appspec.yml ./appspec.yml
zip -r /tmp/miempresa-prod-$(date +%Y%m%d-%H%M%S).zip \
  appspec.yml dist prisma package.json package-lock.json \
  infrastructure/db/scripts infrastructure/db/utilities \
  -x "*.log" -x "*/generated/*"
aws s3 cp /tmp/miempresa-prod-*.zip s3://miempresa-artifacts-540657241795-prod/deployments/ --profile disruptive --region us-east-1
aws deploy create-deployment \
  --application-name miempresa-app --deployment-group-name miempresa-prod \
  --s3-location bucket=miempresa-artifacts-540657241795-prod,key=deployments/<key>,bundleType=zip \
  --profile disruptive --region us-east-1
aws deploy wait deployment-successful --deployment-id <id> --profile disruptive --region us-east-1
```

**Hard rule, non-negotiable**: `--deployment-group-name miempresa-prod` — never let this default or typo to `miempresa-staging`. **Double-check `src/generated/prisma/` is excluded from the zip** (B-lesson from the aug-28 recibo release: shipping the local macOS arm64 native client bloats the artifact 40× and is architecturally wrong for the Linux instance, which regenerates its own via `after-install.sh`).

This deploys the **32 local migrations** (`prisma migrate deploy` inside `after-install.sh`) against the **brand-new, empty** `miempresa_prod` database — i.e. this single deploy both installs the schema AND the application code. No destructive step is possible here (empty DB, forward-only migrations).

**Verify**: deployment `Succeeded`; on-instance `npx prisma migrate status` → "32 migrations found... up to date"; `pm2 jlist` → `miempresa-api online`; `curl http://<prod-IP>:3001/api/v1/health` → 200; `curl -X POST .../auth/login` without `x-origin-verify` → 403 (origin hardening live before DNS/TLS even exists); reboot test (`aws lightsail reboot-instance`) → API back online within 2 min, all 4 services (`postgresql`, `codedeploy-agent`, `crond`, `pm2-ec2-user`) active.

### Phase P4 — Edge (DNS + TLS, backend)

```bash
OVS=$(aws ssm get-parameter --name /miempresa/prod/api/ORIGIN_VERIFY_SECRET --with-decryption --profile disruptive --region us-east-1 --query Parameter.Value --output text)
aws cloudformation deploy --template-file backend/infrastructure/db/cloudformation/edge-stack.yml \
  --stack-name miempresa-edge-prod \
  --parameter-overrides Environment=prod StaticIp=<prod-IP> OriginVerifySecret="$OVS" \
  --profile disruptive --region us-east-1
```

Creates: ACM cert for `miempresa-api.disruptiveexp.com` (DNS-validated, same hosted zone `Z05031231XC6MYR0M5LX`), CloudFront distribution, Route 53 `A miempresa-api-origin.disruptiveexp.com → prod IP` and `A miempresa-api.disruptiveexp.com → CloudFront (alias)`.

**This is the first real-world exercise of the `IsProd` conditional branch in `edge-stack.yml`** (every prior run used `Environment=staging`). Verify explicitly, don't assume symmetry with staging:
- `aws cloudformation describe-stacks --stack-name miempresa-edge-prod` → both `OriginRecord.Name` and `ApiAliasRecord.Name`/`ApiCertificate.DomainName` resolve to the **no-suffix** prod form (`miempresa-api-origin.disruptiveexp.com`, `miempresa-api.disruptiveexp.com`), not `miempresa-api-origin-.disruptiveexp.com` or similar malformed `!If` output.
- `dig miempresa-api-origin.disruptiveexp.com` → prod static IP.
- `curl https://miempresa-api.disruptiveexp.com/api/v1/health` → 200, valid TLS.
- Direct `curl http://<prod-IP>:3001/api/v1/<non-health-path>` without the header → 403 (confirms CloudFront is the only public path in).

### Phase P5 — Frontend (Amplify)

```bash
cd frontend/infrastructure/scripts
./deploy-infrastructure.sh --stage prod --region us-east-1 --profile disruptive
./deploy-frontend.sh --stage prod --region us-east-1 --profile disruptive
```

`deploy-infrastructure.sh` creates `miempresa-frontend-prod` (Amplify app, manual-deploy, no repository), `miempresa-frontend-artifacts-540657241795-prod` bucket (ACL-enabled `ObjectWriter` — required for S3-sourced Amplify deploys), and `/miempresa/prod/frontend/{API_BASE,APP_URL}` SSM params. **Also the first real exercise of `amplify-stack.yml`'s `IsProd` branch** — verify the `SubDomainSettings[0].Prefix` resolves to `'miempresa'` (no suffix), not `'miempresa-stg'` or empty.

`deploy-frontend.sh` builds (`nuxt generate` with `NUXT_PUBLIC_API_BASE` baked in from the SSM param — must read `https://miempresa-api.disruptiveexp.com/api/v1`), zips `.output/public` **contents** (not the folder), uploads, `amplify start-deployment`.

**Verify**: `AmplifyDomain` association walks `AWAITING_APP_CNAME → PENDING_DEPLOYMENT → AVAILABLE` (~4 min, hands-off per the staging precedent since the zone is in the same account); `https://miempresa.disruptiveexp.com/` → 200, valid TLS; SPA fallback on a deep route (e.g. `/empleados`) → 200; served bundle's baked-in `apiBase` grep-matches `miempresa-api.disruptiveexp.com/api/v1`; CORS preflight from the prod frontend origin → 204 with the exact origin echoed. **This requires `/miempresa/prod/api/CORS_ORIGIN` to already be correct from P1** — if it was left at the stale `app.disruptiveexp.com` default, fix it now via `utilities/set-env.sh --stage prod CORS_ORIGIN https://miempresa.disruptiveexp.com --restart` before this check can pass.

### Phase P-SEED-USERS — Prod login accounts (run once, after P3 and before real users log in)

See §5 for full design. Summary:

```bash
cd backend/prisma/prod-db
./seed-prod.sh --profile disruptive --region us-east-1
```

Creates: 3 named users (ADMIN Paola Segovia + CONTRATOS + GERONTOLOGA — PROFESORES/AUXILIARES intentionally not created, see §1/§2), then `FORCE_UPGRADE=true npm run instruments:upgrade` to populate every instrument codigo at its highest template version (currently 9 dynamic codigos: BARTHEL, MINI_MENTAL, TINETTI v5, YESAVAGE, MNA_CUADRO v2, FICHA_NUTRICIONAL, VALORACION_INTEGRAL, SIGNOS_VITALES v2, BOLETIN_ANUAL v2 — plus the 3 legacy placeholder codes are **not** created by this path since they're not template-backed; confirm with the developer whether `FVM-001`/`NUT-001`/`ADM-001` should exist in prod or are dead legacy code that can stay absent).

`centros_costos` **names** need no manual step — `src/server.ts` calls `seedCentrosCostos()` unconditionally and idempotently on every boot, so the 14 base rows self-populate the moment P3's `pm2 start` runs. Their `precioUnitario` **overrides**, plus `empresa` and `cargos_empresa`, are **not** created by this phase — see Phase P-SEED-CATALOG below.

**Verify**: `SELECT count(*) FROM usuarios` = 3, `centros_costos` = 14 (names only, from the boot auto-seed), `instrumentos_versiones WHERE activo=true` = 9; `SELECT count(*) FROM empleados/clientes/certificados_empresa/nominas/asistencia_empleado/registros_fichas_completadas` = **0 everywhere** (confirms "prod starts empty" held); each of the 3 accounts logs in successfully via `POST /api/v1/auth/login`.

### Phase P-SEED-CATALOG — Prod catalog data (empresa, cargos, centros) — **tool built 2026-09-10**

```bash
cd backend/prisma/prod-db
./sync-prod-catalog.sh --profile disruptive --region us-east-1 --empresa --cargos --centros
```

Idempotent. Confirmation phrase: `sync prod catalog`. Snapshot: EMKASA / 15 cargos / 14 centros + 2 prices. Does **not** copy staging extra centro `Transporte por dia`, does **not** copy ítems, does **not** flip `habilitarRecibo`.

**Verify**: `empresas` = 1 (EMKASA, NIT 3352434-8); `cargos_empresa` = 15; `centros_costos` = 14; `precio_unitario` set on Mensualidades completas (1,500,000) and Valoraciones (70,000).

### Phase P-SEED-STAFF — 12 empleados + AUXILIARES logins (placeholders 2026-09-10)

```bash
cd backend/prisma/prod-db
./seed-prod-staff.sh --profile disruptive --region us-east-1
```

Confirmation phrase: `seed prod staff`. Idempotent by `numeroDocumento`. Requires founders + catalog first. Paola ADMIN is linked, password unchanged. 11 AUXILIARES passwords in `/miempresa/prod/staff/<slug>/PASSWORD`.

Placeholders (replace via UI later): DOB `1990-01-01`, `TERMINO_INDEFINIDO`, `valorMensual=1`, emails `{nombre}.{apellido}@miempresa.com`.

**Verify**: `empleados` = 12, `contratos` where activo = 12, `usuarios` = 14 (3 founders + 11 staff). ADMIN `empleadoId` set.

### Phase P6 — Post-deploy QA (adapt the existing dual-mode suites)

Reuse the same dual-mode (`TEST_API_URL`/`TEST_FRONTEND_URL`/env-var-credential) Playwright specs already proven against staging — they need zero code changes, only different env vars pointed at `https://miempresa-api.disruptiveexp.com` / `https://miempresa.disruptiveexp.com` and the 5 real prod credentials from SSM `/miempresa/prod/founders/*`:

- `backend/tests/rbac/domain-access.spec.ts` + `qa-profiles-five.spec.ts` — role/permission matrix, including the aug-28 `GET /empresa` public-subset fix.
- `backend/tests/centro-costos/ocultar-beneficiario.spec.ts` — Valoraciones flag.
- `frontend/tests/centro-costos/ocultar-beneficiario-empresa-ui.spec.ts` — live-SPA UI check.
- A **new prod-only smoke check** (write before P6, small): log in as each of the 5 founding accounts, hit one role-appropriate endpoint each, confirm the operational tables enumerated above are still all zero except the 5 users + empresa + cargos + centros + instrument catalog (i.e. QA itself must not leave residue in prod the way it's tolerated on staging — no test items, no manual toggles left flipped). Any QA-created record must be deleted in a `finally` block; this is stricter than the staging convention.

**Do not** run `reset-staging-db.sh` or any wipe/reset utility against prod — no prod equivalent of that script exists or should ever exist (explicitly stated in that script's own header as a repo-wide policy).

---

## 5. Prod foundation seed — design (delivered now, not just planned)

Per the "prod db seeding will be on its own directory not committed to github" requirement, files live at `backend/prisma/prod-db/` (gitignored — added `backend/prisma/prod-db/` to `.gitignore`):

- **`seed-prod-foundation.ts`** — **scope reduced 2026-08-31**: creates ONLY 3 login accounts (ADMIN, CONTRATOS, GERONTOLOGA). No longer touches empresa or cargos (moved to §5b). Key safety properties:
  - Refuses unconditionally (no `FORCE_*` bypass) if `usuarios` has any row. This is the direct implementation of D3 — a script that mutates prod exactly once and then permanently disarms itself.
  - Refuses if `DATABASE_URL` doesn't look like prod (must match `/prod/i`, must not match `/staging|dev/i`) — opposite-polarity guard from `prisma/seed.ts`'s staging/prod refusal.
  - Never deletes anything (no `deleteMany` calls anywhere in the file, unlike `prisma/seed.ts`'s dev-only wipe).
  - Email defaults to the fixed `qa-*` -minus-prefix pattern confirmed by the developer (`admin@miempresa.com`, `contratos@miempresa.com`, `gerontologa@miempresa.com`, via `envOr()`, still overridable by env var); **password is always required** via env var (`requireEnv()`) — no password is ever hardcoded or guessed.
  - PROFESORES/AUXILIARES generic accounts intentionally removed 2026-08-31 (see §1/§2) — not a placeholder gap, a deliberate decision.

- **`seed-prod.sh`** — orchestrator mirroring `prisma/test-db/seed-qa-staging.sh`'s proven pattern: interactive typed-confirmation gate (`seed prod foundation`), per-user SSM credential pairs under `/miempresa/prod/founders/<ROLE>/{EMAIL,PASSWORD}` for the 3 accounts (email is the fixed confirmed pattern above, written to SSM on first run, no prompt; password generated once via `openssl rand`), SSH tunnel to the prod DB (port stays closed publicly), runs the TS seed, then runs `instruments:upgrade` (the one catalog entity that's unconditionally safe to auto-run — see §5b for why empresa/cargos/centros are NOT auto-run here).

Both files were syntax/type checked (`bash -n`, `tsc --noEmit -p tsconfig.json`) — clean as of 2026-08-31.

**Why a separate `prod-db/` directory instead of reusing `test-db/`**: `test-db/` scripts (`seed-qa.ts`, `create-users.ts`) are explicitly documented as carrying "weak, publicly-known credentials" intended for staging QA — mixing real prod credentials into that directory would be a category error even before considering git history. The new directory is 100% gitignored (never touches version control, unlike `test-db/` which IS committed since it contains no real secrets, only scripts).

---

## 5b. Prod catalog — replicable entities (DESIGN CONFIRMED 2026-08-31, sync tool NOT YET BUILT)

Developer requirement: a **comprehensive, developer-driven catalog** of everything that should be replicated from staging into prod, separate from the one-shot user seed — "developer determines what to migrate from the catalog, then X/Y are replicated idempotently to production; or entity Y needs an update, and later that's replicated by the developer asking to execute it." Confirmed answers (2026-08-31):

| Design question | Confirmed answer |
|---|---|
| What's in scope | **Everything**: instruments, centro_costos price overrides, cargos, empresa. Foundation seed (§5) shrinks to just the 3 users. |
| Centro_costos capture granularity | **Delta only** — not a full 14-row snapshot. |
| Source of truth at sync time | **Static gitignored data file**, hand-edited, never a fresh live SSH read at sync time. |
| Build this session? | **No** — data capture + design only. The actual sync script is deferred to a future session. |

**Live staging read performed 2026-08-31** (profile `disruptive`, region `us-east-1`, read-only `SELECT` via SSH tunnel to `miempresa-backend-staging`, nothing mutated): `centros_costos` has exactly 14 rows, identical in `nombre`/`tipo`/`orden` to `DEFAULT_CENTROS_COSTOS` in `empresaService.ts` (which already auto-seeds those 14 idempotently on every server boot — nothing to replicate there). `habilitar_recibo` is `false` on every row. The only real business-config delta is 2 `precio_unitario` values an ADMIN set on staging that the auto-seed doesn't know about:

| tipo | nombre | precio_unitario |
|---|---|---|
| INGRESOS | Mensualidades completas | 1,500,000 |
| INGRESOS | Valoraciones | 70,000 |

**Delivered 2026-09-10** (gitignored under `backend/prisma/prod-db/`):
- `catalog-snapshot.ts` — EMPRESA EMKASA, 15 CARGOS, 14 centros + 2 price overrides
- `sync-prod-catalog.ts` + `sync-prod-catalog.sh` — `--empresa --cargos --centros`
- `employee-roster.ts` — 12 people from the client export (data only; seed blocked)

Upsert semantics:
- `EMPRESA` — create if none; otherwise update fields that differ.
- `CARGOS` — `createMany` `skipDuplicates: true`.
- `CENTROS` — `createMany` skipDuplicates for the 14 names, then `updateMany` `precioUnitario` only.

Instruments stay **outside** this tool — `FORCE_UPGRADE=true` in `seed-prod.sh`.

**Staff is a later phase.** Contrato has no `dias`/`jornada` columns (notes only). Empleado create requires `genero` + `fechaNacimiento`. Contrato create requires `tipoContrato` + `valorMensual` (or `valorJornada` if OPS). Usuario login needs unique email + password. None of those are in the 12-row export except Paola's cédula and the ADMIN email.

---

## 6. Deploy source decision

As of this plan, `git rev-parse HEAD` = `e86a0e4`, with **161 modified/untracked files** in the working tree (the accumulated aug-6 through aug-28 feature work, per repo convention of never committing unless explicitly instructed). Every staging release in the analyzed runbooks **built from the working tree**, not from a clean committed state — this is the established, repeatedly-proven pattern (see jul-17, jul-11, aug-27 runbooks, all shipping uncommitted deltas).

**Recommendation for prod's first release**: follow the same convention — build Phase P3's artifact from the current working tree. This is a deliberate departure from a "clean tag" release model, consistent with how this repo has always shipped, and avoids a large, risky commit-everything step as a prerequisite. If you'd prefer a clean commit/tag first for the inaugural prod release specifically, say so before P3 — it's a one-line change to the plan, not a blocker to raise now.

---

## 7. Domain consistency — fixes APPLIED (2026-08-28)

Two script bugs found while reading the infra scripts were fixed directly in `backend/infrastructure/db/scripts/deploy-infrastructure.sh` (not just flagged — applied, syntax-checked `bash -n`, clean):

1. **`CORS_ORIGIN` wrong default for prod.** The non-staging branch hardcoded `https://app.disruptiveexp.com` — a leftover from a template copy, not this project's domain. Fixed: added an explicit `elif [ "$STAGE" == "prod" ]` branch setting `CORS_ORIGIN="${PROD_FRONTEND_URL}"` (`https://miempresa.disruptiveexp.com`), and the fallback `else` now hard-errors instead of silently applying a wrong value for any future third stage.
2. **S3 uploads-bucket CORS missing a prod override.** Only `STAGE=dev` got an explicit `UploadsCorsAllowedOrigins` override; prod would have silently inherited the template's default value, which is **staging's** origin list (`miempresa-stg.disruptiveexp.com` + localhost) — wrong for prod on two counts (staging origins get bucket access; the real prod frontend origin is missing, so browser uploads would 403 on CORS preflight). Fixed: added an explicit `elif [ "${STAGE}" = "prod" ]` branch passing `UploadsCorsAllowedOrigins=https://miempresa.disruptiveexp.com`.
3. Both fixes read from **one new source-of-truth block** at the top of the script (`ROOT_DOMAIN`, `STAGING_FRONTEND_URL`, `PROD_FRONTEND_URL`) instead of re-typing the literal domain string in two places — reduces future drift risk.

Confirmed no other script/template has a stray wrong-domain literal: `grep -rn "app.disruptiveexp.com"` across `backend/` and `frontend/` now returns zero matches; `grep -rn "miempresa-prod\."` (the suffix form from the original task ask) returns zero matches anywhere in code.

### Domain consistency — sanity validation report

Traced every `!If [IsProd, ...]` branch in `edge-stack.yml` (6 usages: origin A-record, ACM cert domain ×2, CloudFront alias, CloudFront origin hostname, public A-record) and `amplify-stack.yml` (4 usages: Amplify custom-domain prefix, API_BASE param, APP_URL param, stack Output), plus cross-checked backend↔frontend domain agreement end-to-end:

| Check | Result |
|---|---|
| `RootDomain` default identical string in both CFN templates | ✓ `disruptiveexp.com` (correct double-e spelling) in both |
| All 6 `edge-stack.yml` `IsProd` branches resolve to the same prod value (`miempresa-api.disruptiveexp.com` / `miempresa-api-origin.disruptiveexp.com`) with no asymmetric branch | ✓ consistent |
| All 4 `amplify-stack.yml` `IsProd` branches resolve to the same prod value (`miempresa.disruptiveexp.com`) with no asymmetric branch | ✓ consistent |
| Frontend `API_BASE` (prod) == backend's actual public URL from `edge-stack.yml` | ✓ both `https://miempresa-api.disruptiveexp.com` (`/api/v1` suffix on the frontend param only, as expected) |
| Backend `CORS_ORIGIN` (prod, post-fix) == frontend `APP_URL`/`AppUrlParameter` (prod) | ✓ both `https://miempresa.disruptiveexp.com` (was mismatched before the §7.1 fix) |
| S3 uploads-bucket CORS origin (prod, post-fix) == real prod frontend origin | ✓ `https://miempresa.disruptiveexp.com` (was staging's origin list before the §7.2 fix) |
| Backend `src/config/env.ts` CORS handling reads only from the `CORS_ORIGIN` env var (no separate hardcoded domain list in application code) | ✓ confirmed, single source |
| Frontend `nuxt.config.ts` `apiBase` is a localhost dev default only, always overridden at build time via `NUXT_PUBLIC_API_BASE` from SSM `frontend/API_BASE` | ✓ confirmed, no hardcoded prod domain in code |
| DB tier requires any external domain/URL | **N/A by design** — `DB_HOST=localhost` regardless of stage (DB is only ever reached via SSH tunnel or from the co-located API process); correctly assumed out of scope |

**No further findings.** Domain naming is now consistent end-to-end across CloudFormation (backend edge + frontend Amplify), SSM parameters, backend CORS, S3 bucket CORS, and the frontend's build-time API base — all resolve to `miempresa.disruptiveexp.com` (frontend) / `miempresa-api.disruptiveexp.com` (backend) for prod, `miempresa-stg...` for staging, with a single literal source per script/template and no asymmetric conditional branches.

---

## 8. Learnings ledger carried forward from staging (already fixed in the scripts P1–P5 will run)

All of the following were staging-era bugs, already fixed in the current `backend/infrastructure/**` scripts — listed here so P2/P3 verification steps know exactly what "already proven not to recur" looks like, and what to double-check anyway since prod is the first independent run:

- **B1** `micro_2_0` bundle retired → scripts default to `micro_3_0`.
- **B2/B3** bootstrap credential chicken-and-egg + unstable STS session name → `create-instance.sh` pushes `[bootstrap]` creds to the instance and registers with a stable `--iam-session-arn`.
- **B4** `envsubst` single-pass template injection → replaced with an explicit `export STAGE=...` header + `jq`-built JSON payload.
- **B7** PM2 boot persistence mismatch (root vs ec2-user) → all `pm2` commands run as `ec2-user`.
- **B9** Prisma client path (`dist/generated` vs `dist/src/generated`) → fixed to match `tsconfig rootDir: src`.
- **B10/B18** `appspec.yml` must be at the zip root, and must have zero overlapping `permissions` entries.
- **B11** `lightsail download-default-key-pair`'s `privateKeyBase64` is plain PEM, not base64 — never pipe through `base64 --decode`.
- **B12/B15** AL2023 minimal footprint: no `curl` (only `curl-minimal`, conflicts), no `cronie` preinstalled — both explicitly `dnf install`ed.
- **B13** AL2023's native PostgreSQL 15 uses `postgresql-setup --initdb` / `/var/lib/pgsql/data` / service `postgresql` — NOT the PGDG layout (`postgresql-15-setup`, `/var/lib/pgsql/15/data`, `postgresql-15.service`).
- **B14** poll for the literal "User-data script completed successfully" log marker, not "service active" (agent starts before directories/cron exist).
- **B16 (critical)** the credential-refresh script must round-trip the `[bootstrap]` profile section on every write, or the 2nd cron cycle wipes its own long-lived keys and all AWS access silently dies ~60 min after an apparently-successful provision. **Explicitly re-verify this on the prod instance during P2** (two consecutive manual refresh runs), don't just trust that "it worked on staging."
- **AWS profile discipline**: every local `aws` CLI call in this plan needs `--profile disruptive` explicitly — there is no default profile on this machine (bit staging in one `aws s3 cp` call previously).
- **CodeDeploy zip hygiene**: never zip `src/generated/prisma/` (platform-specific native binary; the Linux instance regenerates its own).

---

## 9. Rollback plan

- **Backend**: no prior prod deployment exists to roll back to (first deploy) — rollback means `pm2 stop miempresa-api` + investigate, or `aws lightsail delete-instance` + re-run P2/P3 from scratch (empty DB, no data loss risk since P-SEED hasn't run yet, or restore from the P3-adjacent backup if it has).
- **Frontend**: no prior Amplify job exists — same "nothing to roll back to" situation; re-run `deploy-frontend.sh --stage prod`.
- **Data**: `backup-postgres-s3.sh` runs daily at 02:00 via cron once P2 completes, writing to `miempresa-backups-540657241795-prod`. Before P-SEED, take one manual `pg_dump` snapshot as a checkpoint (empty-schema baseline, trivial size) so there's always a known-good restore point even before the first automated nightly backup fires.
- **DNS/Edge**: `aws cloudformation delete-stack --stack-name miempresa-edge-prod` cleanly removes the CloudFront distribution + Route 53 records + ACM cert if the whole edge needs to be re-created (e.g. to fix an `IsProd` conditional bug found during P4 verification).

---

## 10. Execution sequencing summary

```
P0  Preflight (read-only)                                    no approval needed beyond this plan
P1  Foundation stacks (IAM no-op, S3-prod, SSM-prod, CD no-op)  ✋ approve
P2  Lightsail instance (miempresa-backend-prod, micro_3_0)      ✋ approve
P3  First backend deploy (32 migrations + app code)             ✋ approve
P4  Edge stack (DNS + TLS, api.disruptiveexp.com)                ✋ approve
P5  Frontend (Amplify app + first publish)                      ✋ approve
P-SEED-USERS    3 login accounts + instruments (built, ready)    ✋ approve, run once
P-SEED-CATALOG  empresa + 15 cargos + 14 centros + 2 prices      ✋ approve (tool built 2026-09-10)
P-SEED-STAFF    12 empleados + contratos + AUXILIARES logins     ✋ approve (placeholders 2026-09-10)
P6  QA (reuse dual-mode staging suites + new prod-residue check) ✋ approve
```

Each ✋ is a separate confirmation per the standing prod-safety rule — no phase auto-chains into the next, unlike the staging precedent where autonomous continuation was authorized after Phase 1.

## Grep hooks

```
prod-deployment-plan miempresa-backend-prod miempresa-edge-prod miempresa-frontend-prod
miempresa.disruptiveexp.com miempresa-api.disruptiveexp.com micro_3_0-prod
backend/prisma/prod-db/seed-prod-foundation.ts backend/prisma/prod-db/seed-prod.sh
backend/prisma/prod-db/catalog-snapshot.ts prod catalog sync tool not yet built
founders/ADMIN founders/CONTRATOS founders/GERONTOLOGA
P-SEED-USERS P-SEED-CATALOG CENTRO_COSTOS_OVERRIDES precio_unitario delta
IsProd conditional first-exercise CORS_ORIGIN app.disruptiveexp.com stale-default
```
