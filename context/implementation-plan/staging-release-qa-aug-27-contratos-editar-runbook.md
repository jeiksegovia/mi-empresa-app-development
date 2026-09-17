# Staging Release Runbook — qa-aug-27 CONTRATOS editar (3rd pass)

**Status**: COMPLETE 2026-08-27  
**HEAD**: `745242c` (+ uncommitted duplicate `:disabled` merge on `editar.vue` required for FE build)  
**Scope**: CONTRATOS GET+POST `/empresa/cargos`; nested empleado editar tabs `requireEmployeeUnlocked`; UI cargo required + lock on all Guardar.

## Account / targets
Profile `disruptive` · us-east-1 · CodeDeploy **`miempresa-staging` ONLY** · Amplify `d1nsxjyualdzdu`/staging · backups `miempresa-backups-540657241795-staging` · PEM `~/.ssh/miempresa-lightsail-key.pem`.  
**Never** `miempresa-prod`.

## Risk gate
- **No new migration.** Staging and local both **30** (`20260819025302_centro_costos_aug17_qa` already applied).
- Code-only BE + FE.
- Working-tree zip included dirty ride-alongs (centro-costos, pacientes pages, schema.prisma dirty). Same precedent as aug-6 / aug-17.

## Local validation
`contratos-get-cargos` + `contratos-editar-tabs-unlocked` + `contratos-contratos-role-edit` = **17/17** on `:3101`.

## R0
API 200 · FE 200 · staging migrate 30 up to date · prior BE `d-YRWXPRH7L` · Amplify job 16.

## R1 backup
- `s3://miempresa-backups-540657241795-staging/pre-releases/pre-aug27.sql.gz`
- 44,119 B · sha256 `3c58c977a2ee3327ed075ff7f2fea98e8e1e23729d5ef9488ddb5b3e2ceaa527`

## R4 backend
- Artifact `miempresa-staging-aug27-20260827-164525.zip`
- CodeDeploy **`d-C9QWA4NDL` Succeeded** (group `miempresa-staging` only)
- On-instance: **30 migrations / up to date** (no-op migrate)

## R5 frontend
- First `nuxt generate` failed: duplicate `:disabled` on Hoja de Vida button. Merged to `:disabled="hojaVidaUploading || lockedForMe"`.
- Amplify **job 18 SUCCEED**

## Staging smoke PASS
| Check | Result |
|---|---|
| qa-contratos GET `/empresa/cargos` | **200** n=10 |
| qa-contratos POST cargos | **201** id=18 |
| qa-contratos PATCH cargos | **403 DOMAIN_FORBIDDEN** |
| geronto GET cargos | **403 DOMAIN_FORBIDDEN** |
| CONTRATOS PUT nucleo unlocked | **200** |
| CONTRATOS POST contrato no cargoId | **400** |
| CONTRATOS POST contrato with cargoId | **201** id=16 |
| lock then PUT nucleo | **403 EMPLOYEE_LOCKED** |
| FE `/ /login /empleados` | 200 |

## Rollback
Redeploy `d-YRWXPRH7L` / Amplify job 16; restore `pre-aug27.sql.gz` only if needed.

## Follow-up (not committed)
Duplicate `:disabled` fix in `editar.vue` is **on staging** (job 18) but **not in `745242c`**. Ask developer to commit that one-liner.

## Grep hooks
qa-aug-27 d-C9QWA4NDL amplify-job-18 pre-aug27.sql.gz CONTRATOS POST cargos requireEmployeeUnlocked
