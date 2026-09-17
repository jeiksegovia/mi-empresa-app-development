# Improvements — jul-9 Insights (post-QA session)

**Inputs consumed**:
- `context/user-feedback/qa-session-jul-9-reinterpreted.md` — cleaned transcript
- `context/user-feedback/qa-session-jul-9-improvement-map.md` — improvement map + matrix
- `context/plan-implemented/initial-prompt-fixes-jul-8-implemented.md` — what shipped in jul-9 release
- `context/implementation-plan/staging-release-jul9-runbook.md` — release ops record
- Live `backend/prisma/schema.prisma` (as of HEAD `48029ef`)

**Baseline**: staging is running the jul-9 release. Local dev matches (14 migrations applied). This document scopes the **next release** and captures architectural decisions locked with the user on 2026-07-09.

---

## Locked architectural decisions

| # | Decision | Rationale |
|---|---|---|
| L1 | **Cargo** → new `CargoEmpresa` table (per-empresa). `Contrato.cargoId → CargoEmpresa.id` | Enum-like but per-tenant configurable + soft-deletable via `activo` flag. Seed with the 7 initial values; empresa admins add more via `/empresa/configuracion`. |
| L2 | **Sub-roles** → new `TipoEmpleado` enum on `Usuario` (nullable). Values start with `GERONTOLOGA`. `RolUsuario` stays unchanged | Keeps the primary role model clean; specializations flow through a separate axis; scales to future specializations (auxiliar, terapista, etc.) without polluting RolUsuario. |
| L3 | **`fechaIncidente` 2-business-day window** → HARD server-side block (400 on violation) | Matches user's line 117 verbatim ("va a ser reenforzada por el servidor"). No admin override in v1; revisit if legit backdating requests appear. |
| L4 | **`TipoContrato`** → KEEP current 4 values (OPS, OBRA_O_LABOR, TERMINO_FIJO, TERMINO_INDEFINIDO) | Line 386's "OPS o contrato laboral" was conversational shorthand — legally distinct in Colombia + drives nomina cuenta-cobro rules. No change. |
| L5 | **Certificate updates** → ADD `comprobantePagoUrl` alongside existing `archivoUrl` on `CertificadoUpdate` | Non-destructive, no rename risk. Two file slots per update. |
| L6 | **Colombian holiday calendar** → deferred | v1 falls back to weekday-only (Mon-Fri) for business-day math. Add holiday table when a client needs weekend-adjacent accuracy. |

---

## Sprint 1 + 2 (bundled ~2 weeks) — the next release

**Not in this release** (deferred):
- Section C entirely: ficha single-step flow (C1–C7), TipoInstrumento enum extension (C5) waiting on client Excel, EMPLEADO_GERONTOLOGA gating (C6) — deferred to a subsequent release since fichas + role gating merit their own focused scope.
- E1/E2 (auto-uppercase) — small but touches many models; sequence after Sprint 1+2 lands cleanly.

**In this release** (17 items):

### A. Certificados de empresa

**A1–A3 — Create form simplification**
- **Current state**: `frontend/app/pages/certificados/crear.vue` has fields for `nombre, tipoCertificado, descripción, periodicidad, periodo, fechaEmision, fechaVencimiento, archivoUrl (opcional), comprobantePagoUrl (opcional)`, PLUS a "Primera actualización" collapsible section at the bottom.
- **Target state**: create form contains ONLY `nombre, tipoCertificado, descripción, periodicidad` + "Primera actualización" section (which itself has `archivo, comprobantePagoUrl, notas, fechaEmision, fechaVencimiento`).
- **Files**: `certificados/crear.vue` (delete top-of-form fields + editForm properties); backend `certificateService.ts` and Zod schemas continue to accept `periodo/fechaEmision/fechaVencimiento` as optional (backwards compat) but the form stops sending them.
- **Migration**: NONE needed — `CertificadoEmpresa.periodo/fechaEmision/fechaVencimiento` remain in the schema as nullable, populated only via updates going forward.
- **Test impact**: `frontend/tests/local-qa/jul8-cert-crear-with-update.spec.ts` needs updating to reflect the new create-form field set.

