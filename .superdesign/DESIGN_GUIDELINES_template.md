# [App Name] - Design Guidelines

**Version:** 1.0
**Last Updated:** [YYYY-MM-DD]
**Purpose:** Ensure consistent UI/UX across all screens

---

<!--
INSTRUCTIONS FOR USING THIS TEMPLATE:
This template helps you create comprehensive design guidelines for your application.
The goal is to achieve detailed specifications that maintain consistency across screens, UX, components, and global elements.

MANDATORY SECTIONS (must be completed):
- Section 0: Theme System (if using light/dark mode)
- Section 1: Layout Structure
- Section 2: Core Components (at minimum: body structure, navigation, header)
- Section 3: UI Components (buttons, cards, forms)
- Section 4: Color Palette
- Section 5: Typography
- Section 6: Spacing System
- Section 10: JavaScript Patterns

OPTIONAL SECTIONS (complete based on your app needs):
- Section 7: File Naming Conventions
- Section 8: Animations & Transitions
- Section 9: Responsive Design
- Section 11-17: Additional patterns and resources

HOW TO FILL THIS TEMPLATE:
1. Replace all [placeholders] with your actual content
2. Delete sections that don't apply to your application
3. Add new sections specific to your app's unique needs
4. Keep examples concrete and copy-pasteable
5. Include ASCII diagrams for layout clarity
6. Document every decision made during the design process
7. Update version number when making significant changes

TIPS FOR MAINTAINING CONSISTENCY:
- Be specific: Don't say "use spacing", say "use var(--spacing-xl)"
- Show, don't tell: Include code examples for every pattern
- Document exceptions: If a screen breaks a pattern, explain why
- Keep it updated: Add new patterns as they emerge
- Reference actual files: Point to screens that demonstrate each pattern
-->

---

## 📋 Recent Updates Log

<!--
INSTRUCTIONS: Add new updates at the TOP of this section with date and description.
This helps track design evolution over time.

Example format:
**Date:** YYYY-MM-DD
**Feature:** Brief description of what changed
**Impact:** What screens/components were affected
**New Screens:** List any new files created
-->

### [Update Title]

**Date:** [YYYY-MM-DD]
**Feature:** [Brief description of design changes]

**Changes Made:**
- [Change 1]
- [Change 2]
- [Change 3]

**Affected Files:**
- [file_name_1.html]
- [file_name_2.html]

**Important:** [Any critical notes about implementation]

---

## 0. Theme System

<!--
INSTRUCTIONS: Document your theme system (light mode only, or light + dark mode support).
If you support dark mode, explain how to toggle between themes.

KEY DETAILS TO INCLUDE:
- How to enable each theme (HTML class structure)
- Color variable naming conventions
- Toggle mechanism (JavaScript)
- Whether colors auto-adapt or need manual specification

DELETE THIS SECTION if your app doesn't support theme switching.
-->

### 0.1 Light & Dark Theme Support

The design system supports **[Light Mode Only / Both Light and Dark themes]**.

**Usage:**
- **Light Mode (default)**: `<html lang="[language]">` or `<html lang="[language]" class="">`
- **Dark Mode**: `<html lang="[language]" class="dark">` [IF APPLICABLE]

**Toggle Between Themes:** [IF APPLICABLE]
```javascript
// Simple toggle
document.documentElement.classList.toggle('dark');

// With localStorage persistence
function toggleTheme() {
  document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme',
    document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
}
```

**Color System:**
- [Describe your color variable system]
- [Primary palette range and naming]
- [Rule: Always use variables, never hard-coded colors]

**Resources:**
- [Link to theme implementation guide if exists]
- [Link to demo file if exists]

---

## 1. Layout Structure

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document your application's page layout structure.
This is the foundation that ensures all screens look consistent.

KEY DETAILS TO INCLUDE:
1. ASCII diagram showing layout zones (sidebar, header, content, footer)
2. Which layouts are standard vs exceptional
3. Exact HTML structure with class names
4. When to use each layout type

BE SPECIFIC: Don't just say "sidebar on left" - show the exact HTML structure,
including wrapper classes, IDs, and any special styling.
-->

### 1.1 Standard Page Layout

All main application screens MUST follow this structure:

```
┌─────────────────────────────────────────────────────────┐
│ [Describe your layout using ASCII art]                   │
│                                                           │
│ Example:                                                  │
│ [Sidebar] │ [Top Header Bar]                             │
│           ├──────────────────────────────────────────────┤
│           │ [Page Title + Actions]                       │
│           │                                              │
│           │ [Main Content Area]                          │
│           │                                              │
└───────────┴──────────────────────────────────────────────┘
```

**Structure Explanation:**
- [Zone 1]: [Purpose and content]
- [Zone 2]: [Purpose and content]
- [Zone 3]: [Purpose and content]

### 1.2 Exception: [Alternative Layout Name]

<!--
INSTRUCTIONS: Document any layouts that deviate from the standard.
Examples: Wizard flows, login pages, landing pages, modals.

