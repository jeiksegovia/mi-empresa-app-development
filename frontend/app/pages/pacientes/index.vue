<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

interface PatientSummary {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: string
  genero: string
  telefono: string | null
  email: string | null
  estado: 'ACTIVO' | 'INACTIVO'
  fechaIngreso: string
  totalFichas: number
  fichasPendientes: number
}

interface PatientListResponse {
  success: boolean
  data: PatientSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const { apiFetch } = useApi()

// State
const patients = ref<PatientSummary[]>([])
const loading = ref(false)
const total = ref(0)
const totalPages = ref(0)

// Filters and pagination
const search = ref('')
const estadoFilter = ref<'ACTIVO' | 'INACTIVO' | ''>('')
const page = ref(1)
const limit = ref(20)

// Stats derived from API totals
const stats = ref({ total: 0, activos: 0, inactivos: 0 })

const estadoOptions = [
  { label: 'Todos', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Inactivo', value: 'INACTIVO' },
]

async function fetchPatients() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
    })
    if (search.value) params.set('search', search.value)
    if (estadoFilter.value) params.set('estado', estadoFilter.value)

    const res = await apiFetch<PatientListResponse>(`/patients?${params}`)
    patients.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (e) {
    console.error('Error fetching patients:', e)
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const [allRes, activosRes, inactivosRes] = await Promise.all([
      apiFetch<PatientListResponse>('/patients?limit=1'),
      apiFetch<PatientListResponse>('/patients?limit=1&estado=ACTIVO'),
      apiFetch<PatientListResponse>('/patients?limit=1&estado=INACTIVO'),
    ])

    stats.value = {
      total: allRes.total,
      activos: activosRes.total,
      inactivos: inactivosRes.total,
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
    fetchPatients()
  }, 400)
}

function onFilterChange() {
  page.value = 1
  fetchPatients()
}

function onPageChange(newPage: number) {
  page.value = newPage
  fetchPatients()
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(async () => {
  await Promise.all([fetchPatients(), fetchStats()])
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Pacientes"
      subtitle="Gestión de pacientes y evaluaciones psicológicas"
    >
      <template #actions>
        <Button
          label="Nuevo Paciente"
          icon="pi pi-plus"
          @click="navigateTo('/pacientes/crear')"
        />
      </template>
    </AppPageHeader>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <AppStatsCard
        title="Total Pacientes"
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
              placeholder="Buscar por nombre o documento..."
              class="w-full pl-10"
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
          :value="patients"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="id"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              <i class="pi pi-users text-4xl mb-3 block opacity-30" />
              <p>No se encontraron pacientes</p>
            </div>
          </template>

          <Column header="Paciente" style="min-width: 200px">
            <template #body="{ data }">
              <div class="flex items-center gap-3">
                <Avatar
                  :label="data.nombre[0]?.toUpperCase() || 'P'"
                  class="bg-violet-100 text-violet-700 font-semibold"
                  shape="circle"
                  size="normal"
                />
                <div>
                  <p class="font-medium text-[var(--text-color)]">{{ data.nombre }}</p>
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

          <Column header="Estado" style="min-width: 100px">
            <template #body="{ data }">
              <AppStatusBadge :status="data.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
            </template>
          </Column>

          <Column header="Fichas" style="min-width: 100px">
            <template #body="{ data }">
              <div class="text-sm">
                <span class="font-medium text-[var(--text-color)]">{{ data.totalFichas }}</span>
                <span v-if="data.fichasPendientes > 0" class="text-xs text-orange-500 ml-1">
                  ({{ data.fichasPendientes }} pend.)
                </span>
              </div>
            </template>
          </Column>

          <Column header="Acciones" style="min-width: 80px">
            <template #body="{ data }">
              <div class="flex items-center gap-1">
                <Button
                  icon="pi pi-eye"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Ver perfil'"
                  @click="navigateTo(`/pacientes/${data.id}`)"
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
            Mostrando {{ patients.length }} de {{ total }} pacientes
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
