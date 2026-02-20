# Plan: Upgrade Nuxt 3 → Nuxt 4

## Context

The `mi-empresa-app` frontend currently runs on **Nuxt 3.15.4** with `future.compatibilityVersion: 4` already enabled (the v4 opt-in flag available since Nuxt 3.12+).

**Key insight**: This project already adopted the `app/` directory structure — the most disruptive change in v4. Since `compatibilityVersion: 4` was set, the project has been running in v4-compatible mode on a v3 runtime. The upgrade is essentially:

1. Bump the `nuxt` package to `^4.0.0`
2. Clean up now-redundant `future.compatibilityVersion` config
3. Remove the stale `@nuxtjs/tailwindcss` package (was listed in deps but not actually used)
4. Optionally run the codemods for data-fetching and TypeScript safety changes

---

## Current State Analysis

### nuxt.config.ts
```ts
import Material from '@primevue/themes/material'  // ← NOT Aura (vs. guidelines)
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 4 },  // ← already in v4 compat mode
  ...
})
```

### package.json issues found
| Package | Status | Action |
|---|---|---|
| `nuxt: ^3.15.4` | Needs upgrade | → `^4.0.0` |
| `@nuxtjs/tailwindcss: ^6.12.4` | **Stale/unused** — Tailwind v4 uses `@tailwindcss/vite` Vite plugin, NOT this module | Remove |
| `future.compatibilityVersion: 4` | Redundant in Nuxt 4 | Remove from config |

### Directory structure
Already uses `app/` structure — no file moves needed.

### Data fetching
The project uses `useApi()` composable with `$fetch.create()` directly (not `useFetch`/`useAsyncData`). The breaking data-fetching changes in Nuxt 4 (`data` defaults to `undefined` instead of `null`, `shallowRef` vs deep `ref`) do **not apply**.

### primeicons in CSS
`nuxt.config.ts` is missing `'primeicons/primeicons.css'` in the `css` array — it was fixed by installing the package but the css array entry was not added. This should be corrected during the upgrade.

---

## Upgrade Plan

### Phase A — Package Upgrade

**File: `frontend/package.json`**

Changes:
1. Upgrade `nuxt` from `^3.15.4` to `^4.0.0`
2. Remove `@nuxtjs/tailwindcss` (Tailwind v3 module, incompatible with Tailwind v4)

```bash
cd frontend
npm install nuxt@^4.0.0
npm uninstall @nuxtjs/tailwindcss
```

Verify no other Tailwind v3 references exist after removal.

---

### Phase B — nuxt.config.ts Cleanup

**File: `frontend/nuxt.config.ts`**

Changes:
1. Remove `future: { compatibilityVersion: 4 }` — no longer needed on Nuxt 4
2. Add `'primeicons/primeicons.css'` to `css` array (already installed, just missing the config entry)
3. Consider switching theme from `Material` to `Aura` per project guidelines
4. Keep `compatibilityDate: '2025-07-15'` — this is valid for Nuxt 4

**Before:**
```ts
import Material from '@primevue/themes/material'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  future: { compatibilityVersion: 4 },
  devtools: { enabled: true },
  modules: ['@pinia/nuxt', '@primevue/nuxt-module'],
  css: ['~/assets/css/main.css'],
  primevue: {
    options: {
      theme: {
        preset: Material,
        options: { prefix: 'p', darkModeSelector: '.dark', cssLayer: false },
      },
    },
    autoImport: true,
  },
  vite: { plugins: [tailwindcss() as any] },
  runtimeConfig: { public: { apiBase: 'http://localhost:3001/api/v1' } },
  typescript: { strict: true, typeCheck: false },
  app: { head: { ... } },
})
```

**After:**
```ts
import Aura from '@primevue/themes/aura'
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: ['@pinia/nuxt', '@primevue/nuxt-module'],

  css: [
    'primeicons/primeicons.css',  // ← add this
    '~/assets/css/main.css',
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,  // ← switch to Aura per guidelines
        options: { prefix: 'p', darkModeSelector: '.dark', cssLayer: false },
      },
    },
    autoImport: true,
  },

  vite: { plugins: [tailwindcss() as any] },

  runtimeConfig: { public: { apiBase: 'http://localhost:3001/api/v1' } },

  typescript: { strict: true, typeCheck: false },

  app: {
    head: {
      title: 'Mi Empresa',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Mi Empresa - Sistema de gestión empresarial' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
})
```

---

### Phase C — Codemods (Optional but Recommended)

Run the official Nuxt 4 codemod suite to fix any remaining v3 patterns:

```bash
cd frontend
npx codemod@0.18.7 nuxt/4/migration-recipe
```

