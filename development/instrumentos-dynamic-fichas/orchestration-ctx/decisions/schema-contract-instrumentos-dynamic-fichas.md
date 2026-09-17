# Schema Contract — instrumentos-dynamic-fichas

> **Status**: W1 draft (2026-07-16). Authoritative for W2 / W3 / W4 build phase.
> Deviation sections are placeholders; W2/W3/W4 fill them only if implementation evidence demands.

This document is the **single source of truth** for the dynamic-instruments architecture. Workers W2/W3/W4
read this file (and only this file among the contract artifacts) when answering structural questions.
Deviations must be filed in the `## Deviations — W*` sections at the bottom, never in §1–§7.

---

## §1. Definition JSON format

A **definition** is one immutable JSON document per `InstrumentoVersion`. Stored JSONB in Postgres
and mirrored verbatim under `backend/prisma/instrument-templates/{codigo}.v{n}.json` in the repo.

### Top-level shape

```jsonc
{
  "codigo": "BARTHEL",                   // string, stable identifier; matches Instrumento.codigo
  "nombre": "Índice de Barthel",         // string, Spanish display name
  "version": 1,                          // integer, ≥ 1
  "tipo": "VALORACION",                  // enum TipoInstrumento (no new values, see §6)
  "descripcion": "...",                  // optional string
  "instructions": "...",                 // optional string — rendered above the first section
  "mergeOf": ["MNA", "CUADRO_ALIMENTOS"], // optional string[] — only for MNA_CUADRO (locked decision)
  "sections": [ /* see §1.2 */ ],
  "scoring": { /* see §1.3 */ }
}
```

### §1.1 Required top-level keys

- `codigo` (string, unique per `Instrumento`)
- `nombre` (string)
- `version` (int ≥ 1)
- `tipo` (enum: `VALORACION | NUTRICION | MATRICULA | ADMISION`)
- `sections` (array, ≥ 1)
- `scoring` (object)

### §1.2 Section shape

```jsonc
{
  "id": "abvd",                          // string, unique within definition
  "titulo": "Actividades básicas de la vida diaria",
  "instructions": "...",                 // optional — section-level consigna
  "subtotal": {                          // optional — omit for info-only sections
    "max": 100,
    "resultEvaluation": [ /* optional — same range shape as §1.3; classifies THIS section's
                             subtotal. REQUIRED on any section referenced by a skipIf rule
                             (it provides the classification when the dependent section is
                             skipped — e.g., MNA cribaje 12-14 normal / 8-11 riesgo / 0-7
                             malnutrición). */ ]
  },
  "condition": {                         // optional — only one rule shape allowed (see §1.4)
    "skipIf": { "sectionId": "cribaje", "op": ">=", "value": 12 }
  },
  "items": [ /* see §1.5 */ ]
}
```

### §1.3 Scoring block

Two allowed shapes (mutually exclusive):

**Shape A — Sum + classification (default)**:

```jsonc
{
  "total": "sum",                        // total = sum of all scored item values
  "resultEvaluation": [
    { "min": 0,  "max": 44,  "label": "Dependencia severa" },
    { "min": 45, "max": 59,  "label": "Dependencia grave" },
    { "min": 60, "max": 79,  "label": "Dependencia moderada" },
    { "min": 80, "max": 100, "label": "Dependencia ligera" }
  ]
}
```

- `resultEvaluation` ranges are **inclusive on both ends** and **gapless/non-overlapping over the
  set of REACHABLE totals** covering `[0, globalMax]`. Adjacent ranges step by the instrument's
  score granularity (1, or 0.5 when any option score uses half points — e.g., MNA `16.5 → 17`).
- Scores and totals are **numbers, not necessarily integers** (MNA uses 0.5 steps). The DB stores
  totals as `Float` (§3.3). If no range matches a computed total (must not happen for valid
  definitions), the engine sets `clasificacion = null` and logs — it never throws.
