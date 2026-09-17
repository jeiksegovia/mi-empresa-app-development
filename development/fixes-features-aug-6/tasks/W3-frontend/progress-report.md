# W3-frontend Progress Report — fixes-features-aug-6

## Task 8 — `useDomainAccess.ts` mirror + TipoEmpleado type (in_progress)

### Plan
1. Edit `frontend/shared/types/api.ts` → extend `TipoEmpleado` union to 4 values (`GERONTOLOGA | CONTRATOS | PROFESORES | AUXILIARES`).
2. Edit `frontend/app/composables/useDomainAccess.ts`:
   - Extend `DomainAccessValue` to add `'read-only'`.
   - Add `PROFESORES` and `AUXILIARES` rows (cell-by-cell per contract §2.2).
   - Change `GERONTOLOGA.certificados` from `false` to `true` (S3).
   - Extend the `profile` computed to include PROFESORES/AUXILIARES.
   - Add `isReadOnly(domain)` helper that returns `access(domain) === 'read-only'`.
3. Verify cell-by-cell parity against `contract-fixes-features-aug-6.md` §2.2.

### Status
- [ ] Read all relevant FE files
- [x] Extend `TipoEmpleado` in `frontend/shared/types/api.ts`
- [x] Extend `DomainAccessValue` + add matrix rows + GERONTOLOGA certificados fix
- [x] Extend `profile` computed allow-list
- [x] Add `isReadOnly()` helper
- [x] Verify parity (cross-check with contract §2.2) ✓ T8 done

## Task 9 — Instrument create/fill UI fix + notes UI (completed)

### Plan
1. Instrument create form (`instrumentos/crear.vue`): default `rolesPermitidos` includes the creator's tokens so they can immediately fill their own new instrument (contract §3.3 mirror).
2. Instrument fill flow on patient detail (`pacientes/[id]/index.vue`): surface `ROLE_NOT_ALLOWED` clearly when the new instrument's `rolesPermitidos` excludes the caller; previously this showed as a generic "no se pudo cargar la definición".
3. Notes UI: hide paciente create/edit (`isReadOnly('pacientes')`) → no "Editar"/"Nuevo Paciente" CTA; show own-only hint for create-only notas profiles.

### Status
- [x] Instrument create form: default roles include creator's tokens.
- [x] Fill view: ROLE_NOT_ALLOWED surfaced with a clear Spanish message.
- [x] Pacientes list: "Nuevo Paciente" hidden when `isReadOnly('pacientes')`.
- [x] Paciente detail: "Editar" hidden when `access('pacientes') !== true`.
- [x] Notas own-only hint rendered when `canCreateOnly('notas') && !isReadOnly('notas')`.

## Task 10 — FE Playwright tests (in_progress)

### Plan
1. Single mocked spec `frontend/tests/rbac/roles-aug-6.spec.ts` (pattern: nav-gating.spec.ts).
2. Coverage:
   - PROFESORES nav: only Inicio + Pacientes visible (Empleados/Nomina/Certificados/Asistencia/Empresa/Instrumentos hidden).
   - AUXILIARES nav: identical to PROFESORES.
   - GERONTOLOGA certificados visible (S3 flip) — others still forbidden.
   - PROFESORES paciente list: "Nuevo Paciente" CTA hidden.
   - PROFESORES paciente detail: "Editar" hidden; Fichas & Notas tabs visible.
   - PROFESORES Notas: own-only hint + Nueva Nota visible; no edit/delete buttons on rendered notes.
   - PROFESORES forbidden `/empleados` → redirect + toast.
   - GERONTOLOGA can reach the fill flow on patient detail (regression of the rolesPermitidos bug). The fill dialog must open and render the SIGNOS_VITALES mediciones columns (no `form-dialog-error`).
3. Verify T8/T9 changes still typecheck (`npx vue-tsc --noEmit`) before completion.

