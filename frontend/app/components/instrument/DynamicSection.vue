<script setup lang="ts">
/**
 * DynamicSection — renders a section block: title + instructions + items,
 * plus the contract §1.4 may-skip UX and an optimistic subtotal badge.
 *
 * The section's "skippable / collapsed" state is a pure derivation from
 * the parent's current `respuestas` — we never store a separate UI flag
 * because the contract is "answer any item ⇒ opt-in" (§1.4).
 *
 * Acceptance criterion #2: in MNA, when the cribaje subtotal is ≥ 12
 * the evaluación section collapses with the trigger-classification hint
 * and the "Completar de todos modos" affordance. Answering any item in
 * that section un-collapses it and makes its required items required.
 */
import { computed, ref } from 'vue'
import {
  computeScore,
  hasPartialAnswers,
  isSectionRequired,
} from './scoring'
import type {
  AnswerValue,
  InstrumentDefinition,
  Item,
  Respuestas,
  Section,
} from './types'
import DynamicItemField from './DynamicItemField.vue'
import DynamicGroupInfoField from './DynamicGroupInfoField.vue'

const props = defineProps<{
  definition: InstrumentDefinition
  section: Section
  respuestas: Respuestas
  /**
   * Subtotal of the section this one depends on (if any). Pass undefined
   * for the trigger section itself.
   */
  triggerSubtotal: number | undefined
}>()

const emit = defineEmits<{
  'update-item': [itemId: string, value: AnswerValue]
  'navigate': [sectionId: string]
}>()

// Track which items we've marked as invalid (for the section-level message).
// Section-level "required" errors surface below the items.
const invalidItems = ref<Set<string>>(new Set())

// Optimistic subtotal for THIS section (used in the badge).
const localScore = computed(() => {
  const score = computeScore(props.definition, props.respuestas)
  return {
    subtotal: score.subtotales[props.section.id],
    classification: props.section.subtotal?.resultEvaluation
      ? findClassification(props.section.subtotal.resultEvaluation, score.subtotales[props.section.id] ?? 0)
      : null,
  }
})

function findClassification(
  ranges: { min: number; max: number; label: string }[] | undefined,
  total: number,
): string | null {
  if (!ranges) return null
  for (const r of ranges) {
    if (total >= r.min && total <= r.max) return r.label
  }
  return null
}

// skipIf-derived state.
const skipState = computed(() => {
  const sec = props.section
  if (!sec.condition?.skipIf) {
    return { kind: 'normal' as const }
  }
  const op = sec.condition.skipIf.op
  const v = sec.condition.skipIf.value
  const triggerSub = props.triggerSubtotal
  const met = typeof triggerSub === 'number' && compareOp(triggerSub, op, v)
  const anyAnswered = sec.items.some((it) => answerPresent(it, props.respuestas[it.id]))
  if (met && !anyAnswered) return { kind: 'skippable' as const, triggerSubtotal: triggerSub ?? 0 }
  if (met && anyAnswered) return { kind: 'optedIn' as const }
  return { kind: 'normal' as const }
})

// Whether THIS section is now required (driven by score/state per §1.4).
const requiredNow = computed(() =>
  isSectionRequired(props.definition, props.section, props.respuestas, props.triggerSubtotal)
)

const partial = computed(() =>
  hasPartialAnswers(props.definition, props.section, props.respuestas, props.triggerSubtotal)
)

// User-controlled expand toggle. When false (default for a skipped section),
// items are hidden. When true, items are shown & editable.
const expandedOverride = ref(false)

const isCollapsed = computed(() => {
  if (skipState.value.kind !== 'skippable') return false
  return !expandedOverride.value
})

function onForceComplete() {
  expandedOverride.value = true
}

function compareOp(a: number, op: string, b: number): boolean {
  switch (op) {
    case '>=': return a >= b
    case '<=': return a <= b
    case '>': return a > b
    case '<': return a < b
    case '==': return a === b
    case '!=': return a !== b
  }
  return false
}

function answerPresent(_item: Item, value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (typeof value === 'string' && value.trim() === '') return false
  if (Array.isArray(value) && value.length === 0) return false
  return true
}

function updateItem(itemId: string, value: AnswerValue) {
  // Once user touches any item in a skippable section, switch out of collapsed mode
  // (so the opt-in applies to all items simultaneously).
  if (skipState.value.kind === 'skippable') expandedOverride.value = true
  emit('update-item', itemId, value)
}

