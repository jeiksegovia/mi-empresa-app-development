# QA Session — Jul 24 (Cleaned)

> Source: `qa-session-jul-24-raw.md` (voice transcription, Spanish).
> Structured into discrete, testable items. Each item maps to affected
> components / pages / backend endpoints. `type` ∈ {feature, correction, bug}.

Domain scope: **Empleados** (add/edit + payment method), **Cargos** (catalog),
**Asistencia** (RBAC by role/date), **Contratos + Nómina** (salary model by contract type).

---

## Item 1 — Medio de pago de nómina: Nequi "llave" + Efectivo
**Type:** feature + correction
**Area:** Add employee (`empleados/nuevo.vue`) + Edit (`empleados/[id]/editar.vue`),
Empleado payment fields, `MedioPagoNomina` enum.

**Corrections / feedback:**
1. **Nequi "llave"** — the Nequi identifier is a *llave* (key), which is **alphanumeric**:
   it can be a phone number, letters+numbers, or even an **email**. The current field
   treats it as a numeric cell number only. Relabel to "llave" and relax validation to
   accept alphanumeric + email.
   - Backend field: `Empleado.medioPagoNequi String? @db.VarChar(50)` (line 100).
2. **Transferencia bancaria** — leave as-is. Fields OK: nombre del banco, tipo de cuenta,
   número de cuenta (`bancoNombre`, `bancoTipoCuenta`, `bancoNumeroCuenta`).
3. **Efectivo** — add **cash** as a new payment-method option.
   - Add `EFECTIVO` to `enum MedioPagoNomina { NEQUI, TRANSFERENCIA_BANCARIA }` (line 1078).
   - When EFECTIVO is selected, no extra fields required.

**Acceptance:** create/edit employee with each of the 3 methods; Nequi accepts
`3001234567`, `mi.llave@correo.com`, and `LlaveABC123`; Efectivo saves with no bank/nequi data.

---

## Item 2 — Bug: cannot edit payment fields (backend error) + RBAC
**Type:** bug
**Area:** Edit employee endpoint (backend `patients`/`empleados` update route + service),
`empleados/[id]/editar.vue`.

**Problem:** Editing *only* the payment-method fields raises a backend error — the field
cannot be edited in isolation.

**Requirements:**
- Payment fields must be editable standalone (partial update).
- Editable by **both** `ADMIN` **and** `CONTRATOS` roles.

**Acceptance:** PATCH/PUT employee changing only `medioPagoTipo`/nequi/banco succeeds
(200) for ADMIN and CONTRATOS; no 500.

---

## Item 3 — Remove "Cargos" from Información Laboral tab (redundant)
**Type:** correction
**Area:** Employee form — "Información Laboral" tab (`empleados/nuevo.vue`,
`empleados/[id]/editar.vue`), `Cargo` model (per-employee `cargos`).

**Problem:** The "Cargos" section inside the *Información Laboral* tab duplicates
"Experiencia Laboral". Remove it.

**Requirements:** Delete the Cargos UI item from the Información Laboral tab.
Backend `Cargo` model handling to be confirmed (see open questions — keep vs. drop).

**Acceptance:** Información Laboral tab no longer shows the Cargos block; experiencia
laboral remains the single source for past positions.

---

## Item 4 — Default company positions (Cargos por defecto)
**Type:** correction
**Area:** `DEFAULT_CARGOS` (`backend/src/services/empresaService.ts:35`), reconcile
migration for `cargos_empresa`, contract cargo selector.

**Current defaults:** Fisioterapeuta, Terapeuta Ocupacional, Educador Físico,
Manualidades, Auxiliar de Enfermería, Auxiliar de Servicios Generales, Otro.

**Target defaults:**
| Category | Cargo |
|----------|-------|
| Base | Administrador *(new)* |
| Base | Auxiliar de Enfermería |
| Base | Gerontólogo/Gerontóloga *(new)* |
| Base | Servicios Generales *(rename from "Auxiliar de Servicios Generales")* |
| Base | Temporal *(new)* |
| Profesional | Terapeuta Ocupacional |
| Profesional | Fisioterapeuta |
| Profesional | Psicólogo *(new)* |
| Profesional | Educador Físico |
| Profesional | Artes y Manualidades *(rename from "Manualidades")* |

