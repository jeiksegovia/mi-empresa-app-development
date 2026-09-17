# Plan implemented: fixes-jul-22

**Date**: 2026-07-22/23  
**Status**: COMPLETE — 62 Playwright pass / 0 fail / 0 product bugs

## Overview
QA Jul-22 feedback: patient estado RBAC for CONTRATOS create + gerontóloga edit; unsaved form leave guard; MNA food-frequency text matrix; Tinetti items 8/11 restructure (v2); VALORACION_INTEGRAL instrument from FORMATOS DE INGRESO first sheet.

## Key decisions
- Hide estado **only on create** for CONTRATOS; server force ACTIVO
- Edit estado: ADMIN + GERONTOLOGA only (`PATIENT_STATE_FORBIDDEN`)
- Instrument changes via **v2** (immutable v1 retained)
- MNA `cellInput: "text"` full N×M grid answers
- Tinetti max total 27 after item-8 merge scores 0/1/0/1

## Deliverables
- Contract: `development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md`
- Handoff: `development/fixes-jul-22/06-handoff.md`
- Templates: TINETTI.v2, MNA_CUADRO.v2, VALORACION_INTEGRAL.v1
- FE: useUnsavedGuard, estado UI gates, DynamicGroupInfoField text mode

## Grep hooks
fixes-jul-22 PATIENT_STATE_FORBIDDEN eq_vuelta_360 ma_pie_derecho cellInput VALORACION_INTEGRAL useUnsavedGuard hideEstadoCreate canEditEstado

## Tests
62 pass (52 BE + 10 FE). No staging deploy in this wave.
