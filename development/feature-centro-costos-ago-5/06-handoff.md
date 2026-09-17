# Handoff — feature-centro-costos-ago-5 + aug-17 QA + staging

**Date**: 2026-08-19  
**Local QA**: BE `tests/centro-costos` **44/44**. FE smoke **17/17**.  
**Staging**: CodeDeploy **`d-IUQUHA58L`**, Amplify **job 17**, **30** migrations, catalog **8 INGRESOS**.  
**Backup**: `s3://miempresa-backups-540657241795-staging/pre-releases/pre-centro-costos-aug17.sql.gz` (40943 B, sha256 `f28a061c…d5dd`).

## What shipped

- Dead finance tables replaced (ago-5); aug-17 additive: `fecha`, `precioUnitario`, `habilitarRecibo`, ingreso fields, recibo page.
- CONTRATOS: current Bogotá month ítems only; no balance; no centro CRUD.
- Seed: Transporte → Transporte completo; + 3/4-días mensualidad + transporte 3 días.

## Staging independently re-checked (lead)

8 INGRESOS D12 names; no exact Transporte; 6 EGRESOS; R24 fecha→periodo; CONTRATOS GET current item 200; unpriced INGRESOS 400 `precioUnitario`; FE pages 200.

## Not this release

Prefactura module, IVA, payment splits, reports, nómina ingest, prod.  
Most INGRESOS centros still have **null** `precioUnitario` until ADMIN sets them (expected).  
Pre-existing BE regression fails (empleados/TINETTI/nómina) classified, unrelated.

## Docs

- Contract: `orchestration-ctx/decisions/contract-schema-centro-costos-ago-5.md`
- Runbook: `context/implementation-plan/staging-release-centro-costos-aug17-runbook.md`
- Staging QA: `tasks/W14-staging-qa/`
