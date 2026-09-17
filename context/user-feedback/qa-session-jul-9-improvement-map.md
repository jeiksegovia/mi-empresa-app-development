# Improvement Map — QA Session jul-9

**Source**: `qa-session-jul-9-reinterpreted.md`
**Purpose**: developer-scannable map of every improvement + full matrix. Grouped by feature area, then by module/page.

Codes:
- **SEV** — CRITICAL / HIGH / MED / LOW
- **EFFORT** — S (< 4h) / M (0.5-2d) / L (2-5d) / XL (> 5d)
- **TYPE** — SCHEMA / API / UI / IaC / DOCS / BUG
- **BLOCKS** — is this a blocker for other work?

---

## Section A — Certificados de empresa

| # | Improvement | SEV | TYPE | EFFORT | Files affected | Blocks? |
|---|---|---|---|---|---|---|
| A1 | Remove `archivoUrl` + `comprobantePagoUrl` from create form top block | HIGH | UI | S | `certificados/crear.vue` | — |
| A2 | Remove `periodo`, `fechaEmision`, `fechaVencimiento` from create form top block | HIGH | UI | S | `certificados/crear.vue` | — |
| A3 | Keep only `nombre / tipoCertificado / descripción / periodicidad` + "Primera actualización" section on create | HIGH | UI | S | `certificados/crear.vue` | A1, A2 |
| A4 | Add `comprobantePagoUrl` as 2nd optional file in every update (create's first-update section AND `[id].vue` Agregar dialog) | HIGH | SCHEMA + API + UI | M | Prisma migration; `certificates.routes.ts` (Zod); `certificateService.ts`; `certificados/crear.vue`; `certificados/[id].vue` | — |
| A5 | Extract shared `<CertificateUpdateForm>` component (used in create's first-update + Agregar dialog) | MED | UI (refactor) | M | new `components/CertificateUpdateForm.vue`; both pages | — |
| A6 | Empresa page: `guardar cambios` broken — investigate + fix | HIGH | BUG | S/M | `empresa/index.vue` (or `editar.vue`); `empresa.routes.ts` | — |

## Section B — Pacientes (Notas + Datos personales)

| # | Improvement | SEV | TYPE | EFFORT | Files affected | Blocks? |
|---|---|---|---|---|---|---|
| B1 | New field `fechaIncidente` on `NotaCliente` (server-required) | HIGH | SCHEMA + API + UI | M | Prisma migration (add `fecha_incidente` column); notas route Zod; `pacientes/[id]/index.vue` notes create dialog; notes list preview shows this column | — |
| B2 | Server-side rule: `fechaIncidente` within **2 business days** (Mon-Fri, ignoring holidays for now) | HIGH | API | S | notas route validation logic (new utility `businessDaysBetween`) | Depends on B1 |
| B3 | New field `fechaCumpleanos` (nullable) on `Cliente` | MED | SCHEMA + API + UI | S | Prisma migration; `pacientes` create + editar + detail views | — |
| B4 | New field `tipoSangre` enum on `Cliente` — 8 standard values `A_POS/A_NEG/B_POS/B_NEG/AB_POS/AB_NEG/O_POS/O_NEG` | MED | SCHEMA + API + UI | S | Prisma migration + enum; pacientes forms | — |
| B5 | New field `eps String? @db.VarChar(200)` (free text) on `Cliente` | MED | SCHEMA + API + UI | S | Prisma migration; pacientes forms | — |
| B6 | Notes historial preview: show `fechaIncidente` column | MED | UI | S | `pacientes/[id]/index.vue` notes tab | Depends on B1 |

## Section C — Instrumentos + Fichas (single-step evaluation)

| # | Improvement | SEV | TYPE | EFFORT | Files affected | Blocks? |
|---|---|---|---|---|---|---|
| C1 | Ficha dialog: single-step assign + first-update (currently 2-step) | HIGH | API + UI | L | `pacientes/[id]/index.vue` ficha dialog rewrite; possibly new backend endpoint `POST /patients/:id/fichas/assign-with-update` (or extend existing) | — |
| C2 | "Descargar plantilla en blanco" button at top of ficha dialog; downloaded file auto-renamed `{plantillaNombre}_{pacienteNombre}.{ext}` | HIGH | UI | S | ficha dialog; `useFileUpload().downloadFile` helper for filename rewriting | Depends on C1 |
| C3 | Ficha instrument selector dropdown: inline "➕ Crear instrumento nuevo" option | LOW | UI | S | ficha dialog; nav to `/instrumentos/crear` with returnUrl | — |
| C4 | Cron/lazy status flip: PENDIENTE → VENCIDO when `fechaVencimiento < today` | HIGH | API | M | new cron script OR read-time lazy update in `patients.routes.ts` GET handler; possibly Postgres computed column | — |
| C5 | Extend `TipoInstrumento` enum with client-provided values | MED | SCHEMA + SEED | S | Prisma migration; seed script; **DEFERRED** until client sends Excel (Tuesday) | Blocked on client data |
| C6 | Add `EMPLEADO_GERONTOLOGA` sub-role (via new `TipoEmpleado` enum on `Usuario`) | MED | SCHEMA + API | M | Prisma migration; auth middleware for `/instruments/*`; user create/editar UI | — |
| C7 | Weekly vencimientos report | LOW | API | M | new endpoint `GET /reports/vencimientos-semana`; frontend consumer | Depends on C4 |

## Section D — Empleados

| # | Improvement | SEV | TYPE | EFFORT | Files affected | Blocks? |
|---|---|---|---|---|---|---|
| D1 | Remove `nivelEscritura` from empleado create/editar | MED | SCHEMA + UI | S | Prisma migration (drop column or make nullable + hide UI); `empleados/nuevo.vue`; `empleados/[id]/editar.vue` | — |
| D2 | Add repeatable "Educación" items with `profesion, universidad, fechaGraduacion, diplomaUrl?` | HIGH | SCHEMA + API + UI | L | Prisma: new `EducacionEmpleado` model; API CRUD; empleado UI: repeatable form section | — |
| D3 | Add `documentoIdentificacionUrl` (S3 key) on `Empleado` datos-personales | HIGH | SCHEMA + API + UI | S | Prisma migration; empleado forms | — |
| D4 | File-input dropzones: `cursor: pointer` + hover state | LOW | UI | S | shared dropzone component or CSS | — |
| D5 | Move `Contrato` UI into its own tab "Contrato laboral" | HIGH | UI | M | `empleados/[id]/editar.vue` tab restructure; `empleados/nuevo.vue` step reorder | — |
| D6 | Contrato: add `archivoFirmadoUrl` (signed contract file) | HIGH | SCHEMA + API + UI | S | Prisma migration; contract routes; contrato UI | Depends on D5 |
| D7 | Contrato: `cargo` becomes selectable from per-empresa configurable list; "➕ agregar otro" adds new value | HIGH | SCHEMA + API + UI | L | Prisma: new `CargoEmpresa` table (per-empresa list) OR `empresa.cargos String[]`; empresa config UI; contrato form select | Depends on D5 |
| D8 | Empresa configuración: new admin page/section to manage the cargos list | HIGH | UI + API | M | new `empresa/configuracion.vue` (or extend existing empresa page); backend cargos CRUD | Depends on D7 |

## Section E — Global cross-cutting

| # | Improvement | SEV | TYPE | EFFORT | Files affected | Blocks? |
|---|---|---|---|---|---|---|
| E1 | Auto-uppercase entity name fields (server-side stored, frontend transforms as user types) | MED | API + UI | M | Zod `.transform` on nombre fields for `CertificadoEmpresa, Instrumento, Cliente, Empleado, Empresa`; frontend v-model transform | — |
| E2 | Descriptions/notas retain sentence case (explicit spec, do NOT transform) | INFO | DOCS | — | (documentation only) | — |

## Section F — Nómina

No new improvements this session. Existing behavior confirmed working. Blocked from proper QA until D5+D6 land (empleados need signed contracts to appear).

---

# Improvement Matrix (unified view)

| # | Section | Improvement | SEV | TYPE | EFFORT | Depends on | User line ref |
|---|---|---|---|---|---|---|---|
| A1 | Certificados | Strip files from create top | HIGH | UI | S | — | 18–54 |
| A2 | Certificados | Strip dates from create top | HIGH | UI | S | — | 66–94 |
| A3 | Certificados | Final shape of create form | HIGH | UI | S | A1+A2 | 94 |
| A4 | Certificados | `comprobantePagoUrl` on updates | HIGH | SCHEMA+API+UI | M | — | 51–54 |
| A5 | Certificados | Shared `<CertificateUpdateForm>` | MED | UI-refactor | M | A4 | 108–109 |
| A6 | Empresa | Fix empresa save bug | HIGH | BUG | S/M | — | 98–104 |
| B1 | Notas | `fechaIncidente` field | HIGH | SCHEMA+API+UI | M | — | 117–135 |
| B2 | Notas | 2-business-day rule | HIGH | API | S | B1 | 117–129 |
| B3 | Paciente | `fechaCumpleanos` field | MED | SCHEMA+API+UI | S | — | 137–145 |
| B4 | Paciente | `tipoSangre` enum | MED | SCHEMA+API+UI | S | — | 146–164 |
| B5 | Paciente | `eps` free-text field | MED | SCHEMA+API+UI | S | — | 148–158 |
| B6 | Notas | Show fecha in notes list | MED | UI | S | B1 | 136 |
| C1 | Fichas | Single-step assign+first-update | HIGH | API+UI | L | — | 210–264 |
| C2 | Fichas | "Descargar plantilla" + auto-rename | HIGH | UI | S | C1 | 262 |
| C3 | Fichas | Inline "Crear instrumento" shortcut | LOW | UI | S | — | 166–176 |
| C4 | Fichas | Auto-flip PENDIENTE→VENCIDO | HIGH | API | M | — | 265–286 |
| C5 | Instrumentos | Extend TipoInstrumento enum | MED | SCHEMA+SEED | S | client data | 187–199 |
| C6 | Roles | `EMPLEADO_GERONTOLOGA` sub-role | MED | SCHEMA+API | M | — | 189–193 |
| C7 | Reports | Weekly vencimientos | LOW | API | M | C4 | 281 |
| D1 | Empleados | Remove `nivelEscritura` | MED | SCHEMA+UI | S | — | 294–300 |
| D2 | Empleados | Repeatable "Educación" items | HIGH | SCHEMA+API+UI | L | — | 300–348 |
| D3 | Empleados | `documentoIdentificacionUrl` | HIGH | SCHEMA+API+UI | S | — | 322–329 |
| D4 | Empleados | Dropzone `cursor: pointer` | LOW | UI | S | — | 336–341 |
| D5 | Empleados | Move Contrato to own tab | HIGH | UI | M | — | 349–370 |
| D6 | Contrato | `archivoFirmadoUrl` field | HIGH | SCHEMA+API+UI | S | D5 | 361 |
| D7 | Contrato | `cargo` as per-empresa Enum | HIGH | SCHEMA+API+UI | L | D5 | 371–400 |
| D8 | Empresa | Configuración for cargos list | HIGH | UI+API | M | D7 | 399 |
| E1 | Global | Auto-uppercase entity names | MED | API+UI | M | — | 55–62 |
| E2 | Global | Doc: descriptions keep case | INFO | DOCS | — | — | 60–62 |

---

# Priority slice — recommended sprints (raw scoping, subject to user approval)

**Sprint 1 (blockers / quick wins)** — ~1 week
- A1, A2, A3 (cert create form cleanup) — 1 day
- A6 (empresa save bug) — 0.5 day
- D1 (drop nivelEscritura) — 0.5 day
- D4 (dropzone cursor) — 0.5 day
- A4 (comprobantePagoUrl on updates) — 1 day
- D3 (documento identificación upload) — 0.5 day
- D5 (contrato own tab) — 1 day
- D6 (archivo firmado contrato) — 0.5 day

**Sprint 2 (schema-heavy features)** — ~1 week
- B1+B2 (fechaIncidente + validation) — 1.5 days
- B3, B4, B5 (fechaCumpleanos + tipoSangre + eps) — 1 day
- D2 (Educación repeatable) — 2 days
- D7+D8 (cargo enum + empresa config) — 2 days

**Sprint 3 (major flows)** — ~1.5 weeks
- C1+C2 (single-step ficha + descarga plantilla) — 3 days
- C4 (auto-flip status) — 1 day
- C6 (empleado sub-role) — 2 days
- E1 (uppercase names) — 1 day

**Deferred / low-priority**:
- A5 (shared component refactor)
- C3 (inline crear instrumento shortcut)
- C5 (extend TipoInstrumento enum — waiting on client data)
- C7 (weekly report)
