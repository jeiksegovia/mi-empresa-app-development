<script setup lang="ts">
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

// ─── Composables ──────────────────────────────────────────────────────────────
const { apiFetch } = useApi()
const toast = useToast()
const { uploadFile } = useFileUpload()
const { stash: stashFile, restore: restoreFile, clear: clearStashedFile } = useFileStash()

// ─── W7: stash keys + title guards ───────────────────────────────────────────
const certFileGuard = useFileStashTitleGuard('Adjuntar archivo del certificado')
const comprobanteGuard = useFileStashTitleGuard('Adjuntar comprobante de pago')
const firstFileGuard = useFileStashTitleGuard('Adjuntar archivo de la actualización')

// sessionStorage draft key (metadata only — file bodies go to IDB)
const CERT_CREAR_DRAFT_KEY = 'cert-crear:draft'

// ─── Form state ───────────────────────────────────────────────────────────────
const form = reactive({
  nombre: '',
  tipoCertificado: '',
  descripcion: '',
  fechaEmision: '',
  fechaVencimiento: '',
  periodicidad: 'UNICA' as 'UNICA' | 'MENSUAL' | 'ANUAL',
  periodo: '' as string, // YYYY-MM (any non-UNICA)
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

// ─── File upload state (cert archivo) ─────────────────────────────────────────
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploadingFile = ref(false)
const uploadedKey = ref<string | null>(null)
const uploadProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

// ─── File upload state (comprobante de pago) ─────────────────────────────────
const selectedComprobante = ref<File | null>(null)
const comprobanteInputRef = ref<HTMLInputElement | null>(null)
const uploadingComprobante = ref(false)
const uploadedComprobanteKey = ref<string | null>(null)
const comprobanteProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

// ─── Select options ───────────────────────────────────────────────────────────
const tipoOptions = [
  {
    label: 'Alcaldía',
    value: 'ALCALDIA',
    description: 'Uso de suelos; certificados específicos por empresa',
  },
  { label: 'Gobernación', value: 'GOBERNACION', description: '(pendiente)' },
  {
    label: 'Secretarías',
    value: 'SECRETARIAS',
    description: 'Secretaría de salud, desinfección tanques agua potable',
  },
  { label: 'Tributarios', value: 'TRIBUTARIOS', description: 'RUT' },
  {
    label: 'Registro Mercantil',
    value: 'REGISTRO_MERCANTIL',
    description: 'Cámara de comercio, bomberos, SAYCO y Acinpro',
  },
  { label: 'Otro', value: 'OTRO', description: '—' },
]


const periodicidadOptions = [
  { label: 'Única', value: 'UNICA' },
  { label: 'Mensual', value: 'MENSUAL' },
  { label: 'Anual', value: 'ANUAL' },
]

// ─── File selection handler ───────────────────────────────────────────────────
async function onFileChange(event: Event) {
  certFileGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedFile.value = input.files[0]
    uploadedKey.value = null
    uploadProgress.value = 'idle'
    await stashFile('cert-crear:file', input.files[0])
  }
}

function clearFile() {
  selectedFile.value = null
  uploadedKey.value = null
  uploadProgress.value = 'idle'
  if (fileInputRef.value) fileInputRef.value.value = ''
  clearStashedFile('cert-crear:file').catch(() => { /* noop */ })
}

async function uploadSelectedFile(): Promise<string | null> {
  if (!selectedFile.value) return null

  uploadProgress.value = 'uploading'
  uploadingFile.value = true
  try {
    const key = await uploadFile(selectedFile.value, 'certificados')
    if (!key) {
      uploadProgress.value = 'error'
      return null
    }
    uploadedKey.value = key
    uploadProgress.value = 'done'
    return key
  } catch (e: any) {
    uploadProgress.value = 'error'
    return null
  } finally {
    uploadingFile.value = false
  }
}

// ─── Comprobante de pago handlers ────────────────────────────────────────────
async function onComprobanteChange(event: Event) {
  comprobanteGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedComprobante.value = input.files[0]
    uploadedComprobanteKey.value = null
    comprobanteProgress.value = 'idle'
    await stashFile('cert-crear:comprobante', input.files[0])
  }
}

