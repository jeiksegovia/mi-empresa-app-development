# [App Name] - UX/UI Summary

**Last Updated:** YYYY-MM-DD
**Version:** 1.0
**Total Screens:** 0
**Status:** Template

---

## 1. Application Structure Overview

### 1.1 Main Sections/Modules

| Section | Entry Point | Key Screens | Status | User Roles |
|---------|-------------|-------------|--------|------------|
| Dashboard | `dashboard_1.html` | Dashboard | Active | All |
| Example Module | `example_list_1.html` | List, Detail, Create | Active | Admin, User |

### 1.2 Navigation Hierarchy

**Current Menu Structure (8 items):**
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
- Active state shown with `class="sidebar-item active"`
- Mobile: Sidebar hidden by default, toggle with menu button
- Desktop: Sidebar visible on hover/click

---

## 2. User Flows by Section

### 2.1 [Section Name] (e.g., Employee Management)

**Entry Point:** `employees_list_1.html`
**User Roles:** Admin, HR Manager
**Status:** Active

**Flow Diagram:**
```
employees_list_1.html (List View)
├── Click "New Employee" → employee_new_step_1.html
│   ├── Step 1: Basic Info → employee_new_step_1_2.html
│   ├── Step 2: Contract → employee_new_step_1_2_3.html
│   ├── Step 3: Documents → employee_new_step_1_2_3_4.html
│   ├── Step 4: Emergency → employee_new_step_1_2_3_4_5.html
│   └── Step 5: Review → Back to employees_list_1.html
│
├── Click Employee Row → employee_profile_1.html
│   ├── Tab: Basic Info (default)
│   ├── Tab: Contract → Inline edit or employee_contract_1.html
│   ├── Tab: History → employee_history_1.html
│   └── Click "Edit" → employee_edit_1.html
│
└── Click "View Contract" → employee_contract_1.html
```

**Key Screens:**

1. **employees_list_1.html**
   - Purpose: List all employees with search/filter
   - Key Actions: Create new, view profile, quick actions
   - Shared Elements: Data table, search bar, stats cards
   - Links to: employee_new_step_1, employee_profile_1

2. **employee_profile_1.html**
   - Purpose: View employee details with tabbed navigation
   - Key Actions: Edit, view contract, view history
   - Shared Elements: Tab navigation, profile header card
   - Links to: employee_edit_1, employee_contract_1, employee_history_1

3. **employee_new_step_1.html → step_1_2_3_4_5**
   - Purpose: Multi-step wizard for creating new employee
   - Key Actions: Next/Back navigation, form validation
   - Shared Elements: Stepper component, form inputs
   - Links to: Next step in sequence, back to list on completion

**Shared UI Elements:**
- Stats cards (used in: dashboard, employees, patients, certificates)
- Data table component (used in: employees, patients, instruments)
- Profile header card (used in: employee_profile, patient_profile)

**Business Logic:**
- Only Admin and HR Manager can create new employees
- Contract history is read-only for non-admin users
- Emergency contacts required before completing wizard

**Cross-Section Dependencies:**
- Employees → Certificates: Employee certificate assignments
- Employees → Payroll: Salary and payment processing (future)

---

### 2.2 [Another Section] (e.g., Patient Management)

**Entry Point:** `patients_list_1.html`
**User Roles:** All staff
**Status:** Active

**Flow Diagram:**
```
patients_list_1.html (List View)
├── Click Patient Row → patient_profile_1.html
│   ├── Tab: Información Básica
│   ├── Tab: Historia Clínica
│   ├── Tab: Fichas/Evaluaciones → instrument flows
│   └── Tab: Notas
│
└── Stats Dashboard
    ├── Total Pacientes: 45
    ├── Evaluaciones Completas: 38
    ├── Evaluaciones Pendientes: 7
    └── Fichas Completadas: 156
```

**Key Screens:**
[Similar detail as above]

---

