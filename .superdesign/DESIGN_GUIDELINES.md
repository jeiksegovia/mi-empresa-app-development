# Mi Empresa App - Design Guidelines

**Version:** 1.3
**Last Updated:** 2026-01-10
**Purpose:** Ensure consistent UI/UX across all screens

---

## 📋 UPDATE: Patient Module V2 - Instrumentos Integration

**Date:** 2026-01-10
**Feature:** Added "Instrumentos" module for evaluation forms (fichas) management

**New Navigation Item:**
- Added "Instrumentos" (clipboard-list icon) as menu item #4 in sidebar
- Links to: `instruments_list_1.html`

**Patient Profile Enhancement:**
- Added new tab: "Fichas/Evaluaciones" to patient profile
- Tab displays evaluation forms checklist with completion status
- Links: `patient_profile_1.html` with new tab content

**New Screens:**
1. `instruments_list_1.html` - List of all instruments (admin view)
2. `instrument_create_1.html` - Create/edit instrument form
3. `patient_complete_instrument_1.html` - Full page workflow for completing evaluations
4. `instrument_view_by_type_1.html` - Specialist view (filter by instrument type)

**Important:** All navigation menus MUST include "Instrumentos" menu item between "Pacientes" and "Certificados"

---

## ⚠️ CRITICAL: Header & Sidebar Consistency Issues Fixed

**Date:** 2026-01-08
**Issue:** Certificate screens (v2) had inconsistent sidebar and header structures compared to reference screens

**Problems Identified:**

1. **Sidebar Structure Mismatch**
   - ❌ **WRONG**: Using `sidebar-header`, `sidebar-nav`, `sidebar-footer` classes with `closeSidebar` button
   - ✅ **CORRECT**: Simple structure with `<div style="padding: var(--spacing-xl);">` wrapper, no close button

2. **Navigation Menu Labels**
   - ❌ **WRONG**: "Dashboard", "Certificación Empresarial", "Gestionar Personal", "Gestionar Pacientes", "Gestionar Nómina"
   - ✅ **CORRECT**: "Inicio", "Empleados", "Pacientes", "Certificados", "Nómina", "Reportes", "Configuración"

3. **Menu Icons**
   - ❌ **WRONG**: `shield-check`, `heart-pulse`, `banknote`
   - ✅ **CORRECT**: `file-check`, `user`, `wallet`

4. **Header Structure**
   - ❌ **WRONG**: Back button in header, Settings icon in header, custom margin-bottom
   - ✅ **CORRECT**: Only menu toggle + title on left, only bell + user icon + username on right

5. **JavaScript Pattern**
   - ❌ **WRONG**: Separate `openSidebar()` and `closeSidebarFunc()` functions, `sidebar-overlay` uses `active` class, body overflow manipulation
   - ✅ **CORRECT**: Simple toggle using `.toggle()`, `sidebar-overlay` uses `show` class, no body overflow changes

**Fixed Files:**
- `certificate-v2_create_1.html`
- `certificate-v2_detail_1.html`

**Reference File:** `certificates-v2_1.html`

---

## 0. Theme System

### 0.1 Light & Dark Theme Support

The design system supports **both Light and Dark themes** with automatic switching.

**Usage:**
- **Light Mode (default)**: `<html lang="es">` or `<html lang="es" class="">`
- **Dark Mode**: `<html lang="es" class="dark">`

**Toggle Between Themes:**
```javascript
// Simple toggle
document.documentElement.classList.toggle('dark');

// With localStorage
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme',
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
}
```

**Color System:**
- All colors use CSS custom properties (variables) that automatically adapt
- Primary palette: PrimeVue violet scale (--p-primary-50 through --p-primary-950)
- Always use variables (e.g., `var(--background)`) instead of hard-coded colors

**Resources:**
- Complete implementation guide: `THEME_TOGGLE_GUIDE.md`
- Working demo: `theme_toggle_demo_1.html`

---

## 1. Layout Structure

### 1.1 Standard Page Layout

All main application screens MUST follow this structure:

```
┌─────────────────────────────────────────────────────────┐
│ [Sidebar] │ [Top Header Bar]                            │
│           ├─────────────────────────────────────────────┤
│           │                                             │
│           │ [Page Title + Actions]                      │
│           │                                             │
│           │ [Main Content Area]                         │
│           │                                             │
│           │                                             │
└───────────┴─────────────────────────────────────────────┘
```

