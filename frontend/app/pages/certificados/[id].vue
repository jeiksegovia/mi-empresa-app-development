<script setup lang="ts">
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

// ─── Types ────────────────────────────────────────────────────────────────────
interface CertificateDetail {
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
  updatedAt: string
  periodicidad: 'UNICA' | 'MENSUAL' | 'ANUAL'
  periodo: string | null
  comprobantePagoUrl: string | null
}

interface CertificateUpdateRecord {
  id: number
  certificadoId: number
  archivoUrl: string | null
  notas: string | null
  fechaEmision: string | null
  fechaVencimiento: string | null
  creadoPor: number
  createdAt: string
}

// ─── Composables ──────────────────────────────────────────────────────────────
const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { downloadFile, uploadFile } = useFileUpload()
const { stash: stashFile, restore: restoreFile, clear: clearFile } = useFileStash()

// W7: stash key + title guard scoped per cert id.
const updateStashKey = computed(() => `cert-agregar:${route.params.id}:file`)
const updateFileGuard = useFileStashTitleGuard('Adjuntar archivo de actualización')
const addUpdateDraftKey = computed(() => `cert-agregar-draft:${route.params.id}`)

// ─── State ────────────────────────────────────────────────────────────────────
const certificate = ref<CertificateDetail | null>(null)
const loading = ref(true)
const error = ref('')

// Edit mode state (METADATA-ONLY per D2)
const editMode = ref(false)
const saving = ref(false)
const editForm = reactive({
  nombre: '',
  tipoCertificado: '',
  descripcion: '',
  estado: '' as 'VIGENTE' | 'VENCIDO' | 'PENDIENTE' | '',
})
const editErrors = reactive<Record<string, string>>({})

// File download state
const downloadLoading = ref(false)

// ─── Historial state ─────────────────────────────────────────────────────────
const updates = ref<CertificateUpdateRecord[]>([])
const updatesLoading = ref(false)

// ─── Agregar actualización dialog state ──────────────────────────────────────
const showAddUpdateDialog = ref(false)
const savingUpdate = ref(false)
const addUpdateForm = reactive({
  notas: '',
  fechaEmision: '',
  fechaVencimiento: '',
})
const selectedUpdateFile = ref<File | null>(null)
const updateFileInputRef = ref<HTMLInputElement | null>(null)
const uploadUpdateFileProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')
const uploadedUpdateFileKey = ref<string | null>(null)
const updateErrors = reactive<Record<string, string>>({})

// ─── Label maps ───────────────────────────────────────────────────────────────
const tipoLabels: Record<string, string> = {
  ALCALDIA: 'Alcaldía',
  GOBERNACION: 'Gobernación',
  SECRETARIAS: 'Secretarías',
  TRIBUTARIOS: 'Tributarios',
  REGISTRO_MERCANTIL: 'Registro Mercantil',
  OTRO: 'Otro',
}

const periodicidadLabels: Record<string, string> = {
  UNICA: 'Única',
  MENSUAL: 'Mensual',
  ANUAL: 'Anual',
}

// ─── Options ──────────────────────────────────────────────────────────────────
const tipoOptions = [
  { label: 'Alcaldía', value: 'ALCALDIA' },
  { label: 'Gobernación', value: 'GOBERNACION' },
  { label: 'Secretarías', value: 'SECRETARIAS' },
  { label: 'Tributarios', value: 'TRIBUTARIOS' },
  { label: 'Registro Mercantil', value: 'REGISTRO_MERCANTIL' },
  { label: 'Otro', value: 'OTRO' },
]

const estadoOptions = [
  { label: 'Vigente', value: 'VIGENTE' },
  { label: 'Vencido', value: 'VENCIDO' },
  { label: 'Pendiente', value: 'PENDIENTE' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────
function estadoSeverity(estado: string): 'success' | 'danger' | 'warn' | 'secondary' {
  if (estado === 'VIGENTE') return 'success'
  if (estado === 'VENCIDO') return 'danger'
  if (estado === 'PENDIENTE') return 'warn'
  return 'secondary'
}

// formatDate and formatPeriodo are auto-imported from utils/date
function toDateInputValue(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return dateStr.slice(0, 10)
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchCertificate() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: CertificateDetail }>(
      `/certificates/${route.params.id}`
    )
    certificate.value = res.data
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.status === 404) {
      error.value = 'Certificado no encontrado'
    } else {
      error.value = 'Error al cargar los datos del certificado'
    }
  } finally {
    loading.value = false
  }
}

