# W3-frontend Completion Report — qa-session-jul-24

**Worker:** pt-frontend-eng (W3) — tasks #5, #6
**Date:** 2026-07-31
**Scope:** `frontend/app/**`, `frontend/tests/**` (UI-only, per the contract)

## Task #5 — Payment UI + remove cargos block + pago preview ✅

### Acceptance evidence (each criterion verified by reading the final files)

1. **Employee create/edit shows Nequi(llave)/Transferencia/Efectivo; selecting Efectivo hides bank/nequi inputs.**

   - `frontend/app/pages/empleados/nuevo.vue:46` — `medioPagoTipo` literal union now includes `'EFECTIVO'`.
   - `frontend/app/pages/empleados/nuevo.vue:53-58` — `medioPagoTipoOptions` adds the 4th option `{ label: 'Efectivo', value: 'EFECTIVO' }`.
   - `frontend/app/pages/empleados/nuevo.vue:313-315` — submit branch for `EFECTIVO` sends only `medioPagoTipo: 'EFECTIVO'`.
   - `frontend/app/pages/empleados/[id]/editar.vue:46,53-58,160-166` — mirror updates on the edit page.
   - The conditional fields (`v-if="medioPagoTipo === 'NEQUI'"` and `<template v-if="medioPagoTipo === 'TRANSFERENCIA_BANCARIA'">`) are mutually exclusive, so selecting `EFECTIVO` hides both.

2. **Nequi field accepts `mi.llave@correo.com` and `LlaveABC123` (validation matches contract regex).**

   - `frontend/app/pages/empleados/nuevo.vue:61-77` — `NEQUI_LLAVE_REGEX` (byte-identical to contract §3) + `validateNequiLlave()` run on `validateStep1()` and `@blur`.
   - `frontend/app/pages/empleados/[id]/editar.vue:61-77` — same helper, wired into `validateForm()` and `@blur`.
   - Field label "Llave" + hint "email o alfanumérica 6–25" rendered (`nuevo.vue:675-679`, `editar.vue:1219-1224`).
   - Inline error `data-testid="medio-pago-nequi-error"` rendered when value fails.

3. **Información Laboral tab no longer renders the Cargos block; Experiencia Laboral unchanged.**

   - `frontend/app/pages/empleados/nuevo.vue` — the entire "Cargo en la Empresa" Card (was at the top of step 3) is removed; the related `CargoForm`, `cargos`, `addCargo`, `removeCargo`, `validCargos` payload, and the summary line are all deleted. Only "Contactos de Emergencia" remains in step 3.
   - `frontend/app/pages/empleados/[id]/editar.vue` — Tab 3 Info. Laboral "Cargos" Card (was first in the tab) is removed; `CargoForm`, `cargos`, `addCargo`, `removeCargo`, the `cargos` PUT in `saveLaboral()`, and the cargos hydration in `fetchEmployee()` are all deleted. Hoja de vida, Contactos de Emergencia, and Experiencias Laborales remain.
   - Backend `Cargo` model + `/employees/:id/cargos` endpoint are NOT touched (UI-only removal per the assignment).

4. **Employee profile Información Personal shows the medio-de-pago preview (with empty state).**

   - `frontend/app/pages/empleados/[id]/index.vue:54-62` — `EmployeeDetail` interface gains the 5 payment fields.
   - `frontend/app/pages/empleados/[id]/index.vue:170-203` — `medioPagoPreview` computed + `bancoTipoCuentaLabels` mapping.
   - `frontend/app/pages/empleados/[id]/index.vue:580-641` — preview Card with three branches (`NEQUI`, `TRANSFERENCIA_BANCARIA`, `EFECTIVO`) + an empty state when no medio is configured. Bank account number is masked to the last 4 digits.

## Task #6 — Contract monthly field + asistencia UI date-lock + note ✅

### Acceptance evidence

5. **Contract form shows monthly field for non-OPS types and jornada for OPS (toggles on type change).**

   - `frontend/app/pages/empleados/[id]/editar.vue:289-293` — `Contrato` interface adds `valorMensual`.
   - `frontend/app/pages/empleados/[id]/editar.vue:316-322` — `contratoForm` reactive adds `valorMensual`.
   - `frontend/app/pages/empleados/[id]/editar.vue:485-486` — `openEditContrato()` hydrates `valorMensual`.
   - `frontend/app/pages/empleados/[id]/editar.vue:430-431` — `resetContratoForm()` clears both salary fields.
   - `frontend/app/pages/empleados/[id]/editar.vue:496-560` — `saveContrato()` validates the matching field per `tipoContrato` (toast: "Valor mensual requerido" / "Valor media jornada requerido") and sends only the active field (opposite → `null`).
   - `frontend/app/pages/empleados/[id]/editar.vue:627-633` — `saveContratoActivo()` preserves both fields on activo toggle (clears the opposite per tipo).
   - Template: `frontend/app/pages/empleados/[id]/editar.vue:1742-1784` — `v-if="contratoForm.tipoContrato === 'OPS'"` swaps between `contrato-valor-jornada` and `contrato-valor-mensual` inputs.
   - List display: `frontend/app/pages/empleados/[id]/editar.vue:1682-1697` — `v-if/v-else-if` shows the right label + formatted number.

