# Mi Empresa App - Master Implementation Plan

**Version:** 1.0
**Date:** 2026-02-17
**Status:** Pending Approval

---

## Decisions Made

| Decision | Choice |
|----------|--------|
| Frontend Language | TypeScript |
| Project Structure | `backend/` + `frontend/` monorepo |
| Database | Docker PostgreSQL (local dev) |
| MVP Scope | All 5 active modules (Dashboard, Employees, Patients, Instruments, Certificates) |
| Authentication | JWT + Session cookies (HTTP-only) |
| File Storage | AWS S3 |
| Node.js Version | 22 LTS |
| Icons | PrimeIcons (primary) |

---

## Technology Stack

### Backend
- **Runtime:** Node.js 22 LTS
- **Framework:** Express.js + TypeScript
- **ORM:** Prisma (PostgreSQL)
- **Auth:** JWT + bcrypt + HTTP-only session cookies
- **Validation:** Zod
- **File Storage:** AWS S3 (pre-signed URLs)
- **Logging:** Winston/Pino
- **Testing:** Vitest + Supertest

### Frontend
- **Framework:** Nuxt 4 (with `app/` directory structure)
- **Language:** TypeScript
- **UI Library:** PrimeVue v4 (Material theme, violet primary, slate surface)
- **CSS:** Tailwind CSS v4 + tailwindcss-primeui
- **State:** Pinia (setup stores)
- **Icons:** PrimeIcons
- **Forms:** PrimeVue form components with Zod validation
- **Testing:** Vitest + @vue/test-utils + Playwright (E2E)

### Infrastructure
- **Database:** PostgreSQL 16 (Docker for dev)
- **Container:** Docker + docker-compose
- **CI/CD:** GitHub Actions (future)

---

## Phase Breakdown

### PHASE 1: Project Foundation (Tasks 1-4)

#### Task 1: Backend Project Initialization
- Initialize Express + TypeScript project in `backend/`
- Configure: tsconfig, eslint, prettier, vitest
- Set up directory structure following reference patterns:
  ```
  backend/
  ├── src/
  │   ├── config/          # database.ts, env.ts, logger.ts
  │   ├── constants/       # enums, upload config
  │   ├── controllers/     # route handlers (thin)
  │   ├── middleware/       # auth.ts, errorHandler.ts, validate.ts
  │   ├── routes/           # route definitions
  │   ├── services/         # business logic
  │   ├── types/            # TypeScript interfaces
  │   ├── utils/            # jwt.ts, validation.ts, s3.ts
  │   ├── generated/prisma/ # Prisma client
  │   ├── app.ts            # Express app setup
  │   └── server.ts         # Server startup
  ├── prisma/
  │   ├── schema.prisma
  │   ├── migrations/
  │   └── seed.ts
  ├── docker-compose.yml    # PostgreSQL
  ├── package.json
  ├── tsconfig.json
  └── .env.example
  ```
- Install core dependencies: express, prisma, zod, bcrypt, jsonwebtoken, cors, helmet, cookie-parser
- Create docker-compose.yml with PostgreSQL 16

#### Task 2: Database Schema (Prisma)
- Translate the 25-entity ERD (schema-v2.md) to Prisma schema
- Add User/Auth tables (USUARIO with roles: Admin, Employee, Auditor, Operator)
- Add Session table for JWT session management
- Define all relationships, indexes, and constraints
- Create initial migration
- Create seed script with sample data

