# Task Completion: Frontend - Fix Create Empleado (Send All Relations)

## Summary
Fixed the submit() function in nuevo.vue to include Step 4 (education/vehicles) and Step 5 (certificates/migration) data in the API payload.

## Changes Made

### frontend/app/pages/empleados/nuevo.vue
Added to submit() function after validContacts block:
- Step 4: educacionIdiomas and vehiculos payload building
- Step 5: certificadoAlturas, certificadoRiesgoElectrico, datosMigracion payload building

### frontend/tests/e2e/empleado-crear-completo.spec.ts (new)
E2E test that navigates through all 5 wizard steps and verifies employee creation redirect.
Uses SPA navigation to avoid full-page reload auth issues.

## Test Results
- empleado-crear-completo.spec.ts: 1/1 passed