**A4 — Add `comprobantePagoUrl` to updates**
- **Current state**: `CertificadoUpdate` table columns: `id, certificadoId, archivoUrl, notas, fechaEmision, fechaVencimiento, creadoPor, createdAt`.
- **Target state**: add `comprobantePagoUrl String? @db.VarChar(500)` column.
- **Files**: Prisma migration; `backend/src/routes/certificates.routes.ts` (extend `addCertificateUpdateSchema` Zod); `certificateService.addCertificateUpdate` passthrough; `certificados/crear.vue` "Primera actualización" section adds 2nd file input; `certificados/[id].vue` Agregar dialog same.
- **Migration risk**: LOW — additive nullable column on a table with a small number of rows.

**A5 — Shared `<CertificateUpdateForm>` component**
- **Current state**: identical form logic duplicated between `crear.vue` (first-update section) and `[id].vue` (Agregar dialog).
- **Target state**: extract to `frontend/app/components/certificate/CertificateUpdateForm.vue` — props: `modelValue` for the 5 fields, `disabled`, `showTitle`. Both pages consume it.
- **Files**: new component + 2 page refactors.
- **Effort**: MED — mostly moving code, but need to preserve `useFileStash` + sessionStorage draft key semantics.

**A6 — Empresa configuración page save bug**
- **Current state**: user reports (line 100) "guardar cambios" doesn't persist. Verify + fix.
- **Investigation steps**: check `frontend/app/pages/empresa/index.vue` (or `editar.vue`) submit handler + `backend/src/routes/empresa.routes.ts` PUT/PATCH; check network tab for the actual response; check schema for any required-field mismatch.
- **Files**: TBD after investigation (likely 1 frontend + 1 backend).

### B. Pacientes (notas + datos personales)

