<script setup lang="ts">
/**
 * W3 NOTE: plantilla file upload and versionPlantilla text input REMOVED
 * per contract §3.2 — `plantillaArchivo` + `versionPlantilla` columns were
 * dropped from `Instrumento` when the dynamic-version model was introduced.
 *
 * The dynamic-template content for an instrument now flows through
 * `InstrumentoVersion.definition` (JSONB) — managed separately (admin
 * UI / seed / upgrade script). For this MVP we keep just the metadata
 * fields here.
 */

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()
const route = useRoute()
const authStore = useAuthStore()

const INST_CREAR_DRAFT_KEY = 'instrumento-crear:draft'

// ─── Jul-22 §8: unsaved-changes guard (W2-frontend task #8). ───────────────
const isDirty = ref(false)
const { markDirty, markClean } = useUnsavedGuard(isDirty)

// ─── §3.2: Template (plantilla) selector ──────────────────────────────────────
// The 6 seeded templates (§3.1). Selecting one sends `templateCodigo` in POST
// so the backend deep-copies its active definition into v1 of the new
// instrument. "Sin plantilla" → legacy metadata-only creation (sin definición).
import type { InstrumentDefinition } from '~/components/instrument/types'

const TEMPLATE_CODIGOS = [
  'BARTHEL',
  'MINI_MENTAL',
  'TINETTI',
  'YESAVAGE',
  'MNA_CUADRO',
  'FICHA_NUTRICIONAL',
  // fixes-features-aug-6 §5: two new informational (non-scored) templates.
  // Both seeded by W2's instruments-upgrade with
  // rolesPermitidos='ADMIN,GERONTOLOGA,PROFESORES,AUXILIARES'.
  'SIGNOS_VITALES',
  'BOLETIN_ANUAL',
] as const

const NO_TEMPLATE = '__none__'
const selectedTemplate = ref<string>(NO_TEMPLATE)

interface TemplateOption {
  value: string
  codigo: string | null
  label: string
  summary: string
}

const templateSummaries = ref<Record<string, string>>({})

/** Human summary for a template definition: "N ítems · máx M" or "N ítems · informativo". */
function summarizeDefinition(def: InstrumentDefinition): string {
  const nItems = def.sections.reduce((n, s) => n + s.items.length, 0)
  if (def.scoring?.total === 'none') return `${nItems} ítems · informativo`
  let max = 0
  for (const s of def.sections) {
    for (const it of s.items) {
      if (it.type === 'single-select-scored') {
        const scores = it.options.map((o) => (typeof o.score === 'number' ? o.score : 0))
        if (scores.length) max += Math.max(...scores)
      }
    }
  }
  return `${nItems} ítems · máx ${max}`
}

const templateOptions = computed<TemplateOption[]>(() => [
  { value: NO_TEMPLATE, codigo: null, label: 'Sin plantilla (solo metadatos)', summary: 'Instrumento sin definición — no llenable' },
  ...TEMPLATE_CODIGOS.map((codigo) => ({
    value: codigo,
    codigo,
    label: codigo,
    summary: templateSummaries.value[codigo] ?? 'Resumen no disponible',
  })),
])

async function loadTemplateSummaries() {
  // Fetch each template's active definition to compute its summary. Backend may
  // 404 briefly (W9 build in parallel) — degrade gracefully per option.
  await Promise.all(
    TEMPLATE_CODIGOS.map(async (codigo) => {
      try {
        const res = await apiFetch<{
          success: boolean
          data: { version: { definition: InstrumentDefinition } }
        }>(`/instruments/${codigo}/definition`)
        const def = res?.data?.version?.definition
        if (def) templateSummaries.value[codigo] = summarizeDefinition(def)
      } catch {
        // leave default "Resumen no disponible"
      }
    }),
  )
}

// ─── Roles (MultiSelect) ──────────────────────────────────────────────────────
const rolesArray = ref<string[]>([])
const { fetchCargoRoles, roleOptions } = useCargoRoles(rolesArray)

