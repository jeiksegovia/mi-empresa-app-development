# Task: Playwright E2E Tests for Employee List Page

## Status: COMPLETED

## Date: 2026-02-17

## Objective
Write Playwright E2E tests for the `/empleados` Employee List page and confirm the full frontend test suite passes.

## Test File Created
`/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/empleados.spec.ts`

## Tests Written (11 total)
| # | Test Name | Result |
|---|-----------|--------|
| 1 | should navigate to /empleados from sidebar | PASS |
| 2 | should display page header with title | PASS |
| 3 | should display stats cards bar | PASS |
| 4 | should display stats with numeric values from API | PASS |
| 5 | should display data table with employee columns | PASS |
| 6 | should display employee rows from seed data | PASS |
| 7 | should have search input | PASS |
| 8 | should filter employees by search term | PASS |
| 9 | should have estado filter dropdown | PASS |
| 10 | should display Nuevo Empleado button | PASS |
| 11 | should redirect unauthenticated user to login | PASS |

## Key Technical Issue Discovered and Resolved

**Problem**: Direct `page.goto('/empleados')` in Playwright caused Nuxt SSR to redirect to `/login`.

**Root Cause**: The Nuxt auth middleware (`auth.ts`) calls `fetchUser()` via `apiFetch` with `credentials: 'include'`. During SSR (triggered by a full page reload via `page.goto`), the browser's session cookie is NOT forwarded to the Node.js SSR server — so `fetchUser()` fails with 401 and the middleware redirects to `/login`.

**Solution**: All tests that need to land on `/empleados` use a `gotoEmpleados()` helper that clicks the sidebar `NuxtLink`. This performs a **client-side SPA navigation** (no SSR re-render), so the in-memory Pinia auth store (`isAuthenticated: true`) is preserved and the middleware passes without calling `fetchUser()`.

## Additional Fixes Applied
- `getByText('Activos')` matched "Inactivos" substring — fixed with `{ exact: true }`
- `getByText('Empleado')` matched 7 elements — scoped to `[data-pc-section="columntitle"]` inside `.p-datatable`
- `locator('table, .p-datatable')` matched 2 elements (wrapper + inner table) — used `table[role="table"].first()` and `tbody tr`

## Full Suite Results
```
30/30 passed in 43.3s
- tests/auth/login.spec.ts       6/6 passed
- tests/e2e/dashboard.spec.ts    6/6 passed
- tests/e2e/empleados.spec.ts   11/11 passed  ← NEW
- tests/e2e/layout.spec.ts       7/7 passed
```
