# Mi Empresa App - UX/UI Summary

**Last Updated:** 2026-01-10
**Version:** 1.0
**Total Active Screens:** 24
**Status:** Active Production

---

## 1. Application Structure Overview

### 1.1 Main Sections/Modules

Mi Empresa App is an enterprise management system for healthcare facility operations, combining employee management, patient care, evaluation instruments, certifications, and payroll.

| Section | Entry Point | Key Screens | Status | Primary Users |
|---------|-------------|-------------|--------|---------------|
| Dashboard | `dashboard_1.html` | Overview dashboard | Active | All staff |
| Employees | `employees_list_1.html` | List, Profile, Contract, History, 5-step Wizard | Active | Admin, HR Manager |
| Patients | `patients_list_1.html` | List, Profile (4 tabs) | Active | All clinical staff |
| Instrumentos | `instruments_list_1.html` | List, Create, Complete Workflow, Bulk View | Active | Admin, Specialists |
| Certificates | `certificates-v2_1.html` | List, Create, Detail | Active | Admin, Compliance Officer |
| Nómina | Placeholder | - | Planned | Admin, HR |
| Reportes | Placeholder | - | Planned | Admin, Management |
| Configuración | Placeholder | - | Planned | Admin |

### 1.2 Navigation Hierarchy

**Current Sidebar Menu Structure (8 items):**
```
1. Inicio (home) → dashboard_1.html
2. Empleados (users) → employees_list_1.html
3. Pacientes (user) → patients_list_1.html
4. Instrumentos (clipboard-list) → instruments_list_1.html
5. Certificados (file-check) → certificates-v2_1.html
6. Nómina (wallet) → [Placeholder]
7. Reportes (bar-chart) → [Placeholder]
8. Configuración (settings) → [Placeholder]
```

**Navigation Rules:**
- Active menu item shown with purple background (`class="sidebar-item active"`)
- Mobile: Sidebar hidden by default, slides in with overlay backdrop on menu toggle
- Desktop: Sidebar accessible via menu button in header
- All screens include consistent sidebar and top header bar (except wizard flows)

---

## 2. User Flows by Section

### 2.1 Dashboard (Home)

**Entry Point:** `dashboard_1.html`
**User Roles:** All staff
**Status:** Active

**Flow Diagram:**
```
dashboard_1.html (Landing Page)
├── Module Card: "Gestionar Personal" → employees_list_1.html
├── Module Card: "Gestionar Pacientes" → patients_list_1.html
├── Module Card: "Gestionar Instrumentos" → instruments_list_1.html
└── Module Card: "Certificación Empresarial" → certificates-v2_1.html
```

**Key Screens:**

1. **dashboard_1.html**
   - Purpose: Main landing page with quick access to 4 core modules
   - Components: 4 large module cards with icons, stats dashboard, alerts/notifications panel
   - Stats Displayed: Total employees, patients, instruments, certificates
   - Alerts Section: System notifications, pending tasks, expired certificates
   - Links to: All main module list screens

**Business Logic:**
- Dashboard shows role-based content (admin sees everything, specialists see limited modules)
- Alerts prioritized by urgency (red for critical, yellow for warnings)
- Quick actions available on module cards

---

### 2.2 Employee Management

**Entry Point:** `employees_list_1.html`
**User Roles:** Admin, HR Manager
**Status:** Active

**Flow Diagram:**
```
employees_list_1.html (List View)
├── Stats Dashboard (4 cards): Total, Active, On Leave, Awaiting Documents
├── Search & Filter Bar
├── Data Table with Employee Records
│
├── Click "Nuevo Empleado" → employee_new_step_1.html
│   ├── Step 1: Información Básica → employee_new_step_1_2.html
│   ├── Step 2: Datos del Contrato → employee_new_step_1_2_3.html
│   ├── Step 3: Documentos → employee_new_step_1_2_3_4.html
│   ├── Step 4: Contactos de Emergencia → employee_new_step_1_2_3_4_5.html
│   └── Step 5: Revisión Final → Back to employees_list_1.html
│
├── Click Employee Row → employee_profile_1.html
│   ├── Tab: Información Básica (default view)
│   ├── Tab: Historial → employee_history_1.html
│   ├── Tab: Contrato → employee_contract_1.html
│   └── Click "Editar" → employee_edit_1.html → Save → Back to profile
│
└── Click "Ver Contrato" icon → employee_contract_1.html
```

**Key Screens:**

1. **employees_list_1.html**
   - Purpose: Employee directory with search and stats overview
   - Components: Stats cards (4 columns), search bar with filter button, data table
   - Key Actions: Create new employee, view profile, quick view contract
   - Stats: Total (156), Active (142), On Leave (8), Awaiting Documents (6)
   - Table Columns: Name, Position, Department, Contract Type, Status, Actions
   - Links to: employee_new_step_1, employee_profile_1, employee_contract_1

2. **employee_profile_1.html**
   - Purpose: Comprehensive employee details with tabbed interface
   - Components: Profile header card (avatar, name, position, status), 3-tab navigation, detail panels
   - Tabs:
     - "Información Básica" - Personal info, contact, role, department
     - "Historial" - Employment history timeline
     - "Contrato" - Contract terms and documents
   - Key Actions: Edit profile, view contract, view history, back to list
   - Links to: employee_edit_1, employee_contract_1, employee_history_1, employees_list_1

3. **employee_new_step_1.html through step_1_2_3_4_5.html**
   - Purpose: Multi-step wizard for creating new employee record
   - Components: Stepper progress indicator, form sections, Next/Back/Cancel buttons
   - Pattern: No sidebar, top header with back button and breadcrumb
   - Steps:
     - Step 1: Basic info (name, ID, DOB, contact)
     - Step 2: Contract (position, start date, salary, type)
     - Step 3: Documents (upload ID, certifications, background check)
     - Step 4: Emergency contacts (2 required contacts)
     - Step 5: Review all info before final submission
   - Navigation: Back button returns to previous step, Cancel returns to list
   - Links to: Next step in sequence, back to employees_list_1 on completion