### 1.2 Exception: Wizard/Multi-Step Forms

Wizard flows (e.g., New Employee) may omit the sidebar but MUST include:
- Back button in top header
- Breadcrumb navigation (e.g., "Empleados > Nuevo empleado")
- Progress stepper
- Top header with notifications and user menu

---

## 2. Core Components

### 2.0 Body Structure and Layout Wrapper

**CRITICAL: All pages MUST follow this exact body structure:**

```html
<body>
  <!-- 1. Sidebar Overlay (backdrop) -->
  <div class="sidebar-overlay" id="sidebarOverlay"></div>

  <!-- 2. Sidebar Navigation -->
  <aside class="sidebar" id="sidebar">
    <!-- Sidebar content -->
  </aside>

  <!-- 3. Main Content Wrapper -->
  <main class="main-content">
    <!-- Top Header -->
    <header class="card" style="border-radius: 0; border-left: none; border-right: none; border-top: none; padding: var(--spacing-lg) var(--spacing-xl);">
      <!-- Header content -->
    </header>

    <!-- Page Content Area -->
    <div class="container" style="padding: var(--spacing-xl); max-width: 1400px; margin: 0 auto;">
      <!-- Page content here -->
    </div>
  </main>
</body>
```

**CSS for Main Content Wrapper:**
```css
.main-content {
  min-height: 100vh;
  background: var(--background);
}
```

**Important Notes:**
- The `main-content` class ensures proper layout when sidebar is closed
- Do NOT wrap in additional divs like `<div style="min-height: 100vh">` - use `.main-content` instead
- Container has max-width for optimal reading width on large screens

---

### 2.1 Sidebar Navigation

**Specifications:**
- Width: `280px`
- Position: `fixed`, slides from left (`left: -280px` when closed)
- Background: `var(--surface-card)`
- Border: `1px solid var(--border)` on right side
- Transition: `left 0.3s ease-out`
- Z-index: `100`

**Structure:**
```html
<aside class="sidebar" id="sidebar">
  <div style="padding: var(--spacing-xl);">
    <!-- Logo + Company Name -->
    <div class="flex items-center gap-3 mb-8">
      <div class="w-10 h-10 rounded-lg bg-[var(--p-primary-500)]">
        <i data-lucide="building-2" class="icon-lg text-white"></i>
      </div>
      <div>
        <h2 class="font-semibold text-base">Mi Empresa</h2>
        <p class="text-xs text-muted">jeik-sa</p>
      </div>
    </div>

    <!-- Navigation Items -->
    <nav>
      <a href="#" class="sidebar-item [active]">
        <i data-lucide="[icon]" class="icon"></i>
        <span>[Label]</span>
      </a>
      <!-- More items... -->
    </nav>
  </div>
</aside>

<!-- Sidebar Overlay (closes sidebar on click) -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>
```

**Navigation Items:**
1. Inicio (home)
2. Empleados (users)
3. Pacientes (user)
4. Instrumentos (clipboard-list)
5. Certificados (file-check)
6. Nómina (wallet)
7. Reportes (bar-chart)
8. Configuración (settings)

**CSS Classes:**
```css
.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius);
  transition: all 0.2s;
  cursor: pointer;
  text-decoration: none;
  color: var(--foreground);
}

.sidebar-item:hover {
  background: var(--surface-hover);
}

.sidebar-item.active {
  background: var(--p-primary-500);
  color: white;
}
```

---

### 2.2 Top Header Bar

**Specifications:**
- Full width (spanning entire viewport)
- Position: Part of `.main-content` wrapper (NOT fixed)
- Background: `var(--surface-card)`
- Border: `1px solid var(--border)` on bottom only (other sides: none)
- Padding: `var(--spacing-lg) var(--spacing-xl)`
- Z-index: Not required (within main-content flow)

