# Staging Release Runbook — Recibo: empresa telefono (sep-8)

**Status**: R0 + R1 + R4 + R5 + QA COMPLETE 2026-09-08 — CodeDeploy `d-MRURUYMLL` / Amplify job 23 / 32 migrations (unchanged) / QA PASS.
**Never** target `miempresa-prod`.

**Commit shipped**: `e628589` ("sep-8: recibo — show empresa telefono below dirección."). On `main`, not pushed to remote (per standing instruction: commit only, push only if asked).

---

## What this release ships

| Layer | Artifact |
|---|---|
| Migration | **None.** `empresas.telefono` already existed in the schema — this release only widens what's *exposed*, not the schema. |
| Backend | `empresaService.ts` — `EmpresaPublic`/`toPublicEmpresa()` now include `telefono` alongside the existing `nombre`/`nit`/`direccion` public subset (same ADMIN-full-vs-public-subset split from the aug-28 release, untouched). |
| Frontend | `centro-costos/recibo/[itemId].vue` — new `<p data-testid="recibo-telefono">` line rendered below dirección when `empresa.telefono` is present; fetch type extended to include it. |
| Tests | `frontend/tests/centro-costos/recibo-print.spec.ts` — added an assertion locking in the new telefono line in the mocked 80mm layout test. |

**Not in this release**: any schema change, any change to `DOMAIN_ACCESS`/route permissions (telefono rides the same aug-28 public-subset carve-out — no new exception needed), prod.

