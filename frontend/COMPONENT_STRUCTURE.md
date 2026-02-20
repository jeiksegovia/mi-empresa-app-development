# Component Structure and Usage Guide

## Layout Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│                      AppHeader                          │
│  [☰] Mi Empresa              [🌙] [👤] User Menu       │
└─────────────────────────────────────────────────────────┘
┌───────────────┬─────────────────────────────────────────┐
│               │                                         │
│  AppSidebar   │         Main Content Area              │
│               │                                         │
│  [Avatar]     │  ┌──────────────────────────────────┐  │
│  User Name    │  │     AppPageHeader                │  │
│  Role         │  │  Title                  [Button] │  │
│               │  │  Subtitle                        │  │
│  ─────────    │  └──────────────────────────────────┘  │
│               │                                         │
│  🏠 Inicio    │  ┌────┬────┬────┬────┐               │
│  👥 Empleados │  │Stat│Stat│Stat│Stat│               │
│  👤 Pacientes │  │Card│Card│Card│Card│               │
│  📋 Instrumen │  └────┴────┴────┴────┘               │
│  📄 Certifica │                                         │
│               │  <Page Content>                        │
│  ─────────    │                                         │
│               │                                         │
│  [Cerrar]     │                                         │
│               │                                         │
└───────────────┴─────────────────────────────────────────┘
```

## Component Usage Examples

### 1. Using AppPageHeader

```vue
<template>
  <AppPageHeader
    title="Empleados"
    subtitle="Gestión de empleados de la empresa"
  >
    <template #actions>
      <Button
        label="Nuevo Empleado"
        icon="pi pi-plus"
        severity="primary"
        @click="createNew"
      />
      <Button
        label="Exportar"
        icon="pi pi-download"
        severity="secondary"
        outlined
      />
    </template>
  </AppPageHeader>
</template>
```

### 2. Using AppStatsCard

```vue
<template>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
    <!-- Basic Stats Card -->
    <AppStatsCard
      title="Total Empleados"
      :value="245"
      icon="pi pi-users"
      severity="primary"
    />

    <!-- With Trend Indicator -->
    <AppStatsCard
      title="Nuevos este mes"
      :value="12"
      icon="pi pi-user-plus"
      severity="success"
      :trend="{ value: 15.3, isPositive: true }"
    />

    <!-- Clickable Card -->
    <AppStatsCard
      title="Activos"
      :value="230"
      icon="pi pi-check-circle"
      severity="success"
      clickable
      @click="navigateTo('/empleados?status=active')"
    />

    <!-- Warning Severity -->
    <AppStatsCard
      title="Pendientes"
      :value="8"
      icon="pi pi-clock"
      severity="warn"
      :trend="{ value: 5.2, isPositive: false }"
    />
  </div>
</template>
```

### 3. Using AppStatusBadge

```vue
<template>
  <DataTable :value="items">
    <Column field="nombre" header="Nombre" />
    
    <!-- Auto Color Mapping -->
    <Column field="estado" header="Estado">
      <template #body="{ data }">
        <AppStatusBadge :status="data.estado" />
      </template>
    </Column>
    
    <!-- Manual Severity -->
    <Column field="prioridad" header="Prioridad">
      <template #body="{ data }">
        <AppStatusBadge
          :status="data.prioridad"
          severity="danger"
        />
      </template>
    </Column>
  </DataTable>
</template>
```

### 4. Using useTheme Composable

```vue
<script setup>
const { isDark, toggleTheme } = useTheme()

// Theme is auto-initialized from localStorage
// Manual toggle:
const handleToggle = () => {
  toggleTheme()
}

// Check current theme:
watchEffect(() => {
  console.log('Current theme:', isDark.value ? 'dark' : 'light')
})
</script>

<template>
  <div>
    <p>Current theme: {{ isDark ? 'Dark' : 'Light' }}</p>
    <Button
      :label="isDark ? 'Switch to Light' : 'Switch to Dark'"
      @click="toggleTheme"
    />
  </div>
</template>
```

### 5. Creating a Module Page

```vue
<script setup lang="ts">
// app/pages/mi-modulo/index.vue
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const items = ref([])
const loading = ref(false)

