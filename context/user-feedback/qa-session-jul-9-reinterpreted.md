# QA Session — jul-9-2026 (reinterpreted)

**Source**: `qa-session-jul-9.md` (402 lines, ~raw ASR transcript)
**Method**: cross-referenced every UX/UI reference against the current codebase — pages under `frontend/app/pages/**`, Prisma models in `backend/prisma/schema.prisma`, composables and components. Colombian Spanish colloquialisms + affectionate "mi amor" preserved as speaker intent, but content normalized.
**Speakers** (inferred from tone and role):
- **A** — technical facilitator / developer taking structured notes ("entonces, en la parte de X vamos a hacer Y"). Frames decisions.
- **B** — domain owner / product decision-maker (references gerontology business — "abuelitos", "gerontóloga", "quiz temperamento semanal"). Uses "mi amor" affectionately, gives use-cases.

**Session boundary**: unrelated tile-delivery phone call at lines 110–115 of source, ignored below. Meeting ends when they must leave for a 9AM appointment (line 401).

**Prior context**: this QA covers what was deployed to staging in the **jul-9 release** (`context/implementation-plan/staging-release-jul9-runbook.md`) — certificados history + agregar, instrumentos MultiSelect + editar page, ficha VENCIDO → COMPLETADO transition + persistence, nomina filter, 401 UX. Speakers reference all of these but the focus is on **remaining gaps** and **new requests** (mostly new schema fields + UX refactors).

**Review order** decided by speakers (line 8–9 of source):
1. Certificados de empresa
2. Pacientes + Instrumentos + Fichas
3. Empleados + Nómina

---

## 1. Certificados de empresa

### 1.1 Remove "archivo opcional" and "comprobante de pago" from **create** form

**Source lines**: 18–54

**What speakers said**:
- B (line 18): "no sé qué sentido tiene esto. Yo la verdad quería era quitar esto para que no genere ruido"
- A (line 20): "usted para la Cámara de Comercio usted necesita pues el rut. Entonces, usted de una vez pone el rut ahí como documentos de apoyo"
- Consensus (line 44–49): DELETE the two file fields from the create form because they're semantically confusing — they were meant as "supporting docs" (like a RUT for Cámara de Comercio) but users mistake them for the actual certificate file.

**Current code**:
- `frontend/app/pages/certificados/crear.vue` — form includes `archivoUrl` (opcional) + `comprobantePagoUrl` (opcional) at the top, plus a "Primera actualización" section at the bottom
- Prisma `CertificadoEmpresa` model has these two columns

**Decision** (verbatim from A, line 50):
> "en la parte de certificado/crear, después de descripción y periodicidad, `archivo (opcional)` y `comprobante de pago` se van a eliminar para evitar confusiones. Solo va a quedar la parte de primera actualización donde se puede subir los archivos, notas, y fecha de emisión + vencimiento."

**But wait** (line 51–54): B reconsiders → the `comprobante de pago` field IS important, just in the WRONG place. It should be moved into every update (both the "primera actualización" section AND every subsequent "Agregar actualización" dialog).

**Final decision**: On the create form, both file fields disappear from the top. In the first-update section AND in the "Agregar actualización" dialog, `comprobante de pago` becomes a second optional file input alongside the existing `archivoUrl`.

**Files affected**:
- `frontend/app/pages/certificados/crear.vue` — remove top-of-form `archivoUrl` + `comprobantePagoUrl` fields
- `frontend/app/pages/certificados/[id].vue` — add `comprobantePagoUrl` to the Agregar dialog
- `backend/prisma/schema.prisma` — add `comprobantePagoUrl` column to `CertificadoUpdate` model (currently only `archivoUrl`, `notas`, `fechaEmision`, `fechaVencimiento`)
- `backend/src/routes/certificates.routes.ts` — extend `addCertificateUpdateSchema` Zod schema
- `backend/src/services/certificateService.ts` — pass through in `addCertificateUpdate`

---

### 1.2 Remove `periodo` field on create form

**Source lines**: 66–76, 95–98

**What speakers said**:
- B (line 70): "esta [periodo] sobra, mi amor, porque aquí ya está la fecha de inicio y fecha de vencimiento. Y es anual, ¿sí no? O sea, que este sobra"
- A (line 75): "eliminar de la periodicidad, `periodo`, porque la verdad con la fecha inicial y final es más que suficiente"

