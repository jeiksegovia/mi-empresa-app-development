---
applyTo: '**.js, **.vue, **.ts, **.md, **.json'
---

# Mi Empresa App Front - Agent Guidelines

## Project Context

"Mi Empresa App" is an enterprise solution focused on personnel management, payroll, absence tracking, vacations, and financial budget management with cost centers. The application is designed to meet legal and labor obligations in the Colombian context, facilitating efficient and organized administration of companies with legally contracted personnel.

## Technology Stack

- **Framework**: Nuxt 3 (`^3.15+`) with `future.compatibilityVersion: 4` + `app/` directory structure
- **UI Library**: PrimeVue v4 (`primevue ^4.5+`) — auto-imported via `@primevue/nuxt-module`
- **Icons**: `primeicons ^7` — loaded via CSS `primeicons/primeicons.css`
- **Theme**: Aura preset from `@primevue/themes/aura` (Aura is the working preset — NOT Material from `@primeuix/themes` which requires extra setup)
- **CSS Framework**: Tailwind CSS **v4** via `@tailwindcss/vite` Vite plugin (NOT `@nuxtjs/tailwindcss` module which is Tailwind v3)
- **Tailwind+PrimeVue integration**: `tailwindcss-primeui ^0.6+` plugin loaded in `assets/css/main.css`
- **State Management**: Pinia (`pinia ^2.3+`) via `@pinia/nuxt` module
- **Language**: TypeScript (strict mode, typeCheck disabled for faster builds)
- **API client**: `$fetch` via custom `useApi()` composable with `baseURL: http://localhost:3001/api/v1`

## Critical Package List

```json
"dependencies": {
  "@pinia/nuxt": "^0.9.0",
  "@primevue/themes": "^4.5.4",
  "@primeuix/themes": "^2.0.3",
  "@tailwindcss/vite": "^4.2.0",
  "nuxt": "^3.15.4",
  "pinia": "^2.3.1",
  "primeicons": "^7.0.0",
  "primevue": "^4.5.4",
  "tailwindcss-primeui": "^0.6.1",
  "vue": "latest",
  "zod": "^3.24.2"
},
"devDependencies": {
  "@playwright/test": "^1.49.1",
  "@primevue/nuxt-module": "^4.5.4"
}
```

> ⚠️ **`primeicons` MUST be listed as an explicit dependency.** Without it, `nuxt dev` fails with:
> `Pre-transform error: Failed to resolve import "primeicons/primeicons.css"`
> even though `@primevue/nuxt-module` is installed.

> ⚠️ **Do NOT use `@nuxtjs/tailwindcss` module** with Tailwind v4. That module is for Tailwind v3.
> Tailwind v4 is integrated via `@tailwindcss/vite` as a Vite plugin in `nuxt.config.ts`.

## Working nuxt.config.ts

```ts
import Aura from '@primevue/themes/aura'   // ← use @primevue/themes, NOT @primeuix/themes
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  future: {
    compatibilityVersion: 4,   // enables app/ directory structure
  },

  devtools: { enabled: true },

  modules: [
    '@pinia/nuxt',
    '@primevue/nuxt-module',   // NO @nuxtjs/tailwindcss here — Tailwind v4 uses Vite plugin
  ],

  css: [
    'primeicons/primeicons.css',  // ← required, must have primeicons installed
    '~/assets/css/main.css',     // ← contains @import "tailwindcss" + tailwindcss-primeui
  ],

  primevue: {
    options: {
      theme: {
        preset: Aura,
        options: {
          prefix: 'p',
          darkModeSelector: '.dark',
          cssLayer: false,
        },
      },
    },
    autoImport: true,   // all PrimeVue components auto-imported, no manual imports needed
  },

  vite: {
    plugins: [
      tailwindcss() as any,   // Tailwind CSS v4 Vite plugin
    ],
  },

  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:3001/api/v1',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false,   // disable for faster builds; enable locally if needed
  },

  app: {
    head: {
      title: 'Mi Empresa',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    },
  },
})
```

## assets/css/main.css

```css
@import "tailwindcss";
@import "tailwindcss-primeui";
```

## useApi() composable

```ts
// app/composables/useApi.ts
export function useApi() {
  const config = useRuntimeConfig()
  const apiFetch = $fetch.create({
    baseURL: config.public.apiBase,   // http://localhost:3001/api/v1
    credentials: 'include',           // sends session cookie
  })
  return { apiFetch }
}
```

> ⚠️ **CRITICAL**: All `apiFetch` calls must use paths WITHOUT `/api/v1/` prefix.
> ✅ `apiFetch('/employees')` → `http://localhost:3001/api/v1/employees`
> ❌ `apiFetch('/api/v1/employees')` → `http://localhost:3001/api/v1/api/v1/employees` (404)

## Coding Guidelines

### General Patterns

