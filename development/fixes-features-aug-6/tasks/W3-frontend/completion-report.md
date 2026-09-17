# W3-frontend Completion Report — fixes-features-aug-6

## Status
DONE — all T8, T9, T10, T15 acceptance criteria met and verified on disk.

---

## T15 — Convergence Fix-Up (this report's primary scope)

## Summary

Closed two issues found by the orchestrator when running the suites:

1. **Fix 1 — Test defect (locator):** 3 Playwright strict-mode violations in
   `frontend/tests/rbac/roles-aug-6.spec.ts` caused by
   `getByRole('heading', { name: 'Paciente Prueba' })` matching BOTH an `<h1>`
   (AppPageHeader `patient.nombre`) AND an `<h2>` (profile-card `patient.nombre`).
2. **Fix 2 — Latent null-codigo hole:** `frontend/app/pages/instrumentos/crear.vue`
   `validate()` did not require `codigo` when a template was selected, so
   `codigo=null` reached the BE and the detail page's `loadDefinition()`
   short-circuited at `if (!codigo)` → "Sin definición — no llenable" even
   though the BE deep-copied a real definition into v1.

## Acceptance criteria — verified

### AC-1: 3 ambiguous heading locators are unambiguous and ALL 8 RBAC tests pass

**Proof:**
```
$ TEST_FRONTEND_URL=http://localhost:3100 \
    npx playwright test rbac/roles-aug-6.spec.ts --reporter=list
Running 8 tests using 1 worker
  ✓  1 tests/rbac/roles-aug-6.spec.ts:268 › PROFESORES: only Inicio + Pacientes visible …  (481ms)
  ✓  2 tests/rbac/roles-aug-6.spec.ts:287 › AUXILIARES: same nav as PROFESORES …         (459ms)
  ✓  3 tests/rbac/roles-aug-6.spec.ts:302 › GERONTOLOGA: Certificados now visible …      (486ms)
  ✓  4 tests/rbac/roles-aug-6.spec.ts:320 › PROFESORES: paciente list — "Nuevo Paciente" hidden (509ms)
  ✓  5 tests/rbac/roles-aug-6.spec.ts:328 › PROFESORES: paciente detail — "Editar" hidden (523ms)
  ✓  6 tests/rbac/roles-aug-6.spec.ts:348 › PROFESORES: Notas — own-only hint + Nueva Nota visible (561ms)
  ✓  7 tests/rbac/roles-aug-6.spec.ts:370 › PROFESORES: forbidden /empleados → redirect + toast (403ms)
  ✓  8 tests/rbac/roles-aug-6.spec.ts:378 › GERONTOLOGA: can reach fill flow — regression of rolesPermitidos bug (1.5s)
  8 passed (12.0s)
```

**What changed (Fix 1):** The 3 offending callsites at lines 307, 324, 360 of
`frontend/tests/rbac/roles-aug-6.spec.ts` now use
`page.getByRole('heading', { name: 'Paciente Prueba', level: 1 })`, which
matches the `<h1>` only. (The orchestrator had already applied this edit
in-place before I started — I verified the diff is correct rather than
re-editing.) **VERIFIED.**

### AC-2: `crear.vue` requires `codigo` when a template is selected

**Code added** in `frontend/app/pages/instrumentos/crear.vue:157-159`:
```ts
if (selectedTemplate.value !== NO_TEMPLATE && !form.codigo.trim()) {
  errors.codigo = 'El código es requerido al usar una plantilla'
}
```

The codigo label already flips from `(opcional)` to `*` (red) when a template
is selected, and the inline `<p v-if="errors.codigo">` already renders the
message. `:invalid="!!errors.codigo"` is already wired on the InputText. No UI
template change required.

**New test added** in `frontend/tests/instruments-dynamic/crear-template.spec.ts`:
```ts
test('create from template WITHOUT codigo is blocked by FE validation (no POST)', …)
```
- Mocks the ADMIN session.
- Picks BARTHEL template.
- Fills `nombreInstrumento`, `tipo`, `periodicidad`. **Intentionally leaves codigo blank.**
- Submits.
- Asserts: `postCount === 0` (no POST sent).
- Asserts: error message `'El código es requerido al usar una plantilla'` is visible.
- Asserts: URL still `/instrumentos/crear` (no navigation).

**Proof:**
```
$ TEST_FRONTEND_URL=http://localhost:3100 \
    npx playwright test instruments-dynamic/crear-template.spec.ts --reporter=list
Running 4 tests using 1 worker
  ✓  1 instruments-dynamic/crear-template.spec.ts:42  › selector renders the 8 templates + "Sin plantilla" (9 options) (523ms)
  ✓  2 instruments-dynamic/crear-template.spec.ts:63  › creating with BARTHEL template sends templateCodigo and yields a fillable instrument (2.6s)
  ✓  3 instruments-dynamic/crear-template.spec.ts:121 › sin-definición instrument shows badge in list and is disabled in the assign picker (906ms)
  ✓  4 instruments-dynamic/crear-template.spec.ts:164 › create from template WITHOUT codigo is blocked by FE validation (no POST) (2.2s)
  4 passed (8.0s)
```