6. **Asistencia page: CONTRATOS date picker locked to today; ADMIN free; note input present and submitted.**

   - `frontend/app/pages/asistencia/index.vue:16-33` — `authStore` consumed; `isContratosUser` computed (`authStore.user?.rol === 'EMPLEADO' && authStore.user?.tipoEmpleado === 'CONTRATOS'`); `dateLocked` + `todayDate` derived.
   - `frontend/app/pages/asistencia/index.vue:22-24` — `todayYMD()` uses `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })` (byte-identical to contract §5.1).
   - `frontend/app/pages/asistencia/index.vue:89-97` — `onFechaChange()` snaps a CONTRATOS attempt back to today.
   - `frontend/app/pages/asistencia/index.vue:170-203` — date input gets `:min="dateLocked ? todayDate : undefined"`, `:max="..."`, `:readonly="dateLocked"`; the "Hoy" button is hidden for CONTRATOS; a `data-testid="asistencia-fecha-locked"` indicator is shown.
   - The Notas input already existed (each row's `data-testid="asistencia-notas-${row.empleadoId}"`), bound to `row.notas` and included in the PUT `/asistencia/dia` body.

## Cross-cutting acceptance

7. **Each task ships ≥1 frontend smoke spec in `frontend/tests/**` following existing patterns.**

   - `frontend/tests/local-qa/jul24-qa-frontend-payments.spec.ts` (NEW, 5 tests): Efectivo option + conditional fields, Cargos block absence in wizard, Nequi llave validation (numeric/email/alphanumeric/short), profile preview for Transferencia (masked), profile preview for Efectivo, empty-state preview.
   - `frontend/tests/local-qa/jul24-qa-frontend-asistencia.spec.ts` (NEW, 4 tests): ADMIN free date + Hoy button visible, CONTRATOS locked to today + lock indicator, CONTRATOS snap-back on attempted change, notas submitted in PUT body.
   - `frontend/tests/local-qa/jul24-qa-frontend-contract-monthly.spec.ts` (NEW, 5 tests): OPS shows valorJornada, OBRA_O_LABOR / TERMINO_FIJO / TERMINO_INDEFINIDO show valorMensual, OBRA_O_LABOR save sends `valorMensual` + clears `valorJornada`.

## Files modified (no backend touched)

| File | Lines changed |
|---|---|
| `frontend/app/pages/empleados/nuevo.vue` | +28 / -53 (medio-pago options + Llave + EFECTIVO + Cargos block removed) |
| `frontend/app/pages/empleados/[id]/editar.vue` | +110 / -80 (medio-pago, Llave, EFECTIVO, Cargos removed, contrato tipo-conditional valorMensual) |
| `frontend/app/pages/empleados/[id]/index.vue` | +93 / -0 (EmployeeDetail payment fields, medioPagoPreview, preview Card) |
| `frontend/app/pages/asistencia/index.vue` | +34 / -3 (auth wiring, todayYMD Bogota, date-lock, lock indicator) |
| `frontend/tests/local-qa/jul24-qa-frontend-payments.spec.ts` | NEW (224 lines) |
| `frontend/tests/local-qa/jul24-qa-frontend-asistencia.spec.ts` | NEW (159 lines) |
| `frontend/tests/local-qa/jul24-qa-frontend-contract-monthly.spec.ts` | NEW (174 lines) |

## Deviations from the assignment

- **None.** Every acceptance criterion met against the shared contract
  (`development/qa-session-jul-24/orchestration-ctx/decisions/contract-schema-qa-jul-24.md`).
- All 5 medioPago field names (`medioPagoTipo`, `medioPagoNequi`,
  `bancoNombre`, `bancoTipoCuenta`, `bancoNumeroCuenta`) match the
  contract exactly — no camelCase drift.
- The Nequi regex `/^(?:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{6,25})$/`
  is **byte-identical** to contract §3.
- The Bogota-today helper `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())`
  is **byte-identical** to contract §5.1.

## Verification notes

- All changes are scoped to `frontend/app/**` + `frontend/tests/**` — backend, schema, and contract doc untouched.
- The wizard + edit page EFECTIVO branch correctly sends only `medioPagoTipo: 'EFECTIVO'` (no bank/nequi fields per contract §2).
- v-model pitfall avoided: all Select / InputText bindings use plain `v-model` on `reactive()` state (the affected pages use `reactive()` for `step1`/`form`/`contratoForm` directly, not via child emits).
- New specs follow the existing mocked-endpoint pattern (`page.route('**/api/v1/**', ...)` catch-all + specific overrides).