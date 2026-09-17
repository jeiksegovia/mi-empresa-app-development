# Staging Release Runbook — QA sep-2 (F1–F5)

**Never** target `miempresa-prod`. Group **`miempresa-staging` ONLY**. Profile `disruptive`, `us-east-1`. Custom domain only.

## What this release ships

| Item | How it lands on staging |
|---|---|
| F1 create-only certificados | CodeDeploy (domainAccess + POST /certificates + FE button) |
| F2 VALORACION_INTEGRAL v2 | JSON in zip + AfterInstall does **not** upgrade. Run `FORCE_UPGRADE=true npm run instruments:upgrade` on instance after R4 |
| F3 typed valorUnitario | CodeDeploy (service + FE dialog) |
| F4 Valoraciones beneficiario | CodeDeploy seed on boot (`applyValoracionesOcultarBeneficiario`) |
| F5 En Casa letterhead | ADMIN PUT `/empresa/:id` after R5 (data, not code) |

No new Prisma migration. Previous: 31+ (`ocultar_beneficiario` already on staging).

## Targets

| Item | Value |
|---|---|
| Profile | `disruptive` |
| CodeDeploy | app `miempresa-app` · group **`miempresa-staging` ONLY** |
| API | `https://miempresa-api-stg.disruptiveexp.com` |
| FE | `https://miempresa-stg.disruptiveexp.com` |
| Amplify | `d1nsxjyualdzdu` branch `staging` |
| Backups | `miempresa-backups-540657241795-staging` |
| Artifacts | `miempresa-artifacts-540657241795-staging` |
| SSH | `~/.ssh/miempresa-lightsail-key.pem` |

## Learnings to apply

- Zip must have `appspec.yml` at root.
- AfterInstall: `npx prisma migrate deploy` only. Instrument upgrade is **not** in AfterInstall (refuses staging unless `FORCE_UPGRADE=true`).
- Login: custom domain, SSM passwords via `get-qa-creds.sh --stage staging --profile disruptive`.
- Never `miempresa-prod`. State the AWS command before executing.

## Phase map

```
R0  health + migrate count + INGRESOS flags (read-only)
R1  pg_dump → S3
R4  CodeDeploy working-tree zip, group miempresa-staging
    then SSH FORCE_UPGRADE=true instruments:upgrade
R5  Amplify frontend + F5 PUT empresa nombre + smoke
```

## Actuals (2026-09-02, profile `disruptive`)

| Step | Result |
|---|---|
| R0 | Health 200. Last CodeDeploy `d-FZP4YFCEL`. FE 200. |
| R1 | `s3://miempresa-backups-540657241795-staging/pre-releases/pre-qa-sep-2.sql.gz` 49960 B sha256 `cd0ada5d44ad10b18778ad97510abd269b92c4ae6d9fdf3ada6e93b511e3a8f3` |
| R4 | Zip `/tmp/miempresa-staging-qa-sep-2-20260902-170119.zip` 306287 B sha256 `23c8380ed219d53ec64fafd361180aa02da9480240d385edb4aa8bf64c446f85`. S3 `deployments/miempresa-staging-qa-sep-2-20260902-170119.zip`. CodeDeploy **`d-3IBR2MMHL` Succeeded** group `miempresa-staging`. Then SSH `FORCE_UPGRADE=true` inserted VALORACION_INTEGRAL v2. |
| R5 | Amplify job **22 SUCCEED**. ADMIN PUT `/empresa/1` `{nombre:"En Casa"}` → **EN CASA**. |

### Staging smoke

- F1: GERONTOLOGA POST `/certificates` 201; PUT 403; CONTRATOS POST 403
- F2: GET `/instruments/VALORACION_INTEGRAL/definition` version **2**; `datos_generales` = fecha_ingreso, rhgs, observacion_ingreso
- F3: CONTRATOS POST mensualidades ítem `valorUnitario=250000` stored (cleaned)
- F4: Valoraciones `ocultarBeneficiario=false`
- F5: CONTRATOS GET `/empresa` nombre **EN CASA**

Local: BE 66 passed (42+24), FE smoke 21/21. Not committed. Not prod.