async function fetchUpdates() {
  updatesLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: CertificateUpdateRecord[] }>(
      `/certificates/${route.params.id}/updates`
    )
    updates.value = res.data ?? []
  } catch {
    updates.value = []
  } finally {
    updatesLoading.value = false
  }
}

// ─── Download ─────────────────────────────────────────────────────────────────
async function handleDownload() {
  if (!certificate.value?.archivoUrl) return
  downloadLoading.value = true
  try {
    await downloadFile(certificate.value.archivoUrl)
  } finally {
    downloadLoading.value = false
  }
}

async function downloadComprobante() {
  if (!certificate.value?.comprobantePagoUrl) return
  await downloadFile(certificate.value.comprobantePagoUrl)
}

async function downloadUpdateFile(update: CertificateUpdateRecord) {
  if (!update.archivoUrl) return
  await downloadFile(update.archivoUrl)
}

// ─── Edit mode (metadata-only per D2) ────────────────────────────────────────
function enterEditMode() {
  if (!certificate.value) return
  editForm.nombre = certificate.value.nombre
  editForm.tipoCertificado = certificate.value.tipoCertificado
  editForm.descripcion = certificate.value.descripcion || ''
  editForm.estado = certificate.value.estado
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  editMode.value = true
}

function cancelEdit() {
  editMode.value = false
}

function validateEdit(): boolean {
  Object.keys(editErrors).forEach((k) => delete editErrors[k])
  if (!editForm.nombre.trim()) editErrors.nombre = 'El nombre es requerido'
  if (!editForm.tipoCertificado) editErrors.tipoCertificado = 'El tipo es requerido'
  return Object.keys(editErrors).length === 0
}

async function saveEdit() {
  if (!validateEdit()) return
  saving.value = true
  try {
    // D2: metadata-only edit. file/date fields are managed via /updates.
    const payload: Record<string, unknown> = {
      nombre: editForm.nombre.trim(),
      tipoCertificado: editForm.tipoCertificado,
      estado: editForm.estado || undefined,
    }
    if (editForm.descripcion.trim()) payload.descripcion = editForm.descripcion.trim()

    const res = await apiFetch<{ success: boolean; data: CertificateDetail }>(
      `/certificates/${route.params.id}`,
      { method: 'PUT', body: payload }
    )
    certificate.value = res.data
    editMode.value = false
    toast.add({
      severity: 'success',
      summary: 'Cambios guardados',
      detail: 'El certificado fue actualizado correctamente.',
      life: 3000,
    })
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'Error al guardar los cambios.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    saving.value = false
  }
}

// ─── Agregar actualización (D2) ──────────────────────────────────────────────
function readAddUpdateDraft(): {
  notas?: string
  fechaEmision?: string
  fechaVencimiento?: string
  ts?: number
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(addUpdateDraftKey.value)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeAddUpdateDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      addUpdateDraftKey.value,
      JSON.stringify({
        notas: addUpdateForm.notas,
        fechaEmision: addUpdateForm.fechaEmision,
        fechaVencimiento: addUpdateForm.fechaVencimiento,
        ts: Date.now(),
      })
    )
  } catch { /* noop */ }
}

function clearAddUpdateDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(addUpdateDraftKey.value) } catch { /* noop */ }
}

async function openAddUpdateDialog() {
  // W9: clear the underlying HTML file input so re-opening the dialog
  // after a cancel doesn't retain a stale File object in input.files.
  if (updateFileInputRef.value) updateFileInputRef.value.value = ''
  // Try to restore from sessionStorage + IDB stash first.
  const draft = readAddUpdateDraft()
  addUpdateForm.notas = draft?.notas ?? ''
  addUpdateForm.fechaEmision = draft?.fechaEmision ?? ''
  addUpdateForm.fechaVencimiento = draft?.fechaVencimiento ?? ''
  selectedUpdateFile.value = null
  uploadedUpdateFileKey.value = null
  uploadUpdateFileProgress.value = 'idle'
  Object.keys(updateErrors).forEach((k) => delete updateErrors[k])

  if (import.meta.client) {
    const restored = await restoreFile(updateStashKey.value)
    if (restored) {
      selectedUpdateFile.value = restored
      toast.add({
        severity: 'success',
        summary: 'Archivo restaurado',
        detail: `«${restored.name}» se restauró automáticamente.`,
        life: 4000,
      })
    } else if (draft && (draft.notas || draft.fechaEmision || draft.fechaVencimiento)) {
      toast.add({
        severity: 'info',
        summary: 'Borrador restaurado',
        detail: 'Se recuperaron las notas y fechas de tu sesión anterior.',
        life: 4000,
      })
    }
  }

  showAddUpdateDialog.value = true
}