4. **employee_edit_1.html**
   - Purpose: Edit existing employee information
   - Components: Form with pre-filled data, Save/Cancel buttons
   - Links to: employee_profile_1 (on save or cancel)

5. **employee_contract_1.html**
   - Purpose: View full contract details and terms
   - Components: Contract document viewer, download button, signature status
   - Links to: employee_profile_1 (back button)

6. **employee_history_1.html**
   - Purpose: Timeline view of employment history events
   - Components: Vertical timeline with date markers, event cards
   - Events: Hire date, promotions, salary changes, leaves, warnings
   - Links to: employee_profile_1 (back button)

**Shared UI Elements:**
- Stats cards (4-column grid with icon, number, label)
- Data table with sortable columns and hover states
- Profile header card (avatar + key info)
- Stepper progress bar (wizard flows)
- Form inputs with validation styling

**Business Logic:**
- Only Admin and HR Manager can create/edit employees
- Contract history is read-only for non-admin users
- Emergency contacts required before completing wizard
- Employee status badge colors: Green (Active), Yellow (On Leave), Red (Inactive)

**Cross-Section Dependencies:**
- Employees → Certificates: Employee certificate assignments and compliance tracking
- Employees → Payroll: Salary and payment processing (future integration)

---

### 2.3 Patient Management

**Entry Point:** `patients_list_1.html`
**User Roles:** All clinical staff
**Status:** Active

**Flow Diagram:**
```
patients_list_1.html (List View)
├── Stats Dashboard (4 cards): Total Patients, Evaluaciones Completas, Pendientes, Fichas Completadas
├── Search Bar
├── Data Table with Patient Records
│
└── Click Patient Row → patient_profile_1.html
    ├── Tab: Información Básica (default view)
    │   - Personal info, contact, allergies, emergency contacts
    ├── Tab: Historia Clínica
    │   - Medical history, diagnoses, treatments, medications
    ├── Tab: Fichas/Evaluaciones
    │   - Evaluation instruments checklist
    │   - Status badges: ✓ Completed, ⚠️ Pending
    │   - Version tracking: v1, v2, v3
    │   - Click "Completar" → patient_complete_instrument_1.html
    └── Tab: Notas
        - Clinical notes, observations, follow-ups
```

**Key Screens:**

1. **patients_list_1.html**
   - Purpose: Patient directory with evaluation metrics overview
   - Components: Stats cards (4 columns), search bar, data table
   - Stats: Total Patients (45), Evaluaciones Completas (38), Pendientes (7), Fichas Completadas (156)
   - Table Columns: Name, RUT, Age, Last Visit, Status, Actions
   - Simplified Design: Clean table without complex expandable rows (v2 improvement)
   - Links to: patient_profile_1

2. **patient_profile_1.html**
   - Purpose: Comprehensive patient record with 4-tab navigation
   - Components: Profile header (gradient background, avatar, name, ID, allergies), 4-tab navigation
   - Tabs:
     - "Información Básica" - Demographics, contact, insurance
     - "Historia Clínica" - Medical records, diagnoses
     - "Fichas/Evaluaciones" - Evaluation instruments status and completion
     - "Notas" - Clinical notes and observations
   - Allergy Alert: Red banner if patient has allergies
   - Key Actions: Edit profile, complete evaluations, add notes
   - Links to: patient_complete_instrument_1 (from Fichas tab)

**Shared UI Elements:**
- Stats cards with evaluation metrics
- Data table component
- Profile header with gradient background
- Tab navigation (4 tabs)
- Badge status indicators (✓, ⚠️)

**Business Logic:**
- All clinical staff can view patient records
- Only assigned specialists can complete evaluations
- Allergy information prominently displayed for safety
- Evaluation status tracked with version numbers

**Cross-Section Dependencies:**
- Patients → Instrumentos: Patient evaluation completion workflows
- Patients → Instrumentos: Specialist bulk view filtered by patient and instrument type

---

### 2.4 Instrumentos (Evaluation Instruments)

**Entry Point:** `instruments_list_1.html`
**User Roles:** Admin (management), Specialists (completion)
**Status:** Active (NEW in v1.0)

**Flow Diagram:**
```
instruments_list_1.html (Admin: Instrument Management)
├── Stats Dashboard (4 cards): Total Instruments, Active, In Use, Completed Forms
├── Data Table: All evaluation instrument templates
│
├── Click "Crear Instrumento" → instrument_create_1.html
│   ├── Form: Name, type, specialist, file upload
│   └── Save → Back to instruments_list_1.html
│
├── Click Row → instrument_create_1.html (edit mode)
│
└── Specialist View Link → instrument_view_by_type_1.html
    ├── Filter by Specialist + Instrument Type
    ├── Data Table: All patients needing this evaluation
    ├── Columns: Patient, Status, Last Completed, Version, Actions
    └── Click "Completar" → patient_complete_instrument_1.html

patient_complete_instrument_1.html (Workflow Screen)
├── Step 1: Download Excel template button
├── Step 2: Instructions panel
├── Step 3: Upload drag-drop area
└── Step 4: Metadata entry form → Save → Back to source screen
```

**Key Screens:**

1. **instruments_list_1.html**
   - Purpose: Admin view for managing evaluation instrument templates
   - Components: Stats cards (4 columns), data table with instrument templates
   - Stats: Total (24), Active (22), In Use (18), Completed Forms (156)
   - Table Columns: Name, Type, Assigned Specialist, Status, Actions
   - Key Actions: Create new instrument, edit existing, view specialist bulk screen
   - Links to: instrument_create_1, instrument_view_by_type_1

2. **instrument_create_1.html**
   - Purpose: Create or edit evaluation instrument template
   - Components: Form with name, type, specialist assignment, Excel file upload
   - Form Fields:
     - Instrument Name (text)
     - Type (dropdown: Nutritional, Psychological, Physical, etc.)
     - Assigned Specialist (dropdown)
     - Template File (Excel upload)
   - Key Actions: Upload template file, assign specialist, save
   - Links to: instruments_list_1 (back button)

