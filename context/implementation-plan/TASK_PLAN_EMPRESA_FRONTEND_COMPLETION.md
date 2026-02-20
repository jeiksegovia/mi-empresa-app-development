# Task Completion: Empresa - Frontend Pages

## Summary
Created empresa frontend pages, updated auth store with empresa state, added sidebar navigation.

## Changes Made

### frontend/app/stores/auth.ts
- Added EmpresaData interface
- Added empresa ref<EmpresaData | null>
- Added fetchEmpresa() function calling GET /empresa
- Called fetchEmpresa() after successful login() and fetchUser()
- Added empresa.value = null in logout() finally block
- Exported empresa and fetchEmpresa

### frontend/app/pages/empresa/index.vue (new)
- Displays empresa info in two cards: Datos Generales (nombre, NIT, dirección) and Contacto (teléfono, email)
- Shows Editar button (NuxtLink) for ADMIN users only
- Calls fetchEmpresa() on mount if not loaded

### frontend/app/pages/empresa/editar.vue (new)
- Edit form for nombre, NIT, dirección, teléfono, email
- Redirects non-ADMIN to /empresa
- PUT /empresa/:id on submit, then fetchEmpresa() and navigate to /empresa

### frontend/app/app.config.ts
- Added sidebar entry: { label: 'Empresa', icon: 'pi pi-building', to: '/empresa' }

### frontend/tests/e2e/empresa.spec.ts (new)
- 3 tests: view page, navigate to edit, save changes
- Uses SPA navigation pattern to avoid full-page reload auth issues

## Test Results
- empresa.spec.ts: 3/3 passed
- Full frontend suite: 126/126 passed
