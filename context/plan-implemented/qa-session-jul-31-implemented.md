# qa-session-jul-31 — Implemented

**Date**: 2026-08-02 · **Cycle**: QA feedback jul-31 · **Method**: planify-team contract-first, 2 workers.
**Grep hooks**: qa-session-jul-31 Nequi/Bre-B valorMensual nomina-dialog eps fondoPensiones arl seguridad-social usaValorMensual add_empleado_eps_fondo_arl 20260803022244

## High-level overview
Three QA items shipped locally (staging deploy deferred/gated):
- **R1** — Medio de pago label `Nequi` → `Nequi/Bre-B` across empleados/nuevo, empleados/[id]/index, empleados/[id]/editar, nomina/index. Display-only; stored enum value `NEQUI` and validation regex unchanged.
- **R2** — Nómina "Registrar" dialog now branches on `contratoActivo.tipoContrato`: OBRA_O_LABOR / TERMINO_FIJO / TERMINO_INDEFINIDO show **Valor Mensual** as base and hide medias-jornada / valor-jornada inputs; OPS keeps `medias × valorJornada`. Aportes sociales gated to FIJO/INDEF only (OBRA none). Total a pagar prefilled, still manually editable.
- **R2b** — Backend nómina suggestion already surfaced `valorMensual` for non-OPS from jul-24 R7; **no backend code change** — documented in contract for the FE.
- **R3** — Added optional free-text `eps` / `fondoPensiones` / `arl` (VARCHAR(100), nullable) to Empleado; present in Datos personales of nuevo + editar, read-only "Seguridad Social" card on detail.

## Key decisions
- **D1** OBRA_O_LABOR uses Valor Mensual in nómina but has NO aportes (aportes gated to FIJO/INDEF via `nominaService.ts` `APORTES_ALLOWED`).
- **D2** EPS/Fondo/ARL = free-text VARCHAR(100), optional, no enum/catalog (mirrors `bancoNombre`).
- **D3** R1 display-only; `<option value="NEQUI">` and DB enum unchanged.
- **D4** No new routes/services/tables; additive nullable migration only.
- **D5** Centros de costos / cajas (ingresos/egresos) OUT of scope — deferred to a separate cycle (developer decision 2026-08-02).

## Files changed
Backend: `prisma/schema.prisma` (+3 cols on `empleados`), migration `20260803022244_add_empleado_eps_fondo_arl`, `src/services/employeeService.ts`, `src/routes/employees.routes.ts`.
Frontend: `app/pages/empleados/nuevo.vue`, `app/pages/empleados/[id]/editar.vue`, `app/pages/empleados/[id]/index.vue`, `app/pages/nomina/index.vue` (added `usaValorMensual` computed, `dialogForm.valorMensual`, Valor-mensual chip, saveEntrada payload).
Tests: `backend/tests/employees/empleado-eps-fondo-arl.spec.ts` (4), `backend/tests/nomina/nomina-sugerencia-valormensual.spec.ts` (3), `frontend/tests/local-qa/jul31-qa-frontend.spec.ts` (13 mocked).

## Issues resolved / notes
- FE Playwright number-format assertion: es-CO renders `3,000,000` (comma-grouped) — assert rendered string, not wire value.
- Contract-first again produced 0 integration name-mismatches (field names `eps`/`fondoPensiones`/`arl` matched FE↔BE on first pass).

## Known issues NOT fixed (pre-existing / deferred)
- Pre-existing FLAKE: jul-24 `contrato-monthly` FE test "Saving an OBRA_O_LABOR contrato sends valorMensual" times out on `contrato-valor-mensual` locator — fails on `main` too (git-stash verified). Contrato dialog, not nómina dialog; out of scope.
- Deferred: R3 fields absent from wizard step-5 summary; detail Seguridad Social card read-only (edit via editar page).

## Deploy status
NOT deployed. New migration is additive/safe. Staging via `.claude/skills/planify-team/release-protocol.md` (R0→R5, group `miempresa-staging`). Git commit pending explicit user request.

## Source docs
- Cleaned feedback: `context/user-feedback/qa-session-jul-31-cleaned.md`
- Contract (SSOT): `development/qa-session-jul-31/orchestration-ctx/decisions/contract-schema-qa-jul-31.md`
- Handoff: `development/qa-session-jul-31/06-handoff.md`
- Plan: `development/qa-session-jul-31/qa-session-jul-31-plan.md`