- Use Vue 3 Composition API with `<script setup>` syntax
- Follow Nuxt 3 conventions and best practices
- Implement modular architecture with feature-based organization
- Create reusable components and composables
- Follow mobile-first responsive design principles

### Nuxt 3 Specific Guidelines

- Use Nuxt built-in components (`<NuxtLink>`, `<NuxtPage>`, etc.)
- Implement pages with proper meta tags using `useHead` or `definePageMeta`
- Use Nuxt directory structure conventions:
  - `~/components/` for Vue components
  - `~/composables/` for composition functions
  - `~/pages/` for application routes
  - `~/layouts/` for page layouts
  - `~/middleware/` for navigation guards
  - `~/plugins/` for Vue plugins
  - `~/server/` for API routes and server middleware
  - `~/public/` for static assets
  - `~/assets/` for compiled assets
- Use Nuxt modules properly (content, image, SEO, etc.)
- Use `.server` and `.client` suffixes appropriately for component splitting
- Implement proper error handling with Nuxt's error system

### PrimeVue Implementation

- Import and register PrimeVue components globally in plugins
- Use PrimeVue components with proper event handling
- Implement form validation using PrimeVue's form components
- Follow PrimeVue's accessibility guidelines
- Use Prime Icons for consistent iconography
- Implement responsive layouts using PrimeFlex or Tailwind utilities
- Common components to focus on:
  - DataTable for data display with sorting, filtering, and pagination
  - Form components (InputText, Dropdown, Calendar, etc.)
  - Dialog for modals and popups
  - Toast for notifications
  - Button and ButtonGroup for actions
  - Card, Panel, and TabView for content organization
  - Menu, Menubar, and Sidebar for navigation

### State Management with Pinia

- Use setup stores pattern for Pinia stores
- Organize stores by feature/domain
- Implement proper action handling for async operations
- Use store getters for derived state
- Maintain clean separation between UI and business logic
- Follow reactive state principles
- Example store structure:

  ```js
  // stores/employee.js
  import { defineStore } from 'pinia';

  export const useEmployeeStore = defineStore('employee', () => {
    const employees = ref([]);
    const isLoading = ref(false);
    const error = ref(null);

    const filteredEmployees = computed(() => {
      // Derived state logic
    });

    async function fetchEmployees() {
      // Async action implementation
    }

    return {
      employees,
      isLoading,
      error,
      filteredEmployees,
      fetchEmployees
    };
  });
  ```

### API Integration

- Use Nuxt's built-in `useFetch` and `useAsyncData` for data fetching
- Create reusable API composables for domain-specific endpoints
- Implement proper error handling and loading states
- Use interceptors for common request/response processing
- Structure API calls in feature-specific composables

### Colombian Legal Requirements

- Implement proper tax calculation according to DIAN regulations
- Follow Colombian labor law for contract management
- Adhere to data protection standards (Law 1581 of 2012)
- Include proper reporting formats required by Colombian authorities
- Support different contract types (OPS, Obra/Labor, Término Fijo/Indefinido)

### Project Structure Example

```
mi-empresa-app-front/
├── assets/
│   ├── css/
│   │   └── tailwind.css
│   └── images/
├── components/
│   ├── common/
│   ├── employee/
│   ├── payroll/
│   ├── absence/
│   └── budget/
├── composables/
│   ├── useAuth.js
│   ├── useEmployees.js
│   ├── usePayroll.js
│   └── useNotifications.js
├── layouts/
│   ├── default.vue
│   └── auth.vue
├── middleware/
│   └── auth.js
├── pages/
│   ├── index.vue
│   ├── login.vue
│   ├── employees/
│   ├── payroll/
│   ├── absences/
│   └── budget/
├── plugins/
│   ├── primevue.js
│   └── api.js
├── public/
│   ├── favicon.ico
│   └── robots.txt
├── server/
│   └── api/
├── stores/
│   ├── auth.js
│   ├── employee.js
│   ├── payroll.js
│   └── budget.js
├── app.vue
├── nuxt.config.js
└── tailwind.config.js
```

## Common Components Implementation Patterns

### Page Template Pattern

```vue
<template>
  <div>
    <PageHeader :title="pageTitle" :breadcrumbs="breadcrumbs" />

    <div class="grid">
      <div class="col-12">
        <Card>
          <template #title>
            <!-- Card title -->
          </template>
          <template #content>
            <!-- Main content -->
          </template>
          <template #footer>
            <!-- Card footer actions -->
          </template>
        </Card>
      </div>
    </div>

    <!-- Modals/Dialogs -->
    <Dialog v-model:visible="dialogVisible" :modal="true">
      <!-- Dialog content -->
    </Dialog>
  </div>
</template>

<script setup>
  // Page setup
  const pageTitle = ref('Page Title');
  const breadcrumbs = ref([{ label: 'Home', to: '/' }, { label: 'Current Page' }]);

  // State
  const dialogVisible = ref(false);

  // Store
  const store = useFeatureStore();

  // Lifecycle hooks
  onMounted(async () => {
    // Initial data loading
  });

  // Methods
  function handleAction() {
    // Action handling
  }
</script>
```

