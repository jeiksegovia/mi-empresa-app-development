# W2-frontend — result.md (T5 #29 + T6 #30)

**Worker:** W2 (frontend) · **Date:** 2026-07-10 · **Branch host for QA:** `http://100.85.193.33:3100` (see "Auth/host note")

Grep keys: `jul10 W2 single-step ficha C1 C2 C3 E1 uppercase tipoEmpleado descargar-plantilla ficha-single-step-dialog`

---

## Summary

Both tasks implemented and **browser-verified** (0 console errors throughout).

- **T5 (#29)** — Fichas single-step dialog (C1) + descargar plantilla renamed (C2).
- **T6 (#30)** — C3 "crear instrumento" shortcut + return round-trip, E1 uppercase-as-you-type on all listed nombre inputs, tipoEmpleado (API-only — no UI surface exists).

---

## T5 (#29) — Single-step ficha dialog

**File:** `frontend/app/pages/pacientes/[id]/index.vue`

- The old 2-step "Asignar Instrumento" **button was removed**. Selecting an
  instrument from the dropdown now **immediately opens** the combined dialog
  (`data-testid="ficha-single-step-dialog"`).
- On select, the page fetches `GET /instruments/:id` to obtain
  `plantillaArchivo` (not present in the list payload) + the authoritative
  `versionPlantilla` → used as `versionRegistro`.
- Dialog fields: **archivo (REQUIRED)**, notasObservaciones (optional),
  fechaVencimiento (optional). Submit posts to `POST /patients/:id/fichas`
  with `{ instrumentoId, versionRegistro, archivoCompletado, notasObservaciones?, fechaVencimiento? }`
  per contract §5.A → ficha appears as **COMPLETADO** immediately.
- **C2 descargar plantilla**: button (`ficha-descargar-plantilla`) shown only
  when the instrument has `plantillaArchivo`. Downloads via presigned URL,
  fetches the blob and saves it renamed **`{instrumentoNombre}_{pacienteNombre}.{ext}`**
  using an `<a download>` element. If the blob fetch is CORS-blocked it falls
  back to `window.open` + a toast stating the rename convention.
- **Renewals unchanged**: existing rows keep the pencil → status dialog (PATCH)
  flow, including VENCIDO→COMPLETADO. The B6 dialog (`#newEstado`,
  `#notasObservaciones`, `ficha-file-input`) and all jul-8/jul-9 behaviors
  (sessionStorage draft, IDB `useFileStash` row-scoped keys, title-guard) were
  **not touched**.
- No frontend-only VENCIDO staleness workaround existed to remove; estados come
  from the backend (C4 lazy flip) and `validTransitions` already allows
  VENCIDO→COMPLETADO.
- The single-step file also gets an IDB stash (key
  `ficha-single-step:{patientId}:{instrumentoId}:file`) + title-guard for
  Android tab-discard parity; distinct from the renewal dialog's stash.

### New testids added
`ficha-single-step-dialog`, `ficha-descargar-plantilla`,
`ficha-single-step-file-input`, `ficha-single-step-submit`,
`ficha-single-step-notas`, `ficha-single-step-vencimiento`,
`ficha-instrumento-select`, `instrumento-crear-shortcut`.
All pre-existing testids preserved.

### Browser verification (patient id 85, "Paciente T4")
1. Selected "Plan Nutricional" → dialog opened; submit disabled until file
   attached; attached PDF + notas → submit → **registro count 12 → 13**, new
   "Plan Nutricional / NUTRICION" row = **COMPLETADO**, fecha "10 de jul de 2026".
2. Set a plantilla on instrument 42 ("Ficha de Valoración Médica Inicial") and
   reopened → "Descargar plantilla" button appeared → click **downloaded
   `Ficha_de_Valoración_Médica_Inicial_Paciente_T4.pdf`** (exact rename, via
   client-side blob path — S3 CORS allowed the fetch here).
3. Pencil (renewal) dialog still opens with `#newEstado` + `#notasObservaciones`.

---

## T6 (#30)

### C3 — "➕ Crear instrumento nuevo" shortcut
- Appended as the last option of the instrument dropdown in the fichas tab
  (`instrumento-crear-shortcut`). Selecting it routes to
  `/instrumentos/crear?return=<encoded patient path>`.
- `frontend/app/pages/instrumentos/crear.vue`: after a successful create, if a
  `return` query param is present and starts with `/`, navigates back to it
  instead of the instrument detail page.
- **Verified**: from patient 85 → shortcut → URL
  `/instrumentos/crear?return=%2Fpacientes%2F85` → filled + created → **returned
  to `/pacientes/85`**.

### E1 — uppercase-as-you-type (nombre/apellido entity fields)
Pattern used (reliable, no v-model race): `:model-value="X"` +
`@update:model-value="(v) => X = (v ?? '').toUpperCase()"`. No composable/plugin
added (respects the "don't touch composables" constraint).

Files/fields changed:
| File | Field(s) |
|---|---|
| `certificados/crear.vue` | `form.nombre` |
| `instrumentos/crear.vue` | `form.nombreInstrumento` |
| `instrumentos/[id]/editar.vue` | `form.nombreInstrumento` |
| `pacientes/crear.vue` | `form.nombre` |
| `pacientes/[id]/editar.vue` | `form.nombre` |
| `empleados/nuevo.vue` | `step1.nombre`, `step1.apellido` |
| `empleados/[id]/editar.vue` | `form.nombre`, `form.apellido` |
| `empresa/editar.vue` | `form.nombre` |

`descripcion` / `notas` / sub-entity nombres (emergency contacts, family
members, `CargoEmpresa.nombre`) were **left untouched** per contract §4.
**Verified**: typing "prueba jul10 shortcut" → "PRUEBA JUL10 SHORTCUT"; the
created instrument saved with the uppercased nombre (binding works both ways).

### tipoEmpleado — API-only (no UI change)
There is **no user-management / usuarios UI** in the app (grep over
`app/pages/**` + `app/components/**` for `usuario`/`/users`/`tipoEmpleado`/
`GERONTOLOGA` returns nothing; nav has no Usuarios entry). `tipoEmpleado` lives
on `Usuario`, not `Empleado`, so the empleado form does **not** map to it.
Per the assignment's fallback instruction, no Select was added — the field
remains **API-only** (`POST/PATCH /api/v1/users` per contract §5.C). When a
user-management surface is built, add: `Select` options
`[{label:'Gerontóloga', value:'GERONTOLOGA'}]`, clearable, enabled only when
`rol=EMPLEADO`.

---

## Tests

- **jul-8/jul-9 regression** (acceptance #4): `jul8-fichas-*`, `jul8-ficha-file-reset`,
  `jul9-nota-*` → **6 passed, 2 skipped** (skips = no-data guards). Renewal
  flow + draft/stash intact.
  ```
  TEST_FRONTEND_URL=http://100.85.193.33:3100 TEST_API_URL=http://100.85.193.33:3101/api/v1 \
    npx playwright test jul8-fichas jul9-nota jul8-ficha-file-reset
  ```
- **New spec** `tests/local-qa/jul10-ficha-single-step.spec.ts` (3 tests, **all
  pass**): single-step create → COMPLETADO; C3 shortcut return param; E1
  uppercase.
- **Updated** `tests/e2e/paciente-fichas.spec.ts`: the obsolete "should show
  Asignar Instrumento button" test (button removed by design) → rewritten to
  assert the select opens `ficha-single-step-dialog` and submit is disabled
  until a file is attached.

### Known: e2e/paciente-fichas suite fails at its shared login/nav helper
All 7 tests in `e2e/paciente-fichas.spec.ts` (incl. 6 I did not touch) fail
inside `goToPacientes()` — the app logs in fine (failure snapshot shows the
authenticated dashboard) but the helper's `aside nav` "Pacientes" link click
times out (collapsed-sidebar/viewport in headless). This is a **pre-existing
harness issue**, independent of my changes; the equivalent behavior is covered
by the passing `jul10-ficha-single-step` local-qa spec. Left for W3 (T7) to
decide whether to harden the e2e login/nav helper.

---

## Auth/host note (for QA reproduction)
The SPA's API base is the **external IP** `http://100.85.193.33:3101`; the
session cookie is `SameSite=Strict; HttpOnly` and host-only. A browser at
`localhost:3100` therefore sends **no** cookie to the IP API (cross-site) → 401
and redirect to /login. Load the frontend from the **same host** as the API
(`http://100.85.193.33:3100`) so the cookie is same-site. This matches the env
vars the local-qa specs document (`TEST_FRONTEND_URL`/`TEST_API_URL`). No
config was changed (nuxt.config / composables untouched per constraints).

## Test-data side effects (dev DB, id-scoped)
- Patient 85: +1 COMPLETADO "Plan Nutricional" ficha.
- Instrument 42: `plantillaArchivo` set to a real uploaded key (to exercise C2).
- One instrument "PRUEBA JUL10 E1"/"PRUEBA JUL10 SHORTCUT" created via the C3 flow.
All harmless test rows consistent with the existing seed data.

## Acceptance criteria
| # | Criterion | Status |
|---|---|---|
| 1 | Select opens combined dialog; submit creates COMPLETADO in one step | ✅ browser-verified |
| 2 | Descargar plantilla renamed filename (or documented fallback) | ✅ downloaded `Ficha_de_Valoración_Médica_Inicial_Paciente_T4.pdf` |
| 3 | Renewal (pencil) incl. VENCIDO→COMPLETADO still works | ✅ jul8 specs pass + dialog opens |
| 4 | jul8/jul9 fichas specs still pass | ✅ 6 passed / 2 skipped |
| 5 | Uppercase-as-you-type on all listed nombre inputs | ✅ verified + all 8 files edited |
| 6 | C3 shortcut round-trips (crear → back to patient) | ✅ returned to /pacientes/85 |
| 7 | No console errors | ✅ 0 errors throughout |