function clearComprobante() {
  selectedComprobante.value = null
  uploadedComprobanteKey.value = null
  comprobanteProgress.value = 'idle'
  if (comprobanteInputRef.value) comprobanteInputRef.value.value = ''
  clearStashedFile('cert-crear:comprobante').catch(() => { /* noop */ })
}

async function uploadSelectedComprobante(): Promise<string | null> {
  if (!selectedComprobante.value) return null
  comprobanteProgress.value = 'uploading'
  uploadingComprobante.value = true
  try {
    const key = await uploadFile(selectedComprobante.value, 'certificados')
    if (!key) {
      comprobanteProgress.value = 'error'
      return null
    }
    uploadedComprobanteKey.value = key
    comprobanteProgress.value = 'done'
    return key
  } catch (e: any) {
    comprobanteProgress.value = 'error'
    return null
  } finally {
    uploadingComprobante.value = false
  }
}

// ─── First update state (D2: optional initial CertificadoUpdate) ──────────────
// Allows the user to add an initial historial entry in the same flow as creating
// the certificate. At least ONE of the four fields must be set (file/notas/fechas)
// — enforced both client-side and server-side (Zod refine).
const firstUpdate = reactive({
  notas: '',
  fechaEmision: '',
  fechaVencimiento: '',
})
const selectedFirstFile = ref<File | null>(null)
const firstFileInputRef = ref<HTMLInputElement | null>(null)
const uploadingFirstFile = ref(false)
const firstFileProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')
const firstFileKey = ref<string | null>(null)

async function onFirstFileChange(event: Event) {
  firstFileGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedFirstFile.value = input.files[0]
    firstFileKey.value = null
    firstFileProgress.value = 'idle'
    await stashFile('cert-crear:update-file', input.files[0])
  }
}

function clearFirstFile() {
  selectedFirstFile.value = null
  firstFileKey.value = null
  firstFileProgress.value = 'idle'
  if (firstFileInputRef.value) firstFileInputRef.value.value = ''
  clearStashedFile('cert-crear:update-file').catch(() => { /* noop */ })
}

async function uploadFirstFile(): Promise<string | null> {
  if (!selectedFirstFile.value) return null
  firstFileProgress.value = 'uploading'
  uploadingFirstFile.value = true
  try {
    const key = await uploadFile(selectedFirstFile.value, 'certificados')
    if (!key) {
      firstFileProgress.value = 'error'
      return null
    }
    firstFileKey.value = key
    firstFileProgress.value = 'done'
    return key
  } catch {
    firstFileProgress.value = 'error'
    return null
  } finally {
    uploadingFirstFile.value = false
  }
}

