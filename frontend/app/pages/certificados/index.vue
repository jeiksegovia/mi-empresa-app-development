<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface CertificateSummary {
  id: number
  nombre: string
  tipoCertificado: string
  descripcion: string | null
  estado: 'VIGENTE' | 'VENCIDO' | 'PENDIENTE'
  fechaEmision: string | null
  fechaVencimiento: string | null
  archivoUrl: string | null
  creadoPor: number | null
  creadorNombre: string | null
  createdAt: string

  periodicidad: 'UNICA' | 'MENSUAL' | 'ANUAL'
  periodo: string | null
  comprobantePagoUrl: string | null
}

interface CertificateListResponse {
  data: CertificateSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

interface CertificateStats {
  vigente: number
  vencido: number
  pendiente: number
  total: number

  alertasMesFaltante: string[]
}

// ─── Composables ──────────────────────────────────────────────────────────────
const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { canCreateOnly } = useDomainAccess()

// ─── State ────────────────────────────────────────────────────────────────────
const certificates = ref<CertificateSummary[]>([])
const loading = ref(false)
const total = ref(0)
const totalPages = ref(0)

const stats = ref<CertificateStats>({
  vigente: 0,
  vencido: 0,
  pendiente: 0,
  total: 0,
  alertasMesFaltante: [],
})

const search = ref('')
const tipoFilter = ref('')
const estadoFilter = ref('')
const page = ref(1)
const limit = ref(20)

const deleteDialogVisible = ref(false)
const deletingId = ref<number | null>(null)
const deleteLoading = ref(false)

// ─── Label maps ───────────────────────────────────────────────────────────────
const tipoLabels: Record<string, string> = {
  ALCALDIA: 'Alcaldía',
  GOBERNACION: 'Gobernación',
  SECRETARIAS: 'Secretarías',
  TRIBUTARIOS: 'Tributarios',
  REGISTRO_MERCANTIL: 'Registro Mercantil',
  OTRO: 'Otro',
}

// ─── Options ──────────────────────────────────────────────────────────────────
const tipoOptions = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Alcaldía', value: 'ALCALDIA' },
  { label: 'Gobernación', value: 'GOBERNACION' },
  { label: 'Secretarías', value: 'SECRETARIAS' },
  { label: 'Tributarios', value: 'TRIBUTARIOS' },
  { label: 'Registro Mercantil', value: 'REGISTRO_MERCANTIL' },
  { label: 'Otro', value: 'OTRO' },
]

// POR_VENCER badge logic (≤30 days from today, not VENCIDO)
function diffDays(fecha: string | null, ref: Date): number | null {
  if (!fecha) return null
  const target = new Date(fecha)
  if (isNaN(target.getTime())) return null
  const ms = target.getTime() - ref.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

function isPorVencer(cert: CertificateSummary): boolean {
  if (cert.estado === 'VENCIDO') return false
  const days = diffDays(cert.fechaVencimiento, new Date())
  return days !== null && days <= 30 && days >= 0
}

const estadoOptions = [
  { label: 'Todos los estados', value: '' },
  { label: 'Vigente', value: 'VIGENTE' },
  { label: 'Vencido', value: 'VENCIDO' },
  { label: 'Pendiente', value: 'PENDIENTE' },
]

// ─── Estado badge severity ─────────────────────────────────────────────────
function estadoSeverity(estado: string): 'success' | 'danger' | 'warn' | 'secondary' {
  if (estado === 'VIGENTE') return 'success'
  if (estado === 'VENCIDO') return 'danger'
  if (estado === 'PENDIENTE') return 'warn'
  return 'secondary'
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchCertificates() {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: String(limit.value),
    })
    if (search.value) params.set('search', search.value)
    if (tipoFilter.value) params.set('tipo', tipoFilter.value)
    if (estadoFilter.value) params.set('estado', estadoFilter.value)

    const res = await apiFetch<CertificateListResponse>(`/certificates?${params}`)
    certificates.value = res.data
    total.value = res.total
    totalPages.value = res.totalPages
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
  } finally {
    loading.value = false
  }
}

