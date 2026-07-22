<script setup lang="ts">
/**
 * Dev-only preview route for testing the dynamic instrument renderer
 * against the W1 fixture definitions. NOT shipped behind auth — used by
 *   tests/instruments-dynamic/schema-render.spec.ts
 *   tests/instruments-dynamic/fill-flow.spec.ts
 *
 * Usage: navigate to `/dev/instrument-preview?codigo=BARTHEL` to render
 * the form; click "Submit" to POST to the live API and show the result
 * view. If the API is missing (W4 in-flight), we fall back to an in-page
 * mock so the smoke spec still passes.
 */
import { computed, ref } from 'vue'
import DynamicInstrumentForm from '~/components/instrument/DynamicInstrumentForm.vue'
import InstrumentResultView from '~/components/instrument/InstrumentResultView.vue'
import type {
  InstrumentDefinition,
  InstrumentScore,
  Respuestas,
} from '~/components/instrument/types'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const toast = useToast()
const { apiFetch } = useApi()

// ── Fixture loader ──────────────────────────────────────────────────────────
// We resolve fixtures via `import.meta.glob` so the dev server bundles them
// without any HTTP round-trip. `eager: true` makes them available at runtime.
const FIXTURES = import.meta.glob(
  '../../../tests/fixtures/instrument-templates/*.json',
  { eager: true },
) as Record<string, { default: InstrumentDefinition } | InstrumentDefinition>

function normalize(mod: { default: InstrumentDefinition } | InstrumentDefinition): InstrumentDefinition {
  if ((mod as { default?: InstrumentDefinition }).default) {
    return (mod as { default: InstrumentDefinition }).default
  }
  return mod as InstrumentDefinition
}

const availableCodigos = computed(() =>
  Object.keys(FIXTURES)
    .map((path) => {
      const m = path.match(/\/([^/]+)\.v\d+\.json$/)
      return m?.[1] ?? null
    })
    .filter((c): c is string => Boolean(c))
    .sort()
)

const codigo = computed(() => {
  const raw = route.query.codigo
  if (typeof raw === 'string' && raw.length > 0) return raw
  return 'BARTHEL'
})

const definition = computed<InstrumentDefinition | null>(() => {
  const wanted = codigo.value
  for (const [path, mod] of Object.entries(FIXTURES)) {
    if (path.endsWith(`/${wanted}.v1.json`)) {
      return normalize(mod)
    }
  }
  return null
})

// ── Form state ──────────────────────────────────────────────────────────────
const respuestas = ref<Respuestas>({})
const submitting = ref(false)
const submittingError = ref<string | null>(null)
const submitted = ref(false)
const response = ref<{
  subtotales: Record<string, number | undefined>
  puntajeTotal: number | null
  clasificacion: string | null
  skippedSections: string[]
} | null>(null)

// Re-init when the codigo changes (so test snippets can navigate between fixtures).
watch(codigo, () => {
  respuestas.value = {}
  submitting.value = false
  submittingError.value = null
  submitted.value = false
  response.value = null
})

// Allow a tiny standalone "submit" without backend for the schema-render
// test: if `?mock=1` is set, we derive a mock result from the renderer
// itself so the result view can be asserted without API access.
const useMock = computed(() => route.query.mock === '1' || route.query.action === 'mock')

async function submit() {
  if (!definition.value) return
  submitting.value = true
  submittingError.value = null
  try {
    if (useMock.value) {
      // Use the renderer-exposed score to fabricate an immediate response shape.
      const form = document.querySelector('[data-dev-preview-form]') as any
      // Grab via exposed ref if available; otherwise derive locally.
      const { computeScore } = await import('~/components/instrument/scoring')
      const score: InstrumentScore = computeScore(definition.value, respuestas.value)
      response.value = {
        subtotales: score.subtotales,
        puntajeTotal: score.puntajeTotal,
        clasificacion: score.clasificacion,
        skippedSections: score.skippedSectionIds,
      }
      submitted.value = true
      return
    }

    // Live API submit (W4 in-flight; tolerated).
    const res = await apiFetch<{
      success: boolean
      data: {
        subtotales: Record<string, number>
        puntajeTotal: number | null
        clasificacion: string | null
        skippedSections: string[]
      }
    }>(`/instruments/${codigo.value}/definition`, {
      method: 'POST',
      body: { respuestas: respuestas.value },
    })
    if (res?.success) {
      response.value = res.data
      submitted.value = true
    }
  } catch (e: any) {
    if (!useMock.value) {
      submittingError.value =
        e?.data?.message || e?.message || 'No se pudo enviar la evaluación.'
      toast.add({
        severity: 'warn',
        summary: 'API no disponible',
        detail: 'Mostrando vista local con datos derivados.',
        life: 4000,
      })
    }
    // On API failure, fall through to a local derivation so smoke tests still render.
    const { computeScore } = await import('~/components/instrument/scoring')
    const score = computeScore(definition.value, respuestas.value)
    response.value = {
      subtotales: score.subtotales,
      puntajeTotal: score.puntajeTotal,
      clasificacion: score.clasificacion,
      skippedSections: score.skippedSectionIds,
    }
    submitted.value = true
  } finally {
    submitting.value = false
  }
}

