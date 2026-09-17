# Jul-4 Improvements Plan — Certificados recurrentes, Pendientes, Novedades, Nómina foundation

**Date**: July 4, 2026 (plan finalized July 5)
**Intake**: `context/improvements intake jul-4.md` (raw client notes, reorganized here)
**Milestone**: July 09
**Validation policy**: LOCAL ONLY (docker postgres :15432, backend :3101, frontend :3100) until fixes land; staging QA after deploy
**Predecessor plan**: `certificados-empleados-clientes-improvements-plan.md` (P1–P5 implemented 2026-07-04, see `context/plan-implemented/certificados-empleados-clientes-improvements-implemented.md`)
**DB schema design**: `jul-4-improvements-db-schema.md` — current ER diagram (validated vs live DB 2026-07-05), target ER diagram, full Prisma models, 6-migration sequence, feature-consistency matrix

---

## 1. Intake Validation — items already implemented ✓

The intake's "Validar que ya esta implementado" section maps to yesterday's cert-mejoras P5:

| Intake item | Status | Evidence |
|---|---|---|
| Pacientes genero dropdown (masculino/femenino/otro) | ✅ Done | `pacientes/crear.vue` + `editar.vue`, Select with 3 options (p5-clientes-selects.spec.ts green) |
| Pacientes genero "otro → espacio para poner la opción" | ❌ **Gap** | Current Select stores literal `OTRO`; no inline custom text like parentesco has → **P0 below** |
| Pacientes parentesco dropdown (padre/madre/hijo/otro→cuál input) | ✅ Done | P5; OTRO reveals inline InputText, custom text stored in same column |
| Empleado cert flow: "Agregar nuevo certificado" → tipo (Alturas, Riesgo Eléctrico, Manipulación, Otros) | ✅ Done | P4 `EmpleadoCertificadosEditor.vue` on wizard step 5 + editar tab 5 |
| Empresa certs: agregar, borrar | ✅ Done | Full CRUD `certificates.routes.ts` (POST/PUT/DELETE + UI delete dialog) |
| Empresa certs: alertas | ✅ Partial | POR_VENCER badge (≤30 días) on list + detail; **no** missing-month alert for recurring certs → P1 |
| Empresa certs: archivos | ✅ Partial | Single `archivoUrl` via presigned URL; **no** comprobante de pago second file → P1 |

## 2. Architectural Decisions (developer-confirmed 2026-07-05)

1. **Nómina → new lean models**: `Contrato` (empleado, tipoContrato, fechas, archivo) + `NominaPeriodo` (empleado, año/mes, archivos múltiples tipados, notas). Legacy `Nomina`/`DeduccionSalario`/`Beneficio`/`ComprobantePago` models stay dormant (no drop this milestone). Salary calculation deferred.
2. **Cert catalog → keep OTRO free-form**: NO `CertificadoTipoCatalogo` model this milestone. Admin uses tipo=OTRO + nombre free text (works since P4). Per-cargo requirement engine + cargo alarms deferred to a later iteration. Pendientes section (manual + derived) still ships → P4.
3. **Novedades → one generic model**: `NovedadEmpleado` with tipo enum (LLAMADO_ATENCION, MEMORANDO, PERMISO, VACACIONES, OTRA) + file attachments. Unused `Ausentismo`/`GestionTiempoVacaciones` stay dormant.
4. **Empresa recurring certs → periodicidad + month rows**: add `periodicidad` (UNICA/MENSUAL/ANUAL) + `periodo` (month/year) to `CertificadoEmpresa`. Each month = new row (duplicable from previous). Alert when current month's row is missing for MENSUAL types.
5. **Contrato ↔ Cargo → independent lists** (confirmed 2026-07-05): no FK between them; cargo = position, contrato = legal terms. Existing cargos replace-all endpoint untouched.
6. **NominaPeriodo → FK contrato_id (SET NULL) + tipoContrato snapshot** (confirmed 2026-07-05): audit-proof — the governing contract is traceable and the snapshot survives contract deletion/edits.

