# W3-frontend completion report

**Worker:** pt-frontend-eng (W3)  
**Slug:** qa-session-aug-17  
**Tasks:** 7 (T7), 8 (T8), 9 (T9)  
**Date:** 2026-08-18

## Deliverables

| File | Change |
|---|---|
| `frontend/app/pages/empleados/index.vue` | Activos/Inactivos tabs; default ACTIVO; no Todos |
| `frontend/app/pages/nomina/index.vue` | bonos UI + formula (mensual+bonos; aportes not added) |
| `frontend/app/pages/actividades/index.vue` | **NEW** — Registro de actividades page |
| `frontend/app/app.config.ts` | Sidebar item after Asistencia, `pi pi-list` |
| `frontend/app/composables/useDomainAccess.ts` | Domain `actividades` + matrix cells + prefix map |
| `frontend/shared/types/api.ts` | `RegistroActividad*` DTOs; `bonos` on NominaCalcFields; `empleadoId` on User |
| `frontend/tests/local-qa/aug17-qa-frontend.spec.ts` | **NEW** — mocked Playwright (R1/R3/R6) |

## Acceptance criteria — evidence

### T7 — Empleados tabs
- testids `empleados-tab-activos` / `empleados-tab-inactivos` present
- First fetch uses `estado=ACTIVO`
- No Todos option

```text
$ cd frontend && npx playwright test tests/local-qa/aug17-qa-frontend.spec.ts --reporter=line
… R1 Empleados Activos/Inactivos tabs (MOCKED) › default tab is Activos and first fetch uses estado=ACTIVO
… R1 Empleados Activos/Inactivos tabs (MOCKED) › switching to Inactivos fetches estado=INACTIVO
  11 passed (12.2s)
```

### T8 — Nómina bonos
- `nomina-bonos` visible only for TERMINO_FIJO / TERMINO_INDEFINIDO
- Subtotal = Total = valorMensual + bonos; aportes helper “no se suma”
- POST body includes `bonos` for those tipos
- OPS / OBRA: no bonos control

```text
… R3 Nómina bonos UI (MOCKED) › TERMINO_FIJO: bonos visible; total = mensual + bonos (aportes not added)
… R3 Nómina bonos UI (MOCKED) › OPS: bonos control is hidden
… R3 Nómina bonos UI (MOCKED) › OBRA_O_LABOR: bonos control is hidden
… R3 Nómina bonos UI (MOCKED) › TERMINO_FIJO POST body includes bonos
```

### T9 — Actividades
- Sidebar item immediately after Asistencia; icon `pi pi-list`
- Hidden when `can('actividades')` is false (AppSidebar + DOMAIN_PREFIX_MAP)
- PROFESORES/AUXILIARES: form (today + texto + guardar)
- GERONTOLOGA/CONTRATOS: list, no form (`isReadOnly`)
- ADMIN: form + edit/delete affordances

```text
… R6 Actividades page + nav (MOCKED) › ADMIN: sidebar item after Asistencia uses pi-list; form + manage visible
… R6 Actividades page + nav (MOCKED) › PROFESORES: form visible (create-only)
… R6 Actividades page + nav (MOCKED) › AUXILIARES: form visible (create-only)
… R6 Actividades page + nav (MOCKED) › GERONTOLOGA: isReadOnly hides write form; nav still visible
… R6 Actividades page + nav (MOCKED) › CONTRATOS: isReadOnly hides write form
  11 passed (12.2s)
```

Full log: `tmp/aug17-qa-frontend-run.log`

## Matrix cells pasted (contract §1.2)

```ts
GERONTOLOGA: { …, actividades: 'read-only' }
CONTRATOS:   { …, actividades: 'read-only' }
PROFESORES:  { …, actividades: 'create-only' }
AUXILIARES:  { …, actividades: 'create-only' }
```

## Deviations
None vs contract. Sidebar icon is `pi pi-list` (not pi-book). Backend untouched. No git commit.

## NOT-VERIFIED
- Live BE round-trip for `/actividades` (W2 owns API; FE mocked only).
- Live BE round-trip for `bonos` persistence (W2 owns service; FE sends field).
