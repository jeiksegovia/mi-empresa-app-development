# Resume-session — prod live (re-anchor 2026-09-16)

**Purpose**: single re-entry for prod after first deploy (2026-09-10) + first app drop (2026-09-11). Staging process still lives in `context/resume-session/summary-2026-09-08-prod-release.md` (R0–R5). This file is the **prod** SSOT for a new chat.

**Status**: prod **live**. Staging **live** (isolated after CD tag-filter incident).

**Folder**: `context/implementation-plan/prod-release/`  
- Initial infra: `2026-09-10-initial-deploy.md` + `p0`–`p6` templates (do not repeat for later drops).  
- Each later **app** drop: **one** dated file only (`YYYY-MM-DD-<slug>.md`).  
- Index: `00-overview.md`.

**Git at re-anchor**: HEAD `6cba342`. Working tree still dirty (repo convention). Last shipped prod zip from `36f27f2` + FE commits through `68b534b`.

---

## 0) Bootstrap

```bash
# prod
curl -s https://miempresa-api.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa.disruptiveexp.com

# staging (must stay 200 when doing prod)
curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com

# prod passwords (gitignored file + SSM)
# backend/prisma/prod-db/accounts-prod.md
# aws ssm get-parameters-by-path --path /miempresa/prod/founders/ --recursive --with-decryption --profile disruptive --region us-east-1

# staging QA
./backend/prisma/test-db/get-qa-creds.sh --stage staging --profile disruptive --region us-east-1
```

Login **custom domain only** (`sameSite=Strict`):  
prod `https://miempresa.disruptiveexp.com` · staging `https://miempresa-stg.disruptiveexp.com`  
Not `*.amplifyapp.com`. PrimeVue password: `#password input`.

Local: backend `:3101` · frontend `:3100` · postgres docker `:15432` · `admin@miempresa.com` / `<redacted>`.

### Hard rules

- Profile **`disruptive`**, region **`us-east-1`** on every `aws` call. State the command first. Never spray profiles.
- **Commit / push only when asked.**
- Prod AWS: explicit yes per phase (or one "autonomous stacks" yes). Never typo `miempresa-staging` vs `miempresa-prod`.
- CodeDeploy groups: **Environment-only** tag (`staging` or `prod`). Never add `Application=miempresa` as a second filter (filters are **OR**).
- Never `prisma migrate diff --shadow-database-url`.
- Never blanket `pkill` node/tsx. Local restart: `lsof -i :3101` PID. Never `node --import tsx src/start.ts` (bun :4142).
- Never zip `src/generated/prisma/` or `prisma/prod-db/`. `appspec.yml` at zip root.
- Migrations gitignored; they travel in the zip; on-instance `npx prisma migrate deploy`.
- `backend/prisma/prod-db/` gitignored (real emails, NIT, passwords).
- AfterInstall copies Prisma client `src/generated` → `dist/generated`. Manual restores must do the same.
- No `§` or em dash in chat. Think English, UI Spanish.

---

## 1) Live endpoints and IDs

| | Prod | Staging |
|---|---|---|
| FE | https://miempresa.disruptiveexp.com | https://miempresa-stg.disruptiveexp.com |
| API | https://miempresa-api.disruptiveexp.com | https://miempresa-api-stg.disruptiveexp.com |
| Origin | miempresa-api-origin.disruptiveexp.com → **44.195.227.44** | **54.144.25.72** |
| Lightsail | `miempresa-backend-prod` `micro_3_0` | `miempresa-backend-staging` |
| Static IP | `miempresa-ip-prod` | `miempresa-ip-staging` |
| CodeDeploy group | **`miempresa-prod`** | **`miempresa-staging`** |
| Amplify | `dodgibcmo1870` branch `prod` | `d1nsxjyualdzdu` branch `staging` |
| Artifacts | `s3://miempresa-artifacts-540657241795-prod/deployments/` | `...-staging/deployments/` |
| Backups | `s3://miempresa-backups-540657241795-prod/pre-releases/` | `...-staging/pre-releases/` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` | same key |
| Account | `540657241795` | same |

CFN prod: `miempresa-s3-prod`, `miempresa-ssm-prod`, `miempresa-edge-prod`, `miempresa-frontend-prod`.  
Global: `miempresa-iam`, `miempresa-codedeploy` (Environment-only filters).  
CloudFront API dist: `E1K9XVIXJIEX6S`.  
`CORS_ORIGIN` prod: `https://miempresa.disruptiveexp.com`.

Last **prod** CodeDeploy: **`d-6TMYLEHNL`**. Last **prod** Amplify: **job 2**.  
Last **staging** CodeDeploy: **`d-OCR24VENL`**. Last **staging** Amplify: **job 31**.  
Migrations: **32** (newest `20260828120000_ocultar_beneficiario`).

