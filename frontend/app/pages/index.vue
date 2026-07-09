<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth'],
})

// --- Activity feed ---
const { apiFetch } = useApi()

interface ActivityItem {
  type: 'ficha_completada' | 'patient_created' | 'employee_created'
  date: string
  description: string
  actorName: string
}

const activities = ref<ActivityItem[]>([])
const loadingActivities = ref(false)

function activityIcon(type: ActivityItem['type']): string {
  switch (type) {
    case 'ficha_completada': return 'pi pi-file-check'
    case 'patient_created':  return 'pi pi-user'
    case 'employee_created': return 'pi pi-user-plus'
    default:                 return 'pi pi-info-circle'
  }
}

function activityIconColor(type: ActivityItem['type']): string {
  switch (type) {
    case 'ficha_completada': return '#22c55e'   // green-500
    case 'patient_created':  return '#3b82f6'   // blue-500
    case 'employee_created': return '#8b5cf6'   // violet-500
    default:                 return '#6b7280'
  }
}

function activityIconBg(type: ActivityItem['type']): string {
  switch (type) {
    case 'ficha_completada': return 'rgba(34, 197, 94, 0.1)'
    case 'patient_created':  return 'rgba(59, 130, 246, 0.1)'
    case 'employee_created': return 'rgba(139, 92, 246, 0.1)'
    default:                 return 'rgba(107, 114, 128, 0.1)'
  }
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  catch {
    return dateStr
  }
}

async function fetchActivities() {
  loadingActivities.value = true
  try {
    const res = await apiFetch('/dashboard/activity')
    activities.value = res.data || []
  }
  catch (e) {
    console.error('Error fetching activities', e)
    activities.value = []
  }
  finally {
    loadingActivities.value = false
  }
}

onMounted(() => {
  fetchActivities()
})
</script>

<template>
  <div>
    <!-- Page Title -->
    <div class="mb-8">
      <h2 class="text-3xl font-bold text-[var(--text-color)] mb-2">
        Bienvenido a Mi Empresa App
      </h2>
      <p class="text-[var(--text-color-secondary)]">
        Gestiona tu empresa desde estos 4 módulos principales
      </p>
    </div>

    <!-- 4 Main Module Cards in 2x2 grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">

      <!-- Module 1: Certificación Empresarial -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/certificados')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(139, 92, 246, 0.1);"
            >
              <i class="pi pi-file-check text-3xl text-violet-500" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Certificación Empresarial
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Gestiona documentos regulatorios: RUT, Cámara de Comercio, permisos sanitarios. Recibe alertas 30 días antes del vencimiento.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-violet-500">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs text-violet-500" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 2: Gestión de Personal -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/empleados')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(34, 197, 94, 0.1);"
            >
              <i class="pi pi-users text-3xl" style="color: #22c55e;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Gestión de Personal
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Administra empleados, contratos y certificaciones. Incluye plantillas legales pre-cargadas como sugerencias.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #22c55e;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #22c55e;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 3: Gestión de Clientes -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow"
        @click="navigateTo('/pacientes')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(59, 130, 246, 0.1);"
            >
              <i class="pi pi-user text-3xl" style="color: #3b82f6;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Gestión de Clientes
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Centraliza toda la información de tus clientes: historiales, notas, documentación y seguimiento organizado.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #3b82f6;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #3b82f6;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Module 4: Nómina y Finanzas -->
      <Card
        class="cursor-pointer hover:shadow-lg transition-shadow opacity-70"
        @click="navigateTo('/nomina')"
      >
        <template #content>
          <div class="flex items-start gap-4">
            <div
              class="flex items-center justify-center w-16 h-16 rounded-xl flex-shrink-0"
              style="background: rgba(251, 146, 60, 0.1);"
            >
              <i class="pi pi-calculator text-3xl" style="color: #fb923c;" />
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-semibold text-[var(--text-color)] mb-2">
                Nómina y Finanzas
              </h3>
              <p class="text-sm text-[var(--text-color-secondary)] mb-4">
                Cálculo automático de salarios, deducciones y comprobantes de pago. Próximamente disponible.
              </p>
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium" style="color: #fb923c;">Ir al módulo</span>
                <i class="pi pi-arrow-right text-xs" style="color: #fb923c;" />
              </div>
            </div>
          </div>
        </template>
      </Card>

    </div>

    <!-- Recent Activity -->
    <Card>
      <template #content>
        <h3 class="text-lg font-semibold text-[var(--text-color)] mb-6">
          Actividad Reciente
        </h3>

        <!-- Loading spinner -->
        <div v-if="loadingActivities" class="flex justify-center items-center py-8">
          <i class="pi pi-spin pi-spinner text-2xl text-[var(--primary-color)]" />
        </div>

        <!-- Empty state -->
        <div
          v-else-if="activities.length === 0"
          class="flex flex-col items-center justify-center py-8 gap-2"
        >
          <i class="pi pi-inbox text-3xl text-[var(--text-color-secondary)]" />
          <p class="text-sm text-[var(--text-color-secondary)]">
            Sin actividad reciente
          </p>
        </div>

        <!-- Activity list -->
        <div v-else class="space-y-4">
          <div
            v-for="(activity, index) in activities"
            :key="index"
            class="flex items-start gap-4 p-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
          >
            <div
              class="flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0"
              :style="{ background: activityIconBg(activity.type) }"
            >
              <i
                :class="[activityIcon(activity.type), 'text-base']"
                :style="{ color: activityIconColor(activity.type) }"
              />
            </div>
            <div class="flex-1">
              <p class="font-medium text-[var(--text-color)] mb-1">
                {{ activity.description }}
              </p>
              <p class="text-sm text-[var(--text-color-secondary)]">
                {{ activity.actorName }} · {{ formatDate(activity.date) }}
              </p>
            </div>
          </div>
        </div>

      </template>
    </Card>
  </div>
</template>