3. **patient_complete_instrument_1.html**
   - Purpose: Full-page workflow for completing patient evaluation
   - Pattern: Download → Complete → Upload workflow
   - Components: 4-step numbered process
   - Steps:
     1. Download Excel template button
     2. Instructions panel (how to complete offline)
     3. Upload drag-drop area for completed file
     4. Metadata form (date, notes, version)
   - Key Actions: Download template, upload completed file, save with metadata
   - Links to: Source screen (patient profile or specialist bulk view)

4. **instrument_view_by_type_1.html**
   - Purpose: Specialist bulk work view - all patients needing specific evaluation
   - Components: Filter controls (specialist, instrument type), data table
   - Use Case: Nutritionist completing monthly reports for all patients
   - Table Columns: Patient Name, Status, Last Completed Date, Version, Actions
   - Status Badges: ✓ Completed (green), ⚠️ Pending (yellow)
   - Version Tracking: v1, v2, v3 badges showing revision count
   - Key Actions: Filter by type, complete evaluation for patient
   - Links to: patient_complete_instrument_1 (per patient)

**Shared UI Elements:**
- Stats cards (instrument metrics)
- Data table component
- File upload drag-drop area
- Status badges (✓ completed, ⚠️ pending)
- Version badges (v1, v2, v3)

**Business Logic:**
- Admin creates and manages instrument templates
- Specialists assigned to specific instrument types
- Evaluations completed offline (Excel) then uploaded
- Version tracking for evaluation revisions
- Bulk view enables efficient monthly completion cycles

**Design Pattern Introduced:**
- **Download → Complete → Upload Workflow**: Used for forms requiring external completion

**Cross-Section Dependencies:**
- Instrumentos → Patients: Patient profile "Fichas/Evaluaciones" tab shows status
- Instrumentos → Patients: Completion workflows link back to patient records
- Instrumentos → Dashboard: Evaluation metrics displayed on main dashboard

---

### 2.5 Certificates (Company Certifications)

**Entry Point:** `certificates-v2_1.html`
**User Roles:** Admin, Compliance Officer
**Status:** Active (v2 with consistency fixes)

**Flow Diagram:**
```
certificates-v2_1.html (List View)
├── Stats Dashboard (4 cards): Total, Active, Expiring Soon, Expired
├── Search & Filter Bar
├── Data Table with Certificate Records
│
├── Click "Nuevo Certificado" → certificate-v2_create_1.html
│   ├── Form: Name, Type, Issued By, Expiry, Responsible Employee
│   └── Save → Back to certificates-v2_1.html
│
├── Click Row → certificate-v2_detail_1.html
│   ├── Certificate details display
│   ├── Document viewer/download
│   ├── Click "Edit" → certificate-v2_create_1.html (edit mode)
│   └── Back button → certificates-v2_1.html
│
└── Expiry Alerts: Visual warnings for certificates expiring within 30 days
```

**Key Screens:**

1. **certificates-v2_1.html**
   - Purpose: Company certifications and compliance tracking
   - Components: Stats cards (4 columns), search/filter bar, data table
   - Stats: Total (12), Active (10), Expiring Soon (2), Expired (0)
   - Table Columns: Name, Type, Issued By, Expiry Date, Responsible Employee, Status, Actions
   - Status Colors: Green (Active), Yellow (Expiring Soon), Red (Expired)
   - Key Actions: Create certificate, view details, renewal reminders
   - Links to: certificate-v2_create_1, certificate-v2_detail_1

2. **certificate-v2_create_1.html**
   - Purpose: Create new or edit existing certificate record
   - Components: Form with certificate details, document upload, responsible employee assignment
   - Form Fields: Name, type, issuing authority, issue date, expiry date, responsible employee, document upload
   - Key Actions: Upload certificate document, set expiry reminders, assign responsibility
   - Links to: certificates-v2_1 (back button)

3. **certificate-v2_detail_1.html**
   - Purpose: View complete certificate details and documents
   - Components: Certificate info panel, document viewer, renewal timeline, responsible employee info
   - Key Actions: Download certificate, edit details, set renewal reminder
   - Links to: certificate-v2_create_1 (edit), certificates-v2_1 (back)

**Shared UI Elements:**
- Stats cards (certificate metrics)
- Data table component
- Status badges with color coding
- Document viewer/download component

**Business Logic:**
- Only Admin and Compliance Officer can manage certificates
- Automatic expiry reminders 30 days before expiration
- Visual alerts for expired certificates
- Responsible employee assignment for renewal tracking

**Version Notes:**
- v2 fixes: Standardized sidebar/header structure, consistent navigation menu, corrected JavaScript toggle patterns

**Cross-Section Dependencies:**
- Certificates → Employees: Responsible employee assignment and tracking
- Certificates → Dashboard: Expiry alerts shown on dashboard

---

## 3. Shared UI Components & Cross-Section Elements

### 3.1 Global Navigation

**Sidebar Component:**
- **Structure:** Logo + Company name ("Mi Empresa" / "jeik-sa"), 8 navigation menu items
- **Used in:** All main application screens (except wizard flows)
- **Dimensions:** 280px width, fixed position, slides from left
- **Responsive Behavior:**
  - Desktop: Hidden by default, slides in on menu toggle
  - Mobile: Same behavior with overlay backdrop
- **Active State:** Purple background (`var(--p-primary-500)`) for current page
- **Animation:** 300ms slide-in with ease-out timing

**Top Header Bar:**
- **Used in:** All screens including wizards
- **Left Section:** Menu toggle button + Page title (h1)
- **Right Section:** Notification bell with badge (red dot with count) + User avatar + Username (hidden on mobile)
- **Responsive:** Username text hidden on mobile (`hidden md:inline`)
- **Menu Toggle:** ALWAYS visible on all screen sizes (no `md:hidden`)

### 3.2 Reusable Components Across Sections

