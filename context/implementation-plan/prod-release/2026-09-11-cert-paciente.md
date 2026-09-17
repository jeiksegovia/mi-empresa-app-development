# Prod app release — 2026-09-11 cert attach + patient email

**Type**: later prod *app* release (infra already exists).
**Profile / region**: `disruptive` / `us-east-1`
**CodeDeploy group**: **`miempresa-prod` ONLY** (never `miempresa-staging`)
**Instance**: `miempresa-backend-prod` @ `44.195.227.44`
**HEAD**: `36f27f2` (working-tree zip; FE later commits `68b534b` / Amplify job 2)
**Status**: COMPLETE. Staging stayed 200. Founder API smoke PASS.

Staging gate: `context/implementation-plan/staging-release-sep11-cert-paciente-runbook.md` (CD `d-OCR24VENL`, Amplify job 31). Explicit "yes" in this conversation.

## Why

Prod logs 2026-09-11:

- `gerontologa@` POST `/certificates` 201 then POST `/:id/updates` **403** (empty cert; S3 presign 200). Leftover `requireRole('ADMIN')` on updates.
- `contratos@` POST `/patients` **400** Zod `email` six times (not DOMAIN_FORBIDDEN). Leftover `"correo"` / blank failed `.email()`.

## What shipped

| Layer | Change |
|---|---|
| Matrix | GERONTOLOGA.certificados `'create-only'` |
| Backend cert | POST `/:id/updates` drops ADMIN. PUT/DELETE stay ADMIN. CONTRATOS still 403 on POSTs. |
| Backend patients | email coerce: trim, blank/no-@ omitted |
| FE | Nuevo for create-only; child-owned update draft + `getValue()`; omit placeholder email |
| Migration | none |

## R0 preflight (read-only)

Prod API 200 · FE 200 · prior CD `d-EYN1OE0NL` Succeeded · failed historical `d-85ZG7B1NL` HEALTH_CONSTRAINTS (OR tag filter; group is Environment=prod only now) · Amplify `dodgibcmo1870` job 1 SUCCEED.

## R1 backup

`s3://miempresa-backups-540657241795-prod/pre-releases/pre-sep11-cert-paciente.sql.gz`
33592 B · sha256 `31ae699b204d5eda85c70cf9d16c371faf9a600b478a5e69a60ff4ae861fc075`
32 migrations up to date. hostname stage=prod. DB `miempresa_prod`.

## R4 backend

Zip `/tmp/miempresa-prod-sep11-cert-paciente-20260911-153458.zip` 437529 B
sha256 `ea9fa5627fae5981277e1d50e7376e55dbcb4ae82d18b0b0873a00a9adb06456`
generated/ 0 · prisma/prod-db/ 0 · appspec.yml at root
S3 `s3://miempresa-artifacts-540657241795-prod/deployments/`
CodeDeploy **`d-6TMYLEHNL` Succeeded** · group **`miempresa-prod`** · create 15:35 · complete 15:36
pm2 `miempresa-api` online restarts 0 · cwd `/opt/miempresa/app`
On-instance `router.post('/:id/updates'` has **no** `requireRole('ADMIN')`; PUT/DELETE still ADMIN.
Public origin POST login without `x-origin-verify` **403**. Staging health still 200.

## R5 frontend

`./frontend/infrastructure/scripts/deploy-frontend.sh --stage prod --region us-east-1 --profile disruptive`
Amplify app `dodgibcmo1870` branch `prod` **job 2 SUCCEED** (15:36–15:38).
Custom domain `https://miempresa.disruptiveexp.com` 200. `/certificados` `/pacientes` 200.

## Prod founder smoke PASS (2026-09-11 15:41)

Through CloudFront `https://miempresa-api.disruptiveexp.com`. Founder emails from SSM `/miempresa/prod/founders/*` (passwords not logged).

| Check | Result |
|---|---|
| gerontologa@ login | **200** rol EMPLEADO id 3 |
| gerontologa@ POST `/certificates` | **201** id=3 `SEP11 SMOKE 20260911154113` |
| gerontologa@ POST `/:id/updates` | **201** update id=1 notas present |
| GET `/certificates/3/updates` | **200** len=1 |
| gerontologa@ PUT cert | **403 DOMAIN_FORBIDDEN** |
| contratos@ POST cert / updates | **403 DOMAIN_FORBIDDEN** |
| contratos@ POST `/patients` email=`correo` | **201** id=1 email omitted; ADMIN DELETE 200 |
| FE `/certificados` `/pacientes` | 200 / 200 |
| staging API health | 200 |

## Rollback

Prior prod CodeDeploy `d-EYN1OE0NL`. Amplify job 1. Backup object above.

## Grep hooks

```
sep-11 36f27f2 geronto-updates patient-email
miempresa-prod d-6TMYLEHNL Amplify dodgibcmo1870 job 2
44.195.227.44
```