**Structure:**
```html
<header class="card" style="border-radius: 0; border-left: none; border-right: none; border-top: none; padding: var(--spacing-lg) var(--spacing-xl);">
  <div class="flex items-center justify-between">
    <!-- Left Section -->
    <div class="flex items-center gap-4">
      <!-- Menu Toggle Button - ALWAYS visible -->
      <button id="menuToggle" class="btn btn-ghost btn-icon">
        <i data-lucide="menu" class="icon"></i>
      </button>
      <h1 class="text-xl font-semibold">[Page Title]</h1>
    </div>

    <!-- Right Section -->
    <div class="flex items-center gap-3">
      <!-- Notifications Bell -->
      <button class="btn btn-ghost btn-icon relative">
        <i data-lucide="bell" class="icon"></i>
        <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold" style="background: #ef4444; color: white;">3</span>
      </button>

      <!-- User Profile Icon -->
      <button class="btn btn-ghost btn-icon">
        <i data-lucide="user-circle" class="icon"></i>
      </button>

      <!-- Username (hidden on mobile) -->
      <span class="text-sm font-medium hidden md:inline">jeik-sa</span>
    </div>
  </div>
</header>
```

**Required Elements:**
1. **Menu toggle button** - MUST be `id="menuToggle"`, ALWAYS visible (no `md:hidden` class)
2. **Page title** - `<h1>` with contextual title
3. **Notification bell** - With red badge showing count
4. **User icon** - For profile menu
5. **Username** - Text display (hidden on mobile with `hidden md:inline`)

**Important Notes:**
- Menu button should ALWAYS be visible on all screen sizes
- On desktop, it toggles the sidebar in/out
- On mobile, it opens the sidebar overlay
- Do NOT add `md:hidden` to the menu button
- Username text can be hidden on mobile to save space

---

### 2.3 Main Content Area

**Specifications:**
- Wrapper class: `.main-content` (contains header and content)
- Content padding: `var(--spacing-xl)` on all sides
- Max-width: `1400px` (centered with `margin: 0 auto`)
- Background: `var(--background)`
- Min-height: `100vh` (ensures full page height)

**Structure:**
```html
<main class="main-content">
  <!-- Top Header (from section 2.2) -->
  <header class="card" style="...">
    <!-- Header content -->
  </header>

  <!-- Page Content Container -->
  <div class="container" style="padding: var(--spacing-xl); max-width: 1400px; margin: 0 auto;">

    <!-- Page Title Section -->
    <div class="flex items-start justify-between mb-8">
      <div>
        <h2 class="text-3xl font-bold mb-2">[Page Title]</h2>
        <p class="text-muted">[Page Description]</p>
      </div>
      <button class="btn btn-primary">
        <i data-lucide="[icon]" class="icon"></i>
        <span>[Action Label]</span>
      </button>
    </div>

    <!-- Content Cards/Sections -->
    <div class="card">
      <!-- Page content here -->
    </div>

  </div>
</main>
```

**CSS Required:**
```css
.main-content {
  min-height: 100vh;
  background: var(--background);
}
```

