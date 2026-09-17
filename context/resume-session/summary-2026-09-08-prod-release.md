# Resume-Session Summary — 2026-09-08 (staging release process + prod pre-deploy)

**Purpose**: single entry so a new chat can run staging releases and resume the **first prod deploy** without re-deriving 3 months of runbooks. This file is the process guide. The prod *plan* is still `context/implementation-plan/prod-deployment-plan.md`.

**Status**: staging is live and current. Prod is **PLAN only**. No prod AWS mutation has ever run.

**Last verified**: 2026-09-08. Staging CodeDeploy **`d-FC043YNLL`**, Amplify **job 24**, **32** migrations, up to date.

---

## 0) Bootstrap (do this first)

```bash
# health
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com

# QA passwords (staging SSM)
./backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1

# local
# backend :3101  frontend :3100  postgres docker :15432
# local login: admin@miempresa.com / <redacted>
# staging login: custom domain ONLY (miempresa-stg.disruptiveexp.com), not *.amplifyapp.com
```

### Hard rules (never skip)

- Think/reason in English. UI is Spanish. No `§` or em dash in chat.
- **Commit only on explicit instruction. Never push unless asked.**
- **No prod AWS until a separate "yes, proceed" per phase.** CodeDeploy group `miempresa-prod` exists empty. Never typo it in place of `miempresa-staging`.
- AWS: profile **`disruptive`**, region **`us-east-1`**, on **every** call (this machine has no default profile). State the command before running. Never spray profiles.
- Never `prisma migrate diff --shadow-database-url` (wipes the DB).
- Never blanket `pkill` node/tsx. Restart local backend via `lsof -i :3101` PID. Never `node --import tsx src/start.ts` (collides with bun on :4142).
- Migrations are **gitignored**. They ship only inside the CodeDeploy zip. On-instance: `npx prisma migrate deploy`.
- **Never zip `backend/src/generated/prisma/`** (macOS arm64 binary; instance regenerates).
- `backend/prisma/prod-db/` is **gitignored** (real business data). Re-verify it exists on this machine.
- Staging login: custom domain only.

---

## 1) State at a glance (2026-09-08)

| Layer | State |
|---|---|
| Git | `main`. HEAD **`935fe1d`**. Recent: `e628589` (recibo telefono), `935fe1d` (actividades name/cargo). **Not pushed.** Working tree still dirty (qa-sep-2 F1–F4, VALORACION v2 untracked, etc.). |
| Local migrations | **32**. Newest `20260828120000_ocultar_beneficiario`. |
| Staging BE | Lightsail `miempresa-backend-staging` @ `54.144.25.72`. Last CD **`d-FC043YNLL`**. 32 mig, up to date. |
| Staging FE | Amplify `d1nsxjyualdzdu` branch `staging`, last job **24**. |
| Prod | Does not exist. Group `miempresa-prod` has **zero** deployments. |

### URLs

| | Staging | Prod (planned) |
|---|---|---|
| FE | https://miempresa-stg.disruptiveexp.com | https://miempresa.disruptiveexp.com |
| API | https://miempresa-api-stg.disruptiveexp.com | https://miempresa-api.disruptiveexp.com |
| Origin | 54.144.25.72:3001 | miempresa-api-origin.disruptiveexp.com |

### QA users (staging SSM)

| Role | Email |
|---|---|
| ADMIN | qa-admin@miempresa.com |
| CONTRATOS | qa-contratos@miempresa.com |
| GERONTOLOGA | qa-gerontologa@miempresa.com |
| PROFESORES / AUXILIARES | qa-profesor@ / qa-auxiliar@ (SSM; local seed uses <redacted>) |

Local: `admin@` / `qa-*@miempresa.com` / `<redacted>`.

---

## 2) Canonical staging release (R0 → R5)

Every staging drop since jul-5 uses this. Copy a prior runbook, fill actuals. **Never `miempresa-prod`.**

```
R0  Read-only preflight
R1  pg_dump → S3          [CHECKPOINT]
R2  SKIP unless reset/seed needed
R3  SKIP seed-qa (users already exist)
R4  CodeDeploy miempresa-staging + migrate deploy   [POINT OF NO RETURN]
R5  Amplify frontend + smoke
```

