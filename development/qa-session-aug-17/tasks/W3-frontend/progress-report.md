# W3-frontend progress report

## Status
- T7 (task 7): completed — Empleados Activos/Inactivos tabs
- T8 (task 8): completed — Nomina bonos + total formula
- T9 (task 9): completed — Actividades page + nav + domain mirror

## Started
2026-08-18 — cwd verified `/Users/jeik/ws/mi-empresa-app-development`. Contract read. Task 7 → in_progress.

## T7 done
- Replaced estado Select (Todos/Activo/Inactivo) with Activos|Inactivos tabs.
- Default `estadoFilter = 'ACTIVO'` → first fetch always sends `estado=ACTIVO`.
- testids: `empleados-tab-activos`, `empleados-tab-inactivos`.
- Stats cards unchanged (do not reset filter).

## T8 done
- Added `bonos` to dialogForm + NominaEntrada + sugerido.
- `bonosAllowed` = FIJO|INDEF; UI `nomina-bonos` gated on it.
- Formula: FIJO/INDEF subtotal=total=valorMensual+bonos; aportes helper “no se suma”.
- POST/PUT body includes `bonos` when allowed, else null.
- OPS/OBRA: no bonos control.
- OBRA subtotal stays null; total = valorMensual (contract D5).
- OPS formula unchanged (contract D4).

## T9 done
- Domain union + matrix cells + `/actividades` prefix map in `useDomainAccess.ts`.
- Sidebar item immediately after Asistencia: `{ label: 'Registro de actividades', icon: 'pi pi-list', to: '/actividades' }`.
- New page `frontend/app/pages/actividades/index.vue` with form (create-only/full) / list / ADMIN edit-delete.
- Types: `RegistroActividadDto`, create/update bodies; `User.empleadoId`.
- Spec: `frontend/tests/local-qa/aug17-qa-frontend.spec.ts` — **11 passed (12.2s)**.

## Verification
```
cd frontend && npx playwright test tests/local-qa/aug17-qa-frontend.spec.ts --reporter=line
→ 11 passed (12.2s)
```

## Notes
- Sidebar icon MUST be `pi pi-list` (contract §1.4). ✓
- Do not invent testids; use contract §6. ✓
- Do not modify backend. ✓
- v-model pitfall: form fields use `ref` + `v-model`, not `reactive()`. ✓