**Important Notes:**
- Container uses `style` attribute for padding and max-width
- Do NOT add position fixed/sticky to header (it's in normal flow)
- Page title should use `<h2>` (h1 is in top header bar)
- Primary action button aligned to the right

---

### 2.4 Footer (Optional)

**Specifications:**
- Footer is OPTIONAL for most application pages
- Use only for landing pages, public-facing pages, or when required
- Positioned at bottom of main content (not fixed)

**Structure (if needed):**
```html
<footer class="card" style="border-radius: 0; border-left: none; border-right: none; border-bottom: none; padding: var(--spacing-xl); margin-top: var(--spacing-2xl); text-align: center;">
  <div class="flex items-center justify-center gap-4 text-sm text-muted">
    <span>© 2024 Mi Empresa</span>
    <span>|</span>
    <a href="#" class="hover:text-primary">Términos</a>
    <span>|</span>
    <a href="#" class="hover:text-primary">Privacidad</a>
    <span>|</span>
    <a href="#" class="hover:text-primary">Soporte</a>
  </div>
</footer>
```

**When to Use:**
- Public landing pages
- Login/registration pages
- Settings pages with legal information
- NOT needed for internal application pages (lists, forms, dashboards)

---

## 3. UI Components

### 3.1 Buttons

**Primary Button:**
```html
<button class="btn btn-primary">
  <i data-lucide="[icon]" class="icon"></i>
  <span>Label</span>
</button>
```

**Outline Button:**
```html
<button class="btn btn-outline">
  <i data-lucide="[icon]" class="icon"></i>
  <span>Label</span>
</button>
```

**Ghost Button:**
```html
<button class="btn btn-ghost">
  <span>Label</span>
</button>
```

**Icon-Only Button:**
```html
<button class="btn btn-icon btn-ghost">
  <i data-lucide="[icon]" class="icon"></i>
</button>
```

**Button Sizes:**
- Default: `.btn`
- Small: `.btn-sm`
- Large: `.btn-lg`

---

### 3.2 Cards

**Standard Card:**
```html
<div class="card">
  <h3 class="text-lg font-semibold mb-6">[Card Title]</h3>
  <!-- Card content -->
</div>
```

**Properties:**
- Background: `var(--surface-card)`
- Border: `1px solid var(--surface-border)`
- Border-radius: `var(--radius-lg)`
- Padding: `var(--spacing-xl)`
- Box-shadow: `var(--shadow)`

---

### 3.3 Badges

**Status Badges:**
```html
<span class="badge badge-success">✅ Active</span>
<span class="badge badge-warning">⚠️ Warning</span>
<span class="badge badge-info">ℹ️ Info</span>
<span class="badge badge-priority-high">High</span>
```

**CSS:**
```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius);
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.badge-success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.badge-warning {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
  border: 1px solid rgba(251, 146, 60, 0.3);
}

.badge-info {
  background: rgba(139, 92, 246, 0.2);
  color: var(--p-primary-400);
  border: 1px solid rgba(139, 92, 246, 0.3);
}
```

---

### 3.4 Forms

**Input Field:**
```html
<div class="form-group">
  <label class="form-label [required]">Label</label>
  <input type="text" class="form-input" placeholder="Placeholder">
</div>
```

**Select Dropdown:**
```html
<select class="form-input">
  <option value="">Seleccionar</option>
  <option value="1">Option 1</option>
</select>
```

**Textarea:**
```html
<textarea class="form-input" rows="4" placeholder="Placeholder"></textarea>
```

**Required Field Indicator:**
```css
.required::after {
  content: ' *';
  color: #ef4444;
}
```

---

### 3.5 Data Tables

**Structure:**
```html
<div class="card" style="overflow-x: auto;">
  <table class="data-table">
    <thead>
      <tr>
        <th><input type="checkbox" id="selectAll"></th>
        <th class="sortable">
          Column Name
          <i data-lucide="chevrons-up-down" class="sort-icon icon-sm"></i>
        </th>
        <!-- More columns -->
      </tr>
    </thead>
    <tbody>
      <tr data-id="1">
        <td><input type="checkbox" class="row-checkbox"></td>
        <td><span class="font-medium">Data</span></td>
        <!-- More cells -->
        <td>
          <div class="flex items-center gap-2">
            <button class="btn btn-ghost btn-icon btn-sm expand-btn">
              <i data-lucide="chevron-down" class="icon-sm"></i>
            </button>
            <div class="dropdown">
              <button class="btn btn-ghost btn-icon btn-sm dropdown-toggle">
                <i data-lucide="more-vertical" class="icon-sm"></i>
              </button>
              <div class="dropdown-content">
                <div class="dropdown-item">
                  <i data-lucide="eye" class="icon-sm"></i>
                  <span>Action</span>
                </div>
              </div>
            </div>
          </div>
        </td>
      </tr>
      <!-- Expandable row -->
      <tr class="expanded-row" id="expanded-1" style="display: none;">
        <td colspan="7">
          <div class="expanded-content">
            <!-- Expanded content -->
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

**Features:**
- Sortable columns (`.sortable` class)
- Expandable rows
- Row selection with checkboxes
- Dropdown actions menu
- Hover states

---

### 3.6 Tabs

**Structure:**
```html
<div class="tab-nav">
  <button class="tab-button active" data-tab="tab1">
    <i data-lucide="icon" class="w-4 h-4 inline"></i>
    Tab 1
  </button>
  <button class="tab-button" data-tab="tab2">
    <i data-lucide="icon" class="w-4 h-4 inline"></i>
    Tab 2
  </button>
</div>

<div class="tab-content active" id="tab1">
  <!-- Tab 1 content -->
</div>

<div class="tab-content" id="tab2">
  <!-- Tab 2 content -->
</div>
```

**CSS:**
```css
.tab-nav {
  background: var(--surface-card);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-xl);
  display: flex;
  gap: var(--spacing-xs);
  overflow-x: auto;
}

