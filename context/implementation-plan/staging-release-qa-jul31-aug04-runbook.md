# Staging Release Runbook — qa-session-jul-31 + aug-04 followup

**Status**: R0 complete · R1 in progress · R4 = POINT OF NO RETURN (gated)
**Feature source**: `development/qa-session-jul-31/` (R1/R2/R3 + aug-04 followup)
**Baseline**: staging at **24 migrations**, BE `d-OJON0UVVK`, Amplify job 12 (qa-jul-24).
**Release ships the full jul-31 bundle** (not previously deployed) + aug-04 followup:
- migrations **25** `20260803022244_add_empleado_eps_fondo_arl`, **26** `20260804165919_add_empleado_bloqueado` (BOTH additive nullable columns on `empleados`)
- TINETTI **v3** (gait fix) — applied on-instance via `instruments:upgrade`
- backend src (employees/nomina/domainAccess) + frontend (empleados list/detail/editar, nomina)

## Account / targets (staging only)
Profile `disruptive` · region `us-east-1` · BE `miempresa-backend-staging @ 54.144.25.72` · API `https://miempresa-api-stg.disruptiveexp.com/api/v1` · FE `https://miempresa-stg.disruptiveexp.com` · Amplify `d1nsxjyualdzdu`/staging · CodeDeploy app `miempresa-app` group **`miempresa-staging` ONLY** · Backups `miempresa-backups-540657241795-staging` · Artifacts BE `miempresa-artifacts-540657241795-staging` · SSH `~/.ssh/miempresa-lightsail-key.pem`.
**NOT in scope**: `miempresa-prod` group (exists — DO NOT TOUCH).

## Risk gate (R0) — LOW: additive-only
Unlike jul-24, NO destructive ops. Both migrations only `ADD COLUMN` (nullable/default) on `empleados`. `empleados` = **2 rows** on staging → both get `bloqueado=false`, `eps/fondoPensiones/arl=NULL`. No backfill, no enum-map, no delete/repoint. Zero data-loss risk. TINETTI v3 upgrade is non-destructive (inserts new version, flips active, preserves v2 fichas).

## Phase map
```
R0  Read-only preflight [DONE]
R1  DB backup (safety net)
R2  SKIP (additive)
R3  SKIP seed-qa (QA users already present since jul-24: qa-admin id5 / qa-gerontologa id6 / qa-contratos id7)
R4  Backend CodeDeploy + on-instance `prisma migrate deploy` + `instruments:upgrade` (POINT OF NO RETURN — gated)
R5  Frontend Amplify + post-deploy smoke
```