## 3. Shared UI Components & Cross-Section Elements

### 3.1 Global Navigation

**Sidebar Component:**
- Used in: All main application screens (except wizard flows)
- Structure: Logo + Company name, 8 menu items, responsive toggle
- Active state: Purple background (`var(--p-primary-500)`)
- Mobile: Slide-in with overlay backdrop

**Top Header Bar:**
- Used in: All screens including wizards
- Left side: Menu toggle (mobile) + Page title
- Right side: Notification bell (with badge) + User avatar + Username
- Responsive: Username hidden on mobile

### 3.2 Reusable Components Across Sections

| Component | Description | Used In | File Reference |
|-----------|-------------|---------|----------------|
| Stats Card | 4-column grid with icon, number, label | Dashboard, Employees, Patients, Certificates | dashboard_1.html:204 |
| Data Table | Sortable table with hover states | Employees, Patients, Instruments, Certificates | employees_list_1.html:234 |
| Search + Filter Bar | Input with icon + dropdown filters | Employees, Patients, Instruments | patients_list_1.html:266 |
| Tab Navigation | Horizontal tabs with active state | Employee Profile, Patient Profile | employee_profile_1.html:185 |
| Badge | Colored status indicators | All list/table views | patients_list_1.html:323 |
| Profile Header Card | Avatar + name + key info | Employee/Patient profiles | employee_profile_1.html:142 |
| Stepper Progress | Multi-step wizard indicator | Employee New Wizard | employee_new_step_1.html:98 |
| Action Buttons | Icon buttons for table actions | All tables | instruments_list_1.html:287 |

### 3.3 Cross-Section Interactions

**Employees ↔ Certificates:**
- Employee profile links to assigned certificates
- Certificate screen shows responsible employee

**Patients ↔ Instrumentos:**
- Patient profile has "Fichas/Evaluaciones" tab
- Instrument screens link back to patient profile
- Specialist view filters by instrument type across all patients

**Global Search (Future):**
- Planned: Search across employees, patients, certificates from header

---

## 4. Screen Inventory

### 4.1 Active Screens

| File | Section | Screen Type | Purpose | Status | Last Modified | Notes |
|------|---------|-------------|---------|--------|---------------|-------|
| `dashboard_1.html` | Dashboard | Dashboard | Main landing page with 4 module cards | Active | 2026-01-08 | Entry point |
| `employees_list_1.html` | Employees | List | Employee directory with search | Active | 2026-01-08 | Has stats cards |
| `employee_profile_1.html` | Employees | Detail/Profile | Employee details with tabs | Active | 2026-01-08 | 3 tabs |
| `employee_edit_1.html` | Employees | Edit Form | Edit employee information | Active | 2026-01-08 | - |
| `employee_contract_1.html` | Employees | Detail | View employee contract | Active | 2026-01-08 | - |
| `employee_history_1.html` | Employees | Timeline | Employee history log | Active | 2026-01-08 | - |
| `employee_new_step_1.html` | Employees | Wizard Step 1 | New employee: Basic info | Active | 2026-01-08 | 5-step wizard |
| `employee_new_step_1_2.html` | Employees | Wizard Step 2 | New employee: Contract | Active | 2026-01-08 | - |
| `employee_new_step_1_2_3.html` | Employees | Wizard Step 3 | New employee: Documents | Active | 2026-01-08 | - |
| `employee_new_step_1_2_3_4.html` | Employees | Wizard Step 4 | New employee: Emergency | Active | 2026-01-08 | - |
| `employee_new_step_1_2_3_4_5.html` | Employees | Wizard Step 5 | New employee: Review | Active | 2026-01-08 | Final step |
| `patients_list_1.html` | Patients | List | Patient directory with evaluation stats | Active | 2026-01-10 | Simplified v2 |
| `patient_profile_1.html` | Patients | Detail/Profile | Patient details with 4 tabs | Active | 2026-01-10 | Includes Fichas tab |
| `certificates-v2_1.html` | Certificates | List | Company certificates list | Active | 2026-01-08 | v2 with consistent nav |
| `certificate-v2_create_1.html` | Certificates | Create Form | Add new certificate | Active | 2026-01-08 | - |
| `certificate-v2_detail_1.html` | Certificates | Detail | View certificate details | Active | 2026-01-08 | - |
| `instruments_list_1.html` | Instrumentos | List | Evaluation instruments management | Active | 2026-01-10 | New module |
| `instrument_create_1.html` | Instrumentos | Create/Edit Form | Create/edit instrument template | Active | 2026-01-10 | File upload |
| `patient_complete_instrument_1.html` | Instrumentos | Workflow | Complete patient evaluation | Active | 2026-01-10 | 4-step process |
| `instrument_view_by_type_1.html` | Instrumentos | List/Table | Specialist view by instrument | Active | 2026-01-10 | Bulk work mode |

