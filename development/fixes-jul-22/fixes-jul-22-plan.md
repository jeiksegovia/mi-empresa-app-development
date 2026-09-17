# Feature Plan: fixes-jul-22

## Objective

Ship QA Jul-22 fixes: CONTRATOS patient-estado rules, unsaved form leave guard, MNA food-frequency as text matrix, Tinetti items 8 & 11 restructure, and new **Valoración integral** instrument from `FORMATOS DE INGRESO.xlsx` (first sheet only).

## Assumptions & Constraints

- Product answers 2026-07-22 locked (see requirements).
- Dynamic instruments: versions immutable once referenced → **TINETTI v2**, **MNA_CUADRO v2** (or `npm run instruments:upgrade` path), not silent overwrite of locked v1.
- CONTRATOS remains `pacientes: create-only` in domain matrix.
- **I1 clarified (2026-07-22)**: hide estado **only on patient create** for CONTRATOS; only **GERONTOLOGA (+ ADMIN)** set estado on **edit patient**.
- Orchestrator does not implement; workers after approval.
- Staging already has 23 migrations + QA users from jul-18 release.
- UI Spanish; code English; Playwright tests required.

## Existing Patterns Used

| Pattern | Exemplar | Extension |
|---|---|---|
| Domain RBAC | `domainAccess.ts`, `useDomainAccess.ts` | Enforce estado rules for CONTRATOS on patient write |
| Patient forms | `pacientes/crear.vue`, `[id]/editar.vue` | Create: hide estado for CONTRATOS; Edit: estado only GERONTOLOGA/ADMIN |
| Instrument templates | `backend/prisma/instrument-templates/*.v1.json` | v2 JSON + upgrade |
| Dynamic form | `DynamicGroupInfoField.vue`, `DynamicItemField.vue` | Text cells for group-info |
| Scoring pure engine | `instrumentScoringService.ts` | New item ids/scores |
| Create-from-template | `templateCodigo` on instruments | Optional VALORACION_INTEGRAL code |
| FICHA_NUTRICIONAL info types | informational items | Valoración integral |
| Playwright | `tests/rbac`, `tests/instruments-dynamic` | New/extended specs |

## Requirements

R1–R16 from `01-requirements-fixes-jul-22.md`.

## Technical Approach

### 1. Patient estado (I1) — clarified

**Product rule**
1. **Create patient**: CONTRATOS must **not** see Activo/Inactivo.
2. **Edit patient**: only **GERONTOLOGA** (and **ADMIN**) can set Activo/Inactivo (typically after valoración).

**FE**
- `pacientes/crear.vue`: if `tipoEmpleado === 'CONTRATOS'`, **omit** estado Select entirely (do not send client-chosen estado).
- `pacientes/[id]/editar.vue`: show estado Select **only** when caller is GERONTOLOGA or ADMIN (not CONTRATOS; create-only already blocks edit for CONTRATOS — still gate the field for clarity).
- Do **not** treat “hide estado on all patient screens for CONTRATOS” as the rule — scope is **create** for hide, **edit** for gerontóloga ownership.

**BE**
- `createPatient`: if caller `tipoEmpleado === 'CONTRATOS'`, force `estado = 'ACTIVO'` (ignore body.estado).
- `updatePatient`: allow `estado` change only for ADMIN or `tipoEmpleado === 'GERONTOLOGA'`; CONTRATOS (and other EMPLEADO without that right) → 403 if `estado` is in payload.
- Resolve caller from auth middleware (same path as `requireDomain`).

### 2. Unsaved guard (I2)

- New composable `frontend/app/composables/useUnsavedGuard.ts`:
  - `isDirty` ref/computed
  - `onBeforeRouteLeave` → confirm dialog (PrimeVue ConfirmDialog or `window.confirm` matching app)
  - `beforeunload` when dirty
- Wire: patient crear/editar, instrument complete form page, optionally empleados nuevo/editar.

### 3. MNA frequency text matrix (I3)

**Option A (preferred)**: Extend `group-info` with optional `"cellInput": "text"` (default current select behavior for other instruments).  
**Option B**: Change only MNA rows to multiple `text-info` items (worse UX).

Implementation:
- Update `MNA_CUADRO.v2.json` (or upgrade script) `frecuencia_grupos` metadata.
- `DynamicGroupInfoField.vue`: if text mode → `InputText` per cell; answer shape stays row/column pairs with string values.
- Result/audit views already render group-info — ensure text displays.

### 4. Tinetti 8 & 11 (I4–I5)

Publish **TINETTI v2**:

