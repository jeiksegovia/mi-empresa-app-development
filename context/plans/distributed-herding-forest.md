# Plan: March 9 QA Feedback — Improvements #3.2

## Context

User QA feedback from March 9 identifies 10 improvement areas across the mi-empresa app (Nuxt 4 + PrimeVue frontend, Express + Prisma backend). The app currently has working CRUD for employees, patients, and instruments, plus auth, dashboard stats, and an empresa stub. The previous improvement round (#3.1) completed the SAM serverless deployment + Prisma upgrade.

**Problem:** Multiple UX issues, missing features, and incomplete modules identified during QA testing — sidebar always visible on desktop wastes space, employee edit only covers basic fields (missing 4 sub-resource tabs), patient edit can't manage instruments, certificates module is a stub, dark theme doesn't match design, and several smaller fixes.

**Outcome:** All 10 feedback items implemented with full backend API + frontend UI, tested, and documented.

---

## Feedback Summary (10 items)

| # | Feedback | Category |
|---|----------|----------|
| 1 | Hide sidebar on desktop, only show on mobile hamburger toggle | Frontend |
| 2 | Dashboard activity feed (role-based: employee sees own, admin sees all) | Backend + Frontend |
| 3 | Employee search input padding (icon overlaps text) | Frontend CSS |
| 4 | Employee edit: full 5-tab edit matching creation wizard | Backend + Frontend |
| 5 | Patient edit: add/remove instrument assignments | Backend + Frontend |
| 6 | Instrument status transitions with file attachment upload | Backend + Frontend |
| 7 | Certificates module: company certificates (not "certificados medicos") | Backend + Frontend |
| 8 | Empresa page: admin-only access guard | Frontend |
| 9 | Dark theme: less dark, more violet-tinted (match design mockups) | Frontend CSS |
| 10 | S3 file upload service (presigned URLs) — backend prerequisite | Backend |

---

## Dependency Graph

```
A1 (S3 Upload) ──→ B6 (Instrument file upload)
                └──→ B7b (Certificate file history)

A2 (Cert Schema) ──→ A3 (Cert CRUD API)
                  └──→ B7a/b/c (Cert frontend pages)

A4 (Employee sub-resource CRUD) ──→ B4 (Employee 5-tab edit)

A5 (Patient instrument endpoints) ──→ B5 (Patient instrument UI)

A6 (Dashboard activity endpoint) ──→ B2 (Dashboard activity feed)

No dependencies: B1, B3, B8, B9, A7, A8
```

---

## Execution Phases

### Phase 1: Foundation (parallel tasks, no dependencies)

#### A1: S3 Presigned Upload Service
- **Files:** `backend/src/services/s3Service.ts` (new), `backend/src/routes/uploads.routes.ts` (new), `backend/src/routes/index.ts` (register route)
- **What:** Create `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` service with `generateUploadUrl(key, contentType)` and `generateDownloadUrl(key)`. REST endpoint `POST /api/v1/uploads/presigned-url` returns `{ uploadUrl, key }`. `GET /api/v1/uploads/download-url/:key` returns `{ downloadUrl }`.
- **Config:** Uses existing `config.aws.s3Bucket` and `config.aws.region` from `backend/src/config/env.ts:20-24`
- **Dependencies:** `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
- **Tests:** `backend/tests/uploads/presigned-url.spec.ts`

#### A2: CertificadoEmpresa Prisma Schema + Migration
- **Files:** `backend/prisma/schema.prisma` (add models), run migration
- **New models:**
  - `CertificadoEmpresa` — id, empresaId (FK→Empresa), tipoCertificado (enum), nombre, descripcion, estado (enum: VIGENTE/VENCIDO/PENDIENTE), fechaEmision, fechaVencimiento, archivoUrl (S3 key), creadoPor (FK→Usuario), createdAt, updatedAt
  - `enum TipoCertificadoEmpresa` — RUT, CAMARA_COMERCIO, PERMISO_SANITARIO, PAGO_SEGURIDAD_SOCIAL, OTRO
  - `enum EstadoCertificadoEmpresa` — VIGENTE, VENCIDO, PENDIENTE
- **Relations:** Empresa hasMany CertificadoEmpresa, Usuario hasMany CertificadoEmpresa (creator)
- **Migration:** `npx prisma migrate dev --name add-certificado-empresa`
- **Tests:** Migration runs, seed optional

#### A7: Empresa Route Admin Guard
- **File:** `backend/src/routes/empresa.routes.ts`
- **What:** Add `requireRole('ADMIN')` middleware (already exists in `backend/src/middleware/auth.ts`) to empresa routes
- **Ref:** `authMiddleware()` is already applied; just add `requireRole` import and apply to router
- **Tests:** `backend/tests/empresa/admin-guard.spec.ts`

#### A8: Instrument Status Transition Validation
- **File:** `backend/src/services/instrumentService.ts` or `backend/src/routes/instruments.routes.ts`
- **What:** Validate `EstadoRegistroFicha` transitions: PENDIENTE→COMPLETADO (requires file), PENDIENTE→VENCIDO, COMPLETADO→VENCIDO. Block invalid transitions (e.g. VENCIDO→PENDIENTE). Add `archivoCompletado` field update when transitioning to COMPLETADO.
- **Ref:** `RegistroFichaCompletada` model at `schema.prisma:425-450`, `archivoCompletado` field already exists
- **Tests:** `backend/tests/instruments/status-transition.spec.ts`

#### B1: Hide Sidebar on Desktop
- **Files:** `frontend/app/layouts/default.vue`, `frontend/app/components/AppSidebar.vue`, `frontend/app/components/AppHeader.vue`
- **What:**
  - Remove `md:translate-x-0` from AppSidebar.vue:52 (currently forces sidebar visible on desktop)
  - Remove `md:ml-[280px]` from default.vue:29 (currently pushes content right for sidebar)
  - Remove `md:hidden` from AppHeader.vue hamburger button (currently hidden on desktop)
  - Sidebar should only appear when `visible` prop is true, regardless of viewport
  - Overlay (`bg-black/50`) should show on all viewports when sidebar is open, not just `md:hidden`
- **Tests:** `frontend/tests/e2e/sidebar-desktop-hidden.spec.ts`

#### B3: Employee Search Input Padding Fix
- **Files:** `frontend/app/pages/empleados/index.vue`
- **What:** The search input with a prepended icon has insufficient left padding, causing the icon to overlap text. Add `pl-10` or equivalent to the input field.
- **Tests:** Visual check in existing test suite

#### B8: Empresa Admin-Only Frontend Guard
- **Files:** `frontend/app/pages/empresa/index.vue`
- **What:** Add client-side redirect if `!authStore.isAdmin`. The sidebar already hides the menu item for non-admins (AppSidebar.vue:21), but the page itself needs a guard. Use `navigateTo('/') ` in an onMounted or middleware check.
- **Ref:** `frontend/app/stores/auth.ts` has `isAdmin` getter
- **Tests:** `frontend/tests/e2e/empresa-admin-guard.spec.ts`

#### B9: Dark Theme Violet Tint Fix
- **Files:** `frontend/app/assets/css/main.css`
- **What:** Update `.dark` block (lines 57-67) to use violet-tinted colors matching design mockups at `.superdesign/design_iterations/default_ui_theme.css`:
  - `--surface-ground: #0f172a` → `#1a1625` (dark violet-tinted)
  - `--surface-card: #1e293b` → `#241f31` (violet card)
  - `--surface-section: #1e293b` → `#241f31`
  - `--surface-hover: #334155` → `#352f44` (violet hover)
  - `--surface-border: #334155` → `#3d3550`
  - `--text-color-secondary: #94a3b8` → `#c4b5fd` (match `--p-primary-300` violet)
  - `--muted-foreground: #94a3b8` → `#c4b5fd`
- **Ref:** Design CSS at `.superdesign/design_iterations/default_ui_theme.css` (note: has `html.darks` typo at line 101, should be `html.dark`)
- **Tests:** Visual check, toggle dark mode in browser

---

### Phase 2: Core Backend APIs (depends on Phase 1)

#### A3: Certificate CRUD Routes + Service (depends on A2)
- **Files:** `backend/src/services/certificateService.ts` (new), `backend/src/routes/certificates.routes.ts` (new), `backend/src/routes/index.ts` (register)
- **Endpoints:**
  - `GET /api/v1/certificates` — list with pagination, filter by tipo/estado
  - `GET /api/v1/certificates/:id` — detail
  - `POST /api/v1/certificates` — create (admin only)
  - `PUT /api/v1/certificates/:id` — update
  - `DELETE /api/v1/certificates/:id` — soft delete or hard delete
  - `GET /api/v1/certificates/stats` — counts by estado (for dashboard cards)
- **Validation:** Zod schemas for create/update
- **Auth:** `requireRole('ADMIN')` on write endpoints
- **Tests:** `backend/tests/certificates/crud.spec.ts`

#### A4: Employee Sub-Resource CRUD Endpoints (new or extend existing)
- **File:** `backend/src/routes/employees.routes.ts`
- **What:** The CREATE endpoint already accepts nested arrays (cargos, nucleoFamiliar, contactosEmergencia, experienciasLaborales, educacionIdiomas, vehiculos — see lines 29-89). But the UPDATE endpoint (`PUT /employees/:id`) only updates top-level fields. Need to add sub-resource endpoints:
  - `PUT /employees/:id/cargos` — replace all cargos
  - `PUT /employees/:id/nucleo-familiar` — replace all family members
  - `PUT /employees/:id/contactos-emergencia` — replace all emergency contacts
  - `PUT /employees/:id/experiencias-laborales` — replace all work experience
  - `PUT /employees/:id/educacion-idiomas` — replace all education/languages
  - `PUT /employees/:id/vehiculos` — replace all vehicles
  - `PUT /employees/:id/datos-migracion` — upsert migration data
  - `PUT /employees/:id/certificados` — upsert CertificadoAlturas + CertificadoRiesgoElectrico
- **Strategy:** Each endpoint receives the full array and does a deleteMany + createMany (replace strategy) within a transaction. This is simpler than individual CRUD per item.
- **Tests:** `backend/tests/employees/sub-resources.spec.ts`

#### A5: Patient Instrument Assignment Endpoints (depends on existing schema)
- **File:** `backend/src/routes/patients.routes.ts`
- **What:** Add endpoints to manage RegistroFichaCompletada records for a patient:
  - `POST /patients/:id/fichas` — assign instrument to patient (creates RegistroFichaCompletada with PENDIENTE status)
  - `DELETE /patients/:id/fichas/:fichaId` — remove assignment (only if PENDIENTE)
  - `PATCH /patients/:id/fichas/:fichaId/status` — update status (uses A8 transition validation)
- **Ref:** `RegistroFichaCompletada` model at schema.prisma:425, existing `getPatient` already includes `registrosFichas`
- **Tests:** `backend/tests/patients/fichas.spec.ts`

#### A6: Dashboard Activity Feed Endpoint
- **File:** `backend/src/services/dashboardService.ts`, `backend/src/routes/dashboard.routes.ts`
- **What:** New endpoint `GET /api/v1/dashboard/activity` returning recent activity:
  - Admin: all recent RegistroFichaCompletada changes, new patients, new employees
  - Employee: own RegistroFichaCompletada changes (filter by `responsable = currentUser.id`)
  - Return last 20 items, sorted by date desc
  - Each item: `{ type: 'ficha_completada' | 'patient_created' | 'employee_created', date, description, actorName }`
- **Ref:** `req.user` is set by auth middleware with `id` and `rol` fields
- **Tests:** `backend/tests/dashboard/activity.spec.ts`

---

### Phase 3: Frontend Features (depends on Phase 2 APIs)

#### B2: Dashboard Activity Feed (depends on A6)
- **File:** `frontend/app/pages/index.vue` (dashboard page)
- **What:** Add activity feed section below stats cards. Fetch from `GET /api/v1/dashboard/activity`. Display as a chronological list with icons per type.
- **Tests:** `frontend/tests/e2e/dashboard-activity.spec.ts`

#### B4: Employee 5-Tab Edit Page (depends on A4)
- **File:** `frontend/app/pages/empleados/[id]/editar.vue` (rewrite)
- **What:** Current edit page only has top-level employee fields. Rewrite with 5 tabs matching the creation wizard at `frontend/app/pages/empleados/nuevo.vue`:
  - Tab 1: Datos Personales (existing fields — keep current form)
  - Tab 2: Nucleo Familiar (add/edit/remove family members)
  - Tab 3: Experiencia Laboral + Cargos (work history + current positions)
  - Tab 4: Educacion e Idiomas + Vehiculos
  - Tab 5: Datos Migracion + Certificados (alturas/riesgo electrico)
- **Each tab saves independently** via the sub-resource PUT endpoints from A4
- **Ref:** `frontend/app/pages/empleados/nuevo.vue` has the 5-step wizard UI structure to mirror
- **Tests:** `frontend/tests/e2e/employee-edit-tabs.spec.ts`

#### B5: Patient Instrument Selection in Edit (depends on A5)
- **File:** `frontend/app/pages/pacientes/[id]/editar.vue` (new page) or extend `frontend/app/pages/pacientes/[id]/index.vue`
- **What:** Add ability to assign/remove instruments (fichas) from patient detail view. Show available instruments dropdown, assign button. Show existing fichas with remove button (only if PENDIENTE).
- **Ref:** Patient detail already shows `registrosFichas` list
- **Tests:** `frontend/tests/e2e/patient-fichas.spec.ts`

#### B6: Instrument Status Dialog with File Upload (depends on A1, A8)
- **File:** `frontend/app/pages/pacientes/[id]/index.vue` (status change dialog)
- **What:** Currently the ficha status dialog allows any status change without validation. Enhance:
  - Show only valid transitions (PENDIENTE→COMPLETADO, PENDIENTE→VENCIDO, COMPLETADO→VENCIDO)
  - When transitioning to COMPLETADO, require file upload (use A1 presigned URL service)
  - Upload flow: get presigned URL → upload to S3 → save S3 key with status update
- **Tests:** `frontend/tests/e2e/ficha-status-upload.spec.ts`

#### B7: Certificates Module Pages (depends on A3)
- **B7a:** `frontend/app/pages/certificados/index.vue` — rewrite stub. List certificates with DataTable, stats cards (counts by estado), filters by tipo/estado, "Nuevo Certificado" button. Change subtitle from "certificados medicos" to "Certificados de Empresa".
- **B7b:** `frontend/app/pages/certificados/[id].vue` (new) — detail view with file download link
- **B7c:** `frontend/app/pages/certificados/crear.vue` (new) — create form with tipo dropdown, date pickers, file upload (uses A1)
- **Tests:** `frontend/tests/e2e/certificates.spec.ts`

---

## Critical Files Reference

### Backend (to modify)
| File | Tasks |
|------|-------|
| `backend/prisma/schema.prisma` | A2 |
| `backend/src/config/env.ts` | Already has S3 config (lines 20-24) |
| `backend/src/routes/index.ts` | A1, A3 (register new routes) |
| `backend/src/routes/employees.routes.ts` | A4 |
| `backend/src/routes/patients.routes.ts` | A5 |
| `backend/src/routes/dashboard.routes.ts` | A6 |
| `backend/src/routes/empresa.routes.ts` | A7 |
| `backend/src/routes/instruments.routes.ts` | A8 |
| `backend/src/services/dashboardService.ts` | A6 |

### Backend (new files)
| File | Task |
|------|------|
| `backend/src/services/s3Service.ts` | A1 |
| `backend/src/routes/uploads.routes.ts` | A1 |
| `backend/src/services/certificateService.ts` | A3 |
| `backend/src/routes/certificates.routes.ts` | A3 |

### Frontend (to modify)
| File | Tasks |
|------|-------|
| `frontend/app/layouts/default.vue` | B1 |
| `frontend/app/components/AppSidebar.vue` | B1 |
| `frontend/app/components/AppHeader.vue` | B1 |
| `frontend/app/pages/empleados/index.vue` | B3 |
| `frontend/app/pages/empleados/[id]/editar.vue` | B4 (rewrite) |
| `frontend/app/pages/pacientes/[id]/index.vue` | B5, B6 |
| `frontend/app/pages/certificados/index.vue` | B7a (rewrite stub) |
| `frontend/app/pages/empresa/index.vue` | B8 |
| `frontend/app/assets/css/main.css` | B9 |
| `frontend/app/pages/index.vue` | B2 |

### Frontend (new files)
| File | Task |
|------|------|
| `frontend/app/pages/certificados/[id].vue` | B7b |
| `frontend/app/pages/certificados/crear.vue` | B7c |

---

## Execution Order (Sub-Agents)

```
PHASE 1 — Foundation (parallel, no dependencies)
├── Agent: A1 (S3 service)
├── Agent: A2 (schema) + A7 (empresa guard) + A8 (status validation)
├── Agent: B1 (sidebar) + B3 (search padding) + B8 (empresa FE guard) + B9 (dark theme)
│
PHASE 2 — Core APIs (sequential, depends on Phase 1)
├── Agent: A3 (certificates API) — needs A2
├── Agent: A4 (employee sub-resources)
├── Agent: A5 (patient fichas) + A6 (dashboard activity)
│
PHASE 3 — Frontend Features (depends on Phase 2)
├── Agent: B4 (employee 5-tab edit) — needs A4
├── Agent: B5 (patient instruments) + B6 (ficha status+upload) — needs A5, A1
├── Agent: B7a/b/c (certificates pages) — needs A3
├── Agent: B2 (dashboard activity) — needs A6
│
PHASE 4 — QA + Documentation
├── Full regression test suite
├── context/tasks/{slug}/task-done.md for each task
├── context/plan-implemented/march-9-qa-improvements-implemented.md
```

---

## Task Progress Reporting

Each task reports to `context/tasks/{task-slug}/`:
- `task-details.md` — scope, files changed, approach
- `task-progress.md` — log of iterations and issues
- `task-done.md` — final status, test results

---

## Verification

### Per-task
Each task includes its own test spec. Run with:
```bash
# Backend tests
cd backend && npm run dev & sleep 3
npx playwright test tests/{test-set}/{spec}.spec.ts

# Frontend tests
cd frontend && npm run dev & sleep 5
npx playwright test tests/e2e/{spec}.spec.ts
```

### Full regression after all phases
```bash
# Backend: all existing + new tests
cd backend && npm run dev & sleep 3 && npm run test:api

# Frontend: all e2e tests
cd frontend && npx playwright test tests/e2e/
```

### Manual verification
1. Login as admin → sidebar hidden on desktop → hamburger shows sidebar
2. Dashboard shows activity feed → admin sees all, employee sees own
3. Employee list → search input has proper padding
4. Employee edit → 5 tabs, each saves independently
5. Patient detail → assign instrument → change status with file upload
6. Certificates → list, create, view with file download
7. Empresa page → non-admin redirected
8. Toggle dark mode → violet-tinted surfaces and text
