# Plan: jul4-improvements (P0–P7)

## Objective
Implement the July-4 milestone from the two feature plans:
- `context/implementation-plan/jul-4-improvements-plan.md` — phases, UI flow, acceptance criteria
- `context/implementation-plan/jul-4-improvements-db-schema.md` — validated current ER, target ER, **full Prisma models §2.3**, migration sequence §2.4

P0 genero-OTRO input → P1 empresa certs recurrentes → P2 archivo en certs empleado → P3 hoja de vida → P4 pendientes → P5 novedades → P6 nómina foundation → P7 regression. All local (docker postgres :15432, backend :3101, frontend :3100). Every phase gated by a green Playwright spec in `frontend/tests/local-qa/`.

## Context
- Predecessor cert-mejoras P1–P5 landed 2026-07-04 (13/13 specs green). Patterns below reference that code.
- DB validated against Prisma 2026-07-05: one drift (DRIFT-1) fixed inside P1's migration.
- All 6 migrations are ADDITIVE — no enum surgery. `prisma migrate dev --create-only` + review + `prisma migrate deploy` (dev needs TTY; deploy works headless — proven approach).

## Recommended Approach — per phase, with code references

### P0 — Genero "Otro" custom input (no migration)
Backend: NONE — `patients.routes.ts:20` already `genero: z.string().min(1).max(20)` (free text accepted).
⚠ `clientes.genero` is `varchar(20)` → cap the custom input at `maxlength="20"`.

Frontend `pacientes/crear.vue` + `pacientes/[id]/editar.vue`: clone the existing parentesco pattern in the SAME file (crear.vue:32-45 state, :98-101 resolve-on-submit, :160-164 options):
```ts
// state (crear.vue currently has form.genero: '')
const generoSelect = ref<'' | 'MASCULINO' | 'FEMENINO' | 'OTRO'>('')
const generoCustom = ref('')
// submit: payload.genero = generoSelect.value === 'OTRO' ? generoCustom.value.trim() : generoSelect.value
// editar.vue on-load hydration:
const known = ['MASCULINO', 'FEMENINO', 'OTRO']
if (known.includes(data.genero)) { generoSelect.value = data.genero }
else { generoSelect.value = 'OTRO'; generoCustom.value = data.genero }
```
Template: after the genero `<Select>` (crear.vue:248-255) add
`<InputText v-if="generoSelect === 'OTRO'" v-model="generoCustom" placeholder="¿Cuál?" maxlength="20" />`.
Validation: OTRO selected + empty custom → error "Requerido".
Spec: extend `tests/local-qa/p5-clientes-selects.spec.ts` — select Otro → input appears → type → submit → 201.

### P1 — Empresa certificados recurrentes (migration `jul4_cert_empresa_recurrencia`)
Migration SQL (create-only, then hand-verify — table `certificados_empresa`, col `tipo_certificado` confirmed live):
```sql
CREATE TYPE "PeriodicidadCertificado" AS ENUM ('UNICA', 'MENSUAL', 'ANUAL');
ALTER TABLE "certificados_empresa"
  ADD COLUMN "periodicidad" "PeriodicidadCertificado" NOT NULL DEFAULT 'UNICA',
  ADD COLUMN "periodo" DATE,
  ADD COLUMN "comprobante_pago_url" VARCHAR(500);
ALTER TABLE "certificados_empresa" ALTER COLUMN "tipo_certificado" SET NOT NULL; -- DRIFT-1 fix (0 nulls verified)
```
Prisma (`schema.prisma` CertificadoEmpresa, after archivoUrl): `periodicidad PeriodicidadCertificado @default(UNICA)` · `periodo DateTime? @db.Date` · `comprobantePagoUrl String? @map("comprobante_pago_url") @db.VarChar(500)` + enum block.