const fetchData = async () => {
  loading.value = true
  // Fetch data from API
  loading.value = false
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <div>
    <!-- Page Header -->
    <AppPageHeader
      title="Mi Módulo"
      subtitle="Descripción del módulo"
    >
      <template #actions>
        <Button
          label="Nuevo"
          icon="pi pi-plus"
          severity="primary"
          @click="createNew"
        />
      </template>
    </AppPageHeader>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <AppStatsCard
        title="Total"
        :value="items.length"
        icon="pi pi-list"
        severity="primary"
      />
      <!-- More stats... -->
    </div>

    <!-- Main Content -->
    <Card>
      <template #content>
        <DataTable
          :value="items"
          :loading="loading"
          paginator
          :rows="10"
        >
          <Column field="id" header="ID" />
          <Column field="nombre" header="Nombre" />
          <Column field="estado" header="Estado">
            <template #body="{ data }">
              <AppStatusBadge :status="data.estado" />
            </template>
          </Column>
          <Column header="Acciones">
            <template #body="{ data }">
              <Button
                icon="pi pi-pencil"
                text
                rounded
                @click="edit(data)"
              />
              <Button
                icon="pi pi-trash"
                text
                rounded
                severity="danger"
                @click="remove(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>
  </div>
</template>
```

## Component Props Reference

### AppSidebar
```typescript
interface Props {
  visible: boolean  // Control sidebar visibility
}

interface Emits {
  close: () => void  // Emitted when sidebar should close
}
```

### AppHeader
```typescript
interface Emits {
  toggleSidebar: () => void  // Emitted when menu button clicked
}
```

### AppPageHeader
```typescript
interface Props {
  title: string      // Page title (required)
  subtitle?: string  // Page subtitle (optional)
}

// Slots:
// - actions: For action buttons
```

### AppStatsCard
```typescript
interface Props {
  title: string                     // Card title
  value: number | string            // Main value
  icon: string                      // PrimeIcon class
  severity?: Severity               // Color theme
  trend?: {
    value: number                   // Percentage
    isPositive: boolean             // Up or down
  }
  clickable?: boolean               // Enable clicking
}

type Severity = 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'secondary'

interface Emits {
  click: () => void  // Emitted when card clicked (if clickable)
}
```

### AppStatusBadge
```typescript
interface Props {
  status: Status | string  // Status text
  severity?: Severity      // Override auto-mapping
}

type Status = 'Activo' | 'Inactivo' | 'Pendiente' | 'Completado' | 'Vencido'
type Severity = 'success' | 'warn' | 'danger' | 'info' | 'secondary'
```

## Styling Guidelines

### Spacing
```css
/* Container padding */
.container { @apply p-4 md:p-6; }

/* Card spacing */
.card-grid { @apply grid gap-4 md:gap-6; }

/* Section margins */
.section { @apply mb-6 md:mb-8; }
```

### Grid Layouts
```vue
<!-- Stats Cards Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

<!-- Two Column Grid -->
<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

<!-- Three Column Grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Color Usage
```vue
<!-- Primary Action -->
<Button severity="primary" />

<!-- Success State -->
<Button severity="success" />

<!-- Warning -->
<Button severity="warn" />

<!-- Danger/Delete -->
<Button severity="danger" />

<!-- Secondary/Cancel -->
<Button severity="secondary" outlined />
```

## Best Practices

1. **Always use AppPageHeader** for page titles
2. **Use AppStatsCard** for dashboard metrics
3. **Use AppStatusBadge** for status indicators
4. **Keep sidebar items in app.config.ts**
5. **Use PrimeVue CSS variables** for theming
6. **Follow responsive design patterns** (mobile-first)
7. **Use TypeScript** for all components
8. **Test on mobile and desktop** before deployment

## Responsive Design Tips

```vue
<template>
  <!-- Show/Hide on breakpoints -->
  <div class="hidden md:block">Desktop only</div>
  <div class="block md:hidden">Mobile only</div>

  <!-- Stack on mobile, row on desktop -->
  <div class="flex flex-col md:flex-row gap-4">

  <!-- Different text sizes -->
  <h1 class="text-2xl md:text-3xl lg:text-4xl">

  <!-- Different padding -->
  <div class="p-4 md:p-6 lg:p-8">

  <!-- Grid columns change -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
</template>
```

## Common Patterns

### Loading State
```vue
<Card>
  <template #content>
    <ProgressSpinner v-if="loading" />
    <div v-else>
      <!-- Content -->
    </div>
  </template>
</Card>
```

### Empty State
```vue
<Card>
  <template #content>
    <div v-if="items.length === 0" class="text-center py-8">
      <i class="pi pi-inbox text-6xl text-gray-400 mb-4" />
      <p class="text-[var(--text-color-secondary)]">
        No hay datos disponibles
      </p>
      <Button
        label="Crear Nuevo"
        icon="pi pi-plus"
        class="mt-4"
        @click="createNew"
      />
    </div>
    <DataTable v-else :value="items" />
  </template>
</Card>
```

### Error State
```vue
<Message v-if="error" severity="error" :closable="false">
  {{ error }}
</Message>
```