| Component | Description | Used In | Visual Style | File Reference |
|-----------|-------------|---------|--------------|----------------|
| **Stats Card** | 4-column grid with icon, number, label | Dashboard, Employees, Patients, Instruments, Certificates | Icon in colored circle, large number (text-3xl), muted label | dashboard_1.html |
| **Data Table** | Sortable table with hover states and row click | Employees, Patients, Instruments, Certificates | Striped rows, hover background, sortable headers with icons | employees_list_1.html |
| **Search + Filter Bar** | Input with search icon + filter dropdown button | Employees, Patients, Instruments, Certificates | Outlined card with icon prefix, filter button on right | patients_list_1.html |
| **Tab Navigation** | Horizontal tabs with active state indicator | Employee Profile (3 tabs), Patient Profile (4 tabs) | Pill-style tabs, purple active state, smooth transition | employee_profile_1.html |
| **Badge Status** | Colored indicators with emoji/icon | All list/table views | Success (green), Warning (yellow), Error (red), Info (blue) | patients_list_1.html |
| **Profile Header Card** | Large header with avatar + key info | Employee Profile, Patient Profile | Employee: white card with avatar left; Patient: gradient background, centered avatar | employee_profile_1.html, patient_profile_1.html |
| **Stepper Progress** | Multi-step wizard indicator | Employee New Wizard (5 steps) | Horizontal timeline with numbered circles, active state highlighted | employee_new_step_1.html |
| **Action Icon Buttons** | Icon-only buttons for table row actions | All data tables | Ghost style, small size, icons: eye, edit, trash, download | instruments_list_1.html |
| **File Upload Area** | Drag-drop zone for file uploads | Instrument Create, Patient Complete Instrument | Dashed border, upload icon, drag-over state highlight | instrument_create_1.html |
| **Module Card** | Large navigation card for dashboard | Dashboard only | Icon + title + description, hover lift animation | dashboard_1.html |
| **Alert/Notification Item** | System notification in panel | Dashboard alerts section | Icon + message + timestamp, hover background | dashboard_1.html |

### 3.3 Cross-Section Interactions

**Employees ↔ Certificates:**
- Employee profile may link to assigned certificates
- Certificate detail screen shows responsible employee with link to profile
- Certificate renewals trigger notifications for responsible employee

**Patients ↔ Instrumentos:**
- Patient profile "Fichas/Evaluaciones" tab displays evaluation status for all instruments
- Clicking "Completar" on patient profile opens instrument completion workflow
- Instrument specialist bulk view shows all patients needing specific evaluation
- Completed evaluations tracked with version numbers (v1, v2, v3)

**Dashboard → All Modules:**
- Dashboard module cards provide direct navigation to each section's list screen
- Dashboard alerts may link to specific records in any module
- Stats on dashboard aggregate data from all sections

**Global Search (Future):**
- Planned: Unified search across employees, patients, certificates from header
- Would display results grouped by section
- Quick navigation to any record from search results

---

## 4. Screen Inventory

### 4.1 Active Production Screens (24 total)

| File | Section | Screen Type | Purpose | Status | Last Modified | Notes |
|------|---------|-------------|---------|--------|---------------|-------|
| `dashboard_1.html` | Dashboard | Dashboard | Main landing with 4 module cards + alerts | Active | 2026-01-08 | Entry point |
| `employees_list_1.html` | Employees | List | Employee directory with stats | Active | 2026-01-10 | Updated nav menu |
| `employee_profile_1.html` | Employees | Profile | Employee details with 3 tabs | Active | 2026-01-10 | Updated nav menu |
| `employee_edit_1.html` | Employees | Edit Form | Edit employee information | Active | 2026-01-10 | Updated nav menu |
| `employee_contract_1.html` | Employees | Detail | View employee contract document | Active | 2026-01-10 | Updated nav menu |
| `employee_history_1.html` | Employees | Timeline | Employment history timeline | Active | 2026-01-10 | Updated nav menu |
| `employee_new_step_1.html` | Employees | Wizard Step 1 | New employee: Basic info | Active | 2026-01-08 | 5-step wizard |
| `employee_new_step_1_2.html` | Employees | Wizard Step 2 | New employee: Contract | Active | 2026-01-08 | Step 2 of 5 |
| `employee_new_step_1_2_3.html` | Employees | Wizard Step 3 | New employee: Documents | Active | 2026-01-08 | Step 3 of 5 |
| `employee_new_step_1_2_3_4.html` | Employees | Wizard Step 4 | New employee: Emergency contacts | Active | 2026-01-08 | Step 4 of 5 |
| `employee_new_step_1_2_3_4_5.html` | Employees | Wizard Step 5 | New employee: Review & submit | Active | 2026-01-08 | Final step |
| `patients_list_1.html` | Patients | List | Patient directory with evaluation stats | Active | 2026-01-10 | Simplified v2 |
| `patient_profile_1.html` | Patients | Profile | Patient details with 4 tabs | Active | 2026-01-10 | Added Fichas tab |
| `instruments_list_1.html` | Instrumentos | List | Instrument templates (admin view) | Active | 2026-01-10 | NEW module |
| `instrument_create_1.html` | Instrumentos | Create/Edit | Create or edit instrument template | Active | 2026-01-10 | File upload |
| `patient_complete_instrument_1.html` | Instrumentos | Workflow | Complete patient evaluation (4-step) | Active | 2026-01-10 | Download→Upload flow |
| `instrument_view_by_type_1.html` | Instrumentos | Bulk View | Specialist view by instrument type | Active | 2026-01-10 | Bulk work mode |
| `certificates-v2_1.html` | Certificates | List | Company certificates list | Active | 2026-01-08 | v2 consistency fixes |
| `certificate-v2_create_1.html` | Certificates | Create/Edit | Create or edit certificate | Active | 2026-01-08 | v2 consistency fixes |
| `certificate-v2_detail_1.html` | Certificates | Detail | View certificate details | Active | 2026-01-08 | v2 consistency fixes |
| `login_1.html` | Auth | Login | User authentication screen | Active | 2026-01-08 | No sidebar |
| `get_started_1.html` | Onboarding | Welcome | Initial setup wizard | Active | 2026-01-08 | No sidebar |
| `theme_toggle_demo_1.html` | Utility | Demo | Light/dark theme demo | Active | 2026-01-08 | Different nav structure |
| `payroll_1.html` | Nómina | Placeholder | Payroll screen placeholder | Active | 2026-01-08 | Full-page layout |