// ─── Form state ──────────────────────────────────────────────────────────────
const form = reactive({
  nombreInstrumento: '',
  codigo: '',
  descripcion: '',
  tipo: '',
  periodicidad: '',
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

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
  // fixes-features-aug-6 (W3 fix-up, T15): when a template is chosen, the
  // backend deep-copies its active definition into v1 — but the Instrumento
  // row's `codigo` is required by the BE to address the new instrument by
  // codigo (e.g. GET /instruments/:codigo/definition). Leaving `codigo` blank
  // creates a row with `codigo=null` + an active version; the detail page's
  // loadDefinition short-circuits at `if (!codigo)` and renders "Sin
  // definición — no llenable" even though a definition exists. Close that
  // hole by requiring codigo on the FE whenever a template is selected.
  if (selectedTemplate.value !== NO_TEMPLATE && !form.codigo.trim()) {
    errors.codigo = 'El código es requerido al usar una plantilla'
  }

  return Object.keys(errors).length === 0
}

async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      nombreInstrumento: form.nombreInstrumento.trim(),
      tipo: form.tipo,
      periodicidad: form.periodicidad,
      rolesPermitidos: rolesArray.value.join(','),
    }
    if (form.codigo.trim()) payload.codigo = form.codigo.trim()
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()
    // §3.1: when a template is chosen, the backend deep-copies its active
    // definition into v1 of the new instrument.
    if (selectedTemplate.value && selectedTemplate.value !== NO_TEMPLATE) {
      payload.templateCodigo = selectedTemplate.value
    }

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

    clearInstCrearDraft()
    markClean()

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

// ─── sessionStorage metadata draft persistence ───────────────────────────────
function readInstCrearDraft(): {
  nombreInstrumento?: string
  codigo?: string
  descripcion?: string
  tipo?: string
  periodicidad?: string
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
  rolesArray.value = Array.isArray(draft.roles) ? draft.roles : []

  if (draft.nombreInstrumento) {
    toast.add({
      severity: 'info',
      summary: 'Borrador restaurado',
      detail: 'Se recuperaron los datos de tu sesión anterior.',
      life: 4000,
    })
  }
}

watch(
  () => [form.nombreInstrumento, form.codigo, form.descripcion, form.tipo, form.periodicidad, rolesArray.value],
  () => {
    writeInstCrearDraft()
    isDirty.value = true
  },
  { deep: true }
)

// Also flag dirty on template selection changes.
watch(() => selectedTemplate.value, () => {
  isDirty.value = true
})

onMounted(async () => {
  await restoreInstCrearDraft()
  await Promise.all([fetchCargoRoles(), loadTemplateSummaries()])
  // fixes-features-aug-6 §3.3 mirror: default rolesPermitidos must include the
  // creator's tokens so they can immediately fill the instrument they just
  // created. ADMIN gets the legacy 'ADMIN,EMPLEADO' shape (back-compat); EMPLEADO
  // gets ADMIN + their rol + their tipoEmpleado when present.
  if (rolesArray.value.length === 0) {
    const tok = new Set<string>(['ADMIN'])
    const rol = authStore.role
    if (rol) tok.add(rol)
    const tipo = authStore.user?.tipoEmpleado
    if (tipo) tok.add(tipo)
    rolesArray.value = Array.from(tok)
  }
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
          @click="() => { markClean(); navigateTo('/instrumentos') }"
        />
      </template>
    </AppPageHeader>


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

            <!-- §3.2: Tipo de instrumento (plantilla) -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Tipo de instrumento (plantilla)
              </label>
              <Select
                v-model="selectedTemplate"
                :options="templateOptions"
                option-label="label"
                option-value="value"
                class="w-full"
                data-testid="template-selector"
              >
                <template #option="{ option }">
                  <div class="flex flex-col py-0.5" :data-template-option="option.value">
                    <span class="font-medium">{{ option.label }}</span>
                    <span class="text-xs text-[var(--text-color-secondary)]">{{ option.summary }}</span>
                  </div>
                </template>
              </Select>
              <p class="mt-1 text-xs text-[var(--text-color-secondary)]">
                Al elegir una plantilla se copia su definición activa como versión 1
                (el instrumento queda llenable). "Sin plantilla" crea solo los
                metadatos — quedará <em>sin definición</em> y no será llenable.
              </p>
            </div>

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
                Código
                <span
                  v-if="selectedTemplate === NO_TEMPLATE"
                  class="text-xs text-[var(--text-color-secondary)]"
                >(opcional)</span>
                <span
                  v-else
                  class="text-xs text-red-500"
                >*</span>
              </label>
              <InputText
                v-model="form.codigo"
                placeholder="Ej: FICHA-VAL-001"
                class="w-full font-mono"
                :invalid="!!errors.codigo"
                data-testid="instrument-codigo-input"
              />
              <p v-if="errors.codigo" class="mt-1 text-xs text-red-500">
                {{ errors.codigo }}
              </p>
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
                :options="roleOptions"
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

            <!-- W3: Versión Plantilla + plantilla upload REMOVED per contract §3.2.
                 The dynamic template content is supplied via
                 `InstrumentoVersion.definition` (admin-managed separately). -->

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
                :loading="saving"
              />
            </div>

          </form>
        </template>
      </Card>
    </div>
  </div>
</template>