#### Task 3: Frontend Project Initialization
- Initialize Nuxt 4 project in `frontend/`
- **Nuxt 4 directory structure** (using `app/` directory):
  ```
  frontend/
  ├── app/                   # Nuxt 4 source directory
  │   ├── assets/
  │   │   └── css/
  │   │       └── main.css   # Tailwind + custom theme
  │   ├── components/
  │   │   ├── global/        # AppSidebar, AppHeader, AppFooter
  │   │   ├── common/        # StatsCard, DataTable, PageHeader, etc.
  │   │   ├── employee/
  │   │   ├── patient/
  │   │   ├── instrument/
  │   │   └── certificate/
  │   ├── composables/
  │   │   ├── useAuth.ts
  │   │   ├── useApi.ts
  │   │   └── useNotifications.ts
  │   ├── layouts/
  │   │   ├── default.vue     # Main layout (sidebar + header + content)
  │   │   └── auth.vue        # Login/onboarding layout (no sidebar)
  │   ├── middleware/
  │   │   └── auth.ts
  │   ├── pages/
  │   │   ├── index.vue       # Dashboard
  │   │   ├── login.vue
  │   │   ├── get-started.vue
  │   │   ├── empleados/
  │   │   ├── pacientes/
  │   │   ├── instrumentos/
  │   │   └── certificados/
  │   ├── plugins/
  │   │   └── primevue.ts
  │   ├── stores/
  │   │   ├── auth.ts
  │   │   ├── employee.ts
  │   │   ├── patient.ts
  │   │   ├── instrument.ts
  │   │   └── certificate.ts
  │   ├── utils/
  │   ├── app.vue
  │   ├── app.config.ts
  │   └── error.vue
  ├── public/
  ├── shared/                 # Shared types between app and server
  │   └── types/
  ├── server/                 # Nuxt server (API proxy if needed)
  ├── nuxt.config.ts
  ├── tailwind.config.ts
  ├── package.json
  └── tsconfig.json
  ```
- Configure: nuxt.config.ts, PrimeVue, Tailwind CSS v4, Pinia
- Set up theme (violet primary, slate surface, dark mode support)

#### Task 4: Shared Configuration
- Root-level docker-compose.yml (PostgreSQL + optional services)
- Root package.json with workspace scripts
- `.env.example` files for both projects
- Shared TypeScript types (API contracts)

---

### PHASE 2: Authentication & Core Layout (Tasks 5-7)

#### Task 5: Backend Auth Module
- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/logout` - Logout (invalidate session)
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/refresh` - Refresh token
- Auth middleware: JWT validation, role checking
- Error handler middleware
- Session management with database-backed sessions
- Password hashing with bcrypt
- RBAC: Admin, Employee, Auditor, Operator

#### Task 6: Frontend Auth & Login
- Login page (`/login`) matching `login_1.html` design
- Get Started/Onboarding page (`/get-started`) matching `get_started_1.html`
- Auth composable (`useAuth.ts`)
- Auth store (Pinia)
- Auth middleware (route guard)
- Cookie-based session management
- Login form with validation

#### Task 7: Global Layout & Navigation
- **Default layout** (`layouts/default.vue`):
  - Sidebar (280px, hidden by default on mobile, toggle from left)
  - Top header bar (menu toggle, page title, notifications, user menu)
  - Main content area with responsive container
- **Auth layout** (`layouts/auth.vue`): No sidebar, centered content
- **Global components:**
  - `AppSidebar.vue` - 8 menu items with icons, active state, brand logo
  - `AppHeader.vue` - Menu toggle, dynamic page title, notification bell, user dropdown
  - `AppPageHeader.vue` - Page title + breadcrumbs + action buttons
  - `AppStatsCard.vue` - Reusable stat card (icon, value, label, color)
  - `AppStatusBadge.vue` - Status badges (Activo/Inactivo/Pendiente/Vencido)
- Dark/Light theme toggle support with CSS variables
- Responsive breakpoints: mobile (<768px), tablet (768-1024px), desktop (>1024px)

---

### PHASE 3: Dashboard Module (Task 8)

#### Task 8: Dashboard
- **Backend:** `GET /api/v1/dashboard/stats` - Aggregated counts per module
- **Frontend page:** `/` (index.vue) matching `dashboard_1.html`
  - 4 module cards (Empleados, Pacientes, Instrumentos, Certificados)
  - Quick stats per module
  - Navigation to each module
  - Recent activity feed (future)

---

### PHASE 4: Employee Module (Tasks 9-13)