### Decisions taken autonomously (flag if you disagree)
- **Attachments pattern**: per-module attachment tables with real FKs (`archivos_nomina_periodo`, `archivos_novedad`) instead of a polymorphic table — Prisma-idiomatic, cascade deletes work. `CertificadoEmpresa` gets exactly one extra column `comprobantePagoUrl` (cert + payment proof = 2 known files, no table needed).
- **CertificadoEmpleado file**: add `archivoUrl String?` column + upload control in `EmpleadoCertificadosEditor.vue` (intake: "certificados completa … archivos" applies to empleado certs too).
- **Hoja de vida**: `hojaVidaUrl String?` on `Empleado`; upload field in Info Laboral tab (editar) + shown on detail; missing hoja de vida = auto-derived pendiente.
- **Contrato UI location**: Info Laboral tab of empleado editar (fase-1 contratación per intake: hoja de vida + contrato live together). NominaPeriodo UI lives in the top-level `/nomina` page (sidebar item exists, currently `disabled: true`).
- **Pendientes**: hybrid — manual `PendienteEmpleado` rows (admin creates any pending action) + derived items computed on read (certs VENCIDO/POR_VENCER, missing hojaVidaUrl, missing contrato activo). No cron; computed in service like POR_VENCER.

## 3. Execution Phases (local-first; each = schema + backend + frontend + spec in one slice)

