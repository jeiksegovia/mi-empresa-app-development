# Task 12: Employee Create Wizard — Completion Report

## Status: COMPLETE ✓

## Summary
Implemented the 5-step Employee Create Wizard at `/empleados/nuevo`. Found and fixed a critical bug affecting all pages. Full suite: **55/55 tests passing**.

## Files Created/Modified
- `frontend/app/pages/empleados/nuevo.vue` — Wizard page (NEW)
- `frontend/tests/e2e/empleado-nuevo.spec.ts` — E2E test suite, 13 tests (NEW)
- `frontend/app/pages/index.vue` — Fixed `/api/v1/dashboard/stats` → `/dashboard/stats`
- `frontend/app/pages/empleados/index.vue` — Fixed `/api/v1/employees` → `/employees`
- `frontend/app/pages/empleados/[id].vue` — Fixed `/api/v1/employees/:id` → `/employees/:id`

## Critical Bug Fixed: Doubled `/api/v1` Path
`apiBase = http://localhost:3001/api/v1` — so `apiFetch('/api/v1/employees')` was producing:
`http://localhost:3001/api/v1/api/v1/employees` → 404 Not Found

All pages had this bug. Fixed by removing `/api/v1` prefix from all `apiFetch` calls since
the `baseURL` already includes it. The employee list E2E tests previously "passed" because the
empty-state row counted as `rowCount > 0`, hiding the bug.

## Wizard Steps
1. **Datos Personales** — nombre, apellido, documento, género, fecha nacimiento (required), estado civil, vivienda, estrato, dirección, teléfono, email, permiso trabajo
2. **Núcleo Familiar** — dynamic add/remove family members
3. **Información Laboral** — company positions (cargos) + emergency contacts
4. **Educación y Vehículos** — education/languages + vehicles
5. **Certificados y Migración** — cert alturas, cert riesgo eléctrico, datos migración + summary card

## Features
- Step progress bar with numbered circles and check icons for completed steps
- Client-side validation on step 1 before advancing
- Form state preserved when navigating back with "Anterior"
- Summary card on step 5 showing employee name, document, and counts
- On success: navigates to `/empleados/:id` of the new employee
- Error toast shown if API call fails

## Test Results
```
13 passed (13 new wizard tests)
55 passed total (1.6m full suite)
```