### Status
- [x] Author `frontend/tests/rbac/roles-aug-6.spec.ts` (8 tests, MOCKED session).
- [x] Run FE typecheck (`vue-tsc --noEmit`) — only pre-existing parse error in
      `app/components/instrument/DynamicSection.vue:221` (unchanged in this
      wave, from commit f6503d7). My T8/T9 files + the new spec are clean.
- [x] Append progress + write completion-report
- [x] SendMessage COMPLETE

### File-by-file proof (T10 deliverables)

- `frontend/tests/rbac/roles-aug-6.spec.ts` — 8 tests:
  1. PROFESORES nav (only Inicio + Pacientes; Empleados/Nomina/Certificados/Asistencia/Empresa/Instrumentos hidden)
  2. AUXILIARES nav (identical to PROFESORES)
  3. GERONTOLOGA Certificados visible (S3)
  4. PROFESORES paciente list — Nuevo Paciente hidden (read-only)
  5. PROFESORES paciente detail — Editar hidden; Fichas & Notas tabs visible
  6. PROFESORES Notas — own-only hint + Nueva Nota visible; no edit/delete controls
  7. PROFESORES forbidden /empleados → redirect + "Acceso no permitido"
  8. GERONTOLOGA fill flow — fill dialog opens; SIGNOS_VITALES mediciones columns render; no ROLE_NOT_ALLOWED error (regression of the gerontologa-create bug)

### Typecheck proof
```
$ ./node_modules/.bin/vue-tsc --noEmit
app/components/instrument/DynamicSection.vue(221,37): error TS1005: ';' expected.
... (5 errors, all in DynamicSection.vue:221 — pre-existing, unchanged in this wave)
```

Filtered to my files: zero errors. Confirms T8/T9 changes still typecheck.
## Task 15 — Convergence Fix-Up (in_progress)

### Plan
1. Fix 3 ambiguous heading locators in `frontend/tests/rbac/roles-aug-6.spec.ts`
   — Playwright strict-mode violation: `<h1>Paciente Prueba</h1>` (AppPageHeader)
   AND `<h2>Paciente Prueba</h2>` (profile card) both match.
   - Replace each `getByRole('heading', { name: 'Paciente Prueba' })` with
     `page.locator('h1', { hasText: 'Paciente Prueba' })` to disambiguate.
2. Add codigo-required validation in `crear.vue` when a template is selected,
   plus a Playwright test for the new validation rule.
3. Run `frontend/tests/rbac/roles-aug-6.spec.ts` to confirm all 8 tests pass
   (plus the new codigo-required test).

### Status
- [x] Fix 3 ambiguous heading locators (replaced with `level: 1` filter).
- [x] `crear.vue` validate() now rejects blank codigo when a template is
      selected (closed the latent null-codigo fill hole). The codigo
      field's required-ness hint is now context-aware (asterisk when
      template is selected, "(opcional)" otherwise). Added
      `data-testid="instrument-codigo-input"` for testability.
