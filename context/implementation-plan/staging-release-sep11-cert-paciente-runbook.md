# Staging Release Runbook — sep-11 GERONTOLOGA cert attach + CONTRATOS patient email

**Status**: STAGING API + UI PASS. Amplify job 31 (`68b534b`). CodeDeploy `d-OCR24VENL`. Prod COMPLETE (`d-6TMYLEHNL` / Amplify job 2).  
**Commit**: `36f27f2`  
**Never** target `miempresa-prod` from this file.

## What this release ships

| Layer | Change |
|---|---|
| Matrix | GERONTOLOGA.certificados `'read-only'` → `'create-only'` (BE + FE) |
| Backend cert | POST `/certificates` already open; POST `/certificates/:id/updates` drops `requireRole('ADMIN')`. PUT/DELETE stay ADMIN. CONTRATOS still 403 on POSTs. |
| Backend patients | email coerce: trim, blank/no-@ omitted; valid emails still `.email()` |
| FE | Nuevo Certificado for create-only; patient create/edit omit placeholder email |
| Tests | cert spec 8/8; email coerce 3/3 + patients invalid-email still 400 |

**Migration**: none.  
**Ride-alongs**: working-tree zip (notes list/put/delete in `patients.routes.ts` landed in this commit; other dirty paths still uncommitted). Same convention as sep-8.

## Account / targets

Profile `disruptive` · us-east-1 · CodeDeploy **`miempresa-staging` ONLY** · Amplify `d1nsxjyualdzdu`/staging · backups `miempresa-backups-540657241795-staging` · PEM `~/.ssh/miempresa-lightsail-key.pem` · API `https://miempresa-api-stg.disruptiveexp.com/api/v1` · FE `https://miempresa-stg.disruptiveexp.com`

Rollback: prior CodeDeploy `d-FC043YNLL` / Amplify job 24.

## Local QA (pre-deploy)

- `certificados-read-only.spec.ts` **8/8**
- `contratos-create-email.spec.ts` + patients email cases **9/9** combined with cert grep

## R0 actuals

API 200 · FE 200 · prior CD `d-FC043YNLL` · Amplify job 24 · 32 mig up to date.

## R1 backup

`s3://miempresa-backups-540657241795-staging/pre-releases/pre-sep11-cert-paciente.sql.gz`  
52030 wait **53030** B · sha256 `34f7daa4c3a7849ace7e82fe101622eea0f222de134e2e93714bf4a51c571e0f`

## R4 backend

Zip `/tmp/miempresa-staging-sep11-cert-paciente-20260911-121701.zip` 457007 B  
sha256 `3e04dafd2f86193db9d3e39b295c6ebd0ccb026c8b5bc7356638c8eceaaca5c0` · generated/ 0 · appspec restored  
CodeDeploy **`d-OCR24VENL` Succeeded** · group `miempresa-staging` · 32 mig unchanged  
On-instance POST `/:id/updates` has no `requireRole('ADMIN')`.

## R5 frontend

Amplify **job 25 SUCCEED** · zip `s3://.../releases/20260911-121829.zip`

## Staging smoke PASS

| Check | Result |
|---|---|
| qa-gerontologa POST `/certificates` | **201** id=7 |
| qa-gerontologa POST `/:id/updates` | **201** |
| qa-gerontologa PUT cert | **403 DOMAIN_FORBIDDEN** |
| qa-contratos POST cert / updates | **403 DOMAIN_FORBIDDEN** |
| qa-contratos POST `/patients` email=`correo` | **201** id=6 (email omitted); cleaned up |
| FE `/certificados` `/pacientes` | 200 / 200 |
