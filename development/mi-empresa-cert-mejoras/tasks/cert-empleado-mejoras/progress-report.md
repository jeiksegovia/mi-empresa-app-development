## Setup — ✅ Verified
- Backend: :3101 → /api/v1/health 200
- Frontend: :3100 → 200
- Postgres docker `miempresa-postgres` :15432 healthy
- DATABASE_URL: postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev
- 1 empresa row confirmed in DB
- Servers are UP — skip restart, go straight to P1

## Phase P1: BUG-1 fix (empresaId opcional) — ✅ Done
- Backend: certificates.routes.ts POST catch — added P2003 → 400 "Empresa not found", "No empresa found" → 400
- certificateService.ts already had getDefaultEmpresaId + createCertificate fallback (verified)
- Frontend test: flipped BUG-1 expectation 400→201; replaced error toast with URL navigation assertion
- Test result: **2 passed (5.1s)** — BUG-1 fix green + BUG-2 still green

## Phase P2: New cert taxonomy (F1) + POR_VENCER badge (F1.1) — ✅ Done
- Schema: TipoCertificadoEmpresa enum replaced (RUT/CAMARA_COMERCIO/PERMISO_SANITARIO/PAGO_SEGURIDAD_SOCIAL → ALCALDIA/GOBERNACION/SECRETARIAS/TRIBUTARIOS/REGISTRO_MERCANTIL/OTRO)
- Manual migration 20260704172546_f1_cert_taxonomy (rename old → create new → temp col → CASE mapping → drop old → drop enum_old). Applied via `prisma migrate deploy`.
- Verified DB: enum has 6 new values; existing rows mapped (RUT→TRIBUTARIOS, OTRO→OTRO etc.).
- Updated Zod + TS type to new enum values.
- Frontend crear.vue: reordered to tipo → nombre → fechas → descripción → archivo; tipoOptions now has 6 options with description help text in the Select dropdown.
- Frontend index.vue: updated tipoLabels + tipoOptions; added isPorVencer() diffDays logic; POR_VENCER Tag renders in Estado column when ≤30 days + not VENCIDO.
- p2-cert-types.spec.ts: 2 tests — option labels + help text present, POR_VENCER badge renders for ≤30 day cert.
- Test result: **2 passed (5.8s)**

## Phase P3: TipoVivienda (F2.1) + Salario on Cargo (F2.2) — ✅ Done
- Schema: TipoVivienda enum replaced (CASA/APARTAMENTO/LOTE → PROPIA/ARRENDADA/FAMILIAR); salario Decimal? @db.Decimal(12,2) added to Cargo
- Manual migration 20260704172811_f2_vivienda_salario: rename old enum → create new → temp col → all old values → PROPIA → drop old. Then `ALTER TABLE cargos ADD COLUMN salario DECIMAL(12,2)`. Applied via prisma migrate deploy.
- Verified DB: enum has 3 new values; salario column exists (numeric).
- Updated Zod in employees.routes.ts: createEmployeeSchema tipoVivienda → new values; cargos schema added salario.
- PUT /:id/cargos route: maps `salario: c.salario != null ? c.salario : null`.
- empleados/nuevo.vue: tiposVivienda options updated; CargoForm adds salario; InputNumber field with help text on each cargo row; payload builder sends salario.
- empleados/[id]/editar.vue: same edits + load existing salario on edit.
- p3-empleado-fields.spec.ts: 3 tests — vivienda options, salario field visible after Agregar, PUT persists salario.
- Test result: **3 passed (7.1s)**

## Phase P4: Shared CertificadoEmpleado editor (F2.3) — ✅ Done
- Schema: removed CertificadoAlturas + CertificadoRiesgoElectrico models and relations; added TipoCertificadoEmpleado enum (ALTURAS/RIESGO_ELECTRICO/MANIPULACION_ALIMENTOS/OTRO); added CertificadoEmpleado model with empleado relation
- Manual migration 20260704173358_f2_cert_empleado_generic: CREATE TYPE enum + CREATE TABLE certificados_empleado + indexes + FK; DO block INSERTs data from old tables (with EXISTS guards); DROP TABLE old tables. Fixed in-flight NOT NULL failure on updated_at by adding DEFAULT CURRENT_TIMESTAMP.
- Rollback chain: first attempt failed on updated_at NOT NULL → marked rolled back via `prisma migrate resolve --rolled-back` → re-deployed successfully.
- Verified DB: 2 existing rows migrated (1× ALTURAS, 1× RIESGO_ELECTRICO for empleado_id 70); only certificados_empleado table remains.
- employeeService.ts: removed certificadoAlturas/certificadoRiesgoElectrico from EmployeeDetail, CreateEmployeeInput, ALL_RELATIONS include, payload destructuring + spread; added certificados array to all three. EmployeeDetail now includes certificados array.
- employees.routes.ts: createEmployeeSchema swapped certificadoAlturas/RiesgoElectrico for `certificados: z.array(...)` shape; updateEmployeeSchema omit; PUT /:id/certificados rewritten with replace-all deleteMany + createMany + nombre conditional logic.
- EmpleadoCertificadosEditor.vue (NEW): PrimeVue 4 Select component (ALTURAS/RIESGO_ELECTRICO/MANIPULACION_ALIMENTOS/OTRO), InputText for OTRO nombre, two date fields, add/remove rows.
- empleados/nuevo.vue step 5: replaced two fixed toggles with `<EmpleadoCertificadosEditor v-model="certificados" />`; payload builder sends certificados array.
- empleados/[id]/editar.vue tab 5: same replacement + load maps emp.certificados rows on mount.
- p4-cert-editor.spec.ts: 3 tests — wizard step 5 renders, edit tab 5 renders, PUT persists MANIPULACION_ALIMENTOS + OTRO with re-fetch verification.
- Test result: **3 passed (9.4s)**
- Self-repair: 2 issues caught (migration NOT NULL, stale Prisma include from cached process); both resolved within self-repair budget.

## Phase P5: Clientes selects (F3) — ✅ Done
- pacientes/crear.vue: género is PrimeVue Select with MASCULINO/FEMENINO/OTRO (replaces InputText placeholder "Masculino, Femenino, Otro"). Parentesco in contactos emergencia is Select with PADRE/MADRE/HIJO/OTRO + inline InputText "¿Cuál?" when OTRO is selected (parentescoSelect + parentescoCustom state). Payload builder resolves OTRO → custom text at submit time.
- pacientes/[id]/editar.vue: same Select treatment for género and parentesco. Load maps existing parentesco to parentescoSelect (known enum values) or fallback to OTRO + parentescoCustom (free text). Type-guard helper `isParentescoValue` for safe typing.
- p5-clientes-selects.spec.ts: 3 tests — género Select options visible in crear, parentesco Select shows PADRE/MADRE/HIJO/OTRO + inline "¿Cuál?" reveals when OTRO chosen, edit page género Select present.
- Test result: **3 passed (9.2s)**
- Self-repair: 2 selector iterations (label/div mismatch → index-based; parentesco detection via DOM walk).

## Phase P5 + STEP 6: full local-qa suite — ✅ Done
- 13/13 specs pass in 34.4s (bug-validation × 2, p2 × 2, p3 × 3, p4 × 3, p5 × 3)
- BUG-2 spec adjusted: old test selected removed `#certAlturasEnabled` checkbox; simplified to verify editor renders (save flow covered by P4-3)
- Self-repair iterations stayed within budget (≤2 per issue).