### 4.2 Archived Screens

**Location:** `.superdesign/old_design_iterations/` (or marked with `-old` suffix)

| File | Reason Archived | Date Archived |
|------|-----------------|---------------|
| `patients_list-old_1.html` | Replaced by simplified v2 with evaluation metrics | 2026-01-10 |
| *(Previous patient screens)* | Consolidated into patient_profile_1 tabs | 2026-01-10 |

**Note:** Old patient screens (clinical history, new note, note detail) were consolidated into patient_profile_1.html tabs.

---

## 5. Recent Changes Log

### 2026-01-10 - Patient Module V2: Instrumentos Integration (v1.0)

**What Changed:**
- Added new "Instrumentos" module for evaluation forms (fichas) management
- Enhanced patient profile with "Fichas/Evaluaciones" tab (4th tab)
- Updated navigation menu from 7 to 8 items across all screens
- Simplified patients_list_1.html with evaluation metrics focus

**Screens Added:**
- `instruments_list_1.html` - Admin view for managing instrument templates
- `instrument_create_1.html` - Form to create/edit instrument templates with file upload
- `patient_complete_instrument_1.html` - Full-page workflow (download → complete → upload → metadata)
- `instrument_view_by_type_1.html` - Specialist bulk work view (filter by instrument type)

**Screens Modified:**
- `patient_profile_1.html` - Added 4th tab "Fichas/Evaluaciones" with evaluation status checklist
- `patients_list_1.html` - Cleaned up complex features, added evaluation stats dashboard
- 10 existing screens - Updated navigation menu to include "Instrumentos" item between "Pacientes" and "Certificados"

**Navigation Structure Update:**
- **Before:** 7 menu items (Inicio, Empleados, Pacientes, Certificados, Nómina, Reportes, Configuración)
- **After:** 8 menu items (added "Instrumentos" at position 4)
- **Breaking Change:** All screens must now include "Instrumentos" menu item with clipboard-list icon

**User Flows Updated:**
- **Patient Management:** Added evaluation completion flow from patient profile tab
- **Instrumentos:** New complete flow for managing templates and completing evaluations
  - Admin flow: List → Create/Edit instrument templates
  - Specialist flow: Bulk view (filter by type) → Complete for each patient
  - Patient-centric flow: Patient profile → Fichas tab → Complete specific evaluation

**Design Patterns Introduced:**
- **Download → Complete → Upload Workflow:** Used for Excel-based evaluation forms
  - Step 1: Download template button
  - Step 2: Instructions panel
  - Step 3: Upload drag-drop area
  - Step 4: Metadata entry form
- **Specialist Bulk View:** Table view showing all patients needing specific evaluation type
- **Evaluation Status Badges:** ✓ (completed, green) and ⚠️ (pending, yellow)
- **Version Tracking:** v1, v2, v3 badges for evaluation revisions

**Impact:**
- Total active screens: 20 → 24 (4 new screens)
- Navigation menu items: 7 → 8
- Patient profile tabs: 3 → 4
- New cross-section dependency: Patients ↔ Instrumentos

---

### 2026-01-08 - Certificate Module V2: Fixed Header & Sidebar Consistency

**What Changed:**
- Fixed sidebar structure inconsistencies in certificate screens
- Standardized navigation menu labels and icons across all screens
- Corrected header bar structure (removed incorrect back button and settings icon)
- Unified JavaScript toggle pattern for sidebar

**Screens Modified:**
- `certificate-v2_create_1.html` - Fixed sidebar structure, corrected header
- `certificate-v2_detail_1.html` - Fixed sidebar structure, corrected header

**Problems Fixed:**
1. **Sidebar Structure:**
   - ❌ Before: Using `sidebar-header`, `sidebar-nav`, `sidebar-footer` classes with close button
   - ✅ After: Simple structure with padding wrapper, no close button
2. **Navigation Menu:**
   - ❌ Before: "Dashboard", "Certificación Empresarial", "Gestionar Personal"
   - ✅ After: "Inicio", "Certificados", "Empleados" (consistent with DESIGN_GUIDELINES.md)
3. **Header Elements:**
   - ❌ Before: Back button in header, Settings icon, custom margins
   - ✅ After: Only menu toggle + title (left), bell + user icon + username (right)
4. **JavaScript:**
   - ❌ Before: Separate `openSidebar()` and `closeSidebarFunc()`, `active` class
   - ✅ After: Simple `.toggle()`, `show` class for overlay

**User Flows Updated:**
- None (cosmetic/consistency fixes only)

**Breaking Changes:**
- None (internal consistency improvements)

---

## 6. Design Patterns & Conventions

### 6.1 Active Patterns

**Pattern: Multi-Step Wizard**
- **When to use:** Creating complex entities requiring extensive information (employees, patients, long forms)
- **Components:**
  - Stepper progress bar (numbered circles with connecting lines)
  - Next/Back buttons (prominent Next, outlined Back)
  - Breadcrumb navigation (top of page)
  - Cancel button (returns to list)
- **Navigation:**
  - Back: Previous hierarchy level (`step_1_2_3.html` → `step_1_2.html`)
  - Next: Add hierarchy segment (`step_1_2.html` → `step_1_2_3.html`)
  - Cancel: Return to list screen
- **Visual:** No sidebar, top header with back button
- **Example screens:** `employee_new_step_1.html` through `step_1_2_3_4_5.html`
- **File naming:** `{entity}_new_step_1.html`, `step_1_2.html`, `step_1_2_3.html`, etc.

**Pattern: Tabbed Profile View**
- **When to use:** Displaying entity details with multiple information categories
- **Components:**
  - Profile header card (avatar/photo + name + key info)
  - Horizontal tab navigation (3-4 tabs typical)
  - Tab content panels
- **Tab Order:** First tab is always "Información Básica" (default view)
- **Visual:** Pill-style tabs, purple active state, smooth transitions
- **Example screens:**
  - `employee_profile_1.html` (3 tabs: Básica, Historial, Contrato)
  - `patient_profile_1.html` (4 tabs: Básica, Historia Clínica, Fichas/Evaluaciones, Notas)