### 4.2 Utility/Demo Screens

| File | Purpose | Notes |
|------|---------|-------|
| `login_1.html` | Login screen | No sidebar |
| `get_started_1.html` | Onboarding | No sidebar |
| `theme_toggle_demo_1.html` | Theme system demo | Different nav structure |
| `payroll_1.html` | Payroll placeholder | Full-page layout |

### 4.3 Archived Screens

Location: `.superdesign/old_design_iterations/`

| File | Reason Archived | Date |
|------|-----------------|------|
| `patient_clinical_history_1.html` | Replaced by patient_profile tabs | 2026-01-10 |
| `patient_new_note_1.html` | Replaced by patient_profile tabs | 2026-01-10 |
| `patient_note_detail_1.html` | Replaced by patient_profile tabs | 2026-01-10 |
| `patient_profile_1.html` (old) | Updated with Fichas tab | 2026-01-10 |
| `patients_list_1.html` (old) | Simplified version created | 2026-01-10 |

---

## 5. Recent Changes Log

### 2026-01-10 - Patient Module V2: Instrumentos Integration

**What Changed:**
- Added new "Instrumentos" module for evaluation forms (fichas) management
- Enhanced patient profile with "Fichas/Evaluaciones" tab
- Updated navigation menu from 7 to 8 items across all screens
- Simplified patients_list_1.html with evaluation metrics

**Screens Added:**
- `instruments_list_1.html` - Admin view for managing instrument templates
- `instrument_create_1.html` - Form to create/edit instruments
- `patient_complete_instrument_1.html` - Full-page workflow (download → complete → upload)
- `instrument_view_by_type_1.html` - Specialist bulk work view

**Screens Modified:**
- `patient_profile_1.html` - Added 4th tab "Fichas/Evaluaciones" with evaluation checklist
- `patients_list_1.html` - Cleaned up complex features, added stats dashboard
- 10 existing screens - Updated navigation menu to include "Instrumentos" item

**User Flows Updated:**
- Patient Management: Added evaluation completion flow
- Instruments: New complete flow for managing templates and evaluations

**Breaking Changes:**
- Navigation menu structure changed (7 → 8 items)
- All screens must include "Instrumentos" menu item between "Pacientes" and "Certificados"

**Design Patterns:**
- Download → Complete → Upload workflow pattern established
- Evaluation status badges: ✓ (completed) and ⚠️ (pending)
- Version tracking badges: v1, v2, v3 for evaluation revisions

---

### 2026-01-08 - Certificate Module V2: Fixed Header & Sidebar Consistency

**What Changed:**
- Fixed sidebar structure inconsistencies in certificate screens
- Standardized navigation menu labels and icons
- Corrected header bar structure (removed back button, settings icon)
- Unified JavaScript toggle pattern

**Screens Modified:**
- `certificate-v2_create_1.html`
- `certificate-v2_detail_1.html`

**User Flows Updated:**
- None (cosmetic/consistency fixes only)