## R0 actuals — 2026-08-04
| Check | Verbatim |
|---|---|
| HEAD | `d2e21ad…` · working tree dirty (125 files — packages WT per precedent) |
| Local migrate status | `Database schema is up to date!` (26 migrations local, incl. #25 eps_fondo_arl + #26 bloqueado) |
| On-instance migrate status | `24 migrations found / Database schema is up to date!` (#25,#26 NOT applied — gated via R4) |
| Risk-gate row count | `empleados = 2` (additive nullable cols → no backfill) |
| API health / FE | `API=200 / FE=200` |
| Lightsail | `54.144.25.72 running` |
| CodeDeploy groups | `miempresa-staging  miempresa-prod` (prod present — NEVER target) |
| Last staging deploy | `d-OJON0UVVK` (qa-jul-24) |
| Amplify last job | `12 SUCCEED` |
| Recent backups | `pre-jul24-qa.sql.gz` (2026-07-31, 31,219 B) — this release adds `pre-jul31-aug04.sql.gz` |

R0 ran read-only; no mutating command executed.

## R1 — DB backup (safety net)
Dump taken ON the instance (pg tools match DB; instance has S3 IAM) → uploaded to backups bucket.
*(actuals filled below on run)*

## R4 — Backend deploy + migrations + TINETTI upgrade (POINT OF NO RETURN)
Bundle must include `prisma/migrations/{...eps_fondo_arl,...bloqueado}/`. After CodeDeploy Succeeded:
`npx prisma migrate deploy` (applies 25,26) → `npm run instruments:upgrade` (TINETTI v3 active) → `pm2 restart miempresa-api`.

## R5 — Frontend Amplify + smoke
`./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive`
Smoke: Nequi/Bre-B label; nómina valor-mensual dialog; EPS/Fondo/ARL fields; empleado lock (admin lock→contratos 403); TINETTI item 11/12 per-foot.

## Actuals — 2026-08-04 (COMPLETE)

**R1 backup**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-jul31-aug04.sql.gz` — 33,819 B (local=S3 ✓), sha256 `f67e748868eafaf32a32eba1e084c95bf50384568a76101b3111e3a46a1ba4f7` (dumped on-instance).

**R4 backend** (POINT OF NO RETURN — done):
- Artifact `miempresa-staging-jul31-aug04-20260804-173720.zip` (appspec at root; migrations 25/26 + TINETTI.v3.json included). CodeDeploy **`d-EDEN0GJYK` / Succeeded** (group `miempresa-staging` ONLY; prod untouched).
- On-instance `prisma migrate status` = **26 migrations / up to date** (25 eps_fondo_arl + 26 bloqueado auto-applied via AfterInstall).
- `empleados` columns present: `arl bloqueado eps fondo_pensiones` ✓.
- **TINETTI v3**: tsx not on instance (devDep omitted) → applied via tunneled `FORCE_UPGRADE=true instruments:upgrade` (script guards deployed-stage DBs; override is the intended path). Staging now: v1=inactive, v2=inactive, **v3=active** (v1/v2 preserved for history). Non-destructive.
- Health `200`; lock route `401` unauth (live).

**R5 frontend**: `deploy-frontend.sh` → Amplify **job 13 / SUCCEED**. Custom + default domains live.

**Post-deploy smoke** (all PASS):
| Check | Result |
|---|---|
| FE `/ /login /empleados /nomina /instrumentos` | 200 ✓ |
| GET /employees/1 | `bloqueado=false`, `eps` key present ✓ (jul-31 R3 + aug-04 lock live) |
| admin PUT /employees/1/lock | `bloqueado=true` ✓ |
| qa-contratos PUT /employees/1 (locked) | **403 `EMPLOYEE_LOCKED`** ✓ |
| admin PUT /employees/1/unlock (revert) | `bloqueado=false` ✓ (net-zero) |
| qa-contratos PUT /employees/1/lock | **403** ✓ (admin-only) |
| TINETTI active version | **3** ✓ |

**Net data side-effect**: none (employee 1 lock reverted). QA users unchanged.

## Post-release addendum — TINETTI v4 (2026-08-04, later same day)

Gerontóloga followup: item 11 needed the clinically-correct split (two orthogonal binary dimensions per foot, not a single 4-option select). v3 was pattern-B; v4 restores the clinical structure.

- **Change**: item 11 split into 11a (sobrepasa + separa, pie derecho) and 11b (sobrepasa + separa, pie izquierdo) — 4 binary sub-items total. Renumbered 12 simetría · 13 fluidez · 14 trayectoria · 15 tronco · 16 postura per spec.
- **Max score preserved** (v4 = v3 = 27) → risk thresholds unchanged.
- **Deployment scope**: instrument-definition-only (no code deploy, no migration, no frontend deploy — instruments render dynamically).
- **Applied**: `FORCE_UPGRADE=true instruments:upgrade` via tunneled DATABASE_URL. Non-destructive upsert (v1/v2/v3 preserved inactive; v4 inserted+activated).
- **Live verification on staging DB** (active v4 marcha item order): `ma_iniciacion | ma_pd_sobrepasa | ma_pd_separa | ma_pi_sobrepasa | ma_pi_separa | ma_simetria | ma_fluidez | ma_trayectoria | ma_tronco | ma_postura` ✓.
- **Tests**: `tinetti-v4-marcha.spec.ts` 5/5 · `seed-definitions.spec.ts` bumped 3→4, 4/4 pass.

## Second addendum — TINETTI v5 (2026-08-04, later same day)

User revised the spec: item 11 = **one item per foot with 4 options each** (A/B/C/D scored 0/1/0/1). v4's clinical-split shape was rejected in favor of literal per-user spec.

- **Changes vs v4**: `ma_pie_derecho` and `ma_pie_izquierdo` restored as single-select-scored items with 4 options each. Numbering `10 · 11a · 11b · 12 · 13 · 14 · 15 · 16`.
- **Score impact**: max per foot drops 2 → 1, total max **27 → 25**. Risk thresholds rescaled proportionally: **bajo 23–25 · mod 17–22 · alto 0–16** (was 25–27 / 19–24 / 0–18).
- **Bug found & fixed** in v3/v4 test files (latent): `computeScore(...).total` doesn't exist — the field is `puntajeTotal`. Both prior assertions were vacuously true (`undefined === undefined`). Fixed in v3/v4/v5 specs; the v3/v4 thresholds were still correct by construction, just weren't actually exercised.
- **Deployment scope**: instrument-definition-only (no code, no migration, no frontend deploy).
- **Applied**: `FORCE_UPGRADE=true instruments:upgrade` via tunneled DATABASE_URL. v5 inserted + activated; v1/v2/v3/v4 preserved inactive.
- **Live verification on staging DB** (active v5 marcha item order + opt counts): `ma_iniciacion(2) | ma_pie_derecho(4) | ma_pie_izquierdo(4) | ma_simetria(2) | ma_fluidez(2) | ma_trayectoria(3) | ma_tronco(3) | ma_postura(2)` ✓.
- **Tests**: `tinetti-v5-marcha.spec.ts` 6/6 · `seed-definitions` bumped 4→5, 4/4 · v3/v4 specs re-verified 5/5 + 5/5.

## Rollback (manual only)
Redeploy `d-OJON0UVVK` + restore Amplify prev; DB restore from `pre-jul31-aug04.sql.gz` only if corrupted. Never auto-rollback.

## Grep hooks
staging-release-qa-jul31-aug04 add_empleado_eps_fondo_arl add_empleado_bloqueado bloqueado EMPLOYEE_LOCKED TINETTI-v3 instruments-upgrade d-OJON0UVVK
