<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface RegistroCliente {
  id: number
  nombre: string
  numeroDocumento: string
}

interface Registro {
  id: number
  clienteId: number
  estado: string // COMPLETADO | PENDIENTE | VENCIDO
  fechaCompletado: string | null
  fechaVencimiento: string | null
  versionRegistro: string
  notasObservaciones: string | null
  cliente: RegistroCliente
}

interface InstrumentDetail {
  id: number
  nombreInstrumento: string
  codigo: string | null
  descripcion: string | null
  tipo: string // VALORACION | NUTRICION | MATRICULA | ADMISION
  periodicidad: string // UNICA | ANUAL | MENSUAL | TRIMESTRAL | SEMESTRAL
  rolesPermitidos: string
  estado: string // ACTIVO | INACTIVO
  plantillaArchivo: string | null
  versionPlantilla: string
  fechaCreacion: string
  creadoPor: number
  registros: Registro[]
}

// ─── Composables ──────────────────────────────────────────────────────────────
const route = useRoute()
const { apiFetch } = useApi()

// ─── State ────────────────────────────────────────────────────────────────────
const instrument = ref<InstrumentDetail | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

const tabs = [
  { label: 'Información', icon: 'pi pi-info-circle' },
  { label: 'Registros', icon: 'pi pi-list' },
]

// ─── Label maps ───────────────────────────────────────────────────────────────
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

const tipoSeverityMap: Record<string, 'info' | 'success' | 'warn' | 'secondary'> = {
  VALORACION: 'info',
  NUTRICION: 'success',
  MATRICULA: 'secondary',
  ADMISION: 'warn',
}