#### Task 9: Backend Employee CRUD
- Routes: `/api/v1/employees`
  - `GET /` - List with pagination, search, filters
  - `GET /:id` - Get employee with relations
  - `POST /` - Create employee (multi-step data)
  - `PUT /:id` - Update employee
  - `DELETE /:id` - Soft delete
- Include: family, emergency contacts, positions, experience, education, vehicles, certifications, migration data
- Service layer with business logic
- Zod validation schemas

#### Task 10: Employee List Page
- Page `/empleados` matching `employees_list_1.html`
- Stats bar (total, active, inactive, new this month)
- DataTable with columns: Name, Document, Position, Status, Actions
- Search, filter by status
- Pagination
- Action buttons: View, Edit, Delete

#### Task 11: Employee Profile Page
- Page `/empleados/[id]` matching `employee_profile_1.html`
- Profile header (photo, name, document, status)
- 3 tabs:
  1. **Informacion Personal** - Personal data, family, emergency contacts
  2. **Experiencia & Educacion** - Work history, education, languages, vehicles
  3. **Certificados & Documentos** - Height/electrical risk certs, migration data
- Quick stats cards
- Edit/Delete actions

#### Task 12: Employee Create Wizard
- Page `/empleados/nuevo` matching `employee_new_step_1..5.html`
- 5-step wizard:
  1. **Datos Personales** - Name, document, gender, DOB, housing, contact
  2. **Nucleo Familiar** - Family members (dynamic add/remove)
  3. **Informacion Laboral** - Position, start date, external experience
  4. **Educacion y Vehiculos** - Education, languages, vehicles
  5. **Certificados y Migracion** - Certifications, migration data
- Progress indicator
- Step validation before proceeding
- Save draft functionality

#### Task 13: Employee Edit & History Pages
- Page `/empleados/[id]/editar` matching `employee_edit_1.html`
- Page `/empleados/[id]/contrato` matching `employee_contract_1.html`
- Page `/empleados/[id]/historial` matching `employee_history_1.html`
- Pre-populated edit form
- Employment timeline

---

### PHASE 5: Patient Module (Tasks 14-16)

#### Task 14: Backend Patient/Client CRUD
- Routes: `/api/v1/patients`
  - `GET /` - List with pagination, search, evaluation metrics
  - `GET /:id` - Get patient with relations, stats
  - `POST /` - Create patient
  - `PUT /:id` - Update patient
  - `DELETE /:id` - Soft delete
- Include: emergency contacts, notes, evaluation records
- Computed stats: total_fichas, pending, overdue, days_since_last_note, positive/negative notes, active alerts

#### Task 15: Patient List Page
- Page `/pacientes` matching `patients_list_1.html`
- Stats bar (total, active, pending evaluations, overdue)
- DataTable with columns: Name, Age, Document, Status, Last Note, Alerts, Actions
- Search, filter
- Color-coded status indicators

#### Task 16: Patient Profile Page
- Page `/pacientes/[id]` matching `patient_profile_1.html`
- Profile header (photo, name, age, document, allergies badge)
- Quick stats (status, days since note, positive/negative notes, alerts)
- 4 tabs:
  1. **Informacion Basica** - Contact info, insurance (EPS), emergency contact
  2. **Historia Clinica** - Medical history
  3. **Fichas/Evaluaciones** - Table of completed/pending instruments with actions
  4. **Notas** - Notes list with type, priority, visibility filtering

---

### PHASE 6: Instruments Module (Tasks 17-19)

#### Task 17: Backend Instruments CRUD
- Routes: `/api/v1/instruments`
  - `GET /` - List instrument templates
  - `GET /:id` - Get instrument with completions
  - `POST /` - Create instrument template
  - `PUT /:id` - Update instrument template
  - `DELETE /:id` - Deactivate
- Routes: `/api/v1/instruments/records`
  - `POST /` - Create completion record (upload file)
  - `PUT /:id` - Update completion record
  - `GET /by-type/:instrumentId` - Get all records for an instrument type
- File upload to S3 (templates and completed files)
- Auto-calculate expiration dates based on periodicidad

