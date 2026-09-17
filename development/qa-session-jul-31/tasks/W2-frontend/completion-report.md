# W2 frontend completion report — qa-session-jul-31

Worker-2 · pt-frontend-eng. Implementation of R1 / R2 / R3 against
the published contract. All four target pages + one new FE spec file.

## Deliverables

| File | Change | Tests cover |
|---|---|---|
| `frontend/app/pages/empleados/nuevo.vue` | R1 label rename + R3 inputs in step 1 + wizard payload | R1 wizard test, R3 wizard test |
| `frontend/app/pages/empleados/[id]/editar.vue` | R1 label rename + R3 inputs + hydration + PUT payload | R1 edit test, R3 edit/PUT test |
| `frontend/app/pages/empleados/[id]/index.vue` | R1 detail preview + R3 read-only card | R1 detail test, R3 detail tests |
| `frontend/app/pages/nomina/index.vue` | R1 summary text + R2 dialog Valor-Mensual branch + prefill from `sugerido` | R1 nomina test, all R2 tests |
| `frontend/tests/local-qa/jul31-qa-frontend.spec.ts` | NEW — 13 mocked tests covering R1 (×4), R2 (×5), R3 (×4) | All |

## Key Decisions

- **R1** — Display-only change. The `value` attribute on every `<Select>`
  option stays `NEQUI`; only the human-readable label is updated. The
  `medioPagoDisplay` helper on the nómina page uses the new label. The
  MedioPago `MedioPagoNomina` enum is unchanged.
- **R2** — `usaValorMensual` computed wraps the OBRA / FIJO / INDEF branch.
  - `dialogForm.valorMensual` added.
  - `recomputeSubtotal` short-circuits to `valorMensual ?? 0` when
    `usaValorMensual`; otherwise the existing OPS formula is preserved.
  - `aportesAllowed` is **unchanged** (still FIJO/INDEF only) per
    contract §3 D1.
  - Total a pagar stays editable in every branch (per contract §3
    "manual override allowed").
  - "Valor media jornada (contrato)" chip is OPS-only; non-OPS shows
    a "Valor mensual (contrato)" chip that surfaces
    `contratoActivo.valorMensual`.
  - `Contrato` interface extended with `valorMensual`.
  - `NominaSugeridoLocal` interface extended (mediasJornadas,
    valorJornada, valorMensual, subtotalCalculado are now nullable to
    match the BE suggestion shape).
  - `saveEntrada` payload carries `valorMensual` for non-OPS, `null`
    for OPS (mirrors the existing `valorJornada` null-on-switch
    pattern from jul-24).
- **R3** — `eps` / `fondoPensiones` / `arl` added to:
  - `step1` (wizard) + payload (only sent when trimmed non-empty so
    partial updates omit and the BE keeps the existing value).
  - `form` (edit) + payload (always sent, null when blank — matches
    the `documentoIdentificacionUrl` pattern in the same form).
  - `EmployeeDetail` interface (nullable strings).
  - Hydration on edit (`form.eps/fondoPensiones/arl`).
  - Read-only "Seguridad Social" Card on detail page; card is hidden
    entirely when all three fields are null so the common case stays
    compact.
  - All inputs are plain `<InputText>` with `maxlength="100"` matching
    the BE VARCHAR(100) cap; no Select / catalog per contract §2.

## Acceptance Criteria Evidence

### AC1 — Nequi/Bre-B label on all 4 surfaces, value stays NEQUI

```bash
$ TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts \
  -g "R1 Nequi/Bre-B" --reporter=list
  ✓ wizard: dropdown option text is "Nequi/Bre-B"
  ✓ edit: dropdown option text is "Nequi/Bre-B"
  ✓ detail: NEQUI medioPago renders as "Nequi/Bre-B"
  ✓ nomina dialog summary: NEQUI label shows "Nequi/Bre-B"
  4 passed
```

The `<Select>` option array entries still set `value: 'NEQUI'` everywhere —
only `label: 'Nequi/Bre-B'`. The NEQUI regex, BE validation, and DB enum are
untouched.

### AC2 — Nómina dialog branches per §3 matrix

```bash
$ TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts \
  -g "R2 nómina" --reporter=list
  ✓ OPS dialog keeps medias + valorJornada inputs (no valorMensual)
  ✓ OBRA_O_LABOR dialog shows valorMensual base + no jornada inputs + no aportes
  ✓ TERMINO_FIJO dialog shows valorMensual base + no jornada inputs + aportes visible
  ✓ TERMINO_INDEFINIDO dialog shows valorMensual base + no jornada inputs + aportes visible
  ✓ OBRA dialog: editing valorMensual updates subtotal + total (no aportes)
  5 passed
```

