# Result — cert-empleado-mejoras P1→P5

All 5 phases implemented and verified locally. **13/13 local-qa Playwright specs green.**

## Files changed per phase

### P1 — BUG-1 fix (empresaId opcional)
- `backend/src/routes/certificates.routes.ts` — POST catch: P2003 → 400 "Empresa not found", "No empresa found" → 400
- `frontend/tests/local-qa/bug-validation.spec.ts` — flipped BUG-1 expectation 400→201 + URL navigation assertion

### P2 — New cert taxonomy + POR_VENCER badge
- `backend/prisma/schema.prisma` — `TipoCertificadoEmpresa` enum replaced (RUT/.../OTRO → ALCALDIA/.../OTRO)
- `backend/prisma/migrations/20260704172546_f1_cert_taxonomy/migration.sql` — new enum via rename→create→temp col→CASE mapping→drop old
- `backend/src/routes/certificates.routes.ts` — Zod enum updated
- `backend/src/services/certificateService.ts` — TS union type updated
- `frontend/app/pages/certificados/crear.vue` — form reordered (tipo → nombre → fechas → descripción → archivo); tipoOptions with 6 new options + description help text
- `frontend/app/pages/certificados/index.vue` — `tipoLabels` + `tipoOptions` updated; `isPorVencer()` diffDays logic; POR_VENCER Tag rendered next to estado

### P3 — TipoVivienda + Salario on Cargo
- `backend/prisma/schema.prisma` — `TipoVivienda` enum reset to PROPIA/ARRENDADA/FAMILIAR; `salario Decimal? @db.Decimal(12,2)` added to `Cargo`
- `backend/prisma/migrations/20260704172811_f2_vivienda_salario/migration.sql` — enum replacement + `ALTER TABLE cargos ADD COLUMN salario`
- `backend/src/routes/employees.routes.ts` — Zod `tipoVivienda` enum updated; `cargos` schema adds `salario`; PUT /:id/cargos maps `salario`; createEmployeeSchema payload wired
- `frontend/app/pages/empleados/nuevo.vue` — `tiposVivienda` options + `CargoForm.salario` + InputNumber field + payload builder
- `frontend/app/pages/empleados/[id]/editar.vue` — same changes + load existing salario

### P4 — Shared CertificadoEmpleado editor (largest)
- `backend/prisma/schema.prisma` — `CertificadoAlturas` + `CertificadoRiesgoElectrico` models dropped from `Empleado`; added `TipoCertificadoEmpleado` enum + `CertificadoEmpleado` model with relation
- `backend/prisma/migrations/20260704173358_f2_cert_empleado_generic/migration.sql` — creates enum + table + indexes + FK; DO block copies rows from old tables; drops old tables
- `backend/src/services/employeeService.ts` — removed all `certificadoAlturas`/`certificadoRiesgoElectrico` references from EmployeeDetail, CreateEmployeeInput, ALL_RELATIONS, create payload; added `certificados` array everywhere
- `backend/src/routes/employees.routes.ts` — `createEmployeeSchema.certificados` (Zod array); `updateEmployeeSchema.omit({ certificados: true, ... })`; PUT /:id/certificados rewritten with replace-all deleteMany + createMany
- `frontend/app/components/EmpleadoCertificadosEditor.vue` (NEW) — shared component, PrimeVue 4 Select with 4 tipo options, OTRO inline InputText, two date fields, add/remove rows
- `frontend/app/pages/empleados/nuevo.vue` step 5 — replaced two fixed toggles with `<EmpleadoCertificadosEditor v-model="certificados" />`; payload builder emits `certificados` array
- `frontend/app/pages/empleados/[id]/editar.vue` tab 5 — same replacement; load maps `emp.certificados` rows to component format

### P5 — Clientes selects (genero + parentesco)
- `frontend/app/pages/pacientes/crear.vue` — género `<Select>` with MASCULINO/FEMENINO/OTRO; parentesco `<Select>` with PADRE/MADRE/HIJO/OTRO + inline InputText "¿Cuál?" when OTRO selected; submit resolves OTRO → custom text
- `frontend/app/pages/pacientes/[id]/editar.vue` — same Select treatment; load maps known enum values to `parentescoSelect`, free text → `parentescoCustom`

## Playwright specs (frontend/tests/local-qa/)
- `bug-validation.spec.ts` — BUG-1 + BUG-2 (UI parity for the shared editor)
- `p2-cert-types.spec.ts` — 6 new options visible + POR_VENCER badge
- `p3-empleado-fields.spec.ts` — TipoVivienda + salario + PUT persistence
- `p4-cert-editor.spec.ts` — editor renders on nuevo + editar + PUT persists MANIPULACION_ALIMENTOS
- `p5-clientes-selects.spec.ts` — género Select + parentesco Select + OTRO inline "¿Cuál?"

## Test summary

```
13 passed (34.4s)
- BUG-1 fix: crear certificado sin empresaId → 201 ✓
- BUG-2: tab Certificados muestra editor compartido ✓
- P2-1: 6 new options in /certificados/crear ✓
- P2-2: POR_VENCER badge on ≤30 day certs ✓
- P3-1: TipoVivienda PROPIA/ARRENDADA/FAMILIAR in /empleados/nuevo ✓
- P3-2: Salario field on cargo row in step 3 ✓
- P3-3: PUT /employees/:id/cargos persists salario ✓
- P4-1: EmpleadoCertificadosEditor renders on /empleados/nuevo step 5 ✓
- P4-2: EmpleadoCertificadosEditor renders on /empleados/[id]/editar tab 5 ✓
- P4-3: PUT /employees/:id/certificados accepts MANIPULACION_ALIMENTOS ✓
- P5-1: /pacientes/crear género Select with 3 options ✓
- P5-2: parentesco Select with PADRE/MADRE/HIJO/OTRO + OTRO reveals inline text ✓
- P5-3: /pacientes/[id]/editar has género Select ✓
```

## Schema migrations applied

| Migration | Date | What changed |
|-----------|------|--------------|
| `20260704172546_f1_cert_taxonomy` | applied | TipoCertificadoEmpresa enum replacement (5 old → 6 new values; data CASE-mapped) |
| `20260704172811_f2_vivienda_salario` | applied | TipoVivienda enum reset (3 old → PROPIA/ARRENDADA/FAMILIAR; all → PROPIA); `cargos.salario` column added |
| `20260704173358_f2_cert_empleado_generic` | applied | TipoCertificadoEmpleado enum + certificados_empleado table created; old certificados_alturas + certificados_riesgo_electrico tables copied + dropped |

All applied via `npx prisma migrate deploy` (NOT `migrate dev` to avoid the interactive prompt and `--shadow-database-url` per safety rule). One in-flight failure was rolled back via `prisma migrate resolve --rolled-back` and the corrected migration re-applied successfully.