### P0 — Genero "Otro" custom input (gap from previous milestone, no migration)
- `pacientes/crear.vue` + `pacientes/[id]/editar.vue`: when genero Select = OTRO show inline InputText "¿Cuál?" (same `generoSelect`/`generoCustom` pattern as parentesco P5); submit sends custom text; on edit-load, non-enum value → select OTRO + prefill custom.
- Backend: `patients.routes.ts` Zod `genero` must accept free text (verify it wasn't narrowed to the 3 enum values in P5 — if narrowed, relax to `z.string().min(1)`).
- Spec: extend `frontend/tests/local-qa/p5-clientes-selects.spec.ts`.
- **Gate**: spec green incl. happy-path submit (QA rule: every crear/editar submits).

### P1 — Empresa certificados recurrentes (migration `jul4_cert_empresa_recurrencia`)
- Schema: `CertificadoEmpresa` + `periodicidad PeriodicidadCertificado @default(UNICA)` (new enum `UNICA|MENSUAL|ANUAL`), `periodo DateTime? @db.Date` (first day of month), `comprobantePagoUrl String? @map("comprobante_pago_url") @db.VarChar(500)`. Existing rows default UNICA/null. **Also fixes DRIFT-1**: `ALTER COLUMN tipo_certificado SET NOT NULL` (nullable in live DB vs required in Prisma; 0 null rows verified 2026-07-05).
- Backend `certificates.routes.ts` + `certificateService.ts`: Zod + types for 3 new fields; `GET /certificates/alerts` (or extend `/stats`) returns MENSUAL cert names with no row for current month; POST accepts optional `duplicateFromId` → copy nombre/tipo/descripcion/periodicidad, blank archivos, periodo = current month.
- Frontend `certificados/crear.vue`: periodicidad Select; periodo month-picker when != UNICA; second upload "Comprobante de pago". `certificados/index.vue`: "Duplicar para este mes" row action on MENSUAL certs; alert banner "Faltan certificados de {mes}: …" from alerts endpoint; periodo column. `certificados/[id].vue`: show/edit new fields + comprobante download.
- Dashboard: missing-month count wired into existing stats card or new alert card.
- Spec: `frontend/tests/local-qa/jul4-p1-cert-recurrente.spec.ts` — create MENSUAL cert with comprobante, duplicate-for-month, missing-month alert appears/disappears.
- **Gate**: spec green.
- Covers intake: caja de compensación / Sena / aportes sociales mensuales + comprobante de pago ante entidad financiera.

### P2 — Archivo en certificados de empleado (migration `jul4-cert-empleado-archivo`)
- Schema: `CertificadoEmpleado` + `archivoUrl String? @map("archivo_url") @db.VarChar(500)`.
- Backend `employees.routes.ts`: PUT `/:id/certificados` list shape accepts `archivoUrl?`.
- Frontend `EmpleadoCertificadosEditor.vue`: per-row upload control (presigned-URL flow, same as certificados empresa) + download link when present. Both consumer pages (nuevo step 5, editar tab 5) inherit automatically — that's the point of the shared component.
- Spec: `frontend/tests/local-qa/jul4-p2-cert-empleado-archivo.spec.ts`.
- **Gate**: spec green; parity holds on both pages.

### P3 — Hoja de vida (migration `jul4-hoja-vida`)
- Schema: `Empleado` + `hojaVidaUrl String? @map("hoja_vida_url") @db.VarChar(500)`.
- Backend: include in employee GET/PUT Zod + service.
- Frontend `empleados/[id]/editar.vue` Info Laboral tab: upload field "Hoja de vida" + download/replace. `empleados/[id]/index.vue`: show link in Certificados & Documentos tab.
- Spec: `frontend/tests/local-qa/jul4-p3-hoja-vida.spec.ts`.
- **Gate**: spec green.

### P4 — Sección Pendientes en empleado (migration `jul4-pendientes`)
- Schema: new model `PendienteEmpleado` → table `pendientes_empleado`: id, empleadoId FK cascade, descripcion `@db.VarChar(500)`, estado enum `EstadoPendiente PENDIENTE|RESUELTO`, creadoPor FK Usuario (RESTRICT, NotaCliente pattern), createdAt, fechaResuelto?. Full model in `jul-4-improvements-db-schema.md` §2.3.
- Backend: `GET/POST /employees/:id/pendientes`, `PATCH /employees/:id/pendientes/:pid` (resolver), `DELETE`. GET response merges **derived** items (computed, not persisted, flagged `derived: true`): certs VENCIDO / POR_VENCER (≤30d), `hojaVidaUrl == null` → "Adjuntar hoja de vida", no contrato activo (post-P6; return once Contrato exists — code the check defensively so P4 works before P6 lands).
- Frontend `empleados/[id]/index.vue`: new tab "Pendientes" (badge with open count): derived items listed read-only with origin icon; manual items with add-dialog + resolve/delete. Employee list (`empleados/index.vue`): small warning badge when open pendientes > 0 (optional, cheap via count in list response).
- Spec: `frontend/tests/local-qa/jul4-p4-pendientes.spec.ts` — derived item appears for cert vencido; manual add + resolve.
- **Gate**: spec green.
- Covers intake edge case: "alarma de curso faltante hace 15 días" → shows as derived VENCIDO pendiente with days-overdue text.

### P5 — Módulo Novedades (migration `jul4-novedades`)
- Schema: `NovedadEmpleado` → `novedades_empleado`: id, empleadoId FK cascade, tipo enum `TipoNovedad LLAMADO_ATENCION|MEMORANDO|PERMISO|VACACIONES|OTRA`, titulo `@db.VarChar(200)`, descripcion `@db.Text?`, fechaInicio `@db.Date`, fechaFin `@db.Date?`, creadoPor FK Usuario, createdAt. Child `ArchivoNovedad` → `archivos_novedad`: id, novedadId FK cascade, nombre, url `@db.VarChar(500)`.
- Backend: `GET/POST /employees/:id/novedades`, `PUT/DELETE /employees/:id/novedades/:nid`; archivos accepted as array of `{nombre, url}` (uploaded via existing presigned-URL flow first).
- Frontend `empleados/[id]/index.vue`: new tab "Novedades" — timeline list (patient-notes pattern: newest first, tipo chip color-coded), create/edit dialog with tipo Select, fechas, descripcion, multi-file upload list. ADMIN create/edit/delete; others read (match existing role gates on employees).
- Spec: `frontend/tests/local-qa/jul4-p5-novedades.spec.ts` — create MEMORANDO with adjunto → appears in timeline; VACACIONES with rango de fechas.
- **Gate**: spec green.

### P6 — Nómina foundation (migration `jul4_nomina_foundation`) — biggest slice
- Schema (new lean models per decisions #1, #5, #6): `Contrato` + `NominaPeriodo` (with `contratoId Int?` FK SET NULL + `tipoContrato` snapshot) + `ArchivoNominaPeriodo` (typed uploads). Full Prisma models, indexes, and back-relations in **`jul-4-improvements-db-schema.md` §2.3**. Migration includes raw-SQL partial unique index `contratos_empleado_activo_uq ON contratos(empleado_id) WHERE activo` (Prisma can't express partial indexes). Legacy Nomina models untouched.
- Backend: new `nomina.routes.ts` + `nominaService.ts` — `GET/POST/PUT/DELETE /employees/:id/contratos`, `GET /nomina?periodo=` (all employees × month, with entry status), `GET/POST/PUT/DELETE /nomina/periodos`. Rules enforced in service: one activo contrato per empleado (double-guarded by partial index); `fechaFin` required unless TERMINO_INDEFINIDO; on period-entry create, resolve empleado's contrato activo → set `contratoId` + snapshot `tipoContrato`.
- Frontend:
  - `empleados/[id]/editar.vue` Info Laboral tab: Contrato section (tipo Select, fechas, archivo upload) — fase-1 contratación complete next to hoja de vida (P3).
  - New page `frontend/app/pages/nomina/index.vue`: month picker (default current) → table of empleados with contrato activo, entry status per row (✓ completa / falta), open entry dialog.
  - New page or dialog `nomina/[empleadoId].vue`: period entry — if OPS/prestación: 3 typed upload slots (cuenta de cobro, informe actividades, comprobante aportes) + "otros" add-more; if TERMINO_FIJO/INDEFINIDO: desprendible upload + salario (prefill from Cargo.salario).
  - `app.config.ts`: remove `disabled: true` from Nomina sidebar item.
  - P4 hook: derived pendiente "sin contrato activo" now activates.
- Spec: `frontend/tests/local-qa/jul4-p6-nomina.spec.ts` — create contrato OPS on empleado; create period entry with 3 files; término-indefinido contrato hides fechaFin; nomina list shows status.
- **Gate**: spec green.

### P7 — Full regression + reporting
- Run entire `frontend/tests/local-qa/` suite + existing e2e certs/empleados/pacientes specs; fix regressions (P4-era specs may need tab-index updates after adding 2 tabs to empleado detail).
- Task report per phase in `context/implementation-plan/` (per project rules) + final summary in `context/plan-implemented/jul-4-improvements-plan-implemented.md`.
- **Gate**: all local specs green.

## 4. Out of Scope (deferred, tracked)
- Cert catalog + per-cargo requirement engine + cargo alarms (decision #2 — later iteration; Pendientes covers the alarm need manually meanwhile).
- Salary calculation / deducciones / beneficios (legacy models dormant).
- Email/SMTP alerts (still no creds on any stage) — all alerts UI-only.
- CV parsing ("leyendo el archivo de hoja de vida" in intake) — upload only this milestone.
- Dropping legacy `Nomina`/`Ausentismo`/`GestionTiempoVacaciones` tables — revisit after nómina module stabilizes.
- Staging deploy — schedule after local acceptance (staging still needs empresa seed row, see predecessor plan §5.5).

## 5. Watch-outs (carried from cert-mejoras implementation)
- PostgreSQL enum changes: rename→create→temp col→CASE→drop pattern; write migration SQL manually via `prisma migrate dev --create-only`; NEVER `--shadow-database-url`.
- `prisma migrate dev` needs TTY → author SQL manually + `prisma migrate deploy` (worked for all 3 cert-mejoras migrations).
- Backend restart: target PID from `lsof -i :3101`; never blanket `pkill`.
- Tabbed pages use `v-show` — Playwright selectors must scope `:visible`.
- Every crear/editar page spec must include a happy-path submit (QA rule from BUG-1 root cause).
- PrimeVue 4: `<Select>` not `<Dropdown>`; DatePicker for fechas; month-only picker: `view="month" dateFormat="mm/yy"`.
- New empleado detail tabs shift tab indexes → update existing specs that click tabs by index.

## 6. Suggested Phase Order for Milestone Jul-09
P0 (minutes) → P1 (client's #1 flujo certificados) → P2+P3 (small, same-day) → P4 → P5 → P6 (largest) → P7. If the milestone tightens: P6 nómina is the cut line — P0–P5 deliver every empleado/certificados item; nómina is explicitly labeled "foundation" in the intake.

## 7. Grep hooks
jul4 periodicidad comprobantePagoUrl PendienteEmpleado NovedadEmpleado ArchivoNovedad Contrato NominaPeriodo ArchivoNominaPeriodo TipoArchivoNomina hojaVidaUrl EstadoPendiente TipoNovedad duplicateFromId