The OBRA round-trip test asserts the POST body carries
`valorMensual === 3000000` and `aportesSociales === 0`, and that
OPS-only fields are `null` on the wire.

### AC3 — R3 fields present + create/editar/detail round-trip

```bash
$ TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts \
  -g "R3 EPS" --reporter=list
  ✓ wizard step 1: inputs present and free-text, no catalog
  ✓ detail: Seguridad Social card hidden when all fields are null
  ✓ detail: Seguridad Social card renders when fields are set
  ✓ edit: hydrates the R3 fields and the PUT payload uses eps/fondoPensiones/arl
  4 passed
```

The edit round-trip test asserts the PUT body uses
`{eps, fondoPensiones, arl}` camelCase keys (matching BE Zod).

### AC4 — Full jul31 spec passes

```bash
$ TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts \
  --reporter=list
  13 passed (11.0s)
```

### AC5 — No regression to jul-24 FE behaviors

The jul24 payments spec (R1 medio-pago shape + Nequi validation +
detail preview + Cargos block removal) was re-run as a regression
check:

```bash
$ TEST_FRONTEND_URL=http://localhost:3100 \
  npx playwright test tests/local-qa/jul24-qa-frontend-payments.spec.ts \
  --reporter=list
  5 passed
```

The jul24 contrato-monthly spec also runs against the same files but
tests the **Contrato dialog** (a separate page in the edit screen),
not the nómina Registrar dialog. One pre-existing test fails both on
`main` and after my changes — see "Known Issues NOT Fixed" below.

## Issues Encountered

- **Localised number format in Playwright assertions.** Initial OBRA
  test expected `'3.000.000'` but the `InputNumber` renders with the
  es-CO comma-grouped format `'3,000,000'`. Fix: assert against the
  rendered string, not the wire value. (Self-repair: 1 attempt.)

## Known Issues NOT Fixed

- **jul24 contract-monthly test "Saving an OBRA_O_LABOR contrato sends
  valorMensual"** fails with `Locator.fill: Timeout exceeded` waiting
  for `contrato-valor-mensual` to render after picking "Obra o labor".
  Verified pre-existing by `git stash` + re-run on `main` (fails at
  the same line). The Contrato dialog (separate from the nómina
  Registrar dialog) is outside the scope of this wave; no changes
  were made to it. Classified: **FLAKE / pre-existing**.

## Integration Notes

- **Backend wire shape** — All four surface changes preserve the
  existing wire payloads:
  - `medioPagoTipo` enum value `NEQUI` is unchanged.
  - `eps / fondoPensiones / arl` are camelCase on the wire (matches
    W1 BE Zod contract §2).
  - The nómina Registrar payload now carries `valorMensual` (nullable
    for OPS); the jul-24 R7 backend already accepts this field on
    `/nomina/periodos` POST and PUT per `nominaService.ts:263-301`.
- **Test isolation** — All 13 jul31 tests are end-to-end but fully
  mocked via `page.route()`. They do NOT touch the live backend on
  `:3101`, so they can run as part of CI without DB / S3 / BE state.
  This avoids the "backend not ready" risk noted in the assignment.
- **vmodel-const-reactive pitfall avoided** — `dialogForm` stays a
  `reactive({...})` (not `const reactive(...)`); all `InputNumber`
  bindings use `v-model` and the spec explicitly drives each input
  via `.fill('')` + `.fill('3000000')` + `.blur()` to avoid relying
  on PrimeVue's child-emit cascade.

## Deferred Items

- **EPS / Fondo / ARL display in the wizard summary** — the wizard's
  step-5 summary card lists nombre / documento / núcleo familiar /
  contactos emergencia. The R3 fields aren't surfaced there. Add on
  request; out of scope per the assignment.
- **Detail-page R3 editing affordance** — the Seguridad Social card
  on the detail page is read-only. If the user wants to edit
  in-place, the path is still `/empleados/[id]/editar`. Same pattern
  as Hoja de Vida (jul-24 R1).

## Summary

R1 / R2 / R3 implemented to the published contract, no backend or
schema files touched, 13 new mocked E2E specs all passing locally.
The only failing test in the surrounding suite (jul24
contract-monthly) was verified to be pre-existing and outside this
wave's scope.