**Current code**:
- `CertificadoEmpresa.periodo` — `DateTime? @db.Date` — currently in create form
- `CertificadoEmpresa.fechaEmision` + `fechaVencimiento` are also there → redundant

**Decision**: KEEP `periodicidad` dropdown (MENSUAL / ANUAL / TRIMESTRAL). REMOVE `periodo` field entirely from create form. The dates come only from the "primera actualización" section.

**Also affects historical data**: existing `certificados_empresa.periodo` column — recommend making it optional (already `?`) and stop using it on writes. Deprecate over time.

---

### 1.3 Also remove `fechaEmision` and `fechaVencimiento` from the "top" of create form

**Source lines**: 86–94, 108–109

**What speakers said**:
- B (line 86): "acá está igual. Ah, no, pero esto también ya sobra"
- A (line 89–94): "todo eso de arriba sobra, incluyendo la fecha de arriba, porque eso no importa. Lo que se va a preservar es en `nuevo certificado` tenemos información del certificado y se remueve las fechas."

**Current code**:
- `crear.vue` form currently has: nombre, tipoCertificado, descripción, periodicidad, periodo, fechaEmision, fechaVencimiento, archivoUrl (opcional), comprobantePagoUrl (opcional), + "Primera actualización" section
- All those date fields at the top are redundant with the "Primera actualización" section's date inputs

**Decision** (line 94):
> "Lo que se va a preservar en `nuevo certificado`: información del certificado (nombre, tipoCertificado, descripción, periodicidad), y se remueve TODAS las fechas de la sección superior. La primera actualización es la única sección con fechas."

**Final create-form shape**:
```
[Nueva sección: Información del certificado]
  - nombre (auto-uppercase — see §5.1)
  - tipoCertificado (dropdown)
  - descripción (textarea, preserves case)
  - periodicidad (MENSUAL / ANUAL / TRIMESTRAL)

[Sección: Primera actualización (opcional)]
  - archivo (opcional, file input)
  - comprobante de pago (opcional, file input)
  - notas (opcional, textarea)
  - fecha emisión (opcional)
  - fecha vencimiento (opcional)
```

**Redundancy with `[id].vue` Agregar dialog** (line 108–109): B confirms "la parte de los updates es este mismo formulario, este pedacito tal cual" — the "primera actualización" section should be the SAME component as the Agregar dialog. Suggests extracting a shared `<CertificateUpdateForm>` component.

---

### 1.4 Bug: Empresa config page not saving

**Source lines**: 98–104

**What speakers said**:
- Both testing `/empresa`, fields don't persist: A (line 100) "¿Por qué como que tenemos un tema con la información de la empresa? Pero qué raro, yo no la reseté"

**Files affected**: `frontend/app/pages/empresa/index.vue` and/or `empresa/editar.vue`, `backend/src/routes/empresa.routes.ts`

**Priority**: HIGH — user-visible break on a page that already existed.

---

### 1.5 Nice-to-have: after create, land on the detail page's history immediately

**Source lines**: 105–108

**What speakers said**: A (line 108) "habría sido bueno no verlo porque bueno, igual en la parte de los updates es este mismo formulario"

**Interpretation**: After creating a cert with a first-update, route to `/certificados/{id}` and the history list already renders the first update. Currently W4's implementation handles this correctly per the QA session's observation — no action needed unless a regression is confirmed.

---

## 2. Pacientes (Notas + Datos personales)

### 2.1 New field: `fechaIncidente` on `NotaCliente` with **2-business-day** window

**Source lines**: 117–136

**What speakers said**:
- A (line 117): "en pacientes y crear nuevas notas, vamos a introducir un nuevo campo que sea de fecha — la fecha de la nota o incidente"
- Server-enforced business rule (line 117–129):
  - The `fechaIncidente` must be within **2 business days** before today (Colombian calendar — Mon-Fri, honoring holidays)
  - B initially proposed "1 día hábil antes" → discussion — festivos need to be tracked → conclusion at line 122: "ponele dos días y ahí no hay riesgo"
  - Line 124–126: "días hábiles" (business days), NOT calendar days
- Use case (line 130–135): Nurses log incidents by date, later reports aggregate (e.g., "en febrero cinco veces agresiva, marzo ninguna → cambiaron droga")