### Targets (always)

| Item | Value |
|---|---|
| Profile / region | `disruptive` / `us-east-1` |
| Instance | `miempresa-backend-staging` @ `54.144.25.72` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Amplify | `d1nsxjyualdzdu` branch `staging` |
| Artifacts | `s3://miempresa-artifacts-540657241795-staging/deployments/` |
| FE artifacts | `s3://miempresa-frontend-artifacts-540657241795-staging/releases/` |
| Backups | `s3://miempresa-backups-540657241795-staging/pre-releases/` |

### R0 (read-only)

```bash
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com

aws deploy list-deployments --application-name miempresa-app \
  --deployment-group-name miempresa-staging --max-items 3 \
  --profile disruptive --region us-east-1

aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
  --max-items 3 --profile disruptive --region us-east-1

# SSH: npx prisma migrate status ; count tables the migration touches
```

Risk gate: additive DEFAULT columns = LOW. `NOT NULL` without DEFAULT on a table with rows = STOP (RB-1). Drops of tables with rows = STOP.

### R1 (backup)

On instance:

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72
# then:
STAGE=$(cat /etc/miempresa-stage)
DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/${STAGE}/db/DB_PASSWORD" \
  --with-decryption --query Parameter.Value --output text --region us-east-1)
pg_dump -h localhost -p 5432 -U miempresa -d "miempresa_${STAGE}" \
  --no-owner --no-acl --format=plain | gzip > /tmp/pre-<slug>.sql.gz
sha256sum /tmp/pre-<slug>.sql.gz
aws s3 cp /tmp/pre-<slug>.sql.gz \
  s3://miempresa-backups-540657241795-staging/pre-releases/pre-<slug>.sql.gz \
  --region us-east-1 --sse AES256
```

Record bytes + sha256. Local `stat` must match S3 `ContentLength`.

Restore (never auto):

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '
  set -euo pipefail
  pm2 stop miempresa-api
  aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-<slug>.sql.gz /tmp/restore.sql.gz --region us-east-1
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query Parameter.Value --output text --region us-east-1)
  gunzip -c /tmp/restore.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
  pm2 start miempresa-api
'
```

### R4 (backend zip + CodeDeploy)

Working-tree zip is the established pattern (not a clean tag).

```bash
cd backend
# appspec.yml MUST be at zip root. If working tree deleted it, copy from HEAD:
# git show HEAD:backend/appspec.yml > appspec.yml
# or: cp infrastructure/db/appspec.yml ./appspec.yml

zip -r /tmp/miempresa-staging-<slug>-$(date +%Y%m%d-%H%M%S).zip \
  appspec.yml package.json package-lock.json tsconfig.json \
  src prisma scripts infrastructure/db/scripts \
  -x 'src/generated/*' -x '*node_modules*' -x '*.spec.ts' \
  -x '*playwright-report*' -x '*test-results*' -x '*.log' \
  -x 'prisma/prod-db/*' -x 'scripts/_tmp-*' -x '*.DS_Store'

unzip -l /tmp/miempresa-staging-*.zip | awk '$4=="appspec.yml"'
unzip -l /tmp/miempresa-staging-*.zip | grep generated || echo 'no generated OK'

aws s3 cp /tmp/miempresa-staging-*.zip \
  s3://miempresa-artifacts-540657241795-staging/deployments/ \
  --profile disruptive --region us-east-1

aws deploy create-deployment \
  --application-name miempresa-app \
  --deployment-group-name miempresa-staging \
  --s3-location bucket=miempresa-artifacts-540657241795-staging,key=deployments/<file>.zip,bundleType=zip \
  --profile disruptive --region us-east-1
```

AfterInstall (`infrastructure/db/scripts/after-install.sh`): `npx prisma generate`, optional `npm run build` if no `dist/`, copy generated client, `npx prisma migrate deploy`. **Does not** run `instruments:upgrade` (refuses staging unless `FORCE_UPGRADE=true`).

If a new instrument template must go live:

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72
cd /opt/miempresa/app && set -a && source .env && set +a
FORCE_UPGRADE=true npx tsx scripts/instruments-upgrade.ts
```

### R5 (frontend)

```bash
./frontend/infrastructure/scripts/deploy-frontend.sh \
  --stage staging --region us-east-1 --profile disruptive
