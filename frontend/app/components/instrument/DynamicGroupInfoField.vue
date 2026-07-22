<script setup lang="ts">
/**
 * DynamicGroupInfoField — renderer for the `group-info` item type.
 *
 * Contract §1.6: one row per `rows[*]`, a single-column Choice (Dropdown)
 * per row over `columns[*]`. The answer value is an array of
 * `{ rowId, columnId }` pairs (§5.2).
 *
 * group-info is score-less (§1.6: column.score always null), so this
 * field contributes nothing to the section subtotal.
 */
import type {
  AnswerValue,
  GroupAnswerPair,
  GroupInfoItem,
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

function currentPairs(): GroupAnswerPair[] {
  if (!Array.isArray(props.modelValue)) return []
  return props.modelValue
    .filter((p): p is GroupAnswerPair =>
      !!p && typeof p.rowId === 'string' && typeof p.columnId === 'string')
}

function valueFor(rowId: string): string | null {
  return currentPairs().find((p) => p.rowId === rowId)?.columnId ?? null
}

function onRowChange(rowId: string, columnId: string | null) {
  const next = currentPairs().filter((p) => p.rowId !== rowId)
  if (columnId) next.push({ rowId, columnId })
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

    <DataTable
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
            :model-value="valueFor(data.id)"
            :options="item.columns"
            option-label="label"
            option-value="id"
            :placeholder="'Seleccionar…'"
            :disabled="disabled"
            class="w-full"
            @update:model-value="(v: string | null) => onRowChange(data.id, v)"
          />
        </template>
      </Column>
    </DataTable>

    <Message
      v-if="invalid"
      severity="error"
      :closable="false"
      class="mt-1"
    >
      Completa la frecuencia para cada grupo de alimentos.
    </Message>
  </div>
</template>
