<script setup lang="ts">
/**
 * DynamicGroupInfoField — renderer for the `group-info` item type.
 *
 * Two modes (auto-detected via `item.cellInput`):
 *
 *  - LEGACY (default — no `cellInput` flag): one row per `rows[*]`, a single
 *    Choice (Dropdown) per row over `columns[*]`. The answer value is an
 *    array of `{ rowId, columnId }` pairs (contract §1.6 / §5.2).
 *
 *  - TEXT-CELL (`cellInput === 'text'` — fixes-jul-22 §4): one row × column
 *    cell, every coordinate present, each storing a free-text string. The
 *    answer value is `{ rowId, columnId, value }[]` and NEVER contributes to
 *    scoring (§4.1: "Text-cell values are stored unchanged in
 *    RegistroFichaCompletada.respuestas; they never contribute to scoring").
 *
 * `group-info` is score-less (column.score always null), so this field
 * contributes nothing to the section subtotal in either mode.
 */
import type {
  AnswerValue,
  GroupAnswerPair,
  GroupInfoItem,
  GroupTextCellValue,
} from './types'

const props = defineProps<{
  item: GroupInfoItem
  modelValue: AnswerValue | undefined
  disabled?: boolean
  invalid?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnswerValue]
}>()

// ─── Mode detection ────────────────────────────────────────────────────────
const isTextMode = computed(() => props.item.cellInput === 'text')

// ─── LEGACY mode helpers ────────────────────────────────────────────────────
function legacyPairs(): GroupAnswerPair[] {
  if (!Array.isArray(props.modelValue)) return []
  return props.modelValue
    .filter((p): p is GroupAnswerPair =>
      !!p && typeof p.rowId === 'string' && typeof p.columnId === 'string')
}

function legacyValueFor(rowId: string): string | null {
  return legacyPairs().find((p) => p.rowId === rowId)?.columnId ?? null
}

function onLegacyRowChange(rowId: string, columnId: string | null) {
  const next = legacyPairs().filter((p) => p.rowId !== rowId)
  if (columnId) next.push({ rowId, columnId })
  emit('update:modelValue', next)
}

// ─── TEXT-CELL mode helpers ────────────────────────────────────────────────
// We index by `${rowId}::${columnId}` for O(1) cell lookup. Empty cells are
// emitted as `value: ''` so the answer always carries the full N×M grid.
const TEXT_SEP = '::'
function textKey(rowId: string, columnId: string): string {
  return `${rowId}${TEXT_SEP}${columnId}`
}

function textCells(): GroupTextCellValue[] {
  if (isTextMode.value) {
    if (!Array.isArray(props.modelValue)) return []
    return props.modelValue
      .filter((c): c is GroupTextCellValue =>
        !!c &&
        typeof c.rowId === 'string' &&
        typeof c.columnId === 'string' &&
        typeof c.value === 'string')
  }
  // Legacy fallback — coerce if a stored answer happens to be text-cell.
  return []
}

function textValueFor(rowId: string, columnId: string): string {
  return textCells().find((c) => c.rowId === rowId && c.columnId === columnId)?.value ?? ''
}

function ensureFullGrid(current: GroupTextCellValue[]): GroupTextCellValue[] {
  // Rebuild as row-major, preserving any existing value for that coordinate.
  const lookup = new Map<string, string>()
  for (const c of current) lookup.set(textKey(c.rowId, c.columnId), c.value)
  const out: GroupTextCellValue[] = []
  for (const row of props.item.rows) {
    for (const col of props.item.columns) {
      out.push({
        rowId: row.id,
        columnId: col.id,
        value: lookup.get(textKey(row.id, col.id)) ?? '',
      })
    }
  }
  return out
}

function onTextCellChange(rowId: string, columnId: string, value: string) {
  const next = ensureFullGrid(textCells())
  const target = next.find((c) => c.rowId === rowId && c.columnId === columnId)
  if (target) target.value = value
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="space-y-2" :data-item-id="item.id" :data-item-type="item.type">
    <label class="block text-sm font-medium text-[var(--text-color)]">
      {{ item.label }}
      <span v-if="item.required" class="text-red-500">*</span>
    </label>

    <p
      v-if="item.instructions"
      class="text-xs text-[var(--text-color-secondary)]"
    >
      {{ item.instructions }}
    </p>

    <!-- Legacy: one Dropdown per row → emits {rowId,columnId}[] -->
    <DataTable
      v-if="!isTextMode"
      :value="item.rows"
      data-key="id"
      responsive-layout="scroll"
      class="w-full"
      striped-rows
    >
      <Column field="label" header="Grupo de alimentos" />
      <Column
        v-for="col in item.columns"
        :key="col.id"
        :field="col.id"
        :header="col.label"
        :style="{ width: '160px' }"
      >
        <template #body="{ data }">
          <Dropdown
            :model-value="legacyValueFor(data.id)"
            :options="item.columns"
            option-label="label"
            option-value="id"
            :placeholder="'Seleccionar…'"
            :disabled="disabled"
            class="w-full"
            @update:model-value="(v: string | null) => onLegacyRowChange(data.id, v)"
          />
        </template>
      </Column>
    </DataTable>

    <!-- Text-cell matrix: one InputText per (row × column) cell. -->
    <div v-else class="overflow-x-auto">
      <table
        class="w-full border-collapse text-sm"
        :data-testid="`text-matrix-${item.id}`"
      >
        <thead>
          <tr>
            <th class="text-left p-2 font-medium text-[var(--text-color-secondary)]">
              Grupo de alimentos
            </th>
            <th
              v-for="col in item.columns"
              :key="col.id"
              class="text-left p-2 font-medium text-[var(--text-color-secondary)] min-w-[10rem]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in item.rows"
            :key="row.id"
            class="border-t border-[var(--surface-border)]"
          >
            <td class="p-2 align-top font-medium text-[var(--text-color)]">
              {{ row.label }}
            </td>
            <td
              v-for="col in item.columns"
              :key="`${row.id}::${col.id}`"
              class="p-2 align-top"
            >
              <InputText
                :model-value="textValueFor(row.id, col.id)"
                :placeholder="`${row.label} · ${col.label}`"
                :disabled="disabled"
                class="w-full"
                :data-testid="`text-cell-${item.id}-${row.id}-${col.id}`"
                @update:model-value="(v: string) => onTextCellChange(row.id, col.id, v ?? '')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Message
      v-if="invalid"
      severity="error"
      :closable="false"
      class="mt-1"
    >
      <template v-if="isTextMode">
        Completa la frecuencia (texto) para cada celda.
      </template>
      <template v-else>
        Completa la frecuencia para cada grupo de alimentos.
      </template>
    </Message>
  </div>
</template>