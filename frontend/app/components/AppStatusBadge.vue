<script setup lang="ts">
type Status = 'Activo' | 'Inactivo' | 'Pendiente' | 'Completado' | 'Vencido'
type Severity = 'success' | 'warn' | 'danger' | 'info' | 'secondary'

interface Props {
  status: Status | string
  severity?: Severity
}

const props = defineProps<Props>()

const statusSeverityMap: Record<Status, Severity> = {
  'Activo': 'success',
  'Inactivo': 'secondary',
  'Pendiente': 'warn',
  'Completado': 'success',
  'Vencido': 'danger',
}

const computedSeverity = computed(() => {
  if (props.severity) {
    return props.severity
  }
  return statusSeverityMap[props.status as Status] || 'info'
})
</script>

<template>
  <Badge
    :value="status"
    :severity="computedSeverity"
  />
</template>
