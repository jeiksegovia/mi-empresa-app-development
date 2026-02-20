<script setup lang="ts">
interface Props {
  title: string
  subtitle?: string
}

defineProps<Props>()
</script>

<template>
  <div class="mb-6">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div class="flex-1 min-w-0">
        <h1 class="text-2xl md:text-3xl font-bold text-[var(--text-color)] mb-1">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="text-sm text-[var(--text-color-secondary)]"
        >
          {{ subtitle }}
        </p>
      </div>

      <!-- Action Buttons Slot -->
      <div v-if="$slots.actions" class="flex items-center gap-2">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