**Item 8** (replace `eq_vuelta_360_pasos` + `eq_vuelta_360_estabilidad`):
```
id: eq_vuelta_360
label: 8. Vuelta a 360°
type: single-select-scored
options (single select):
  - pasos_discontinuos → score 0
  - pasos_continuos → score 1
  - inestable → score 0
  - estable → score 1
```
**Note**: exclusive 4-way select max score 1 (was 2 from 8a+8b). Adjust section `subtotal.max` equilibrio 16→15 **or** use combination scoring 0–2 with relabeled options — **default in implementation: keep equilibrio max 16 by using scores 0,1,1,2** mapped as:
- discontinuos = 0  
- continuos = 1  
- inestable = 0  
- estable = 2  

Wait - user wants four clinical options as listed, not combinations. Safer default for clinical continuity:
- discontinuos: 0
- continuos: 1  
- inestable: 0
- estable: 1  
and set equilibrio subtotal max to **15** (document deviation).

**Item 11 pie derecho** (merge `ma_pd_sobrepasa` + `ma_pd_separa`):
```
id: ma_pie_derecho
label: 11. Marcha — pie derecho
4 exclusive options derived from previous pairs, scores 0–2 max
```
**Item 11 pie izquierdo** similarly `ma_pie_izquierdo`.

Remove 11a/11b labels. Marcha subtotal max: was 12; if each foot was max 2 and stays max 2, unchanged.

### 5. Valoración integral (I6)

- New file `backend/prisma/instrument-templates/VALORACION_INTEGRAL.v1.json`
- codigo `VALORACION_INTEGRAL`, tipo VALORACION, all info types (no scored total)
- Seed / `instruments:upgrade` / allow `templateCodigo: VALORACION_INTEGRAL` in createInstrument enum
- Sections mirror xlsx outline in requirements

### 6. Tests

| Spec area | Cases |
|---|---|
| patients/rbac | CONTRATOS create → ACTIVO; cannot patch estado; no estado in UI (FE smoke) |
| instruments | TINETTI v2 item ids; max path score; MNA text cells save |
| unsaved | route leave when dirty prompts (FE) |
| valoración | definition loads; assign to patient |

## Risk & Unknowns

| Risk | Mitigation |
|---|---|
| Locked instrument versions | v2 + upgrade script; never mutate referenced v1 |
| Score max change item 8 | Document; tests assert new max |
| group-info answer shape change | Keep pair structure; only UI input type changes |
| Valoración large form | Informational only; progressive sections |
| Unsaved false positives | Mark clean after successful save |

## Implementation Scope

**In**: R1–R16 as above.  
**Out**: Other FORMATOS sheets; full clinical re-validation workshop; prod deploy.

## New Artifacts Proposed

| Artifact | Why | Alternatives |
|---|---|---|
| `useUnsavedGuard.ts` | Shared leave protection | Copy-paste per page (worse) |
| `TINETTI.v2.json` / MNA v2 | Version immutability | Edit v1 if never referenced in staging (still prefer v2) |
| `VALORACION_INTEGRAL.v1.json` | New instrument | Manual UI-only create (not reproducible) |
| Optional `cellInput` on group-info | Text matrix without new item type | New `group-text` type |

**N new artifact families: ~4 — approval required.**

## Suggested waves

| Wave | Role | Points | Deliverables |
|---|---|---|---|
| W1 | backend-eng | 5 | Patient estado API; instrument templates v2 + valoración JSON; templateCodigo enum; upgrade/seed |
| W2 | frontend-eng | 8 | Hide estado; unsaved guard; group-info text; verify instrument UI |
| W3 | test-quality | 5 | Specs vs contract; gap report |

W2 blockedBy W1 contract for item ids. W3 blockedBy W2.

## Open Items

- Exact Tinetti option scores if clinical table differs from defaults above — implement defaults; flag in completion report.
- Whether staging active TINETTI/MNA rows need `instruments:upgrade` in deploy checklist (yes if versions locked).

## References

- `00-intake-fixes-jul-22.md`
- `01-requirements-fixes-jul-22.md`
- `context/user-feedback/qa-session-jul-22-cleaned.md`
- `context/instrumentos-raw/FORMATOS DE INGRESO.xlsx` sheet VALORACIÓN INTEGRAL
- Instrument contract: `development/instrumentos-dynamic-fichas/orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md`

---

## Developer confirmation gate

**~4 new artifact families proposed — approval required** before Phase 1 team-plan / spawn.

Options:
1. **Approve** → team plan + TaskList + spawn (or say `--execute`)
2. **Approve with changes** — list deltas
3. **Cancel**