Individual codemods and their relevance for this project:
| Codemod | Relevance | Notes |
|---|---|---|
| `nuxt/4/file-structure` | **None** | Already uses `app/` structure |
| `nuxt/4/default-data-error-value` | **Low** | Project uses `$fetch` directly, not `useFetch`/`useAsyncData` |
| `nuxt/4/deprecated-dedupe-value` | **Low** | No `dedupe` boolean usage found |
| `nuxt/4/shallow-function-reactivity` | **Low** | No deep ref on async data |
| `nuxt/4/absolute-watch-path` | **Low** | No custom `builder:watch` hooks |
| `nuxt/4/template-compilation-changes` | **None** | No EJS/lodash templates |

Given this project uses `$fetch` via `useApi()` composable (not `useFetch`/`useAsyncData`), the most impactful v4 data-fetching changes do not apply. **The codemods are optional**.

---

### Phase D — TypeScript Config Update

Nuxt 4 now generates split tsconfig files. Update `frontend/tsconfig.json` to use project references:

**Before (current):**
```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

**After (Nuxt 4 recommended):**
```json
{
  "files": [],
  "references": [
    { "path": "./.nuxt/tsconfig.app.json" },
    { "path": "./.nuxt/tsconfig.server.json" },
    { "path": "./.nuxt/tsconfig.shared.json" },
    { "path": "./.nuxt/tsconfig.node.json" }
  ]
}
```

Note: The old `extends` format still works — Nuxt 4 generates both for backward compatibility. This is an optional improvement.

---

### Phase E — Verification

After upgrade, run the full test suite:

```bash
# Start backend
cd backend && npm run dev &

# Start frontend
cd frontend && npm run dev &

# Run all E2E tests
cd frontend && npm run test:e2e
```

Expected: All 122 existing tests continue to pass.

---

## Breaking Changes Assessment for This Project

| Breaking Change | Impact on This Project | Required Action |
|---|---|---|
| `srcDir` defaults to `app/` | **None** — already using `app/` structure | None |
| `data`/`error` default to `undefined` (not `null`) | **None** — project uses `$fetch` directly | None |
| `data` is `shallowRef` | **None** — project uses `$fetch` directly | None |
| Component names normalized | **Low** — check `<KeepAlive>` usage if any | Verify |
| Inline styles: components only | **Low** — CSS works via Tailwind | Verify visual |
| Unhead v2 changes | **None** — no `vmid`, `hid`, `body` props used | None |
| `window.__NUXT__` removed | **None** — not used | None |
| `generate` config removed | **None** — not used | None |
| `noUncheckedIndexedAccess: true` in TS | **Low** — may surface new TS errors | Run typecheck |

---

## Risk Assessment

**Low risk upgrade** because:
- Already running `compatibilityVersion: 4` — effectively in v4 mode already
- Already using `app/` directory structure
- Uses `$fetch` directly (not `useFetch`/`useAsyncData`), so data-fetching breaking changes don't apply
- No EJS templates, no `generate` config, no `window.__NUXT__` usage

**Main risks:**
1. Module compatibility — check `@pinia/nuxt`, `@primevue/nuxt-module` support Nuxt 4
2. TypeScript strictness increase (`noUncheckedIndexedAccess`) may surface new errors
3. CSS inlining change may affect visual appearance (minor)

---

## Module Compatibility Check

Before upgrading, verify these modules support Nuxt 4:

| Module | Current Version | Nuxt 4 Compatible? | Notes |
|---|---|---|---|
| `@pinia/nuxt` | `^0.9.0` | Yes (pinia/nuxt 0.9+ supports Nuxt 4) | No change needed |
| `@primevue/nuxt-module` | `^4.5.4` | Yes (PrimeVue 4.x explicitly supports Nuxt 4) | No change needed |
| `@tailwindcss/vite` | `^4.2.0` | Yes (Vite plugin, Nuxt-agnostic) | No change needed |

---

## Execution Order

1. **Phase A**: `npm install nuxt@^4.0.0 && npm uninstall @nuxtjs/tailwindcss`
2. **Phase B**: Edit `nuxt.config.ts` — remove `future` block, add primeicons CSS, optionally switch theme
3. **Phase D**: Update `tsconfig.json` to project references (optional)
4. **Phase E**: Run `npm run dev` to verify startup, then run full E2E suite

Phase C (codemods) is optional and can be skipped for this project.

---

## Estimated Effort

Minimal. The bulk of v4 migration work (directory restructure, data-fetching changes) was already done when `compatibilityVersion: 4` was adopted. This is primarily a package version bump + config cleanup.
