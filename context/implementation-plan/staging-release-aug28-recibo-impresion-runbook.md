# Staging Release Runbook — Recibo impresión + ocultarBeneficiario + empresa read fix (aug-28)

**Status**: R0 + R1 + R4 + R5 + QA COMPLETE 2026-08-28 — CodeDeploy `d-FZP4YFCEL` / Amplify job 21 / 32 migrations / QA PASS.
**Never** target `miempresa-prod`.

**Commits shipped**: `fa30faa` (feature) + `e86a0e4` (staging QA spec). Both on `main`, not pushed to remote (per standing instruction: commit only, push only if asked).

---

## What this release ships

| Layer | Artifact |
|---|---|
| Migration **#32** | `20260828120000_ocultar_beneficiario` — additive: `centros_costos.ocultar_beneficiario BOOLEAN NOT NULL DEFAULT false` + scoped `UPDATE ... WHERE nombre='Valoraciones'` |
| Backend | `centroCostosService.ts` (skip required-beneficiario check when flag on; seed sets Valoraciones=true), `centroCostos.routes.ts` (accepts `ocultarBeneficiario` on create/update), `empresa.routes.ts` + `empresaService.ts` (GET `/empresa` open to any authenticated role — public subset `{id,nombre,nit,direccion}`; ADMIN still gets the full record; POST/PUT unchanged ADMIN-only), `app.ts` (dev-only CORS regex widened for LAN printer testing, inert on staging/prod since gated by `isDev`) |
| Frontend | Recibo page rebuilt as an 80mm ticket (`@page size: 80mm`, single dashed TOTAL rule, all-black ink, empty-beneficiario row omitted); print opens in a new tab via click-time `window.open` (list tab keeps state); Volver closes that tab; Imprimir has a 1.5s click-cooldown so retry after Cancel/idle works; ADMIN centro dialog gained "Ocultar campo beneficiario (no requerido)" checkbox; item dialog hides Beneficiario when the centro's flag is on |
| Tests | `backend/tests/centro-costos/ocultar-beneficiario.spec.ts` (2), `backend/tests/rbac/domain-access.spec.ts` + `qa-profiles-five.spec.ts` (empresa public-fields checks), `frontend/tests/centro-costos/recibo-print.spec.ts` (8, mocked — 80mm layout/ink/new-tab/cooldown), `frontend/tests/centro-costos/ocultar-beneficiario-empresa-ui.spec.ts` (2, live SPA — dual local/staging) |

**Not in this release**: prod, any change to the `DOMAIN_ACCESS` matrix (empresa root GET is a route-level carve-out, same pattern as the existing `/empresa/cargos` CONTRATOS exception — matrix cell stays `false`).

---

## Account / targets (staging only)

| Item | Value |
|---|---|
| Profile / region | `disruptive` / `us-east-1` |
| Instance | `miempresa-backend-staging` @ `54.144.25.72` |
| API | `https://miempresa-api-stg.disruptiveexp.com/api/v1` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| Amplify | `d1nsxjyualdzdu` branch `staging` |
| Backups | `miempresa-backups-540657241795-staging` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` |

**NOT in scope**: group `miempresa-prod`.

---

## R0 — actuals (2026-08-28)

```
$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-08-28T22:15:39.181Z"}
$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
200

$ aws deploy list-deployments --application-name miempresa-app \
    --deployment-group-name miempresa-staging --region us-east-1 --profile disruptive --max-items 3
["d-KBO6T5QDL", "d-1G7ST2PDL", "d-C9QWA4NDL"]   # d-KBO6T5QDL = prior F4 release

$ aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
    --region us-east-1 --profile disruptive --max-items 3
job 20 SUCCEED (2026-08-27 19:56)   # prior F4 frontend release
```

On-instance (SSH):
```
31 migrations found in prisma/migrations
Database schema is up to date!

SELECT EXISTS(... column_name='ocultar_beneficiario') → f   (absent, expected — this is the deploy target)
SELECT count(*) FROM centros_costos → 14
SELECT centro_id, nombre, orden FROM centros_costos WHERE nombre='Valoraciones' → 5 | Valoraciones | 8
SELECT id, nombre, nit, direccion FROM empresas → 1 | Mi Empresa S.A.S. | 900123456-1 | Calle 100 # 15-20, Bogotá
```

**Risk gate: LOW.** Pure additive column with `DEFAULT false` (no RB-1-style NOT-NULL-without-default trap) + a scoped `UPDATE` on one named row. No drops, no enum changes, no route removed (only a permission *widened*, never narrowed, on a GET).

---

## R1 — backup (actuals)

| field | value |
| --- | --- |
| dump command | `pg_dump -h localhost -p 5432 -U miempresa -d miempresa_staging --no-owner --no-acl --format=plain \| gzip` |
| local path | `/opt/miempresa/backups/pre-ocultar-beneficiario-recibo-impresion.sql.gz` |
| S3 URI | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-ocultar-beneficiario-recibo-impresion.sql.gz` |
| bytes | **45933** (local `stat` and S3 `head-object ContentLength` match) |
| sha256 | `5e87b2c2883676f7504c3ac24af5643ed5c7334ffd3caf595eefa59aa81ea8d4` |
| SSE | AES256 |
| uploaded (UTC) | `2026-08-28T22:16:23Z` |