async function onUpdateFileChange(event: Event) {
  updateFileGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedUpdateFile.value = input.files[0]
    uploadedUpdateFileKey.value = null
    uploadUpdateFileProgress.value = 'idle'
    await stashFile(updateStashKey.value, input.files[0])
    writeAddUpdateDraft()
  }
}

function clearUpdateFile() {
  selectedUpdateFile.value = null
  uploadedUpdateFileKey.value = null
  uploadUpdateFileProgress.value = 'idle'
  if (updateFileInputRef.value) updateFileInputRef.value.value = ''
  clearFile(updateStashKey.value).catch(() => { /* noop */ })
}

async function uploadUpdateFileIfNeeded(): Promise<string | null> {
  if (!selectedUpdateFile.value) return uploadedUpdateFileKey.value
  uploadUpdateFileProgress.value = 'uploading'
  try {
    const key = await uploadFile(selectedUpdateFile.value, 'certificados')
    if (!key) {
      uploadUpdateFileProgress.value = 'error'
      return null
    }
    uploadedUpdateFileKey.value = key
    uploadUpdateFileProgress.value = 'done'
    return key
  } catch {
    uploadUpdateFileProgress.value = 'error'
    return null
  }
}

function validateAddUpdate(): boolean {
  Object.keys(updateErrors).forEach((k) => delete updateErrors[k])
  const hasContent = Boolean(
    selectedUpdateFile.value ||
      uploadedUpdateFileKey.value ||
      addUpdateForm.notas.trim() ||
      addUpdateForm.fechaEmision ||
      addUpdateForm.fechaVencimiento,
  )
  if (!hasContent) {
    updateErrors.global = 'Debes proporcionar al menos archivo, notas o una fecha.'
  }
  return Object.keys(updateErrors).length === 0
}

async function submitAddUpdate() {
  if (!validateAddUpdate()) return

  savingUpdate.value = true
  try {
    // Upload file first if selected and not yet uploaded
    let archivoKey: string | null = uploadedUpdateFileKey.value
    if (selectedUpdateFile.value && !uploadedUpdateFileKey.value) {
      archivoKey = await uploadUpdateFileIfNeeded()
      if (uploadUpdateFileProgress.value === 'error' || !archivoKey) {
        savingUpdate.value = false
        return
      }
    }

    const payload: Record<string, unknown> = {}
    if (archivoKey) payload.archivoUrl = archivoKey
    if (addUpdateForm.notas.trim()) payload.notas = addUpdateForm.notas.trim()
    if (addUpdateForm.fechaEmision) payload.fechaEmision = addUpdateForm.fechaEmision
    if (addUpdateForm.fechaVencimiento) payload.fechaVencimiento = addUpdateForm.fechaVencimiento

    const res = await apiFetch<{
      success: boolean
      data: { update: CertificateUpdateRecord; certificate: CertificateDetail }
    }>(`/certificates/${route.params.id}/updates`, {
      method: 'POST',
      body: payload,
    })

    // Update local state from response — parent snapshot was mutated server-side.
    certificate.value = res.data.certificate
    showAddUpdateDialog.value = false
    // W7: clear draft + IDB stash on successful submit
    clearAddUpdateDraft()
    await clearFile(updateStashKey.value)
    await fetchUpdates()

    toast.add({
      severity: 'success',
      summary: 'Actualización agregada',
      detail: 'El historial fue actualizado correctamente.',
      life: 3000,
    })
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'Error al agregar la actualización.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    savingUpdate.value = false
  }
}

onMounted(async () => {
  await fetchCertificate()
  if (certificate.value) await fetchUpdates()
})

// W7: persist draft on every change while dialog is open
watch(
  () => [addUpdateForm.notas, addUpdateForm.fechaEmision, addUpdateForm.fechaVencimiento],
  () => { if (showAddUpdateDialog.value) writeAddUpdateDraft() }
)
</script>