**Breaking Changes:**
- None

---

### [YYYY-MM-DD] - [Feature/Module Name Template]

**What Changed:**
- Brief summary of what was added, modified, or removed

**Screens Added:**
- List of new screen files with brief description

**Screens Modified:**
- List of modified screen files with what changed

**User Flows Updated:**
- Which user journeys were affected

**Breaking Changes:**
- Any navigation structure changes
- Any component API changes
- Any pattern deprecations

**Design Patterns:**
- New patterns introduced
- Patterns deprecated or modified

---

## 6. Design Patterns & Conventions

### 6.1 Active Patterns

**Pattern:** Multi-Step Wizard
- **When to use:** Creating complex entities (employees, patients, long forms)
- **Components:** Stepper progress bar, Next/Back buttons, breadcrumb
- **Example screens:** `employee_new_step_1.html` through `step_1_2_3_4_5.html`
- **File naming:** `{entity}_new_step_1.html`, `step_1_2.html`, `step_1_2_3.html`

**Pattern:** Tabbed Profile View
- **When to use:** Displaying entity details with multiple information categories
- **Components:** Tab navigation, profile header card, tab content panels
- **Example screens:** `employee_profile_1.html`, `patient_profile_1.html`
- **Tabs:** 3-4 tabs typical, first tab is "Información Básica"

**Pattern:** List with Stats Dashboard
- **When to use:** Main listing screens for entities
- **Components:** Stats cards grid (4 columns), search/filter bar, data table
- **Example screens:** `employees_list_1.html`, `patients_list_1.html`
- **Stats:** Always 4 cards showing key metrics

**Pattern:** Download → Complete → Upload Workflow
- **When to use:** Forms requiring external completion (Excel files)
- **Components:** Numbered steps, download button, upload drag-drop area
- **Example screens:** `patient_complete_instrument_1.html`
- **Steps:** Download template → Instructions → Upload → Metadata entry

**Pattern:** Specialist Bulk View
- **When to use:** Processing multiple items of same type across entities
- **Components:** Filter controls, data table, bulk actions
- **Example screens:** `instrument_view_by_type_1.html`
- **Use case:** Nutritionist completing monthly reports for all patients

### 6.2 Component Patterns

**Pattern:** Badge Status Indicators
- **Variants:** Success (✓), Warning (⚠️), Info, Error, Neutral
- **Usage:** Table cells, list items, inline status
- **CSS:** `.badge`, `.badge-success`, `.badge-warning`, `.badge-priority-{high|medium|low}`

**Pattern:** Action Icon Buttons
- **Variants:** View (eye), Edit (pencil), Delete (trash), Download (download)
- **Usage:** Table action columns, card headers
- **CSS:** `.btn-icon`, `.btn-ghost`, `.btn-sm`

**Pattern:** Responsive Sidebar Navigation
- **Desktop:** Fixed left sidebar, always visible
- **Mobile:** Hidden by default, slide-in with overlay
- **Toggle:** Menu button in header
- **CSS:** `.sidebar`, `.sidebar-overlay`, `.sidebar.open`, `.sidebar-overlay.show`

### 6.3 Deprecated Patterns

**Pattern:** Expandable Table Rows
- **Why deprecated:** Too complex, poor mobile UX
- **Replaced by:** Click row → Navigate to detail page
- **Migration:** Remove expand/collapse logic, make entire row clickable
- **Last used:** `patients_list_1.html` (old version, archived)

**Pattern:** Inline Dropdown Actions in Tables
- **Why deprecated:** Inconsistent across screens, accessibility issues
- **Replaced by:** Icon button actions in dedicated column
- **Migration:** Replace dropdown with icon buttons (view, edit, delete)
- **Last used:** Certificate screens v1 (replaced in v2)

---

## 7. Technical Notes

### 7.1 Design System