### Restore one-liner (do not run unless rolling back)

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '
  set -euo pipefail
  pm2 stop miempresa-api
  aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-ocultar-beneficiario-recibo-impresion.sql.gz /tmp/restore.sql.gz --region us-east-1
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query Parameter.Value --output text --region us-east-1)
  gunzip -c /tmp/restore.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
  pm2 start miempresa-api
  rm -f /tmp/restore.sql.gz
'
```

---

## R4 — backend (actuals)

| field | value |
| --- | --- |
| zip build | `zip -r backend/{appspec.yml,package.json,package-lock.json,tsconfig.json,src,prisma,infrastructure/db/scripts}` excluding `*.spec.ts`, `node_modules`, **`src/generated/*`** (gitignored Prisma client — shipping it caused a first-attempt 12 MB zip with a macOS arm64 native binary; excluded and rebuilt at 287 KB — instance regenerates via `npx prisma generate` in `after-install.sh`) |
| artifact | `/tmp/miempresa-staging-recibo-impresion-20260828-221656.zip` — 287131 B / sha256 `5d196e5397e152e27a8b6b5d674336bfe713fb8451fd5fcdec12042bb204f4e2` |
| S3 URI | `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-recibo-impresion-20260828-221656.zip` |
| **first `aws s3 cp` failed** | `Unable to locate credentials` — missing `--profile disruptive` on that one call (every other AWS call in this session had it). Retried with the flag, succeeded. |
| CodeDeploy group | `miempresa-staging` (NOT prod) |
| CodeDeploy id | **`d-FZP4YFCEL`** |
| status | **Succeeded**, ~95s (2026-08-28 17:17–17:18 local) |
| post-deploy migrate status | **32 migrations / up to date** |
| `ocultar_beneficiario` column | present; `Valoraciones=true`, all other INGRESOS `=false` (8/8 verified) |
| pm2 | `miempresa-api` online, restarted via `ApplicationStart` hook, no manual `pkill` |

---

## R5 — frontend (actuals)

```
./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
Zip: 2.3M → s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260828-171922.zip
Amplify Job ID: 21 → SUCCEED
```

---

## QA (actuals)

| # | Check | Result |
|---|---|---|
| 1 | `backend/tests/centro-costos/ocultar-beneficiario.spec.ts` vs staging (qa-admin) | **2/2 PASS** |
| 2 | `GET /empresa` as qa-admin | 200, full record (`telefono`, `email`, `limitarFechaContratos` present) |
| 3 | `GET /empresa` as qa-contratos | 200, **public subset only** (`{id,nombre,nit,direccion}`, no telefono/email) |
| 4 | `GET /empresa` as qa-gerontologa | 200, same public subset |
| 5 | CONTRATOS create + read a recibo item end-to-end (`centro.habilitarRecibo=true`) | 201 create, `GET /items/:id` returns `centro` + `beneficiario:{id,nombre}` |
| 6 | `frontend/tests/centro-costos/ocultar-beneficiario-empresa-ui.spec.ts` vs staging (live SPA, qa-admin + qa-contratos) | **2/2 PASS** — Valoraciones item dialog has no Beneficiario field, another INGRESOS centro still requires it; CONTRATOS recibo page renders the exact `nombre`/`nit`/`direccion` from `GET /empresa` |

**Cleanup**: manual QA item (id 20) deleted, centro `Mensualidades completas.habilitarRecibo` reset to `false`. Staging left in the same catalog/flag state as before the QA pass (only the new migration + code are new).

**Staging smoke: PASS.**

---

## Rollback (pre-staged, never auto)

- Backend: redeploy prior successful CodeDeploy `d-KBO6T5QDL` (F4 release).
- Frontend: prior Amplify job 20.
- Data: restore `pre-ocultar-beneficiario-recibo-impresion.sql.gz` only if `migrate deploy` left a bad schema (unlikely — pure additive).
- The additive `ocultar_beneficiario` column can stay if only the app is rolled back; dropping it is optional.

---

## Learnings (fold into future runbooks)

1. **Never zip `src/generated/prisma/`.** It's gitignored, contains a platform-specific native query-engine binary (macOS arm64 here), and the instance regenerates its own (Linux) client via `after-install.sh` step [4/6]. Shipping it bloated the artifact 40× (12 MB → 287 KB) for zero benefit.
2. **Every `aws` CLI call needs `--profile disruptive` explicitly** — one `aws s3 cp` without it failed with "Unable to locate credentials" even though every other call in the same session had the flag. No implicit default profile on this machine.
3. **Local DB drift from manual `curl PUT` testing (e.g. LAN print QA) breaks the *next* automated test run** — a smoke spec asserting `habilitarRecibo === false` on all seeded centros failed because an earlier manual toggle for LAN-printer testing was never reset. Always reset manually-toggled flags before treating a test suite as a real regression signal.
4. **Reuse existing dual-mode specs for staging QA instead of writing curl one-offs.** `ocultar-beneficiario.spec.ts` already read `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`TEST_API_URL` from env — running it against staging needed zero code changes, just different env vars.
5. **When a permission bug is "field X is missing," verify the fetch, not just the field.** The recibo header bug looked like a frontend rendering gap; it was actually `GET /empresa` returning 403 for non-ADMIN and the page's `.catch(() => null)` swallowing it silently. Trace the network call before assuming the template is wrong.

---

## Grep hooks

```
recibo-impresion ocultarBeneficiario empresa-public-fields staging-release
20260828120000_ocultar_beneficiario ADD COLUMN DEFAULT false
d-FZP4YFCEL amplify-job-21 32-migrations
pre-ocultar-beneficiario-recibo-impresion.sql.gz
GET /empresa public subset id nombre nit direccion
```