#### Task 18: Instruments List & Create Pages
- Page `/instrumentos` matching `instruments_list_1.html` - Admin view of templates
- Page `/instrumentos/crear` matching `instrument_create_1.html` - Create/edit template form
  - Fields: name, code, description, type, periodicity, allowed roles, template file upload
  - Version management

#### Task 19: Instrument Completion & Bulk View
- Page `/pacientes/[id]/completar-instrumento/[instrumentId]` matching `patient_complete_instrument_1.html`
  - Download template → Complete → Upload workflow
  - Version tracking
  - Notes/observations
- Page `/instrumentos/[id]/registros` matching `instrument_view_by_type_1.html`
  - Bulk view: all patients who have completed this instrument
  - Filter by status, date range
  - Specialist work view

---

### PHASE 7: Certificates Module (Tasks 20-21)

#### Task 20: Backend Certificates CRUD
- Routes: `/api/v1/certificates`
  - `GET /` - List with expiry tracking
  - `GET /:id` - Get certificate details
  - `POST /` - Create certificate
  - `PUT /:id` - Update certificate
  - `DELETE /:id` - Delete
- Expiry tracking and alerts
- File upload to S3

#### Task 21: Certificate Pages
- Page `/certificados` matching `certificates-v2_1.html`
  - List with expiry status (valid, expiring soon, expired)
  - Stats bar
  - Filter by type, status
- Page `/certificados/crear` matching `certificate-v2_create_1.html`
  - Create/edit form with file upload
- Page `/certificados/[id]` matching `certificate-v2_detail_1.html`
  - Detail view with download

---

### PHASE 8: Notes & Cross-Module Features (Task 22)

#### Task 22: Notes System
- Backend: `/api/v1/notes`
  - CRUD for patient notes
  - Type classification (Positiva, Negativa, Neutral, Alerta)
  - Priority levels (Alta, Media, Baja)
  - Role-based visibility (Todos, Solo Medicos, Solo Admin)
  - Link to specific fichas or general patient
- Frontend: Notes component (used in Patient Profile tab 4)
  - Create/edit note dialog
  - Notes timeline view
  - Filtering by type, priority, date

---

### PHASE 9: Testing & Polish (Tasks 23-25)

#### Task 23: Backend API Tests
- Unit tests for services (business logic)
- Integration tests for API endpoints (Supertest)
- Auth flow tests
- Database seed for test data

#### Task 24: Frontend E2E Tests (Playwright)
- Login flow
- Employee CRUD flow
- Patient profile navigation
- Instrument completion workflow
- Certificate management
- Navigation and responsive tests

#### Task 25: Final Polish
- Error handling and loading states across all pages
- Toast notifications for CRUD operations
- Responsive design verification
- Dark/light theme verification
- Performance optimization (lazy loading, code splitting)
- Generate final report

---

## Routing Map

| Route | Page | Design File |
|-------|------|-------------|
| `/login` | Login | `login_1.html` |
| `/get-started` | Onboarding | `get_started_1.html` |
| `/` | Dashboard | `dashboard_1.html` |
| `/empleados` | Employee List | `employees_list_1.html` |
| `/empleados/nuevo` | New Employee Wizard | `employee_new_step_1..5.html` |
| `/empleados/[id]` | Employee Profile | `employee_profile_1.html` |
| `/empleados/[id]/editar` | Edit Employee | `employee_edit_1.html` |
| `/empleados/[id]/contrato` | Employee Contract | `employee_contract_1.html` |
| `/empleados/[id]/historial` | Employee History | `employee_history_1.html` |
| `/pacientes` | Patient List | `patients_list_1.html` |
| `/pacientes/[id]` | Patient Profile | `patient_profile_1.html` |
| `/pacientes/[id]/completar-instrumento/[instrumentId]` | Complete Instrument | `patient_complete_instrument_1.html` |
| `/instrumentos` | Instruments List | `instruments_list_1.html` |
| `/instrumentos/crear` | Create Instrument | `instrument_create_1.html` |
| `/instrumentos/[id]/editar` | Edit Instrument | `instrument_create_1.html` |
| `/instrumentos/[id]/registros` | Instrument Records | `instrument_view_by_type_1.html` |
| `/certificados` | Certificates List | `certificates-v2_1.html` |
| `/certificados/crear` | Create Certificate | `certificate-v2_create_1.html` |
| `/certificados/[id]` | Certificate Detail | `certificate-v2_detail_1.html` |
| `/certificados/[id]/editar` | Edit Certificate | `certificate-v2_create_1.html` |