.tab-button {
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-color-secondary);
  font-weight: 500;
  cursor: pointer;
  transition: all 200ms ease;
  white-space: nowrap;
}

.tab-button:hover {
  background: var(--surface-hover);
  color: var(--text-color);
}

.tab-button.active {
  background: var(--p-primary-500);
  color: white;
  box-shadow: var(--shadow-sm);
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}
```

---

## 4. Color Palette

### 4.1 Primary Colors

Based on `default_ui_theme.css`:

```css
--p-primary-50: #faf5ff
--p-primary-100: #f3e8ff
--p-primary-200: #e9d5ff
--p-primary-300: #d8b4fe
--p-primary-400: #c084fc
--p-primary-500: #8b5cf6  /* Main brand color */
--p-primary-600: #7c3aed
--p-primary-700: #6d28d9
--p-primary-800: #5b21b6
--p-primary-900: #4c1d95
--p-primary-950: #2e1065
```

### 4.2 Semantic Colors

```css
/* Success */
--p-green-500: #10b981

/* Warning */
--p-orange-500: #f59e0b

/* Error/Destructive */
--p-red-500: #ef4444

/* Info */
--p-blue-500: #3b82f6
```

### 4.3 Surface Colors

**Light Mode:**
```css
--surface-ground: #f8fafc
--surface-card: #ffffff
--surface-hover: #f1f5f9
--surface-border: #e2e8f0
```

**Dark Mode:**
```css
--surface-ground: #0f172a
--surface-card: #1e293b
--surface-hover: #334155
--surface-border: #475569
```

---

## 5. Typography

### 5.1 Font Stack

```css
--font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

### 5.2 Font Sizes

```css
--font-size-xs: 0.75rem    /* 12px */
--font-size-sm: 0.875rem   /* 14px */
--font-size-base: 1rem     /* 16px */
--font-size-lg: 1.125rem   /* 18px */
--font-size-xl: 1.25rem    /* 20px */
--font-size-2xl: 1.5rem    /* 24px */
--font-size-3xl: 1.875rem  /* 30px */
--font-size-4xl: 2.25rem   /* 36px */
```

### 5.3 Font Weights

```css
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
```

### 5.4 Heading Styles

```css
h1: text-3xl (1.875rem), font-bold
h2: text-2xl (1.5rem), font-bold
h3: text-lg (1.125rem), font-semibold
h4: text-base (1rem), font-semibold
```

---

## 6. Spacing System

```css
--spacing-xs: 0.25rem    /* 4px */
--spacing-sm: 0.5rem     /* 8px */
--spacing-md: 0.75rem    /* 12px */
--spacing-lg: 1rem       /* 16px */
--spacing-xl: 1.5rem     /* 24px */
--spacing-2xl: 2rem      /* 32px */
--spacing-3xl: 3rem      /* 48px */
```

**Usage Guidelines:**
- Card padding: `var(--spacing-xl)`
- Section margins: `var(--spacing-2xl)`
- Form field gaps: `var(--spacing-lg)`
- Button padding: `var(--spacing-md) var(--spacing-lg)`

---

## 7. Icons

**Library:** Lucide Icons
**CDN:** `https://unpkg.com/lucide@latest/dist/umd/lucide.min.js`

**Icon Sizes:**
```css
.icon: 1rem (16px)
.icon-sm: 0.875rem (14px)
.icon-lg: 1.25rem (20px)
.icon-xl: 1.5rem (24px)
```

**Common Icons:**
- Navigation: `home`, `users`, `user`, `file-check`, `wallet`, `bar-chart`, `settings`
- Actions: `plus`, `edit`, `trash-2`, `save`, `download`, `upload`, `printer`
- UI: `menu`, `x`, `chevron-down`, `chevron-up`, `chevron-left`, `chevron-right`, `more-vertical`
- Status: `check-circle`, `alert-triangle`, `info`, `alert-circle`

