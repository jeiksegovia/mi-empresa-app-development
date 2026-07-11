<script setup lang="ts">
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()
const { uploadFile, downloadFile } = useFileUpload()
const { stash: stashFile, restore: restoreFile, clear: clearFile } = useFileStash()

// W7: stash key + title guard for the plantilla (scoped by instrumento id).
const plantillaStashKey = computed(() => `instrumento-editar:${route.params.id}:plantilla`)
const plantillaGuard = useFileStashTitleGuard('Reemplazar plantilla del instrumento')
const instEditarDraftKey = computed(() => `instrumento-editar-draft:${route.params.id}`)

// ─── Types ────────────────────────────────────────────────────────────────────
interface InstrumentEdit {
  id: number
  nombreInstrumento: string
  codigo: string | null
  descripcion: string | null
  tipo: string
  periodicidad: string
  rolesPermitidos: string
  estado: string
  plantillaArchivo: string | null
  versionPlantilla: string
}

// ─── Roles (MultiSelect) ──────────────────────────────────────────────────────
const ROLES_OPTIONS = ['ADMIN', 'EMPLEADO', 'AUDITOR', 'OPERADOR']
const rolesArray = ref<string[]>([])

// ─── Form state ──────────────────────────────────────────────────────────────
const form = reactive({
  nombreInstrumento: '',
  codigo: '',
  descripcion: '',
  tipo: '',
  periodicidad: '',
  versionPlantilla: '',
  estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
  plantillaArchivo: '' as string,
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)
const loading = ref(true)
const error = ref('')
const originalPlantilla = ref<string | null>(null)

// ─── Plantilla upload state ──────────────────────────────────────────────────
const selectedPlantilla = ref<File | null>(null)
const plantillaInputRef = ref<HTMLInputElement | null>(null)
const uploadingPlantilla = ref(false)
const plantillaProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

// ─── Options ─────────────────────────────────────────────────────────────────
const tipoOptions = [
  { label: 'Valoración', value: 'VALORACION' },
  { label: 'Nutrición', value: 'NUTRICION' },
  { label: 'Matrícula', value: 'MATRICULA' },
  { label: 'Admisión', value: 'ADMISION' },
]

const periodicidadOptions = [
  { label: 'Única', value: 'UNICA' },
  { label: 'Anual', value: 'ANUAL' },
  { label: 'Mensual', value: 'MENSUAL' },
  { label: 'Trimestral', value: 'TRIMESTRAL' },
  { label: 'Semestral', value: 'SEMESTRAL' },
]

const estadoOptions = [
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Inactivo', value: 'INACTIVO' },
]

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchInstrument() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: InstrumentEdit }>(
      `/instruments/${route.params.id}`
    )
    const inst = res.data
    form.nombreInstrumento = inst.nombreInstrumento
    form.codigo = inst.codigo || ''
    form.descripcion = inst.descripcion || ''
    form.tipo = inst.tipo
    form.periodicidad = inst.periodicidad
    form.versionPlantilla = inst.versionPlantilla
    form.estado = (inst.estado as 'ACTIVO' | 'INACTIDO') || 'ACTIVO'
    form.plantillaArchivo = inst.plantillaArchivo || ''
    originalPlantilla.value = inst.plantillaArchivo

    rolesArray.value = inst.rolesPermitidos
      ? inst.rolesPermitidos.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  } catch (e: any) {
    if (e?.response?.status === 404 || e?.status === 404) {
      error.value = 'Instrumento no encontrado'
    } else {
      error.value = 'Error al cargar los datos del instrumento'
    }
  } finally {
    loading.value = false
  }
}

// ─── Plantilla handlers ──────────────────────────────────────────────────────
async function onPlantillaChange(event: Event) {
  plantillaGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedPlantilla.value = input.files[0]
    plantillaProgress.value = 'idle'
    await stashFile(plantillaStashKey.value, input.files[0])
    writeInstEditarDraft()
  }
}

function clearSelectedPlantilla() {
  selectedPlantilla.value = null
  plantillaProgress.value = 'idle'
  if (plantillaInputRef.value) plantillaInputRef.value.value = ''
  clearFile(plantillaStashKey.value).catch(() => { /* noop */ })
}