For each exception:
- Name the layout type
- Explain WHEN to use it
- Show ASCII diagram
- List what's different from standard layout
-->

[Layout type] (e.g., Wizard/Multi-Step Forms, Login Pages) may omit [component] but MUST include:
- [Required element 1]
- [Required element 2]
- [Required element 3]

```
┌─────────────────────────────────────────────────────────┐
│ [ASCII diagram of alternative layout]                    │
└───────────────────────────────────────────────────────────┘
```

---

## 2. Core Components

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: This section defines the building blocks of your application.
Each subsection should document ONE major component with:
1. Exact specifications (dimensions, colors, positioning)
2. Complete HTML structure
3. Required CSS classes and styles
4. Behavioral rules (hover states, interactions)

THE GOAL: Someone should be able to copy-paste your examples and get pixel-perfect results.
-->

### 2.0 Body Structure and Layout Wrapper

**CRITICAL: All pages MUST follow this exact body structure:**

```html
<body>
  <!-- [Describe each major element in your body structure] -->

  <!-- Example: -->
  <!-- 1. Overlay/Backdrop (if applicable) -->
  <div class="[class-name]" id="[id-name]"></div>

  <!-- 2. Sidebar/Navigation (if applicable) -->
  <aside class="[class-name]" id="[id-name]">
    <!-- Sidebar content -->
  </aside>

  <!-- 3. Main Content Wrapper -->
  <main class="[class-name]">
    <!-- Header -->
    <header class="[class-name]" style="[inline styles if needed]">
      <!-- Header content -->
    </header>

    <!-- Page Content Area -->
    <div class="[container-class]" style="[inline styles if needed]">
      <!-- Page content here -->
    </div>
  </main>
</body>
```

**CSS for Main Wrapper:**
```css
.[your-main-class] {
  /* [List required CSS properties] */
  min-height: 100vh;
  background: var(--background);
}
```

**Important Notes:**
- [Rule 1 about structure]
- [Rule 2 about wrapper classes]
- [Rule 3 about nesting requirements]

---

### 2.1 [Navigation Component Name] (e.g., Sidebar Navigation, Top Nav Bar)

<!--
INSTRUCTIONS: Document your primary navigation component.

INCLUDE:
- Visual specifications (width, height, positioning)
- Color/background specifications
- Complete HTML structure
- CSS class definitions
- Navigation items list with icons and labels
- Active state styling
- Mobile/responsive behavior
-->

**Specifications:**
- Width: [value] (e.g., `280px`, `20%`, `var(--sidebar-width)`)
- Position: [value] (e.g., `fixed`, `sticky`, `relative`)
- Background: [value] (e.g., `var(--surface-card)`)
- Border: [value]
- Transition: [value] (if animated)
- Z-index: [value]

**Structure:**
```html
<!-- [Paste your exact navigation HTML structure here] -->
<[element] class="[class-name]" id="[id-name]">
  <!-- Logo/Branding -->
  <div class="[class]">
    <!-- [Logo structure] -->
  </div>

  <!-- Navigation Items -->
  <nav>
    <a href="[page].html" class="[nav-item-class] [active]">
      <i data-lucide="[icon-name]" class="[icon-class]"></i>
      <span>[Label]</span>
    </a>
    <!-- Repeat for each nav item -->
  </nav>
</[element]>
```

**Navigation Items:**
<!-- List ALL navigation items in order -->
1. [Label 1] ([icon-name]) → [target-file.html]
2. [Label 2] ([icon-name]) → [target-file.html]
3. [Label 3] ([icon-name]) → [target-file.html]
<!-- Add all items -->

**CSS Classes:**
```css
.[nav-item-class] {
  /* [Required styles] */
  display: flex;
  align-items: center;
  /* ... */
}

.[nav-item-class]:hover {
  /* [Hover state styles] */
}

.[nav-item-class].active {
  /* [Active state styles] */
  background: [color];
  color: [color];
}
```

**Responsive Behavior:**
- **Desktop (> [breakpoint]px)**: [Behavior description]
- **Mobile (< [breakpoint]px)**: [Behavior description]

---

### 2.2 Top Header Bar

<!--
INSTRUCTIONS: Document the header that appears at the top of pages.

INCLUDE:
- Positioning specifications
- Layout structure (left section, right section)
- Required elements (menu toggle, title, notifications, user menu)
- Styling specifications
- Mobile adaptations
-->

**Specifications:**
- Width: [value]
- Position: [value]
- Background: [value]
- Border: [value]
- Padding: [value]
- Z-index: [value if fixed/sticky]

**Structure:**
```html
<header class="[class]" style="[inline styles if needed]">
  <div class="[layout-class]">
    <!-- Left Section -->
    <div class="[class]">
      <!-- [Element 1]: [Purpose] -->
      <button id="[id]" class="[class]">
        <i data-lucide="[icon]" class="[class]"></i>
      </button>

      <!-- [Element 2]: [Purpose] -->
      <h1 class="[class]">[Page Title]</h1>
    </div>

    <!-- Right Section -->
    <div class="[class]">
      <!-- [Element 1]: [Purpose] -->
      <button class="[class]">
        <i data-lucide="[icon]" class="[class]"></i>
      </button>

      <!-- [Add all right-section elements] -->
    </div>
  </div>
</header>
```

