# Plan implemented: staging-release-jul18-nomina-asistencia

**Date**: 2026-07-20/21  
**Status**: SHIPPED TO STAGING — all canaries PASS

## Overview
Checkpoint-gated staging release of nomina-asistencia-jul-18 with full DB clean reset, B34/B35 seed-qa fixes, CodeDeploy backend, Amplify frontend, and RBAC/feature canary.

## Phase outcomes
| Phase | Result |
|---|---|
| R-pre | seed-qa-staging.sh bash 3.2-safe + put-parameter --overwrite |
| R0 | Preflight green |
| R1 | DB dump + 1 upload object synced to backups bucket |
| R2 | Clean reset → 23 migrations incl. nomina_asistencia; canonical seed |
| R3 | 3 QA users (ids 5/6/7) + SSM pairs |
| R4 | CodeDeploy **d-8OHAZOPOK** Succeeded; health 200; migrate 23 |
| R5 | Amplify **Job 10 SUCCEED**; 18 routes incl. /asistencia; domains 200 |
| R6 | API + browser canary C1–C4 all PASS; nav-gating 5/5 |

## Key IDs
- Backend deploy: `d-8OHAZOPOK` / miempresa-staging
- Amplify job: `10` / d1nsxjyualdzdu staging
- Pre-reset dump: `pre-resets/pre-reset-staging-20260720-120611.sql.gz`
- Pre-release dump: `pre-releases/pre-jul18-nomina-asistencia.sql.gz`

## Canary summary
- qa-admin: asistencia/nomina/instruments 200; sidebar Asistencia visible
- qa-contratos: asistencia 200; instruments 403 DOMAIN_FORBIDDEN
- qa-gerontologa: asistencia 403 DOMAIN_FORBIDDEN; instruments 200
- Browser nav-gating 5/5 on live Amplify bundle

## Grep hooks
staging-release-jul18-nomina-asistencia d-8OHAZOPOK amplify-job-10 OP-7 B34 B35 seed-qa-staging 20260718100000_nomina_asistencia asistencia canary qa-contratos

## Runbook
`context/implementation-plan/staging-release-jul18-nomina-asistencia-runbook.md`