**CSS Framework:** `default_ui_theme.css` (PrimeVue violet/purple palette)
- Primary color: `--p-primary-500: #8b5cf6`
- Theme support: Light (default) and Dark mode (`html.dark` class)
- Spacing scale: `--spacing-xs` through `--spacing-3xl`
- Border radius: `--radius: 0.625rem`

**Utility Framework:** Tailwind CSS (via CDN)
- Used for: Layout (flex, grid), spacing utilities, responsive classes

**Icon Library:** Lucide Icons (via CDN)
- Usage: `<i data-lucide="icon-name" class="icon"></i>`
- Init: `lucide.createIcons()` in script

### 7.2 File Naming Conventions

**Standard:** `{section}_{screen_type}_{hierarchy}_{iteration}.html`

**Examples:**
- `employees_list_1.html` - First version of employee list
- `employee_profile_1.html` - First version of employee profile
- `employee_new_step_1.html` - First step of wizard
- `employee_new_step_1_2_3.html` - Third step of wizard (cumulative hierarchy)

**Iterations:**
- Base: `_1.html`
- Variants: `_1_1.html`, `_1_2.html` (modal states, demos)
- Redesigns: `_2.html`, `_3.html`

### 7.3 Navigation Link Patterns

**Sidebar Menu:**
```html
<a href="section_list_1.html" class="sidebar-item [active]">
  <i data-lucide="icon-name" class="icon"></i>
  <span>Label</span>
</a>
```

**Wizard Navigation:**
- Back: Previous hierarchy level (`step_1_2_3.html` → `step_1_2.html`)
- Next: Add hierarchy segment (`step_1_2.html` → `step_1_2_3.html`)
- Cancel: Return to list screen

**Table Row Click:**
```html
<tr onclick="window.location.href='entity_profile_1.html'" style="cursor: pointer;">
```

---

## 8. Future Planned Sections

### 8.1 Nómina (Payroll) Module
**Status:** Placeholder
**Priority:** Medium
**Screens Needed:** List, Detail, Payment History, Generate Report

### 8.2 Reportes (Reports) Module
**Status:** Placeholder
**Priority:** Low
**Screens Needed:** Report List, Report Builder, Generated Reports

### 8.3 Configuración (Settings) Module
**Status:** Placeholder
**Priority:** Low
**Screens Needed:** Company Settings, User Preferences, Integrations

---

## 9. Performance & Accessibility Notes

### 9.1 Performance Considerations
- All screens load in < 2s on 3G connection
- Images use lazy loading where applicable
- CSS/JS loaded from CDN with caching
- No client-side data fetching (static HTML prototypes)

### 9.2 Accessibility
- Color contrast ratios meet WCAG AA standards
- All interactive elements keyboard accessible
- Focus states visible on all interactive elements
- Icon buttons have `title` attributes for screen readers

### 9.3 Responsive Breakpoints
- Mobile: < 768px (sidebar hidden, stats 1 column)
- Tablet: 768px - 1024px (sidebar toggle, stats 2 columns)
- Desktop: > 1024px (sidebar visible, stats 4 columns)

---

## 10. Maintenance Guidelines

### 10.1 When to Update This Document

✅ **Always update after:**
- Adding/removing screens
- Changing navigation structure
- Creating new user flows
- Adding/deprecating design patterns
- Modifying shared components
- Before running `/compact`

### 10.2 Version Numbering

- **Major version (X.0):** Navigation structure change, new section added
- **Minor version (1.X):** New screens in existing section, flow modifications
- **Patch (1.1.X):** Cosmetic updates, bug fixes (rarely used in this doc)

### 10.3 Collaboration Notes

This document is the source of truth for:
- Current app structure and flows
- Screen inventory and status
- Design pattern decisions
- Historical changes

Reference this document:
- Before starting new design work
- When onboarding to the project
- After context compaction
- When planning new features

---

**Document Status:** Template - Ready to be populated with actual project data
**Next Action:** Run `/ux-summary` command to generate v1.0 from existing screens