Zod (`certificates.routes.ts:12-21` extend createCertificateSchema):
```ts
periodicidad: z.enum(['UNICA', 'MENSUAL', 'ANUAL']).optional(),
periodo: z.string().optional(),          // ISO date, first day of month
comprobantePagoUrl: z.string().optional(),
duplicateFromId: z.number().int().positive().optional(),  // POST only
```
`certificateService.ts`:
- `createCertificate`: if `duplicateFromId` → `findUnique` source, copy `{tipoCertificado, nombre, descripcion, periodicidad, empresaId}`, force `estado: 'PENDIENTE'`, `archivoUrl/comprobantePagoUrl: null`, `periodo: input.periodo ?? firstDayOfCurrentMonth()`.
- New `getMissingMonthlyAlerts()`: distinct `nombre` of MENSUAL certs having NO row with `periodo` = current month → wire into existing `/stats` response as `alertasMesFaltante: string[]` (avoids new route + frontend already calls stats).

Frontend:
- `certificados/crear.vue`: periodicidad `<Select>`; month picker `<DatePicker view="month" dateFormat="mm/yy" v-if="form.periodicidad !== 'UNICA'"`; second upload block "Comprobante de pago" cloning the presigned pattern at crear.vue:72-107 (folder: `'certificados'`; keep separate `selectedComprobante`/`comprobanteKey` refs).
- `certificados/index.vue`: alert `<Message severity="warn">` when `stats.alertasMesFaltante.length` ("Faltan certificados de {mes}: …"); row action "Duplicar para este mes" (visible when `periodicidad === 'MENSUAL'`) → `POST /certificates {duplicateFromId: row.id}` → refresh; periodo column (format MM/yyyy).
- `certificados/[id].vue`: show/edit new fields + comprobante download via `/uploads/download-url?key=`.
Spec: `tests/local-qa/jul4-p1-cert-recurrente.spec.ts` — create MENSUAL cert with comprobante → 201; alert visible when month missing; "Duplicar" creates row → alert clears.

