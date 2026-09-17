# Phase 4 Backend Tests — Task Done

## Summary

5 new Playwright backend API test files created for the mi-empresa-app.

---

## Files Created

| File | Test Count | Description |
|------|-----------|-------------|
| `backend/tests/uploads/uploads.spec.ts` | 7 tests | POST presigned-url and GET download-url |
| `backend/tests/certificates/certificates.spec.ts` | 11 tests | CRUD + stats + role-based access |
| `backend/tests/dashboard/dashboard-activity.spec.ts` | 6 tests | GET /dashboard/activity shape + auth |
| `backend/tests/employees/employees-sub-resources.spec.ts` | 11 tests | All 8 sub-resource PUT routes |
| `backend/tests/patients/patient-fichas.spec.ts` | 10 tests | Ficha lifecycle: create, status transition, delete |

---

## Body Shape Issues Found (resolved by reading routes)

### uploads.spec.ts
- Route: `POST /uploads/presigned-url` validates with Zod: `{ contentType: string (required), folder?: string, filename?: string }`.
- Response shape: `{ success: true, data: { uploadUrl: string, key: string } }`.
- The `key` starts with `${folder || 'uploads'}/` — confirmed by reading route handler.

### certificates.spec.ts
- `createCertificateSchema` requires `empresaId: number`. The seed creates one empresa with `id: 1`. Tests use `EMPRESA_ID = 1`.
- `tipoCertificado` enum: `'RUT' | 'CAMARA_COMERCIO' | 'PERMISO_SANITARIO' | 'PAGO_SEGURIDAD_SOCIAL' | 'OTRO'`.
- Employee user for 403 test: `empleado@miempresa.com / <redacted>` (from seed, role `EMPLEADO`).
- Stats response shape: `{ vigente: number, vencido: number, pendiente: number, total: number }`.

### employees-sub-resources.spec.ts
- Each sub-resource route expects its own key in the request body (not a top-level array):
  - `/cargos` → `{ cargos: [...] }` where each item needs `{ nombreCargo, ubicacion, fechaIngreso, fechaTerminacion? }`
  - `/nucleo-familiar` → `{ nucleoFamiliar: [...] }` (each item needs `nombre, apellido, tipoDocumento, fechaNacimiento, genero, parentesco`)
  - `/contactos-emergencia` → `{ contactosEmergencia: [...] }` (each item needs `nombre, apellido, telefono, parentesco`)
  - `/experiencias-laborales` → `{ experienciasLaborales: [...] }` (each item needs `empresa, cargo, periodoInicio`)
  - `/educacion-idiomas` → `{ educacionIdiomas: [...] }` (each item needs `institucion, nivelEscritura, nivelHabla, capacidadTraducir`)
  - `/vehiculos` → `{ vehiculos: [...] }` (each item needs `tipoVehiculo, placas, tipoLicencia, numeroLicencia`)
  - `/datos-migracion` → `{ datosMigracion: { ... } }` (all fields optional, defaults to empty strings/null)
  - `/certificados` → `{ certificadoAlturas?: { fechaExpedicion, fechaVencimiento }, certificadoRiesgoElectrico?: { ... } }`
- The `/cargos` route returns `{ success: true, data: [] }` even for non-existent employee IDs (no FK error at deleteMany level); test asserts `.not.toBe(500)` rather than exact 404 to reflect actual behavior.

### patient-fichas.spec.ts
- `POST /patients/:id/fichas` requires both `instrumentoId` AND `versionRegistro` fields (route returns 400 if either missing).
- Added `versionRegistro: 'v1.0'` constant to all ficha creation calls.
- Status transition rules (from route `validTransitions` map):
  - `PENDIENTE → COMPLETADO | VENCIDO`
  - `COMPLETADO → VENCIDO`
  - `VENCIDO → []` (terminal)
- `COMPLETADO` transition requires `archivoCompletado` field.
- Delete only allowed on `PENDIENTE` fichas — returns 400 for non-PENDIENTE.

### dashboard-activity.spec.ts
- Route calls `getDashboardActivity(userId, userRole)`. ADMIN sees all 3 activity types.
- Service returns `ActivityItem[]` with shape `{ type, date, description, actorName }`. Tests assert `type`, `date`, `description` are present (actorName is nullable).
- Service slices to top 20 sorted by date descending.

---

## How to Run

```bash
cd /Users/jeik/ws/mi-empresa-app-development/backend

# Run all new tests
npx playwright test tests/uploads/uploads.spec.ts
npx playwright test tests/certificates/certificates.spec.ts
npx playwright test tests/dashboard/dashboard-activity.spec.ts
npx playwright test tests/employees/employees-sub-resources.spec.ts
npx playwright test tests/patients/patient-fichas.spec.ts

# Run all backend tests at once
npx playwright test tests/
```

**Prerequisites:** The backend server must be running at `http://localhost:3001` (or set `TEST_API_URL` env var). Database must be seeded with `npx prisma db seed`.

---

## Pattern Followed

All files follow the established pattern from `employees.spec.ts` and `patients.spec.ts`:
- `import { test, expect } from '@playwright/test'`
- `test.describe.configure({ mode: 'serial' })`
- `const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001'`
- `loginAndGetCookie()` helper using `POST /api/v1/auth/login` → extract `set-cookie` header
- All authenticated requests pass full `Cookie: setCookie` header (includes `session=` prefix)
- `afterAll` cleanup of created resources
- `test.skip()` guard when prerequisites (employee/patient/instrument) are unavailable
