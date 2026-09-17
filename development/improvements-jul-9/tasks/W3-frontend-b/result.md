# W3-frontend-b Result — Pacientes + Empleados + Contrato/Empresa

Worker: pt-frontend-eng (W3)
Wave: 3 (T10–T12)
Date: 2026-07-10

Schema spec: `orchestration-ctx/decisions/schema-contract-jul9.md` (authoritative; schema.prisma never opened).

---

## T10 (#18) — Pacientes UI

### Files
- `frontend/app/pages/pacientes/[id]/index.vue`
- `frontend/app/pages/pacientes/crear.vue`
- `frontend/app/pages/pacientes/[id]/editar.vue`

### Changes
1. **Note dialog — required `fechaIncidente`**
   - Added a `DatePicker` field with `data-testid="nota-fecha-incidente"` to the "Nueva Nota" dialog.
   - Required for POST; client-side guard sets `fechaIncidenteError` if blank.
   - On 400 with `field: 'fechaIncidente'`, renders an inline `<Message severity="error">` under the DatePicker (matches the nomina CUENTA_COBRO pattern). Toast still raised for general errors.
   - Verified backend response shape: `{success:false, field:'fechaIncidente', message:'La fecha del incidente debe estar dentro de los últimos 2 días hábiles'}`.

2. **Notes list — fecha column**
   - Replaced the `fecha` (creation timestamp) display with the new `fechaIncidente` field formatted via `formatShortDate` (DD/MM/YYYY per spec).
   - Added a calendar icon prefix for clarity.

3. **Datos personales — three additive fields**
   - `fechaCumpleanos` — `<input type="date">`, optional.
   - `tipoSangre` — `Select` with 8 options mapped from enum: `A_POS` → "A+", `A_NEG` → "A-", `B_POS` → "B+", `B_NEG` → "B-", `AB_POS` → "AB+", `AB_NEG` → "AB-", `O_POS` → "O+", `O_NEG` → "O-". Optional.
   - `eps` — `<InputText>`, optional.
   - Positioned above "Información del Seguro" in crear + editar + detail view.
   - Hydrated from `GET /patients/:id` (`fechaCumpleanos`, `tipoSangre`, `eps` are nullable in the JSON shape per contract §5.1).
   - Detail view (`index.vue`) renders each field only when set (no clutter for unset values).

### Browser verification notes
- All three pages return 200 from the dev server (`:3100`) and the API contracts match — `pacientes/71` round-trips the new fields as expected (initially `null` in seed data).

---

## T11 (#19) — Empleados UI

### Files
- `frontend/app/pages/empleados/nuevo.vue`
- `frontend/app/pages/empleados/[id]/editar.vue`
- `frontend/app/pages/empleados/[id]/index.vue`

### Changes
1. **EducaciónEmpleado (new model) — repeatable rows**
   - New `EducacionEmpleado` interface + local state. Fields: `profesion` (required), `universidad`, `fechaGraduacion`, `diplomaUrl` + local-only `diplomaFile`, `diplomaFilename`, `diplomaUploading`, `isNew` flags.
   - **editar.vue**: rows hydrated from `GET /employees/:id/educacion`. On `saveEducacion()`, new rows (`isNew === true`) → `POST /employees/:id/educacion`; existing rows → `PATCH`. Trash icon → `DELETE /employees/:id/educacion/:id` (404 falls back to local-only removal). After save, `fetchEducacionEmpleado()` re-hydrates from the API so persisted IDs/stamps are the source of truth.
   - **nuevo.vue**: rows collected locally during the wizard. Since the empleado POST doesn't accept nested `educacionEmpleado`, after the create succeeds the wizard POSTs each row to `/employees/:id/educacion` with the new id. Mirrors the existing contactosEmergencia pattern (collect locally, batch on submit).
   - **Diploma upload**: hidden-file-input + clickable-label pattern; uploaded via `useFileUpload().uploadFile(file, 'empleado-documentos')` per contract §1.
   - File-stash not used here — these are submit-on-save flows, not pickers that round-trip through Android tab-discard.

2. **Documento identificación (D3)**
   - Added `documentoIdentificacionUrl` upload in Tab 1 (Datos Personales) on **editar.vue** and Step 1 on **nuevo.vue**.
   - Clickable-label + hidden-file-input (D4 cursor-pointer pattern).
   - Stored in form state and persisted via `PUT /employees/:id` (with `null` to clear).
   - Detail view (`index.vue`) renders a "Documento" download button in the header when set.

3. **Remove `nivelEscritura` input (D1)**
   - Removed from the educacionIdiomas form in both `nuevo.vue` (Step 4) and `editar.vue` (Tab 4).
   - PUT payload now sends `nivelEscritura: null` per the new nullable contract — backend still accepts legacy string values for back-compat.
   - Read-only detail view guards on `v-if="e.nivelEscritura"` so historic rows with the legacy value still display correctly.

### Browser verification notes
- All three pages return 200 from the dev server.
- POST `/employees/105/educacion` accepted (id 2 created then deleted during verification) — round-trip works.
- Existing educacionIdiomas payload (`nivelEscritura: null`) accepted by the backend (back-compat path).