**Required Elements:**
1. **[Element name]** - [Purpose and requirements]
2. **[Element name]** - [Purpose and requirements]
3. **[Element name]** - [Purpose and requirements]

**Important Notes:**
- [Critical rule 1]
- [Critical rule 2]
- [Critical rule 3]

---

### 2.3 Main Content Area

<!--
INSTRUCTIONS: Document how page content is structured within the main area.

INCLUDE:
- Container specifications (max-width, padding, centering)
- Standard content sections (page title, actions, cards)
- Common layout patterns
-->

**Specifications:**
- Wrapper class: `.[class-name]`
- Content padding: [value]
- Max-width: [value]
- Background: [value]
- Min-height: [value]

**Structure:**
```html
<main class="[main-class]">
  <!-- Header (from section 2.2) -->
  <header class="[class]" style="[styles]">
    <!-- Header content -->
  </header>

  <!-- Page Content Container -->
  <div class="[container-class]" style="[styles]">

    <!-- Page Title Section -->
    <div class="[title-section-class]">
      <div>
        <h2 class="[class]">[Page Title]</h2>
        <p class="[class]">[Page Description]</p>
      </div>
      <button class="[class]">
        <i data-lucide="[icon]" class="[class]"></i>
        <span>[Action Label]</span>
      </button>
    </div>

    <!-- Content Cards/Sections -->
    <div class="[card-class]">
      <!-- Page content here -->
    </div>

  </div>
</main>
```

**CSS Required:**
```css
.[main-class] {
  /* [Required properties] */
}

.[container-class] {
  /* [Required properties] */
}
```

**Important Notes:**
- [Note 1]
- [Note 2]
- [Note 3]

---

### 2.4 Footer (Optional)

<!--
OPTIONAL SECTION - Delete if your app doesn't use footers.

INSTRUCTIONS: If you have footers, document:
- When to use them (which page types)
- Structure and content
- Positioning (static vs sticky)
-->

**Specifications:**
- Footer is **[REQUIRED / OPTIONAL]** for [page types]
- Use only for [use case 1], [use case 2]
- Positioned: [static / sticky / fixed]

**Structure (if needed):**
```html
<footer class="[class]" style="[styles]">
  <div class="[class]">
    <!-- Footer content -->
  </div>
</footer>
```

**When to Use:**
- [Use case 1]
- [Use case 2]
- [Use case 3]

---

## 3. UI Components

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document every reusable UI component in your design system.
For each component, provide:
1. Visual variants (primary, secondary, outline, etc.)
2. Size variants (small, medium, large)
3. Complete HTML examples
4. CSS class definitions
5. Usage rules (when to use which variant)

COMMON COMPONENTS TO DOCUMENT:
- Buttons (all variants and sizes)
- Cards
- Badges/Tags
- Form inputs (text, select, textarea, checkbox, radio)
- Data tables
- Tabs
- Modals/Dialogs
- Dropdowns
- Alerts/Notifications
- Progress bars/Steppers
- Tooltips
- Avatars

Add sections as needed for your specific components.
-->

### 3.1 Buttons

<!--
INSTRUCTIONS: Document ALL button variants your design uses.
Show exact HTML and explain when to use each variant.
-->

**[Variant 1 Name] Button:** (e.g., Primary, Filled, Solid)
```html
<button class="[class] [class]">
  <i data-lucide="[icon]" class="[class]"></i>
  <span>[Label]</span>
</button>
```
**Usage:** [When to use this button variant]

**[Variant 2 Name] Button:** (e.g., Outline, Ghost, Text)
```html
<button class="[class] [class]">
  <i data-lucide="[icon]" class="[class]"></i>
  <span>[Label]</span>
</button>
```
**Usage:** [When to use this button variant]

**Icon-Only Button:**
```html
<button class="[class] [class]">
  <i data-lucide="[icon]" class="[class]"></i>
</button>
```
**Usage:** [When to use icon-only buttons]

**Button Sizes:**
- Default: `.[base-class]` - [height/padding specs]
- Small: `.[base-class] .[size-modifier]` - [height/padding specs]
- Large: `.[base-class] .[size-modifier]` - [height/padding specs]

**Button States:**
```css
.[btn-class]:hover {
  /* [Hover state styles] */
}

.[btn-class]:active {
  /* [Active/pressed state styles] */
}

.[btn-class]:disabled {
  /* [Disabled state styles] */
  opacity: 0.5;
  pointer-events: none;
}
```

---

### 3.2 Cards

<!--
INSTRUCTIONS: Document your card component styling.
Include variations if you have them (elevated, outlined, flat).
-->

**Standard Card:**
```html
<div class="[card-class]">
  <h3 class="[heading-class]">[Card Title]</h3>
  <!-- Card content -->
</div>
```

**Properties:**
- Background: [value]
- Border: [value]
- Border-radius: [value]
- Padding: [value]
- Box-shadow: [value]

