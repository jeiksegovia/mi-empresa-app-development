<script setup lang="ts">
/**
 * DynamicInstrumentForm — generic renderer driven by an InstrumentDefinition
 * (contract §1). Produces a flat `Respuestas` map (contract §5.1) via the
 * `v-model` (modelValue / update:modelValue) pair.
 *
 * This component contains ZERO instrument-specific code — every choice is
 * data-driven from the definition JSON. Tested in `schema-render.spec.ts`
 * by feeding the 6 W1 fixture definitions verbatim.
 *
 * Acceptance criteria:
 *   1. Renders all 6 fixtures with no instrument-specific code in the renderer.
 *   2. MNA cribaje ≥ 12 collapses evaluación with hint + "Completar de todos modos";
 *      cribaje < 12 keeps evaluación required.
 *   3. Live optimistic subtotals per scored section + global total + tentative
 *      classification (server remains authoritative).
 *   4. Required-field validation before submit-enable (exposed via `valid`).
 *
 * v-model pitfall (project memory):
 *   Parents that pass `v-model="someConst.field"` see emits dropped. The form
 *   accepts an explicit `:model-value` + `@update:model-value` pair so the
 *   parent can safely do `Object.assign(state, newVal)` (or just re-assign a
 *   ref).
 */
import { computed } from 'vue'
import { computeScore, hasPartialAnswers, isSectionRequired } from './scoring'
import type {
  AnswerValue,
  InstrumentDefinition,
  Respuestas,
  Section,
} from './types'
import DynamicSection from './DynamicSection.vue'

const props = defineProps<{
  /** The instrument definition JSON (§1). */
  definition: InstrumentDefinition
  /** Flat answers map (§5.1). */
  modelValue: Respuestas
  /** When true, disables all inputs. Optional, defaults to false. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Respuestas]
}>()

// Local copy. The component never mutates `props.modelValue` in place; we
// always re-emit a fresh object so the parent's reactive update is observable.
function patch(itemId: string, value: AnswerValue | undefined) {
  const next: Respuestas = { ...props.modelValue }
  if (value === undefined) {
    delete next[itemId]
  } else {
    next[itemId] = value
  }
  emit('update:modelValue', next)
}

function onUpdateItem(itemId: string, value: AnswerValue) {
  patch(itemId, value)
}

// Subtotal per section — used as `triggerSubtotal` for downstream skipIf.
function triggerSubtotalFor(section: Section): number | undefined {
  if (!section.condition?.skipIf) return undefined
  const score = computeScore(props.definition, props.modelValue)
  return score.subtotales[section.condition.skipIf.sectionId]
}

// Global optimistic score.
const score = computed(() => computeScore(props.definition, props.modelValue))

// Validation: every required item of every required section must be answered.
// Per §1.4, a skipped section's items are NOT required.
const validationErrors = computed(() => {
  const errors: { sectionId: string; itemId: string }[] = []
  for (const section of props.definition.sections) {
    const triggerSub = triggerSubtotalFor(section)
    const required = isSectionRequired(props.definition, section, props.modelValue, triggerSub)
    if (!required) continue
    if (hasPartialAnswers(props.definition, section, props.modelValue, triggerSub)) {
      // Mark all required-but-empty items as invalid.
      for (const item of section.items) {
        if (!item.required) continue
        const v = props.modelValue[item.id]
        if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
          errors.push({ sectionId: section.id, itemId: item.id })
        }
      }
      continue
    }
    for (const item of section.items) {
      if (!item.required) continue
      const v = props.modelValue[item.id]
      const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0)
      if (empty) errors.push({ sectionId: section.id, itemId: item.id })
    }
  }
  return errors
})

const valid = computed(() => validationErrors.value.length === 0)
const partialErrors = computed(() =>
  props.definition.sections.filter((s) => {
    const t = triggerSubtotalFor(s)
    return hasPartialAnswers(props.definition, s, props.modelValue, t)
  }).map((s) => s.id)
)

defineExpose({ valid, score })
</script>

<template>
  <div class="space-y-6">
    <!-- Top instructions / description (read-only, contract §1) -->
    <div
      v-if="definition.description || definition.instructions"
      class="p-4 rounded-lg bg-[var(--surface-ground)] border border-[var(--surface-border)]"
    >
      <p
        v-if="definition.description"
        class="text-sm text-[var(--text-color)]"
      >
        {{ definition.description }}
      </p>
      <p
        v-if="definition.instructions"
        class="text-sm text-[var(--text-color-secondary)] mt-2"
      >
        {{ definition.instructions }}
      </p>
    </div>

    <!-- Sections -->
    <DynamicSection
      v-for="section in definition.sections"
      :key="section.id"
      :definition="definition"
      :section="section"
      :respuestas="modelValue"
      :trigger-subtotal="triggerSubtotalFor(section)"
      :disabled="disabled"
      @update-item="onUpdateItem"
    />

    <!-- Global score / classification card -->
    <Card
      v-if="definition.scoring.total !== 'none'"
      class="sticky bottom-2 z-10"
    >
      <template #content>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs text-[var(--text-color-secondary)]">Puntaje total</p>
            <p
              class="text-3xl font-bold"
              :class="score.puntajeTotal !== null ? 'text-violet-600' : 'text-[var(--text-color-secondary)]'"
            >
              {{ score.puntajeTotal !== null ? score.puntajeTotal : '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[var(--text-color-secondary)]">Clasificación tentativa</p>
            <p
              class="text-lg font-semibold"
              :data-testid="'classification-tentative'"
            >
              {{ score.clasificacion ?? '—' }}
            </p>
            <p class="text-xs text-[var(--text-color-secondary)] italic">
              (referencial — el servidor es la fuente de verdad)
            </p>
          </div>
        </div>
      </template>
    </Card>

    <!-- Validation banner — partial / missing -->
    <Message
      v-if="!valid"
      severity="warn"
      :closable="false"
      data-testid="form-validation-warning"
    >
      <span v-if="partialErrors.length > 0">
        Sección con respuestas parciales:
        {{ partialErrors.join(', ') }}. Completa todos los campos requeridos
        o retira las respuestas de esa sección.
      </span>
      <span v-else>
        Completa los campos requeridos antes de enviar la evaluación.
      </span>
    </Message>
  </div>
</template>