function hasFirstUpdateContent(): boolean {
  return Boolean(
    selectedFirstFile.value ||
      firstFileKey.value ||
      firstUpdate.notas.trim() ||
      firstUpdate.fechaEmision ||
      firstUpdate.fechaVencimiento,
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k])

  if (!form.nombre.trim()) errors.nombre = 'El nombre es requerido'
  if (!form.tipoCertificado) errors.tipoCertificado = 'El tipo es requerido'

  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    // Upload primary file first if one was selected
    let archivoUrl: string | null = uploadedKey.value
    if (selectedFile.value && !uploadedKey.value) {
      archivoUrl = await uploadSelectedFile()
      if (uploadProgress.value === 'error') {
        saving.value = false
        return
      }
    }
    // Upload comprobante de pago if present
    let comprobantePagoUrl: string | null = uploadedComprobanteKey.value
    if (selectedComprobante.value && !uploadedComprobanteKey.value) {
      comprobantePagoUrl = await uploadSelectedComprobante()
      if (comprobanteProgress.value === 'error') {
        saving.value = false
        return
      }
    }

    // Build payload
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      tipoCertificado: form.tipoCertificado,
      periodicidad: form.periodicidad,
    }
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()
    if (form.fechaEmision) payload.fechaEmision = form.fechaEmision
    if (form.fechaVencimiento) payload.fechaVencimiento = form.fechaVencimiento
    if (archivoUrl) payload.archivoUrl = archivoUrl
    if (form.periodicidad !== 'UNICA' && form.periodo) {
      // Normalize to first day of month: <input type="month"> already gives YYYY-MM
      payload.periodo = `${form.periodo}-01`
    }
    if (comprobantePagoUrl) payload.comprobantePagoUrl = comprobantePagoUrl

    const created = await apiFetch<{ success: boolean; data: { id: number } }>('/certificates', {
      method: 'POST',
      body: payload,
    })

    const newId = created.data.id
    let firstUpdatePosted = false

    // D2: optional first update. Only post if at least one field is set.
    if (hasFirstUpdateContent()) {
      let archivoKey: string | null = firstFileKey.value
      if (selectedFirstFile.value && !firstFileKey.value) {
        archivoKey = await uploadFirstFile()
        if (firstFileProgress.value === 'error' || !archivoKey) {
          saving.value = false
          toast.add({
            severity: 'error',
            summary: 'Certificado creado, pero falló la subida del archivo de la primera actualización',
            detail: 'Puedes agregarla luego desde el detalle del certificado.',
            life: 5000,
          })
          await navigateTo(`/certificados/${newId}`)
          return
        }
      }

      const updatePayload: Record<string, unknown> = {}
      if (archivoKey) updatePayload.archivoUrl = archivoKey
      if (firstUpdate.notas.trim()) updatePayload.notas = firstUpdate.notas.trim()
      if (firstUpdate.fechaEmision) updatePayload.fechaEmision = firstUpdate.fechaEmision
      if (firstUpdate.fechaVencimiento) updatePayload.fechaVencimiento = firstUpdate.fechaVencimiento

      await apiFetch(`/certificates/${newId}/updates`, {
        method: 'POST',
        body: updatePayload,
      })
      firstUpdatePosted = true
    }

    if (firstUpdatePosted) {
      toast.add({
        severity: 'success',
        summary: 'Certificado creado',
        detail: 'El certificado y la primera actualización fueron registrados.',
        life: 3500,
      })
    } else {
      toast.add({
        severity: 'success',
        summary: 'Certificado creado',
        detail: 'El certificado fue registrado exitosamente.',
        life: 3000,
      })
    }

    // W7: clear draft + IDB stash on successful submit
    clearCertCrearDraft()
    await clearStashedFile('cert-crear:file')
    await clearStashedFile('cert-crear:comprobante')
    await clearStashedFile('cert-crear:update-file')

    await navigateTo(`/certificados/${newId}`)
  } catch (e: any) {
    const detail =
      e?.data?.message || e?.message || 'Ocurrió un error al crear el certificado.'
    toast.add({ severity: 'error', summary: 'Error al crear', detail, life: 5000 })
  } finally {
    saving.value = false
  }
}

// ─── W7: sessionStorage metadata draft persistence ────────────────────────────
// Mirrors the ficha `writeFichaDraft`/`readFichaDraft` pattern. File bodies
// go to IndexedDB via useFileStash; metadata is JSON-serializable so we
// keep it in sessionStorage for full-reload survival.
function readCertCrearDraft(): {
  nombre?: string
  tipoCertificado?: string
  descripcion?: string
  fechaEmision?: string
  fechaVencimiento?: string
  periodicidad?: 'UNICA' | 'MENSUAL' | 'ANUAL'
  periodo?: string
  firstUpdateNotas?: string
  firstUpdateFechaEmision?: string
  firstUpdateFechaVencimiento?: string
  ts?: number
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(CERT_CREAR_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCertCrearDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      CERT_CREAR_DRAFT_KEY,
      JSON.stringify({
        nombre: form.nombre,
        tipoCertificado: form.tipoCertificado,
        descripcion: form.descripcion,
        fechaEmision: form.fechaEmision,
        fechaVencimiento: form.fechaVencimiento,
        periodicidad: form.periodicidad,
        periodo: form.periodo,
        firstUpdateNotas: firstUpdate.notas,
        firstUpdateFechaEmision: firstUpdate.fechaEmision,
        firstUpdateFechaVencimiento: firstUpdate.fechaVencimiento,
        ts: Date.now(),
      })
    )
  } catch { /* sessionStorage may be disabled — silently ignore. */ }
}

function clearCertCrearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(CERT_CREAR_DRAFT_KEY) } catch { /* noop */ }
}

async function restoreCertCrearDraft() {
  if (!import.meta.client) return
  const draft = readCertCrearDraft()
  if (!draft) return
  form.nombre = draft.nombre ?? ''
  form.tipoCertificado = draft.tipoCertificado ?? ''
  form.descripcion = draft.descripcion ?? ''
  form.fechaEmision = draft.fechaEmision ?? ''
  form.fechaVencimiento = draft.fechaVencimiento ?? ''
  form.periodicidad = (draft.periodicidad as any) ?? 'UNICA'
  form.periodo = draft.periodo ?? ''
  firstUpdate.notas = draft.firstUpdateNotas ?? ''
  firstUpdate.fechaEmision = draft.firstUpdateFechaEmision ?? ''
  firstUpdate.fechaVencimiento = draft.firstUpdateFechaVencimiento ?? ''

  // Restore the three file blobs from IDB.
  const restoredMain = await restoreFile('cert-crear:file')
  if (restoredMain) selectedFile.value = restoredMain
  const restoredComp = await restoreFile('cert-crear:comprobante')
  if (restoredComp) selectedComprobante.value = restoredComp
  const restoredFirst = await restoreFile('cert-crear:update-file')
  if (restoredFirst) selectedFirstFile.value = restoredFirst

  if (restoredMain || restoredComp || restoredFirst || draft.nombre || draft.firstUpdateNotas) {
    toast.add({
      severity: 'info',
      summary: 'Borrador restaurado',
      detail: 'Se recuperaron los datos y archivos de tu sesión anterior.',
      life: 4000,
    })
  }
}

// Watchers — persist on every change after the page is mounted.
watch(
  () => [form.nombre, form.tipoCertificado, form.descripcion, form.fechaEmision, form.fechaVencimiento, form.periodicidad, form.periodo, firstUpdate.notas, firstUpdate.fechaEmision, firstUpdate.fechaVencimiento],
  () => writeCertCrearDraft()
)

