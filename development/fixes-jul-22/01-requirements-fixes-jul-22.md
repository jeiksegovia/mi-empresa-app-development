# Requirements: fixes-jul-22

**Status**: Product answers locked 2026-07-22.  
**Source**: `00-intake-fixes-jul-22.md`, `qa-session-jul-22-cleaned.md`, FORMATOS DE INGRESO.xlsx sheet `VALORACIÓN INTEGRAL`.

## Locked decisions

| Topic | Choice |
|---|---|
| Patient estado | **Create (CONTRATOS)**: hide Activo/Inactivo; server force **ACTIVO**. **Edit**: only **GERONTOLOGA + ADMIN** can set estado (after valoración). CONTRATOS never changes estado. |
| Tinetti 8 | One item, 4 options, single-select |
| Tinetti 11 | Pie derecho + pie izquierdo, **each** one item with 4 options |
| MNA frequency | Text per cell (row × Diario/Semanal/Mensual/Nunca) |
| Unsaved guard | Include (instruments + patients minimum; expand per plan) |
| Valoración inicial | **In scope** — first tab only of `FORMATOS DE INGRESO.xlsx` |
| Instrument edits | Prefer **version bump** (v2) where definitions already referenced |

---

## Functional Requirements

| ID | Requirement | Acceptance Criterion | Research? |
|---|---|---|---|
| R1 | CONTRATOS: no estado control on **crear only** | `pacientes/crear.vue`: hide Activo/Inactivo when `tipoEmpleado===CONTRATOS`. Scope is create form — not “all patient forms”. | no |
| R2 | Edit estado owned by gerontóloga (+ ADMIN) | `pacientes/[id]/editar.vue`: show estado **only** for GERONTOLOGA or ADMIN. CONTRATOS remains create-only (no edit route access). | no |
| R3 | POST by CONTRATOS forces estado ACTIVO | Server ignores body.estado for CONTRATOS create → stores ACTIVO. | no |
| R4 | Only GERONTOLOGA/ADMIN may change estado via API | PUT patient with `estado` when caller is CONTRATOS (or non-gerontóloga EMPLEADO) → 403. GERONTOLOGA/ADMIN may set ACTIVO/INACTIVO. | no |
| R5 | Post-valuation workflow | Product intent: estado set on **edit** by gerontóloga after valoración — no estado picker on CONTRATOS registration. | no |
| R6 | Unsaved leave guard | Dirty form + route leave → confirm dialog; `beforeunload` when dirty (PWA/tab close) | no |
| R7 | Guard coverage | Wire at least: patient crear/editar, instrument dynamic form complete flow; recommended: empleados crear/editar if low cost | no |
| R8 | MNA frequency cells are free text | `frecuencia_grupos` matrix: each row×column is text input, not dropdown/radio | no |
| R9 | MNA answers persist as text | Completar ficha stores strings per cell; result/audit views show text | no |
| R10 | Tinetti item 8 single | One scored item “8. Vuelta a 360°” with 4 exclusive options: pasos discontinuos, continuos, inestable, estable | no |
| R11 | Tinetti item 11 per foot | Pie derecho: one item 4 options; pie izquierdo: one item 4 options; no 11a/11b | no |
| R12 | Tinetti single-select only | Not multi-select; one option per item | no |
| R13 | Instrument versioning | New definitions published as new version (v2) if v1 is/was referenced; old fichas keep old version | no |
| R14 | Scoring totals coherent | Subtotals/max after merge documented; engine scores new items; tests for max path | no |
| R15 | Valoración integral instrument | New template JSON + seed/create path for instrument from sheet VALORACIÓN INTEGRAL (informational fields) | no |
| R16 | Tests | Playwright/API: CONTRATOS create hides estado + force ACTIVO; GERONTOLOGA edit can set estado; Tinetti v2; MNA text matrix; unsaved guard; valoración definition | no |

---

## Non-Functional

| ID | Requirement |
|---|---|
| N1 | Follow existing instrument item types; extend `group-info` for text cells rather than inventing parallel systems unless required |
| N2 | UI Spanish; code English |
| N3 | No shadow migrate; no auto-commit |
| N4 | RBAC matrix parity FE/BE preserved |

---

## Out of scope

- Other sheets of FORMATOS DE INGRESO (signos vitales, etc.) unless needed as separate instruments later
- Changing CONTRATOS from create-only to full pacientes edit (except estado hide rules)
- Legal scoring revalidation with external clinicians beyond QA text

---

## Valoración integral content outline (from xlsx tab 1)

Sections to model (mostly `text-info` / `single-select-info` / multi-line text):

1. Datos generales del abuelo(a): tipo documento, nombre, fecha nacimiento, edad, sexo, fecha ingreso, RH, observación ingreso  
2. Informe / Diagnóstico actual  
3. Antecedentes: patológicos, quirúrgicos, hospitalarios, alérgicos, medicamentosos  
4. Antecedentes familiares: HTA, cáncer, diabetes, otro  
5. Estado cognitivo: orientación tiempo/espacio, persona, funciones superiores, otros  
6. Estado emocional y espiritual: depresión, ansiedad, crisis, religión, otro  
7. Estado social: integración, personalidad, salidas, grupos, otro  
8. Cuerpo (text): cabeza, cuello, brazos/manos, tórax/abdomen, piernas/pies  
9. Diagnóstico integral, plan integral, evoluciones  
10. Datos acudiente: nombre, CC, parentesco, teléfono  
11. Firma profesional (text/info)

Scoring: **informational** (no puntajeTotal required), similar to FICHA_NUTRICIONAL pattern.

---

## Open residual (non-blocking defaults)

| Topic | Default if silent |
|---|---|
| Tinetti 8 scores for 4 exclusive options | Map: discontinuos=0, continuos=1, inestable=0, estable=1 (max 1 for item; equilibrio max adjust −1) **OR** combination scores 0–2 if product prefers — **recommend document in plan as 0/1/0/1 pending clinical confirm** |
| Tinetti 11 four options labels | Derive from prior 11a/11b pairs as four exclusive clinical states with scores 0–2 total max per foot |
| Unsaved: nomina/empleados | Include if trivial; else patients+instruments only |