**Hover Effect:** (if applicable)
```css
.[card-class]:hover {
  /* [Hover state changes] */
}
```

**Card Variants:** (if applicable)
- **[Variant 1]**: [Description and usage]
- **[Variant 2]**: [Description and usage]

---

### 3.3 Badges

<!--
INSTRUCTIONS: Document badge/tag components for status indicators, labels, etc.
Show all color variants and their semantic meaning.
-->

**Status Badges:**
```html
<span class="[badge-class] [variant-class]">[icon] [Label]</span>
```

**Badge Variants:**
- **[Variant 1]** (e.g., Success): `.[class]` - [When to use]
  - Background: [color]
  - Text color: [color]
  - Border: [value]

- **[Variant 2]** (e.g., Warning): `.[class]` - [When to use]
  - Background: [color]
  - Text color: [color]
  - Border: [value]

- **[Variant 3]** (e.g., Error): `.[class]` - [When to use]
  - Background: [color]
  - Text color: [color]
  - Border: [value]

**CSS:**
```css
.[badge-base-class] {
  /* [Base badge styles] */
  display: inline-flex;
  align-items: center;
  /* ... */
}

.[badge-variant-1] {
  /* [Variant 1 specific styles] */
}

.[badge-variant-2] {
  /* [Variant 2 specific styles] */
}
```

---

### 3.4 Forms

<!--
INSTRUCTIONS: Document ALL form input types your app uses.
Include validation states, required field indicators, error messages.
-->

**Input Field:**
```html
<div class="[form-group-class]">
  <label class="[label-class] [required-class]">[Label]</label>
  <input type="text" class="[input-class]" placeholder="[Placeholder]">
</div>
```

**Select Dropdown:**
```html
<div class="[form-group-class]">
  <label class="[label-class]">[Label]</label>
  <select class="[input-class]">
    <option value="">[Default option text]</option>
    <option value="1">[Option 1]</option>
  </select>
</div>
```

**Textarea:**
```html
<div class="[form-group-class]">
  <label class="[label-class]">[Label]</label>
  <textarea class="[input-class]" rows="4" placeholder="[Placeholder]"></textarea>
</div>
```

**Checkbox:**
```html
<label class="[checkbox-wrapper-class]">
  <input type="checkbox" class="[checkbox-class]">
  <span>[Label]</span>
</label>
```

**Radio Button:**
```html
<label class="[radio-wrapper-class]">
  <input type="radio" name="[group-name]" class="[radio-class]">
  <span>[Label]</span>
</label>
```

**Required Field Indicator:**
```css
.[required-class]::after {
  content: ' *';
  color: [color];
}
```

**Form Validation States:**
```css
.[input-class]:focus {
  /* [Focus state] */
}

.[input-class].error {
  /* [Error state - usually red border] */
}

.[input-class].success {
  /* [Success state - usually green border] */
}
```

**Error Message:**
```html
<span class="[error-message-class]">[Error message text]</span>
```

---

### 3.5 Data Tables

<!--
INSTRUCTIONS: Document table structure, especially if you have:
- Sortable columns
- Row selection
- Expandable rows
- Action menus
- Pagination
-->

**Structure:**
```html
<div class="[card-class]" style="overflow-x: auto;">
  <table class="[table-class]">
    <thead>
      <tr>
        <th>[Header 1]</th>
        <th class="[sortable-class]">
          [Header 2]
          <i data-lucide="[sort-icon]" class="[icon-class]"></i>
        </th>
        <!-- More columns -->
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>[Data]</td>
        <td>[Data]</td>
        <!-- More cells -->
      </tr>
    </tbody>
  </table>
</div>
```

**Features:**
- [Feature 1]: [Description]
- [Feature 2]: [Description]
- [Feature 3]: [Description]

**Table Styles:**
```css
.[table-class] {
  /* [Base table styles] */
}

.[table-class] thead th {
  /* [Header styles] */
}

.[table-class] tbody tr:hover {
  /* [Row hover state] */
}
```

---

### 3.6 Tabs

<!--
INSTRUCTIONS: Document tab navigation pattern if your app uses tabs.
Include HTML structure, JavaScript switching logic.
-->

**Structure:**
```html
<div class="[tab-nav-class]">
  <button class="[tab-button-class] active" data-tab="tab1">
    <i data-lucide="[icon]" class="[icon-class]"></i>
    [Tab 1 Label]
  </button>
  <button class="[tab-button-class]" data-tab="tab2">
    <i data-lucide="[icon]" class="[icon-class]"></i>
    [Tab 2 Label]
  </button>
</div>

<div class="[tab-content-class] active" id="tab1">
  <!-- Tab 1 content -->
</div>

<div class="[tab-content-class]" id="tab2">
  <!-- Tab 2 content -->
</div>
```

**CSS:**
```css
.[tab-nav-class] {
  /* [Tab navigation container styles] */
}

.[tab-button-class] {
  /* [Inactive tab button styles] */
}

.[tab-button-class]:hover {
  /* [Tab button hover state] */
}

.[tab-button-class].active {
  /* [Active tab button styles] */
}

.[tab-content-class] {
  display: none;
}

.[tab-content-class].active {
  display: block;
}
```