---

## Component Inventory

### Global Components (shared across all screens)
| Component | Description |
|-----------|-------------|
| `AppSidebar` | Navigation sidebar (280px, 8 items, brand logo) |
| `AppHeader` | Top bar (menu toggle, title, notifications, user) |
| `AppPageHeader` | Page title + breadcrumbs + action buttons |
| `AppStatsCard` | Stat display card (icon, value, label) |
| `AppStatusBadge` | Status badge (colored: success/warning/error/info) |
| `AppDataTable` | Wrapper around PrimeVue DataTable with common config |
| `AppConfirmDialog` | Reusable confirmation dialog |
| `AppFileUpload` | S3 file upload component |
| `AppEmptyState` | Empty state placeholder |
| `AppLoadingState` | Loading skeleton/spinner |

### Module-Specific Components
| Module | Components |
|--------|------------|
| Employee | `EmployeeWizard`, `EmployeeWizardStep`, `FamilyMemberForm`, `ExperienceForm`, `EducationForm`, `VehicleForm` |
| Patient | `PatientProfileHeader`, `PatientInfoTab`, `PatientHistoryTab`, `PatientFichasTab`, `PatientNotesTab`, `NoteDialog` |
| Instrument | `InstrumentForm`, `InstrumentCompletionFlow`, `InstrumentRecordsTable` |
| Certificate | `CertificateForm`, `CertificateStatusIndicator`, `ExpiryTimeline` |

---

## Database Tables (Prisma Models)

25 domain entities + 3 auth/system tables = **28 total models**

### Auth/System
1. `Usuario` - Users with roles and credentials
2. `Sesion` - Active sessions
3. `Permiso` - Permissions for RBAC

### Domain (from schema-v2.md)
4-28: All 25 entities as defined in the ERD

---

## API Endpoint Summary

| Module | Endpoints | Description |
|--------|-----------|-------------|
| Auth | 4 | Login, logout, me, refresh |
| Dashboard | 1 | Aggregated stats |
| Employees | 5+ | CRUD + relations |
| Patients | 5+ | CRUD + stats + relations |
| Instruments | 6+ | Templates + records + file uploads |
| Certificates | 5+ | CRUD + expiry tracking |
| Notes | 4+ | CRUD with filtering |
| **Total** | ~30+ | Full API coverage |

---

## Execution Order

Tasks are ordered for maximum parallelism and dependency management:

1. **Tasks 1-4** (Foundation) - Can partially parallelize backend/frontend init
2. **Tasks 5-7** (Auth + Layout) - Backend auth before frontend auth; layout can parallel
3. **Task 8** (Dashboard) - Quick win after layout is done
4. **Tasks 9-13** (Employees) - Largest module, backend before frontend
5. **Tasks 14-16** (Patients) - Similar patterns to employees
6. **Tasks 17-19** (Instruments) - Depends on patients (cross-module)
7. **Tasks 20-21** (Certificates) - Independent, can overlap with instruments
8. **Task 22** (Notes) - Cross-module, best after patients + instruments
9. **Tasks 23-25** (Testing + Polish) - Final phase

---

## Risk Considerations

1. **Nuxt 4 maturity** - Still relatively new; fallback to `compatibilityVersion: 4` in Nuxt 3 if issues arise
2. **S3 setup for dev** - May need MinIO locally if AWS credentials unavailable during dev
3. **File uploads** - Pre-signed URL pattern adds complexity but is more secure
4. **Colombian legal compliance** - Tax calculations and labor law specifics need domain expert validation
5. **24 screens** - Large surface area; prioritize core flows first

---

*Plan generated by Claude Code - Ready for approval*
