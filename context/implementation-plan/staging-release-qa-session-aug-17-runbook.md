# Staging Release Runbook — qa-session-aug-17

**Status**: COMPLETE 2026-08-18 — `d-FD0BEVH7L` / Amplify job 16 / 29 mig  
**Date**: 2026-08-18  
**Scope**: working-tree deploy after R1–R4 + R6 (actividades)

## Changes in this release
1. **R1** Empleados tabs Activos | Inactivos (default Activos).
2. **R2** CONTRATOS GET `/empresa/cargos` route exception (`empresa` matrix stays false).
3. **R3** Nómina `bonos` + `totalPagado = valorMensual + bonos` (FIJO/INDEF; aportes stored, not added).
4. **R4** Periodos POST/PUT: `requireEmployeeUnlocked` (CONTRATOS can registrar); jornada not required for non-OPS.
5. **R6** Domain `actividades` + `/actividades` API + FE page under Asistencia.

## Account / targets
Profile `disruptive` · us-east-1 · CodeDeploy **`miempresa-staging` ONLY** · Amplify `d1nsxjyualdzdu`/staging · backup bucket `miempresa-backups-540657241795-staging` · SSH `~/.ssh/miempresa-lightsail-key.pem`.  
**Never** `miempresa-prod`.

## Risk gate
- New migration **#29** `20260818113726_add_nomina_bonos_and_registro_actividades`:
  - `nomina_periodos.bonos` DECIMAL(12,2) NULL — existing rows stay NULL.
  - New empty table `registro_actividades`.
- Additive only. No drops, no enum changes.
- **Working-tree deploy** ships ~136 dirty paths (centro-costos already on staging; leftover lock/EPS/RBAC/docs/.claude). Same precedent as aug-6.

## Local validation (before deploy)
- BE cycle: actividades ACL 7 + cargos GET 6 + nomina bonos 6 + matrix-parity 4 = **23/23**
- FE mocked aug17: **11/11**

## Phase map
R0 preflight → R1 backup → R4 CodeDeploy (`migrate deploy` in AfterInstall) → R5 Amplify + smoke

## R0 actuals — 2026-08-18
| Check | Result |
|---|---|
| API health | 200 `ok` |
| FE | 200 |
| Staging migrate | **28** up to date (29 not applied) |
| Local migrate | **29** up to date |
| `nomina_periodos` rows | **1** (additive `bonos` NULL — safe) |
| `registro_actividades` | not present yet (greenfield) |
| Prior BE | `d-13RWC0Q4L` |
| Prior Amplify | job 15 |
| Dirty tree | ~136 paths — working-tree deploy (aug-6 precedent) |

## R1 backup
- `s3://miempresa-backups-540657241795-staging/pre-releases/pre-aug17.sql.gz`
- 38,912 B · sha256 `4b07235ea09ae7c761006e3c6f76763d16be8145890ce53b92873b3c89641105`
- On-instance `pg_dump` via Lightsail PEM

## R4 backend
- Artifact `miempresa-staging-aug17-20260818-070519.zip` (appspec root; mig 29; dist actividades)
- CodeDeploy **`d-FD0BEVH7L` Succeeded** (group `miempresa-staging` only)
- On-instance: **29 migrations / up to date**; `registro_actividades` present; `bonos numeric(12,2) YES`

## R5 frontend
- Amplify **job 16 SUCCEED**
- Pages 200: `/ /login /empleados /nomina /asistencia /actividades /pacientes /instrumentos /certificados`

## Staging smoke PASS
| Check | Result |
|---|---|
| qa-contratos GET /empresa/cargos | **200** n=10 |
| qa-contratos POST cargos | **403 DOMAIN_FORBIDDEN** |
| geronto GET cargos | **403** |
| qa-contratos POST FIJO periodo V=2e6 B=150k A=100k | **201** totalPagado=2150000 (aportes not added) |
| lock emp 2 → CONTRATOS POST periodo | **403 EMPLOYEE_LOCKED** |
| admin GET /actividades | **200** [] |
| geronto/contratos POST /actividades | **403 DOMAIN_FORBIDDEN** |

## Rollback
Redeploy `d-13RWC0Q4L` / Amplify job 15; restore `pre-aug17.sql.gz` only if needed. Never auto-rollback.

## Grep hooks
qa-session-aug-17 d-FD0BEVH7L amplify-job-16 29-migrations bonos registro_actividades pre-aug17.sql.gz