**JavaScript:** (See Section 10.2 for implementation)

---

### 3.7 [Additional Component]

<!--
INSTRUCTIONS: Add more subsections for any other UI components:
- Modals/Dialogs
- Dropdowns
- Alerts/Toasts
- Progress bars
- Steppers (for wizards)
- Tooltips
- Avatars
- File upload components
- Date pickers
- Search bars
- Pagination
- Breadcrumbs

Copy the structure from above sections.
-->

---

## 4. Color Palette

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document your COMPLETE color system using CSS custom properties.
This ensures colors are consistent and easy to update globally.

INCLUDE:
1. Primary brand colors (full scale if using a design system)
2. Semantic colors (success, warning, error, info)
3. Surface colors for light mode
4. Surface colors for dark mode (if applicable)
5. Text colors for different hierarchy levels

FORMAT: Show variable names with hex values AND describe usage.
-->

### 4.1 Primary Colors

Based on `[your-css-file.css]`:

```css
/* [Color scale name] - [Description] */
--[prefix]-primary-50: #[hex]   /* [Lightest usage] */
--[prefix]-primary-100: #[hex]
--[prefix]-primary-200: #[hex]
--[prefix]-primary-300: #[hex]
--[prefix]-primary-400: #[hex]
--[prefix]-primary-500: #[hex]  /* Main brand color */
--[prefix]-primary-600: #[hex]
--[prefix]-primary-700: #[hex]
--[prefix]-primary-800: #[hex]
--[prefix]-primary-900: #[hex]
--[prefix]-primary-950: #[hex]  /* [Darkest usage] */
```

**Usage Guidelines:**
- Use `--[prefix]-primary-500` for [usage case]
- Use `--[prefix]-primary-600` for [usage case]
- Use `--[prefix]-primary-[X]` for [usage case]

### 4.2 Semantic Colors

```css
/* Success - [When to use] */
--[prefix]-green-500: #[hex]

/* Warning - [When to use] */
--[prefix]-orange-500: #[hex]

/* Error/Destructive - [When to use] */
--[prefix]-red-500: #[hex]

/* Info - [When to use] */
--[prefix]-blue-500: #[hex]
```

### 4.3 Surface Colors

**Light Mode:**
```css
--surface-ground: #[hex]    /* [Background usage] */
--surface-card: #[hex]      /* [Card background] */
--surface-hover: #[hex]     /* [Hover state background] */
--surface-border: #[hex]    /* [Border color] */
```

**Dark Mode:** (if applicable)
```css
html.dark {
  --surface-ground: #[hex]
  --surface-card: #[hex]
  --surface-hover: #[hex]
  --surface-border: #[hex]
}
```

### 4.4 Text Colors

```css
--text-color: #[hex]              /* [Primary text] */
--text-color-secondary: #[hex]    /* [Secondary/muted text] */
--text-color-tertiary: #[hex]     /* [Least important text] */
```

**Dark Mode Text:** (if applicable)
```css
html.dark {
  --text-color: #[hex]
  --text-color-secondary: #[hex]
}
```

---

## 5. Typography

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document your typography system completely.

INCLUDE:
1. Font family stack (primary, secondary, monospace if used)
2. Font size scale with variable names and pixel equivalents
3. Font weight scale
4. Line height values
5. Heading hierarchy with exact styles
6. Body text specifications

BE SPECIFIC: Include both the CSS variable name AND the computed value.
-->

### 5.1 Font Stack

```css
--font-family: [font-family-stack];
--font-serif: [serif-stack]; /* If used */
--font-mono: [monospace-stack]; /* If used */
```

**Fallback Order:**
1. [Primary font]
2. [Fallback 1]
3. [Fallback 2]
4. [Generic family]

### 5.2 Font Sizes

```css
--font-size-xs: [value]rem     /* [px] - [Usage] */
--font-size-sm: [value]rem     /* [px] - [Usage] */
--font-size-base: [value]rem   /* [px] - [Usage] */
--font-size-lg: [value]rem     /* [px] - [Usage] */
--font-size-xl: [value]rem     /* [px] - [Usage] */
--font-size-2xl: [value]rem    /* [px] - [Usage] */
--font-size-3xl: [value]rem    /* [px] - [Usage] */
--font-size-4xl: [value]rem    /* [px] - [Usage] */
```

### 5.3 Font Weights

```css
--font-normal: [value]      /* [Usage] */
--font-medium: [value]      /* [Usage] */
--font-semibold: [value]    /* [Usage] */
--font-bold: [value]        /* [Usage] */
```

### 5.4 Line Heights

```css
--line-height-tight: [value]    /* [Usage] */
--line-height-normal: [value]   /* [Usage] */
--line-height-relaxed: [value]  /* [Usage] */
```

### 5.5 Heading Styles

