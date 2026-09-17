# Task: Phase 1A Frontend CSS Improvements

## Task Definition
Implement 4 frontend UI improvements: mobile-only sidebar (B1), employee search padding verification (B3), empresa page admin guard (B8), and dark theme violet tint (B9).

## Plan
- B1: Remove desktop sidebar persistence (md:ml-[280px] offset, md:translate-x-0 always-visible, md:hidden overlay/hamburger restrictions)
- B3: Verify search input already has pl-10 padding
- B8: Add isAdmin check in empresa/index.vue onMounted to redirect non-admins to /
- B9: Replace .dark CSS block with violet-tinted background and secondary text colors

## Changes Made

### B1: Hide Sidebar on Desktop (mobile-only sidebar)

**File: `frontend/app/layouts/default.vue` (line 29)**
- Removed `md:ml-[280px]` from the main content wrapper div
- Before: `<div class="flex flex-col min-h-screen transition-all duration-300 md:ml-[280px]">`
- After: `<div class="flex flex-col min-h-screen transition-all duration-300">`
- Effect: Main content no longer permanently shifts right on desktop to accommodate a visible sidebar

**File: `frontend/app/components/AppSidebar.vue` (line 52)**
- Removed `md:translate-x-0` from sidebar translate class binding
- Before: `visible ? 'translate-x-0' : '-translate-x-full md:translate-x-0'`
- After: `visible ? 'translate-x-0' : '-translate-x-full'`
- Effect: Sidebar is fully hidden (off-screen) unless `visible` prop is true, on all viewport sizes

**File: `frontend/app/components/AppSidebar.vue` (line 115)**
- Removed `md:hidden` from overlay div class
- Before: `class="fixed inset-0 bg-black/50 z-30 md:hidden"`
- After: `class="fixed inset-0 bg-black/50 z-30"`
- Effect: Overlay now shows on all viewports when sidebar is open, not just mobile

**File: `frontend/app/components/AppHeader.vue` (line ~55)**
- Removed the `class="md:hidden"` attribute line from the hamburger Button component
- Before: Button had `class="md:hidden"` making it invisible on md+ screens
- After: Button has no class restriction, visible on all viewports
- Effect: Hamburger/toggle button is always visible so users can open the sidebar on any screen size

### B3: Employee Search Input Padding Fix

**File: `frontend/app/pages/empleados/index.vue` (line 189)**
- Verified: `class="w-full pl-10"` was already present on the InputText component
- No changes required — the `pl-10` (2.5rem) padding correctly clears the `left-3` positioned search icon
- Status: Already correct, documented as confirmed

### B8: Empresa Page Admin-Only Guard

**File: `frontend/app/pages/empresa/index.vue` (lines 10-14)**
- Added `authStore.isAdmin` check at the start of `onMounted` hook
- Before:
  ```js
  onMounted(async () => {
    if (!empresa.value) {
      await authStore.fetchEmpresa()
    }
  })
  ```
- After:
  ```js
  onMounted(async () => {
    if (!authStore.isAdmin) {
      await navigateTo('/')
      return
    }
    if (!empresa.value) {
      await authStore.fetchEmpresa()
    }
  })
  ```
- Effect: Non-admin users are immediately redirected to `/` when attempting to access /empresa. The empresa fetch only runs for admin users.

### B9: Dark Theme Violet Tint

**File: `frontend/app/assets/css/main.css` (lines 57-67)**
- Replaced the `.dark` CSS block with violet-tinted surface and text colors
- Before (slate-based dark):
  ```css
  --surface-ground: #0f172a;
  --surface-card: #1e293b;
  --surface-section: #1e293b;
  --surface-hover: #334155;
  --surface-border: #334155;
  --text-color-secondary: #94a3b8;
  --muted-foreground: #94a3b8;
  --border: #334155;
  ```
- After (violet-tinted dark):
  ```css
  --surface-ground: #1a1625;
  --surface-card: #241f31;
  --surface-section: #241f31;
  --surface-hover: #352f44;
  --surface-border: #3d3550;
  --text-color-secondary: #c4b5fd;
  --muted-foreground: #c4b5fd;
  --border: #3d3550;
  ```
- Effect: Dark mode now uses purple/violet-tinted backgrounds (matching the app's violet primary color palette) and violet-300 (#c4b5fd) for secondary text, creating a cohesive visual identity.

## Issues Found

- **B3 (No action needed)**: The `pl-10` padding on the search input was already implemented correctly in the current codebase. The task description anticipated this might already be fixed — confirmed correct.
- **B1 Overlay**: The overlay was conditionally rendered with `v-if="visible"`, so removing `md:hidden` means the overlay correctly appears and disappears on all screen sizes based on sidebar visibility state — no visual regression risk.
