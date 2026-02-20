<script setup lang="ts">
definePageMeta({
  layout: 'default',
  middleware: ['auth'],
})

const authStore = useAuthStore()
const { apiFetch } = useApi()

interface DashboardStats {
  empleados: number
  pacientes: number
  instrumentos: number
  certificados: number
}

const loading = ref(false)
const stats = ref<DashboardStats>({
  empleados: 0,
  pacientes: 0,
  instrumentos: 0,
  certificados: 0,
})

onMounted(async () => {
  loading.value = true
  try {
    const response = await apiFetch<{ success: boolean; data: DashboardStats }>('/dashboard/stats')
    if (response.success) {
      stats.value = response.data
    }
  }
  catch (error) {
    console.error('Error fetching dashboard stats:', error)
  }
  finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Dashboard"
      :subtitle="`Bienvenido, ${authStore.fullName}`"
    />

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <AppStatsCard
        title="Empleados"
        :value="stats.empleados"
        icon="pi pi-users"
        severity="primary"
        :loading="loading"
        clickable
        @click="navigateTo('/empleados')"
      />
      <AppStatsCard
        title="Pacientes"
        :value="stats.pacientes"
        icon="pi pi-user"
        severity="success"
        :loading="loading"
        clickable
        @click="navigateTo('/pacientes')"
      />
      <AppStatsCard
        title="Instrumentos"
        :value="stats.instrumentos"
        icon="pi pi-clipboard"
        severity="info"
        :loading="loading"
        clickable
        @click="navigateTo('/instrumentos')"
      />
      <AppStatsCard
        title="Certificados"
        :value="stats.certificados"
        icon="pi pi-file"
        severity="warn"
        :loading="loading"
        clickable
        @click="navigateTo('/certificados')"
      />
    </div>

    <!-- Quick Access Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card class="hover:shadow-lg transition-shadow cursor-pointer" @click="navigateTo('/empleados')">
        <template #content>
          <div class="flex items-center gap-3 mb-3">
            <i class="pi pi-users text-2xl text-violet-500" />
            <h3 class="font-semibold text-lg text-[var(--text-color)]">Empleados</h3>
          </div>
          <p class="text-sm text-[var(--text-color-secondary)]">
            Gestión de personal y nómina
          </p>
        </template>
      </Card>

      <Card class="hover:shadow-lg transition-shadow cursor-pointer" @click="navigateTo('/pacientes')">
        <template #content>
          <div class="flex items-center gap-3 mb-3">
            <i class="pi pi-user text-2xl text-violet-500" />
            <h3 class="font-semibold text-lg text-[var(--text-color)]">Pacientes</h3>
          </div>
          <p class="text-sm text-[var(--text-color-secondary)]">
            Gestión de pacientes y fichas
          </p>
        </template>
      </Card>

      <Card class="hover:shadow-lg transition-shadow cursor-pointer" @click="navigateTo('/instrumentos')">
        <template #content>
          <div class="flex items-center gap-3 mb-3">
            <i class="pi pi-clipboard text-2xl text-violet-500" />
            <h3 class="font-semibold text-lg text-[var(--text-color)]">Instrumentos</h3>
          </div>
          <p class="text-sm text-[var(--text-color-secondary)]">
            Plantillas de evaluación
          </p>
        </template>
      </Card>

      <Card class="hover:shadow-lg transition-shadow cursor-pointer" @click="navigateTo('/certificados')">
        <template #content>
          <div class="flex items-center gap-3 mb-3">
            <i class="pi pi-file text-2xl text-violet-500" />
            <h3 class="font-semibold text-lg text-[var(--text-color)]">Certificados</h3>
          </div>
          <p class="text-sm text-[var(--text-color-secondary)]">
            Certificaciones y vencimientos
          </p>
        </template>
      </Card>
    </div>
  </div>
</template>