**Heading Hierarchy:**
```css
h1: [font-size-class] ([value]rem), [font-weight-class]
h2: [font-size-class] ([value]rem), [font-weight-class]
h3: [font-size-class] ([value]rem), [font-weight-class]
h4: [font-size-class] ([value]rem), [font-weight-class]
h5: [font-size-class] ([value]rem), [font-weight-class]
h6: [font-size-class] ([value]rem), [font-weight-class]
```

**Usage Guidelines:**
- H1: [When to use]
- H2: [When to use]
- H3: [When to use]
- H4: [When to use]

### 5.6 Body Text

- **Default body text**: `[font-size-class]` ([value]rem / [px]px), `[font-weight-class]`
- **Small text**: `[font-size-class]` ([value]rem / [px]px) - [Usage]
- **Large text**: `[font-size-class]` ([value]rem / [px]px) - [Usage]

---

## 6. Spacing System

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document your spacing scale using CSS custom properties.
Consistent spacing is critical for visual harmony.

INCLUDE:
1. Complete spacing scale with variable names
2. Pixel/rem equivalents
3. Usage guidelines for each spacing value
4. Common spacing patterns (card padding, section margins, etc.)
-->

```css
--spacing-xs: [value]rem      /* [px] - [Usage examples] */
--spacing-sm: [value]rem      /* [px] - [Usage examples] */
--spacing-md: [value]rem      /* [px] - [Usage examples] */
--spacing-lg: [value]rem      /* [px] - [Usage examples] */
--spacing-xl: [value]rem      /* [px] - [Usage examples] */
--spacing-2xl: [value]rem     /* [px] - [Usage examples] */
--spacing-3xl: [value]rem     /* [px] - [Usage examples] */
```

**Usage Guidelines:**
- Card padding: `var(--spacing-[size])`
- Section margins: `var(--spacing-[size])`
- Form field gaps: `var(--spacing-[size])`
- Button padding: `var(--spacing-[size]) var(--spacing-[size])`
- Icon gaps: `var(--spacing-[size])`

**Common Spacing Patterns:**
- [Pattern 1]: [Spacing values used]
- [Pattern 2]: [Spacing values used]
- [Pattern 3]: [Spacing values used]

---

## 7. Icons

<!--
OPTIONAL SECTION (but recommended if you use icons)

INSTRUCTIONS: Document your icon system.

INCLUDE:
1. Icon library name and CDN link
2. Icon size classes
3. Common icons used in your app (with names)
4. How to initialize icons (if required)
-->

**Library:** [Icon library name]
**CDN:** `[CDN URL]`
**Documentation:** [Link to icon library docs]

**Icon Sizes:**
```css
.[icon-base-class]: [value]rem ([px]px) - [Usage]
.[icon-sm-class]: [value]rem ([px]px) - [Usage]
.[icon-lg-class]: [value]rem ([px]px) - [Usage]
.[icon-xl-class]: [value]rem ([px]px) - [Usage]
```

**Common Icons:**
- **Navigation**: `[icon-name]`, `[icon-name]`, `[icon-name]`
- **Actions**: `[icon-name]`, `[icon-name]`, `[icon-name]`
- **UI**: `[icon-name]`, `[icon-name]`, `[icon-name]`
- **Status**: `[icon-name]`, `[icon-name]`, `[icon-name]`

**Icon Usage:**
```html
<i data-[library-attribute]="[icon-name]" class="[icon-class]"></i>
```

**Initialization:** (if required)
```javascript
[library].createIcons();
```

---

## 8. Animations & Transitions

<!--
OPTIONAL SECTION

INSTRUCTIONS: Document animation standards if your app uses them.

INCLUDE:
1. Transition durations for different UI elements
2. Easing functions used
3. Hover effects
4. Enter/exit animations
5. Loading states

This ensures animations feel consistent across the app.
-->

### 8.1 Standard Transitions

```css
/* Button hover */
transition: [properties] [duration] [easing];

/* Card hover */
transition: [properties] [duration] [easing];

/* Navigation slide */
transition: [properties] [duration] [easing];

/* Modal/Overlay fade */
transition: [properties] [duration] [easing];
```

### 8.2 Hover Effects

**Cards:**
```css
transform: [transform-value];
box-shadow: [shadow-value];
```

**Buttons:**
```css
transform: [transform-value];
background: [color-change];
```

**Interactive Elements:**
```css
.[element]:hover {
  /* [Hover state changes] */
}
```

### 8.3 Enter/Exit Animations

**Fade In:**
```css
@keyframes fadeIn {
  from { [starting-state] }
  to { [ending-state] }
}

.animate-fade-in {
  animation: fadeIn [duration] [easing];
}
```

**Slide In:**
```css
@keyframes slideIn {
  from { [starting-state] }
  to { [ending-state] }
}
```

---

## 9. Responsive Design

<!--
OPTIONAL SECTION (but highly recommended for web apps)

INSTRUCTIONS: Document responsive behavior and breakpoints.

INCLUDE:
1. Breakpoint definitions
2. Mobile adaptations for each major component
3. Grid system behavior at different sizes
4. Typography scaling on mobile
5. Navigation changes (e.g., hamburger menu)
-->