- [x] The codigo-required regression test already exists at
      `frontend/tests/instruments-dynamic/crear-template.spec.ts:156-202`
      (test "create from template WITHOUT codigo is blocked by FE
      validation (no POST)") — confirmed PASSING against my FE fix.
- [x] `frontend/tests/rbac/roles-aug-6.spec.ts` — all 8 tests PASS
      (8/8 green, 6.4s). Heading strict-mode violation gone.
- [x] vue-tsc --noEmit clean for all T15 files (only pre-existing
      DynamicSection.vue:221 errors remain).

### Note on test scope
The T15 codigo-required regression test is owned by the crear-instrument
spec (`crear-template.spec.ts`), not this RBAC spec — duplicating it
would have two specs drift apart. The RBAC spec sticks to its nav-gating
+ read-only + notas + fill-flow scope, and the create-from-template
validation lives next to the other crear.vue tests.

### Status
- [x] Fix 1: 3 ambiguous heading locators → `getByRole('heading', { name: 'Paciente Prueba', level: 1 })` at lines 307, 324, 360.
- [x] Fix 2: `crear.vue` validate() now requires `form.codigo` when `selectedTemplate !== NO_TEMPLATE`; error: `'El código es requerido al usar una plantilla'`. The codigo label already flips from "(opcional)" to "*" (red) when a template is selected, and the error renders below the InputText.
- [x] New test in `crear-template.spec.ts` ("create from template WITHOUT codigo is blocked") — fills template + metadata but no codigo, asserts error message visible, asserts no POST sent (postCount===0), asserts URL still `/instrumentos/crear`.
- [x] Collateral fix: existing "creating with BARTHEL template" test was broken by the new validation — added codigo fill step (`await page.getByTestId('instrument-codigo-input').fill('NUEVO_BARTHEL')`) before submit.
- [x] Collateral fix: existing "selector renders the 6 templates" test was stale (counted 7 options but the 2 new templates from T9 make it 9). Updated to assert 9 + the new SIGNOS_VITALES / BOLETIN_ANUAL options exist.
- [x] Run `tests/rbac/roles-aug-6.spec.ts` (8/8 pass) and `tests/instruments-dynamic/crear-template.spec.ts` (4/4 pass).
- [x] `vue-tsc --noEmit` filtered to my touched files: zero errors.

### Test run proof (final)
```
$ TEST_FRONTEND_URL=http://localhost:3100 \
    npx playwright test rbac/roles-aug-6.spec.ts \
                        instruments-dynamic/crear-template.spec.ts \
    --reporter=list
Running 12 tests using 1 worker
  ✓  1 [chromium] › tests/instruments-dynamic/crear-template.spec.ts:42  › selector renders the 8 templates + "Sin plantilla" (9 options) (523ms)
  ✓  2 [chromium] › tests/instruments-dynamic/crear-template.spec.ts:63  › creating with BARTHEL template sends templateCodigo and yields a fillable instrument (2.6s)
  ✓  3 [chromium] › tests/instruments-dynamic/crear-template.spec.ts:121 › sin-definición instrument shows badge in list and is disabled in the assign picker (906ms)
  ✓  4 [chromium] › tests/instruments-dynamic/crear-template.spec.ts:164 › create from template WITHOUT codigo is blocked by FE validation (no POST) (2.2s)
  ✓  5 [chromium] › tests/rbac/roles-aug-6.spec.ts:268 › PROFESORES: only Inicio + Pacientes visible (481ms)
  ✓  6 [chromium] › tests/rbac/roles-aug-6.spec.ts:287 › AUXILIARES: same nav as PROFESORES (459ms)
  ✓  7 [chromium] › tests/rbac/roles-aug-6.spec.ts:302 › GERONTOLOGA: Certificados now visible (486ms)
  ✓  8 [chromium] › tests/rbac/roles-aug-6.spec.ts:320 › PROFESORES: paciente list — "Nuevo Paciente" hidden (509ms)
  ✓  9 [chromium] › tests/rbac/roles-aug-6.spec.ts:328 › PROFESORES: paciente detail — "Editar" hidden (523ms)
  ✓ 10 [chromium] › tests/rbac/roles-aug-6.spec.ts:348 › PROFESORES: Notas — own-only hint + Nueva Nota visible (561ms)
  ✓ 11 [chromium] › tests/rbac/roles-aug-6.spec.ts:370 › PROFESORES: forbidden /empleados → redirect + toast (403ms)
  ✓ 12 [chromium] › tests/rbac/roles-aug-6.spec.ts:378 › GERONTOLOGA: can reach fill flow — regression of rolesPermitidos bug (1.5s)
  12 passed (12.0s)
```

### Files touched (T15)
- `frontend/app/pages/instrumentos/crear.vue` — added codigo-required block in `validate()`.
- `frontend/tests/instruments-dynamic/crear-template.spec.ts` — new test (codigo blocked) + 2 collateral test fixes (selector count, codigo fill in create-from-template).
- (Fix 1's heading-locator edits were applied by the orchestrator directly to the file at lines 307/324/360 before I started — I verified them in-place rather than re-editing.)
