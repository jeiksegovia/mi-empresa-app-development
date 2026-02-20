# Task Completion: Nuxt 4 Migration + Test Selector Fixes

## Summary
Upgraded to Nuxt 4.3.1 and fixed PrimeVue Password component selector in all E2E tests.

## Nuxt 4 Migration

### Changes
- frontend/package.json: Updated nuxt to ^4.0.0 (installed 4.3.1)
- frontend/nuxt.config.ts: Removed future.compatibilityVersion: 4 block (redundant on Nuxt 4)
  Added 'primeicons/primeicons.css' to css array
- Removed @nuxtjs/tailwindcss (using @tailwindcss/vite directly)

### Notes
- app/ directory was already adopted (Nuxt 4 style), no file moves needed
- Build: passed cleanly, 646 packages installed

## Test Selector Fixes

### Problem
PrimeVue Password component (id="password") sets the id on the wrapper div, not the inner input.
All test files used: page.locator('input[placeholder="Ingresa tu contraseña"]') which stopped working.

### Fix
Updated all 11 test files to use: page.locator('#password input')
Files fixed:
- tests/auth/login.spec.ts (4 occurrences)
- tests/e2e/empleado-editar.spec.ts
- tests/e2e/empleado-nuevo.spec.ts
- tests/e2e/empleado-perfil.spec.ts
- tests/e2e/empleados.spec.ts
- tests/e2e/dashboard.spec.ts
- tests/e2e/pacientes.spec.ts
- tests/e2e/paciente-perfil.spec.ts
- tests/e2e/instrumentos.spec.ts
- tests/e2e/instrumento-detalle.spec.ts
- tests/e2e/layout.spec.ts

Also fixed new test files to use consistent login pattern:
- tests/e2e/empresa.spec.ts
- tests/e2e/empleado-crear-completo.spec.ts

## Test Results
- Frontend full suite: 126/126 passed
- Backend full suite: 123/123 passed