Historical failed prod CD: `d-85ZG7B1NL` (HEALTH_CONSTRAINTS, also targeted staging). First successful prod CD: `d-EYN1OE0NL`.

---

## 2) How to ship a later prod app drop

Copy `2026-09-11-cert-paciente.md`. One file. Group **`miempresa-prod` only**. Confirm staging health first.

```
R0  health + last CD/Amplify (prod AND staging)
R1  pg_dump on prod instance → s3://...-prod/pre-releases/
R4  working-tree zip → s3 ...-prod/deployments/ → create-deployment miempresa-prod
R5  ./frontend/infrastructure/scripts/deploy-frontend.sh --stage prod --region us-east-1 --profile disruptive
    smoke custom domain
```

Zip (from `backend/`):

```bash
test -f appspec.yml || cp infrastructure/db/appspec.yml appspec.yml
zip -r /tmp/miempresa-prod-<slug>-$(date +%Y%m%d-%H%M%S).zip \
  appspec.yml dist prisma package.json package-lock.json tsconfig.json \
  src scripts infrastructure/db/scripts infrastructure/db/utilities \
  -x 'src/generated/*' -x '*node_modules*' -x '*.spec.ts' \
  -x 'prisma/prod-db/*' -x 'scripts/_tmp-*' -x '*.log' -x '*.DS_Store'
# unzip -l: appspec.yml at root; grep generated and prisma/prod-db must be empty
```

AfterInstall: `npx prisma generate`, copy client to `dist/generated`, `npx prisma migrate deploy`. **Does not** run `instruments:upgrade` unless `FORCE_UPGRADE=true` on SSH.

Staging recipe unchanged: group `miempresa-staging`, Amplify `d1nsxjyualdzdu`, see 2026-09-08 summary.

---

## 3) Prod releases so far

### 2026-09-10 initial (`2026-09-10-initial-deploy.md`)

P0–P6 + seeds. Autonomous stacks authorized that day.

| Phase | Actual |
|---|---|
| P1 | s3-prod + ssm-prod CREATE. iam/codedeploy no-op then later UPDATE for filters |
| P2 | instance + IP **44.195.227.44**. B16 two refresh cycles OK |
| P3 | zip sha256 `6e7d0ca5…`. Fail `d-85ZG7B1NL` (OR filters hit staging). Restore staging from archive `d-FC043YNLL` + `dist/generated`. Filter → Environment only. Retry **`d-EYN1OE0NL` Succeeded** (prod instance only) |
| P4 | edge CREATE. IsProd no-suffix hosts. API 200. Origin login without header 403 |
| P5 | Amplify `dodgibcmo1870` **job 1**. Custom FE 200 while console `AWAITING_APP_CNAME` |
| P-SEED-USERS | 3 founders. FORCE_UPGRADE. VALORACION v2 active (`d49573f` template commit) |
| P-SEED-CATALOG | EMKASA / NIT 3352434-8 / Pasto / 3135919393. 15 cargos (`Auxiliar` not Servicios Generales). 14 centros. Prices 1.5M / 70k. No extra centro, no ítems |
| P-SEED-STAFF | 12 empleados. 11 AUXILIARES. Paola ADMIN linked. Placeholders DOB `1990-01-01`, INDEF, `valorMensual=1` |
| P6 | 4 logins 200 |

Empresa email still `info@miempresa.com` (placeholder).

### 2026-09-11 cert + patient email (`2026-09-11-cert-paciente.md`)

Staging first: `d-OCR24VENL` / Amplify job 31. Then prod.

| | |
|---|---|
| Why | gerontologa POST cert 201 then POST `/:id/updates` **403** (leftover ADMIN). contratos POST patients **400** on `"correo"` / blank email |
| Ship | GERONTOLOGA certificados `create-only`. POST updates drops ADMIN. PUT/DELETE ADMIN. Email coerce omit blank/no-@ |
| FE | Nuevo for create-only; child-owned update draft + `getValue()`; omit placeholder email |
| Prod CD | **`d-6TMYLEHNL` Succeeded** |
| Prod Amplify | **job 2 SUCCEED** |
| Backup | `s3://miempresa-backups-540657241795-prod/pre-releases/pre-sep11-cert-paciente.sql.gz` |
| Smoke | gerontologa POST cert 201 + updates 201; PUT 403; contratos cert 403; patients email=`correo` 201 then ADMIN delete |
| Rollback | CD `d-EYN1OE0NL` / Amplify job 1 |
| Commits | `36f27f2` … `6cba342` (FE form emit / getValue / draft / UI spec wait) |

---

## 4) Catalog and staff (gitignored)

`backend/prisma/prod-db/`