### DataTable Implementation

```vue
<template>
  <div>
    <DataTable
      :value="items"
      :paginator="true"
      :rows="10"
      :loading="loading"
      :filters="filters"
      filterDisplay="menu"
      responsiveLayout="scroll"
      v-model:selection="selectedItems"
      :rowHover="true"
      paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
      :rowsPerPageOptions="[5, 10, 20, 50]"
      currentPageReportTemplate="{first} to {last} of {totalRecords}"
    >
      <!-- Table header -->
      <template #header>
        <div class="flex justify-between">
          <Button icon="pi pi-plus" label="Add" @click="openNew" />
          <span class="p-input-icon-left">
            <i class="pi pi-search" />
            <InputText v-model="filters['global'].value" placeholder="Search..." />
          </span>
        </div>
      </template>

      <!-- Table columns -->
      <Column selectionMode="multiple" headerStyle="width: 3rem"></Column>
      <Column field="id" header="ID" sortable></Column>
      <Column field="name" header="Name" sortable></Column>
      <!-- More columns -->

      <!-- Action column -->
      <Column headerStyle="min-width:10rem;">
        <template #body="slotProps">
          <Button
            icon="pi pi-pencil"
            class="p-button-rounded p-button-success mr-2"
            @click="editItem(slotProps.data)"
          />
          <Button
            icon="pi pi-trash"
            class="p-button-rounded p-button-danger"
            @click="confirmDelete(slotProps.data)"
          />
        </template>
      </Column>

      <!-- Empty template -->
      <template #empty> No records found. </template>
    </DataTable>
  </div>
</template>

<script setup>
  // Data and state
  const items = ref([]);
  const selectedItems = ref([]);
  const loading = ref(false);
  const filters = ref({
    global: { value: null, matchMode: 'contains' }
  });

  // Methods
  function openNew() {
    // Open new item dialog
  }

  function editItem(item) {
    // Edit item logic
  }

  function confirmDelete(item) {
    // Delete confirmation logic
  }
</script>
```

### Form Pattern

```vue
<template>
  <form @submit.prevent="submitForm">
    <div class="grid p-fluid">
      <div class="field col-12 md:col-6">
        <label for="name">Name</label>
        <InputText
          id="name"
          v-model="form.name"
          :class="{ 'p-invalid': submitted && !form.name }"
        />
        <small v-if="submitted && !form.name" class="p-error">Name is required.</small>
      </div>

      <div class="field col-12 md:col-6">
        <label for="email">Email</label>
        <InputText
          id="email"
          v-model="form.email"
          :class="{ 'p-invalid': submitted && !form.email }"
        />
        <small v-if="submitted && !form.email" class="p-error">Email is required.</small>
      </div>

      <div class="field col-12">
        <label for="address">Address</label>
        <Textarea id="address" v-model="form.address" rows="4" />
      </div>

      <div class="field col-12 md:col-6">
        <label for="contractType">Contract Type</label>
        <Dropdown
          id="contractType"
          v-model="form.contractType"
          :options="contractTypes"
          optionLabel="name"
          placeholder="Select Contract Type"
        />
      </div>

      <div class="field col-12 md:col-6">
        <label for="startDate">Start Date</label>
        <Calendar id="startDate" v-model="form.startDate" dateFormat="dd/mm/yy" />
      </div>

      <div class="col-12">
        <div class="flex justify-content-end">
          <Button
            type="button"
            label="Cancel"
            icon="pi pi-times"
            class="p-button-text"
            @click="hideDialog"
          />
          <Button type="submit" label="Save" icon="pi pi-check" class="p-button-text" />
        </div>
      </div>
    </div>
  </form>
</template>

<script setup>
  // Form state
  const form = ref({
    name: '',
    email: '',
    address: '',
    contractType: null,
    startDate: null
  });
  const submitted = ref(false);
  const contractTypes = ref([
    { name: 'OPS', code: 'OPS' },
    { name: 'Término Fijo', code: 'FIJO' },
    { name: 'Término Indefinido', code: 'INDEFINIDO' },
    { name: 'Obra o Labor', code: 'OBRA' }
  ]);

  // Methods
  function submitForm() {
    submitted.value = true;

    if (validateForm()) {
      // Process form submission
      saveRecord();
    }
  }

  function validateForm() {
    return !!form.value.name && !!form.value.email;
  }

  function saveRecord() {
    // Save record logic
  }

  function hideDialog() {
    // Hide dialog logic
  }
</script>
```

## Best Practices for GitHub Copilot Interactions

1. **Add descriptive comments** before asking Copilot to generate code
2. **Use consistent naming conventions** to help Copilot understand your intent
3. **Provide context** in your comments about the Colombian legal requirements
4. **Break complex tasks** into smaller, more manageable requests
5. **Review generated code** for accuracy, especially for financial