- **Best Practice:** 3-4 tabs maximum for optimal UX

**Pattern: List with Stats Dashboard**
- **When to use:** Main listing screens for entities
- **Components:**
  - Stats cards grid (4 columns desktop, 2 tablet, 1 mobile)
  - Search/filter bar below stats
  - Data table with sortable columns
  - Action buttons in header (e.g., "Create New")
- **Stats Layout:** Icon (colored background circle) + Number (large, bold) + Label (small, muted)
- **Example screens:** `employees_list_1.html`, `patients_list_1.html`, `instruments_list_1.html`
- **Consistency:** Always 4 stat cards showing key metrics

**Pattern: Download → Complete → Upload Workflow**
- **When to use:** Forms requiring external completion (Excel files, PDFs)
- **Components:**
  - Numbered step indicators (1, 2, 3, 4)
  - Download button (prominent, with file icon)
  - Instructions panel (how-to text)
  - Upload drag-drop area (dashed border, upload icon)
  - Metadata entry form (date, notes, version)
- **User Flow:** Download template → Complete offline → Upload completed file → Enter metadata → Save
- **Example screens:** `patient_complete_instrument_1.html`
- **Visual:** Full-page workflow, large step numbers, clear progression

**Pattern: Specialist Bulk View**
- **When to use:** Processing multiple items of same type across different entities
- **Components:**
  - Filter controls (dropdowns for specialist, type)
  - Data table showing filtered results
  - Status indicators (completed/pending)
  - Quick action buttons per row
- **Use Case:** Nutritionist completing monthly reports for all patients, Psychologist reviewing evaluations
- **Example screens:** `instrument_view_by_type_1.html`
- **Benefit:** Efficient bulk work, reduces navigation clicks

### 6.2 Component Patterns

**Pattern: Badge Status Indicators**
- **Variants:**
  - Success (✓, green) - Active, Completed
  - Warning (⚠️, yellow) - Expiring Soon, Pending
  - Error (❌, red) - Expired, Inactive
  - Info (ℹ️, blue) - In Progress, Neutral
  - Priority (High/Medium/Low with color coding)
- **Usage:** Table cells, list items, inline status
- **CSS Classes:** `.badge`, `.badge-success`, `.badge-warning`, `.badge-priority-{high|medium|low}`
- **Visual:** Rounded corners, emoji/icon prefix, colored background with border

**Pattern: Action Icon Buttons**
- **Variants:**
  - View (eye icon) - Navigate to detail
  - Edit (pencil icon) - Open edit form
  - Delete (trash icon) - Delete with confirmation
  - Download (download icon) - Export/download file
  - More (vertical dots) - Dropdown menu with additional actions
- **Usage:** Table action columns, card headers
- **CSS Classes:** `.btn-icon`, `.btn-ghost`, `.btn-sm`
- **Visual:** Icon-only, ghost style (transparent), hover background

**Pattern: Responsive Sidebar Navigation**
- **Desktop Behavior:** Hidden by default, slides in on menu toggle click
- **Mobile Behavior:** Same as desktop (hidden, slides in with overlay)
- **Toggle Mechanism:** Menu button (always visible) in top header
- **Overlay Backdrop:** Semi-transparent black with blur, closes sidebar on click
- **Animation:** 300ms slide-in from left with ease-out timing
- **CSS Classes:** `.sidebar`, `.sidebar.open`, `.sidebar-overlay`, `.sidebar-overlay.show`

**Pattern: Data Table with Hover States**
- **Structure:** Thead with sticky headers, tbody with row hover
- **Sorting:** Sortable columns with chevron-up-down icons
- **Row Actions:** Icon buttons in final column
- **Row Click:** Entire row clickable (cursor: pointer) navigates to detail
- **Visual:** Striped rows (alternate light background), hover highlights row
- **Responsive:** Horizontal scroll on mobile (overflow-x: auto on wrapper)

**Pattern: Search + Filter Bar**
- **Structure:** Card wrapper with flex layout
- **Search Input:** Full-width input with search icon prefix (left padding)
- **Filter Button:** Outlined button with filter icon on right side
- **Visual:** Single row, search takes majority width, filter button fixed width
- **Responsive:** Stack vertically on mobile

### 6.3 Deprecated Patterns

**Pattern: Expandable Table Rows**
- **Why Deprecated:** Too complex, poor mobile UX, accessibility issues, difficult to maintain
- **Replaced By:** Click entire row → Navigate to detail page with full information
- **Migration:** Remove expand/collapse logic, make entire row clickable with `onclick="window.location.href='...'"`, add cursor pointer
- **Last Used:** `patients_list-old_1.html` (archived, replaced by simplified v2)
- **Reason:** Simplified user experience, better mobile support, clearer navigation

**Pattern: Inline Dropdown Actions in Tables**
- **Why Deprecated:** Inconsistent across screens, accessibility issues with keyboard navigation, harder to implement consistently
- **Replaced By:** Icon button actions in dedicated column (view, edit, delete visible)
- **Migration:** Replace dropdown with 2-3 icon buttons (eye, pencil, trash), remove dropdown component
- **Last Used:** Certificate screens v1 (replaced in v2)
- **Reason:** More intuitive, better accessibility, consistent interaction pattern

---

## 7. Technical Notes

### 7.1 Design System

**CSS Framework:** `default_ui_theme.css` (PrimeVue-inspired violet/purple palette)
- **Primary Color:** `--p-primary-500: #8b5cf6` (violet)
- **Color Scale:** 50-950 spectrum (`--p-primary-50` through `--p-primary-950`)
- **Theme Support:** Light mode (default) and Dark mode (`html.dark` class)
- **Surface Colors:**
  - Light: `--surface-ground: #f8fafc`, `--surface-card: #ffffff`
  - Dark: `--surface-ground: #0f172a`, `--surface-card: #1e293b`
- **Spacing Scale:** `--spacing-xs` (4px) through `--spacing-3xl` (48px)
- **Border Radius:** `--radius: 0.625rem` (10px)
- **Shadow System:** `--shadow`, `--shadow-sm`, `--shadow-md`, `--shadow-lg`