function removeExistingPlantilla() {
  originalPlantilla.value = null
  form.plantillaArchivo = ''
}

async function uploadSelectedPlantilla(): Promise<string | null> {
  if (!selectedPlantilla.value) return null
  plantillaProgress.value = 'uploading'
  uploadingPlantilla.value = true
  try {
    const key = await uploadFile(selectedPlantilla.value, 'instrumentos')
    if (!key) {
      plantillaProgress.value = 'error'
      return null
    }
    form.plantillaArchivo = key
    plantillaProgress.value = 'done'
    return key
  } catch {
    plantillaProgress.value = 'error'
    return null
  } finally {
    uploadingPlantilla.value = false
  }
}

async function downloadPlantilla() {
  const key = originalPlantilla.value || form.plantillaArchivo
  if (!key) return
  await downloadFile(key)
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k])

  if (!form.nombreInstrumento.trim())
    errors.nombreInstrumento = 'El nombre del instrumento es requerido'
  if (!form.tipo)
    errors.tipo = 'El tipo es requerido'
  if (!form.periodicidad)
    errors.periodicidad = 'La periodicidad es requerida'
  if (rolesArray.value.length === 0)
    errors.rolesPermitidos = 'Selecciona al menos un rol permitido'
  if (!form.versionPlantilla.trim())
    errors.versionPlantilla = 'La versión de la plantilla es requerida'

  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    // Upload new plantilla if one was selected
    if (selectedPlantilla.value && !form.plantillaArchivo) {
      const key = await uploadSelectedPlantilla()
      if (plantillaProgress.value === 'error' || !key) {
        saving.value = false
        return
      }
    }

    const payload: Record<string, unknown> = {
      nombreInstrumento: form.nombreInstrumento.trim(),
      tipo: form.tipo,
      periodicidad: form.periodicidad,
      rolesPermitidos: rolesArray.value.join(','),
      versionPlantilla: form.versionPlantilla.trim(),
      estado: form.estado,
    }
    if (form.codigo.trim()) payload.codigo = form.codigo.trim()
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()
    payload.plantillaArchivo = form.plantillaArchivo || null

    await apiFetch(`/instruments/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    toast.add({
      severity: 'success',
      summary: 'Cambios guardados',
      detail: 'El instrumento fue actualizado correctamente.',
      life: 3000,
    })

    // W7: clear draft + IDB stash on successful submit
    clearInstEditarDraft()
    await clearFile(plantillaStashKey.value)

    await navigateTo(`/instrumentos/${route.params.id}`)
  } catch (e: any) {
    const detail =
      e?.data?.message || e?.message || 'Ocurrió un error al guardar los cambios.'
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail,
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

// ─── W7: sessionStorage metadata draft persistence ───────────────────────────
function readInstEditarDraft(): {
  nombreInstrumento?: string
  codigo?: string
  descripcion?: string
  tipo?: string
  periodicidad?: string
  versionPlantilla?: string
  estado?: 'ACTIVO' | 'INACTIVO'
  roles?: string[]
  plantillaRemoved?: boolean
  ts?: number
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(instEditarDraftKey.value)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeInstEditarDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      instEditarDraftKey.value,
      JSON.stringify({
        nombreInstrumento: form.nombreInstrumento,
        codigo: form.codigo,
        descripcion: form.descripcion,
        tipo: form.tipo,
        periodicidad: form.periodicidad,
        versionPlantilla: form.versionPlantilla,
        estado: form.estado,
        roles: rolesArray.value,
        plantillaRemoved: originalPlantilla.value === null && !selectedPlantilla.value,
        ts: Date.now(),
      })
    )
  } catch { /* noop */ }
}

function clearInstEditarDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(instEditarDraftKey.value) } catch { /* noop */ }
}

async function restoreInstEditarDraft() {
  if (!import.meta.client) return
  const draft = readInstEditarDraft()
  if (!draft) return
  // Only restore draft fields if they are still empty/default to avoid
  // clobbering what fetchInstrument already populated.
  if (draft.nombreInstrumento) form.nombreInstrumento = draft.nombreInstrumento
  if (draft.codigo) form.codigo = draft.codigo
  if (draft.descripcion) form.descripcion = draft.descripcion
  if (draft.tipo) form.tipo = draft.tipo
  if (draft.periodicidad) form.periodicidad = draft.periodicidad
  if (draft.versionPlantilla) form.versionPlantilla = draft.versionPlantilla
  if (draft.estado) form.estado = draft.estado
  if (Array.isArray(draft.roles) && draft.roles.length) rolesArray.value = draft.roles
  if (draft.plantillaRemoved) originalPlantilla.value = null

  const restoredPlantilla = await restoreFile(plantillaStashKey.value)
  if (restoredPlantilla) selectedPlantilla.value = restoredPlantilla

  if (restoredPlantilla || draft.plantillaRemoved) {
    toast.add({
      severity: 'info',
      summary: 'Borrador restaurado',
      detail: 'Se recuperaron los cambios en tu sesión anterior.',
      life: 4000,
    })
  }
}

watch(
  () => [form.nombreInstrumento, form.codigo, form.descripcion, form.tipo, form.periodicidad, form.versionPlantilla, form.estado, rolesArray.value, originalPlantilla.value, selectedPlantilla.value],
  () => writeInstEditarDraft(),
  { deep: true }
)

onMounted(async () => {
  await fetchInstrument()
  await restoreInstEditarDraft()
})
</script>

<template>
  <div>
    <AppPageHeader title="Editar Instrumento" subtitle="Modificar los datos del instrumento">
      <template #actions>
        <Button
          label="Ver Detalle"
          icon="pi pi-eye"
          severity="secondary"
          outlined
          @click="navigateTo(`/instrumentos/${route.params.id}`)"
        />
      </template>
    </AppPageHeader>

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
        @click="navigateTo('/instrumentos')"
      />
    </div>

    <div v-else class="max-w-2xl">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
              <i class="pi pi-clipboard text-violet-500" /> Información del Instrumento
            </h3>
          </div>
        </template>
        <template #content>
          <form class="space-y-5" @submit.prevent="onSubmit">

            <!-- Nombre del Instrumento -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Nombre del Instrumento <span class="text-red-500">*</span>
              </label>
              <InputText
                :model-value="form.nombreInstrumento"
                @update:model-value="(v) => form.nombreInstrumento = (v ?? '').toUpperCase()"
                placeholder="Ej: Ficha de Valoración Inicial"
                class="w-full"
                :invalid="!!errors.nombreInstrumento"
              />
              <p v-if="errors.nombreInstrumento" class="mt-1 text-xs text-red-500">
                {{ errors.nombreInstrumento }}
              </p>
            </div>

            <!-- Código -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Código <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <InputText
                v-model="form.codigo"
                placeholder="Ej: FICHA-VAL-001"
                class="w-full font-mono"
              />
            </div>

            <!-- Tipo y Periodicidad (side by side) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Tipo <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model="form.tipo"
                  :options="tipoOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar tipo"
                  class="w-full"
                  :invalid="!!errors.tipo"
                />
                <p v-if="errors.tipo" class="mt-1 text-xs text-red-500">
                  {{ errors.tipo }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Periodicidad <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model="form.periodicidad"
                  :options="periodicidadOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar periodicidad"
                  class="w-full"
                  :invalid="!!errors.periodicidad"
                />
                <p v-if="errors.periodicidad" class="mt-1 text-xs text-red-500">
                  {{ errors.periodicidad }}
                </p>
              </div>
            </div>

            <!-- Estado -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Estado
              </label>
              <Select
                v-model="form.estado"
                :options="estadoOptions"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>

            <!-- Roles Permitidos -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Roles Permitidos <span class="text-red-500">*</span>
              </label>
              <MultiSelect
                v-model="rolesArray"
                :options="ROLES_OPTIONS"
                placeholder="Selecciona roles"
                class="w-full"
                display="chip"
                :invalid="!!errors.rolesPermitidos"
                data-testid="instrument-roles-multiselect"
              />
              <p v-if="errors.rolesPermitidos" class="mt-1 text-xs text-red-500">
                {{ errors.rolesPermitidos }}
              </p>
            </div>

            <!-- Versión Plantilla -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Versión Plantilla <span class="text-red-500">*</span>
              </label>
              <InputText
                v-model="form.versionPlantilla"
                placeholder="Ej: v1.0"
                class="w-full font-mono"
                :invalid="!!errors.versionPlantilla"
              />
              <p v-if="errors.versionPlantilla" class="mt-1 text-xs text-red-500">
                {{ errors.versionPlantilla }}
              </p>
            </div>

            <!-- Descripción -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Descripción <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <textarea
                v-model="form.descripcion"
                rows="3"
                placeholder="Descripción general del instrumento..."
                class="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-ground)] text-[var(--text-color)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-[var(--text-color-secondary)]"
              />
            </div>

            <!-- Plantilla archivo upload -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Plantilla (archivo) <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>

              <!-- Existing plantilla (no new file selected) -->
              <div
                v-if="!selectedPlantilla && originalPlantilla"
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
                data-testid="instrument-plantilla-existing"
              >
                <i class="pi pi-file text-violet-500 text-xl flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-color)] truncate">
                    {{ filenameFromKey(originalPlantilla) }}
                  </p>
                </div>
                <Button
                  icon="pi pi-download"
                  size="small"
                  severity="info"
                  outlined
                  label="Descargar"
                  @click="downloadPlantilla"
                />
                <Button
                  icon="pi pi-refresh"
                  size="small"
                  severity="secondary"
                  outlined
                  label="Reemplazar"
                  data-testid="instrument-plantilla-replace"
                  @click="() => { plantillaGuard.arm(); plantillaInputRef?.click() }"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Quitar plantilla'"
                  @click="removeExistingPlantilla"
                />
              </div>

              <!-- Newly selected plantilla -->
              <div
                v-else-if="selectedPlantilla"
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              >
                <i class="pi pi-file text-violet-500 text-xl flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-color)] truncate">
                    {{ selectedPlantilla.name }}
                  </p>
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    {{ (selectedPlantilla.size / 1024).toFixed(1) }} KB
                  </p>
                </div>
                <div v-if="plantillaProgress === 'uploading'" class="flex-shrink-0">
                  <i class="pi pi-spin pi-spinner text-violet-500" />
                </div>
                <div v-else-if="plantillaProgress === 'done'" class="flex-shrink-0">
                  <i class="pi pi-check-circle text-green-500" />
                </div>
                <div v-else-if="plantillaProgress === 'error'" class="flex-shrink-0">
                  <i class="pi pi-times-circle text-red-500" />
                </div>
                <Button
                  v-if="plantillaProgress !== 'uploading'"
                  icon="pi pi-times"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Cancelar'"
                  @click="clearSelectedPlantilla"
                />
              </div>

              <!-- Empty dropzone -->
              <div
                v-else
                class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-6 text-center cursor-pointer hover:border-violet-400 transition-colors"
                @click="() => { plantillaGuard.arm(); plantillaInputRef?.click() }"
                data-testid="instrument-plantilla-dropzone"
              >
                <i class="pi pi-file-pdf text-3xl text-[var(--text-color-secondary)] mb-2 block" />
                <p class="text-sm text-[var(--text-color-secondary)]">
                  Haz clic para seleccionar una plantilla
                </p>
                <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                  PDF, DOCX u otro documento de referencia
                </p>
              </div>

              <input
                ref="plantillaInputRef"
                type="file"
                class="hidden"
                accept="*/*"
                @change="onPlantillaChange"
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
                @click="navigateTo(`/instrumentos/${route.params.id}`)"
              />
              <Button
                type="submit"
                label="Guardar Cambios"
                icon="pi pi-check"
                :loading="saving || uploadingPlantilla"
                data-testid="instrument-save"
              />
            </div>

          </form>
        </template>
      </Card>
    </div>
  </div>
</template>