- Ordering: **any order is accepted** (clinical convention is descending — best/worst first; the engine matches by `min <= total <= max`, not by position). The checker requires ranges to start at 0, not overlap, and have no gaps.
- A definition MAY have a single range `{ "min": 0, "max": <max>, "label": "..." }` to express a binary outcome.
- **Classification source rule**: if any section was SKIPPED via its `skipIf` condition, the
  record's `clasificacion` comes from the trigger section's `subtotal.resultEvaluation` applied
  to that section's subtotal (official MNA behavior: cribaje ≥ 12 → "Estado nutricional normal"),
  and `puntajeTotal` = sum of the ANSWERED sections only. If no section was skipped, the global
  `scoring.resultEvaluation` applies to the full total.

**Shape B — No scoring (informational instruments, D4)**:

```jsonc
{
  "total": "none",
  "resultEvaluation": []
}
```

Used by `FICHA_NUTRICIONAL`. Engine produces `puntajeTotal = null`, `clasificacion = null`.

### §1.4 Conditional logic — single allowed shape

Exactly **one** rule shape is supported across the entire system:

```jsonc
"condition": {
  "skipIf": { "sectionId": "<id-of-earlier-section>", "op": ">=", "value": <number> }
}
```

- `sectionId` must reference a section that appears **before** the current one in the `sections` array,
  and that section MUST declare `subtotal.resultEvaluation` (classification fallback, §1.3).
