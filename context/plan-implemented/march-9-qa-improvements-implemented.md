# Plan Implemented: March 9 QA Feedback — Improvements #3.2

**Date**: 2026-03-10
**Plan file**: `context/plans/distributed-herding-forest.md`

---

## High-Level Overview

All 10 QA feedback items implemented across 4 execution phases. Backend: S3 upload service, certificates CRUD API, employee sub-resource endpoints, patient fichas endpoints, dashboard activity feed endpoint. Frontend: sidebar/CSS fixes, full employee 5-tab edit, patient instrument assignment + status transition with file upload, certificates module (list/detail/create), dashboard activity feed.

---

## Phase 1 — Foundation (all parallel)

### A1: S3 Presigned Upload Service
- **New**: `backend/src/services/s3Service.ts` — `generateUploadUrl(key, contentType, expiresIn=300)`, `generateDownloadUrl(key, expiresIn=3600)`
- **New**: `backend/src/routes/uploads.routes.ts` — `POST /uploads/presigned-url`, `GET /uploads/download-url`
- **Modified**: `backend/src/routes/index.ts` — registered upload routes
- **Dep**: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` installed
- **Note**: Used `crypto.randomUUID()` (Node 18+ built-in), no `uuid` package needed

### A2: CertificadoEmpresa Prisma Schema
- **Modified**: `backend/prisma/schema.prisma` — added `CertificadoEmpresa` model, `TipoCertificadoEmpresa` enum, `EstadoCertificadoEmpresa` enum
- **Note**: DB offline during work; used `prisma generate` as fallback (migration pending when DB available)

### A7: Empresa Route Admin Guard
- **Modified**: `backend/src/routes/empresa.routes.ts` — added `requireRole('ADMIN')` to GET and PUT; removed inline `user.rol !== 'ADMIN'` check

### A8: Instrument Status Transition Validation
- **Modified**: `backend/src/services/instrumentService.ts` `updateRecord` — state machine: PENDIENTE→COMPLETADO (requires archivoCompletado), PENDIENTE→VENCIDO, COMPLETADO→VENCIDO; VENCIDO is terminal

### B1: Hide Sidebar on Desktop
- **Modified**: `frontend/app/layouts/default.vue` — removed `md:ml-[280px]`
- **Modified**: `frontend/app/components/AppSidebar.vue` — removed `md:translate-x-0` (line 52), removed `md:hidden` from overlay (line 115)
- **Modified**: `frontend/app/components/AppHeader.vue` — removed `class="md:hidden"` from hamburger button

### B3: Employee Search Padding
- **Verified**: `pl-10` already present in `frontend/app/pages/empleados/index.vue` — no change needed

### B8: Empresa Admin-Only Frontend Guard
- **Modified**: `frontend/app/pages/empresa/index.vue` `onMounted` — added `if (!authStore.isAdmin) { await navigateTo('/'); return }`

### B9: Dark Theme Violet Tint
- **Modified**: `frontend/app/assets/css/main.css` `.dark` block — slate colors → violet-tinted: `--surface-ground: #1a1625`, `--surface-card: #241f31`, `--surface-hover: #352f44`, `--surface-border: #3d3550`, `--text-color-secondary: #c4b5fd`, `--muted-foreground: #c4b5fd`

---

## Phase 2 — Core APIs

### A3: Certificate CRUD API (depends A2)
- **New**: `backend/src/services/certificateService.ts` — `listCertificates`, `getCertificate`, `createCertificate`, `updateCertificate`, `deleteCertificate`, `getCertificateStats`
- **New**: `backend/src/routes/certificates.routes.ts` — GET /stats, GET /, GET /:id, POST / (admin), PUT /:id (admin), DELETE /:id (admin)
- **Modified**: `backend/src/routes/index.ts` — registered certificate routes

### A4: Employee Sub-Resource CRUD (8 new PUT routes)
- **Modified**: `backend/src/routes/employees.routes.ts` — added PUT /:id/cargos, /nucleo-familiar, /contactos-emergencia, /experiencias-laborales, /educacion-idiomas, /vehiculos (all replace-strategy: $transaction deleteMany+createMany), /datos-migracion (upsert), /certificados (upsert CertificadoAlturas + CertificadoRiesgoElectrico)
- **Fix**: All `parseInt(req.params.id)` → `parseInt(req.params.id as string)` for TypeScript strict compliance