const registroEstadoSeverityMap: Record<string, 'success' | 'warn' | 'danger'> = {
  COMPLETADO: 'success',
  PENDIENTE: 'warn',
  VENCIDO: 'danger',
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchInstrument() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: InstrumentDetail }>(
      `/instruments/${route.params.id}`
    )
    instrument.value = res.data
  } catch (e: any) {
    if (e?.response?.status === 404) {
      error.value = 'Instrumento no encontrado'
    } else {
      error.value = 'Error al cargar los datos del instrumento'
    }
  } finally {
    loading.value = false
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

onMounted(fetchInstrument)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <i class="pi pi-spin pi-spinner text-4xl text-violet-500" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-orange-400 mb-4 block" />
      <p class="text-[var(--text-color-secondary)]">{{ error }}</p>
      <Button
        label="Volver"
        icon="pi pi-arrow-left"
        class="mt-4"
        severity="secondary"
        @click="navigateTo('/instrumentos')"
      />
    </div>

    <template v-else-if="instrument">
      <!-- Page Header -->
      <AppPageHeader
        :title="instrument.nombreInstrumento"
        subtitle="Detalle del instrumento"
      >
        <template #actions>
          <Button
            label="Volver"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            @click="navigateTo('/instrumentos')"
          />
          <Button
            label="Editar"
            icon="pi pi-pencil"
            severity="info"
            disabled
          />
        </template>
      </AppPageHeader>

      <!-- Summary Header Card -->
      <Card class="mb-6">
        <template #content>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="flex-shrink-0 w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
              <i class="pi pi-clipboard text-2xl text-violet-500" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-3 mb-1">
                <h2 class="text-2xl font-bold text-[var(--text-color)]">
                  {{ instrument.nombreInstrumento }}
                </h2>
                <Tag
                  :value="tipoLabels[instrument.tipo] || instrument.tipo"
                  :severity="tipoSeverityMap[instrument.tipo] || 'info'"
                />
                <AppStatusBadge :status="instrument.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
              </div>
              <div class="flex flex-wrap gap-4 text-sm text-[var(--text-color-secondary)]">
                <span v-if="instrument.codigo">
                  <i class="pi pi-hashtag mr-1" />
                  <span class="font-mono">{{ instrument.codigo }}</span>
                </span>
                <span>
                  <i class="pi pi-refresh mr-1" />
                  {{ periodicidadLabels[instrument.periodicidad] || instrument.periodicidad }}
                </span>
                <span>
                  <i class="pi pi-tag mr-1" />
                  {{ instrument.versionPlantilla }}
                </span>
                <span>
                  <i class="pi pi-list mr-1" />
                  {{ instrument.registros.length }} registro(s)
                </span>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Tabs nav -->
      <div class="mb-4 flex gap-1 border-b border-[var(--surface-border)]">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          :class="[
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === i
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-[var(--text-color-secondary)] hover:text-[var(--text-color)]',
          ]"
          @click="activeTab = i"
        >
          <i :class="tab.icon" />
          {{ tab.label }}
        </button>
      </div>

      <!-- TAB 0: Información -->
      <div v-show="activeTab === 0" class="space-y-4">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-info-circle text-violet-500" /> Datos Generales
              </h3>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo</p>
                <Tag
                  :value="tipoLabels[instrument.tipo] || instrument.tipo"
                  :severity="tipoSeverityMap[instrument.tipo] || 'info'"
                />
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Periodicidad</p>
                <p class="font-medium">
                  {{ periodicidadLabels[instrument.periodicidad] || instrument.periodicidad }}
                </p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado</p>
                <AppStatusBadge :status="instrument.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Código</p>
                <p class="font-medium font-mono">{{ instrument.codigo || '—' }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Versión Plantilla</p>
                <p class="font-medium font-mono">{{ instrument.versionPlantilla }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha Creación</p>
                <p class="font-medium">{{ formatDate(instrument.fechaCreacion) }}</p>
              </div>

              <div class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Roles Permitidos</p>
                <div class="flex flex-wrap gap-2 mt-1">
                  <span
                    v-for="rol in instrument.rolesPermitidos.split(',')"
                    :key="rol.trim()"
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300"
                  >
                    {{ rol.trim() }}
                  </span>
                </div>
              </div>

              <div v-if="instrument.descripcion" class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Descripción</p>
                <p class="text-sm text-[var(--text-color)]">{{ instrument.descripcion }}</p>
              </div>

            </div>
          </template>
        </Card>
      </div>

      <!-- TAB 1: Registros -->
      <div v-show="activeTab === 1" class="space-y-4">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-list text-violet-500" /> Registros del Instrumento
                <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ instrument.registros.length }} registro(s)
                </span>
              </h3>
            </div>
          </template>
          <template #content>
            <div
              v-if="instrument.registros.length === 0"
              class="text-center py-8 text-[var(--text-color-secondary)]"
            >
              <i class="pi pi-list text-4xl mb-3 block opacity-30" />
              <p>No hay registros para este instrumento</p>
            </div>

            <DataTable
              v-else
              :value="instrument.registros"
              striped-rows
              responsive-layout="scroll"
              class="w-full"
              data-key="id"
            >
              <Column header="Paciente" style="min-width: 200px">
                <template #body="{ data }">
                  <div>
                    <p class="font-medium text-[var(--text-color)]">{{ data.cliente.nombre }}</p>
                    <p class="text-xs text-[var(--text-color-secondary)] font-mono">
                      {{ data.cliente.numeroDocumento }}
                    </p>
                  </div>
                </template>
              </Column>

              <Column header="Estado" style="min-width: 120px">
                <template #body="{ data }">
                  <Tag
                    :value="data.estado"
                    :severity="registroEstadoSeverityMap[data.estado] || 'info'"
                  />
                </template>
              </Column>

              <Column header="Fecha Completado" style="min-width: 150px">
                <template #body="{ data }">
                  <span class="text-sm">{{ formatShortDate(data.fechaCompletado) }}</span>
                </template>
              </Column>

              <Column header="Fecha Vencimiento" style="min-width: 150px">
                <template #body="{ data }">
                  <span class="text-sm">{{ formatShortDate(data.fechaVencimiento) }}</span>
                </template>
              </Column>

              <Column header="Versión Registro" style="min-width: 120px">
                <template #body="{ data }">
                  <span class="text-sm font-mono text-[var(--text-color-secondary)]">
                    {{ data.versionRegistro }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </template>
  </div>
</template>