```

Bakes `NUXT_PUBLIC_API_BASE=https://miempresa-api-stg.disruptiveexp.com/api/v1`. Wait for Amplify job SUCCEED. Smoke on **custom domain**.

### Smoke pattern

SSM creds + cookie login. API Playwright from `backend/tests/**`. UI: custom domain, `#password input` (PrimeVue wrapper, not `#password`). CONTRATOS cannot DELETE ítems (403). Cleanup as ADMIN.

---

## 3) Previous staging releases (newest first)

Use these IDs for rollback. Full actuals live in the runbook path.

| When | Runbook | CodeDeploy | Amplify | Mig | Notes |
|---|---|---|---|---|---|
| 2026-09-08 | `staging-release-sep8-actividades-name-cargo-runbook.md` | **`d-FC043YNLL`** | job **24** | 32 | `empleadoNombre` + cargo on actividades. Commit `935fe1d`. |
| 2026-09-08 | `staging-release-sep8-empresa-telefono-recibo-runbook.md` | **`d-MRURUYMLL`** | job **23** | 32 | Recibo shows `telefono`. Public GET `/empresa` includes telefono. Commit `e628589`. Empresa live: EMKASA / 3135919393. |
| 2026-09-02 | `staging-release-qa-sep-2-runbook.md` | **`d-3IBR2MMHL`** | job **22** | 32 | F1 GERONTOLOGA certs create-only; F2 VALORACION v2 via FORCE_UPGRADE; F3 typed valorUnitario; F4 Valoraciones beneficiario on; F5 letterhead EN CASA (later overwritten to EMKASA by ADMIN). |
| 2026-08-28 | `staging-release-aug28-recibo-impresion-runbook.md` | **`d-FZP4YFCEL`** | job **21** | **32** | Recibo 80mm, GET `/empresa` public subset, `ocultar_beneficiario`. |
| 2026-08-27 | `aug-27-f4-fecha-lock.md` | **`d-KBO6T5QDL`** | job **20** | 31 | `limitar_fecha_contratos`. |
| 2026-08-19 | `staging-release-centro-costos-aug17-runbook.md` | **`d-IUQUHA58L`** | job **17** | 30 | Centro-costos ago-5 + aug-17. |
| 2026-08-18 | qa-session-aug-17 | `d-FD0BEVH7L` / `d-YRWXPRH7L` | job 16 | 29 | Cargos GET exception, actividades, bonos. |
| 2026-08-06 | `staging-release-fixes-features-aug-6-runbook.md` | `d-13RWC0Q4L` | job 15 | | PROFESORES/AUXILIARES matrix. |
| jul-31 → aug-4 | `staging-release-qa-jul31-aug04-runbook.md` | | | | Instrument fields, employee lock. |
| jul-24 | `staging-release-qa-jul24-runbook.md` | | | | Cargos catalog. |
| jul-22 | `staging-release-jul22-fixes-runbook.md` | | | | TINETTI v2+, instrument templates in zip. |
| jul-18 | `staging-release-jul18-nomina-asistencia-runbook.md` | | | | Nomina + asistencia. |
| jul-17.2 / jul-17 / jul-11 / jul-10 / jul-9 / jul-5 | matching `staging-release-jul*-runbook.md` | | | | Infra + first app deploys. |

Infra origin: `backend-lightsail-deployment-runbook.md`, `backend-lightsail-infrastructure-cloudformation-v2.md`.

---

## 4) Release learnings (apply every time)

### Zip / CodeDeploy

1. **`appspec.yml` at zip root.** Subdir silently undeploys. If working tree deleted `backend/appspec.yml`, restore from HEAD or `infrastructure/db/appspec.yml`.
2. **Never zip `src/generated/`**. First recibo zip was 12 MB (arm64 native). Rebuild without it (~300–450 KB). Instance: `npx prisma generate`.
3. Exclude `node_modules`, `*.spec.ts`, `prisma/prod-db`, `scripts/_tmp-*`.
4. `--profile disruptive` on **every** `aws` call, including `s3 cp`. Missing it once failed with `Unable to locate credentials`.
5. Point of no return is **migrate deploy**, not S3 upload. Rollback = prior CodeDeploy id + optional R1 dump.