| File | Role |
|---|---|
| `catalog-snapshot.ts` | EMKASA + 15 cargos + 14 centros + 2 prices |
| `sync-prod-catalog.ts/.sh` | `--empresa --cargos --centros` phrase `sync prod catalog` |
| `employee-roster.ts` | 12 people, placeholders tagged |
| `seed-prod.sh` | 3 founders, phrase `seed prod foundation`, refuses if usuarios nonempty |
| `seed-prod-staff.sh` | 12 empleados, phrase `seed prod staff` |
| `accounts-prod.md` | client passwords. **Never commit** |

Cargos: 10 canonical with **`Auxiliar`** (not Servicios Generales) + Administración, Auxiliar Asistencial de Ruta, Conductor Bus, Coordinadora, Directora General.

RBAC: Paola ADMIN. Other 11 AUXILIARES (same matrix as PROFESORES). CONTRATOS / GERONTOLOGA stay the two generic founders.

Dias / jornada are notes only (no Contrato columns).

Founders SSM: `/miempresa/prod/founders/{ADMIN,CONTRATOS,GERONTOLOGA}/{EMAIL,PASSWORD}`  
Staff SSM: `/miempresa/prod/staff/<slug>/{EMAIL,PASSWORD}`

---

## 5) Learnings (apply every time)

1. **On-prem tag filters are OR.** Two KEY_AND_VALUE filters match *either*. `Application=miempresa` on both instances pulled staging into prod `d-85ZG7B1NL`. Groups must be **Environment only**. Confirmed after fix: staging last CD still `d-FC043YNLL` until sep-11 `d-OCR24VENL`; prod retry targeted prod only.
2. **A failed prod deploy can stop staging.** BeforeInstall deletes `dist/` and pm2. Restore: rsync last-good `deployment-archive`, `npm ci --omit=dev`, `prisma generate`, **`cp -R src/generated dist/generated`**, pm2 start as in `start-service.sh` (no `--exec-mode`).
3. Working-tree zip is the established pattern (not a clean tag). Scope **commits** with `git add -p`.
4. Login custom domain only. Amplify can HTTP 200 while `domainStatus=AWAITING_APP_CNAME`.
5. Origin hardening: health 200 without `x-origin-verify`; login 403 without it.
6. `instruments:upgrade` is not AfterInstall. Staging/prod refuse unless `FORCE_UPGRADE=true`.
7. Seed scripts are interactive; pipe the exact phrase.
8. GERONTOLOGA create-only: POST cert + POST updates; not PUT/DELETE. CONTRATOS certs read-only.
9. Patient email: coerce empty / `"correo"` / no-@ to omitted; valid emails still validated.
10. PrimeVue: `#password input`. Child form state: do not v-model a `const reactive()` (use draft / `getValue()` / `:model-value` + assign). See memory `vmodel-const-reactive-pitfall`.

Infra bugs already in scripts (re-check on new instances): B1 `micro_3_0`; B16 bootstrap profile must survive two refresh cycles; B10 appspec root; never zip generated client.

---

## 6) Open / later

- Replace staff placeholders in UI (DOB, salary, emails, Paola `fechaInicio`).
- Empresa email if not `info@miempresa.com`.
- Amplify prod `domainStatus` may still show `AWAITING_APP_CNAME`; custom host already 200 as of 2026-09-10/11.
- Do not copy staging extra centro `Transporte por dia`, QA cargos, or ítems.
- Next prod drop: new `YYYY-MM-DD-<slug>.md` only. Confirm staging 200. Group `miempresa-prod`.

---

## 7) File map

| Need | Path |
|---|---|
| This re-anchor | `context/implementation-plan/prod-release/summary-2026-09-16-resume.md` |
| Folder index | `context/implementation-plan/prod-release/00-overview.md` |
| Initial deploy | `context/implementation-plan/prod-release/2026-09-10-initial-deploy.md` |
| Sep-11 prod app | `context/implementation-plan/prod-release/2026-09-11-cert-paciente.md` |
| Sep-11 staging | `context/implementation-plan/staging-release-sep11-cert-paciente-runbook.md` |
| Staging R0–R5 process | `context/resume-session/summary-2026-09-08-prod-release.md` |
| Prod plan (phases, domains) | `context/implementation-plan/prod-deployment-plan.md` |
| AfterInstall | `backend/infrastructure/db/scripts/after-install.sh` |
| CD groups | `backend/infrastructure/db/cloudformation/codedeploy-stack.yml` |
| FE deploy | `frontend/infrastructure/scripts/deploy-frontend.sh` |
| Prod seed / accounts | `backend/prisma/prod-db/` (gitignored) |

---

## Grep hooks

```
summary-2026-09-16-resume prod-release
d-6TMYLEHNL Amplify-job-2 dodgibcmo1870
d-EYN1OE0NL d-85ZG7B1NL HEALTH_CONSTRAINTS Environment-only
44.195.227.44 miempresa-backend-prod
d-OCR24VENL amplify-job-31 staging
VALORACION_INTEGRAL v2 EMKASA accounts-prod.md
create-only POST /certificates/:id/updates email coerce
```
