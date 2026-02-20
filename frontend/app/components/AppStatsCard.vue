<script setup lang="ts">
interface Props {
  title: string
  value: number | string
  icon: string
  severity?: 'primary' | 'success' | 'info' | 'warn' | 'danger' | 'secondary'
  trend?: {
    value: number
    isPositive: boolean
  }
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'primary',
  clickable: false,
})

const emit = defineEmits<{
  click: []
}>()

const severityColors = {
  primary: { bg: 'rgba(139, 92, 246, 0.1)', text: 'text-violet-500' },
  success: { bg: 'rgba(34, 197, 94, 0.1)', text: 'text-green-500' },
  info: { bg: 'rgba(59, 130, 246, 0.1)', text: 'text-blue-500' },
  warn: { bg: 'rgba(251, 146, 60, 0.1)', text: 'text-orange-500' },
  danger: { bg: 'rgba(239, 68, 68, 0.1)', text: 'text-red-500' },
  secondary: { bg: 'rgba(107, 114, 128, 0.15)', text: 'text-gray-500' },
}

const iconBgStyle = computed(() => ({
  backgroundColor: severityColors[props.severity]?.bg || 'rgba(139, 92, 246, 0.1)',
}))

const iconTextClass = computed(() => severityColors[props.severity]?.text || 'text-violet-500')

const handleClick = () => {
  if (props.clickable) {
    emit('click')
  }
}
</script>

<template>
  <Card
    :class="[
      'h-full',
      clickable && 'cursor-pointer hover:shadow-lg transition-shadow'
    ]"
    @click="handleClick"
  >
    <template #content>
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <p class="text-sm text-[var(--text-color-secondary)] mb-2">
            {{ title }}
          </p>
          <p class="text-3xl font-bold text-[var(--text-color)] mb-2">
            {{ value }}
          </p>

          <!-- Trend Indicator -->
          <div
            v-if="trend"
            :class="[
              'flex items-center gap-1 text-sm font-medium',
              trend.isPositive ? 'text-green-600' : 'text-red-600'
            ]"
          >
            <i :class="[
              'pi text-xs',
              trend.isPositive ? 'pi-arrow-up' : 'pi-arrow-down'
            ]" />
            <span>{{ Math.abs(trend.value) }}%</span>
          </div>
        </div>

        <!-- Icon -->
        <div
          class="flex items-center justify-center w-12 h-12 rounded-lg"
          :style="iconBgStyle"
        >
          <i :class="[icon, 'text-2xl', iconTextClass]" />
        </div>
      </div>
    </template>
  </Card>
</template>
