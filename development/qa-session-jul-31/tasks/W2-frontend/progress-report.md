# W2 frontend progress — qa-session-jul-31

Worker-2 · pt-frontend-eng. Implementing R1/R2/R3 against the contract
(`orchestration-ctx/decisions/contract-schema-qa-jul-31.md`).

## Subtask 1: R1 label rename — ✅ Done

Touch 4 surfaces:
- `empleados/nuevo.vue` — MedioPagoTipo option label updated; value stays `NEQUI`.
- `empleados/[id]/editar.vue` — same option label.
- `empleados/[id]/index.vue` — detail preview "Nequi" → "Nequi/Bre-B".
- `nomina/index.vue` — `medioPagoDisplay` helper updated.

Enum wire value `NEQUI` is unchanged everywhere; payloads and validation regex untouched.

## Subtask 2: R2 nómina dialog Valor-Mensual branch — ✅ Done

- Extended `Contrato` + `NominaSugeridoLocal` interfaces with `valorMensual`.
- Added `usaValorMensual` computed (true for OBRA/FIJO/INDEF).
- Added `valorMensual` to `dialogForm`.
- Updated `recomputeSubtotal` to branch: non-OPS uses `valorMensual` directly,
  OPS keeps medias × valorJornada.
- Updated `openDialog` prefill: non-OPS reads `entrada?.valorMensual ??
  sugerido?.valorMensual ?? contratoActivo?.valorMensual`; OPS path unchanged.
- Updated template: medias + valor inputs hidden on non-OPS, replaced by
  Valor Mensual base input. "Valor media jornada (contrato)" chip now
  OPS-only; non-OPS shows a "Valor mensual (contrato)" chip instead.
- `saveEntrada` payload now includes `valorMensual` for non-OPS, null for OPS.
- Aportes gating unchanged: still FIJO/INDEF only. Total a pagar still
  manually editable in all branches.

## Subtask 3: R3 EPS/Fondo/ARL fields — ✅ Done

- `empleados/nuevo.vue` — added `step1.eps/fondoPensiones/arl` state,
  payload sends trimmed values (omit when blank), 3 `<InputText>` in a
  new "Seguridad Social" sub-section under Datos personales with
  `maxlength="100"`.
- `empleados/[id]/editar.vue` — same 3 fields in `form`, hydrate on
  fetch, PUT always sends (null when blank to match the
  `documentoIdentificacionUrl` pattern).
- `empleados/[id]/index.vue` — added `eps/fondoPensiones/arl` to
  `EmployeeDetail`; new "Seguridad Social" Card on Tab 0 (hidden
  entirely when all three are null so the common case stays compact).
- All fields free-text, no catalog, matching `bancoNombre` pattern.

## Subtask 4: FE Playwright tests — ✅ Done

- `frontend/tests/local-qa/jul31-qa-frontend.spec.ts` — 13 tests,
  all mocked, all passing locally (11.0s):
  - R1 × 4 (wizard, edit, detail, nomina summary)
  - R2 × 5 (one per tipoContrato + a round-trip OBRA save payload)
  - R3 × 4 (wizard input presence, detail card hidden, detail card
    visible, edit hydration + PUT payload uses camelCase keys)
- Regression: jul24 payments spec still passes (5/5).
- One pre-existing jul24 contract-monthly flake (not caused by my
  changes; verified via `git stash` + re-run on `main`).

## Final

All 4 worker tasks (6, 7, 8, 9) completed. Completion report at
`tasks/W2-frontend/completion-report.md`.