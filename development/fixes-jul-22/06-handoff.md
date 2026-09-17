# Handoff: fixes-jul-22

**Date**: 2026-07-22/23  
**Status**: IMPLEMENTATION COMPLETE — QA **62 pass / 0 fail** (0 product bugs)

---

## What shipped

### Patient estado (I1 clarified)
- **Create + CONTRATOS**: estado control hidden; server forces `ACTIVO`
- **Edit**: only **ADMIN / GERONTOLOGA** may set estado (API `PATIENT_STATE_FORBIDDEN` otherwise)
- FE: `pacientes/crear.vue`, `pacientes/[id]/editar.vue`

### Unsaved leave guard (I2)
- `frontend/app/composables/useUnsavedGuard.ts`
- Wired: patient crear/editar, instrument crear/editar; fill dialog cancel confirm

### MNA frequency text matrix (I3)
- `MNA_CUADRO.v2.json` with `cellInput: "text"`
- `DynamicGroupInfoField.vue` text mode; answer `{rowId,columnId,value}[]`

### Tinetti 8 & 11 (I4–I5)
- `TINETTI.v2.json`: `eq_vuelta_360` (4 opts); `ma_pie_derecho` / `ma_pie_izquierdo` (4 each)
- Max total **27** (equilibrio 15 + marcha 12)

### Valoración integral (I6)
- `VALORACION_INTEGRAL.v1.json` (11 sections, informational)
- `templateCodigo` includes `VALORACION_INTEGRAL`; seed/upgrade activates highest versions

---

## Contract

`development/fixes-jul-22/orchestration-ctx/decisions/schema-contract-fixes-jul-22.md`

---

## Tests

| Scope | Result |
|---|---|
| Backend (estado + templates + API + scoring + seed) | **52 pass** |
| Frontend (estado-hide + unsaved + text-matrix) | **10 pass** |
| **Total** | **62 / 0 fail** |

Orchestrator spot-check: `patient-estado-rbac` **5/5** on :3101.

### Re-run

```bash
cd backend && npx playwright test \
  tests/patients/patient-estado-rbac.spec.ts \
  tests/instruments-dynamic/fixes-jul-22-templates.spec.ts \
  tests/instruments-dynamic/fixes-jul-22-api.spec.ts \
  tests/instruments-dynamic/scoring-engine.spec.ts \
  tests/instruments-dynamic/seed-definitions.spec.ts --reporter=list

cd frontend && npx playwright test tests/fixes-jul-22 --reporter=list
```

Local instruments upgrade (if needed):
```bash
cd backend && npm run instruments:upgrade
```

---

## Gaps (non-blocking)

- No live E2E spanning FE+BE together (FE mocked session; BE live API)
- No line-coverage % instrumentation
- VERSION_LOCKED destructive upgrade scenarios not fully exercised

**BUG: 0** — no fix-up wave required.

---

## Deferred / notes

- Staging deploy of this wave not in scope of this orchestration
- Git still uncommitted unless user asks
- Tinetti v2 score defaults documented in contract (equilibrio max 15)

---

## Workers

| Worker | State |
|---|---|
| worker-1 backend | PARKED |
| worker-2 frontend | PARKED |
| worker-3 QA | PARKED after COMPLETE |
