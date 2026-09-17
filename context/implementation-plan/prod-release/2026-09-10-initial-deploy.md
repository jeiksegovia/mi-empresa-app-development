# Prod initial deploy — 2026-09-10

**Type**: first prod environment (infra + first app + seeds). Later prod *app* releases use one dated file only (`YYYY-MM-DD-<slug>.md`) with commands, actuals, learnings, stack state. Phase templates (`p0`–`p6`) stay here as initial-deploy history.
**Profile / region**: `disruptive` / `us-east-1` · account `540657241795`
**CodeDeploy group**: `miempresa-prod`
**HEAD**: `d49573f` · working-tree zip (~192 dirty)

**Status**: COMPLETE with notes. Custom FE domain HTTP 200; Amplify association still `AWAITING_APP_CNAME`.

Client logins: `backend/prisma/prod-db/accounts-prod.md` (**gitignored**, passwords).

---

## P0 — Preflight — PASS

See `p0-preflight.md`. Clean slate. 32 mig. tsc 0. Local health 200. Prod CD group empty.

---

## P1 — Foundation — PASS

```bash
backend/infrastructure/db/scripts/deploy-infrastructure.sh --stage prod --region us-east-1 --profile disruptive
```

| Stack | Result |
|---|---|
| `miempresa-iam` | no-op |
| `miempresa-s3-prod` | CREATE_COMPLETE |
| `miempresa-ssm-prod` | CREATE_COMPLETE |
| `miempresa-codedeploy` | no-op (later UPDATE for tag-filter fix) |

Buckets: `miempresa-artifacts/backups/uploads-540657241795-prod`.
`CORS_ORIGIN=https://miempresa.disruptiveexp.com`. `LOG_LEVEL=info`.

---

## P2 — Lightsail — PASS

```bash
backend/infrastructure/db/scripts/create-instance.sh --stage prod --bundle micro_3_0 --profile disruptive
```

| Item | Value |
|---|---|
| Instance | `miempresa-backend-prod` running |
| Static IP | `miempresa-ip-prod` **44.195.227.44** |
| Firewall | 22 + 3001; 5432 closed |
| B16 | `[bootstrap]` still present after **two** refresh cycles |
| Identity | `assumed-role/CodeDeployInstanceRole/miempresa-backend-prod` |
| DB | SecureString `DB_PASSWORD` / `DATABASE_URL` (not PLACEHOLDER) |
| On-prem | tagged `Environment=prod` |

---

## P3 — Backend CodeDeploy

Zip `/tmp/miempresa-prod-20260910-223427.zip` 561843 B sha256 `6e7d0ca5d01020e1155322484889585c6ea29adbf2f70154227a67a7ccf1187b`.
S3 `s3://miempresa-artifacts-540657241795-prod/deployments/miempresa-prod-20260910-223427.zip`.
No `generated/`, no `prisma/prod-db/`, `appspec.yml` at root.

**First attempt `d-85ZG7B1NL` FAILED** `HEALTH_CONSTRAINTS`. Group tag filters were **OR**: `Environment=prod` **OR** `Application=miempresa`, so staging was targeted. BeforeInstall stopped staging pm2 and deleted `dist/`.

**Staging restore** (manual, not a CodeDeploy): rsync last-good archive `d-FC043YNLL`, `npm ci --omit=dev`, `prisma generate`, copy `src/generated` → `dist/generated`, pm2 start. Public staging API 200 again.

**Fix**: `codedeploy-stack.yml` Environment-only filters. CFN update `miempresa-codedeploy`. Prod group now matches **only** `miempresa-backend-prod`.

**Retry `d-EYN1OE0NL` Succeeded.** Instances: `miempresa-backend-prod` only. Staging stayed 200.

Verify: 32 mig up to date, pm2 online, origin health 200, POST login without `x-origin-verify` → 403.

---

## P4 — Edge — PASS

```bash
aws cloudformation deploy --template-file backend/infrastructure/db/cloudformation/edge-stack.yml \
  --stack-name miempresa-edge-prod \
  --parameter-overrides Environment=prod StaticIp=44.195.227.44 OriginVerifySecret=$OVS \
  --profile disruptive --region us-east-1
```