### A5: Patient Fichas Endpoints
- **Modified**: `backend/src/routes/patients.routes.ts` — added POST /:id/fichas, DELETE /:id/fichas/:fichaId (PENDIENTE only), PATCH /:id/fichas/:fichaId/status (state machine validation + archivoCompletado requirement)
- **Fix**: Same parseInt cast fix applied to new and pre-existing routes

### A6: Dashboard Activity Feed Endpoint
- **Modified**: `backend/src/services/dashboardService.ts` — added `getDashboardActivity(userId, userRole)`: ADMIN sees all recent fichas/patients/employees (last 20 merged+sorted); employee sees own fichas only
- **Modified**: `backend/src/routes/dashboard.routes.ts` — added `GET /activity` route

---

## Phase 3 — Frontend Features

### B2: Dashboard Activity Feed
- **Modified**: `frontend/app/pages/index.vue` — replaced hardcoded `recentActivities` array with live `fetchActivities()` calling `GET /dashboard/activity`; type-based icons (ficha_completada=pi-file-check/green, patient_created=pi-user/blue, employee_created=pi-user-plus/violet); loading spinner; "Sin actividad reciente" empty state

### B4: Employee 5-Tab Edit
- **Rewritten**: `frontend/app/pages/empleados/[id]/editar.vue` — full 5-tab structure (Datos Personales, Nucleo Familiar, Info. Laboral, Educacion, Certificados); each tab saves independently; `v-show` (not `v-if`) preserves state between tabs; Tab 3 saves 3 endpoints via `Promise.all`; `fetchEmployee()` hydrates all tabs on mount

### B5: Patient Instrument Assignment
- **Modified**: `frontend/app/pages/pacientes/[id]/index.vue` — added "Asignar Instrumento" card in Tab 1 (Fichas): filterable Select from `GET /instruments?estado=ACTIVO`, button calls `POST /patients/:id/fichas`; Delete button (PENDIENTE only) calls `DELETE /patients/:id/fichas/:fichaId`; per-row loading via `deletingFichaId`

### B6: Ficha Status Dialog with File Upload
- **Modified**: `frontend/app/pages/pacientes/[id]/index.vue` — replaced old free-form dialog with transition-aware dialog; computed `availableTransitions`/`transitionOptions`/`requiresFileUpload`; file upload flow: POST /uploads/presigned-url → PUT S3 uploadUrl → PATCH /fichas/:id/status; VENCIDO shows terminal-state message, submit disabled

### B7a: Certificates List Page
- **Rewritten**: `frontend/app/pages/certificados/index.vue` — stats cards (VIGENTE/VENCIDO/PENDIENTE/Total), DataTable with tipo/estado filters + search, admin-only "Nuevo Certificado" + Delete buttons, subtitle changed to "Certificados de empresa"

### B7b: Certificate Detail Page
- **New**: `frontend/app/pages/certificados/[id].vue` — loads `GET /certificates/:id`; view mode with all fields; "Descargar Archivo" button fetches presigned download URL; admin inline edit mode with PUT /certificates/:id

### B7c: Certificate Create Form
- **New**: `frontend/app/pages/certificados/crear.vue` — form with nombre, tipoCertificado, fechas, descripcion; drag-click file upload via presigned URL flow; POST /certificates on submit

---

## Key Issues Resolved

| Issue | Fix |
|-------|-----|
| DB offline during A2 migration | Used `prisma generate` to validate schema; migration SQL pending DB availability |
| `uuid` package missing from package.json | Used Node 18+ built-in `crypto.randomUUID()` |
| TypeScript error: `string \| string[]` on `req.params.*` | Added `as string` cast to all `parseInt(req.params.*)` calls in employees + patients routes |
| Pre-existing TS error in patients.routes.ts line 146 | Fixed as part of A5 (same parseInt cast pattern) |

---

## Pending After Implementation

- Run `npx prisma migrate dev --name add-certificado-empresa` when DB is available to create `certificados_empresa` table
- Verify S3 credentials/IAM role are configured on the deploy target before testing file upload features

---

## Phase 4 — QA Tests (2026-03-10)