### Schema / seed

6. **RB-1**: never `ADD COLUMN … NOT NULL` without DEFAULT on a table that may have rows. Ago-5 `updated_at` is historical (already applied). Additive 3-step: add nullable, backfill, set NOT NULL.
7. Do not edit a migration already in `_prisma_migrations` on staging.
8. Catalog changes that are **not** in SQL (`seedCentrosCostos`, Transporte rename) run on API boot. Smoke must query names after start.
9. `instruments:upgrade` is **not** in AfterInstall. Staging/prod DB names refuse unless `FORCE_UPGRADE=true`. JSON in the zip is inert until that SSH step. Old completed fichas stay pinned to their `instrumentoVersionId`.

### Auth / FE

10. Login only on custom domain (`sameSite=Strict`). `*.amplifyapp.com` will fail.
11. PrimeVue Password: `#password input`, not `#password`.
12. Working-tree zip can include uncommitted features. Scope **commits** with `git add -p` (sep-8 telefono vs ocultarBeneficiario in the same file).

### Data

13. **Read live staging before trusting a runbook snapshot.** Empresa went `Mi Empresa S.A.S.` → `EN CASA` (sep-2 PUT) → **`EMKASA ABUELITOS FELICES`** (ADMIN `/empresa/editar`). Snapshot files rot.
14. QA residue on staging (cargos `QA-F3-*`, extra centro `Transporte por dia`, ítems) is **not** the prod catalog.

### Prod-specific (stricter)

15. No autonomous phase-chaining. One "yes, proceed" per P1–P6 / P-SEED.
16. Seed-once has **no FORCE bypass**. If `usuarios` has a row, refuse.
17. `IsProd` CloudFormation branch has never run. Re-verify DNS/CORS/Amplify conditionals in P4/P5.
18. Double-check `--deployment-group-name miempresa-prod` vs staging.

Infra bugs already fixed in scripts (still re-verify on first prod instance): B1 bundle `micro_3_0`; B2/B3 bootstrap creds; B7 pm2 as ec2-user; B10 appspec root; B13 AL2023 postgres layout; **B16** credential-refresh must round-trip `[bootstrap]` or AWS dies ~60 min later (two manual refresh cycles on P2).

---

## 5) Prod plan (not executed)

**SSOT**: `context/implementation-plan/prod-deployment-plan.md`  
**Pointer**: `context/resume-session/summary-2026-08-28-prod-deployment-plan.md`  
**Gitignored scripts**: `backend/prisma/prod-db/{seed-prod.sh,seed-prod-foundation.ts,catalog-snapshot.ts,sync-prod-catalog.ts,employee-roster.ts,seed-prod-staff.ts}`

### Phases (each ✋ needs its own yes)

```
P0     Preflight (read-only)
P1  ✋ Foundation stacks (s3-prod, ssm-prod; iam/codedeploy no-op)
P2  ✋ Lightsail miempresa-backend-prod micro_3_0
P3  ✋ First CodeDeploy → group miempresa-prod (32 mig + app)
P4  ✋ Edge DNS/TLS miempresa-api.disruptiveexp.com
P5  ✋ Amplify miempresa.disruptiveexp.com
P-SEED-USERS    ✋ 3 logins + instruments:upgrade
P-SEED-CATALOG  ✋ empresa + 15 cargos + 14 centros + 2 prices
P-SEED-STAFF    ✋ 12 empleados (placeholders) + 11 AUXILIARES
P6  ✋ QA
```

### What P-SEED-USERS creates (run once)

| Email | Role |
|---|---|
| admin@miempresa.com | ADMIN (Paola Segovia) |
| contratos@miempresa.com | EMPLEADO / CONTRATOS |
| gerontologa@miempresa.com | EMPLEADO / GERONTOLOGA |

Passwords: `openssl rand` into SSM `/miempresa/prod/founders/{ADMIN,CONTRATOS,GERONTOLOGA}/{EMAIL,PASSWORD}`.

Then `FORCE_UPGRADE=true` on templates. **`VALORACION_INTEGRAL.v2.json` committed `d49573f`** (2026-09-10).