---

## 8. Animations & Transitions

### 8.1 Standard Transitions

```css
/* Button hover */
transition: all 200ms ease;

/* Card hover */
transition: all 250ms ease;

/* Sidebar slide */
transition: left 300ms ease-out;

/* Modal/Overlay fade */
transition: opacity 300ms ease-out;
```

### 8.2 Hover Effects

**Cards:**
```css
transform: translateY(-2px);
box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
```

**Buttons:**
```css
transform: scale(1.02);
```

**Table Rows:**
```css
background: var(--surface-hover);
```

---

## 9. Responsive Design

### 9.1 Breakpoints

```css
/* Mobile */
@media (max-width: 768px)

/* Tablet */
@media (min-width: 768px) and (max-width: 1200px)

/* Desktop */
@media (min-width: 1200px)
```

### 9.2 Mobile Adaptations

**Sidebar:**
- Always hidden by default
- Slides in from left with overlay
- Closes when overlay is clicked

**Tables:**
- Add `overflow-x: auto` to card wrapper
- Horizontal scroll on mobile

**Grid Layouts:**
- Desktop: `grid-cols-4`
- Tablet: `grid-cols-2`
- Mobile: `grid-cols-1`

**Forms:**
- Desktop: 2-column grid
- Mobile: Single column

---

## 10. JavaScript Patterns

### 10.1 Sidebar Toggle

```javascript
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

menuToggle.addEventListener('click', function() {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('show');
});

sidebarOverlay.addEventListener('click', function() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});
```

### 10.2 Tab Switching

```javascript
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTab = button.getAttribute('data-tab');

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));

    button.classList.add('active');
    document.getElementById(targetTab).classList.add('active');
  });
});
```

### 10.3 Dropdown Menus

```javascript
const dropdownToggles = document.querySelectorAll('.dropdown-toggle');

dropdownToggles.forEach(toggle => {
  toggle.addEventListener('click', function(e) {
    e.stopPropagation();
    const dropdown = this.nextElementSibling;

    // Close other dropdowns
    document.querySelectorAll('.dropdown-content').forEach(d => {
      if (d !== dropdown) d.classList.remove('show');
    });

    dropdown.classList.toggle('show');
  });
});

// Close dropdowns when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('.dropdown-content').forEach(d => {
    d.classList.remove('show');
  });
});
```

### 10.4 Initialize Lucide Icons

**ALWAYS call after DOM modifications:**
```javascript
lucide.createIcons();
```

---

## 11. Accessibility

### 11.1 WCAG 2.1 AA Compliance

- Color contrast ratio ≥ 4.5:1 for normal text
- Color contrast ratio ≥ 3:1 for large text (18px+)
- All interactive elements must be keyboard accessible
- Form inputs must have associated labels

### 11.2 Keyboard Navigation

- Tab order follows visual layout
- Dropdowns accessible via Enter/Space
- Modals trap focus
- Escape key closes modals/dropdowns

### 11.3 Screen Reader Support

- Use semantic HTML (`<nav>`, `<main>`, `<header>`, `<button>`)
- Add `aria-label` to icon-only buttons
- Use `aria-expanded` for expandable sections
- Add `role="alert"` for notifications

---

## 12. Performance Best Practices

### 12.1 CSS Loading

**Order:**
```html
<!-- 1. Design System (Required) -->
<link rel="stylesheet" href="./default_ui_theme.css">

<!-- 2. Tailwind for utilities -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- 3. Custom CSS -->
<style>
  /* Component-specific styles */
</style>
```

### 12.2 JavaScript Loading

```html
<!-- Lucide Icons -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

<!-- Custom JS at end of body -->
<script>
  lucide.createIcons();
  // Your code here
</script>
```

### 12.3 Image Optimization

- Use placeholder images from: `https://placehold.co/` or Unsplash
- Specify width and height attributes
- Use appropriate formats (WebP when possible)

---

## 13. Code Style Guide

### 13.1 HTML

- Use double quotes for attributes
- Indent with 2 spaces
- Self-close void elements: `<input />`, `<img />`
- Use semantic HTML5 elements

### 13.2 CSS

- Use CSS custom properties (variables) from design system
- Avoid inline styles when possible (use Tailwind utilities)
- Group related styles together
- Comment complex calculations