### P2 — Archivo en certificados de empleado (migration `jul4_cert_empleado_archivo`)
```sql
ALTER TABLE "certificados_empleado" ADD COLUMN "archivo_url" VARCHAR(500);
```
Prisma: `archivoUrl String? @map("archivo_url") @db.VarChar(500)` on CertificadoEmpleado.
Backend `employees.routes.ts:429` PUT `/:id/certificados`: add `archivoUrl` to the accepted row shape + pass through in the service replace-all createMany.
Frontend `EmpleadoCertificadosEditor.vue`:
- Extend `CertificadoEmpleadoInput` (line 16) with `archivoUrl?: string`.
- Per-row upload: small file input + upload button calling the presigned flow (folder `'certificados-empleado'`); on success `patchRow(i, { archivoUrl: key })`; when set show filename + remove (`patchRow(i, { archivoUrl: '' })`).
- Keep component self-contained: copy the ~35-line upload helper INTO the component (props stay a plain array — both consumer pages inherit without changes; that's the parity guarantee).
Spec: `tests/local-qa/jul4-p2-cert-empleado-archivo.spec.ts` — editar tab 5: add cert with archivo → save 200 → reload shows filename. Parity assert: control exists on nuevo step 5 too.

### P3 — Hoja de vida (migration `jul4_hoja_vida`)
```sql
ALTER TABLE "empleados" ADD COLUMN "hoja_vida_url" VARCHAR(500);
```
Prisma: `hojaVidaUrl String? @map("hoja_vida_url") @db.VarChar(500)` on Empleado.
Backend: add `hojaVidaUrl: z.string().optional()` to update schema in `employees.routes.ts`; include in `employeeService` update + detail select.
Frontend `empleados/[id]/editar.vue` Info Laboral tab (index 2, label 'Info. Laboral' — editar.vue:18): "Hoja de vida" upload card (presigned, folder `'hojas-vida'`) + download/replace when present. Detail page `empleados/[id]/index.vue` tab 2 'Certificados & Documentos': download link.
Spec: `tests/local-qa/jul4-p3-hoja-vida.spec.ts`.

### P4 — Sección Pendientes (migration `jul4_pendientes`)
Prisma model `PendienteEmpleado` + enum `EstadoPendiente` → **copy verbatim from db-schema doc §2.3** (includes creadoPor RESTRICT, indexes; table `pendientes_empleado`). Back-relations: `Empleado.pendientes`, `Usuario.pendientesCreados @relation("PendienteCreador")`.
Backend `employees.routes.ts` (or new `pendientes` section in employeeService):
```
GET    /employees/:id/pendientes        → { manuales: PendienteEmpleado[], derivados: DerivedPendiente[] }
POST   /employees/:id/pendientes        { descripcion }            (ADMIN)
PATCH  /employees/:id/pendientes/:pid   { estado: 'RESUELTO' }     (ADMIN) → sets fechaResuelto
DELETE /employees/:id/pendientes/:pid                              (ADMIN)
```
Derived (computed in service, `derived: true`, NOT persisted):
```ts
// cert VENCIDO:  fechaVencimiento < today  → `Certificado ${tipoLabel} vencido hace N días`
// cert POR_VENCER: 0 <= diffDays <= 30     → `Certificado ${tipoLabel} vence en N días`
// !empleado.hojaVidaUrl                    → 'Adjuntar hoja de vida'
// sin contrato activo — guard: (prisma as any).contrato?.findFirst?.(...) ?? null  → works pre-P6
```
Frontend `empleados/[id]/index.vue`: append tab `{ label: 'Pendientes', icon: 'pi pi-exclamation-circle' }` (index 3 — existing tabs 0-2 unchanged, so existing specs keep working); derived items read-only with icon; manual items add-dialog + resolve/delete buttons; tab badge = open count.
Spec: `tests/local-qa/jul4-p4-pendientes.spec.ts` — seed cert with past fechaVencimiento via PUT → derived shows "vencido hace"; manual add → resolve.

### P5 — Novedades (migration `jul4_novedades`)
Prisma `NovedadEmpleado` + `ArchivoNovedad` + enum `TipoNovedad` → **verbatim from db-schema §2.3**. Back-relations: `Empleado.novedades`, `Usuario.novedadesCreadas @relation("NovedadCreador")`.
Backend:
```
GET    /employees/:id/novedades
POST   /employees/:id/novedades   { tipo, titulo, descripcion?, fechaInicio, fechaFin?, archivos: [{nombre, url}] }  (ADMIN)
PUT    /employees/:id/novedades/:nid   (ADMIN — replace archivos: deleteMany + createMany nested)
DELETE /employees/:id/novedades/:nid   (ADMIN)
```
Files uploaded client-side first via presigned flow (folder `'novedades'`), then URLs sent in body.
Frontend `empleados/[id]/index.vue`: tab `{ label: 'Novedades', icon: 'pi pi-bell' }` (index 4). Timeline: newest-first cards — `<Tag>` per tipo (LLAMADO_ATENCION danger · MEMORANDO warn · PERMISO info · VACACIONES success · OTRA secondary), titulo, fechas, descripcion, adjuntos as download chips. Create/edit `<Dialog>`: tipo Select, titulo, fechas (fechaFin optional), descripcion Textarea, multi-file list (add/remove before save).
Spec: `tests/local-qa/jul4-p5-novedades.spec.ts` — MEMORANDO with adjunto appears in timeline; VACACIONES with rango.

### P6 — Nómina foundation (migration `jul4_nomina_foundation`) — biggest
Prisma `Contrato`, `NominaPeriodo`, `ArchivoNominaPeriodo`, enum `TipoArchivoNomina` → **verbatim from db-schema §2.3** (NominaPeriodo has `contratoId Int?` SET NULL + `tipoContrato` snapshot + `@@unique([empleadoId, periodo])`). Add to migration SQL after the generated DDL:
```sql
CREATE UNIQUE INDEX "contratos_empleado_activo_uq" ON "contratos"("empleado_id") WHERE "activo";
```
Backend NEW `backend/src/routes/nomina.routes.ts` + `backend/src/services/nominaService.ts` (mount in `routes/index.ts` under `/nomina`; contratos nested under employees):
```
GET/POST /employees/:id/contratos          PUT/DELETE /employees/:id/contratos/:cid   (ADMIN)
GET  /nomina?periodo=2026-07               → [{empleado, contratoActivo, entrada|null}]
POST /nomina/periodos                      { empleadoId, periodo, salario?, notas?, archivos: [{tipoArchivo, nombre, url}] }
PUT  /nomina/periodos/:id                  DELETE /nomina/periodos/:id                (ADMIN)
```
Service rules: (1) creating contrato with `activo: true` → first `updateMany({ where: { empleadoId, activo: true }, data: { activo: false } })` (transaction; partial index is the backstop); (2) `fechaFin` required unless TERMINO_INDEFINIDO → 400; (3) period-entry create resolves contrato activo → `contratoId` + `tipoContrato` snapshot, 400 if none; (4) P2002 on (empleadoId, periodo) → 409 "Ya existe entrada para este periodo".
Frontend:
- `empleados/[id]/editar.vue` Info Laboral tab: "Contrato" card — list + form (tipo Select from TipoContrato labels, fechas, `v-if` hide fechaFin when TERMINO_INDEFINIDO, archivo upload folder `'contratos'`, activo toggle).
- NEW `frontend/app/pages/nomina/index.vue`: month `<DatePicker view="month">` (default current) → table: empleado, contrato tipo, estado entrada (✓ Completa / Falta / Sin contrato), action → entry `<Dialog>`: OPS/prestación → 3 typed slots (CUENTA_COBRO, INFORME_ACTIVIDADES, COMPROBANTE_APORTES) + "Agregar otro" (OTRO repeatable); TERMINO_FIJO/INDEFINIDO → DESPRENDIBLE slot + salario InputNumber prefilled from last Cargo.salario.
- `frontend/app/app.config.ts`: remove `disabled: true` from the Nomina item.
- P4 hook: "sin contrato activo" derived pendiente now activates (guard already tolerant).
Spec: `tests/local-qa/jul4-p6-nomina.spec.ts` — create OPS contrato; entry with 3 files → 200; duplicate periodo → 409 handled in UI; TERMINO_INDEFINIDO hides fechaFin.

### P7 — Full regression
`TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/ --reporter=list` + existing e2e suites. Watch: new tabs are APPENDED (indexes 3, 4) so old index-based selectors survive — verify `p4-cert-editor.spec.ts` and `bug-validation.spec.ts` still green. Fix regressions (≤2 attempts each).
Write `context/plan-implemented/jul-4-improvements-plan-implemented.md` (high-level, key decisions, deviations, grep-optimized per project rules).

## Key Files / Resources
- `context/implementation-plan/jul-4-improvements-plan.md` — feature plan (read FIRST)
- `context/implementation-plan/jul-4-improvements-db-schema.md` — **§2.3 Prisma models to copy verbatim; §2.4 migration sequence**
- `backend/prisma/schema.prisma` · `backend/src/routes/certificates.routes.ts` (Zod/route pattern) · `backend/src/routes/employees.routes.ts` (nested-resource + replace-all patterns) · `backend/src/services/certificateService.ts`
- `frontend/app/components/EmpleadoCertificadosEditor.vue` (P2 target) · `frontend/app/pages/certificados/crear.vue:72-107` (presigned upload pattern) · `frontend/app/pages/pacientes/crear.vue:32-45,98-101` (Select+OTRO custom pattern) · `frontend/app/pages/empleados/[id]/index.vue` (tabs at :62) · `frontend/app/app.config.ts`
- `frontend/tests/local-qa/*.spec.ts` (existing specs = selector reference) · `frontend/playwright.config.ts`

## Implementation Location
- Backend: `/Users/jeik/ws/mi-empresa-app-development/backend/`
- Frontend: `/Users/jeik/ws/mi-empresa-app-development/frontend/`

## Expected Deliverables
| File | Description |
|------|-------------|
| `development/jul4-improvements/tasks/jul4-improvements/result.md` | Files changed per phase + spec results |
| `development/jul4-improvements/tasks/jul4-improvements/completion-report.md` | Handoff + deferred items |
| `backend/prisma/schema.prisma` + 6 migrations | P1–P6 (names & DDL per db-schema §2.4) |
| `backend/src/routes/{certificates,employees,nomina}.routes.ts` + `src/routes/index.ts` | Route changes |
| `backend/src/services/{certificateService,employeeService,nominaService}.ts` | Service changes |
| `frontend/app/pages/pacientes/{crear,[id]/editar}.vue` | P0 |
| `frontend/app/pages/certificados/{crear,index,[id]}.vue` | P1 |
| `frontend/app/components/EmpleadoCertificadosEditor.vue` | P2 |
| `frontend/app/pages/empleados/[id]/{editar,index}.vue` | P3–P6 |
| `frontend/app/pages/nomina/index.vue` (NEW) + `app.config.ts` | P6 |
| `frontend/tests/local-qa/jul4-p{1..6}-*.spec.ts` + extended p5-clientes | Gate specs |

## Tools Likely Needed
Read/Edit/Write, Bash (prisma migrate create-only/deploy/generate, lsof-targeted backend restart, playwright), sub-agents for wide reads if needed.

## Acceptance Criteria
1. Genero OTRO reveals text input; custom value persisted (crear + editar pacientes)
2. MENSUAL cert: periodo saved, comprobante uploaded, "Duplicar para este mes" works
3. Missing-month alert shows on /certificados and clears after duplicate
4. `tipo_certificado` NOT NULL in DB after P1 (DRIFT-1 fixed)
5. Empleado cert rows accept + persist archivoUrl (both nuevo & editar)
6. Hoja de vida uploads from Info Laboral, downloadable from detail
7. Pendientes tab: derived (cert vencido "hace N días", hoja de vida faltante) + manual add/resolve
8. Novedades tab: all 5 tipos, adjuntos upload/download, timeline order
9. Contrato CRUD: one activo enforced; fechaFin null only for TERMINO_INDEFINIDO
10. /nomina month view: OPS → 3 typed slots + otros; fijo/indefinido → desprendible + salario; UK 409 handled
11. All `tests/local-qa/` specs green incl. pre-existing 13
12. `context/plan-implemented/jul-4-improvements-plan-implemented.md` written

## Constraints / Watch-outs
- Migrations: `npx prisma migrate dev --create-only --name {name}` → verify SQL → `npx prisma migrate deploy` → `npx prisma generate`. NEVER `--shadow-database-url`. All additive — if Prisma generates DROP/ALTER-on-existing beyond the plan → STOP, escalate.
- DATABASE_URL: `postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev`; run from `backend/`.
- Backend restart: kill PID from `lsof -ti :3101` only; then `PORT=3101 node --import tsx src/start.ts` from backend/ with DATABASE_URL. Never blanket pkill (prod bun service on :4142).
- PrimeVue 4: `<Select>`, `<DatePicker>`, `<Dialog>`, `<Tag>`, `<Message>` — match imports/usage from existing pages.
- Tabs use `v-show` → Playwright: scope selectors `:visible`; new tabs appended AFTER existing indexes.
- genero varchar(20) → maxlength on custom input.
- Every crear/editar spec includes a happy-path submit (BUG-1 lesson).
- Legacy models (Nomina, Ausentismo, GestionTiempoVacaciones) untouched.
- Self-repair ≤2 attempts per error → TURNING-POINT-STRATEGY.
