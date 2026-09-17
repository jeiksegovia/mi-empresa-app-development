# Handoff: nomina-asistencia-jul-18

**Date**: 2026-07-18  
**Status**: IMPLEMENTATION COMPLETE — QA **38 pass / 0 fail** (0 product bugs)

---

## What shipped

### Backend
- Migration `20260718100000_nomina_asistencia` (medio pago, valorJornada, AsistenciaEmpleado, NominaPeriodo calc fields, enums)
- Domain `asistencia` (CONTRATOS true, GERONTOLOGA false)
- Empleado medio de pago + pendiente `Falta medio de pago de nómina`
- Contrato `valorJornada` required on CREATE
- API: `GET/PUT /asistencia`, `GET /asistencia/resumen`
- Nómina month enrichment (`asistenciaMes`, `sugerido`, medio) + period calc + aportes rule + dual-write `salario=totalPagado`

### Frontend
- Sidebar **Asistencia** after Empleados
- Empleado crear/editar: medio de pago section
- Contrato form: valor media jornada (4h)
- `/asistencia` Registrar hoy (AM/PM matrix, search, date, save)
- Nómina dialog: medias × valor, aportes (FIJO/INDEFINIDO only), total override

### Contract (authoritative)
`development/nomina-asistencia-jul-18/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md`

---

## Test matrix (final)

| Scope | Result |
|---|---|
| Backend smoke + edge | **28/28** |
| Frontend smoke + RBAC | **10/10** (use IP host `100.85.193.33` for live FE) |
| **Total** | **38/38** |

### Re-run

```bash
# BE
cd backend && npx playwright test \
  tests/employees/medio-pago*.spec.ts \
  tests/employees/contrato-valor-jornada.spec.ts \
  tests/asistencia/ \
  tests/nomina/nomina-calc-*.spec.ts --reporter=list

# FE (must match SPA API host)
cd frontend && \
TEST_FRONTEND_URL=http://100.85.193.33:3100 \
TEST_API_URL=http://100.85.193.33:3101 \
  npx playwright test \
  tests/asistencia/registrar-hoy.spec.ts \
  tests/nomina/registrar-dialog-enrichment.spec.ts \
  tests/rbac/nav-gating.spec.ts \
  tests/empleados/medio-pago.spec.ts --reporter=list
```

---

## Gaps (non-blocking)

| ID | Class | Note |
|---|---|---|
| G1 | TEST-ENV | Live FE specs need same host as `NUXT_PUBLIC_API_BASE` (not bare localhost) |
| G2 | residual | BE `domain-access.spec` does not yet hit `/asistencia` (FE nav covers UI) |
| G3 | hygiene | Prefer `registrar-dialog-enrichment.spec.ts` over empty `dialog-enrichment.spec.ts` alias |

**BUG: 0** — no fix-up wave required.

---

## Key paths

| Kind | Path |
|---|---|
| Feature plan | `development/nomina-asistencia-jul-18/nomina-asistencia-jul-18-plan.md` |
| Contract | `…/orchestration-ctx/decisions/schema-contract-nomina-asistencia-jul-18.md` |
| QA gap | `…/tasks/W3-qa-tests/gap-report.md` |
| BE service | `backend/src/services/asistenciaService.ts` |
| FE page | `frontend/app/pages/asistencia/index.vue` |
| FE nomina | `frontend/app/pages/nomina/index.vue` |

---

## Deferred (out of v1)

- Banco Colombia planilla export
- Legal % aportes auto-calc
- Pure hourly UI
- Month lock after liquidación
- Relax ADMIN write role on nomina/contratos for CONTRATOS

---

## Git

Working tree still uncommitted (including prior jul-16/17 work). **Do not commit unless user asks.**

## Workers

All implementation waves complete. PARKED/SHUTDOWN as of handoff; no further spawn needed unless fix-ups.