CREATE_COMPLETE. Dist `E1K9XVIXJIEX6S`. Alias `miempresa-api.disruptiveexp.com`. Origin hostname `miempresa-api-origin.disruptiveexp.com` → `44.195.227.44`. Public API health **200**. No malformed `-prod` / empty-suffix names. Staging DNS unchanged.

---

## P5 — Amplify — PASS (domain association still settling)

```bash
frontend/infrastructure/scripts/deploy-infrastructure.sh --stage prod --region us-east-1 --profile disruptive
frontend/infrastructure/scripts/deploy-frontend.sh --stage prod --region us-east-1 --profile disruptive
```

| Item | Value |
|---|---|
| Stack | `miempresa-frontend-prod` CREATE_COMPLETE |
| App | `dodgibcmo1870` branch `prod` |
| Job | **1 SUCCEED** |
| API_BASE baked | `https://miempresa-api.disruptiveexp.com/api/v1` |
| Default domain | `https://prod.dodgibcmo1870.amplifyapp.com` 200 |
| Custom | `https://miempresa.disruptiveexp.com` HTTP **200** |
| Amplify domainStatus | still `AWAITING_APP_CNAME` (`prefix=miempresa`, IsProd correct) |

R53 has `miempresa.disruptiveexp.com` CNAME + ACM validation CNAME. Login **must** use custom domain (`sameSite=Strict`).

---

## P-SEED-USERS — PASS

`seed-prod.sh` phrase `seed prod foundation`. Users 1–3 ADMIN / CONTRATOS / GERONTOLOGA. `FORCE_UPGRADE` 17 templates; active VALORACION_INTEGRAL **v2**, TINETTI v5.

---

## P-SEED-CATALOG — PASS

`sync-prod-catalog.sh --empresa --cargos --centros`. Empresa id=1 EMKASA NIT 3352434-8. Cargos inserted=15. Centros names already from boot seed (inserted=0). Prices 1.5M / 70k.

---

## P-SEED-STAFF — PASS

`seed-prod-staff.sh`. 12 empleados + INDEF contratos valorMensual=1. 11 AUXILIARES users. Paola ADMIN linked empleado 12. Placeholders: DOB 1990-01-01.

---

## P6 — QA smoke — PASS

POST `/auth/login` via public API + `Origin: https://miempresa.disruptiveexp.com`: ADMIN, CONTRATOS, GERONTOLOGA, Eliana AUXILIARES all **200**. Staging API+FE still 200. Prod FE custom 200.

---

## Learnings

1. **CodeDeploy on-prem tag filters are OR.** Two KEY_AND_VALUE filters (`Environment` + `Application`) match any instance with *either* tag. `Application=miempresa` pulled staging into a prod deploy. Use **Environment only**.
2. **First failed prod deploy can stop staging.** Restore from `/opt/codedeploy-agent/deployment-root/<group>/<id>/deployment-archive` + copy Prisma client to `dist/generated` (AfterInstall does this; a manual restore must too).
3. **IsProd edge branch works** (no-suffix API hostnames, ACM, CloudFront).
4. Amplify custom domain can serve 200 while console still says `AWAITING_APP_CNAME`. Prefer custom domain for login.
5. Seed confirmation phrases: `seed prod foundation` / `sync prod catalog` / `seed prod staff`. Pipe the phrase; scripts are interactive.

---

## Stack state (end)

| Resource | State |
|---|---|
| Lightsail | `miempresa-backend-prod` @ 44.195.227.44 + staging @ 54.144.25.72 |
| CFN prod | s3-prod, ssm-prod, edge-prod, frontend-prod CREATE_COMPLETE |
| CFN global | iam, codedeploy (filters Environment-only) |
| CD prod | `d-EYN1OE0NL` Succeeded (failed `d-85ZG7B1NL` historical) |
| Amplify | `dodgibcmo1870` job 1 SUCCEED |
| DB | 32 mig, 14 usuarios (3 founders + 11 staff), 12 empleados, 15 cargos, 14 centros |
| Staging | API 200 after restore |

---

## Grep hooks

```
2026-09-10-initial-deploy d-EYN1OE0NL d-85ZG7B1NL HEALTH_CONSTRAINTS
OnPremisesInstanceTagFilters OR Application=miempresa
miempresa-backend-prod 44.195.227.44 E1K9XVIXJIEX6S dodgibcmo1870
VALORACION_INTEGRAL v2 accounts-prod.md gitignored
```