### 13.3 JavaScript

- Use `const` and `let`, avoid `var`
- Use arrow functions for callbacks
- Add event listeners with named functions when possible
- Comment non-obvious logic

---

## 14. File Naming Conventions

### 14.1 HTML Files

```
[module]_[variant]_[iteration].html

Examples:
- dashboard_1.html
- employees_list_1.html
- employee_new_step1_1.html
- employee_profile_1.html
- patients_list_1.html
```

### 14.2 Design Iterations

All design iterations saved to: `.superdesign/design_iterations/`

---

## 15. Common Patterns

### 15.1 Page Header with Action

```html
<div class="flex items-start justify-between mb-8">
  <div>
    <h2 class="text-3xl font-bold mb-2">Page Title</h2>
    <p class="text-muted">Page description or subtitle</p>
  </div>
  <button class="btn btn-primary">
    <i data-lucide="plus" class="icon"></i>
    <span>Primary Action</span>
  </button>
</div>
```

### 15.2 Stats Grid

```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg mb-8">
  <div class="card stat-card">
    <div class="flex items-start justify-between mb-4">
      <div class="flex items-center justify-center w-12 h-12 rounded-lg"
           style="background: rgba(139, 92, 246, 0.1);">
        <i data-lucide="users" class="icon-lg"
           style="color: var(--p-primary-500);"></i>
      </div>
    </div>
    <div class="text-3xl font-bold mb-1">45</div>
    <div class="text-sm text-muted">Stat Label</div>
  </div>
</div>
```

### 15.3 Search Bar with Filters

```html
<div class="card mb-6" style="padding: var(--spacing-lg);">
  <div class="flex items-center gap-4">
    <div class="flex-1">
      <div class="relative">
        <i data-lucide="search"
           class="icon absolute left-3 top-1/2 transform -translate-y-1/2 text-muted"></i>
        <input type="text" class="form-input"
               placeholder="Buscar..."
               style="padding-left: 2.5rem;">
      </div>
    </div>
    <button class="btn btn-outline">
      <i data-lucide="filter" class="icon"></i>
      <span>Filtrar</span>
    </button>
  </div>
</div>
```

### 15.4 Back Button

```html
<a href="#" class="back-button">
  <i data-lucide="arrow-left" class="w-4 h-4"></i>
  Volver a [Previous Page]
</a>
```

**CSS:**
```css
.back-button {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  color: var(--text-color-secondary);
  text-decoration: none;
  margin-bottom: var(--spacing-lg);
  font-weight: 500;
  transition: all 200ms ease;
}

.back-button:hover {
  color: var(--p-primary-500);
  transform: translateX(-3px);
}
```

---

## 16. Testing Checklist

Before finalizing any design, verify:

- [ ] Sidebar navigation present (unless wizard flow)
- [ ] Top header with menu toggle, notifications, user menu
- [ ] Page title and description
- [ ] Consistent card styling
- [ ] All buttons follow button patterns
- [ ] Icons from Lucide library
- [ ] Color palette uses design system variables
- [ ] Responsive on mobile (< 768px)
- [ ] Hover states on interactive elements
- [ ] Dark mode works correctly
- [ ] Lucide icons initialize correctly
- [ ] No console errors
- [ ] Accessible via keyboard navigation

---

## 17. Resources

### 17.1 Design System

- Base CSS: `default_ui_theme.css`
- Color Palette: Violet/Purple PrimeVue theme
- Icons: Lucide Icons (https://lucide.dev)

### 17.2 Reference Files

**List Screens:**
- `employees_list_1.html` - Employee list with table
- `patients_list_1.html` - Patient list with table
- `dashboard_1.html` - Dashboard with stats and alerts

**Detail Screens:**
- `employee_profile_1.html` - Employee detail view
- (To be created: patient detail, certificate detail)

**Forms:**
- `employee_new_step1_1.html` - Wizard step 1
- `employee_new_step_1_2.html` - Wizard step 2
- (Steps 3-5 follow same pattern)

---

## 18. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-30 | Initial guideline creation based on existing designs |

---

**Maintained by:** superdesign (Claude Code)
**Questions?** Reference this document for all design decisions
