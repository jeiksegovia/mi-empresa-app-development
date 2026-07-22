<script setup lang="ts">
/**
 * DynamicItemField — single-source renderer for the 4 non-group item types:
 *   - single-select-scored (radio group ≤ 4 opts, SelectButton for ≥ 5)
 *   - single-select-info (Dropdown for ≥ 5, RadioButton group for less)
 *   - number-info (InputNumber with optional constraints)
 *   - text-info (Textarea for >= 60-char placeholder, InputText otherwise)
 *
 * Contract-driven: this file has zero instrument-specific code — every
 * choice is data-driven from `item.options` / `item.constraints` / type.
 *
 * v-model pitfall:
 *   Per project memory, parents that pass `v-model="someConstReactive.field"`
 *   silently drop our emit. To be safe we declare this as a modelValue
 *   prop + update emit. Parent: `<DynamicItemField
 *     :model-value="state[item.id]"
 *     @update:model-value="(v) => updateField(item.id, v)"
 *   >`. The form's wrapper emits an aggregate
 *   `update:modelValue` after applying the patch.
 */
import { computed } from 'vue'
import type {
  AnswerValue,
  Item,
  NumberInfoItem,
  SingleSelectInfoItem,
  SingleSelectScoredItem,
  TextInfoItem,
} from './types'

const props = defineProps<{
  item: Item
  modelValue: AnswerValue | undefined
  /** Per contract §5.1 — used to surface validation messages in Spanish. */
  invalid?: boolean
  /** Disabled when section is skipped (§1.4 may-skip) or global form disabled. */
  disabled?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AnswerValue]
}>()

const isScored = computed(() => props.item.type === 'single-select-scored')

const textAsTextarea = computed(() => {
  if (props.item.type !== 'text-info') return false
  const ph = (props.item as TextInfoItem).placeholder ?? ''
  // Heuristic: long placeholders indicate free-form, multi-line text — show Textarea.
  return ph.length >= 60 || (props.item.label?.toLowerCase().includes('recomendac') ?? false)
})

// Stable component ref by type for clearer test selectors.
const itemTypeTag = computed(() => `data-testid="item-${props.item.type}-${props.item.id}"`)

function setValue(v: AnswerValue) {
  emit('update:modelValue', v)
}

function onTextInput(e: Event) {
  const v = (e.target as HTMLInputElement | HTMLTextAreaElement).value
  setValue(v)
}

// For <InputNumber>, PrimeVue emits `null` when cleared → strip to keep the
// flat shape clean (`undefined` would not appear; empty string '' would).
function onNumberInput(v: number | string | null) {
  if (v === null || v === '') {
    emit('update:modelValue', undefined as unknown as AnswerValue)
    return
  }
  if (typeof v === 'number') {
    setValue(v)
    return
  }
  const n = Number(v)
  setValue(Number.isFinite(n) ? n : (v as unknown as AnswerValue))
}

function onSelectChange(v: unknown) {
  setValue(v as AnswerValue)
}

const radioOptions = computed(() => {
  if (props.item.type !== 'single-select-scored' && props.item.type !== 'single-select-info') {
    return []
  }
  return (props.item as SingleSelectScoredItem | SingleSelectInfoItem).options
})

const numberConstraints = computed(() => {
  if (props.item.type !== 'number-info') return null
  const c = (props.item as NumberInfoItem).constraints
  return c ?? null
})
</script>

<template>
  <div class="space-y-2" :data-item-id="item.id" :data-item-type="item.type">
    <!-- LABEL + required marker -->
    <div class="flex items-start gap-2">
      <label
        :for="`item-${item.id}`"
        class="block text-sm font-medium text-[var(--text-color)]"
      >
        {{ item.label }}
        <span v-if="item.required" class="text-red-500">*</span>
      </label>
    </div>

    <p
      v-if="item.instructions"
      class="text-xs text-[var(--text-color-secondary)]"
    >
      {{ item.instructions }}
    </p>

    <!-- single-select-scored / single-select-info: radio (≤ 4) vs SelectButton/Dropdown (≥ 5) -->
    <div v-if="item.type === 'single-select-scored' || item.type === 'single-select-info'">
      <!-- 2-4 options: radio group; doesn't trigger upper-casing inputs (not text) -->
      <div v-if="radioOptions.length <= 4" class="flex flex-col gap-2">
        <div
          v-for="opt in radioOptions"
          :key="opt.value"
          class="flex items-start gap-2 p-2 rounded-md cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          :class="{ 'opacity-60 pointer-events-none': disabled }"
        >
          <RadioButton
            :name="`item-${item.id}`"
            :value="opt.value"
            :model-value="modelValue"
            :disabled="disabled"
            :input-id="`${item.id}-${opt.value}`"
            @update:model-value="onSelectChange"
          />
          <label
            :for="`${item.id}-${opt.value}`"
            class="text-sm text-[var(--text-color)] cursor-pointer flex-1"
          >
            {{ opt.label }}
          </label>
        </div>
      </div>

      <!-- ≥ 5 options: SelectButton (scored) or Dropdown (info) -->
      <SelectButton
        v-else-if="isScored"
        :model-value="modelValue"
        :options="radioOptions"
        option-label="label"
        option-value="value"
        :allow-empty="!item.required"
        :disabled="disabled"
        class="flex flex-wrap"
        @update:model-value="onSelectChange"
      />
      <Dropdown
        v-else
        :model-value="modelValue"
        :options="radioOptions"
        option-label="label"
        option-value="value"
        :placeholder="`Seleccionar…`"
        :disabled="disabled"
        class="w-full md:max-w-md"
        @update:model-value="onSelectChange"
      />
    </div>

    <!-- number-info -->
    <div v-else-if="item.type === 'number-info'" class="max-w-xs">
      <InputNumber
        :model-value="(modelValue as number | undefined) ?? null"
        :min="numberConstraints?.min ?? null"
        :max="numberConstraints?.max ?? null"
        :min-fraction-digits="0"
        :max-fraction-digits="2"
        :disabled="disabled"
        class="w-full"
        @update:model-value="onNumberInput"
      />
      <p
        v-if="numberConstraints"
        class="text-xs text-[var(--text-color-secondary)] mt-1"
      >
        Rango permitido: {{ numberConstraints.min }} – {{ numberConstraints.max }}
      </p>
    </div>

    <!-- text-info -->
    <div v-else-if="item.type === 'text-info'" class="max-w-2xl">
      <Textarea
        v-if="textAsTextarea"
        :model-value="(modelValue as string | undefined) ?? ''"
        :placeholder="(item as TextInfoItem).placeholder ?? ''"
        :rows="4"
        :disabled="disabled"
        class="w-full"
        @update:model-value="(v: string | null) => setValue((v ?? '') as unknown as AnswerValue)"
      />
      <InputText
        v-else
        :model-value="(modelValue as string | undefined) ?? ''"
        :placeholder="(item as TextInfoItem).placeholder ?? ''"
        :disabled="disabled"
        class="w-full"
        @update:model-value="(v: string | null) => setValue((v ?? '') as unknown as AnswerValue)"
      />
    </div>

    <Message
      v-if="invalid"
      severity="error"
      :closable="false"
      class="mt-1"
    >
      Este campo es requerido.
    </Message>
  </div>
</template>
