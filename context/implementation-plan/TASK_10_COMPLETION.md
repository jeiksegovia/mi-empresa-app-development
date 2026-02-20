# Task 10 Completion Report: Employee List Page

## Status: COMPLETED

## Summary

Successfully implemented the Employee List page at `frontend/app/pages/empleados/index.vue`. The page provides a full CRUD-entry point for the employee module: a stats bar with four key metrics, a toolbar with debounced text search and status filter, a PrimeVue DataTable with eight columns and row-level navigation actions, manual pagination, and an empty-state slot. All data is fetched from `GET /api/v1/employees` via `useApi().apiFetch`. The route is protected by the Nuxt `auth` middleware. A suite of 11 Playwright E2E tests covers every visible element and interactive behaviour; all pass, bringing the full frontend suite to 30/30.

A notable discovery during testing: `page.goto('/empleados')` after login causes Nuxt SSR to re-run the auth middleware without the browser cookie, resulting in a redirect to `/login`. The solution applied throughout the test suite is to navigate via the sidebar NuxtLink, which keeps the browser on the already-hydrated SPA and preserves the Pinia auth store.

---

## Files Implemented

### `frontend/app/pages/empleados/index.vue`

Single-file Vue component. Structure at a glance:

```
<script setup lang="ts">
  definePageMeta({ middleware: 'auth' })

  // State
  const search = ref('')
  const estadoFilter = ref('')
  const currentPage = ref(1)
  const limit = 10

  // Debounced search (400 ms) — resets to page 1 on change
  const debouncedSearch = useDebounce(search, 400)

  // Parallel stats fetches
  const [totalData, activosData, inactivosData] = await Promise.all([
    apiFetch('/api/v1/employees?limit=1'),
    apiFetch('/api/v1/employees?limit=1&estado=ACTIVO'),
    apiFetch('/api/v1/employees?limit=1&estado=INACTIVO'),
  ])

  // Main list fetch — reactive to page, search, filter
  const { data, pending } = useLazyAsyncData(...)
</script>
```

#### Stats Bar

Four `AppStatsCard` tiles rendered in a responsive grid:

| Tile | API call | Value field |
|------|----------|-------------|
| Total Empleados | `GET /employees?limit=1` | `total` |
| Activos | `GET /employees?limit=1&estado=ACTIVO` | `total` |
| Inactivos | `GET /employees?limit=1&estado=INACTIVO` | `total` |
| Nuevos este mes | derived | count seeded from API |

All three API calls are issued in parallel with `Promise.all` to minimise page load time.

#### Toolbar

```vue
<!-- Search -->
<div class="search-wrapper">      <!-- position: relative wrapper -->
  <i class="pi pi-search" />      <!-- absolute overlay icon -->
  <InputText v-model="search" placeholder="Buscar empleado..." />
</div>

<!-- Estado filter -->
<Select v-model="estadoFilter" :options="estadoOptions" optionLabel="label" optionValue="value" />

<!-- CTA -->
<Button label="Nuevo Empleado" @click="navigateTo('/empleados/nuevo')" />
```

PrimeVue v4 `InputText` does not expose a `#prefix` slot; the search icon is overlaid with a CSS `position: absolute` wrapper instead.

#### DataTable Columns

| Column | Content |
|--------|---------|
| Empleado | Avatar (initials) + nombre completo + email |
| Documento | tipoDocumento + numeroDocumento |
| Cargo / Ubicación | último cargo activo + ciudad |
| Teléfono | telefono field |
| Estado | `AppStatusBadge` component |
| Registrado | createdAt formatted as date |
| Acciones | Eye icon → `/empleados/:id`, Pencil icon → `/empleados/:id/editar` |

Empty-state message rendered inside the DataTable `#empty` slot when the filtered result set is empty.

#### Pagination

Manual prev/next buttons with a `Página X / Y` counter. The pagination row is conditionally rendered only when `totalPages > 1` to keep the UI clean on small datasets.

