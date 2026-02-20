# Light & Dark Theme Support - Implementation Guide

## Overview

The `default_ui_theme.css` now supports **both Light and Dark themes** with a simple toggle mechanism. Switch between themes by adding or removing the `dark` class on the `<html>` element.

## Quick Start

### Default Theme (Light Mode)
```html
<html lang="es">
  <!-- Light mode is active -->
</html>
```

### Dark Mode
```html
<html lang="es" class="dark">
  <!-- Dark mode is active -->
</html>
```

## How It Works

### CSS Variable Structure

The theme system uses CSS custom properties (variables) that automatically change based on the HTML class:

```css
/* Light Mode (default in :root) */
:root {
  --background: #f8fafc;
  --foreground: #0f172a;
  --surface-card: #ffffff;
  /* ... more variables */
}

/* Dark Mode (overrides when .dark class is present) */
html.dark {
  --background: #0f172a;
  --foreground: #ffffff;
  --surface-card: #1e293b;
  /* ... more variables */
}
```

### Shared Constants

These remain the same across both themes:
- **Color Palette**: PrimeVue violet scale (--p-primary-50 through --p-primary-950)
- **Spacing**: --spacing-xs through --spacing-3xl
- **Typography**: --font-size-xs through --font-size-4xl
- **Border Radius**: --radius

## JavaScript Implementation

### Simple Toggle Function

```javascript
function toggleTheme() {
  const html = document.documentElement;
  html.classList.toggle('dark');
}
```

### With LocalStorage Persistence

```javascript
function toggleTheme() {
  const html = document.documentElement;
  html.classList.toggle('dark');

  // Save preference
  const isDark = html.classList.contains('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Load saved preference on page load
function loadThemePreference() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

// Call on page load
loadThemePreference();
```

### With System Preference Detection

```javascript
// Detect system color scheme preference
const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');

function initTheme() {
  const savedTheme = localStorage.getItem('theme');

  if (savedTheme) {
    // Use saved preference
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } else {
    // Use system preference
    if (prefersDarkScheme.matches) {
      document.documentElement.classList.add('dark');
    }
  }
}

// Listen for system preference changes
prefersDarkScheme.addEventListener('change', (e) => {
  if (!localStorage.getItem('theme')) {
    // Only auto-switch if user hasn't set preference
    if (e.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
});

initTheme();
```

## UI Toggle Button Examples

### Icon-only Button (Floating)

```html
<button id="themeToggle" class="theme-toggle-btn">
  <i data-lucide="sun" id="themeIcon"></i>
</button>

<script>
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');

  toggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');

    // Update icon
    icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    lucide.createIcons();

    // Save preference
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
</script>
```

### Labeled Button

```html
<button id="themeToggle" class="btn btn-outline">
  <i data-lucide="sun" id="themeIcon"></i>
  <span id="themeLabel">Light Mode</span>
</button>

<script>
  const toggle = document.getElementById('themeToggle');
  const icon = document.getElementById('themeIcon');
  const label = document.getElementById('themeLabel');

  toggle.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');

    // Update UI
    icon.setAttribute('data-lucide', isDark ? 'moon' : 'sun');
    label.textContent = isDark ? 'Dark Mode' : 'Light Mode';
    lucide.createIcons();

    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
</script>
```

### Dropdown Menu Option

```html
<div class="dropdown">
  <button class="btn btn-ghost btn-icon">
    <i data-lucide="settings"></i>
  </button>
  <div class="dropdown-menu">
    <button onclick="setTheme('light')">
      <i data-lucide="sun"></i> Light
    </button>
    <button onclick="setTheme('dark')">
      <i data-lucide="moon"></i> Dark
    </button>
    <button onclick="setTheme('system')">
      <i data-lucide="monitor"></i> System
    </button>
  </div>
</div>

<script>
  function setTheme(theme) {
    if (theme === 'system') {
      localStorage.removeItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', prefersDark);
    } else {
      localStorage.setItem('theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
  }
</script>
```

## Color Variables Reference

### Theme-Adaptive Variables

These automatically change between themes:

| Variable | Light Mode | Dark Mode |
|----------|------------|-----------|
| `--background` | #f8fafc (slate-50) | #0f172a (slate-900) |
| `--foreground` | #0f172a (dark text) | #ffffff (white text) |
| `--surface-card` | #ffffff (white) | #1e293b (slate-800) |
| `--surface-border` | #e2e8f0 (slate-200) | #334155 (slate-700) |
| `--surface-hover` | #f1f5f9 (slate-100) | #334155 (slate-700) |
| `--muted-foreground` | #64748b (slate-500) | #c4b5fd (violet-300) |

### Always Use CSS Variables

✅ **Correct:**
```css
.my-component {
  background: var(--surface-card);
  color: var(--foreground);
  border: 1px solid var(--border);
}
```

❌ **Incorrect:**
```css
.my-component {
  background: #ffffff; /* Hard-coded won't adapt to theme */
  color: #0f172a;
  border: 1px solid #e2e8f0;
}
```

## Component Examples

### Card with Theme Support

```html
<div class="card">
  <h3>Card Title</h3>
  <p class="text-muted">This card automatically adapts to the theme.</p>
</div>
```

### Button Variants

```html
<!-- All buttons work in both themes -->
<button class="btn btn-primary">Primary</button>
<button class="btn btn-outline">Outline</button>
<button class="btn btn-ghost">Ghost</button>
```

### Form Inputs

```html
<!-- Form inputs automatically adapt -->
<input type="text" class="form-input" placeholder="Enter text">
<select class="form-input">
  <option>Select option</option>
</select>
```

## Best Practices

1. **Always use CSS variables** for colors instead of hard-coded hex values
2. **Test both themes** when creating new components
3. **Use semantic variable names** like `--foreground` instead of `--black` or `--white`
4. **Persist user preference** using localStorage
5. **Respect system preferences** when no user preference is saved
6. **Smooth transitions** - add `transition: background-color 0.3s ease` to major elements

## Migration Guide

If you have existing HTML files with `class="dark"` on the `<html>` element:

### For Dark Mode (Current Default)
- **No changes needed** - files will continue to work in dark mode

### To Enable Light Mode
- **Remove** the `dark` class from `<html>`
- Example: Change `<html lang="es" class="dark">` to `<html lang="es">`

### To Add Theme Toggle
1. Add a toggle button to your UI
2. Implement the toggle function (see examples above)
3. Optionally add localStorage persistence

## Demo File

See `theme_toggle_demo_1.html` for a complete working example with:
- Floating toggle button
- Current theme indicator
- Component showcase
- Implementation examples
- localStorage persistence

## Troubleshooting

### Theme not switching
- Check that you're toggling the class on `document.documentElement` (the `<html>` element)
- Verify `default_ui_theme.css` is properly loaded
- Check browser console for CSS errors

### Colors not changing
- Ensure you're using CSS variables (e.g., `var(--background)`) not hard-coded colors
- Check if styles are using `!important` which may override theme variables
- Verify the CSS specificity isn't preventing theme styles from applying

### Flashing on page load
- Load theme preference before page renders
- Add theme initialization script in `<head>` before body content
- Consider adding a small inline script to set theme before CSS loads

```html
<head>
  <script>
    // Run before page renders
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  </script>
  <link rel="stylesheet" href="./default_ui_theme.css">
</head>
```

## Additional Resources

- **Design Guidelines**: See `DESIGN_GUIDELINES.md` for complete UI/UX standards
- **Color Palette**: PrimeVue violet scale (50-950)
- **Component Library**: All standard components in `default_ui_theme.css`
- **Demo Page**: `theme_toggle_demo_1.html`