<template>
  <div>
    <Toast />

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
        @click="navigateTo('/certificados')"
      />
    </div>

    <template v-else-if="certificate">
      <!-- Page Header -->
      <AppPageHeader
        :title="certificate.nombre"
        subtitle="Detalle del certificado"
      >
        <template #actions>
          <Button
            label="Volver"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            @click="navigateTo('/certificados')"
          />
          <Button
            v-if="authStore.isAdmin && !editMode"
            label="Editar"
            icon="pi pi-pencil"
            severity="info"
            data-testid="cert-edit-button"
            @click="enterEditMode"
          />
        </template>
      </AppPageHeader>

      <!-- View mode -->
      <div v-if="!editMode">
        <!-- Summary card -->
        <Card class="mb-6">
          <template #content>
            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div class="flex-shrink-0 w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <i class="pi pi-file-pdf text-2xl text-violet-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex flex-wrap items-center gap-3 mb-1">
                  <h2 class="text-2xl font-bold text-[var(--text-color)]">
                    {{ certificate.nombre }}
                  </h2>
                  <Tag
                    :value="certificate.estado"
                    :severity="estadoSeverity(certificate.estado)"
                  />
                </div>
                <div class="flex flex-wrap gap-4 text-sm text-[var(--text-color-secondary)]">
                  <span>
                    <i class="pi pi-tag mr-1" />
                    {{ tipoLabels[certificate.tipoCertificado] || certificate.tipoCertificado }}
                  </span>
                  <span v-if="certificate.fechaVencimiento">
                    <i class="pi pi-calendar mr-1" />
                    Vence: {{ formatDate(certificate.fechaVencimiento) }}
                  </span>
                  <span v-if="certificate.creadorNombre">
                    <i class="pi pi-user mr-1" />
                    {{ certificate.creadorNombre }}
                  </span>
                </div>
              </div>
              <!-- Download current snapshot -->
              <div v-if="certificate.archivoUrl">
                <Button
                  label="Descargar Archivo"
                  icon="pi pi-download"
                  severity="secondary"
                  outlined
                  :loading="downloadLoading"
                  @click="handleDownload"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Details card -->
        <Card class="mb-6">
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-info-circle text-violet-500" /> Información del Certificado
              </h3>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo</p>
                <p class="font-medium text-[var(--text-color)]">
                  {{ tipoLabels[certificate.tipoCertificado] || certificate.tipoCertificado }}
                </p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado</p>
                <Tag
                  :value="certificate.estado"
                  :severity="estadoSeverity(certificate.estado)"
                />
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Emisión</p>
                <p class="font-medium text-[var(--text-color)]">{{ formatDate(certificate.fechaEmision) }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Vencimiento</p>
                <p class="font-medium text-[var(--text-color)]">{{ formatDate(certificate.fechaVencimiento) }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Creado por</p>
                <p class="font-medium text-[var(--text-color)]">{{ certificate.creadorNombre || '—' }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Registro</p>
                <p class="font-medium text-[var(--text-color)]">{{ formatDate(certificate.createdAt) }}</p>
              </div>

              <div>
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Periodicidad</p>
                <p class="font-medium text-[var(--text-color)]">
                  {{ periodicidadLabels[certificate.periodicidad] || certificate.periodicidad }}
                </p>
              </div>

              <div v-if="certificate.periodicidad && certificate.periodicidad !== 'UNICA'">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Periodo</p>
                <p class="font-medium text-[var(--text-color)]">{{ formatPeriodo(certificate.periodo) }}</p>
              </div>

              <div v-if="certificate.comprobantePagoUrl">
                <p class="text-xs text-[var(--text-color-secondary)] mb-2">Comprobante de pago</p>
                <Button
                  label="Descargar Comprobante"
                  icon="pi pi-download"
                  size="small"
                  severity="info"
                  outlined
                  data-testid="cert-download-comprobante"
                  @click="downloadComprobante"
                />
              </div>

              <div v-if="certificate.descripcion" class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Descripción</p>
                <p class="text-sm text-[var(--text-color)]">{{ certificate.descripcion }}</p>
              </div>

              <div v-if="certificate.archivoUrl" class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-2">Archivo adjunto (versión actual)</p>
                <Button
                  label="Descargar Archivo"
                  icon="pi pi-download"
                  size="small"
                  severity="secondary"
                  outlined
                  :loading="downloadLoading"
                  @click="handleDownload"
                />
              </div>

            </div>
          </template>
        </Card>

        <!-- D2: Historial de actualizaciones -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-history text-violet-500" /> Historial de actualizaciones
                <span class="ml-2 text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ updates.length }} entrada(s)
                </span>
              </h3>
              <Button
                v-if="authStore.isAdmin"
                label="Agregar actualización"
                icon="pi pi-plus"
                size="small"
                severity="info"
                data-testid="cert-add-update-btn"
                @click="openAddUpdateDialog"
              />
            </div>
          </template>
          <template #content>
            <div v-if="updatesLoading" class="flex items-center justify-center py-6">
              <i class="pi pi-spin pi-spinner text-2xl text-violet-500" />
            </div>

            <div
              v-else-if="updates.length === 0"
              class="text-center py-8 text-[var(--text-color-secondary)]"
              data-testid="cert-updates-empty"
            >
              <i class="pi pi-history text-4xl mb-3 block opacity-30" />
              <p>Aún no hay actualizaciones registradas para este certificado.</p>
              <p v-if="authStore.isAdmin" class="text-xs mt-2">
                Haz clic en "Agregar actualización" para registrar la primera.
              </p>
            </div>

            <div v-else class="space-y-3" data-testid="cert-updates-list">
              <div
                v-for="upd in updates"
                :key="upd.id"
                class="border border-[var(--surface-border)] rounded-lg p-4"
              >
                <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div class="flex items-center gap-2">
                    <i class="pi pi-clock text-violet-500" />
                    <span class="text-sm font-medium text-[var(--text-color)]">
                      {{ formatDate(upd.createdAt) }}
                    </span>
                  </div>
                  <Button
                    v-if="upd.archivoUrl"
                    icon="pi pi-download"
                    size="small"
                    severity="info"
                    outlined
                    label="Archivo"
                    @click="downloadUpdateFile(upd)"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div v-if="upd.fechaEmision">
                    <span class="text-[var(--text-color-secondary)]">Emisión: </span>
                    <span class="font-medium">{{ formatDate(upd.fechaEmision) }}</span>
                  </div>
                  <div v-if="upd.fechaVencimiento">
                    <span class="text-[var(--text-color-secondary)]">Vencimiento: </span>
                    <span class="font-medium">{{ formatDate(upd.fechaVencimiento) }}</span>
                  </div>
                </div>

                <div v-if="upd.notas" class="mt-2 text-sm text-[var(--text-color)] whitespace-pre-wrap">
                  {{ upd.notas }}
                </div>

                <div v-if="upd.archivoUrl" class="mt-2 text-xs text-[var(--text-color-secondary)] truncate">
                  <i class="pi pi-paperclip" /> {{ filenameFromKey(upd.archivoUrl) }}
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Edit mode (METADATA-ONLY per D2) -->
      <div v-else>
        <div class="max-w-2xl">
          <Card>
            <template #header>
              <div class="px-6 pt-5 pb-0">
                <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                  <i class="pi pi-pencil text-violet-500" /> Editar Certificado
                </h3>
                <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                  Archivo y fechas se gestionan desde el historial de actualizaciones.
                </p>
              </div>
            </template>
            <template #content>
              <form class="space-y-5" @submit.prevent="saveEdit">

                <!-- Nombre -->
                <div>
                  <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                    Nombre <span class="text-red-500">*</span>
                  </label>
                  <InputText
                    v-model="editForm.nombre"
                    placeholder="Nombre del certificado"
                    class="w-full"
                    :invalid="!!editErrors.nombre"
                  />
                  <p v-if="editErrors.nombre" class="mt-1 text-xs text-red-500">{{ editErrors.nombre }}</p>
                </div>

                <!-- Tipo y Estado (side by side) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                      Tipo <span class="text-red-500">*</span>
                    </label>
                    <Select
                      v-model="editForm.tipoCertificado"
                      :options="tipoOptions"
                      option-label="label"
                      option-value="value"
                      placeholder="Seleccionar tipo"
                      class="w-full"
                      :invalid="!!editErrors.tipoCertificado"
                    />
                    <p v-if="editErrors.tipoCertificado" class="mt-1 text-xs text-red-500">
                      {{ editErrors.tipoCertificado }}
                    </p>
                  </div>

                  <div>
                    <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                      Estado
                    </label>
                    <Select
                      v-model="editForm.estado"
                      :options="estadoOptions"
                      option-label="label"
                      option-value="value"
                      placeholder="Seleccionar estado"
                      class="w-full"
                    />
                  </div>
                </div>

                <!-- Descripción -->
                <div>
                  <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                    Descripción <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                  </label>
                  <Textarea
                    v-model="editForm.descripcion"
                    rows="3"
                    placeholder="Descripción del certificado..."
                    class="w-full"
                  />
                </div>

                <Divider />

                <!-- Actions -->
                <div class="flex justify-end gap-3">
                  <Button
                    type="button"
                    label="Cancelar"
                    icon="pi pi-times"
                    severity="secondary"
                    outlined
                    :disabled="saving"
                    @click="cancelEdit"
                  />
                  <Button
                    type="submit"
                    label="Guardar cambios"
                    icon="pi pi-check"
                    :loading="saving"
                  />
                </div>

              </form>
            </template>
          </Card>
        </div>
      </div>
    </template>

    <!-- D2: Agregar actualización dialog -->
    <Dialog
      v-model:visible="showAddUpdateDialog"
      header="Agregar actualización"
      :modal="true"
      :style="{ width: '40rem' }"
      :closable="!savingUpdate"
      data-testid="cert-add-update-dialog"
    >
      <div class="space-y-4">
        <p class="text-xs text-[var(--text-color-secondary)]">
          Al menos uno de los siguientes campos debe estar presente.
          Esta entrada quedará registrada en el historial y actualizará la versión actual del certificado.
        </p>

        <div>
          <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
            Archivo <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
          </label>
          <div
            v-if="!selectedUpdateFile"
            class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
            @click="() => { updateFileGuard.arm(); updateFileInputRef?.click() }"
            data-testid="cert-update-file-dropzone"
          >
            <i class="pi pi-upload text-2xl text-[var(--text-color-secondary)] mb-1 block" />
            <p class="text-xs text-[var(--text-color-secondary)]">Haz clic para seleccionar un archivo</p>
          </div>
          <div
            v-else
            class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
          >
            <i class="pi pi-file text-violet-500 text-lg flex-shrink-0" />
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-[var(--text-color)] truncate">{{ selectedUpdateFile.name }}</p>
              <p class="text-xs text-[var(--text-color-secondary)]">{{ (selectedUpdateFile.size / 1024).toFixed(1) }} KB</p>
            </div>
            <div v-if="uploadUpdateFileProgress === 'uploading'" class="flex-shrink-0">
              <i class="pi pi-spin pi-spinner text-violet-500" />
            </div>
            <div v-else-if="uploadUpdateFileProgress === 'done'" class="flex-shrink-0">
              <i class="pi pi-check-circle text-green-500" />
            </div>
            <div v-else-if="uploadUpdateFileProgress === 'error'" class="flex-shrink-0">
              <i class="pi pi-times-circle text-red-500" />
            </div>
            <Button
              v-if="uploadUpdateFileProgress !== 'uploading'"
              icon="pi pi-times"
              size="small"
              severity="secondary"
              text
              rounded
              @click="clearUpdateFile"
            />
          </div>
          <input
            ref="updateFileInputRef"
            type="file"
            class="hidden"
            accept="*/*"
            @change="onUpdateFileChange"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
            Notas <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
          </label>
          <Textarea
            v-model="addUpdateForm.notas"
            rows="2"
            placeholder="Notas de esta actualización..."
            class="w-full"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
              Fecha Emisión <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
            </label>
            <input
              type="date"
              v-model="addUpdateForm.fechaEmision"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
              Fecha Vencimiento <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
            </label>
            <input
              type="date"
              v-model="addUpdateForm.fechaVencimiento"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        <Message
          v-if="updateErrors.global"
          severity="warn"
          :closable="false"
          class="mt-1"
        >
          {{ updateErrors.global }}
        </Message>
      </div>

      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="savingUpdate"
          @click="showAddUpdateDialog = false"
        />
        <Button
          label="Agregar"
          icon="pi pi-check"
          :loading="savingUpdate"
          data-testid="cert-add-update-submit"
          @click="submitAddUpdate"
        />
      </template>
    </Dialog>
  </div>
</template>