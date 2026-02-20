<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

interface EmployeeSummary {
  id: number
  nombre: string
  apellido: string
  tipoDocumento: string
  numeroDocumento: string
  genero: string
  telefono: string | null
  email: string | null
  estado: 'ACTIVO' | 'INACTIVO'
  fechaRegistro: string
  cargo: string | null
  ubicacion: string | null
}

interface EmployeeListResponse {
  success: boolean
  data: EmployeeSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const { apiFetch } = useApi()

// State
const employees = ref<EmployeeSummary[]>([])
const loading = ref(false)
const total = ref(0)
const totalPages = ref(0)

// Filters and pagination
const search = ref('')
const estadoFilter = ref<'ACTIVO' | 'INACTIVO' | ''>('')
const page = ref(1)
const limit = ref(20)

// Stats derived from API totals
const stats = ref({ total: 0, activos: 0, inactivos: 0, nuevosMes: 0 })

const estadoOptions = [
  { label: 'Todos', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Inactivo', value: 'INACTIVO' },
]

async function fetchEmployees() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
    })
    if (search.value) params.set('search', search.value)
    if (estadoFilter.value) params.set('estado', estadoFilter.value)

    const res = await apiFetch<EmployeeListResponse>(`/employees?${params}`)
    employees.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (e) {
    console.error('Error fetching employees:', e)
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const [allRes, activosRes, inactivosRes] = await Promise.all([
      apiFetch<EmployeeListResponse>('/employees?limit=1'),
      apiFetch<EmployeeListResponse>('/employees?limit=1&estado=ACTIVO'),
      apiFetch<EmployeeListResponse>('/employees?limit=1&estado=INACTIVO'),
    ])

    // Nuevos este mes: created in current month
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const allForMonth = await apiFetch<EmployeeListResponse>(`/employees?limit=1&desde=${firstOfMonth}`)

    stats.value = {
      total: allRes.total,
      activos: activosRes.total,
      inactivos: inactivosRes.total,
      nuevosMes: 0, // backend doesn't support date filter yet; show 0
    }
  } catch (e) {
    console.error('Error fetching stats:', e)
  }
}

// Debounced search
let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchEmployees()
  }, 400)
}

function onFilterChange() {
  page.value = 1
  fetchEmployees()
}

function onPageChange(newPage: number) {
  page.value = newPage
  fetchEmployees()
}

function fullName(emp: EmployeeSummary) {
  return `${emp.nombre} ${emp.apellido}`
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(async () => {
  await Promise.all([fetchEmployees(), fetchStats()])
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Empleados"
      subtitle="Gestión de empleados de la empresa"
    >
      <template #actions>
        <Button
          label="Nuevo Empleado"
          icon="pi pi-plus"
          @click="navigateTo('/empleados/nuevo')"
        />
      </template>
    </AppPageHeader>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AppStatsCard
        title="Total Empleados"
        :value="stats.total"
        icon="pi pi-users"
        severity="primary"
      />
      <AppStatsCard
        title="Activos"
        :value="stats.activos"
        icon="pi pi-check-circle"
        severity="success"
      />
      <AppStatsCard
        title="Inactivos"
        :value="stats.inactivos"
        icon="pi pi-times-circle"
        severity="secondary"
      />
      <AppStatsCard
        title="Nuevos este mes"
        :value="stats.nuevosMes"
        icon="pi pi-user-plus"
        severity="info"
      />
    </div>

    <!-- Table Card -->
    <Card>
      <template #content>
        <!-- Toolbar: search + filter -->
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <div class="flex-1 relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-color-secondary)] z-10 pointer-events-none" />
            <InputText
              v-model="search"
              placeholder="Buscar por nombre, apellido o documento..."
              class="w-full pl-9"
              @input="onSearchInput"
            />
          </div>
          <Select
            v-model="estadoFilter"
            :options="estadoOptions"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            class="w-full sm:w-44"
            @change="onFilterChange"
          />
        </div>

        <!-- DataTable -->
        <DataTable
          :value="employees"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="id"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              <i class="pi pi-users text-4xl mb-3 block opacity-30" />
              <p>No se encontraron empleados</p>
            </div>
          </template>

          <Column header="Empleado" style="min-width: 200px">
            <template #body="{ data }">
              <div class="flex items-center gap-3">
                <Avatar
                  :label="data.nombre[0] + data.apellido[0]"
                  class="bg-violet-100 text-violet-700 font-semibold"
                  shape="circle"
                  size="normal"
                />
                <div>
                  <p class="font-medium text-[var(--text-color)]">{{ fullName(data) }}</p>
                  <p class="text-xs text-[var(--text-color-secondary)]">{{ data.email || '—' }}</p>
                </div>
              </div>
            </template>
          </Column>

          <Column header="Documento" style="min-width: 140px">
            <template #body="{ data }">
              <span class="text-sm">
                <span class="text-[var(--text-color-secondary)] mr-1">{{ data.tipoDocumento }}</span>
                {{ data.numeroDocumento }}
              </span>
            </template>
          </Column>

          <Column header="Cargo / Ubicación" style="min-width: 180px">
            <template #body="{ data }">
              <div v-if="data.cargo">
                <p class="text-sm font-medium text-[var(--text-color)]">{{ data.cargo }}</p>
                <p class="text-xs text-[var(--text-color-secondary)]">{{ data.ubicacion || '—' }}</p>
              </div>
              <span v-else class="text-sm text-[var(--text-color-secondary)]">Sin asignar</span>
            </template>
          </Column>

          <Column header="Teléfono" style="min-width: 130px">
            <template #body="{ data }">
              <span class="text-sm">{{ data.telefono || '—' }}</span>
            </template>
          </Column>

          <Column header="Estado" style="min-width: 100px">
            <template #body="{ data }">
              <AppStatusBadge :status="data.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
            </template>
          </Column>

          <Column header="Registrado" style="min-width: 130px">
            <template #body="{ data }">
              <span class="text-sm text-[var(--text-color-secondary)]">{{ formatDate(data.fechaRegistro) }}</span>
            </template>
          </Column>

          <Column header="Acciones" style="min-width: 120px">
            <template #body="{ data }">
              <div class="flex items-center gap-1">
                <Button
                  icon="pi pi-eye"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Ver perfil'"
                  @click="navigateTo(`/empleados/${data.id}`)"
                />
                <Button
                  icon="pi pi-pencil"
                  size="small"
                  severity="info"
                  text
                  rounded
                  v-tooltip.top="'Editar'"
                  @click="navigateTo(`/empleados/${data.id}/editar`)"
                />
              </div>
            </template>
          </Column>
        </DataTable>

        <!-- Pagination -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between mt-4 pt-4 border-t border-[var(--surface-border)]"
        >
          <span class="text-sm text-[var(--text-color-secondary)]">
            Mostrando {{ employees.length }} de {{ total }} empleados
          </span>
          <div class="flex items-center gap-2">
            <Button
              icon="pi pi-angle-left"
              size="small"
              severity="secondary"
              :disabled="page === 1"
              @click="onPageChange(page - 1)"
            />
            <span class="text-sm px-2">{{ page }} / {{ totalPages }}</span>
            <Button
              icon="pi pi-angle-right"
              size="small"
              severity="secondary"
              :disabled="page === totalPages"
              @click="onPageChange(page + 1)"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
