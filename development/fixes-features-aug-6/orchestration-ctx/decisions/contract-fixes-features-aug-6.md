# Schema & Behavior Contract: fixes-features-aug-6

**Author:** W1 (pt-data-schema)
**Date:** 2026-08-05
**Status:** Published · authoritative source for W2 (backend) and W3 (frontend).
**Read first, before opening any `schema.prisma`, `domainAccess.ts`, or `useDomainAccess.ts` file.**

This contract is the shared interface for the 4 items in this wave
(S1: new roles PROFESORES + AUXILIARES · S2: 2 new instruments
`SIGNOS_VITALES` + `BOLETIN_ANUAL` · S3: GERONTOLOGA certificados access
· S4: gerontologa-can't-create-fillable-instrument bug). W2 and W3 must
implement to this contract — they should **not** read `schema.prisma` or
the existing `DOMAIN_ACCESS` matrix directly for facts. Any change that
conflicts with this doc is a breaking change and must be escalated.

**Source of truth (do not duplicate):**
- `backend/prisma/schema.prisma` `enum TipoEmpleado` (line ~860)
- `backend/src/middleware/domainAccess.ts` `DOMAIN_ACCESS` matrix
- `backend/src/services/instrumentService.ts:552-585` `getInstrumentDefinition`
- `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json`,
  `BOLETIN_ANUAL.v1.json`
- `frontend/app/composables/useDomainAccess.ts` (FE mirror)

---

## 1. Enums

### `TipoEmpleado` (Usuario.tipoEmpleado)
- Values: `GERONTOLOGA` | `CONTRATOS` | **`PROFESORES`** *(new this migration)* | **`AUXILIARES`** *(new this migration)*
- Additive — no existing rows are rewritten. Existing null `tipoEmpleado`
  rows remain null. Both new values start at zero users.
- FE `TipoEmpleado` type (in `frontend/app/shared/types/api.ts`) must mirror
  the 4-value set.

---

## 2. DOMAIN_ACCESS matrix (FRONTEND + BACKEND)

### 2.1 `DomainAccessValue` (extended vocabulary)

```ts
// backend/src/middleware/domainAccess.ts
export type DomainAccessValue = boolean | 'create-only' | 'read-only'

// frontend/app/composables/useDomainAccess.ts (mirror)
export type DomainAccessValue = boolean | 'create-only' | 'read-only'
```

| Value | GET | POST | PUT/PATCH/DELETE |
|---|---|---|---|
| `true` | ✓ | ✓ | ✓ |
| `false` | ✗ (403) | ✗ (403) | ✗ (403) |
| `'create-only'` | ✓ | ✓ | ✗ (403) |
| **`'read-only'`** *(new)* | ✓ | ✗ (403) | ✗ (403) |

`requireDomain()` middleware: when cell is `'read-only'` and method is
anything other than GET, respond `{ success: false, message: 'Acceso no
permitido para su perfil', code: 'DOMAIN_FORBIDDEN' }` with status 403.
Identical error envelope to the existing `create-only` 403 branch.

FE `useDomainAccess()`: extend with `isReadOnly(domain)`:
```ts
function isReadOnly(domain: Domain): boolean {
  return access(domain) === 'read-only'
}
```
`can(domain)` returns `true` for `read-only` (UI shows the section).
`canCreateOnly(domain)` returns `false` for `read-only`. The new
`isReadOnly` flag controls hide-vs-show of write affordances in the UI.

### 2.2 Full matrix (4 tipos × 11 domains) — authoritative for W2 + W3

```ts
export const DOMAIN_ACCESS: Record<
  'GERONTOLOGA' | 'CONTRATOS' | 'PROFESORES' | 'AUXILIARES',
  Record<Domain, DomainAccessValue>
> = {
  GERONTOLOGA: {
    pacientes: true,
    fichas: true,
    instrumentos: true,
    empleados: false,
    nomina: false,
    certificados: true,        // CHANGED: was false → true (S3)
    empresa: false,
    notas: true,
    asistencia: false,
    'centro-costos': false,
  },
  CONTRATOS: {
    pacientes: 'create-only',
    fichas: false,
    instrumentos: false,
    empleados: true,
    nomina: true,
    certificados: true,
    empresa: false,
    notas: false,
    asistencia: true,
    'centro-costos': true,
  },
  // NEW (S1): Identical rows for the two new sub-roles.
  PROFESORES: {
    pacientes: 'read-only',     // S1: view basic info, no create/edit
    fichas: 'create-only',      // S1: fill ficha, no edit/delete
    instrumentos: false,        // S1: cannot manage catalog
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',       // S1 + S3: create-only (see §4 for autor filter)
    asistencia: false,
    'centro-costos': false,
  },
  AUXILIARES: {
    pacientes: 'read-only',     // S1: identical to PROFESORES
    fichas: 'create-only',
    instrumentos: false,
    empleados: false,
    nomina: false,
    certificados: false,
    empresa: false,
    notas: 'create-only',       // S1: identical to PROFESORES
    asistencia: false,
    'centro-costos': false,
  },
}
```

QA validates cell-by-cell parity (FE `useDomainAccess.ts` ↔ BE
`domainAccess.ts`) — the literal table IS the spec.

### 2.3 `tipoEmpleado` middleware allow-list (extension)

`requireDomain()` step 5 currently only accepts `GERONTOLOGA` or `CONTRATOS`
and warns/allows unknown values. Extend to accept the 4-value union:
```ts
const MATRIX_TIPOS = ['GERONTOLOGA', 'CONTRATOS', 'PROFESORES', 'AUXILIARES'] as const
if (!MATRIX_TIPOS.includes(tipoEmpleado as any)) {
  // unchanged: unknown future specialization → allow (legacy zero-regression)
  next(); return
}
```

### 2.4 FE `useDomainAccess` profile allow-list

```ts
const profile = computed<TipoEmpleado | null>(() => {
  const rol = authStore.role
  if (rol === 'ADMIN') return null
  if (rol !== 'EMPLEADO') return null
  const tipo = authStore.user?.tipoEmpleado
  return (tipo === 'GERONTOLOGA' || tipo === 'CONTRATOS' ||
          tipo === 'PROFESORES' || tipo === 'AUXILIARES')
    ? tipo : null
})
```

### 2.5 S3 — GERONTOLOGA certificados access

W2 solely updates `GERONTOLOGA.certificados: false → true` in BOTH
mirrors. The matrix cell is in §2.2 above. W2 routes the existing
`/certificados` endpoints behind `requireDomain('certificados')` (W2
checks route inventory; existing uncertified endpoints may still bypass
the matrix — only add the guard where the matrix semantics are clear).

---

## 3. `rolesPermitidos` gating (S4 — bug fix)

### 3.1 Current bug (informational — fix is S4)

`instrumentService.getInstrumentDefinition` (line ~554-585) only checks
intersection of caller CSV tokens against `Instrumento.rolesPermitidos`.
ADMIN bypass is "implicit" via the CSV — but when a GERONTOLOGA creates
an instrument from a template, the resulting `rolesPermitidos` row is
seeded as `'ADMIN,EMPLEADO'` (per `instruments-upgrade.ts:313`), so a
GERONTOLOGA's caller CSV `['EMPLEADO','GERONTOLOGA']` does NOT intersect
`['ADMIN','EMPLEADO']` on `GERONTOLOGA` and the call fails with
`ROLE_NOT_ALLOWED`. Caller experience: "no puede ser llenado".

### 3.2 Fixed matching rule (S4 contract — W2 implements)

In `getInstrumentDefinition` and every fill/record path that currently
re-implements the same CSV intersection:

1. **Explicit ADMIN bypass**: if `rol === 'ADMIN'` (resolved from the
   Usuario row, ignoring `tipoEmpleado`), allow regardless of
   `rolesPermitidos`. ADMIN never gets `ROLE_NOT_ALLOWED`.
2. **Token comparison**: split both CSVs on `,`, trim, UPPER, drop empty.
   Tokens are any of:
   - `RolUsuario` enum strings: `ADMIN`, `EMPLEADO`, `AUDITOR`, `OPERADOR`
   - `TipoEmpleado` enum strings: `GERONTOLOGA`, `CONTRATOS`,
     `PROFESORES`, `AUXILIARES` (new)
   - Free-form cargo names (any string the creator added, e.g. `'AUXILIAR QA'`)
   - Literal `'ADMIN'` token (case-insensitive) — duplicate of #1 for safety
3. **Match rule**: intersection of caller tokens ∩ allowed tokens must be
   non-empty. Single-token-caller case (most common) reduces to
   `allowed.includes(callerToken)`.
4. **New-role tokens**: add `PROFESORES` and `AUXILIARES` to the same
   `MATRIX_TIPOS` allow-list used in §2.3.

### 3.3 Create-default `rolesPermitidos` (W2 implements)

When a GERONTOLOGA (or any non-ADMIN EMPLEADO) creates a new instrument
via the existing create endpoint, the resulting `Instrumento.rolesPermitidos`
CSV must include the creator's tokens so they can immediately fill:

```ts
function defaultRolesPermitidos(creator: { rol: string; tipoEmpleado: string | null }): string {
  const tokens = ['ADMIN', creator.rol]
  if (creator.tipoEmpleado) tokens.push(creator.tipoEmpleado)
  return [...new Set(tokens)].join(',')
}
```

ADMIN always has `'ADMIN,EMPLEADO'` (back-compat) — but the function above
yields `'ADMIN,ADMIN'` for ADMIN which is harmless (intersection includes
`ADMIN`). W2 may special-case ADMIN to `'ADMIN,EMPLEADO,GERONTOLOGA,CONTRATOS,PROFESORES,AUXILIARES'`
to preserve the prior behavior.

### 3.4 Seeded/templated instruments — `rolesPermitidos` for the 2 new ones

The `instruments-upgrade.ts` script (W1-readonly: W2 may extend it) seeds
`rolesPermitidos: 'ADMIN,EMPLEADO'` on insert. The 2 new instruments
require:

| codigo | `rolesPermitidos` (target) |
|---|---|
| `SIGNOS_VITALES` | `ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES` |
| `BOLETIN_ANUAL` | `ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES` |

**Implementation path (W2 owns):** W2 extends `instruments-upgrade.ts` to
read an optional `rolesPermitidos` field at the top level of the template
JSON if present. If present, use it; otherwise fall back to the current
`'ADMIN,EMPLEADO'`. W1 writes the field into both new templates
(see §5). After upgrade, the Instrumento row's `rolesPermitidos` is set
correctly at insert time (no post-upgrade SQL needed).

---

## 4. Notes privacy (S3 — autor filter)

### 4.1 Schema (no change)

`NotaCliente.autor` (existing FK to Usuario) and `visiblePara` (existing
column) are reused. No new column.

### 4.2 RBAC behavior (W2 implements)

| Role | LIST (`GET /patients/:id/notes` if it exists, or via the patient detail payload) | POST | PUT/PATCH | DELETE |
|---|---|---|---|---|
| `ADMIN` | unfiltered | ✓ | ✓ | ✓ |
| `AUDITOR`, `OPERADOR` | unfiltered (read-only by current route audit) | depends on existing route | ✗ | ✗ |
| `EMPLEADO + GERONTOLOGA` | unfiltered | ✓ | ✓ | ✓ |
| `EMPLEADO + CONTRATOS` | denied (matrix `notas: false`) | denied | denied | denied |
| **`EMPLEADO + PROFESORES`** *(new)* | **filtered: `where.autor = userId`** | ✓ | denied (403) | denied (403) |
| **`EMPLEADO + AUXILIARES`** *(new)* | **filtered: `where.autor = userId`** | ✓ | denied (403) | denied (403) |
| `EMPLEADO + null` (legacy) | unfiltered | ✓ | ✓ | ✓ |

### 4.3 Implementation contract (W2)

- W2 adds (or extends) a route guard for notes LIST equivalent to:
  ```ts
  if (tipoEmpleado === 'PROFESORES' || tipoEmpleado === 'AUXILIARES') {
    where.autor = userId
  }
  ```
- W2 adds a PUT/DELETE middleware that 403s for `PROFESORES`/`AUXILIARES`
  (the matrix `notas: 'create-only'` already blocks PUT/DELETE on the
  write endpoint at the `requireDomain` layer; LIST is the special case).
- W2 backend tests cover: PROFESORES LIST returns only own notes; PUT
  → 403; delete → 403; ADMIN/GERONTOLOGA LIST returns all.

---

## 5. Two new instrument templates

Both are **informational (non-scored)** per locked decision D4. Both
define `rolesPermitidos` at the top level (consumed by the W2 extension
to `instruments-upgrade.ts` per §3.4).

### 5.1 `SIGNOS_VITALES.v1.json`

**Top-level fields:**
```json
{
  "codigo": "SIGNOS_VITALES",
  "nombre": "Signos Vitales",
  "version": 1,
  "tipo": "VALORACION",
  "descripcion": "Registro periódico de signos vitales del abuelo/a: O2, presión arterial, FC, FR, temperatura y observaciones por cada toma.",
  "instructions": "Registre una fila por cada medición de signos vitales. Use el botón \"Agregar medición\" para añadir nuevas filas al grupo.",
  "periodicidad": "MENSUAL",
  "rolesPermitidos": "ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES",
  "sections": [...],
  "scoring": { "total": "none", "resultEvaluation": [] }
}
```

**Sections (exact item IDs for W3 fill view):**

- `paciente` (header, no scoring):
  - `paciente_tipo_documento` — `single-select-info`, options `[{cc, label:"C.C."}, {otro, label:"Otro"}]`, required
  - `paciente_documento_otro` — `text-info`, optional, placeholder "¿Cuál?"
  - `paciente_nombre_completo` — `text-info`, required
  - `paciente_edad` — `number-info`, required, constraints `{min: 0, max: 130}`
  - `paciente_sexo` — `single-select-info`, options `[{masculino},{femenino}]`, required

- `mediciones` (repeatable vitals group, `type: 'group-info'`, `cellInput: 'text'`):
  - `id: 'mediciones'`
  - `label: 'Mediciones de signos vitales'`
  - `required: false` (the whole sheet is a placeholder — empty is allowed,
    the group supports 0..N rows)
  - `columns` (7, all `score: null`):
    | id | label |
    |---|---|
    | `fecha_hora` | Fecha y hora |
    | `o2` | O₂ (%) |
    | `presion_arterial` | Presión arterial (mmHg) |
    | `fc` | FC (lpm) |
    | `fr` | FR (rpm) |
    | `temperatura` | Temperatura (°C) |
    | `observaciones` | Observaciones |
  - `rows`: a single fixed row `id: 'medicion_1'` with `label: 'Medición 1'`.
    The frontend replicates this row dynamically via "Agregar medición"
    (`medicion_2`, `medicion_3`, …) — the definition seeds only the first
    row; the fill view appends new rows by duplicating the row schema.

  Validation per `instrumentScoringService.validateRespuestas` with
  `cellInput: 'text'`: every row × column cell must be present (or the
  row is dropped by the FE). Empty strings are valid.

### 5.2 `BOLETIN_ANUAL.v1.json`

**Top-level fields:**
```json
{
  "codigo": "BOLETIN_ANUAL",
  "nombre": "Boletín Anual de Usuarios",
  "version": 1,
  "tipo": "VALORACION",
  "descripcion": "Boletín anual multidisciplinario que sintetiza la evolución del abuelo/a por componente (psicología, deporte, terapia ocupacional, fisioterapia, componente social, enfermería).",
  "instructions": "Complete un boletín por abuelo/a por año. Cada componente lo registra el profesional responsable.",
  "periodicidad": "ANUAL",
  "rolesPermitidos": "ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES",
  "sections": [...],
  "scoring": { "total": "none", "resultEvaluation": [] }
}
```

**Sections (exact item IDs):**

- `paciente` (header):
  - `boletin_tipo_documento` — `single-select-info`, options `[{cc},{otro}]`, required
  - `boletin_documento_otro` — `text-info`, optional
  - `boletin_numero_documento` — `text-info`, required, placeholder "Número de documento"
  - `boletin_nombre_apellido` — `text-info`, required
  - `boletin_periodo_anio` — `number-info`, required, constraints `{min: 2020, max: 2099}`
  - `boletin_edad` — `number-info`, required, `{min: 0, max: 130}`
  - `boletin_sexo` — `single-select-info`, options `[{masculino},{femenino}]`, required

- `componentes` (long free-text sections, all `text-info`, required):
  - `boletin_psicologia` — label "Psicología"
  - `boletin_deporte` — label "Deporte"
  - `boletin_terapia_ocupacional` — label "Terapia Ocupacional"
  - `boletin_fisioterapia` — label "Fisioterapia"
  - `boletin_componente_social` — label "Componente Social"
  - `boletin_concepto_enfermeria` — label "Concepto de Enfermería"

- `autor` (optional signature line, single `text-info`):
  - `boletin_autor` — label "Profesional que registra", optional,
    placeholder "Nombre del profesional"

### 5.3 Validation/test contract (W2)

Both templates must pass `instruments-upgrade.ts` `validateDefinition`:
- `tipo` is `VALORACION` (in `VALID_TIPOS`)
- `scoring.total` is `'none'` (in `VALID_TOTAL`)
- All item `type` strings are in `VALID_TYPES`
- All `text-info` items have no `options`/`constraints`
- All `number-info` items have valid `constraints`
- All `group-info` items have ≥2 columns, ≥1 row, columns `score: null`
- Section IDs and item IDs are unique within the definition

Both templates' insert + activation via `npm run instruments:upgrade`
must produce one `instrumento` row + one `instrumento_version` row with
`activo = true`. The `rolesPermitidos` field on the Instrumento row must
match the values in §3.4.

---

## 6. Cross-cutting acceptance

For the whole team to consider the wave done:
1. `npx prisma migrate status` clean against local `:15432`.
2. `enum TipoEmpleado` = `{GERONTOLOGA, CONTRATOS, PROFESORES, AUXILIARES}` (4 values).
3. `DOMAIN_ACCESS` matrix parity FE ↔ BE; cell-by-cell test in BE
   (`backend/tests/rbac/`) and FE (`frontend/tests/rbac/`).
4. New `'read-only'` matrix value honored by `requireDomain` and FE
   `isReadOnly()`.
5. `GERONTOLOGA.certificados`: false → true (FE + BE).
6. The 2 new instruments pass `npm run instruments:upgrade`; new active
   `instrumento_version` rows exist; `rolesPermitidos` matches §3.4.
7. Gerontologa-create repro: `POST /instrumentos` with TINETTI seed →
   `GET /instrumentos/SIGNOS_VITALES/definition` with caller
   `EMPLEADO,GERONTOLOGA` → 200 (was 403).
8. Notes LIST filtered by `autor` for PROFESORES/AUXILIARES; PUT/DELETE
   → 403 for those roles.

---

## 7. Out of scope for this contract

- Staging deploy: gated step, deferred.
- New tables/columns: NONE. Enum add is the only schema change.
- `Empresa` / `Cargo` / `MedioPagoNomina` / `TipoContrato` / `TipoCuentaBanco`
  enums: unchanged.
- `assistant_general_user` / Roles for the new TIPOs at the auth layer:
  W2 uses the same `requireDomain` extension; no new auth helper.

---

## 8. File-by-file list (who-touches-what)

| Surface | W1 (this PR) | W2 | W3 |
|---|---|---|---|
| `backend/prisma/schema.prisma` enum | add PROFESORES + AUXILIARES | — | — |
| `backend/prisma/migrations/<ts>_add_tipoempleado_profesores_auxiliares/migration.sql` | add 2x `ALTER TYPE ... ADD VALUE` | — | — |
| `backend/prisma/instrument-templates/SIGNOS_VITALES.v1.json` | author | — | — |
| `backend/prisma/instrument-templates/BOLETIN_ANUAL.v1.json` | author | — | — |
| `backend/src/middleware/domainAccess.ts` | — | extend `DomainAccessValue`, add `read-only` branch, add new matrix rows, fix certificados GERONTOLOGA, extend MATRIX_TIPOS | — |
| `backend/src/services/instrumentService.ts:552-585` | — | explicit ADMIN bypass + token casing + new-role tokens | — |
| `backend/src/services/instrumentService.ts` create endpoint | — | default `rolesPermitidos` includes creator's tokens | — |
| `backend/scripts/instruments-upgrade.ts` | — | (optional) read `rolesPermitidos` from template.top | — |
| `backend/src/routes/patients.routes.ts` notes | — | autor filter for PROFESORES/AUXILIARES LIST; PUT/DELETE 403 | — |
| `frontend/app/composables/useDomainAccess.ts` | — | — | extend `DomainAccessValue`, add `isReadOnly`, matrix rows, certificados GERONTOLOGA, profile allow-list |
| `frontend/app/shared/types/api.ts` | — | — | extend `TipoEmpleado` union |
| `frontend/app/pages/**` (UI mirroring) | — | — | sidebar/section/CTA mirrors |
| `backend/tests/rbac/**` | — | matrix parity, new roles, read-only, certificados | — |
| `backend/tests/instruments-dynamic/**` | — | upgrade activates 2 new + rolesPermitidos + repro test | — |
| `backend/tests/patients/**` | — | notes autor filter + PUT/DELETE 403 | — |
| `frontend/tests/rbac/**` | — | — | parity tests |
| `frontend/tests/**` (instrument fill, notes UI) | — | — | fill view for SIGNOS_VITALES + BOLETIN_ANUAL, notes UI |