**VERIFIED.**

### AC-3: Typecheck clean for touched files

```
$ ./node_modules/.bin/vue-tsc --noEmit 2>&1 \
    | grep -E "crear\.vue|roles-aug-6|crear-template|instrumentos/\[id\]/index"
(no output — zero errors on touched files)
```

Pre-existing `DynamicSection.vue:221` parse error (unchanged since
commit `f6503d7`, out of scope for T15). **VERIFIED for touched files.**

## Collateral fixes (in `crear-template.spec.ts`)

These two pre-existing failures surfaced once I ran the suite — both were
broken before T15 but weren't part of the orchestrator's failing-3 set, so
I fixed them in the same file rather than leaving the file red.

1. **Selector count test** was asserting 7 options, but `crear.vue` now exposes
   9 (the 2 new templates added in T9 — SIGNOS_VITALES + BOLETIN_ANUAL).
   Updated to `toHaveCount(9)` + assertions that SIGNOS_VITALES and
   BOLETIN_ANUAL options exist.
2. **Create-with-BARTHEL-template test** was not filling `codigo`, which my new
   validation now correctly blocks. Added
   `await page.getByTestId('instrument-codigo-input').fill('NUEVO_BARTHEL')`
   before submit.

Both collateral changes are minimum-required to keep the spec green for the
new contract. They are NOT changes to behaviour — they're updates to test
expectations to match the T9 + T15 contract.

## Files touched (T15)

| File | Change |
|------|--------|
| `frontend/app/pages/instrumentos/crear.vue` | Added codigo-required block in `validate()` (lines 157-159) + comment block. |
| `frontend/tests/instruments-dynamic/crear-template.spec.ts` | New test (codigo blocked) + 2 collateral fixes (selector count, codigo fill). |
| `frontend/tests/rbac/roles-aug-6.spec.ts` | (Orchestrator had already applied the 3 `level: 1` edits in-place; verified, not re-edited.) |
| `development/fixes-features-aug-6/tasks/W3-frontend/progress-report.md` | Appended T15 status + test-run proof. |

## What I did NOT touch

- Backend (`backend/`) — none of the T15 work is BE-side.
- `frontend/app/pages/instrumentos/[id]/index.vue` — the loadDefinition()
  short-circuit on `if (!codigo)` stays as-is (it's the correct
  fail-closed behaviour for a NULL codigo). The fix is on the FE validate()
  side, which is the right place per contract §3.
- `frontend/app/pages/pacientes/[id]/index.vue` — duplicate `<h1>`+`<h2>`
  for `patient.nombre` is intentional (page header + avatar-card title).
  The test fix targets only the locator, not the DOM.

## Deviations from assignment

None. Both fixes match the orchestrator's exact spec:
- Locators disambiguated via `level: 1` ✓
- Error message text: `'El código es requerido al usar una plantilla'` ✓
- New test asserts create-from-template-without-codigo is blocked ✓
- No backend touched ✓
- Specs green before COMPLETE ✓

---

## T8 — `useDomainAccess.ts` mirror + TipoEmpleado type (completed earlier)

- Extended `TipoEmpleado` union to 4 values in `frontend/shared/types/api.ts`.
- Extended `DomainAccessValue` to add `'read-only'`.
- Added `PROFESORES` and `AUXILIARES` rows (cell-by-cell per contract §2.2).
- Changed `GERONTOLOGA.certificados` from `false` to `true` (S3).
- Extended the `profile` computed to include PROFESORES/AUXILIARES.
- Added `isReadOnly(domain)` helper.

## T9 — Instrument create/fill UI fix + notes UI (completed earlier)

- Instrument create form: default roles include creator's tokens (ADMIN + rol + tipoEmpleado).
- Fill view: ROLE_NOT_ALLOWED surfaced with a clear Spanish message.
- Pacientes list: "Nuevo Paciente" hidden when `isReadOnly('pacientes')`.
- Paciente detail: "Editar" hidden when `access('pacientes') !== true`.
- Notas own-only hint rendered when `canCreateOnly('notas') && !isReadOnly('notas')`.

## T10 — FE Playwright tests (completed earlier)

- `frontend/tests/rbac/roles-aug-6.spec.ts` — 8 tests, all passing on disk
  (verified by AC-1 run above).
- Typecheck filtered to my files: zero errors.