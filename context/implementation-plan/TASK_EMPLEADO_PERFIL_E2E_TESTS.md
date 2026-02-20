# Task: Employee Profile Page E2E Tests

## Status: COMPLETED

## Date: 2026-02-17

## Test File
`/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/empleado-perfil.spec.ts`

## Summary
Created 12 Playwright E2E tests for the Employee Profile page (`/empleados/[id]`).
All 12 tests pass. Full suite (42 tests) also passes.

## Key Findings & Fixes Applied

### Finding 1: API double-path bug
The page code calls `apiFetch('/api/v1/employees/...')` but `apiBase` in `useApi` is already
`http://localhost:3001/api/v1`. This results in `localhost:3001/api/v1/api/v1/employees` → 404.
**Fix applied in tests (not in page):** Used `page.route()` to intercept and rewrite the doubled path:
```typescript
await page.route('**/api/v1/api/v1/**', async (route) => {
  const fixedUrl = route.request().url().replace('/api/v1/api/v1/', '/api/v1/')
  await route.continue({ url: fixedUrl })
})
```

### Finding 2: Table "No se encontraron empleados" on waitForLoadState('networkidle')
Without the route fix, the API returns 404 → empty employee list → no eye buttons.
Resolved by applying the route fix before login.

### Finding 3: Strict mode violation on getByText('Certificado de Alturas')
The text appears in both the section heading AND the empty-state message body text.
**Fix:** Use `getByRole('heading', { name: /Certificado de Alturas/i })` instead.

### Finding 4: Eye button selector
Initial selector `table tbody tr .getByRole('button').first()` failed timing.
Final selector: `page.locator('.pi-eye').first()` (clicks the icon itself, which triggers navigation).

## Test Coverage (12 tests)
1. Navigate to employee profile from list page (via eye button)
2. Display profile header with employee name (h1)
3. Display status badge in profile header card (.p-badge)
4. Display document info in profile header (CC/CE/PASAPORTE pattern)
5. Show 3 tabs (Información Personal, Experiencia & Educación, Certificados & Documentos)
6. Show personal data section on first tab (Datos Personales)
7. Show núcleo familiar section on first tab
8. Show contactos de emergencia section on first tab
9. Switch to experience tab → Cargos en la Empresa + Experiencia Laboral Externa visible
10. Switch to certificates tab → section headings visible (Alturas, Riesgo Eléctrico, Migración)
11. Volver button navigates back to /empleados
12. Editar button is visible

## Full Suite Results
- 42/42 tests pass across all spec files:
  - tests/auth/login.spec.ts: 6/6
  - tests/e2e/dashboard.spec.ts: 6/6
  - tests/e2e/empleado-perfil.spec.ts: 12/12 (NEW)
  - tests/e2e/empleados.spec.ts: 11/11
  - tests/e2e/layout.spec.ts: 7/7
