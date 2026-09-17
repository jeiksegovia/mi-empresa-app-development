# Intake: fixes-jul-22

## Objective

Implement QA Jul-22 feedback: hide patient estado on **create** for CONTRATOS; only gerontóloga/ADMIN set estado on **edit**; unsaved-form leave guard; MNA food-frequency as plain text matrix; Tinetti items 8 and 11 restructure; valoración integral instrument from FORMATOS DE INGRESO first sheet.

## Input Source

- `context/user-feedback/qa-session-jul-22-raw.md`
- Cleaned: `context/user-feedback/qa-session-jul-22-cleaned.md`
- Staging already has nomina-asistencia + RBAC + dynamic instruments (jul-18 release)

## Component map (initial analysis)

| Insight | Layer | Primary files |
|---|---|---|
| I1 Patient estado | FE + BE | **Create**: hide estado for CONTRATOS on `pacientes/crear.vue`; POST force ACTIVO. **Edit**: only GERONTOLOGA + ADMIN show/change estado on `[id]/editar.vue`; BE forbid estado update for CONTRATOS |
| I2 Unsaved leave guard | FE | New composable e.g. `useUnsavedGuard.ts`; wire forms: pacientes crear/editar, instrument dynamic form, … |
| I3 MNA frequency text matrix | Instrument JSON + FE renderer | `MNA_CUADRO` v2; `DynamicGroupInfoField.vue` text cells |
| I4–I5 Tinetti 8 & 11 | Instrument JSON + scoring | `TINETTI` v2; scoring engine |
| I6 Valoración integral | Instrument JSON + seed | `VALORACION_INTEGRAL.v1.json` from xlsx first sheet |

## Assumptions (pending confirmation)

- A1: On **create**, CONTRATOS has **no estado UI**; server forces **ACTIVO** (ignore body.estado).
- A2: CONTRATOS cannot update `estado` via API (create-only + explicit field guard).
- A3: **Only GERONTOLOGA + ADMIN** set Activo/Inactivo on **edit patient** (after valoración).
- A4: Unsaved guard covers in-app navigation + `beforeunload` for browser/PWA close.
- A5: Changing instrument JSON may require **new instrument version** (immutable once referenced) via upgrade path, not in-place edit of locked v1.

## Open Questions

Tagged for user before feature draft / plan:

1. **[confirm-with-user]** Patient create default estado for CONTRATOS: ACTIVO vs leave null vs other?
2. **[confirm-with-user]** Tinetti item 8 scores when 4 options merge (was 0–1 + 0–1 = 0–2 max)?
3. **[confirm-with-user]** Tinetti item 11: one question vs pie derecho + pie izquierdo each with 4 options? Scores?
4. **[confirm-with-user]** MNA frequency: free text per cell, or free text per row with labels Diario/Semanal/Mensual/Nunca?
5. **[confirm-with-user]** Unsaved guard: all major forms this wave, or only instrument + patient forms?
6. **[confirm-with-user]** Existing completed Tinetti/MNA fichas: keep old version answers; new completions use new definition (version bump)?
7. **[confirm-with-user]** Valoración inicial: confirm deferred until PDF.

## Known Constraints

- Orchestrator does not implement; workers after plan approval.
- Contract-first for multi-layer work.
- Instrument versions immutable once referenced (dynamic-fichas G2).
- UI Spanish; code English.
- Tests mandatory (Playwright).
- Do not auto-commit.

## Decisions locked (2026-07-22)

- **I1 clarified**: hide Activo/Inactivo **only on patient create** for CONTRATOS; server force ACTIVO on that create. **Only gerontóloga (+ ADMIN)** may set estado via **edit patient**.
- Tinetti: Q8 one×4 options; Q11 pie der + pie izq each ×4 options
- MNA frequency: text per cell
- Unsaved guard: in scope
- Valoración integral: **IN SCOPE** from `FORMATOS DE INGRESO.xlsx` first sheet only
- Instrument changes via version bump

## Next gate

Developer approves `fixes-jul-22-plan.md` → Phase 1 team plan + workers.
