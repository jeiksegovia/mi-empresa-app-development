# Schema Contract — fixes-jul-22

> **Status**: implementation lock (W1, 2026-07-22)  
> **Owner**: W1 backend-eng  
> **Consumers**: W2 frontend-eng and W3 test-quality

This file is the single source of truth for the Jul-22 patient-estado and dynamic-instrument changes. Existing definition rules from `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md` remain in force unless this contract explicitly overrides them.

---

## 1. Patient `estado` API contract

### 1.1 Authenticated actor

Patient writes receive a server-derived actor context:

```ts
interface PatientActor {
  userId: number
  rol: string
  tipoEmpleado: string | null
}
```

`userId` and `rol` come from `authMiddleware`; `requireDomain('pacientes')` enriches EMPLEADO requests with the database `tipoEmpleado`. No body field can select or override the actor.

### 1.2 `POST /api/v1/patients`

The existing Zod body remains unchanged, including optional:

```json
{ "estado": "ACTIVO | INACTIVO" }
```

Effective-state rules:

| Caller | Body `estado` | Persisted `Cliente.estado` |
|---|---|---|
| `EMPLEADO + CONTRATOS` | omitted, `ACTIVO`, or `INACTIVO` | always `ACTIVO` (body value ignored) |
| any other caller allowed by existing domain RBAC | omitted | `ACTIVO` (existing default) |
| any other caller allowed by existing domain RBAC | `ACTIVO` or `INACTIVO` | requested validated value |

Success stays HTTP `201` with `{ success: true, data: PatientDetail }`.

The frontend **must hide** the estado control only on the CONTRATOS create page. This rule does not hide estado on all patient screens.

### 1.3 `PUT /api/v1/patients/:id`

Authorization is based on presence of a validated `estado` field, even when the requested value equals the current value.

| Caller | Payload contains `estado` | Result |
|---|---:|---|
| `ADMIN` | yes | allowed |
| `EMPLEADO + GERONTOLOGA` | yes | allowed |
| any other role/sub-role | yes | HTTP `403`, no patient write |
| any caller allowed by existing patient-domain RBAC | no | existing update behavior |

CONTRATOS remains create-only in `DOMAIN_ACCESS`; its PUT request is normally rejected earlier with `DOMAIN_FORBIDDEN`. The service-level estado rule still fails closed for any non-ADMIN/non-GERONTOLOGA actor that reaches it.

### 1.4 Estado error

```json
{
  "success": false,
  "message": "Solo ADMIN o GERONTOLOGA pueden cambiar el estado del paciente",
  "code": "PATIENT_STATE_FORBIDDEN"
}
```

HTTP status: `403`.

Existing errors remain unchanged: Zod validation `400`, patient missing `404`, duplicate document `409`, and unhandled persistence errors `500`.

---

## 2. Definition version and activation rules

- Existing referenced definitions are immutable.
- Publish `TINETTI.v2.json` and `MNA_CUADRO.v2.json`; never rewrite their v1 files.
- `instruments:upgrade` processes versions in ascending order and activates the highest inserted version.
- Seed/template loading selects the highest `*.v{n}.json` for each codigo.
- `VALORACION_INTEGRAL` starts at v1.
- Existing completed fichas retain their pinned `instrumentoVersionId`; new assignments/completions resolve the active version under the existing server-resolution contract.

---

## 3. `TINETTI` v2

### 3.1 Top-level metadata

| Field | Value |
|---|---|
| `codigo` | `TINETTI` |
| `version` | `2` |
| `tipo` | `VALORACION` |
| `scoring.total` | `sum` |
| equilibrium max | `15` |
| marcha max | `12` |
| global max | `27` |

Classification ranges are gapless over the new reachable maximum:

| Min | Max | Label |
|---:|---:|---|
| 25 | 27 | Riesgo bajo |
| 19 | 24 | Riesgo moderado |
| 0 | 18 | Alto riesgo de caídas |

### 3.2 Item 8 (single item, four exclusive options)

```json
{
  "id": "eq_vuelta_360",
  "label": "8. Vuelta a 360°",
  "type": "single-select-scored",
  "required": true,
  "options": [
    { "value": "pasos_discontinuos", "label": "Pasos discontinuos", "score": 0 },
    { "value": "pasos_continuos", "label": "Continuos", "score": 1 },
    { "value": "inestable", "label": "Inestable", "score": 0 },
    { "value": "estable", "label": "Estable", "score": 1 }
  ]
}
```

Removed ids: `eq_vuelta_360_pasos`, `eq_vuelta_360_estabilidad`. Because the four choices are exclusive, item 8 now has max 1 and equilibrium changes from max 16 to 15.

### 3.3 Item 11 (one item per foot, four exclusive combinations)

Each foot combines the prior independent “sobrepasa” and “se separa” booleans. Scores equal the sum of the two previous binary scores, preserving max 2 per foot and marcha max 12.