async function fetchStats() {
  try {
    const res = await apiFetch<{ success: boolean; data: CertificateStats }>('/certificates/stats')
    stats.value = res.data
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
  }
}

// ─── Filter & search handlers ─────────────────────────────────────────────────
let searchTimeout: ReturnType<typeof setTimeout>
function onSearchInput() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    page.value = 1
    fetchCertificates()
  }, 400)
}

function onFilterChange() {
  page.value = 1
  fetchCertificates()
}

function onPageChange(newPage: number) {
  page.value = newPage
  fetchCertificates()
}

// ─── Delete ───────────────────────────────────────────────────────────────────
function confirmDelete(id: number) {
  deletingId.value = id
  deleteDialogVisible.value = true
}

async function performDelete() {
  if (!deletingId.value) return
  deleteLoading.value = true
  try {
    await apiFetch(`/certificates/${deletingId.value}`, { method: 'DELETE' })
    toast.add({
      severity: 'success',
      summary: 'Certificado eliminado',
      detail: 'El certificado fue eliminado correctamente.',
      life: 3000,
    })
    deleteDialogVisible.value = false
    deletingId.value = null
    await Promise.all([fetchCertificates(), fetchStats()])
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'Error al eliminar el certificado.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    deleteLoading.value = false
  }
}

// ─── Date formatter ───────────────────────────────────────────────────────────
// formatDate and formatPeriodo are auto-imported from utils/date