**B1 — `fechaIncidente` on `NotaCliente`**
- **Current state**: `NotaCliente { id, clienteId, registroFichaId?, tipoNota, fecha (default now()), autor, contenido, prioridad, visiblePara }`. `fecha` is the creation timestamp.
- **Target state**: ADD `fechaIncidente DateTime @db.Date` (REQUIRED — matches user's flow where the event date is the whole point).
- **Files**: Prisma migration (add column); notas Zod schema; `frontend/app/pages/pacientes/[id]/index.vue` notes create dialog (add `<DatePicker>`); notes list preview (add fecha column).

**B2 — 2-business-day validation (hard block, L3)**
- **Utility**: new `backend/src/utils/businessDays.ts` — `isWeekday(date)`, `businessDaysBetween(a, b)`.
- **Enforcement**: in the notas create/update route, before Prisma create:
  ```ts
  const daysBack = businessDaysBetween(fechaIncidente, new Date())
  if (fechaIncidente > new Date() || daysBack > 2) {
    return res.status(400).json({ success: false, message: 'La fecha del incidente debe estar dentro de los últimos 2 días hábiles', field: 'fechaIncidente' })
  }
  ```
- **Frontend surfaces the error** inline (existing pattern from nomina CUENTA_COBRO).
- **Weekday-only**: no holiday table in v1 (L6). Add a `TODO(holidays)` comment.

**B3 — `fechaCumpleanos` on `Cliente`**
- **Current state**: `Cliente.fechaNacimiento DateTime @db.Date` only.
- **Target state**: ADD `fechaCumpleanos DateTime? @db.Date` (nullable). When null, reports fall back to `fechaNacimiento`.
- **Files**: Prisma migration; pacientes create/editar/detail views show both fields.

**B4 — `tipoSangre` enum on `Cliente`**
- **Current state**: no blood type field.
- **Target state**: new enum `TipoSangre { A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG }`; `Cliente.tipoSangre TipoSangre?`.
- **Files**: Prisma migration + enum; pacientes forms (dropdown with 8 values); positioned ABOVE "información del seguro" section.

**B5 — `eps` free-text on `Cliente`**
- **Current state**: `Cliente.informacionSeguro String? @db.Text` — catch-all free text.
- **Target state**: ADD `eps String? @db.VarChar(200)` as a dedicated field. `informacionSeguro` stays for other insurance notes.
- **Files**: Prisma migration; pacientes forms.

**B6 — Show `fechaIncidente` in notes list**
- **Current state**: notes historial preview may not show any date prominently.
- **Target state**: dedicated column showing `fechaIncidente` (formatted DD/MM/YYYY).
- **Files**: `pacientes/[id]/index.vue` notas tab template.

### D. Empleados

**D1 — Remove `nivelEscritura`**
- **Current state**: `Empleado.nivelEscritura String @db.VarChar(50)` — required column with test data.
- **Target state**: make nullable AND stop writing from frontend AND hide from UI. Do NOT drop the column in this migration (preserve historical data). Follow-up migration drops it once we're confident no consumers remain.
- **Files**: Prisma migration (`String?`); `empleados/nuevo.vue` + `[id]/editar.vue` remove input.

**D2 — Repeatable "Educación" items**
- **Current state**: TBD — need to check current empleado educación tab; likely a single string field.
- **Target state**: new Prisma model:
  ```prisma
  model EducacionEmpleado {
    id             Int      @id @default(autoincrement())
    empleadoId     Int
    profesion      String   @db.VarChar(200)
    universidad    String?  @db.VarChar(200)
    fechaGraduacion DateTime? @db.Date
    diplomaUrl     String?  @db.VarChar(500)
    empleado       Empleado @relation(fields: [empleadoId], references: [id], onDelete: Cascade)
    @@index([empleadoId])
  }
  ```
- **API**: CRUD endpoints under `/empleados/:id/educacion/*`.
- **Frontend**: repeatable form section on empleado create/editar — add/remove rows.
- **Migration**: additive; existing empleados' educación (if any single-field) gets migrated to N=1 EducacionEmpleado row.

**D3 — `documentoIdentificacionUrl` on `Empleado`**
- **Current state**: no dedicated column.
- **Target state**: ADD `documentoIdentificacionUrl String? @db.VarChar(500)` on `Empleado`.
- **Files**: Prisma migration; empleado datos-personales section (file upload via `useFileUpload().uploadFile(file, 'empleado-documentos')`).

**D4 — Dropzone `cursor: pointer` + hover**
- Trivial CSS on the reusable file-drop component (identify it: `frontend/app/components/**` search for `type="file"`).

**D5 — Move `Contrato` UI to its own tab**
- **Current state**: contrato lives inside "información laboral" tab on `empleados/[id]/editar.vue` (and possibly `nuevo.vue`).
- **Target state**: new tab "Contrato laboral" with all contrato UI. Restructure tab labels/routes if needed.
- **Files**: `empleados/[id]/editar.vue` (major tab restructure); `empleados/nuevo.vue` (step reorder).

**D6 — `Contrato.archivoFirmadoUrl`**
- **Current state**: no signed-contract file column.
- **Target state**: ADD `archivoFirmadoUrl String? @db.VarChar(500)` on `Contrato`.
- **Files**: Prisma migration; contract routes; Contrato tab file upload.

**D7 — `Cargo` as configurable per-empresa (L1)**
- **New model**:
  ```prisma
  model CargoEmpresa {
    id        Int       @id @default(autoincrement()) @map("cargo_id")
    empresaId Int       @map("empresa_id")
    nombre    String    @db.VarChar(100)
    activo    Boolean   @default(true)
    createdAt DateTime  @default(now())
    empresa   Empresa   @relation(fields: [empresaId], references: [id], onDelete: Cascade)
    contratos Contrato[]
    @@unique([empresaId, nombre])
    @@index([empresaId])
    @@map("cargos_empresa")
  }
  ```
- **Contrato migration**: `cargo String` → `cargoId Int?` initially (nullable during migration), backfill via matching existing `cargo` strings to seeded `CargoEmpresa` rows, then `NOT NULL`.
- **Seed** for existing empresas: `['Fisioterapeuta', 'Terapeuta Ocupacional', 'Educador Físico', 'Manualidades', 'Auxiliar de Enfermería', 'Auxiliar de Servicios Generales', 'Otro']` (user's 7 known values + Otro catchall — user to confirm the 7th if different).
- **API**: `GET /empresa/cargos`, `POST /empresa/cargos` (create), `PATCH /empresa/cargos/:id` (archive), etc.
- **Frontend on Contrato form**: `<Select>` populated from `GET /empresa/cargos?activo=true` + "➕ agregar otro" that opens a small modal to add + immediately select.

**D8 — Empresa configuración page (cargos manager)**
- **New page** or new tab on existing `/empresa` route: `Configuración > Cargos`. Admin-only. Add/rename/archive.
- **Files**: new `frontend/app/pages/empresa/configuracion.vue` (or extend existing empresa page); backend already has cargos endpoints from D7.

---

## Sequencing (recommended order for the next planify run)

**Wave 1 (can run in parallel)** — pure schema-additive + frontend changes:
- A1–A3 (cert create form cleanup) — pure UI
- A4 (comprobante on updates) — schema + UI, additive
- A6 (empresa save bug) — investigation-first
- B3 + B4 + B5 (fechaCumpleanos, tipoSangre, eps) — schema-additive
- D1 (nivelEscritura nullable) — schema-additive
- D3 (documento identificación) — schema-additive
- D4 (dropzone cursor) — pure CSS
- D5 (contrato own tab) — pure UI

**Wave 2 (depends on Wave 1)**:
- A5 (shared `<CertificateUpdateForm>`) — refactor after A4 lands
- D6 (archivoFirmadoUrl) — needs D5's contrato tab
- B1 + B2 + B6 (fechaIncidente + validation + list preview) — bundle as one deliverable

**Wave 3 (biggest schema piece)**:
- D2 (repeatable Educación) — new table + CRUD + repeatable UI
- D7 + D8 (CargoEmpresa + configuración page) — new table, migration with backfill, new empresa admin page

**Suggested worker split** for a planify-team run:
- `pt-data-schema` — one migration bundle for all schema changes (D1, D3, D6, D7, B1, B3, B4, B5 = 8 columns/tables across 4 migrations)
- `pt-backend-eng` — all API changes (routes, Zod, services)
- `pt-frontend-eng-A` — certificados + empresa (A1-A6)
- `pt-frontend-eng-B` — pacientes + empleado (B1-B6, D1-D8)
- `pt-test-quality` — playwright specs + backend test cases per feature area (learning from jul-8: never skip tests)

## Migration risk summary

| Migration | Risk | Data impact |
|---|---|---|
| A4: `certificados_empresa_updates.comprobante_pago_url` | LOW | Additive nullable; 0 rows on staging as of jul-9 release |
| B1: `notas_clientes.fecha_incidente` | LOW-MED | New required column; will need to backfill existing rows with `fecha` (creation timestamp) as fallback, OR make it nullable initially + backfill + then `SET NOT NULL` |
| B3: `clientes.fecha_cumpleanos` | LOW | Additive nullable |
| B4: `clientes.tipo_sangre` + enum | LOW | Additive nullable |
| B5: `clientes.eps` | LOW | Additive nullable |
| D1: `empleados.nivel_escritura` → nullable | LOW | Loosens constraint, no data loss |
| D2: `educacion_empleado` new table | LOW | Additive; empleado existing single-field educación → 1 row per empleado backfill |
| D3: `empleados.documento_identificacion_url` | LOW | Additive nullable |
| D6: `contratos.archivo_firmado_url` | LOW | Additive nullable |
| D7: `cargos_empresa` new table + `contratos.cargo` → `cargo_id` | MED | Data migration required — parse existing `cargo` strings, match against seeded rows; nullable + backfill + NOT NULL |
| B4-enum, D7-model: new enums/tables | LOW | Additive |

**Aggregate risk**: MEDIUM (only D7 has non-trivial data migration). All others are additive-nullable or new-table. Recommend R0 gate for D7 specifically: `SELECT DISTINCT cargo FROM contratos` — user should confirm which existing values need mapping to which seeded cargo before running the migration.

---

## Deferred (NOT in this release — future planning)

| # | Item | Reason |
|---|---|---|
| C1–C2 | Single-step ficha assign + first-update + descarga plantilla | Large UX rewrite; better done in its own focused release |
| C3 | Inline "crear instrumento" shortcut | Nice-to-have |
| C4 | Auto-flip PENDIENTE → VENCIDO cron | New cron infra; deserves its own release with observability |
| C5 | Extend `TipoInstrumento` enum | Blocked on client Excel data (Tuesday) |
| C6 | `TipoEmpleado` sub-role (per L2 decision) | Depends on C1 flow lockdown — pair them |
| C7 | Weekly vencimientos report | Depends on C4 |
| E1 | Auto-uppercase entity names | Touches many models — sequence after this release |
| E2 | Documentation | Roll into any of the above |

---

## Grep hooks

```
jul-9-insights improvements-jul-9 fechaIncidente fechaCumpleanos tipoSangre eps
comprobantePagoUrl CertificadoUpdate CargoEmpresa archivoFirmadoUrl
TipoEmpleado documentoIdentificacionUrl EducacionEmpleado nivelEscritura
2-business-day weekday-only holiday-deferred L1 L2 L3 L4 L5 L6
```