**Right foot**

| Value | Label | Score |
|---|---|---:|
| `no_sobrepasa_no_separa` | No sobrepasa al pie izquierdo y no se separa completamente del suelo | 0 |
| `sobrepasa_no_separa` | Sobrepasa al pie izquierdo y no se separa completamente del suelo | 1 |
| `no_sobrepasa_separa` | No sobrepasa al pie izquierdo y se separa completamente del suelo | 1 |
| `sobrepasa_separa` | Sobrepasa al pie izquierdo y se separa completamente del suelo | 2 |

Item id: `ma_pie_derecho`; label: `11. Longitud y altura del paso — pie derecho`.

**Left foot** uses the same four values/scores, with labels referring to the right foot. Item id: `ma_pie_izquierdo`; label: `11. Longitud y altura del paso — pie izquierdo`.

Removed ids: `ma_pd_sobrepasa`, `ma_pd_separa`, `ma_pi_sobrepasa`, `ma_pi_separa`. No 11a/11b/11c/11d labels remain.

### 3.4 Complete v2 item-id inventory

- `equilibrio`: `eq_sentado`, `eq_levantarse`, `eq_intentos`, `eq_bip_inmediata`, `eq_bipedestacion`, `eq_empujar`, `eq_ojos_cerrados`, `eq_vuelta_360`, `eq_sentarse`.
- `marcha`: `ma_iniciacion`, `ma_pie_derecho`, `ma_pie_izquierdo`, `ma_simetria`, `ma_fluidez`, `ma_trayectoria`, `ma_tronco`, `ma_postura`.

Total v2 items: 17 (9 equilibrium + 8 marcha).

---

## 4. `MNA_CUADRO` v2 text matrix

All v1 MNA scored items, section ids, scoring ranges, and skip behavior remain unchanged. Only `cuadro_alimentos.frecuencia_grupos` changes:

```jsonc
{
  "id": "frecuencia_grupos",
  "type": "group-info",
  "required": true,
  "cellInput": "text",
  "columns": [
    { "id": "diario", "label": "Diario", "score": null },
    { "id": "semanal", "label": "Semanal", "score": null },
    { "id": "mensual", "label": "Mensual", "score": null },
    { "id": "nunca", "label": "Nunca", "score": null }
  ],
  "rows": [
    { "id": "cereales", "label": "Cereales y RTP's" },
    { "id": "frutas", "label": "Frutas" },
    { "id": "verduras", "label": "Verduras" },
    { "id": "carnes", "label": "Carnes y sustitutos" },
    { "id": "lacteos", "label": "Lácteos y sustitutos" },
    { "id": "grasas", "label": "Grasas" },
    { "id": "dulces", "label": "Dulces" }
  ]
}
```

### 4.1 Text-cell answer shape

`cellInput: "text"` uses one object for every row × column coordinate:

```json
[
  { "rowId": "cereales", "columnId": "diario", "value": "2 porciones" },
  { "rowId": "cereales", "columnId": "semanal", "value": "" },
  { "rowId": "cereales", "columnId": "mensual", "value": "" },
  { "rowId": "cereales", "columnId": "nunca", "value": "" }
]
```

For the current 7×4 matrix, a required answer contains exactly 28 unique coordinates. `value` must be a string; empty strings are allowed because a non-applicable frequency cell is still represented. Unknown row/column ids, duplicate coordinates, missing coordinates, or non-string values produce `INVALID_ANSWER_PAYLOAD` at `respuestas.frecuencia_grupos`.

Legacy `group-info` definitions without `cellInput: "text"` retain the v1 answer shape: one `{ rowId, columnId }` selection per row.

Text-cell values are stored unchanged in `RegistroFichaCompletada.respuestas`; they never contribute to scoring.

---

## 5. `VALORACION_INTEGRAL` v1

### 5.1 Metadata

| Field | Value |
|---|---|
| `codigo` | `VALORACION_INTEGRAL` |
| `nombre` | `Valoración Integral` |
| `version` | `1` |
| `tipo` | `VALORACION` |
| seed periodicidad | `UNICA` |
| seed roles | `ADMIN,EMPLEADO` |
| `scoring` | `{ "total": "none", "resultEvaluation": [] }` |
| source | `FORMATOS DE INGRESO.xlsx`, first sheet `VALORACIÓN INTEGRAL` only |

`templateCodigo: "VALORACION_INTEGRAL"` is accepted by `POST /api/v1/instruments`. Create-from-template deep-copies the active definition and rewrites `codigo`, `nombre`, and `version` under the existing template-copy contract.

### 5.2 Sections and item ids

All items are informational and contribute zero points.