- **Remove:** Cocinera (if present in any environment).
- **Add:** Administrador, Gerontólogo, Temporal, Psicólogo.
- **Rename:** Auxiliar de Servicios Generales → Servicios Generales; Manualidades →
  Artes y Manualidades.

**Note:** `cargos_empresa` rows may be referenced by `Contrato` (FK `onDelete: Restrict`).
Removal/rename strategy needs care — see open questions.

**Acceptance:** fresh DB `createEmpresa` seeds exactly the target catalog; existing
environments reconciled without breaking contract references.

---

## Item 5 — Payment-method preview in employee profile
**Type:** feature
**Area:** Employee detail — Información Personal (`empleados/[id]/index.vue`).

**Requirement:** In the employee profile "Información Personal" section, show a
**read-only preview** of the selected payment method and its available data
(e.g. "Nequi — mi.llave@correo.com" / "Transferencia — Bancolombia, Ahorros, ****1234"
/ "Efectivo"), for validation.

**Acceptance:** profile displays the configured medio de pago summary; empty state when
none configured.

---

## Item 6 — Asistencia permissions by role + date
**Type:** feature (RBAC)
**Area:** `PUT /asistencia/dia` (`asistencia.routes.ts`, `asistenciaService.ts`),
`domainAccess.ts`, `asistencia/index.vue`.

**Requirements:**
- **CONTRATOS role:** may save attendance **only for today** (present day). Cannot edit
  past/future dates.
- **ADMIN role:** may pick any date and edit/change **any** attendance record, including
  past days (e.g. today=24 can still edit the 23rd).
- Attendance UI allows reporting non-attendance and adding a **note/justification**
  (e.g. reason for double pay). Confirm note field exists / add if missing.

**Acceptance:** CONTRATOS PUT with `fecha != today` → 403; CONTRATOS PUT `fecha == today`
→ 200; ADMIN PUT any date → 200. Note persists on the record.

---

## Item 7 — Contract salary model by contract type (Nómina impact)
**Type:** feature
**Area:** `Contrato` model + `enum TipoContrato`, contract create/edit endpoint & form,
`nominaService.ts` / `NominaPeriodo`.

**Requirement:** Salary basis depends on contract type:
- **OPS** → per **jornada** (media jornada / 4h) — existing `valorJornada`.
- **OBRA_O_LABOR, TERMINO_FIJO, TERMINO_INDEFINIDO** → **fixed monthly** salary
  (total for the whole month), NOT per-jornada.

**Technical direction (from raw §technical consideration):**
> Add a monthly-value field to the schema; nómina uses the target field depending on
> contract type so nómina logic stays simple. It is always one of:
> **labor-hour / half-jornada payment / monthly-value.**

Proposed: add `Contrato.valorMensual Decimal?`. Contract create requires `valorJornada`
for OPS, `valorMensual` for the other three types. Nómina computation branches on
`tipoContrato`.

**Acceptance:** creating a TERMINO_FIJO contract requires monthly value (not jornada);
nómina for that employee computes from monthly value; OPS still computes from jornadas.

---

## Cross-cutting open questions (resolve before implementation)
1. **Item 3 / Item 4 — `Cargo` vs `CargoEmpresa`:** "remove cargos from Información
   Laboral" (per-employee `Cargo`) vs the company catalog `CargoEmpresa` — confirm the
   per-employee `Cargo` model is fully deprecated or only hidden in that tab.
2. **Item 4 — catalog reconciliation:** how to handle rename/remove when `cargos_empresa`
   rows are FK-referenced by existing `Contrato` rows (archive vs rename-in-place vs new).
3. **Item 7 — nómina migration:** back-fill / handling of existing non-OPS contracts that
   currently only have `valorJornada`.
4. **Scope:** implement all 7 items now, or split into a smaller first wave?
