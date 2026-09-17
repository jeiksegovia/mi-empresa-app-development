# Team Plan: fixes-jul-22

## Context
- `fixes-jul-22-plan.md` — approved + execute 2026-07-22
- `01-requirements-fixes-jul-22.md` — R1–R16 (I1 clarified: create-only hide estado)
- `qa-session-jul-22-cleaned.md`

## Objective
CONTRATOS hide estado on patient create + force ACTIVO; gerontóloga/ADMIN set estado on edit; unsaved leave guard; MNA text matrix; Tinetti 8/11 v2; VALORACION_INTEGRAL instrument; tests.

## Implementation Location
- Source: `backend/`, `frontend/`
- Orchestration: `development/fixes-jul-22/`

## Work Streams

| ID | Stream | Worker | Role | Points | Deps |
|----|--------|--------|------|--------|------|
| T1 | Schema contract decision + patient estado API | W1 | backend-eng | 3 | — |
| T2 | TINETTI v2 + MNA_CUADRO v2 templates + scoring | W1 | backend-eng | 3 | T1 |
| T3 | VALORACION_INTEGRAL.v1.json + templateCodigo + seed/upgrade | W1 | backend-eng | 3 | T1 |
| T4 | Backend smoke specs (estado + instruments) | W1 | backend-eng | 2 | T2,T3 |
| T5 | FE types + hide estado crear + edit gate | W2 | frontend-eng | 2 | T4 |
| T6 | useUnsavedGuard + wire forms | W2 | frontend-eng | 3 | T5 |
| T7 | DynamicGroupInfoField text cells + instrument UI | W2 | frontend-eng | 3 | T4 |
| T8 | FE smoke specs | W2 | frontend-eng | 2 | T6,T7 |
| T9 | QA deep tests + gap report | W3 | test-quality | 5 | T8 |

## Dependency Graph
```
T1 → T2, T3 → T4 → T5 → T6, T7 → T8 → T9
```

## Interface Contracts

**Authoritative**: `development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md` (W1 writes/owns)

### Patient estado (I1 clarified)
- Create UI: CONTRATOS → no estado field
- Create API: CONTRATOS → force `estado=ACTIVO`
- Update API: only ADMIN or GERONTOLOGA may change `estado`; else 403
- Edit UI: estado Select only for GERONTOLOGA/ADMIN

### Tinetti v2
- `eq_vuelta_360` single-select 4 options (scores: document in contract; default discontinuos=0, continuos=1, inestable=0, estable=1; equilibrio max adjust if needed)
- `ma_pie_derecho`, `ma_pie_izquierdo` each 4 options single-select
- Remove 8a/8b/11a/11b items

### MNA v2
- `frecuencia_grupos` with `cellInput: "text"` (or equivalent); text per row×column

### Valoración integral
- codigo `VALORACION_INTEGRAL`, informational items from xlsx first sheet
- Add to TEMPLATE_CODIGOS

## File ownership
| Worker | Owns | Must NOT |
|---|---|---|
| W1 | backend/** (patients, instruments, templates, seed), contract doc, backend/tests | frontend/** |
| W2 | frontend/** | backend/** |
| W3 | tests only + gap report | production source |

## Communication
All via orchestrator. Contract is SSOT for names.

## Traps
- VERSION_LOCKED: never mutate referenced v1 in place — v2 + activate
- CONTRATOS create-only already blocks edit — still implement create hide + API force
- No auto-commit; no shadow migrate