| Section id | Item ids (`type`; required when `*`) |
|---|---|
| `datos_generales` | `tipo_documento` (`single-select-info`*; `cc`/`otro`), `documento_otro` (`text-info`), `nombre_apellido` (`text-info`*), `fecha_nacimiento` (`text-info`*), `edad` (`number-info`*; 0–130), `sexo` (`single-select-info`*; `masculino`/`femenino`), `fecha_ingreso` (`text-info`*), `rhgs` (`text-info`), `observacion_ingreso` (`text-info`) |
| `informe_diagnostico` | `informe` (`text-info`*), `diagnostico_actual` (`text-info`*) |
| `antecedentes` | `antecedentes_patologicos`, `antecedentes_quirurgicos`, `antecedentes_hospitalarios`, `antecedentes_alergicos`, `antecedentes_medicamentosos` (all `text-info`*) |
| `antecedentes_familiares` | `familiar_hta`, `familiar_cancer`, `familiar_diabetes` (all `single-select-info`*; `si`/`no`), `familiar_otro` (`text-info`) |
| `estado_cognitivo` | `cognitivo_tiempo_espacio`, `cognitivo_persona`, `cognitivo_funciones_superiores` (all `text-info`*), `cognitivo_otros` (`text-info`) |
| `estado_emocional_espiritual` | `emocional_depresion`, `emocional_ansiedad`, `emocional_crisis_nerviosas`, `espiritual_religion` (all `text-info`*), `emocional_otro` (`text-info`) |
| `estado_social` | `social_integracion`, `social_personalidad`, `social_frecuencia_salidas`, `social_grupos_apoyo` (all `text-info`*), `social_otro` (`text-info`) |
| `cuerpo` | `cuerpo_cabeza`, `cuerpo_cuello`, `cuerpo_brazos_manos`, `cuerpo_torax_abdomen`, `cuerpo_piernas_pies` (all `text-info`*) |
| `diagnostico_plan_evoluciones` | `diagnostico_integral`, `plan_integral` (both `text-info`*), `evoluciones` (`text-info`) |
| `acudiente_principal` | `acudiente_nombre` (`text-info`*), `acudiente_documento` (`text-info`*), `acudiente_parentesco` (`text-info`*), `acudiente_telefono` (`text-info`*) |
| `firma_profesional` | `firma_sello_profesional` (`text-info`) |

Dates use `text-info` with `AAAA-MM-DD` placeholders because the locked dynamic item-type registry has no date type. Long narrative fields use `text-info`; textarea vs input presentation remains a frontend rendering decision.

### 5.3 Workbook boundary

No fields from workbook sheets 2–14 are included. The first-sheet footer/address is static branding, not an answer item.

---

## 6. API and validation error registry

| Code | HTTP | Meaning |
|---|---:|---|
| `PATIENT_STATE_FORBIDDEN` | 403 | Non-ADMIN/non-GERONTOLOGA attempted an estado update |
| `DOMAIN_FORBIDDEN` | 403 | Existing domain matrix rejected the whole request (for example CONTRATOS PUT) |
| `INVALID_ANSWER_PAYLOAD` | 400 | Missing/unknown/duplicate malformed answer, including text-cell coordinate/value errors |
| `INVALID_OPTION` | 400 | Selected option value not declared by an item |
| `OUT_OF_RANGE` | 400 | Numeric answer violates bounds |
| `TEMPLATE_NOT_FOUND` | 404 | Accepted `templateCodigo` has no source Instrumento row |
| `NO_ACTIVE_VERSION` | 404 | Template/instrument has no active definition |
| `VERSION_LOCKED` | script exit 1 | Upgrade attempted to mutate a referenced same-version definition |

General error envelope:

```json
{
  "success": false,
  "message": "Human-readable message",
  "code": "MACHINE_CODE",
  "field": "respuestas.item_id"
}
```

`code` and `field` are optional except where explicitly listed above.

---

## 7. Deviations and reconciliations

| ID | Assignment/previous contract said | Implementation contract | Reason/evidence |
|---|---|---|---|
| D-J22-01 | TINETTI canonical v1 max 28 / equilibrium 16 | v2 max 27 / equilibrium 15 | Locked product choice makes the four item-8 labels one exclusive selection scored 0/1/0/1; two independent points can no longer be earned together. |
| D-J22-02 | Legacy `group-info` is one selected column per row | `cellInput: "text"` is all row×column text coordinates; legacy shape remains for definitions without the flag | QA explicitly requests a matrix of free-text cells rather than dropdowns. |
| D-J22-03 | Prior instrument contract generally excluded patient-header data | VALORACION_INTEGRAL includes the first sheet’s requested general-data fields | Jul-22 locked requirements explicitly enumerate those fields as part of the new instrument. |
| D-J22-04 | Upgrade script documentation claimed missing Instrumento rows were upserted, implementation previously threw | Jul-22 upgrade path ensures template Instrumento rows before version application | Required so an existing environment can add `VALORACION_INTEGRAL` without running the destructive development seed. |

No Prisma schema migration is required for these changes.
