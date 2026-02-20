<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

interface InstrumentSummary {
  id: number
  nombreInstrumento: string
  codigo: string | null
  descripcion: string | null
  tipo: string
  periodicidad: string
  rolesPermitidos: string
  estado: 'ACTIVO' | 'INACTIVO'
  versionPlantilla: string
  fechaCreacion: string
  totalRegistros: number
}

interface InstrumentListResponse {
  success: boolean
  data: InstrumentSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const { apiFetch } = useApi()

const instruments = ref<InstrumentSummary[]>([])
const loading = ref(false)
const total = ref(0)
const totalPages = ref(0)

const search = ref('')
const tipoFilter = ref('')
const estadoFilter = ref<'ACTIVO' | 'INACTIVO' | ''>('')
const page = ref(1)
const limit = ref(20)

const stats = ref({ total: 0, activos: 0, inactivos: 0 })

const tipoOptions = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Valoración', value: 'VALORACION' },
  { label: 'Nutrición', value: 'NUTRICION' },
  { label: 'Matrícula', value: 'MATRICULA' },
  { label: 'Admisión', value: 'ADMISION' },
]

const estadoOptions = [
  { label: 'Todos', value: '' },
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Inactivo', value: 'INACTIVO' },
]

const tipoLabels: Record<string, string> = {
  VALORACION: 'Valoración',
  NUTRICION: 'Nutrición',
  MATRICULA: 'Matrícula',
  ADMISION: 'Admisión',
}

const periodicidadLabels: Record<string, string> = {
  UNICA: 'Única',
  ANUAL: 'Anual',
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
}

async function fetchInstruments() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
    })
    if (search.value) params.set('search', search.value)
    if (tipoFilter.value) params.set('tipo', tipoFilter.value)
    if (estadoFilter.value) params.set('estado', estadoFilter.value)

    const res = await apiFetch<InstrumentListResponse>(`/instruments?${params}`)
    instruments.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (e) {
    console.error('Error fetching instruments:', e)
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const [allRes, activosRes, inactivosRes] = await Promise.all([
      apiFetch<InstrumentListResponse>('/instruments?limit=1'),
      apiFetch<InstrumentListResponse>('/instruments?limit=1&estado=ACTIVO'),
      apiFetch<InstrumentListResponse>('/instruments?limit=1&estado=INACTIVO'),
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

let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchInstruments()
  }, 400)
}

function onFilterChange() {
  page.value = 1
  fetchInstruments()
}

function onPageChange(newPage: number) {
  page.value = newPage
  fetchInstruments()
}

onMounted(async () => {
  await Promise.all([fetchInstruments(), fetchStats()])
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Instrumentos"
      subtitle="Fichas, formularios y plantillas de evaluación"
    >
      <template #actions>
        <Button
          label="Nuevo Instrumento"
          icon="pi pi-plus"
          @click="navigateTo('/instrumentos/crear')"
        />
      </template>
    </AppPageHeader>

    <!-- Stats Bar -->
    <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
      <AppStatsCard
        title="Total Instrumentos"
        :value="stats.total"
        icon="pi pi-clipboard"
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
        <!-- Toolbar -->
        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <div class="flex-1 relative">
            <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-color-secondary)] z-10 pointer-events-none" />
            <InputText
              v-model="search"
              placeholder="Buscar por nombre o código..."
              class="w-full pl-9"
              @input="onSearchInput"
            />
          </div>
          <Select
            v-model="tipoFilter"
            :options="tipoOptions"
            option-label="label"
            option-value="value"
            placeholder="Tipo"
            class="w-full sm:w-48"
            @change="onFilterChange"
          />
          <Select
            v-model="estadoFilter"
            :options="estadoOptions"
            option-label="label"
            option-value="value"
            placeholder="Estado"
            class="w-full sm:w-36"
            @change="onFilterChange"
          />
        </div>

        <!-- DataTable -->
        <DataTable
          :value="instruments"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="id"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              <i class="pi pi-clipboard text-4xl mb-3 block opacity-30" />
              <p>No se encontraron instrumentos</p>
            </div>
          </template>

          <Column header="Instrumento" style="min-width: 240px">
            <template #body="{ data }">
              <div>
                <p class="font-medium text-[var(--text-color)]">{{ data.nombreInstrumento }}</p>
                <p v-if="data.codigo" class="text-xs text-[var(--text-color-secondary)] font-mono">{{ data.codigo }}</p>
              </div>
            </template>
          </Column>

          <Column header="Tipo" style="min-width: 120px">
            <template #body="{ data }">
              <Tag
                :value="tipoLabels[data.tipo] || data.tipo"
                :severity="data.tipo === 'VALORACION' ? 'info' : data.tipo === 'NUTRICION' ? 'success' : data.tipo === 'ADMISION' ? 'warn' : 'secondary'"
              />
            </template>
          </Column>

          <Column header="Periodicidad" style="min-width: 120px">
            <template #body="{ data }">
              <span class="text-sm text-[var(--text-color-secondary)]">
                {{ periodicidadLabels[data.periodicidad] || data.periodicidad }}
              </span>
            </template>
          </Column>

          <Column header="Estado" style="min-width: 100px">
            <template #body="{ data }">
              <AppStatusBadge :status="data.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
            </template>
          </Column>

          <Column header="Registros" style="min-width: 90px">
            <template #body="{ data }">
              <span class="font-medium text-[var(--text-color)]">{{ data.totalRegistros }}</span>
            </template>
          </Column>

          <Column header="Versión" style="min-width: 80px">
            <template #body="{ data }">
              <span class="text-sm font-mono text-[var(--text-color-secondary)]">{{ data.versionPlantilla }}</span>
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
                  v-tooltip.top="'Ver detalles'"
                  @click="navigateTo(`/instrumentos/${data.id}`)"
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
            Mostrando {{ instruments.length }} de {{ total }} instrumentos
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
