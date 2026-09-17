# W3-frontend-b Progress Report

Worker: pt-frontend-eng (W3)
Started: 2026-07-09
Tasks: 18 (T10 Pacientes), 19 (T11 Empleados), 20 (T12 Contrato + Empresa config)
Status: ALL THREE TASKS COMPLETED on 2026-07-10.

---

## T10 — Pacientes UI (#18) — completed

### Subtasks
1. Notes dialog: required `fechaIncidente` DatePicker + inline error on 400 with `field: 'fechaIncidente'`.
2. Notes list: `fecha` column renamed to show `fechaIncidente` (DD/MM/YYYY).
3. Datos personales: add `fechaCumpleanos`, `tipoSangre` (Select 8 enum), `eps` (InputText). Position above "Información del seguro" in crear + editar + detail view.

### Files touched
- `pacientes/[id]/index.vue`: NotaCliente + PatientDetail interfaces extended; note dialog DatePicker + inline Message; list column updated to show fechaIncidente; detail view rows for the 3 new fields.
- `pacientes/crear.vue`: form state + Select/tipoSangreOptions + 3 new fields above "Información del Seguro"; submit payload includes them only when set.
- `pacientes/[id]/editar.vue`: hydrate on load, same form layout, include in PUT payload.

### Backend verification
- 400 on `fechaIncidente: "2020-01-01"` returns `{success:false, field:'fechaIncidente', message:'La fecha del incidente debe estar dentro de los últimos 2 días hábiles'}`.
- 201 on `fechaIncidente: "2026-07-09"` persists the new field on the nota.

---

## T11 — Empleados UI (#19) — completed

### Subtasks
1. EducaciónEmpleado repeatable (new table per contract §3) — profesion (required), universidad, fechaGraduacion, diploma file upload.
2. Documento identificación upload → `documentoIdentificacionUrl`.
3. Remove `nivelEscritura` input (D1).

### Files touched
- `empleados/nuevo.vue`: removed nivelEscritura input (Step 4); added documentoIdentificacionUrl upload in Step 1; added Formación Académica section in Step 4 (rows collected locally and POSTed after empleado create).
- `empleados/[id]/editar.vue`: removed nivelEscritura input (Tab 4); added documentoIdentificacionUrl upload in Tab 1; added Formación Académica section in Tab 4 (GET on load, POST/PATCH/DELETE per row on save).
- `empleados/[id]/index.vue`: extended EmployeeDetail interface with documentoIdentificacionUrl + educacionEmpleado; detail rows for both.

### Backend verification
- POST `/employees/105/educacion` returns 201; row cleaned up after test.
- Existing educacionIdiomas payload with `nivelEscritura: null` accepted (back-compat).

---

## T12 — Contrato + Empresa config (#20) — completed

### Subtasks
1. Contrato laboral — `archivoFirmadoUrl` upload + `cargoId` Select populated from `/empresa/cargos?activo=true` w/ inline new-cargo dialog.
2. Empresa configuración — cargos manager Card on `/empresa/editar` (admin-only).

### Files touched
- `empleados/[id]/editar.vue`: Contrato interface extended; archivoFirmadoUrl upload + cargo Select + inline new-cargo dialog; cargoEmpresaOptions computed; saveNewCargo + saveContrato + saveContratoActivo all forward the new fields.
- `empresa/editar.vue`: cargos manager Card; createCargo / toggleCargoActivo / fetchCargos; inline Message on 409; soft-archive via PATCH activo.

### Backend verification
- `GET /empresa/cargos` returns 8 rows (7 seeded + 1 archived "Coordinador" at id=8).
- `POST /empresa/cargos` with duplicate returns 409 `{field:'nombre', message:'Ya existe un cargo con el nombre "Fisioterapeuta"'}`.

---

## Reporting

- `result.md` — per-task summary + browser verification notes.
- `completion-report.md` — final status.

## PARKED

Awaiting QA-wave (W4) fix-ups.