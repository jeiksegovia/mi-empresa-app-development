<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const route = useRoute()
const { apiFetch } = useApi()

const loading = ref(true)
const error = ref('')

interface Cargo {
  id: number
  nombreCargo: string
  ubicacion: string
  fechaIngreso: string
  fechaTerminacion: string | null
}

interface ExperienciaLaboral {
  id: number
  empresa: string
  cargo: string
  sector: string | null
  periodoInicio: string
  periodoFin: string | null
}

interface Employee {
  id: number
  nombre: string
  apellido: string
  estado: string
  fechaRegistro: string
  cargos: Cargo[]
  experienciasLaborales: ExperienciaLaboral[]
}

const employee = ref<Employee | null>(null)

async function fetchEmployee() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: Employee }>(`/employees/${route.params.id}`)
    employee.value = res.data
  } catch (e: any) {
    error.value = e?.response?.status === 404
      ? 'Empleado no encontrado'
      : 'Error al cargar el historial'
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short',
  })
}

function durationMonths(start: string, end: string | null) {
  const from = new Date(start)
  const to = end ? new Date(end) : new Date()
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (months < 1) return 'Menos de 1 mes'
  if (months < 12) return `${months} mes${months > 1 ? 'es' : ''}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return `${years} año${years > 1 ? 's' : ''}${rem > 0 ? ` ${rem} mes${rem > 1 ? 'es' : ''}` : ''}`
}

// Merged timeline: internal cargos + external experience, sorted newest first
const timeline = computed(() => {
  if (!employee.value) return []
  const items: Array<{
    type: 'interno' | 'externo'
    titulo: string
    subtitulo: string
    inicio: string
    fin: string | null
    actual: boolean
  }> = []

  for (const c of employee.value.cargos) {
    items.push({
      type: 'interno',
      titulo: c.nombreCargo,
      subtitulo: c.ubicacion,
      inicio: c.fechaIngreso,
      fin: c.fechaTerminacion,
      actual: !c.fechaTerminacion,
    })
  }

  for (const e of employee.value.experienciasLaborales) {
    items.push({
      type: 'externo',
      titulo: e.cargo,
      subtitulo: `${e.empresa}${e.sector ? ` · ${e.sector}` : ''}`,
      inicio: e.periodoInicio,
      fin: e.periodoFin,
      actual: !e.periodoFin,
    })
  }

  return items.sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())
})

onMounted(fetchEmployee)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <i class="pi pi-spin pi-spinner text-4xl text-violet-500" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-orange-400 mb-4 block" />
      <p class="text-[var(--text-color-secondary)]">{{ error }}</p>
      <Button label="Volver" icon="pi pi-arrow-left" class="mt-4" severity="secondary"
        @click="navigateTo(`/empleados/${route.params.id}`)" />
    </div>

    <template v-else-if="employee">
      <AppPageHeader
        :title="`Historial: ${employee.nombre} ${employee.apellido}`"
        subtitle="Trayectoria laboral del empleado">
        <template #actions>
          <Button label="Ver Perfil" icon="pi pi-user" severity="secondary" outlined
            @click="navigateTo(`/empleados/${route.params.id}`)" />
          <Button label="Editar" icon="pi pi-pencil" severity="info"
            @click="navigateTo(`/empleados/${route.params.id}/editar`)" />
        </template>
      </AppPageHeader>

      <!-- Summary cards -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card class="text-center">
          <template #content>
            <p class="text-2xl font-bold text-violet-600">{{ employee.cargos.length }}</p>
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">Cargos internos</p>
          </template>
        </Card>
        <Card class="text-center">
          <template #content>
            <p class="text-2xl font-bold text-violet-600">{{ employee.experienciasLaborales.length }}</p>
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">Exp. externas</p>
          </template>
        </Card>
        <Card class="text-center">
          <template #content>
            <p class="text-2xl font-bold text-violet-600">
              {{ employee.cargos.filter(c => !c.fechaTerminacion).length > 0 ? '✓' : '—' }}
            </p>
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">Cargo activo</p>
          </template>
        </Card>
        <Card class="text-center">
          <template #content>
            <AppStatusBadge :status="employee.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">Estado actual</p>
          </template>
        </Card>
      </div>

      <!-- Internal Positions -->
      <Card class="mb-4">
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-building text-violet-500" /> Cargos en la Empresa
              <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                {{ employee.cargos.length }} registro(s)
              </span>
            </h3>
          </div>
        </template>
        <template #content>
          <div v-if="employee.cargos.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-building text-3xl mb-2 block opacity-40" />
            Sin cargos registrados
          </div>
          <!-- Timeline list -->
          <div v-else class="relative">
            <!-- Vertical line -->
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--surface-border)]" />
            <div class="space-y-0">
              <div v-for="(cargo, i) in [...employee.cargos].sort((a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime())"
                :key="cargo.id"
                class="relative pl-10 pb-6">
                <!-- Dot -->
                <div :class="[
                  'absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white',
                  !cargo.fechaTerminacion ? 'bg-violet-500' : 'bg-[var(--surface-400)]'
                ]" />
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-semibold text-[var(--text-color)]">{{ cargo.nombreCargo }}</p>
                      <Tag v-if="!cargo.fechaTerminacion" value="Actual" severity="success" />
                    </div>
                    <p class="text-sm text-[var(--text-color-secondary)]">{{ cargo.ubicacion }}</p>
                  </div>
                  <div class="text-right text-xs text-[var(--text-color-secondary)] shrink-0">
                    <p>{{ formatShortDate(cargo.fechaIngreso) }} – {{ cargo.fechaTerminacion ? formatShortDate(cargo.fechaTerminacion) : 'Presente' }}</p>
                    <p class="mt-0.5 font-medium">{{ durationMonths(cargo.fechaIngreso, cargo.fechaTerminacion) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- External Experience -->
      <Card class="mb-4">
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-briefcase text-violet-500" /> Experiencia Laboral Externa
              <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                {{ employee.experienciasLaborales.length }} registro(s)
              </span>
            </h3>
          </div>
        </template>
        <template #content>
          <div v-if="employee.experienciasLaborales.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-briefcase text-3xl mb-2 block opacity-40" />
            Sin experiencia externa registrada
          </div>
          <div v-else class="divide-y divide-[var(--surface-border)]">
            <div v-for="exp in [...employee.experienciasLaborales].sort((a, b) => new Date(b.periodoInicio).getTime() - new Date(a.periodoInicio).getTime())"
              :key="exp.id"
              class="py-3 flex items-start justify-between gap-4">
              <div>
                <p class="font-medium text-[var(--text-color)]">{{ exp.cargo }}</p>
                <p class="text-sm text-[var(--text-color-secondary)]">
                  {{ exp.empresa }}<span v-if="exp.sector"> · {{ exp.sector }}</span>
                </p>
              </div>
              <div class="text-right text-xs text-[var(--text-color-secondary)] shrink-0">
                <p>{{ formatShortDate(exp.periodoInicio) }} – {{ exp.periodoFin ? formatShortDate(exp.periodoFin) : 'Presente' }}</p>
                <p class="mt-0.5 font-medium">{{ durationMonths(exp.periodoInicio, exp.periodoFin) }}</p>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Combined Timeline -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-history text-violet-500" /> Línea de Tiempo Completa
            </h3>
          </div>
        </template>
        <template #content>
          <div v-if="timeline.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-history text-3xl mb-2 block opacity-40" />
            Sin registros en la línea de tiempo
          </div>
          <div v-else class="relative">
            <div class="absolute left-4 top-0 bottom-0 w-0.5 bg-[var(--surface-border)]" />
            <div class="space-y-0">
              <div v-for="item in timeline" :key="`${item.type}-${item.inicio}`"
                class="relative pl-10 pb-5">
                <div :class="[
                  'absolute left-2.5 top-1 w-3 h-3 rounded-full border-2 border-white',
                  item.type === 'interno' ? 'bg-violet-500' : 'bg-blue-400'
                ]" />
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <div class="flex items-center gap-2 flex-wrap">
                      <p class="font-medium text-[var(--text-color)]">{{ item.titulo }}</p>
                      <Tag
                        :value="item.type === 'interno' ? 'Interno' : 'Externo'"
                        :severity="item.type === 'interno' ? 'info' : 'secondary'"
                        class="text-xs" />
                      <Tag v-if="item.actual" value="Actual" severity="success" class="text-xs" />
                    </div>
                    <p class="text-sm text-[var(--text-color-secondary)]">{{ item.subtitulo }}</p>
                  </div>
                  <div class="text-right text-xs text-[var(--text-color-secondary)] shrink-0">
                    <p>{{ formatShortDate(item.inicio) }} – {{ item.fin ? formatShortDate(item.fin) : 'Presente' }}</p>
                    <p class="mt-0.5">{{ durationMonths(item.inicio, item.fin) }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </template>
  </div>
</template>
