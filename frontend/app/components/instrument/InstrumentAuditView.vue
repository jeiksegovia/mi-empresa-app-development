<script setup lang="ts">
/**
 * InstrumentAuditView — read-only, print-friendly audit of an instrument
 * definition (contract-fixes-jul17-2 §4). Renders, per section: título,
 * subtotal máximo, skip rule text, section-level ranges; per item: label,
 * tipo, requerido, options (etiqueta → puntaje); plus the global
 * result-evaluation table. Spanish UI. Collapsible via native <details>
 * (default open so printing shows everything). ZERO instrument-specific code —
 * fully data-driven from the definition JSON.
 */
import type {
  ClassificationRange,
  ConditionOp,
  InstrumentDefinition,
  Item,
  Section,
} from './types'

const props = defineProps<{ definition: InstrumentDefinition }>()

const TIPO_LABELS: Record<string, string> = {
  'single-select-scored': 'Selección única (puntuada)',
  'single-select-info': 'Selección única (informativa)',
  'number-info': 'Numérico (informativo)',
  'text-info': 'Texto (informativo)',
  'group-info': 'Cuadro (informativo)',
}

const OP_SYMBOL: Record<ConditionOp, string> = {
  '>=': '≥', '<=': '≤', '>': '>', '<': '<', '==': '=', '!=': '≠',
}

function sectionTitulo(sectionId: string): string {
  return props.definition.sections.find((s) => s.id === sectionId)?.titulo ?? sectionId
}

function skipRuleText(section: Section): string | null {
  const rule = section.condition?.skipIf
  if (!rule) return null
  return `Se omite (opcional) si "${sectionTitulo(rule.sectionId)}" ${OP_SYMBOL[rule.op]} ${rule.value}`
}

function itemOptions(item: Item): { label: string; score: number | null }[] {
  if (item.type === 'single-select-scored' || item.type === 'single-select-info') {
    return item.options.map((o) => ({ label: o.label, score: o.score }))
  }
  return []
}

function scoreText(score: number | null): string {
  return score === null || score === undefined ? '—' : String(score)
}

const globalRanges = computed<ClassificationRange[]>(() =>
  props.definition.scoring.total === 'none' ? [] : props.definition.scoring.resultEvaluation,
)
const isInformational = computed(() => props.definition.scoring.total === 'none')
</script>

<template>
  <div data-testid="instrument-audit-view" class="space-y-4 text-sm audit-print">
    <p class="text-[var(--text-color-secondary)]">
      {{ definition.nombre }} · versión {{ definition.version }} ·
      <span v-if="isInformational">informativo (sin puntaje)</span>
      <span v-else>puntaje por suma de ítems</span>
    </p>

    <!-- Sections -->
    <details
      v-for="section in definition.sections"
      :key="section.id"
      :data-audit-section="section.id"
      open
      class="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-section)]"
    >
      <summary class="cursor-pointer select-none px-4 py-3 font-semibold text-[var(--text-color)] flex flex-wrap items-center gap-2">
        {{ section.titulo }}
        <span v-if="section.subtotal" class="text-xs font-normal text-[var(--text-color-secondary)]">
          (subtotal máx: {{ section.subtotal.max }})
        </span>
      </summary>

      <div class="px-4 pb-4 space-y-3">
        <!-- Skip rule -->
        <p
          v-if="skipRuleText(section)"
          :data-audit-skiprule="section.id"
          class="text-xs italic text-amber-700 dark:text-amber-400"
        >
          <i class="pi pi-info-circle mr-1" />{{ skipRuleText(section) }}
        </p>

        <!-- Section-level ranges -->
        <table
          v-if="section.subtotal?.resultEvaluation?.length"
          :data-audit-section-ranges="section.id"
          class="w-full text-xs border border-[var(--surface-border)]"
        >
          <thead>
            <tr class="bg-[var(--surface-ground)]">
              <th class="text-left px-2 py-1">Desde</th>
              <th class="text-left px-2 py-1">Hasta</th>
              <th class="text-left px-2 py-1">Clasificación (sección)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in section.subtotal.resultEvaluation" :key="i" class="border-t border-[var(--surface-border)]">
              <td class="px-2 py-1">{{ r.min }}</td>
              <td class="px-2 py-1">{{ r.max }}</td>
              <td class="px-2 py-1">{{ r.label }}</td>
            </tr>
          </tbody>
        </table>

        <!-- Items -->
        <div
          v-for="item in section.items"
          :key="item.id"
          :data-audit-item="item.id"
          class="rounded border border-[var(--surface-border)] p-3"
        >
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <span class="font-medium">{{ item.label }}</span>
            <Tag :value="TIPO_LABELS[item.type] || item.type" severity="secondary" />
            <Tag :value="item.required ? 'Requerido' : 'Opcional'" :severity="item.required ? 'info' : 'secondary'" />
          </div>

          <table
            v-if="itemOptions(item).length"
            class="w-full text-xs border border-[var(--surface-border)] mt-1"
          >
            <thead>
              <tr class="bg-[var(--surface-ground)]">
                <th class="text-left px-2 py-1">Etiqueta</th>
                <th class="text-right px-2 py-1 w-20">Puntaje</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(opt, oi) in itemOptions(item)"
                :key="oi"
                class="border-t border-[var(--surface-border)]"
                data-audit-option
              >
                <td class="px-2 py-1">{{ opt.label }}</td>
                <td class="px-2 py-1 text-right font-mono">{{ scoreText(opt.score) }}</td>
              </tr>
            </tbody>
          </table>

          <p
            v-else-if="item.type === 'number-info' && item.constraints"
            class="text-xs text-[var(--text-color-secondary)]"
          >
            Rango permitido: {{ item.constraints.min }} – {{ item.constraints.max }}
          </p>
          <p v-else class="text-xs text-[var(--text-color-secondary)]">Sin puntaje.</p>
        </div>
      </div>
    </details>

    <!-- Global result evaluation -->
    <div class="rounded-lg border border-[var(--surface-border)] p-4">
      <h4 class="font-semibold mb-2">Evaluación del resultado global</h4>
      <p v-if="isInformational" class="text-xs text-[var(--text-color-secondary)]">
        Instrumento informativo — no produce puntaje ni clasificación.
      </p>
      <table v-else data-audit-global-ranges class="w-full text-xs border border-[var(--surface-border)]">
        <thead>
          <tr class="bg-[var(--surface-ground)]">
            <th class="text-left px-2 py-1">Desde</th>
            <th class="text-left px-2 py-1">Hasta</th>
            <th class="text-left px-2 py-1">Clasificación</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in globalRanges" :key="i" class="border-t border-[var(--surface-border)]">
            <td class="px-2 py-1">{{ r.min }}</td>
            <td class="px-2 py-1">{{ r.max }}</td>
            <td class="px-2 py-1">{{ r.label }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
/* Print-friendly: expand all sections and drop interactive chrome. */
@media print {
  .audit-print details { border: 1px solid #ccc; }
  .audit-print summary { list-style: none; }
}
</style>