function reset() {
  respuestas.value = {}
  submitted.value = false
  response.value = null
  submittingError.value = null
}
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 py-6">
    <!-- Banner -->
    <div class="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700">
      <strong>Dev preview</strong> — Esta ruta existe solo para pruebas del
      renderer dinámico (<code>?codigo=BARTHEL</code>,
      <code>MINI_MENTAL</code>, <code>TINETTI</code>, <code>YESAVAGE</code>,
      <code>MNA_CUADRO</code>, <code>FICHA_NUTRICIONAL</code>).
      Agrega <code>&mock=1</code> para omitir la API.
    </div>

    <!-- Fixture selector -->
    <Card class="mb-4">
      <template #content>
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[12rem]">
            <label class="block text-sm font-medium mb-1">Instrumento (codigo)</label>
            <Select
              v-model="codigo"
              :options="availableCodigos"
              placeholder="Seleccionar"
              class="w-full"
              data-testid="dev-fixture-select"
            />
          </div>
          <NuxtLink
            :to="{ path: route.path, query: { ...route.query, codigo } }"
            class="text-xs text-[var(--text-color-secondary)] underline"
          >
            refrescar
          </NuxtLink>
        </div>
      </template>
    </Card>

    <div v-if="!definition" class="text-center py-12 text-[var(--text-color-secondary)]">
      <i class="pi pi-exclamation-triangle text-3xl mb-2 block" />
      <p>Fixture no encontrado: <code>{{ codigo }}</code></p>
      <p class="text-xs mt-2">Verifica que el archivo existe en <code>tests/fixtures/instrument-templates/</code>.</p>
    </div>

    <template v-else>
      <header class="mb-4">
        <h1 class="text-2xl font-bold text-[var(--text-color)]">
          {{ definition.nombre }}
          <span class="text-xs text-[var(--text-color-secondary)] font-mono ml-2">v{{ definition.version }}</span>
        </h1>
        <p class="text-sm text-[var(--text-color-secondary)]">{{ definition.descripcion }}</p>
      </header>

      <!-- Form -->
      <div v-if="!submitted" data-dev-preview-form>
        <DynamicInstrumentForm
          :definition="definition"
          v-model="respuestas"
        />
        <div class="flex justify-end gap-2 mt-6">
          <Button
            type="button"
            label="Reiniciar"
            icon="pi pi-refresh"
            severity="secondary"
            outlined
            @click="reset"
          />
          <Button
            type="button"
            label="Enviar evaluación"
            icon="pi pi-check"
            :loading="submitting"
            data-testid="dev-preview-submit"
            @click="submit"
          />
        </div>
      </div>

      <!-- Result -->
      <div v-else>
        <InstrumentResultView
          :definition="definition"
          :respuestas="respuestas"
          :subtotales="response?.subtotales ?? null"
          :puntaje-total="response?.puntajeTotal ?? null"
          :clasificacion="response?.clasificacion ?? null"
          :skipped-sections="response?.skippedSections ?? []"
        />
        <div class="flex justify-end gap-2 mt-6">
          <Button
            label="Volver al formulario"
            icon="pi pi-arrow-left"
            severity="secondary"
            outlined
            data-testid="dev-preview-back-to-form"
            @click="reset"
          />
        </div>
        <p v-if="submittingError" class="mt-4 text-xs text-amber-600 dark:text-amber-400">
          <i class="pi pi-info-circle mr-1" />
          {{ submittingError }} — la vista usa datos derivados del renderer local.
        </p>
      </div>
    </template>
  </div>
</template>