### 9.1 Breakpoints

```css
/* Mobile */
@media (max-width: [value]px)

/* Tablet */
@media (min-width: [value]px) and (max-width: [value]px)

/* Desktop */
@media (min-width: [value]px)

/* Large Desktop */
@media (min-width: [value]px)
```

### 9.2 Mobile Adaptations

**[Component 1] (e.g., Sidebar):**
- **Desktop (> [breakpoint]px)**: [Behavior]
- **Mobile (< [breakpoint]px)**: [Behavior]

**[Component 2] (e.g., Navigation):**
- **Desktop**: [Behavior]
- **Mobile**: [Behavior]

**Tables:**
- [Mobile behavior - scroll, stack, hide columns?]

**Grid Layouts:**
- Desktop: `[grid-class]` → [columns]
- Tablet: `[grid-class]` → [columns]
- Mobile: `[grid-class]` → [columns]

**Forms:**
- Desktop: [Layout description]
- Mobile: [Layout description]

**Typography Scaling:**
```css
@media (max-width: [breakpoint]px) {
  /* [Font size adjustments for mobile] */
}
```

---

## 10. JavaScript Patterns

<!--
MANDATORY SECTION - DO NOT DELETE

INSTRUCTIONS: Document all standard JavaScript interactions.
This ensures consistent behavior across all screens.

INCLUDE:
1. Sidebar toggle logic
2. Tab switching
3. Dropdown menus
4. Modal open/close
5. Form validation patterns
6. Any other interactive patterns

SHOW COMPLETE CODE that developers can copy-paste.
-->

### 10.1 [Pattern 1 Name] (e.g., Sidebar Toggle)

**Purpose:** [What this interaction does]

```javascript
// [Describe what this code does]
const [element1] = document.getElementById('[id]');
const [element2] = document.getElementById('[id]');

[element1].addEventListener('click', function() {
  // [Describe action]
  [element2].classList.toggle('[class]');
});
```

**CSS Classes Required:**
```css
.[toggle-class] {
  /* [Toggled state styles] */
}
```

---

### 10.2 [Pattern 2 Name] (e.g., Tab Switching)

**Purpose:** [What this interaction does]

```javascript
// [Describe what this code does]
const [elements] = document.querySelectorAll('[selector]');

[elements].forEach([element] => {
  [element].addEventListener('click', () => {
    // [Describe action]
  });
});
```

---

### 10.3 [Pattern 3 Name] (e.g., Dropdown Menus)

**Purpose:** [What this interaction does]

```javascript
// [Complete implementation]
```

---

### 10.4 Icon Initialization

**ALWAYS call after DOM modifications:**
```javascript
[iconLibrary].createIcons();
```

**When to call:**
- [Timing 1]
- [Timing 2]
- [Timing 3]

---

## 11. Accessibility

<!--
OPTIONAL SECTION (but highly recommended)

INSTRUCTIONS: Document accessibility standards your app follows.

INCLUDE:
1. WCAG compliance level (AA, AAA)
2. Color contrast requirements
3. Keyboard navigation patterns
4. Screen reader support
5. ARIA attributes usage
-->

### 11.1 WCAG Compliance

**Target Level:** [AA / AAA]

- Color contrast ratio ≥ [value]:1 for normal text
- Color contrast ratio ≥ [value]:1 for large text ([size]px+)
- [Additional requirement]
- [Additional requirement]

### 11.2 Keyboard Navigation

- [Navigation rule 1]
- [Navigation rule 2]
- [Navigation rule 3]
- [Key binding if any]

### 11.3 Screen Reader Support

- Use semantic HTML (`<nav>`, `<main>`, `<header>`, `<button>`, etc.)
- Add `aria-label` to [elements]
- Use `aria-expanded` for [elements]
- Add `role="[role]"` for [elements]

**Example:**
```html
<button aria-label="[Description]" aria-expanded="false">
  <i data-[library]="[icon]"></i>
</button>
```

### 11.4 Focus States

```css
.[element]:focus-visible {
  outline: [value] solid [color];
  outline-offset: [value];
}
```

---

## 12. Performance Best Practices

<!--
OPTIONAL SECTION

INSTRUCTIONS: Document how to load CSS, JS, and assets efficiently.
-->

### 12.1 CSS Loading

**Order:**
```html
<!-- 1. [Priority 1 CSS] -->
<link rel="stylesheet" href="[path]">

<!-- 2. [Priority 2 CSS] -->
<link rel="stylesheet" href="[path]">

<!-- 3. Custom CSS -->
<style>
  /* Component-specific styles */
</style>
```

### 12.2 JavaScript Loading

```html
<!-- [Library 1] -->
<script src="[CDN or path]"></script>

<!-- Custom JS at end of body -->
<script>
  // Initialize libraries
  // Your code here
</script>
```

### 12.3 Image Optimization

- Use [image source] for placeholders
- Specify width and height attributes: `<img width="[w]" height="[h]">`
- Preferred formats: [format list]
- [Additional guideline]