- `op` is one of `">="` | `"<="` | `">"` | `"<"` | `"=="` | `"!="`. Only `">="` is used by the seeded templates (MNA cribaje → evaluación).
- `value` is a number.
- **`skipIf` means MAY-skip, not must-skip** (official MNA: "para una evaluación más detallada,
  continúe con las preguntas G-R"). When the condition is met the section becomes OPTIONAL:
  - Frontend: collapses/greys the section, offers "Completar de todos modos".
  - Backend: the section counts as SKIPPED iff the condition is met AND none of its items appear
    in `respuestas`. If ANY of its items are answered, ALL its required items are required and the
    section scores normally (global classification applies). Partial answers → `INVALID_ANSWER_PAYLOAD`.
  - When the condition is NOT met, the section is required as normal.
- **No nested conditions. No cross-item conditions. No show/hide rules for individual items.** The engine supports exactly one rule shape; nothing more (locked decision D3 + plan §"Risk & Unknowns").

If the MNA merge is removed in a future version and no other conditional needs arise, the entire `condition` block is **dropped** from the schema — it does not stay for hypothetical future use.

### §1.5 Item shape

```jsonc
{
  "id": "item_1",                        // string, unique within definition
  "label": "Comida",                     // string — Spanish UI label
  "type": "single-select-scored",        // see §2 type registry
  "required": true,                      // boolean
  "instructions": "...",                 // optional — item-level help text
  "options": [                           // required for: single-select-scored, single-select-info, boolean-scored
    { "value": "independiente", "label": "Independiente", "score": 10 },
    { "value": "ayuda",       "label": "Necesita ayuda", "score": 5 },
    { "value": "dependiente", "label": "Dependiente",    "score": 0 }
  ],
  "constraints": { "min": 0, "max": 300 }, // optional — for number-info (numeric bounds)
  "rows": [ /* required for group-info */ ]
}
```

### §1.6 group-info extension

```jsonc
{
  "id": "cuadro_alimentos",
  "label": "Frecuencia de consumo por grupo de alimentos",
  "type": "group-info",
  "required": true,
  "columns": [
    { "id": "diario",  "label": "Diario",  "score": null },
    { "id": "semanal", "label": "Semanal", "score": null },
    { "id": "mensual", "label": "Mensual", "score": null },
    { "id": "nunca",   "label": "Nunca",   "score": null }
  ],
  "rows": [
    { "id": "cereales",      "label": "Cereales y RTP's" },
    { "id": "frutas",        "label": "Frutas" },
    { "id": "verduras",      "label": "Verduras" },
    { "id": "carnes",        "label": "Carnes y sustitutos" },
    { "id": "lacteos",       "label": "Lácteos y sustitutos" },
    { "id": "grasas",        "label": "Grasas" },
    { "id": "dulces",        "label": "Dulces" }
  ]
}
```

- Answers for a `group-info` item are an array of `{ rowId, columnId }` pairs (one per row).
- No scores are extracted; `column.score` is always `null`.
- Score-less — does not contribute to subtotal.

### §1.7 Adjustments to feature plan §1 draft

The plan §1 listed `{ id, label, type, required, score?, options?, constraints? }` for items. Adjustments made:

| # | Adjustment | Reason |
|---|---|---|
| A1 | Added `instructions` (string, optional) at item, section, and top level | Preserves consignas like "reste de 7 en 7 desde el 100" without leaking into labels |
| A2 | Added `subtotal.max` instead of `subtotal` as a bare number | Allows future subtotal metadata (e.g., weight) without breaking the schema |
| A3 | Added `mergeOf` (optional string[]) | Documents the locked MNA + Cuadro merge without forcing other templates to declare it |
| A4 | `resultEvaluation` item shape is `{ min, max, label }` (no `severity`) | The plan mentioned `severity`; we omit it because classification labels already encode clinical priority. Avoids redundant info. |
| A5 | Added scoring shape B (`"total": "none"`) | Required by D4 (Ficha Nutricional). The plan only mentioned sum; we extend to include the no-scoring case explicitly. |
| A6 | `group-info` columns declared with `score: null` | Plan said "no scores" informally; we make the no-score contract explicit so future types don't accidentally default to 0 |
| A7 | `options` `score` accepts **any number**, including fractions (`0.5`, `1.0`, `2.0`) | MNA uses 0.5 scoring (K, M, P, Q). Plan implied integers only via "score values". |

**G2 orchestrator re-architecture adjustments (2026-07-17)** — applied after raw-source verification
(see `decisions/g2-orchestrator-template-rearchitecture.md` §Fixes Applied):

| # | Adjustment | Reason |
|---|---|---|
| G2-1 | `boolean-scored` type REMOVED; minimal set = 5 types | Structurally identical to `single-select-scored` with 2 options; presentation is a render decision by `options.length` |
| G2-2 | `subtotal.resultEvaluation` (optional; REQUIRED on skipIf-referenced sections) | Official MNA classifies by cribaje ranges (12–14/8–11/0–7) when evaluación is skipped; global 0–30 ranges would misclassify a skipped total of 12–14 as "Malnutrición" |
| G2-3 | Classification source rule (§1.3) + may-skip semantics (§1.4) | Faithful to "para una evaluación más detallada, continúe con G-R" — skip is optional, answered-anyway sections score globally |
| G2-4 | `puntajeTotal` is `Float?` not `Int?` | MNA totals land on 0.5 steps (e.g., 23.5) |
| G2-5 | `respuestas` optional in POST + new `PATCH .../:fichaId/completar` (§4.3/§4.3b) | Preserves the committed PENDIENTE assign flow, vencimientos, and estado machine |
| G2-6 | FICHA_NUTRICIONAL: dropped `d1_fecha` + `anexo_soportes` section (17→13 items) | Fecha = `fechaCompletado` metadata; anexo items were placeholder references to other instruments, not data |
| G2-7 | "OBSERVACIÓN IMPORTANTE A TENER EN CUENTA" (Ficha Nutricional datos generales, missed in extraction) → `RegistroFichaCompletada.notasObservaciones` | Present in raw PDF; standing observation fits existing notes field — added to exclusion table §7 |
| G2-8 | §6.3 roles corrected to `RolUsuario` enum CSV | Original suggestions were invented names not present in the codebase |

---

## §2. Item-type registry (final)

> **G2 re-architecture (2026-07-17)**: `boolean-scored` was REMOVED — it was structurally identical
> to `single-select-scored` with 2 options (same fields, same validation, same answer shape). The
> minimal type set is **5 types**. Two-option presentation (radio pair vs list) is a RENDERING
> decision based on `options.length`, not a schema type.

| Type | JSON fields | Validation rules | PrimeVue component suggestion |
|---|---|---|---|
| `single-select-scored` | `id`, `label`, `type`, `required`, `instructions?`, `options` (2–N) | `options.length >= 2`; each option has a numeric `score` | `RadioButton` group (always for 2 options) or `SelectButton` |
| `number-info` | `id`, `label`, `type`, `required`, `instructions?`, `constraints?: { min, max }` | value is a number; bounds enforced when present | `InputNumber` |
| `text-info` | `id`, `label`, `type`, `required`, `instructions?`, `placeholder?` | value is a string | `Textarea` (long) or `InputText` (short, by length) |
| `single-select-info` | same as `single-select-scored` but `options[*].score === null` | `options.length >= 2`; all `score: null` | `Dropdown` or `RadioButton` group |
| `group-info` | `id`, `label`, `type`, `required`, `columns[*]`, `rows[*]` | `columns.length >= 2`, `rows.length >= 1`; column.score always null | `DataTable` with one `Select` column per option |

Frontend may deviate via the contract deviations table — suggestions, not requirements.

---

## §3. DB shape (Prisma, breaking change)

### §3.1 New model — `InstrumentoVersion`

```prisma
model InstrumentoVersion {
  id            Int       @id @default(autoincrement()) @map("instrumento_version_id")
  instrumentoId Int       @map("instrumento_id")
  version       Int       @map("version_numero")
  definition    Json      @map("definicion_jsonb")
  activo        Boolean   @default(false) @map("activo")
  createdAt     DateTime  @default(now()) @map("fecha_creacion")
  createdBy     Int       @map("creado_por")

  instrumento   Instrumento @relation(fields: [instrumentoId], references: [id], onDelete: Cascade)
  creador       Usuario     @relation("InstrumentoVersionCreador", fields: [createdBy], references: [id])
  fichas        RegistroFichaCompletada[]

  @@unique([instrumentoId, version])
  @@index([activo])
  @@index([instrumentoId])
  @@map("instrumentos_versiones")
}
```

- `version` is **immutable once any `RegistroFichaCompletada` references this row** — enforced at the application layer by the seed/upgrade script (it refuses to mutate `definition` when rows reference it).
- Only **one row per `instrumentoId`** can have `activo = true` at any time. Enforced by partial unique index:
  `CREATE UNIQUE INDEX instrumentos_versiones_activo_unique ON instrumentos_versiones (instrumento_id) WHERE activo = true;`

### §3.2 `Instrumento` model — modified

- **Drop**: `plantillaArchivo` (column `plantilla_archivo`), `versionPlantilla` (column `version_plantilla`)
- **Keep**: `id`, `nombreInstrumento`, `codigo`, `descripcion`, `tipo`, `periodicidad`, `rolesPermitidos`, `estado`, `fechaCreacion`, `creadoPor`, `fechaModificacion`, `modificadoPor`
- **Add**: relation `versiones InstrumentoVersion[]`

### §3.3 `RegistroFichaCompletada` model — modified

- **Drop**: `archivoCompletado` (column `archivo_completado`)
- **Keep**: `id`, `clienteId`, `instrumentoId`, `estado`, `fechaCompletado`, `versionRegistro`, `responsable`, `notasObservaciones`, `fechaVencimiento`, `alertaVencimiento`, `fechaCreacionRegistro`
- **Add**:
  - `instrumentoVersionId Int? @map("instrumento_version_id")`
  - `respuestas Json? @map("respuestas_jsonb")`
  - `puntajeTotal Float? @map("puntaje_total")`  *(Float, NOT Int — MNA scores in 0.5 steps, totals like 23.5; nullable: informational instruments produce null)*
  - `subtotales Json? @map("subtotales_jsonb")`  *(`{ sectionId: number }`)*
  - `clasificacion String? @map("clasificacion")` *@db.VarChar(100)*  *(nullable: informational instruments)*
- **Add relation**: `instrumentoVersion InstrumentoVersion? @relation(fields: [instrumentoVersionId], references: [id], onDelete: Restrict)`

### §3.4 Migration policy (D2 hard reset)

- `migrate dev` creates a migration that drops `archivo_completado`, `plantilla_archivo`, `version_plantilla` columns AND truncates `registros_fichas_completadas` table.
- Pre-flight check (W2 gate): SELECT counts from both tables → user confirmation required before applying.
- Plan-approval gate (G1 in team-plan) before running the destructive migration.

### §3.5 Enums — no changes

`TipoInstrumento { VALORACION, NUTRICION, MATRICULA, ADMISION }` is **unchanged**. The MNA + Cuadro merge uses `NUTRICION`; Ficha Nutricional uses `NUTRICION`; the other four use `VALORACION`. See §6.

---

## §4. API shapes

### §4.1 `GET /instruments`

List active instruments + their active version metadata.

**Response 200**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "codigo": "BARTHEL",
      "nombre": "Índice de Barthel",
      "tipo": "VALORACION",
      "periodicidad": "SEMESTRAL",
      "estado": "ACTIVO",
      "rolesPermitidos": "ADMIN,NUTRICIONISTA,ENFERMERA",
      "activeVersion": {
        "id": 7,
        "version": 1,
        "activo": true,
        "createdAt": "2026-07-16T22:00:00.000Z"
      }
    }
  ]
}
```

### §4.2 `GET /instruments/:codigo/definition` (or `/:id`)

Get the full active definition (or by `:versionId` if explicitly requested).

**Response 200**:
```json
{
  "success": true,
  "data": {
    "instrumento": { "id": 1, "codigo": "BARTHEL", "nombre": "...", "tipo": "VALORACION" },
    "version": { "id": 7, "version": 1, "definition": { /* the JSON document from §1 */ } }
  }
}
```

**Response 404**: instrument not found OR no active version.
**Response 403**: user's role not in `rolesPermitidos`.

### §4.3 `POST /patients/:clienteId/fichas` (evolved — was file-based, now answers-based)

**`versionRegistro` is server-defaulted (G2-12, 2026-07-17, from QA BUG-W5-01)**: `versionRegistro`
is OPTIONAL in POST /fichas and PATCH /completar request bodies; when absent the server derives it
from the resolved active version (`v{version}`, e.g. `"v1"`). Clients SHOULD omit it. Rationale:
it duplicates information the server already resolves (G2-11); requiring it from clients caused a
HIGH UI-flow bug.

**`instrumentoVersionId` is server-resolved (G2-11, 2026-07-17)**: clients MUST NOT be trusted to
pick the version. The server ALWAYS resolves the instrument's ACTIVE version at completion time and
records it on the row; a client-supplied `instrumentoVersionId` is IGNORED (accepted for
backward-compat, never validated against). The response always reports the version actually used.
Rationale: W3 ships a best-effort alias (`instrument.id`) in this field; server-side resolution
makes the field advisory and removes an entire class of id-family mismatches.

`respuestas` is **OPTIONAL** in this endpoint:
- **Present** → single-step assign+complete (jul-10 pattern kept): validate, score, persist as `COMPLETADO`.
- **Absent** → legacy ASSIGN flow kept: creates the ficha as `PENDIENTE` (with `fechaVencimiento`
  per existing periodicidad behavior). The estado machine (PENDIENTE→COMPLETADO/VENCIDO, lazy
  VENCIDO flip, vencimientos report) is UNCHANGED.

**Request body**:
```json
{
  "instrumentoId": 1,
  "instrumentoVersionId": 7,
  "respuestas": {
    "comida": "independiente",
    "lavado": "independiente",
    "vestido": "ayuda",
    "arreglo": "independiente",
    "deposicion": "continente",
    "miccion": "continente",
    "retrete": "independiente",
    "transferencia": "minima_ayuda",
    "deambulacion": "andador",
    "desniveles": "necesita_ayuda"
  },
  "notasObservaciones": "optional string"
}
```

**Response 201** (success):
```json
{
  "success": true,
  "data": {
    "id": 42,
    "clienteId": 123,
    "instrumentoId": 1,
    "instrumentoVersionId": 7,
    "estado": "COMPLETADO",
    "fechaCompletado": "2026-07-16T22:30:00.000Z",
    "respuestas": { /* echoed */ },
    "subtotales": { "abvd": 65 },
    "puntajeTotal": 65,
    "clasificacion": "Dependencia moderada",
    "skippedSections": []
  }
}
```

**Response 400** (validation error):
```json
{
  "success": false,
  "message": "Validation failed",
  "field": "respuestas.comida",
  "code": "INVALID_OPTION"
}
```

### §4.3b `PATCH /patients/:clienteId/fichas/:fichaId/completar` (NEW — complete a pending ficha)

Completes an existing `PENDIENTE` (or `VENCIDO`, per existing VENCIDO→COMPLETADO transition) ficha
with answers. Body: `{ "respuestas": { ... }, "notasObservaciones?": "..." }`. Same validation +
scoring as §4.3; response shape identical to §4.3's 201 (status 200). Errors: 404 ficha not found,
400 `INVALID_STATE` if already `COMPLETADO`, plus the §4.5 validation codes. The
`instrumentoVersionId` used is the version that was active at ASSIGN time if recorded, else the
currently active version (recorded on the row at completion).

### §4.4 `GET /patients/:clienteId/fichas/:fichaId`

**Response 200**:
```json
{
  "success": true,
  "data": {
    "id": 42,
    "cliente": { /* existing Cliente summary */ },
    "instrumento": { /* existing Instrumento summary */ },
    "instrumentoVersion": { "id": 7, "version": 1 },
    "estado": "COMPLETADO",
    "fechaCompletado": "2026-07-16T22:30:00.000Z",
    "responsable": { /* Usuario summary */ },
    "respuestas": { /* same shape as request */ },
    "subtotales": { "abvd": 65 },
    "puntajeTotal": 65,
    "clasificacion": "Dependencia moderada",
    "skippedSections": [],
    "notasObservaciones": "..."
  }
}
```

### §4.5 Error shape (existing convention)

```json
{
  "success": false,
  "message": "Human-readable message in Spanish",
  "field": "respuestas.comida",   // optional — for validation errors
  "code": "INVALID_OPTION"       // optional — machine-readable code
}
```

Codes used by this feature:

| Code | Meaning |
|---|---|
| `INSTRUMENT_NOT_FOUND` | `:codigo` does not exist |
| `NO_ACTIVE_VERSION` | Instrument exists but no version with `activo=true` |
| `ROLE_NOT_ALLOWED` | Caller's role not in `rolesPermitidos` |
| `INVALID_ANSWER_PAYLOAD` | `respuestas` missing required keys or has unknown keys |
| `INVALID_OPTION` | Selected option value not in item's `options` |
| `OUT_OF_RANGE` | `number-info` value outside `constraints.min/max` |
| `DEFINITION_INVALID` | Definition JSON fails schema validation (admin/seed path) |
| `VERSION_LOCKED` | Tried to mutate a `InstrumentoVersion` referenced by ≥1 completion |

### §4.6 Endpoint map (file vs dynamic)

| Action | Old endpoint (REMOVED in W4) | New endpoint |
|---|---|---|
| List instruments | `GET /instruments` (kept) | unchanged shape, adds `activeVersion` |
| Get definition | none | `GET /instruments/:codigo/definition` |
| Download plantilla | `GET /instruments/:id/plantilla` | **REMOVED** |
| Assign ficha (PENDIENTE) | `POST /patients/:id/fichas` (no archivo) | `POST /patients/:id/fichas` (no `respuestas`) — kept |
| Complete ficha | same endpoint (with archivo) | `POST /patients/:id/fichas` (with `respuestas`) or `PATCH .../:fichaId/completar` for pending fichas |
| Get completed ficha | `GET /patients/:id/fichas/:fichaId` | unchanged path, response adds `respuestas`, `puntajeTotal`, `clasificacion`, `subtotales` |

---

## §5. Answers payload format

### §5.1 Shape

`respuestas` is a **flat object**: `{ [itemId: string]: answerValue }`.

### §5.2 Value types per item type

| Item type | Answer value type | Example |
|---|---|---|
| `single-select-scored` | one of the `options[].value` strings | `"independiente"`, `"correcto"` |
| `number-info` | number | `68.5` |
| `text-info` | string | `"Hipertensión arterial controlada"` |
| `single-select-info` | one of the `options[].value` strings | `"si"` |
| `group-info` | array of `{ rowId: string, columnId: string }` | `[{ "rowId": "cereales", "columnId": "diario" }, ...]` |

### §5.3 What the backend recomputes

The backend **never** trusts client-side scores. On `POST /patients/:id/fichas`:

1. Load `InstrumentoVersion` by `instrumentoVersionId`.
2. Validate every key in `respuestas` against the definition:
   - Required items must be present (unless section is skipped via `skipIf`).
   - Option values must match `options[*].value`.
   - Number values must satisfy `constraints`.
   - Group-info answer must have one entry per `rows[*].id`.
3. Compute scores via `computeScore(definition, respuestas)`:
   - For each section with `condition.skipIf`: evaluate the condition against the referenced
     section's subtotal. Section is SKIPPED iff condition met AND none of its items answered
     (may-skip semantics, §1.4). Condition met + some-but-not-all required items answered →
     `INVALID_ANSWER_PAYLOAD`.
   - Sum item scores per section → `subtotales[sectionId]`.
   - For `single-select-scored`: `score = definition.items[i].options[selectedIndex].score`.
   - For `number-info` / `text-info` / `single-select-info` / `group-info`: contributes 0.
   - For skipped sections: no subtotal entry, items not required.
4. `total = sum(subtotales[*] of answered sections)` (or `null` if `scoring.total === "none"`).
5. Classification (§1.3 source rule):
   - No section skipped → `clasificacion = scoring.resultEvaluation.find(r => total >= r.min && total <= r.max)?.label`.
   - ≥1 section skipped → `clasificacion = triggerSection.subtotal.resultEvaluation.find(...)` applied
     to the trigger section's subtotal (MNA: cribaje 12–14 → "Estado nutricional normal").
   - No match → `null` + server log (never throw).
6. Persist the entire `respuestas` object (untouched), the computed `subtotales`, `puntajeTotal`, `clasificacion`, `skippedSections` (in the response, not persisted; derivable from respuestas + definition).

### §5.4 What the frontend NEVER does

- Never computes total, subtotals, or classification locally for display-verification (UI may show optimistic values, but the server response is authoritative).
- Never includes patient-header fields (see §7) in `respuestas`. Enforcement is structural: the
  backend rejects ANY key not present as an item id in the definition (`INVALID_ANSWER_PAYLOAD`) —
  excluded fields are simply not item ids, so no label-matching logic exists.

---

## §6. Seed codes + TipoInstrumento proposal

### §6.1 Seed codes (one per instrument)

| Codigo | Nombre | Tipo | Periodicidad | Max scoring |
|---|---|---|---|---|
| `BARTHEL` | Índice de Barthel | `VALORACION` | `SEMESTRAL` | 100 |
| `MINI_MENTAL` | Mini Examen del Estado Mental | `VALORACION` | `ANUAL` | 30 |
| `TINETTI` | Escala de Tinetti (Marcha y Equilibrio) | `VALORACION` | `SEMESTRAL` | 28 |
| `YESAVAGE` | Escala de Depresión Geriátrica de Yesavage | `VALORACION` | `ANUAL` | 15 |
| `MNA_CUADRO` | Mini Nutritional Assessment + Cuadro de Alimentos | `NUTRICION` | `SEMESTRAL` | 30 (MNA only) |
| `FICHA_NUTRICIONAL` | Ficha Nutricional 1.8.4 | `NUTRICION` | `SEMESTRAL` | n/a |

### §6.2 TipoInstrumento proposal — NO enum change

The merged MNA + Cuadro and Ficha Nutricional both use **`NUTRICION`** (existing enum value). No new enum values required.

Rationale:
- D-locked decision: "merged MNA + Cuadro into ONE instrument" does not require a new `tipo`.
- `NUTRICION` already covers the concept of "instrumentos used by the nutricionista role".
- Adding enum values has migration cost; we avoid it.

If the project later wants finer classification (e.g., NUTRICION_CRIBADO vs NUTRICION_ANTROPOMETRIA), a new enum value can be added in a future migration — schema supports `tipo` as a simple enum, and the upgrade script (D1) can rewrite definitions.

### §6.3 Roles permitidos (default per instrumento)

> **G2 correction (2026-07-17)**: the original suggestions used invented role names. The codebase
> convention (existing `backend/prisma/seed.ts` instrument rows) is CSV of `RolUsuario` enum values
> `{ADMIN, EMPLEADO, AUDITOR, OPERADOR}`. Write access is additionally gated by
> `requireInstrumentWriter` (tipoEmpleado), unchanged.

| Codigo | rolesPermitidos (seed value) |
|---|---|
| `BARTHEL`, `MINI_MENTAL`, `TINETTI`, `YESAVAGE`, `MNA_CUADRO`, `FICHA_NUTRICIONAL` | `ADMIN,EMPLEADO` |

CSV string in `rolesPermitidos VARCHAR(255)`; the seed assigns them; admins can edit later per instrument.

---

## §7. Patient-field exclusion table (final, from T2)

Source mapping for the consolidated exclusion list. **No exclusion table field becomes a schema item.**

| # | Excluded label | Source mapping |
|---|---|---|
| 1 | Nombre (del abuelo / paciente) | `Cliente.nombre` + `Cliente.apellido` |
| 2 | C.C. / Número de documento | `Cliente.numeroDocumento` |
| 3 | Tipo de documento (C.C. / OTRO) | `Cliente.tipoDocumento` |
| 4 | Edad (Años / Meses) | `Cliente.fechaNacimiento` (calculated) |
| 5 | Sexo | `Cliente.sexo` |
| 6 | Fecha de nacimiento | `Cliente.fechaNacimiento` |
| 7 | Fecha de ingreso | `Cliente.fechaIngreso` (or ficha metadata) |
| 8 | R.H.G.S. (grupo sanguíneo) | `Cliente.rhgs` (or ficha metadata) |
| 9 | Fecha de aplicación / evaluación | `RegistroFichaCompletada.fechaCompletado` |
| 10 | Aplicado por / Evaluador | `RegistroFichaCompletada.responsable` → `Usuario` |
| 11 | Unidad de Atención / Jornada | ficha metadata |
| 12 | NUTRICIONISTA (firma del profesional) | `RegistroFichaCompletada.responsable` → `Usuario` (rol nutricionista) |
| 13 | FIRMA Y SELLO DEL PROFESIONAL — TP | `RegistroFichaCompletada.responsable` → `Usuario` |
| 14 | FIRMA DEL EVALUADOR | `RegistroFichaCompletada.responsable` → `Usuario` |
| 15 | ASISTIDO/A — VÁLIDO/A | **Descartado** — etiqueta post-clasificación, no se renderiza como ítem |
| 16 | Puntuación Total / subtotales | **Calculado** — renderizado en `InstrumentResultView` |
| 17 | Apellidos | `Cliente.apellido` |
| 18 | Observación importante a tener en cuenta (Ficha Nutricional) | `RegistroFichaCompletada.notasObservaciones` (G2-7) |
| 19 | Fecha (datos importantes actuales, Ficha Nutricional) | `RegistroFichaCompletada.fechaCompletado` (G2-6) |
| 20 | Anexo de soportes (MNA / Ficha Nutricional / Ficha Cualitativa) | **Descartado** — referencias a otros instrumentos, no datos (G2-6) |

Full table with per-instrument traceability: `tasks/W1-extraction-contract/patient-field-exclusion.md`.

**Items NOT excluded** (kept as schema items):
- **Peso (kg)** — MNA F1, Ficha D2: `number-info` (no `Cliente.pesoActual` attribute)
- **Talla (cm)** — MNA F2, Ficha D3: `number-info` (no `Cliente.talla` attribute)

---

## §8. Placeholders for downstream deviation tracking

### Deviations — W2 (schema)

> W2 fills this section if the Prisma migration or template shape requires an adjustment that
> cannot be deferred. Each entry: `**D-W2-N** — {what changed} — {why} — {date}`.

*(empty)*

### Deviations — W4 (backend)

> W4 fills this section if the scoring engine or endpoint shape must deviate. Each entry:
> `**D-W4-N** — {what changed} — {why} — {date}`.

*(empty — W4 implementation matched the contract §4 response shapes byte-for-byte; no deviations filed.)*

### Deviations — W3 (frontend)

> W3 fills this section if the renderer cannot map an item type to a PrimeVue component as
> suggested, or if the patient-header rendering needs an adjustment. Each entry:
> `**D-W3-N** — {what changed} — {why} — {date}`.

*(empty)*

---

## Appendix A — Reference: depurated specs and template fixtures

- Depurated specs: `context/instrumentos-depurated/{barthel,mini-mental,tinetti,yesavage,mna-cuadro-alimentos,ficha-nutricional}.md`
- Template fixtures: `tasks/W1-extraction-contract/templates/{codigo}.v1.json` (this directory; W2 moves to `backend/prisma/instrument-templates/`).
- Source extraction raw text: `tasks/W1-extraction-contract/sources/{raw}.txt`.
- Checker script: `scripts/instrument-extraction/check_template.py`.
- Progress report: `tasks/W1-extraction-contract/progress-report.md`.
- Coverage matrix: `tasks/W1-extraction-contract/coverage-matrix.md`.
- Exclusion table: `tasks/W1-extraction-contract/patient-field-exclusion.md`.