**Also (line 136)**: Show `fechaIncidente` in the notes list preview (currently the historial view of notas doesn't display any date prominently)

**Current code**:
- `NotaCliente` model already has `fecha DateTime @default(now())` — this represents creation timestamp
- No holiday calendar exists in the DB
- No client-side date input on the create-note form

**Decision**:
- ADD `fechaIncidente DateTime @db.Date` (nullable? user didn't say — default assume REQUIRED since the workflow starts here)
- KEEP `fecha` for creation timestamp
- Server validation: `fechaIncidente` must satisfy `is_business_day(fechaIncidente, 'CO')` AND `business_days_between(fechaIncidente, today) <= 2`
- No holiday calendar → fall back to "2 weekdays" (Mon-Fri only, ignore holidays for now)
- New endpoint contract: `POST /patients/:id/notas` body includes `fechaIncidente` (date-string)
- Frontend: `<DatePicker>` on the create-note form
- Notes list: show `fechaIncidente` column

**Open question for user**: is Colombian holiday calendar acceptable to defer? Per line 121–124 they explicitly opted for weekday-only fallback.

---

### 2.2 New field: `fechaCumpleanos` (real birthday) on `Cliente`

**Source lines**: 137–145

**What speakers said**:
- B (line 138): "aquí tenemos que tener dos fechas de nacimiento. La fecha de nacimiento que aparece en la cédula y la fecha de nacimiento real"
- Rationale (line 141): older patients often have wrong ID birth dates ("en ese tiempo lo registraban [mal]")
- A (line 145): "en información básica del paciente, además de fecha de nacimiento, agregar `fecha de cumpleaños` en formato igual, visible en datos personales, para que los reportes de cumpleaños usen esta"

**Current code**:
- `Cliente` model: `fechaNacimiento DateTime @db.Date` (single field)

**Decision**:
- ADD `fechaCumpleanos DateTime? @db.Date` (nullable — if empty, reports fall back to `fechaNacimiento`)
- Show BOTH fields on `frontend/app/pages/pacientes/[id]/index.vue` datos-personales section
- Add to `frontend/app/pages/pacientes/crear.vue` and `frontend/app/pages/pacientes/[id]/editar.vue`

---

### 2.3 New fields: `tipoSangre` + `EPS` on `Cliente`

**Source lines**: 146–164

**What speakers said**:
- B (line 146): "importante, el tipo de sangre"
- B (line 148): "y la EPS. Eso ya está — no me acuerdo dónde. No está." — checked "información del seguro" section, only free-text notes exist
- Decision (line 156–164):
  - Add `tipoSangre` as a **dropdown** with standard values — B (line 164): "que el agente mire cuáles son los tipos de sangre y los ponga ahí"
  - Add `EPS` as a **free text** field (line 161: "sí, la dijito")
  - Position: ABOVE the "información del seguro" section

**Current code**:
- `Cliente` model has `informacionSeguro String? @db.Text` (free-text catch-all), no structured EPS or blood type

**Decision**:
- ADD `tipoSangre TipoSangre?` — new enum with 8 standard values (`A_POS, A_NEG, B_POS, B_NEG, AB_POS, AB_NEG, O_POS, O_NEG`)
- ADD `eps String? @db.VarChar(200)` (free text)
- Frontend: add above `<InformacionSeguro>` block on datos-personales tab

---

## 3. Instrumentos + Fichas (single-step evaluation flow)

### 3.1 Major UX rewrite: Ficha assignment = single-step + immediate update

**Source lines**: 210–264

**What speakers said**:
- B (line 210–217): "aquí yo quiero que estén todos los instrumentos... apenas yo lo escojo, yo quiero digitarlo y cargarlo... Jacob se inscribe y yo empiezo a hacer las cinco evaluaciones... yo cojo y le digo Jacob, `prueba de conocimiento`, la digito y la agrego. Y ya le queda a Jacob asignada"
- Current implementation: 2-step — user picks instrument → assigns → LATER goes back to upload data + change to COMPLETADO
- Desired: 1-step — picking an instrument from the dropdown IMMEDIATELY opens a modal to fill the first update

**Consolidated flow (line 261–264, spoken by A)**:
> "En pacientes → detalles → fichas de evaluación → seleccionar instrumento: al momento de seleccionar el instrumento, inmediatamente abre el popup para cargar la información del instrumento. Es decir, ahí se asigna el instrumento y se carga el primer update en un solo paso. Cuando ese popup abre, hay una opción en la parte superior para descargar la plantilla en blanco si el funcionario no la tiene disponible. Sí, esa plantilla en blanco que descarga ahí va a tener el nombre del paciente. Automáticamente el archivo que descarga se pone el nombre de la plantilla más el nombre del paciente porque esa información ya está en la plataforma, así no hay confusión."

**Decision**:
- Ficha status dialog on `pacientes/[id]/index.vue` is changed:
  - Instrument selector at top
  - "Descargar plantilla en blanco" button at top → downloads `plantilla` file, renaming client-side to `{instrumentoNombre}_{pacienteNombreCompleto}.{ext}` (or similar sanitized pattern)
  - Fields: optional descripción, fecha vencimiento, and REQUIRED file upload for the filled evaluation
  - Submit → single API call assigns the ficha AND creates the first update AND flips estado to COMPLETADO in one transaction
- On subsequent updates (renewal cycle), same popup opens with the same 3 fields.
- Files affected:
  - `frontend/app/pages/pacientes/[id]/index.vue` — dialog rewrite
  - `frontend/app/composables/useFileStash.ts` — already handles Android tab-discard; keys should scope by instrumentoId + fichaId
  - `backend/src/routes/patients.routes.ts` — new/updated endpoint for combined assign+first-update

---

### 3.2 Rename status `PENDIENTE` → clarify semantics + auto-flip to `VENCIDO`

**Source lines**: 265–286

**What speakers said**:
- B (line 265): "cambiemos la palabra `pendiente` a `vencido`"
- B (line 268–277): clarifies — `PENDIENTE` means "assigned but not yet completed" (still valid); `VENCIDO` means "past due date and never completed"
- B (line 281): "necesito poder generar un informe semanal que me muestre todo lo que se vence esta semana"

**Decision** (semantic clarification, NOT rename):
- KEEP the enum values `PENDIENTE / COMPLETADO / VENCIDO`
- ADD a background job (cron or on-read check) that flips `PENDIENTE` → `VENCIDO` when `fechaVencimiento < today`
- Also enforce this on read: any GET that returns fichas can lazily update the estado if past-due
- Weekly report use-case: `GET /reports/vencimientos-semana` OR filter on existing endpoint → future enhancement (not blocking)

---

### 3.3 Instrument selector on ficha assign — allow "crear uno nuevo" as shortcut

**Source lines**: 166–176, 200

**What speakers said**:
- B: dropdown of instruments should include an inline "crear uno nuevo" option so admins don't have to leave the flow
- A (line 176): notes this as improvement — for now, they exit to `/instrumentos` and create there

**Decision**: Add an "➕ Crear instrumento nuevo" item at the bottom of the instrument dropdown on the ficha assign dialog. Clicking opens a mini-modal (or navigates with a return-URL). Nice-to-have, not blocking.

---

### 3.4 New `TipoInstrumento` enum values (client-specific)

**Source lines**: 187–199

**What speakers said**:
- A (line 187–188): "el cliente tiene unos tipos de instrumento muy específicos... la actividad que queda pendiente en el QA es extraer los tipos de instrumento de unas muestras que va a pasar el cliente"
- Not resolved in-session — depends on client Excel samples

**Current code**: `enum TipoInstrumento { VALORACION NUTRICION MATRICULA ADMISION }`

**Decision**: Deferred until client provides Excel samples on Tuesday (line 197 "El martes que llegue Liana le pido que saque todos los instrumentos para que los dejemos cargando allá predeterminados"). Then extend the enum + seed the DB with the predefined instrumento rows.

---

### 3.5 New sub-role: `EMPLEADO_GERONTOLOGA`

**Source lines**: 189–193

**What speakers said**:
- B (line 189): "este rol solamente estaría para la gerontóloga"
- A (line 193): "vamos a tener también tipos de empleado — un rol empleado, pero también tipos de empleado. En este caso: empleado gerontóloga. Y `empleado_gerontóloga` tiene acceso a estos instrumentos tanto para ver como para editar"

**Current code**: `enum RolUsuario { ADMIN EMPLEADO AUDITOR OPERADOR }` — no sub-roles

**Decision**:
- Two possible modeling approaches (needs user decision):
  - **Option A**: Add `EMPLEADO_GERONTOLOGA` as a first-class role in `RolUsuario`. Simplest but pollutes the enum for future specializations.
  - **Option B**: Keep `RolUsuario` as-is; add a new `tipoEmpleado` column on `Usuario` (or on `Empleado`) referencing a `TipoEmpleado` enum (`GERONTOLOGA, ...`). More scalable.
- Backend access control on `/instruments/*` endpoints must gate accordingly.

---

### 3.6 Version tracking on instrumento

**Source lines**: 194–197

**What speakers said**:
- B (line 194): "la versión sí es necesaria, ¿verdad?"
- A (line 195): "si hay una actualización, tú puedes mirar `estas evaluaciones corresponden a la actualización del 2025`. Y ahí tú le pones `B1` o puedes poner `versión 2025`"

**Current code**: Instrumento already has `versionPlantilla String @db.VarChar(20)` — this exists.

**Decision**: NO NEW SCHEMA. But the frontend edit form (`instrumentos/[id]/editar.vue`) should preserve the version input. Confirmed working — no change unless user reports otherwise.

---

## 4. Empleados

### 4.1 Remove `nivelEscritura` from create-empleado form

**Source lines**: 294–300

**What speakers said**:
- B (line 296): "nivel de escritura, cursiva, no pues no son…"
- B (line 299): "no ponga nada, quítelo"
- A (line 300): confirms — remove

**Current code**: `Empleado.nivelEscritura String @map("nivel_escritura") @db.VarChar(50)` (line 187 in schema)

**Decision**: Make it optional (`String?`) or remove entirely — user prefers removal. Migration required. Frontend: strip from `frontend/app/pages/empleados/nuevo.vue` + `[id]/editar.vue`.

---

### 4.2 Rework "Educación" tab

**Source lines**: 300–348

**What speakers said** (line 314–329):
- Add fields: `profesion` (career studied), `universidad`, `fechaGraduacion`
- Optional file: `diploma` (per-educacion-item)
- A (line 328): "es decir, en `educación` también está opcional para subir archivo que corresponde a la educación que usted puso"

**Current code**: existing structure of empleado "educación" tab — need to verify schema. Assume it's a related table `EducacionEmpleado` (or similar). If it's a single-record field, need to model as list.

**Decision**:
- Model `EducacionEmpleado` as a related list (empleado has N educaciones)
- Each row: `profesion, universidad, fechaGraduacion, diplomaUrl?` (S3 key)
- Frontend: repeatable form section
- Backend: new Prisma model + CRUD endpoints

---

### 4.3 New file: `documentoIdentificacionUrl` on Empleado personal data

**Source lines**: 322–329

**What speakers said**:
- B (line 322–326): "en datos personales que podamos agregar la cédula... el archivo de la cédula, no el documento — la cédula de ciudadanía"
- A (line 328): "en datos personales, subir el archivo de la cédula"

**Decision**:
- ADD `documentoIdentificacionUrl String? @db.VarChar(500)` (S3 key) to `Empleado`
- Frontend: file upload in datos-personales section of empleado create/editar

---

### 4.4 UX polish: file-input hover/pointer + "sin contrato activo" already OK

**Source lines**: 336–341

**What speakers said**:
- B (line 338): "resaltar un poco la opción para que el usuario entienda que debe hacer clic y poner el tipo `cursor: pointer`"
- Currently the file drop-zones lack an obvious "click me" affordance

**Decision**: Trivial CSS — add `cursor: pointer` + hover state on file-input dropzone components.

---

### 4.5 MAJOR: Move `Contrato` to its own tab (out of "información laboral")

**Source lines**: 349–370

**What speakers said**:
- B (line 349): "yo quiero que aquí quede cargado el contrato" — currently he can't find where to attach a signed contract
- A (line 365): "en información laboral, hay un apartado de contrato. Realmente vamos a crear un tab nuevo separado. El tema de contrato es información laboral, pero lo queremos en un tab diferente para que sea más visible"
- A (line 367): "tab aparte que se llame `contrato laboral`"

**Decision**:
- Add a new tab "Contrato laboral" on `frontend/app/pages/empleados/[id]/editar.vue` (and integrate in `nuevo.vue` as a step)
- Move all contract UI out of "información laboral"

---

### 4.6 Contrato: add signed-file upload + `cargo` (position) as configurable Enum

**Source lines**: 361–400

**What speakers said**:
- B (line 361): "el vencimiento también, desde qué fecha hasta qué fecha, y cargar el documento firmado"
- Cargo distinction (line 379): profesión (what they studied) ≠ cargo (job title at company)
- Cargo values (line 398, from B): `fisioterapeuta`, `terapeuta ocupacional`, `educador físico`, `manualidades`, `auxiliar de enfermería`, `auxiliar de servicios generales`, and 1 more (says "los tengo" — total 7)
- A (line 399): "en `nuevo contrato` vamos a agregar campo `cargo` que es un Enum. Ese Enum se define en la configuración de la empresa. Se cargan los cargos que la empresa ya define para organización interna. También va a salir la opción `agregar otro` para agregar un cargo nuevo cuando se necesite. Sin embargo, la mayoría de las veces se van a usar los mismos siete cargos. Para agregar un cargo nuevo se necesita seleccionar la opción `agregar cargo nuevo` y crearlo para que se agregue en el Enum en las posibles opciones de cargo"

**Current code**:
- `Contrato` model has `tipoContrato TipoContrato @map("tipo_contrato")`, `cargo String @db.VarChar(100)` (already a free-text `cargo` — see line 258 in schema)
- No signed-file column

**Decision**:
- ADD `archivoFirmadoUrl String? @db.VarChar(500)` on `Contrato`
- Convert `cargo` from free-text to an ENUM-like structure. Options:
  - **Option A**: New `CargoEmpresa` table with rows scoped per empresa (empresa admins can add rows). `Contrato.cargoId → CargoEmpresa.id`.
  - **Option B**: `cargo` stays as `String` but frontend renders as a select populated from a per-empresa config (`empresa_settings.cargos: string[]`). Backend Zod validates against the config.
- Frontend: new "Contrato laboral" tab includes `tipoContrato, fechaInicio, fechaFin, cargo (select + "agregar otro"), archivoFirmado (file)`
- Empresa config page (`/empresa/configuracion` or similar): admin UI to add/edit the cargos list

**Note on tipoContrato semantics** (line 386, unclear):
> "van a hacer esos es OPS o contrato laboral, no hay más"
- Speakers may have been simplifying — could mean current 4-value enum collapses to 2 groups (OPS vs contrato-laboral). Needs confirmation before schema change.

---

## 5. Global cross-cutting

### 5.1 Auto-uppercase all entity **name** fields

**Source lines**: 55–62

**What speakers said**:
- B (line 55): "para que desde el principio la plataforma vaya dando orden, que todo se pueda crear solamente en mayúsculas"
- B (line 57–58): "cuando uno abre su plataforma, qué lindo que se ve organizado. El nombre en mayúscula"
- A (line 62): "cualquier campo de texto área de texto — descripciones, notas largas — mayúsculas y minúsculas. Los nombres de las entidades (el nombre, el certificado): mayúsculas"

**Decision**:
- CSS `text-transform: uppercase` on input fields for entity names is NOT enough — the stored value must be uppercase (server-side) so reports/exports look consistent.
- Backend: middleware or Zod `.transform(v => v.toUpperCase())` on `nombre` fields for: `CertificadoEmpresa`, `Instrumento`, `Cliente`, `Empleado`, `Empresa` (and potentially others).
- Frontend: also uppercase-transform on the input as user types, so what they see matches what's stored.
- **Descriptions, notas, textareas**: LEAVE case as-is.

**Scope question**: does this apply to existing rows? User didn't say — probably not (leave historical data).

---

### 5.2 Empresa configuration page bug (repeated from §1.4)

Same as §1.4 — cannot save empresa fields. High-priority regression.

---

## 6. NÓMINA

**Source lines**: 287–292

**What speakers said**:
- Speakers open nómina, see the empty state because no empleados have active contracts
- A explains: "usted primero tiene empleados; la razón por la que no le sale nada es que no tiene empleados con contrato"
- No specific improvement requested — user confirms filter behavior is correct.

**Decision**: NO CHANGES to nómina in this session. The blocker to actually testing nómina is that empleados need signed contracts (§4.5 + §4.6). Once cargo/contract work is done, nómina QA can happen properly.

---

## Off-scope / pending items

| Item | Source line | Status |
|---|---|---|
| Reports module | 3 | Not touched yet — future work |
| Tile delivery phone call | 110–115 | IGNORE (unrelated) |
| Colombian holiday calendar for `fechaIncidente` | 121 | Deferred — use weekday-only fallback |
| Client Excel samples for TipoInstrumento | 199 | Waiting on client input (Tuesday) |

---

## Speaker mood + meta

- The session is affectionate ("mi amor" throughout) — B is likely a co-founder/spouse of A.
- Tone is collaborative, not combative — most requests are additive or refinements.
- Both speakers care about the platform "looking organized" (§5.1) as much as correctness.
- Meeting ends abruptly (line 401): they need to leave for a 9AM meeting. Not all points are fully resolved; some (like `tipoContrato` simplification and cargo Enum-vs-per-empresa) need follow-up.