On API boot: `seedCentrosCostos()` inserts the 14 default names (no prices, `habilitarRecibo=false`).

### P-SEED-CATALOG (tool built 2026-09-10)

`backend/prisma/prod-db/sync-prod-catalog.sh --empresa --cargos --centros`

Locked snapshot (`catalog-snapshot.ts`):

| Field | Value |
|---|---|
| nombre | **EMKASA ABUELITOS FELICES** |
| nit | **3352434-8** |
| direccion | **Carrera 33 No. 2 - 28 Barrio Las Acacias - Pasto** |
| telefono | **3135919393** |
| email | info@miempresa.com (placeholder) |

Cargos: 10 canonical (`Auxiliar` replaces `Servicios Generales`) + 5 roster (`Administración`, `Auxiliar Asistencial de Ruta`, `Conductor Bus`, `Coordinadora`, `Directora General`). Not copied: QA cargos, extra centro `Transporte por dia`, ítems.

Prices: Mensualidades completas 1.5M, Valoraciones 70k.

### P-SEED-STAFF (placeholders approved 2026-09-10)

`./seed-prod-staff.sh --profile disruptive --region us-east-1`

12 empleados + active INDEF contratos (`valorMensual=1`). 11 AUXILIARES logins. Paola linked to existing ADMIN. Passwords: `/miempresa/prod/staff/<slug>/PASSWORD`. Replace DOB / salary / email via UI later.

---

## 6) Client must provide / confirm (pre-deploy)

Answered 2026-09-10:
1. Empresa EMKASA 5 fields locked. Email still placeholder.
2. Centros: 14 defaults + 2 prices. No extra centro, no ítems, `habilitarRecibo` stays false.
3. Cargos: 10 canonical (`Auxiliar` not `Servicios Generales`) + 5 from roster.
4. VALORACION v2 committed `d49573f`.
5. 12 staff placeholders written. AUXILIARES except Paola ADMIN. Emails `{nombre}.{apellido}@miempresa.com`. DOB `1990-01-01`, INDEF, `valorMensual=1`.

Replace later via UI (not blocking P1–P5): real DOB, salary, emails, Paola fechaInicio, Salazar spelling.

---

## 7) File map

| Need | Path |
|---|---|
| This guide | `context/resume-session/summary-2026-09-08-prod-release.md` |
| Prod plan | `context/implementation-plan/prod-deployment-plan.md` |
| Prod plan pointer | `context/resume-session/summary-2026-08-28-prod-deployment-plan.md` |
| Sep-8 telefono | `context/implementation-plan/staging-release-sep8-empresa-telefono-recibo-runbook.md` |
| Sep-8 actividades | `context/implementation-plan/staging-release-sep8-actividades-name-cargo-runbook.md` |
| Sep-2 QA | `context/implementation-plan/staging-release-qa-sep-2-runbook.md` + `qa-sep-2-proof-report.md` |
| Recibo / empresa GET | `staging-release-aug28-recibo-impresion-runbook.md` |
| Centro-costos | `staging-release-centro-costos-aug17-runbook.md` |
| Infra | `backend-lightsail-deployment-runbook.md` |
| AfterInstall | `backend/infrastructure/db/scripts/after-install.sh` |
| FE deploy | `frontend/infrastructure/scripts/deploy-frontend.sh` |
| Prod seed | `backend/prisma/prod-db/seed-prod.sh` (gitignored) |
| Catalog snapshot | `backend/prisma/prod-db/catalog-snapshot.ts` (stale; gitignored) |
| QA creds | `backend/prisma/test-db/get-qa-creds.sh` |

---

## Grep hooks

```
R0 R1 R4 R5 miempresa-staging d-FC043YNLL Amplify job 24
appspec.yml zip root src/generated FORCE_UPGRADE instruments-upgrade
custom domain get-qa-creds.sh disruptive us-east-1
prod-deployment-plan P-SEED-USERS P-SEED-CATALOG catalog-snapshot
EMKASA ABUELITOS FELICES 3352434-8 3135919393
VALORACION_INTEGRAL.v2.json untracked
never miempresa-prod autonomous
```