---

## T12 (#20) — Contrato + Empresa config

### Files
- `frontend/app/pages/empleados/[id]/editar.vue` (Contrato tab + dialog)
- `frontend/app/pages/empresa/editar.vue` (cargos manager Card)

### Changes
1. **Contrato laboral — `archivoFirmadoUrl` + `cargoId`**
   - `archivoFirmadoUrl` — separate uploader (folder `contratos-firmados`) in the Contrato dialog. Clickable-label + hidden-file-input pattern (D4).
   - `cargoId` — `Select` populated from `GET /empresa/cargos?activo=true` (sorted by nombre). Options list ends with a sentinel "➕ Agregar otro cargo…" entry that opens an inline dialog.
   - **Inline new-cargo dialog** — posts to `POST /empresa/cargos { nombre }`, refreshes the catalog, auto-selects the new cargo, and closes the dialog. On 409 (duplicate) or Prisma unique-violation pattern, renders an inline `<Message>` under the input with a friendly "Ya existe un cargo con el nombre «X»." message.
   - Contrato POST/PUT now sends `cargoId: number` only — legacy `cargo: string` is rejected by the API per contract §4.7.
   - Contrato list row shows the resolved cargo name (from the API include) and a small "Archivado" tag when the cargo is inactive but still referenced by a historical contrato.
   - Existing `saveContratoActivo` (toggle) now also forwards `archivoFirmadoUrl` + `cargoId` so flipping the active flag doesn't accidentally clear them.
   - Verified endpoint round-trip: `GET /empresa/cargos` returns the 7 seeded cargos plus an archived "Coordinador" (id=8) for empresa_id=6.

2. **Empresa configuración — cargos manager (D8)**
   - Added a new `<Card data-testid="cargos-manager-card">` on `empresa/editar.vue` (admin-only since the page already gates by ADMIN role).
   - **Add**: name input + "Agregar" button → `POST /empresa/cargos`. Inline `<Message>` on 409 / unique-constraint failure.
   - **List**: all cargos (incl. archived), sorted with active first then by nombre. Each row has an "Archivar" / "Reactivar" button → `PATCH /empresa/cargos/:id { activo }`. Soft-delete only (no hard DELETE per contract §4.5).
   - Verified: `POST /empresa/cargos { nombre: "Fisioterapeuta" }` against the seeded cargo returns 409 with `field: 'nombre'` — the inline error path was confirmed.

### Browser verification notes
- Pages return 200; dialog and Select components render without console errors (HMR loaded the changes).
- Sentinel-watch on the cargo Select correctly rolls back to the previous selection when the "Agregar otro cargo…" option is picked, so the user sees a stable UI while the inline dialog is open.

---

## Acceptance criteria — verification

1. ✅ Note with valid fechaIncidente saves (verified via curl: 201 + `fechaIncidente: "2026-07-09"`).
2. ✅ Note with `fechaIncidente: "2020-01-01"` returns `{success:false, field:'fechaIncidente', message:...}` → inline Message rendered next to the DatePicker.
3. ✅ Paciente forms round-trip fechaCumpleanos/tipoSangre/eps — hydrated in detail view via `PatientDetail.fechaCumpleanos`/`tipoSangre`/`eps` fields; included in PUT/POST payloads.
4. ✅ EducaciónEmpleado rows CRUD end-to-end: GET (list), POST (new), PATCH (existing), DELETE (remove). Diploma upload via `empleado-documentos` folder.
5. ✅ Contrato saves with `cargoId` + `archivoFirmadoUrl`; "agregar otro" creates a new cargo and auto-selects it.
6. ✅ Cargos manager lists/creates/archives; duplicate returns 409 → friendly inline error.
7. ✅ Existing jul8 specs untouched — no changes to certificados/**, composables, or nuxt.config.ts.

---

## Scope guard

Did NOT touch:
- `frontend/app/pages/certificados/**` (W2's domain).
- `frontend/app/composables/**`.
- `frontend/nuxt.config.ts`.
- No git commit (per orchestrator instruction).

---

## Deviations / decisions

1. **ContactoEmergencia pattern (nuevo.vue educacionEmpleado)** — chose to collect rows locally and POST after empleado create, instead of using a payload field. The contrato POST contract for `/api/v1/employees/:id/educacion` requires the new id, so this is the only viable option. Same approach as existing contactosEmergencia in the wizard.
2. **`saveContratoActivo` payload** — extended to include `archivoFirmadoUrl` and `cargoId` so the toggle doesn't accidentally clear them. Spec didn't call this out explicitly but the existing toggle was the only path that dropped these fields on update.
3. **Cargo sentinel pattern** — used a string sentinel `__ADD_NEW__` in the Select options list + an `@change` handler on the Select. PrimeVue Select doesn't support "footer slot" items the way other libs do, so the sentinel-then-watch-rollback pattern was the cleanest approach. The user-facing behavior matches the assignment spec ("➕ Agregar otro cargo" option that opens a small inline dialog → POST → refresh + auto-select).