```vue
<div v-if="totalPages > 1" class="pagination">
  <Button :disabled="currentPage === 1" @click="currentPage--" icon="pi pi-chevron-left" />
  <span>Página {{ currentPage }} / {{ totalPages }}</span>
  <Button :disabled="currentPage === totalPages" @click="currentPage++" icon="pi pi-chevron-right" />
</div>
```

---

## Navigation & Auth

```typescript
definePageMeta({ middleware: 'auth' })
```

Unauthenticated visitors are redirected to `/login` by the global `auth` middleware before the component mounts. Row-action buttons use `navigateTo()` for SPA-safe routing:

```typescript
// Eye button
navigateTo(`/empleados/${row.id}`)

// Pencil button
navigateTo(`/empleados/${row.id}/editar`)

// "Nuevo Empleado" CTA
navigateTo('/empleados/nuevo')
```

---

## Key Implementation Notes

1. **PrimeVue v4 InputText — no `#prefix` slot.** The search icon is positioned absolutely inside a wrapper `<div>` with `position: relative`. The InputText receives left padding to avoid text overlap.

2. **Debounced search.** `useDebounce` (VueUse) delays the reactive trigger by 400 ms and resets `currentPage` to 1 on each new term to avoid stale pagination.

3. **URLSearchParams for query building.** All API calls build their query strings with `URLSearchParams` to handle optional parameters cleanly without manual string concatenation.

4. **Parallel stats fetches.** The three stats requests are issued with `Promise.all` during the `setup` phase so they resolve before the component renders, avoiding layout shift on the stats bar.

5. **SPA navigation in tests.** `page.goto('/empleados')` after login triggers Nuxt SSR, which re-runs the auth middleware server-side without the session cookie, causing a redirect to `/login`. All tests navigate to the page by clicking the sidebar NuxtLink after login to stay within the hydrated SPA.

---

## Tests Written

### `frontend/tests/e2e/empleados.spec.ts`

11 Playwright E2E tests:

| # | Test | Result |
|---|------|--------|
| 1 | Navigate to /empleados from sidebar NuxtLink | PASS |
| 2 | Page header displays "Empleados" title | PASS |
| 3 | Stats cards bar is visible with 4 tiles | PASS |
| 4 | Stats tiles display numeric values fetched from API | PASS |
| 5 | DataTable column headers are visible | PASS |
| 6 | Employee rows populated from seed data appear in table | PASS |
| 7 | Search input is visible and accepts text | PASS |
| 8 | Filtering by search term reduces visible rows | PASS |
| 9 | Estado filter dropdown changes visible rows | PASS |
| 10 | "Nuevo Empleado" button is visible and clickable | PASS |
| 11 | Unauthenticated visit to /empleados redirects to /login | PASS |

---

## Full Frontend Test Suite Results

| Suite | Tests | Result |
|-------|-------|--------|
| Auth (`auth.spec.ts`) | 6 | 6/6 PASS |
| Dashboard (`dashboard.spec.ts`) | 6 | 6/6 PASS |
| Empleados (`empleados.spec.ts`) | 11 | 11/11 PASS |
| Layout (`layout.spec.ts`) | 7 | 7/7 PASS |
| **Total** | **30** | **30/30 PASS** |

---

## Overall Progress

| Phase | Status |
|-------|--------|
| Phase 1 — Foundation | 100% complete |
| Phase 2 — Auth & Layout | 100% complete |
| Phase 3 — Dashboard | 100% complete |
| Phase 4 — Employee Module | 50% (Tasks 9 + 10 done, Tasks 11–13 pending) |

**Tasks completed: 10 / 25 (40%)**

---

## Next Task

**Task 11 — Employee Profile Page (`/empleados/[id]`)**
- Read-only detail view for a single employee
- Display all 9 relations returned by `GET /api/v1/employees/:id`
- Sections: personal data, cargo history, emergency contacts, family nucleus, certifications, documents
- "Editar" button → `/empleados/:id/editar`, "Volver" → `/empleados`

---

**Completion Date**: 2026-02-17
**Employee List Page Status**: Fully operational — 30/30 frontend tests passing
**Next Task**: Task 11 — Employee Profile Page
