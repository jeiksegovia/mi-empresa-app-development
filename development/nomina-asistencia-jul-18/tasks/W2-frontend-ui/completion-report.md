# Completion Report — W2-frontend-ui

**Task slug**: nomina-asistencia-jul-18  
**Worker**: frontend-eng (W2)  
**Date**: 2026-07-18  
**Scope**: frontend only (no backend/**, no git commit)

---

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Types: MedioPagoNomina, TipoCuentaBanco, asistencia rows, nomina sugerido/calc | ✅ | `frontend/shared/types/api.ts` exports enums + shapes |
| 2 | Sidebar Asistencia after Empleados; domain `asistencia` | ✅ | `app.config.ts` + `useDomainAccess.ts` |
| 3 | Empleado create/edit medio section + conditional fields + data-testid | ✅ | `nuevo.vue`, `editar.vue`; smoke medio-pago |
| 4 | Contrato Valor media jornada (4h) on new/edit | ✅ | `editar.vue` contrato dialog `contrato-valor-jornada` |
| 5 | `/asistencia` matrix, date, search, GET/PUT | ✅ | `pages/asistencia/index.vue` + live smoke file |
| 6 | Nómina dialog enrichment + aportes gate + file slots | ✅ | `pages/nomina/index.vue` + registrar-dialog smoke |
| 7 | RBAC: CONTRATOS sees Asistencia; GERONTOLOGA does not | ✅ | nav-gating MOCKED green |
| 8 | Smoke specs medio / asistencia / nomina | ✅ | See command evidence below |
| 9 | No backend source modifications | ✅ | Work limited to `frontend/**` + task reports |

---

## Files changed (frontend)

```
frontend/shared/types/api.ts
frontend/app/composables/useDomainAccess.ts
frontend/app/app.config.ts
frontend/app/pages/empleados/nuevo.vue
frontend/app/pages/empleados/[id]/editar.vue
frontend/app/pages/asistencia/index.vue          # NEW
frontend/app/pages/nomina/index.vue
frontend/tests/asistencia/registrar-hoy.spec.ts  # NEW (live)
frontend/tests/empleados/medio-pago.spec.ts     # NEW (mocked)
frontend/tests/nomina/registrar-dialog-enrichment.spec.ts  # NEW (mocked)
frontend/tests/nomina/dialog-enrichment.spec.ts # alias stub
frontend/tests/rbac/nav-gating.spec.ts
frontend/tests/rbac/live-profiles.spec.ts
```

---

## Verification evidence

### Mocked suite (local FE :3100)

```text
$ cd frontend && npx playwright test \
    tests/empleados/medio-pago.spec.ts \
    tests/nomina/registrar-dialog-enrichment.spec.ts \
    tests/rbac/nav-gating.spec.ts --reporter=list

  ✓  Medio de pago UI — create wizard …
  ✓  Medio de pago UI — edit page hydrates Nequi and sends medio on save
  ✓  Nómina FIJO: name/doc/medio/asistencia + calc + DESPRENDIBLE
  ✓  Nómina OPS: sin medio warning, no aportes, cuenta-cobro slots
  ✓  GERONTOLOGA: … asistencia hidden
  ✓  CONTRATOS: … asistencia visible
  ✓  ADMIN: … Asistencia visible
  ✓  CONTRATOS forbidden /instrumentos redirect
  ✓  fichas tab gating
  9 passed (9.4s)
```

### Live asistencia smoke

```text
File: frontend/tests/asistencia/registrar-hoy.spec.ts
Mode: live admin login + real GET/PUT /asistencia
Status: NOT-VERIFIED in this session (requires backend :3101 + ACTIVO employees).
Run when env ready:
  cd frontend && npx playwright test tests/asistencia/registrar-hoy.spec.ts
```

### Live RBAC profiles

```text
File: frontend/tests/rbac/live-profiles.spec.ts
Updated assertions for Asistencia nav.
Status: NOT-VERIFIED live (needs QA users + IP CORS stack).
MOCKED matrix parity covered by nav-gating.spec.ts (green).
```

---

## Bug fixed while implementing

- **`validateForm` undefined** in `empleados/[id]/editar.vue` — `savePersonal` returned early with throw/no-op; Guardar never issued PUT. Added standard required-field validator matching create wizard.

---

## Contract alignment

- Enums/fields match `schema-contract-nomina-asistencia-jul-18.md`
- Domain key: `'asistencia'`
- Endpoints: `GET /asistencia?fecha=`, `PUT /asistencia/dia`, nomina `sugerido` / `asistenciaMes` / medio on empleado
- `PENDIENTE_MEDIO_PAGO` constant exported for FE reuse

---

## Out of scope / left for W3

- Deep live e2e across full liquidación flow
- Visual regression / mobile screenshot matrix
- Live profile Asistencia nav re-run