function isItemValid(item: Item): boolean {
  // Per contract §1.4: only required items matter unless the section is in
  // its "normal" (always required) state. We don't have visibility into
  // parent-level validation here — just mark required-but-empty items invalid
  // when the section is required (regardless of why).
  if (!item.required) return true
  if (!requiredNow.value) return true
  return answerPresent(item, props.respuestas[item.id])
}

const allRequiredValid = computed(() =>
  props.section.items.every((it) => isItemValid(it))
)
</script>

<template>
  <section
    class="space-y-4 p-5 rounded-lg border"
    :class="[
      isCollapsed
        ? 'border-dashed border-[var(--surface-border)] bg-[var(--surface-ground)] opacity-70'
        : 'border-[var(--surface-border)] bg-[var(--surface-card)]',
    ]"
    :data-section-id="section.id"
    :data-section-state="skipState.kind"
  >
    <!-- Header -->
    <header class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
      <div>
        <h3 class="text-lg font-semibold text-[var(--text-color)]">
          {{ section.titulo }}
          <span
            v-if="requiredNow && section.items.some((it) => it.required)"
            class="text-red-500 text-sm font-normal ml-1"
          >
            (obligatorio)
          </span>
        </h3>
        <p
          v-if="section.instructions"
          class="text-xs text-[var(--text-color-secondary)] mt-1"
        >
          {{ section.instructions }}
        </p>
      </div>

      <!-- Optimistic subtotal badge (when scored) -->
      <div
        v-if="section.subtotal"
        class="flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap"
        :class="isCollapsed
          ? 'bg-[var(--surface-card)] border border-[var(--surface-border)]'
          : 'bg-violet-50 dark:bg-violet-900/20'"
      >
        <i class="pi pi-calculator text-violet-500" />
        <div>
          <p class="text-xs text-[var(--text-color-secondary)]">Subtotal</p>
          <p class="font-semibold">
            {{ localScore.subtotal ?? '—' }} / {{ section.subtotal.max }}
          </p>
          <p
            v-if="localScore.classification"
            class="text-xs text-violet-600 dark:text-violet-300"
          >
            {{ localScore.classification }}
          </p>
        </div>
      </div>
    </header>

    <!-- Skippable UX (§1.4) -->
    <div
      v-if="skipState.kind === 'skippable'"
      class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700"
    >
      <div class="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
        <i class="pi pi-info-circle mt-0.5" />
        <div>
          <p class="font-medium">
            Esta sección se puede omitir.
          </p>
          <p class="text-xs">
            Clasificación según la sección anterior:
            <strong>"{{ section.condition?.skipIf?.sectionId }}"</strong>
            ({{ (skipState as { kind: 'skippable'; triggerSubtotal: number }).triggerSubtotal }})
            → la evaluación se considera suficiente.
          </p>
        </div>
      </div>
      <Button
        v-if="!expandedOverride"
        label="Completar de todos modos"
        icon="pi pi-pencil"
        size="small"
        severity="secondary"
        outlined
        :data-testid="`section-${section.id}-force-complete`"
        @click="onForceComplete"
      />
    </div>

    <!-- Partial-answer warning (§1.4: server returns 400 INVALID_ANSWER_PAYLOAD) -->
    <Message
      v-if="partial"
      severity="warn"
      :closable="false"
    >
      Has respondido parcialmente esta sección. Para conservar el opt-in
      debes completar todos los campos requeridos.
    </Message>

    <!-- Items -->
    <div v-show="!isCollapsed" class="space-y-4">
      <DynamicItemField
        v-for="item in section.items.filter((i) => i.type !== 'group-info')"
        :key="item.id"
        :item="item"
        :model-value="respuestas[item.id]"
        :invalid="requiredNow && item.required && !isItemValid(item)"
        :disabled="isCollapsed"
        @update:model-value="(v: AnswerValue) => updateItem(item.id, v)"
      />
      <DynamicGroupInfoField
        v-for="item in section.items.filter((i) => i.type === 'group-info')"
        :key="item.id"
        :item="item"
        :model-value="respuestas[item.id]"
        :invalid="requiredNow && item.required && !isItemValid(item)"
        :disabled="isCollapsed"
        @update:model-value="(v: AnswerValue) => updateItem(item.id, v)"
      />
    </div>
  </section>
</template>
