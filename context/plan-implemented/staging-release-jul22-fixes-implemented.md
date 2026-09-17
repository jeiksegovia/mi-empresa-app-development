# Plan implemented: staging-release-jul22-fixes

**Date**: 2026-07-22  
**Status**: SHIPPED TO STAGING — R0–R6 PASS

## Overview
Additive staging release of **fixes-jul-22** (no DB wipe). Backend CodeDeploy + instruments:upgrade (TINETTI v2, MNA v2, VALORACION_INTEGRAL) + frontend Amplify + RBAC canary.

## IDs
| Resource | Value |
|---|---|
| CodeDeploy | **`d-WSU9IQ3QK`** Succeeded |
| Amplify | **job 11** SUCCEED (`d1nsxjyualdzdu` staging) |
| Migrations | 23 (unchanged) |
| Backup | `pre-releases/pre-jul22-fixes.sql.gz` sha256 be6207a1… |
| BE artifact | `deployments/jul22-fixes-20260722-210352.zip` |
| FE artifact | `releases/20260722-210839.zip` |

## Canary (PASS)
- CONTRATOS create patient with estado INACTIVO → persists **ACTIVO**
- CONTRATOS PUT estado / GET instruments → **403**
- GERONTOLOGA PUT estado → 200; instruments 200; asistencia **403**
- ADMIN full access; asistencia 200; TINETTI/MNA v2 + VALORACION definitions 200

## Runbook
`context/implementation-plan/staging-release-jul22-fixes-runbook.md`

## Grep hooks
staging-release-jul22-fixes d-WSU9IQ3QK amplify-job-11 PATIENT_STATE_FORBIDDEN TINETTI.v2 MNA_CUADRO.v2 VALORACION_INTEGRAL instruments:upgrade