---

## 13. Code Style Guide

<!--
OPTIONAL SECTION

INSTRUCTIONS: Document coding conventions for consistency.
-->

### 13.1 HTML

- Use [single / double] quotes for attributes
- Indent with [2 / 4] spaces
- [Self-close void elements / Don't self-close]
- Use semantic HTML5 elements

### 13.2 CSS

- Use CSS custom properties (variables) from design system
- [Additional rule]
- [Additional rule]

### 13.3 JavaScript

- Use `const` and `let`, avoid `var`
- [Additional rule]
- [Additional rule]

---

## 14. File Naming Conventions

<!--
OPTIONAL SECTION (but recommended for multi-screen apps)

INSTRUCTIONS: Document file naming patterns for consistency.
This is especially important for design iteration tracking.

INCLUDE:
1. HTML file naming pattern
2. Component naming
3. Version/iteration numbering
4. Folder structure
-->

### 14.1 HTML Files

**Pattern:**
```
[module]_[type]_[iteration].html
```

**Examples:**
- `[example_1].html`
- `[example_2].html`
- `[example_3].html`

**Rules:**
- [Rule 1]
- [Rule 2]
- [Rule 3]

### 14.2 Design Iterations

All design iterations saved to: `[folder-path]/`

**Iteration Naming:**
- First version: `[name]_1.html`
- Second version: `[name]_2.html`
- Alternative approach: `[name]_1_1.html` (variant of version 1)

---

## 15. Common Patterns

<!--
OPTIONAL SECTION

INSTRUCTIONS: Document frequently used UI patterns as reusable templates.
This speeds up development by providing copy-pasteable code.

EXAMPLES:
- Page header with action button
- Stats grid/dashboard cards
- Search bar with filters
- Empty states
- Loading states
- Back buttons
- Confirmation dialogs
-->

### 15.1 [Pattern 1 Name] (e.g., Page Header with Action)

**Usage:** [When to use this pattern]

```html
<!-- [Complete HTML for this pattern] -->
```

**CSS:**
```css
/* [Any specific styles for this pattern] */
```

---

### 15.2 [Pattern 2 Name] (e.g., Stats Grid)

**Usage:** [When to use this pattern]

```html
<!-- [Complete HTML for this pattern] -->
```

---

### 15.3 [Pattern 3 Name] (e.g., Search Bar with Filters)

**Usage:** [When to use this pattern]

```html
<!-- [Complete HTML for this pattern] -->
```

---

### 15.4 [Pattern 4 Name] (e.g., Back Button)

**Usage:** [When to use this pattern]

```html
<!-- [Complete HTML for this pattern] -->
```

**CSS:**
```css
/* [Styles for this pattern] */
```

---

## 16. Testing Checklist

<!--
OPTIONAL SECTION (but highly recommended)

INSTRUCTIONS: Create a checklist to verify before finalizing any screen.
This ensures nothing is missed.
-->

Before finalizing any design, verify:

- [ ] [Checkpoint 1] (e.g., Navigation present and correct)
- [ ] [Checkpoint 2] (e.g., Header follows standard structure)
- [ ] [Checkpoint 3] (e.g., Colors use design system variables)
- [ ] [Checkpoint 4] (e.g., Responsive on mobile)
- [ ] [Checkpoint 5] (e.g., Hover states work)
- [ ] [Checkpoint 6] (e.g., Icons initialize correctly)
- [ ] [Checkpoint 7] (e.g., No console errors)
- [ ] [Checkpoint 8] (e.g., Accessible via keyboard)
- [ ] [Checkpoint 9] (e.g., Dark mode works - if applicable)
- [ ] [Checkpoint 10] (e.g., All links point to existing files)

---

## 17. Resources

<!--
OPTIONAL SECTION

INSTRUCTIONS: Link to reference files, external documentation, design tools.
-->

### 17.1 Design System

- Base CSS: `[filename.css]`
- Color Palette: [Description]
- Icons: [Icon library] ([link])

### 17.2 Reference Files

**[Category 1]:** (e.g., List Screens)
- `[file1].html` - [Description]
- `[file2].html` - [Description]

**[Category 2]:** (e.g., Detail Screens)
- `[file1].html` - [Description]
- `[file2].html` - [Description]

**[Category 3]:** (e.g., Forms)
- `[file1].html` - [Description]
- `[file2].html` - [Description]

### 17.3 External Resources

- [Resource 1]: [Link and description]
- [Resource 2]: [Link and description]

---

## 18. Version History

<!--
INSTRUCTIONS: Track major changes to the design guidelines document itself.
Update this when the guidelines evolve significantly.

INCREMENT VERSION:
- Major (X.0): When navigation structure changes, new sections added, or major redesign
- Minor (1.X): When patterns are added or refined
- Patch (1.1.X): Small corrections, clarifications
-->

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | [YYYY-MM-DD] | Initial guideline creation |
| [X.X] | [YYYY-MM-DD] | [Description of changes] |

---

**Maintained by:** [Your name or role]
**Questions?** Reference this document for all design decisions
