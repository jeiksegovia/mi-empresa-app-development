# Phase 2B Core APIs — Task Done

**Date**: 2026-03-10
**Tasks**: A4, A5, A6

---

## A4: Employee Sub-Resource CRUD Endpoints

**File**: `backend/src/routes/employees.routes.ts`

**Changes:**
- Added `import { getPrisma } from '../config/database.js'` at the top (top-level import, not inline dynamic import)
- Added 8 new PUT routes after the DELETE `/:id` route, all using replace-strategy in a transaction:
  - `PUT /:id/cargos` — deleteMany + createMany for Cargo
  - `PUT /:id/nucleo-familiar` — deleteMany + createMany for NucleoFamiliar
  - `PUT /:id/contactos-emergencia` — deleteMany + createMany for ContactoEmergenciaEmpleado
  - `PUT /:id/experiencias-laborales` — deleteMany + createMany for ExperienciaLaboralExterna
  - `PUT /:id/educacion-idiomas` — deleteMany + createMany for EducacionIdiomas
  - `PUT /:id/vehiculos` — deleteMany + createMany for Vehiculo
  - `PUT /:id/datos-migracion` — upsert on DatosMigracion (single record per employee)
  - `PUT /:id/certificados` — upsert on CertificadoAlturas + CertificadoRiesgoElectrico (independent optionals)

**Fix applied**: All `parseInt(req.params.id)` calls updated to `parseInt(req.params.id as string)` to satisfy TypeScript strict param typing.

---

## A5: Patient Instrument Assignment Endpoints

**File**: `backend/src/routes/patients.routes.ts`

**Changes:**
- Added `import { getPrisma } from '../config/database.js'` at the top
- Added 3 new ficha management routes after the existing notes route:
  - `POST /:id/fichas` — assigns an instrument to a patient; verifies patient + instrument exist; creates RegistroFichaCompletada with estado=PENDIENTE; returns ficha with instrument details
  - `DELETE /:id/fichas/:fichaId` — removes a ficha assignment; guarded: only PENDIENTE fichas can be deleted
  - `PATCH /:id/fichas/:fichaId/status` — updates ficha estado with transition validation:
    - PENDIENTE -> COMPLETADO or VENCIDO
    - COMPLETADO -> VENCIDO
    - VENCIDO -> (blocked, no transitions)
    - COMPLETADO transition requires `archivoCompletado` in body

**Fix applied**: All `parseInt(req.params.id)` and `parseInt(req.params.fichaId)` updated to include `as string` cast. Also fixed the pre-existing notes route (line 146) which had the same issue.

---

## A6: Dashboard Activity Feed Endpoint

**File**: `backend/src/services/dashboardService.ts`

**Changes:**
- Added `ActivityItem` interface exported from service
- Added `getDashboardActivity(userId, userRole)` function:
  - ADMIN role: fetches last 10 fichas (with instrument + patient + responsible user), last 5 patients, last 5 employees — merged and sorted by date desc, top 20
  - Non-admin: fetches only fichas where `responsable === userId`, last 20, sorted by date
  - Returns unified `ActivityItem[]` array with type discriminator

**File**: `backend/src/routes/dashboard.routes.ts`

**Changes:**
- Updated import: `getDashboardStats` -> `{ getDashboardStats, getDashboardActivity }`
- Added `GET /activity` route using `authMiddleware()` inline (consistent with `/stats` pattern)
- Route reads `req.user!.id` and `req.user!.rol` for role-based activity scoping

---

## Deviations / Notes

- Replaced inline `await import('../config/database.js')` pattern (from spec) with top-level `import { getPrisma }` since the module is already used as a top-level import pattern throughout the codebase (see `dashboardService.ts`)
- TypeScript strict mode required `as string` casts on `req.params.*` — applied consistently
- TypeScript compile: `npx tsc --noEmit` passes with zero errors after fixes
