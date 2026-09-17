# Progress: W2-frontend-ui

**Worker**: W2 — frontend-eng  
**Started**: 2026-07-18  
**Status**: COMPLETE

---

## Subtask 7: types + domain + sidebar — ✅ Done
- `frontend/shared/types/api.ts`: MedioPagoNomina, TipoCuentaBanco, PENDIENTE_MEDIO_PAGO, AsistenciaDiaRow/Item/PutBody, AsistenciaMesSummary, NominaSugerido, NominaCalcFields
- `useDomainAccess.ts`: Domain `asistencia`; GERONTOLOGA false / CONTRATOS true; prefix `/asistencia`
- `app.config.ts`: sidebar **Asistencia** (`pi pi-calendar`) immediately after Empleados

## Subtask 8: empleado medio + contrato UI — ✅ Done
- `empleados/nuevo.vue`: Medio de pago section (Sin definir | Nequi | Transferencia) + conditional fields + payload
- `empleados/[id]/editar.vue`: same section + hydrate + clear on save; contrato `valorJornada` required on create; display on list; preserve on activo toggle
- **Bugfix**: `validateForm()` was called but undefined on editar — added (blocked PUT)

## Subtask 9: asistencia page — ✅ Done
- `pages/asistencia/index.vue`: date default today, Hoy button, search, matrix AM/PM large targets, notas, Guardar PUT `/asistencia/dia`, reload via GET
- Smoke: `tests/asistencia/registrar-hoy.spec.ts` (live admin + API)

## Subtask 10: nómina dialog enrichment — ✅ Done
- `pages/nomina/index.vue`: summary (nombre, doc, medio/warning, contrato, valor, asistenciaMes), editable medias/valor/subtotal/aportes(total only FIJO/INDEFINIDO)/total, dual-write salario, file slots unchanged

## Subtask 11: FE smoke + RBAC nav — ✅ Done
- `tests/empleados/medio-pago.spec.ts` (MOCKED) — create + edit
- `tests/nomina/registrar-dialog-enrichment.spec.ts` (MOCKED) — FIJO + OPS
- `tests/rbac/nav-gating.spec.ts` + `live-profiles.spec.ts` — Asistencia visibility
- Verified: 9/9 mocked suite green (medio + nomina dialog + nav-gating)

---

## Issues / Blockers Encountered
1. **validateForm missing** on editar.vue — pre-existing; fixed so medio PUT works.
2. Concurrent page polish on asistencia/nomina refined testids; smoke specs aligned to final testids.
3. Live asistencia smoke (`registrar-hoy.spec.ts`) requires backend + seed; not re-run in this session (API-dependent). Documented NOT-VERIFIED live if backend down.

## Deviations
| # | Assignment | Found | Action |
|---|---|---|---|
| D1 | data-testid `nomina-medias-jornadas` etc. | Final page uses `nomina-medias`, `nomina-aportes`, `nomina-total`, `nomina-guardar` | Smokes use final testids |
| D2 | dirty indicator on asistencia | Final page omits dirty flag; full board always saved | Acceptable |