### Backend Tests (5 new files)

| File | Tests | Key validations |
|------|-------|-----------------|
| `backend/tests/uploads/uploads.spec.ts` | 7 | presigned-url returns `{ uploadUrl, key }`, download-url returns `{ downloadUrl }`, 401 without auth, 400 missing params |
| `backend/tests/certificates/certificates.spec.ts` | 11 | stats, list+filters, full CRUD lifecycle, 403 non-admin on POST |
| `backend/tests/dashboard/dashboard-activity.spec.ts` | 6 | 401 without auth, response shape `{ type, date, description }`, valid known types, max 20 items, desc sort |
| `backend/tests/employees/employees-sub-resources.spec.ts` | 11 | all 8 PUT sub-resource routes, 401, 404 invalid id |
| `backend/tests/patients/patient-fichas.spec.ts` | 10 | POST assign, PENDIENTE→VENCIDO, COMPLETADO requires archivoCompletado, VENCIDO terminal state, DELETE PENDIENTE-only |

**Body shape discoveries from reading routes:**
- `POST /fichas` requires both `instrumentoId` AND `versionRegistro` (not just instrumentoId)
- Sub-resource routes wrap arrays in named keys: `{ cargos: [...] }`, `{ nucleoFamiliar: [...] }`, etc.
- `PUT /datos-migracion` wraps under `{ datosMigracion: { ... } }`
- Certificates `createCertificateSchema` requires `empresaId` — seeded empresa id 1 used

### Frontend Tests (5 new + 3 updated)

| File | Lines | Covers |
|------|-------|--------|
| `frontend/tests/e2e/certificados.spec.ts` | 73 | List title, stats cards (Vigentes/Vencidos/Pendientes/Total), DataTable, Tipo+Estado filters, Nuevo button |
| `frontend/tests/e2e/certificado-crear.spec.ts` | 79 | Form fields visible, submit validation errors ("El nombre es requerido", "El tipo es requerido"), Cancelar nav |
| `frontend/tests/e2e/certificado-detalle.spec.ts` | 149 | Navigate via pi-eye icon, estado tag, type/date labels, Editar button, Volver nav; `test.skip` if list empty |
| `frontend/tests/e2e/dashboard-activity.spec.ts` | 74 | "Actividad Reciente" heading, activity items present OR empty state, no blocking JS errors |
| `frontend/tests/e2e/paciente-fichas.spec.ts` | 205 | Fichas tab, instrument Select, Asignar button, Historial section, PENDIENTE delete button, status dialog open/close |
| `frontend/tests/e2e/empleado-editar.spec.ts` | +79 appended | 5 tab buttons, tab switching reveals Agregar Miembro, save button per tab |
| `frontend/tests/e2e/empresa.spec.ts` | +33 appended | Admin stays on /empresa; non-admin test skipped (no employee credentials configured) |
| `frontend/tests/e2e/layout.spec.ts` | +85 appended | 1280px hamburger visible, sidebar initially -translate-x-full, toggle opens, overlay click closes |

**Selector strategies:**
- PrimeVue Select: `.p-select` filtered by `hasText` placeholder
- Tab buttons: `getByRole('button', { name: 'Exact Label' })` — labels from `tabs[]` array in Vue source
- Icons: `.pi-eye`, `.pi-pencil`, `.pi-trash` class selectors
- Sidebar state: `evaluate(el => el.classList.contains('-translate-x-full'))`
- Dialog: `[role="dialog"]` ARIA role

**Task reports:**
- `context/tasks/phase-4-backend-tests/task-done.md`
- `context/tasks/phase-4-frontend-tests/task-done.md`

---

## grep searchability tags
`S3-presigned-url` `CertificadoEmpresa` `sidebar-mobile-only` `employee-5-tab-edit` `patient-ficha-assignment` `ficha-status-transition` `certificates-module` `empresa-admin-guard` `dark-violet-theme` `dashboard-activity-feed` `sub-resource-replace-strategy` `state-machine-PENDIENTE-COMPLETADO-VENCIDO` `QA-playwright-tests` `backend-tests-phase4` `frontend-tests-phase4` `presigned-url-tests` `certificate-crud-tests` `dashboard-activity-tests` `employee-sub-resource-tests` `patient-fichas-tests`