**Note on scope**: the working tree carries other, previously-uncommitted staging work (qa-sep-2 `ocultarBeneficiario` revert for Valoraciones, contratos/recibo fixes, etc.) already live on staging from earlier uncommitted deploys. This commit is deliberately scoped to only the telefono change (staged with `git add -p` to split the touched file's unrelated hunk out) — the deploy artifact still reflects the full current working tree, consistent with this repo's established "build from working tree" convention.

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

## R0 — actuals (2026-09-08)

```
$ curl -s https://miempresa-api-stg.disruptiveexp.com/api/v1/health
{"status":"ok","timestamp":"2026-09-09T00:47:23.094Z"}
$ curl -s -o /dev/null -w "%{http_code}\n" https://miempresa-stg.disruptiveexp.com
200

$ aws deploy list-deployments --application-name miempresa-app \
    --deployment-group-name miempresa-staging --region us-east-1 --profile disruptive --max-items 3
["d-3IBR2MMHL", "d-FZP4YFCEL", "d-KBO6T5QDL"]

$ aws amplify list-jobs --app-id d1nsxjyualdzdu --branch-name staging \
    --region us-east-1 --profile disruptive --max-items 3
job 22 SUCCEED, job 21 SUCCEED, job 20 SUCCEED
```

On-instance (SSH, read-only):
```
32 migrations found in prisma/migrations
Database schema is up to date!

SELECT centro_id, nombre, ocultar_beneficiario FROM centros_costos WHERE nombre='Valoraciones'
  → 5 | Valoraciones | f   (qa-sep-2 revert already live — not this release's change)

SELECT id, nombre, telefono FROM empresas
  → 1 | EMKASA ABUELITOS FELICES | 3135919393
  (real company data — ADMIN already corrected this via /empresa/editar since the
   earlier aug-31 investigation that found the seed placeholder still in place)

pm2 jlist → miempresa-api online, restarts 294 (pre-existing cron-refresh accumulation,
  not a crash signal — consistent with the B16 credential-refresh cron pattern)
```

**Risk gate: LOW.** Zero migration. Pure additive DTO field (never removes/narrows an existing field) + one new conditional template line. No route/permission change.

---

## R1 — backup (actuals)

| field | value |
| --- | --- |
| dump command | `pg_dump -h localhost -p 5432 -U miempresa -d miempresa_staging --no-owner --no-acl --format=plain \| gzip` |
| local path | `/opt/miempresa/backups/pre-empresa-telefono-recibo.sql.gz` |
| S3 URI | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-empresa-telefono-recibo.sql.gz` |
| bytes | **51686** (local `ls`/`stat` and S3 `head-object ContentLength` match) |
| sha256 | `970915dd3027907352526045a9ae1b7b6aba60411c092b71559b1177907a7ba2` |
| SSE | AES256 |

### Restore one-liner (do not run unless rolling back)

```bash
ssh -i ~/.ssh/miempresa-lightsail-key.pem ec2-user@54.144.25.72 '
  set -euo pipefail
  pm2 stop miempresa-api
  aws s3 cp s3://miempresa-backups-540657241795-staging/pre-releases/pre-empresa-telefono-recibo.sql.gz /tmp/restore.sql.gz --region us-east-1
  DB_PASSWORD=$(aws ssm get-parameter --name "/miempresa/staging/db/DB_PASSWORD" --with-decryption --query Parameter.Value --output text --region us-east-1)
  gunzip -c /tmp/restore.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h localhost -p 5432 -U miempresa -d miempresa_staging -v ON_ERROR_STOP=1
  pm2 start miempresa-api
  rm -f /tmp/restore.sql.gz
'
```

---

## R4 — backend (actuals)

| field | value |
|---|---|
| zip build | `zip -r {appspec.yml,dist,prisma,package.json,package-lock.json,infrastructure/db/scripts,infrastructure/db/utilities}` excluding `*.log`, **`*/generated/*`** (gitignored Prisma client), `*/node_modules/*` |
| artifact | `/tmp/miempresa-staging-empresa-telefono-20260908-195016.zip` — 444539 B / sha256 `c5724cd3cdc6867f0ffcbc786230f5f2bf85fda71fa3e231a28423b80071ccda` — confirmed clean of `generated/` via `unzip -l \| grep generated` (zero matches) |
| S3 URI | `s3://miempresa-artifacts-540657241795-staging/deployments/miempresa-staging-empresa-telefono-20260908-195016.zip` |
| CodeDeploy group | `miempresa-staging` (NOT prod) |
| CodeDeploy id | **`d-MRURUYMLL`** |
| status | **Succeeded** |
| post-deploy migrate status | **32 migrations / up to date** (unchanged, as expected — zero new migrations) |
| pm2 | `miempresa-api` online, `restart_time` reset to **0** (fresh `pm2 start` on deploy, same pattern as prior releases) |
| health | `GET /api/v1/health` → 200 post-deploy |

---

## R5 — frontend (actuals)

```
./frontend/infrastructure/scripts/deploy-frontend.sh --stage staging --region us-east-1 --profile disruptive
Build: 15M output, 2.3M zip → s3://miempresa-frontend-artifacts-540657241795-staging/releases/20260908-195230.zip
Amplify Job ID: 23 → SUCCEED
```

---

## QA (actuals)

| # | Check | Result |
|---|---|---|
| 1 | `GET /empresa` as `qa-contratos` (public subset) | 200 — `{id, nombre, nit, direccion, telefono}`; `telefono: "3135919393"` now present (previously absent from the public DTO) |
| 2 | Staging root + `/centro-costos` HTTP check | 200 / 200 |
| 3 | Live browser (Playwright, temp spec, deleted after run): logged in as `qa-contratos`, opened `/centro-costos/recibo/43` (a QA smoke item created for this check on centro `Mensualidades completas`) | `recibo-empresa` = "EMKASA ABUELITOS FELICES", `recibo-telefono` = "3135919393" — **both render correctly on the live SPA** |
| 4 | Local mocked spec `frontend/tests/centro-costos/recibo-print.spec.ts` (updated this release) | 1/1 PASS locally pre-deploy |

**Cleanup**: QA smoke item id 43 deleted (`DELETE /centro-costos/items/43` as `qa-admin` — CONTRATOS lacks delete permission by design, 403 confirmed then retried as ADMIN, 204). Temp Playwright spec file removed after the run. Staging left in the same data state as before the QA pass (only the new code is new).

**Staging smoke: PASS.**

---

## Rollback (pre-staged, never auto)

- Backend: redeploy prior successful CodeDeploy `d-3IBR2MMHL`.
- Frontend: prior Amplify job 22.
- Data: restore `pre-empresa-telefono-recibo.sql.gz` — not expected to be needed (no schema change, this release cannot corrupt data).

---

## Learnings (fold into future runbooks)

1. **`git add -p` to split a scoped commit out of a file with unrelated pending hunks.** `empresaService.ts` had my telefono change interleaved with an unrelated, already-deployed-from-working-tree `ocultarBeneficiario` revert from an earlier uncommitted session. Piping `y\nn\nn\n` into `git add -p` staged exactly the hunk I wanted without touching the others — useful whenever this repo's "deploy from working tree, commit later/less often" convention leaves multiple features mixed in one file.
2. **PrimeVue form fields need their real DOM target, not the wrapper id.** `page.locator('#password')` resolved to the `<div class="p-password">` wrapper, not an actual input — Playwright's `.fill()` correctly refused it. Use `#password input` (or a `data-testid` on the inner control) for any PrimeVue `Password`/similar composite component.
3. **Creating a throwaway QA item via raw `curl` needs the same required-field chain the UI would supply implicitly** — `valorUnitario` and `beneficiarioClienteId` were both required by `createItemSchema` for an INGRESOS centro with `ocultarBeneficiario=false`, neither obvious from the task at hand. Fetching one real `cliente_id` via a read-only SQL check was faster than guessing.
4. **Item deletion is ADMIN-only, not CONTRATOS** — confirmed via a live 403, then cleaned up with the `qa-admin` session. Matches this codebase's general pattern of "CONTRATOS creates, ADMIN deletes" for centro-costos items.
5. **Test-in-a-restricted-testDir**: Playwright's `testMatch: '**/*.spec.ts'` under `testDir: './tests'` means any throwaway staging-verification spec must live under `frontend/tests/**` (not `/tmp`) to be discovered — placed one temporarily under `tests/centro-costos/_tmp-*.spec.ts` and deleted it immediately after the run, together with its `test-results/` artifact.

---

## Grep hooks

```
empresa-telefono-recibo staging-release sep-8
d-MRURUYMLL amplify-job-23 32-migrations-unchanged
pre-empresa-telefono-recibo.sql.gz
EmpresaPublic toPublicEmpresa telefono recibo-telefono
git add -p scoped-commit unrelated-hunk
```
