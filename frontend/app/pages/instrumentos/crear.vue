<script setup lang="ts">
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()
const route = useRoute()
const { uploadFile } = useFileUpload()
const { stash: stashFile, restore: restoreFile, clear: clearFile } = useFileStash()

// W7: stash key + title guard for the plantilla
const plantillaGuard = useFileStashTitleGuard('Adjuntar plantilla del instrumento')
const INST_CREAR_DRAFT_KEY = 'instrumento-crear:draft'

// ─── Roles (MultiSelect) ──────────────────────────────────────────────────────
// Backend still accepts/returns comma-separated string per D6; the MultiSelect
// value array is joined to a string on submit.
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
  plantillaArchivo: '' as string,
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

// ─── Plantilla upload state ──────────────────────────────────────────────────
const selectedPlantilla = ref<File | null>(null)
const plantillaInputRef = ref<HTMLInputElement | null>(null)
const uploadingPlantilla = ref(false)
const plantillaProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

async function onPlantillaChange(event: Event) {
  plantillaGuard.disarm()
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    selectedPlantilla.value = input.files[0]
    form.plantillaArchivo = ''
    plantillaProgress.value = 'idle'
    await stashFile('instrumento-crear:plantilla', input.files[0])
  }
}

function clearPlantilla() {
  selectedPlantilla.value = null
  form.plantillaArchivo = ''
  plantillaProgress.value = 'idle'
  if (plantillaInputRef.value) plantillaInputRef.value.value = ''
  clearFile('instrumento-crear:plantilla').catch(() => { /* noop */ })
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

// ─── Select options ───────────────────────────────────────────────────────────
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
    // Upload plantilla first if one was selected but not yet uploaded
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
    }
    if (form.codigo.trim()) payload.codigo = form.codigo.trim()
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()
    if (form.plantillaArchivo) payload.plantillaArchivo = form.plantillaArchivo

    const res = await apiFetch<{ success: boolean; data: { id: number } }>('/instruments', {
      method: 'POST',
      body: payload,
    })

    toast.add({
      severity: 'success',
      summary: 'Instrumento creado',
      detail: 'El instrumento fue creado exitosamente.',
      life: 3500,
    })

    // W7: clear draft + IDB stash on successful submit
    clearInstCrearDraft()
    await clearFile('instrumento-crear:plantilla')

    // C3: if we arrived here via the "crear instrumento nuevo" shortcut,
    // return to the originating page (e.g. the patient's fichas tab).
    const returnTo = route.query.return
    if (typeof returnTo === 'string' && returnTo.startsWith('/')) {
      await navigateTo(returnTo)
    } else {
      await navigateTo(`/instrumentos/${res.data.id}`)
    }
  } catch (e: any) {
    const detail =
      e?.data?.message || e?.message || 'Ocurrió un error al crear el instrumento.'
    toast.add({
      severity: 'error',
      summary: 'Error al crear',
      detail,
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

// ─── W7: sessionStorage metadata draft persistence ───────────────────────────
function readInstCrearDraft(): {
  nombreInstrumento?: string
  codigo?: string
  descripcion?: string
  tipo?: string
  periodicidad?: string
  versionPlantilla?: string
  roles?: string[]
  ts?: number
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(INST_CREAR_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeInstCrearDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      INST_CREAR_DRAFT_KEY,
      JSON.stringify({
        nombreInstrumento: form.nombreInstrumento,
        codigo: form.codigo,
        descripcion: form.descripcion,
        tipo: form.tipo,
        periodicidad: form.periodicidad,
        versionPlantilla: form.versionPlantilla,
        roles: rolesArray.value,
        ts: Date.now(),
      })
    )
  } catch { /* noop */ }
}

function clearInstCrearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(INST_CREAR_DRAFT_KEY) } catch { /* noop */ }
}

async function restoreInstCrearDraft() {
  if (!import.meta.client) return
  const draft = readInstCrearDraft()
  if (!draft) return
  form.nombreInstrumento = draft.nombreInstrumento ?? ''
  form.codigo = draft.codigo ?? ''
  form.descripcion = draft.descripcion ?? ''
  form.tipo = draft.tipo ?? ''
  form.periodicidad = draft.periodicidad ?? ''
  form.versionPlantilla = draft.versionPlantilla ?? ''
  rolesArray.value = Array.isArray(draft.roles) ? draft.roles : []

  const restoredPlantilla = await restoreFile('instrumento-crear:plantilla')
  if (restoredPlantilla) selectedPlantilla.value = restoredPlantilla

  if (restoredPlantilla || draft.nombreInstrumento) {
    toast.add({
      severity: 'info',
      summary: 'Borrador restaurado',
      detail: 'Se recuperaron los datos y archivos de tu sesión anterior.',
      life: 4000,
    })
  }
}

watch(
  () => [form.nombreInstrumento, form.codigo, form.descripcion, form.tipo, form.periodicidad, form.versionPlantilla, rolesArray.value],
  () => writeInstCrearDraft(),
  { deep: true }
)

onMounted(async () => {
  await restoreInstCrearDraft()
})
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Instrumento" subtitle="Registrar un nuevo instrumento de evaluación">
      <template #actions>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="navigateTo('/instrumentos')"
        />
      </template>
    </AppPageHeader>

    <Toast />

    <div class="max-w-2xl">
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

            <!-- Roles Permitidos (D6: MultiSelect, comma-joined on submit) -->
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
              <p class="mt-1 text-xs text-[var(--text-color-secondary)]">
                Roles que podrán diligenciar este instrumento.
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

              <div
                v-if="!selectedPlantilla && !form.plantillaArchivo"
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

              <div
                v-else
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              >
                <i class="pi pi-file text-violet-500 text-xl flex-shrink-0" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-[var(--text-color)] truncate">
                    {{ selectedPlantilla?.name || filenameFromKey(form.plantillaArchivo) }}
                  </p>
                  <p v-if="selectedPlantilla" class="text-xs text-[var(--text-color-secondary)]">
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
                  v-tooltip.top="'Quitar plantilla'"
                  @click="clearPlantilla"
                />
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
                @click="navigateTo('/instrumentos')"
              />
              <Button
                type="submit"
                label="Crear Instrumento"
                icon="pi pi-check"
                :loading="saving || uploadingPlantilla"
              />
            </div>

          </form>
        </template>
      </Card>
    </div>
  </div>
</template>