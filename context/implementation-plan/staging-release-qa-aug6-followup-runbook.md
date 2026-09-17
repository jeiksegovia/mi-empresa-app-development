# Staging Release Runbook — qa-aug-6 followup (CONTRATOS contratos edit + instrument v2)

**Status**: IN PROGRESS
**Date**: 2026-08-06
**Scope**: working-tree deploy after qa-aug-6 feedback

## Changes in this release
1. **CONTRATOS contratos CRUD** — `nomina.routes.ts` POST/PUT/DELETE `/employees/:id/contratos*` no longer `requireRole('ADMIN')`; uses `requireEmployeeUnlocked` so CONTRATOS can edit when unlocked; locked still 403 EMPLOYEE_LOCKED.
2. **SIGNOS_VITALES.v2 + BOLETIN_ANUAL.v2** — drop redundant patient personal fields (cédula/nombre/edad/sexo); patient data comes from paciente entity. Boletín keeps only periodo año + components + autor.

## Account / targets
Profile `disruptive` · us-east-1 · CodeDeploy **`miempresa-staging` ONLY** · Amplify `d1nsxjyualdzdu`/staging · backup bucket `miempresa-backups-540657241795-staging`.

## Risk gate
- No new migration (instrument versions via instruments:upgrade only).
- Code change only on nomina contratos guards + template JSON v2.
- Low risk; lock behavior preserved.

## Phase map
R0 preflight → R1 backup → R4 CodeDeploy + instruments:upgrade → R5 Amplify + smoke

## Actuals — 2026-08-14 COMPLETE

### Local validation (before deploy)
- contratos-contratos-role-edit: **5/5**
- signos-boletin-v2-no-paciente: **2/2**
- empleado-bloqueo regression: **7/7**
- rbac/aug6-features regression: **25/25**

### R0
- API=200 FE=200 · staging migrations 28 up to date · prior deploy `d-MR1QVXIZK`

### R1 backup
- `s3://miempresa-backups-540657241795-staging/pre-releases/pre-aug6-followup.sql.gz`
- 37,666 B · sha256 `e6450eeb339bfd6ca756b27623a1533294273e58335559e783a00e46c0a91815`

### R4 backend
- CodeDeploy **`d-13RWC0Q4L` Succeeded** (group `miempresa-staging` only)
- instruments:upgrade: SIGNOS_VITALES **v2 active**, BOLETIN_ANUAL **v2 active**

### R5 frontend
- Amplify **job 15 Succeeded**

### Staging smoke PASS
| Check | Result |
|---|---|
| qa-contratos POST contrato (unlocked) | **201** id=7 |
| qa-contratos POST contrato (locked) | **403 EMPLOYEE_LOCKED** |
| SIGNOS definition sections | `['mediciones']` — no paciente |
| BOLETIN definition sections | `['periodo','componentes','autor']` — no personal fields |

### Rollback
Redeploy `d-MR1QVXIZK` / Amplify job 14; restore `pre-aug6-followup.sql.gz` only if needed.