**Utility Framework:** Tailwind CSS (via CDN)
- **Usage:** Layout utilities (flex, grid), spacing classes, responsive modifiers
- **Loading:** `<script src="https://cdn.tailwindcss.com"></script>`
- **Integration:** Works alongside default_ui_theme.css (no conflicts)

**Icon Library:** Lucide Icons (via CDN)
- **Usage:** `<i data-lucide="icon-name" class="icon"></i>`
- **Initialization:** `lucide.createIcons()` must be called after DOM modifications
- **Loading:** `<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>`
- **Common Icons:** home, users, user, clipboard-list, file-check, wallet, bar-chart, settings, menu, bell, edit, trash, download

**Typography:**
- **Font Stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Font Sizes:** xs (12px), sm (14px), base (16px), lg (18px), xl (20px), 2xl (24px), 3xl (30px), 4xl (36px)
- **Font Weights:** normal (400), medium (500), semibold (600), bold (700)
- **Heading Styles:**
  - h1: text-3xl (30px), font-bold
  - h2: text-2xl (24px), font-bold
  - h3: text-lg (18px), font-semibold

### 7.2 File Naming Conventions

**Standard Format:** `{section}_{screen_type}_{hierarchy}_{iteration}.html`

**Examples:**
- `employees_list_1.html` - First version of employee list
- `employee_profile_1.html` - First version of employee profile (singular)
- `employee_new_step_1.html` - First step of wizard
- `employee_new_step_1_2_3.html` - Third step of wizard (cumulative hierarchy)
- `instruments_list_1.html` - First version of instruments list
- `certificate-v2_create_1.html` - Certificate create screen (v2 redesign)

**Naming Rules:**
- **Section:** Singular form preferred except for list screens (`employee`, not `employees`; but `employees_list`)
- **Screen Type:** `list`, `profile`, `detail`, `edit`, `create`, `new`, `history`, `contract`
- **Hierarchy:** Only for wizard flows (`step_1`, `step_1_2`, `step_1_2_3`)
- **Iteration:** Always starts at `_1`, increment for redesigns (`_2`, `_3`)

**Iterations:**
- **Base Version:** `_1.html` (first approved design)
- **Modal Variants:** `_1_1.html`, `_1_2.html` (alternative states, e.g., modal open)
- **Redesigns:** `_2.html`, `_3.html` (major revisions)
- **Version Prefix:** `certificate-v2_` indicates major version (alternative to iteration suffix)

### 7.3 Navigation Link Patterns

**Sidebar Menu Links:**
```html
<a href="section_list_1.html" class="sidebar-item [active]">
  <i data-lucide="icon-name" class="icon"></i>
  <span>Label</span>
</a>
```
- **Active State:** Add `active` class to current page menu item
- **Icon Size:** Default (16px) with `.icon` class

**Wizard Navigation:**
- **Back Button:** Previous hierarchy level
  - `step_1_2_3.html` back → `step_1_2.html`
- **Next Button:** Add hierarchy segment
  - `step_1_2.html` next → `step_1_2_3.html`
- **Cancel Button:** Return to list screen
  - Any step cancel → `employees_list_1.html`

**Table Row Click:**
```html
<tr onclick="window.location.href='entity_profile_1.html'" style="cursor: pointer;">
  <!-- row content -->
</tr>
```
- Entire row clickable for navigation to detail page
- Cursor changes to pointer on hover

**Back Button (Detail to List):**
```html
<a href="entities_list_1.html" class="btn btn-ghost btn-icon">
  <i data-lucide="arrow-left" class="icon"></i>
</a>
```
- Arrow-left icon indicates return to parent screen

### 7.4 Responsive Breakpoints

**Breakpoint Definitions:**
- **Mobile:** < 768px
  - Sidebar: Hidden, slides in with overlay
  - Stats: 1 column
  - Tables: Horizontal scroll
  - Forms: Single column
- **Tablet:** 768px - 1024px
  - Sidebar: Toggle behavior
  - Stats: 2 columns
  - Forms: May remain single column or 2 columns depending on complexity
- **Desktop:** > 1024px
  - Sidebar: Toggle behavior
  - Stats: 4 columns
  - Forms: 2 columns typical

**Responsive Utilities:**
- Tailwind classes: `hidden`, `md:block`, `lg:grid-cols-4`
- Sidebar always hidden by default, toggle on all screen sizes
- Username in header hidden on mobile: `hidden md:inline`

---

## 8. Future Planned Sections

### 8.1 Nómina (Payroll) Module

**Status:** Placeholder screen exists
**Priority:** Medium
**Planned Screens:**
- `payroll_list_1.html` - Payroll periods list
- `payroll_detail_1.html` - Payroll period details with employee breakdown
- `payroll_employee_detail_1.html` - Individual employee payment detail
- `payroll_generate_1.html` - Generate payroll for period
- `payroll_history_1.html` - Historical payroll records

**Key Features:**
- Monthly payroll generation
- Employee salary breakdown
- Tax calculations
- Payment status tracking
- Export to accounting systems

**Cross-Section Dependencies:**
- Employees: Salary information, contract terms
- Reports: Payroll summary reports

### 8.2 Reportes (Reports) Module

**Status:** Placeholder
**Priority:** Low
**Planned Screens:**
- `reports_list_1.html` - Available reports list
- `report_builder_1.html` - Custom report builder
- `report_view_1.html` - View generated report
- `report_schedule_1.html` - Schedule automated reports

**Key Features:**
- Pre-built report templates
- Custom report builder
- Export to Excel, PDF
- Scheduled automated reports
- Dashboard widgets

**Cross-Section Dependencies:**
- All modules: Aggregate data from employees, patients, instruments, certificates, payroll

### 8.3 Configuración (Settings) Module

**Status:** Placeholder
**Priority:** Low
**Planned Screens:**
- `settings_company_1.html` - Company profile and settings
- `settings_users_1.html` - User management
- `settings_roles_1.html` - Role and permission management
- `settings_integrations_1.html` - Third-party integrations
- `settings_preferences_1.html` - User preferences

