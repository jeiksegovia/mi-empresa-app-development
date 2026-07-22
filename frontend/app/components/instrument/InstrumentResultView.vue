<script setup lang="ts">
/**
 * InstrumentResultView — read-only display of a completed ficha.
 *
 * Renders section → item → answer label → score rows, with subtotals per
 * section. Sections flagged as skipped (via §1.4 may-skip) are marked
 * "Omitida — cribaje ≥ 12" with the trigger-section classification hint.
 *
 * The view is data-only: it never re-computes scores (they come from the
 * server response). It does, however, derive the display label for an
 * answer option from the section's items — purely a presentation concern.
 *
 * Acceptance: print-friendly, clean, readable.
 */
import { computed } from 'vue'
import type {
  GroupAnswerPair,
  InstrumentDefinition,
  Item,
  Respuestas,
  Section,
} from './types'

interface Props {
  /** The instrument definition used for this ficha. */
  definition: InstrumentDefinition
  /** The respuesta map (§5.1). */
  respuestas: Respuestas | null | undefined
  /** Server-computed subtotales (e.g., { abvd: 65 }). */
  subtotales: Record<string, number | undefined> | null | undefined
  /** Global puntajeTotal from server. */
  puntajeTotal: number | null | undefined
  /** Global clasificación from server (may be null for informational). */
  clasificacion: string | null | undefined
  /** Section ids the server considered skipped (§5.3 response field). */
  skippedSections?: string[]
}

const props = withDefaults(defineProps<Props>(), {
  skippedSections: () => [],
})

function optionLabel(item: Item, value: unknown): string {
  if (item.type === 'single-select-scored' || item.type === 'single-select-info') {
    const opt = item.options.find((o) => o.value === value)
    return opt?.label ?? String(value ?? '—')
  }
  if (item.type === 'number-info') {
    return value === undefined || value === null ? '—' : String(value)
  }
  if (item.type === 'text-info') {
    const v = (value as string | undefined) ?? ''
    return v === '' ? '—' : v
  }
  if (item.type === 'group-info') {
    const pairs = value as GroupAnswerPair[] | undefined
    if (!pairs || !Array.isArray(pairs) || pairs.length === 0) return '—'
    return pairs
      .map((p) => {
        const col = item.columns.find((c) => c.id === p.columnId)
        const row = item.rows.find((r) => r.id === p.rowId)
        return `${row?.label ?? p.rowId}: ${col?.label ?? p.columnId}`
      })
      .join(' · ')
  }
  return String(value ?? '—')
}

function itemScore(item: Item, value: unknown): number | null {
  if (item.type !== 'single-select-scored') return null
  const opt = item.options.find((o) => o.value === value)
  if (!opt || typeof opt.score !== 'number') return null
  return opt.score
}

function isSkipped(section: Section): boolean {
  return props.skippedSections.includes(section.id)
}

const scoringActive = computed(() => props.definition.scoring.total !== 'none')

const formattedSubtotals = computed(() => props.subtotales ?? {})
</script>

<template>
  <article class="space-y-6 print:space-y-4">
    <!-- HEADER BAND: total + classification -->
    <Card v-if="scoringActive">
      <template #content>
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wide text-[var(--text-color-secondary)]">
              Puntaje total
            </p>
            <p
              class="text-4xl font-bold"
              :class="puntajeTotal !== null && puntajeTotal !== undefined
                ? 'text-violet-600'
                : 'text-[var(--text-color-secondary)]'"
              data-testid="result-total"
            >
              {{ puntajeTotal ?? '—' }}
            </p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-[var(--text-color-secondary)]">
              Clasificación
            </p>
            <Tag
              :value="clasificacion ?? '—'"
              :severity="clasificacion ? 'success' : 'secondary'"
              class="text-base px-3 py-1"
              data-testid="result-classification"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- SECTIONS -->
    <Card
      v-for="section in definition.sections"
      :key="section.id"
      :data-section-id="section.id"
    >
      <template #header>
        <div class="px-6 pt-5 pb-0 flex items-center justify-between">
          <h3 class="text-base font-semibold text-[var(--text-color)]">
            {{ section.titulo }}
          </h3>
          <div class="flex items-center gap-2">
            <span
              v-if="isSkipped(section)"
              class="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
              data-testid="skipped-badge"
            >
              Omitida
            </span>
            <span
              v-if="section.subtotal && formattedSubtotals[section.id] !== undefined && !isSkipped(section)"
              class="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
            >
              Subtotal: {{ formattedSubtotals[section.id] }} / {{ section.subtotal.max }}
            </span>
          </div>
        </div>
      </template>
      <template #content>
        <div v-if="isSkipped(section)" class="text-sm text-[var(--text-color-secondary)] italic">
          Esta sección se omitió (condición de salto cumplida; clasificación tomada
          de la sección anterior).
        </div>
        <div v-else>
          <p
            v-if="section.instructions"
            class="text-xs text-[var(--text-color-secondary)] mb-3"
          >
            {{ section.instructions }}
          </p>
          <div class="divide-y divide-[var(--surface-border)]">
            <div
              v-for="item in section.items"
              :key="item.id"
              class="py-3 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2"
              :data-item-id="item.id"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-[var(--text-color)]">{{ item.label }}</p>
              </div>
              <div class="flex items-center gap-3 text-sm text-[var(--text-color-secondary)]">
                <span class="max-w-xs text-right">
                  {{ optionLabel(item, respuestas?.[item.id]) }}
                </span>
                <span
                  v-if="itemScore(item, respuestas?.[item.id]) !== null"
                  class="font-mono w-12 text-right"
                >
                  {{ itemScore(item, respuestas?.[item.id]) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Card>
  </article>
</template>