const currentMonthLabel = computed(() => {
  const d = new Date()
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${months[d.getMonth()]} ${d.getFullYear()}`
})


const duplicatingId = ref<number | null>(null)
async function duplicateForCurrentMonth(certId: number) {
  duplicatingId.value = certId
  try {
    await apiFetch('/certificates', {
      method: 'POST',
      body: { duplicateFromId: certId },
    })
    toast.add({
      severity: 'success',
      summary: 'Certificado duplicado',
      detail: 'Se creó una copia para el mes actual en estado Pendiente.',
      life: 3000,
    })
    await Promise.all([fetchCertificates(), fetchStats()])
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'Error al duplicar el certificado.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    duplicatingId.value = null
  }
}

onMounted(async () => {
  await Promise.all([fetchCertificates(), fetchStats()])
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Certificados"
      subtitle="Certificados de empresa"
    >
      <template #actions>
        <Button
          v-if="authStore.isAdmin || canCreateOnly('certificados')"
          label="Nuevo Certificado"
          icon="pi pi-plus"
          data-testid="cert-nuevo"
          @click="navigateTo('/certificados/crear')"
        />
      </template>
    </AppPageHeader>


    
    <div
      v-if="stats.alertasMesFaltante?.length"
      data-testid="cert-missing-month-alert"
    >
      <Message
        severity="warn"
        :closable="false"
        class="mb-4"
      >
        <div>
          <p class="font-medium">
            Faltan certificados de {{ currentMonthLabel }}:
            {{ stats.alertasMesFaltante.join(', ') }}
          </p>
          <p class="text-sm opacity-80 mt-1">
            Duplica el certificado mensual desde la fila correspondiente para registrar el pago de este mes.
          </p>
        </div>
      </Message>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AppStatsCard
        title="Vigentes"
        :value="stats.vigente"
        icon="pi pi-check-circle"
        severity="success"
      />
      <AppStatsCard
        title="Vencidos"
        :value="stats.vencido"
        icon="pi pi-times-circle"
        severity="danger"
      />
      <AppStatsCard
        title="Pendientes"
        :value="stats.pendiente"
        icon="pi pi-clock"
        severity="warn"
      />
      <AppStatsCard
        title="Total"
        :value="stats.total"
        icon="pi pi-file-pdf"
        severity="primary"
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
              placeholder="Buscar por nombre..."
              class="w-full pl-10"
              @input="onSearchInput"
            />
          </div>
          <Select
            v-model="tipoFilter"
            :options="tipoOptions"
            option-label="label"
            option-value="value"
            placeholder="Tipo"
            class="w-full sm:w-56"
            @change="onFilterChange"
          />
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
          :value="certificates"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="id"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              <i class="pi pi-file-pdf text-4xl mb-3 block opacity-30" />
              <p>No se encontraron certificados</p>
            </div>
          </template>

          <Column header="Nombre" style="min-width: 200px">
            <template #body="{ data }">
              <p class="font-medium text-[var(--text-color)]">{{ data.nombre }}</p>
            </template>
          </Column>

          <Column header="Tipo" style="min-width: 160px">
            <template #body="{ data }">
              <span class="text-sm text-[var(--text-color-secondary)]">
                {{ tipoLabels[data.tipoCertificado] || data.tipoCertificado }}
              </span>
            </template>
          </Column>

          <Column header="Estado" style="min-width: 110px">
            <template #body="{ data }">
              <div class="flex items-center gap-1 flex-wrap">
                <Tag
                  :value="data.estado"
                  :severity="estadoSeverity(data.estado)"
                />
                <Tag
                  v-if="isPorVencer(data)"
                  value="POR_VENCER"
                  severity="warn"
                  v-tooltip.top="'Vence en ≤ 30 días'"
                />
              </div>
            </template>
          </Column>

          <Column header="Fecha Vencimiento" style="min-width: 150px">
            <template #body="{ data }">
              <span class="text-sm">{{ formatDate(data.fechaVencimiento, 'short') }}</span>
            </template>
          </Column>

          <Column header="Periodicidad" style="min-width: 110px">
            <template #body="{ data }">
              <Tag
                v-if="data.periodicidad && data.periodicidad !== 'UNICA'"
                :value="data.periodicidad"
                severity="info"
              />
              <span v-else class="text-sm text-[var(--text-color-secondary)]">Única</span>
            </template>
          </Column>

          <Column header="Periodo" style="min-width: 100px">
            <template #body="{ data }">
              <span class="text-sm">{{ formatPeriodo(data.periodo) }}</span>
            </template>
          </Column>

          <Column header="Creado por" style="min-width: 140px">
            <template #body="{ data }">
              <span class="text-sm text-[var(--text-color-secondary)]">
                {{ data.creadorNombre || '—' }}
              </span>
            </template>
          </Column>

          <Column header="Acciones" style="min-width: 180px">
            <template #body="{ data }">
              <div class="flex items-center gap-1">
                <Button
                  icon="pi pi-eye"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Ver detalle'"
                  @click="navigateTo(`/certificados/${data.id}`)"
                />
                <Button
                  v-if="authStore.isAdmin && data.periodicidad === 'MENSUAL'"
                  icon="pi pi-clone"
                  size="small"
                  severity="info"
                  text
                  rounded
                  :loading="duplicatingId === data.id"
                  v-tooltip.top="'Duplicar para este mes'"
                  data-testid="cert-duplicate-btn"
                  @click="duplicateForCurrentMonth(data.id)"
                />
                <Button
                  v-if="authStore.isAdmin"
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Eliminar'"
                  @click="confirmDelete(data.id)"
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
            Mostrando {{ certificates.length }} de {{ total }} certificados
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

    <!-- Delete Confirmation Dialog -->
    <Dialog
      v-model:visible="deleteDialogVisible"
      header="Confirmar eliminación"
      :modal="true"
      :closable="!deleteLoading"
      :style="{ width: '24rem' }"
    >
      <div class="flex items-start gap-3 py-2">
        <i class="pi pi-exclamation-triangle text-2xl text-red-500 mt-0.5 flex-shrink-0" />
        <p class="text-[var(--text-color)]">
          ¿Estás seguro de que deseas eliminar este certificado? Esta acción no se puede deshacer.
        </p>
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          :disabled="deleteLoading"
          @click="deleteDialogVisible = false"
        />
        <Button
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          :loading="deleteLoading"
          @click="performDelete"
        />
      </template>
    </Dialog>
  </div>
</template>