onMounted(async () => {
  await restoreCertCrearDraft()
})
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Certificado" subtitle="Registrar un nuevo certificado de empresa">
      <template #actions>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="navigateTo('/certificados')"
        />
      </template>
    </AppPageHeader>

    <Toast />

    <div class="max-w-2xl">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
              <i class="pi pi-file-pdf text-violet-500" /> Información del Certificado
            </h3>
          </div>
        </template>
        <template #content>
          <form class="space-y-5" @submit.prevent="onSubmit">

            <!-- Tipo -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Tipo de Certificado <span class="text-red-500">*</span>
              </label>
              <Select
                v-model="form.tipoCertificado"
                :options="tipoOptions"
                option-label="label"
                option-value="value"
                placeholder="Seleccionar tipo"
                class="w-full"
                :invalid="!!errors.tipoCertificado"
              >
                <template #option="{ option }">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ option.label }}</span>
                    <span v-if="option.description" class="text-xs text-[var(--text-color-secondary)]">
                      {{ option.description }}
                    </span>
                  </div>
                </template>
              </Select>
              <p v-if="errors.tipoCertificado" class="mt-1 text-xs text-red-500">
                {{ errors.tipoCertificado }}
              </p>
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Nombre <span class="text-red-500">*</span>
              </label>
              <InputText
                v-model="form.nombre"
                placeholder="Ej: RUT 2024"
                class="w-full"
                :invalid="!!errors.nombre"
              />
              <p v-if="errors.nombre" class="mt-1 text-xs text-red-500">{{ errors.nombre }}</p>
            </div>

            <!-- Fechas -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Fecha de Emisión <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                </label>
                <input
                  type="date"
                  v-model="form.fechaEmision"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Fecha de Vencimiento <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                </label>
                <input
                  type="date"
                  v-model="form.fechaVencimiento"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            <!-- Descripción -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Descripción <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <Textarea
                v-model="form.descripcion"
                rows="3"
                placeholder="Descripción adicional del certificado..."
                class="w-full"
              />
            </div>

            
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Periodicidad
                </label>
                <Select
                  v-model="form.periodicidad"
                  :options="periodicidadOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar periodicidad"
                  class="w-full"
                />
              </div>
              <div v-if="form.periodicidad !== 'UNICA'">
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Periodo
                </label>
                <input
                  type="month"
                  v-model="form.periodo"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                  data-testid="cert-periodo-month"
                />
              </div>
            </div>

            <!-- File upload -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Archivo <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>

              <div
                v-if="!selectedFile"
                class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 transition-colors"
                @click="() => { certFileGuard.arm(); fileInputRef?.click() }"
                data-testid="cert-file-dropzone"
              >
                <i class="pi pi-upload text-3xl text-[var(--text-color-secondary)] mb-2 block" />
                <p class="text-sm text-[var(--text-color-secondary)]">
                  Haz clic para seleccionar un archivo
                </p>
                <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                  PDF, imágenes u otros documentos
                </p>
              </div>

              <div
                v-else
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              >
                <i class="pi pi-file text-violet-500 text-xl flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-color)] truncate">
                    {{ selectedFile.name }}
                  </p>
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    {{ (selectedFile.size / 1024).toFixed(1) }} KB
                  </p>
                </div>
                <div v-if="uploadProgress === 'uploading'" class="flex-shrink-0">
                  <i class="pi pi-spin pi-spinner text-violet-500" />
                </div>
                <div v-else-if="uploadProgress === 'done'" class="flex-shrink-0">
                  <i class="pi pi-check-circle text-green-500" />
                </div>
                <div v-else-if="uploadProgress === 'error'" class="flex-shrink-0">
                  <i class="pi pi-times-circle text-red-500" />
                </div>
                <Button
                  v-if="uploadProgress !== 'uploading'"
                  icon="pi pi-times"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Quitar archivo'"
                  @click="clearFile"
                />
              </div>

              <!-- Hidden file input -->
              <input
                ref="fileInputRef"
                type="file"
                class="hidden"
                accept="*/*"
                @change="onFileChange"
              />
            </div>

            
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Comprobante de pago <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>

              <div
                v-if="!selectedComprobante"
                class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 transition-colors"
                @click="() => { comprobanteGuard.arm(); comprobanteInputRef?.click() }"
                data-testid="cert-comprobante-dropzone"
              >
                <i class="pi pi-receipt text-3xl text-[var(--text-color-secondary)] mb-2 block" />
                <p class="text-sm text-[var(--text-color-secondary)]">
                  Comprobante de pago (caja, Sena, aportes sociales)
                </p>
                <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                  PDF, imágenes u otros documentos
                </p>
              </div>

              <div
                v-else
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              >
                <i class="pi pi-file text-violet-500 text-xl flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-color)] truncate">
                    {{ selectedComprobante.name }}
                  </p>
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    {{ (selectedComprobante.size / 1024).toFixed(1) }} KB
                  </p>
                </div>
                <div v-if="comprobanteProgress === 'uploading'" class="flex-shrink-0">
                  <i class="pi pi-spin pi-spinner text-violet-500" />
                </div>
                <div v-else-if="comprobanteProgress === 'done'" class="flex-shrink-0">
                  <i class="pi pi-check-circle text-green-500" />
                </div>
                <div v-else-if="comprobanteProgress === 'error'" class="flex-shrink-0">
                  <i class="pi pi-times-circle text-red-500" />
                </div>
                <Button
                  v-if="comprobanteProgress !== 'uploading'"
                  icon="pi pi-times"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Quitar comprobante'"
                  @click="clearComprobante"
                />
              </div>

              <input
                ref="comprobanteInputRef"
                type="file"
                class="hidden"
                accept="*/*"
                @change="onComprobanteChange"
              />
            </div>

            <Divider />

            <!-- D2: optional first update section -->
            <Card class="bg-[var(--surface-ground)]">
              <template #content>
                <div class="space-y-4">
                  <div>
                    <h4 class="text-sm font-semibold text-[var(--text-color)] flex items-center gap-2">
                      <i class="pi pi-history text-violet-500" /> Primera actualización <span class="text-xs font-normal text-[var(--text-color-secondary)]">(opcional)</span>
                    </h4>
                    <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                      Si lo requieres, registra aquí la primera actualización del historial
                      (archivo, notas o fechas). Debe proporcionarse al menos uno de los campos.
                    </p>
                  </div>

                  <!-- File -->
                  <div>
                    <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                      Archivo <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                    </label>
                    <div
                      v-if="!selectedFirstFile"
                      class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
                      @click="() => { firstFileGuard.arm(); firstFileInputRef?.click() }"
                      data-testid="cert-first-update-dropzone"
                    >
                      <i class="pi pi-upload text-2xl text-[var(--text-color-secondary)] mb-1 block" />
                      <p class="text-xs text-[var(--text-color-secondary)]">Haz clic para seleccionar un archivo</p>
                    </div>
                    <div
                      v-else
                      class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)]"
                    >
                      <i class="pi pi-file text-violet-500 text-lg flex-shrink-0" />
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-[var(--text-color)] truncate">{{ selectedFirstFile.name }}</p>
                        <p class="text-xs text-[var(--text-color-secondary)]">{{ (selectedFirstFile.size / 1024).toFixed(1) }} KB</p>
                      </div>
                      <div v-if="firstFileProgress === 'uploading'" class="flex-shrink-0">
                        <i class="pi pi-spin pi-spinner text-violet-500" />
                      </div>
                      <div v-else-if="firstFileProgress === 'done'" class="flex-shrink-0">
                        <i class="pi pi-check-circle text-green-500" />
                      </div>
                      <div v-else-if="firstFileProgress === 'error'" class="flex-shrink-0">
                        <i class="pi pi-times-circle text-red-500" />
                      </div>
                      <Button
                        v-if="firstFileProgress !== 'uploading'"
                        icon="pi pi-times"
                        size="small"
                        severity="secondary"
                        text
                        rounded
                        @click="clearFirstFile"
                      />
                    </div>
                    <input
                      ref="firstFileInputRef"
                      type="file"
                      class="hidden"
                      accept="*/*"
                      @change="onFirstFileChange"
                    />
                  </div>

                  <!-- Notas -->
                  <div>
                    <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                      Notas <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                    </label>
                    <Textarea
                      v-model="firstUpdate.notas"
                      rows="2"
                      placeholder="Notas de esta actualización..."
                      class="w-full"
                    />
                  </div>

                  <!-- Fechas -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                        Fecha Emisión <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                      </label>
                      <input
                        type="date"
                        v-model="firstUpdate.fechaEmision"
                        class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                        Fecha Vencimiento <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
                      </label>
                      <input
                        type="date"
                        v-model="firstUpdate.fechaVencimiento"
                        class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </template>
            </Card>

            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <Button
                type="button"
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                @click="navigateTo('/certificados')"
              />
              <Button
                type="submit"
                label="Crear Certificado"
                icon="pi pi-check"
                :loading="saving || uploadingFile"
              />
            </div>

          </form>
        </template>
      </Card>
    </div>
  </div>
</template>
