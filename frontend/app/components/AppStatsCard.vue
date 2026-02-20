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
  primary: 'bg-violet-500',
  success: 'bg-green-500',
  info: 'bg-blue-500',
  warn: 'bg-orange-500',
  danger: 'bg-red-500',
  secondary: 'bg-gray-500',
}

const iconBgColor = computed(() => severityColors[props.severity])

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
          :class="[
            'flex items-center justify-center w-12 h-12 rounded-lg',
            iconBgColor,
            'bg-opacity-10'
          ]"
        >
          <i :class="[icon, 'text-2xl', iconBgColor.replace('bg-', 'text-')]" />
        </div>
      </div>
    </template>
  </Card>
</template>