**Key Features:**
- Company information management
- User account management
- Role-based access control
- Integration configurations
- System preferences

---

## 9. Performance & Accessibility Notes

### 9.1 Performance Considerations

**Load Times:**
- Target: All screens load in < 2 seconds on 3G connection
- Static HTML prototypes (no server-side rendering delay)
- CSS/JS loaded from CDN with caching

**Resource Loading:**
- **CSS:** default_ui_theme.css (local), Tailwind CDN
- **JavaScript:** Lucide Icons CDN
- **Images:** Placeholder images from external sources (Unsplash, placehold.co)
- **Lazy Loading:** Not yet implemented (static prototypes)

**Optimization Opportunities:**
- Bundle CSS/JS for production
- Implement image lazy loading
- Minify HTML for production builds
- Use service workers for offline support

### 9.2 Accessibility (WCAG 2.1 AA)

**Color Contrast:**
- All text meets minimum contrast ratios
- Primary purple (`#8b5cf6`) tested against white and dark backgrounds
- Status badges use sufficient contrast

**Keyboard Navigation:**
- All interactive elements accessible via Tab key
- Focus states visible on buttons, inputs, links
- Dropdowns accessible via Enter/Space
- Modals trap focus (when implemented)
- Escape key closes modals/dropdowns

**Screen Reader Support:**
- Semantic HTML used (`<nav>`, `<main>`, `<header>`, `<button>`)
- Icon-only buttons should have `aria-label` attributes
- Tables use proper thead/tbody structure
- Form inputs have associated labels
- Status changes announced (when dynamic)

**Accessibility Improvements Needed:**
- Add `aria-label` to icon-only buttons
- Implement focus trap for modals
- Add `role="alert"` for notifications
- Test with screen readers (NVDA, JAWS, VoiceOver)

### 9.3 Responsive Design

**Mobile-First Approach:**
- Sidebar hidden by default on all screen sizes
- Stats cards stack to single column
- Forms switch to single column
- Tables scroll horizontally (overflow-x: auto)

**Touch-Friendly:**
- Button and link targets: Minimum 44x44px
- Adequate spacing between interactive elements
- Swipe gestures not yet implemented

**Breakpoint Strategy:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

---

## 10. Maintenance Guidelines

### 10.1 When to Update This Document

**Always Update After:**
- ✅ Adding or removing screens
- ✅ Changing navigation structure (menu items, order)
- ✅ Creating new user flows or modifying existing flows
- ✅ Adding or deprecating design patterns
- ✅ Modifying shared components used across sections
- ✅ Consolidating or splitting sections
- ✅ Before running `/compact` command (context preservation)

**Minor Updates:**
- Small cosmetic changes: May not require update
- Bug fixes: Document only if pattern changes
- Content changes: Update only if affects user flow

### 10.2 Version Numbering

**Version Format:** `X.Y` (Major.Minor)

**Major Version (X.0):**
- Navigation structure fundamentally changes
- New section/module added to application
- Complete redesign of existing section
- Example: v1.0 → v2.0 when adding Instrumentos module

**Minor Version (X.Y):**
- New screens added to existing section
- User flows modified within existing section
- Existing screens significantly updated
- Design patterns added or deprecated
- Example: v1.2 → v1.3 when adding employee contract screen

**Current Version:** 1.0 (Initial comprehensive documentation)

**Version History:**
- v1.0 (2026-01-10): Initial UX/UI summary covering all 24 active screens, 5 modules, 8 navigation items

### 10.3 Collaboration Notes

**This Document is the Source of Truth For:**
- Current application structure and navigation hierarchy
- Complete screen inventory with status and relationships
- User flow diagrams for all sections
- Design pattern decisions and deprecated patterns
- Historical changes and version tracking
- Cross-section dependencies

**Reference This Document:**
- ✅ Before starting new design work (understand existing patterns)
- ✅ When onboarding to the project (learn application structure)
- ✅ After context compaction (restore design knowledge)
- ✅ When planning new features (identify dependencies)
- ✅ During design reviews (verify consistency)
- ✅ When troubleshooting navigation issues

**Update Workflow:**
1. Complete design work and get user approval
2. Update DESIGN_GUIDELINES.md if patterns changed
3. Run `/ux-summary` command to update this document
4. Review changes for completeness
5. Commit updated documentation with design files

---

## 11. Quick Reference

### 11.1 All Active Screens by Section

**Dashboard (1):** dashboard_1
**Employees (11):** list, profile, edit, contract, history, new_step_1, new_step_1_2, new_step_1_2_3, new_step_1_2_3_4, new_step_1_2_3_4_5
**Patients (2):** list, profile
**Instrumentos (4):** list, create, complete_workflow, view_by_type
**Certificates (3):** list, create, detail
**Utility (3):** login, get_started, theme_toggle_demo, payroll

### 11.2 Common User Journeys

**Create New Employee:**
Dashboard → Employees → "Nuevo Empleado" → 5-step wizard → Back to list

**View Patient Evaluation Status:**
Dashboard → Patients → Click patient row → "Fichas/Evaluaciones" tab

**Complete Patient Evaluation:**
Patient Profile → Fichas tab → "Completar" → Download → Upload → Save

**Specialist Bulk Work:**
Instrumentos → "Vista de Especialista" → Filter by type → Complete for each patient

**Manage Certificates:**
Dashboard → Certificates → Create/Edit/View certificates → Track expiry

### 11.3 Key Design Decisions

- **Navigation:** Sidebar always hidden, toggle on all screen sizes (no desktop-always-visible variant)
- **Tabs:** First tab always "Información Básica", 3-4 tabs maximum
- **Stats Cards:** Always 4 cards in grid layout
- **Wizard Flows:** No sidebar, breadcrumb + back button in header
- **Evaluations:** Download → Complete → Upload workflow for offline work
- **Color Palette:** Violet/purple PrimeVue theme (`#8b5cf6`)

---

**Document Status:** Active Production (v1.0)
**Next Scheduled Review:** After next major feature release or navigation change
**Contact:** Reference DESIGN_GUIDELINES.md for component-level details
