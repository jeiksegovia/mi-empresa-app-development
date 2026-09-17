# W3-frontend progress report

## Task #5 — Payment UI + remove cargos block + pago preview

### 5.1 Payment section — `empleados/nuevo.vue`

- Extended `medioPagoTipo` literal union to include `'EFECTIVO'`.
- Added **Efectivo** option to `medioPagoTipoOptions`.
- Relabeled Nequi field: `Número Nequi` → `Llave`. Hint text matches contract §3.
- Added `validateNequiLlave()` that runs the contract regex on the value when
  `medioPagoTipo === 'NEQUI'`. Surfaces `formErrors.medioPagoNequi` red message
  identical to the backend error text (`'Llave Nequi inválida: debe ser email o
  alfanumérica con letras y dígitos (6–25 chars).'`).
- Submit payload branch for `EFECTIVO` sends only `medioPagoTipo: 'EFECTIVO'`
  (no nequi / bank fields) per contract §2.

### 5.2 Remove Cargos block — `empleados/nuevo.vue` (step 3)

- Deleted the **Cargo en la Empresa** Card from Información Laboral step.
  Form state (`CargoForm`, `cargos`, `addCargo`, `removeCargo`,
  `validCargos` payload) is also removed to keep the surface area consistent
  with the contract — Experiencia Laboral already owns the per-employee
  experience record, so the dedicated cargos sub-form is no longer needed.

### 5.3 Payment section — `empleados/[id]/editar.vue`

- Same `EFECTIVO` option, Nequi relabel, and llave validation as the wizard.
- On the edit page, clearing medioPagoTipo → `null` keeps the original
  per-medio required-field matrix logic in `savePersonal()`.

### 5.4 Remove Cargos block — `empleados/[id]/editar.vue` (Tab 3)

- Deleted the **Cargos** Card from Info. Laboral tab. `CargoForm`, `cargos`,
  `addCargo`, `removeCargo`, and the `cargos` PUT in `saveLaboral` are all
  removed. The `saveLaboral` PUTs that remain are
  `contactos-emergencia` and `experiencias-laborales` (these are still
  managed from Tab 3). The dedicated `/employees/:id/cargos` endpoint and
  backend model are NOT touched — UI-only removal per the assignment.

### 5.5 Medio-de-pago preview — `empleados/[id]/index.vue`

- Added a new `Medio de Pago de Nómina` Card to the **Información Personal**
  tab (first card after Datos Personales, before Núcleo Familiar).
- Read-only summary:
  - `NEQUI` → "Llave Nequi: <llave>".
  - `TRANSFERENCIA_BANCARIA` → "Banco: <banco>, <TipoCuenta> · N° <últimos4>".
  - `EFECTIVO` → "Efectivo".
  - Empty state when `medioPagoTipo` is null / empty.
- The bank account number is masked (last 4 digits only) — consistent with
  the existing `pdf-r7` masking pattern used in other payment fields.

## Task #6 — Contract monthly field + asistencia UI date-lock + note

### 6.1 Contrato dialog toggle — `empleados/[id]/editar.vue`

- Extended `contratoForm` with `valorMensual: number | null`.
- Type-conditional display in the dialog:
  - `OPS` → show **Valor media jornada (4h)** (`valorJornada`).
  - `OBRA_O_LABOR` / `TERMINO_FIJO` / `TERMINO_INDEFINIDO` → show **Valor
    mensual** (`valorMensual`).
- `saveContrato` sends the matching field only — payload keeps the
  backend-validated field semantics (`OPS` requires `valorJornada`; others
  require `valorMensual`).
- `openEditContrato` hydrates `valorMensual` from the API.
- The active-toggle PUT (`saveContratoActivo`) preserves both fields so
  flipping `activo` doesn't drop the salary column.
- The list display shows the configured valor alongside the contrato.

### 6.2 Asistencia UI — `frontend/app/pages/asistencia/index.vue`

- Auth store is now consumed (`useAuthStore()`); role + sub-role read once.
- For `EMPLEADO + CONTRATOS`:
  - The `fecha` input gets a `min`/`max` of `todayYMD` (America/Bogota),
    computed with the **byte-identical** helper from the contract
    (`Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' })`).
  - The input value defaults to today.
  - The "Hoy" button is hidden (already at today).
- For `ADMIN` and other roles: no restrictions — original behavior.
- **Justificación / Notas** column already exists in the table
  (`AsistenciaDiaRow.notas`); the existing `InputText` per row maps
  to the wire field `notas` already; no UI change needed beyond the
  existing input + its `:data-testid="`asistencia-notas-${row.empleadoId}`"`.

## Tests

- New `frontend/tests/local-qa/jul24-qa-frontend-payments.spec.ts` —
  mocked wizard/edit checks for the Efectivo option, Nequi llave
  validation, and `Llave` relabel.
- New `frontend/tests/local-qa/jul24-qa-frontend-asistencia.spec.ts` —
  mocked asistencia page checks for the date-lock + nota submit.