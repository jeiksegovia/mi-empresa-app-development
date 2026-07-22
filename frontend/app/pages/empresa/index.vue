<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const authStore = useAuthStore()
const { apiFetch } = useApi()
const empresa = computed(() => authStore.empresa)

// QA jul-11 I1: read-only cargos catalog on the detail view, so the list is
// visible without entering edit mode (management stays on /empresa/editar).
interface CargoEmpresa {
  id: number
  nombre: string
  activo: boolean
}
const cargos = ref<CargoEmpresa[]>([])
const cargosLoading = ref(false)
const activeCargos = computed(() => cargos.value.filter((c) => c.activo !== false))

async function fetchCargos() {
  cargosLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: CargoEmpresa[] }>('/empresa/cargos')
    cargos.value = (res.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))
  } catch {
    cargos.value = []
  } finally {
    cargosLoading.value = false
  }
}

// W6: distinguish "still loading" from "loaded but empresa doesn't exist".
// After the load completes and empresa is still null, we render the empty-state
// CTA (not the spinner). This avoids the dev-reported bug where the spinner
// would spin forever on staging with 0 empresas.
const loaded = ref(false)

onMounted(async () => {
  if (!authStore.isAdmin) {
    await navigateTo('/')
    return
  }
  if (!empresa.value) {
    await authStore.fetchEmpresa()
  }
  loaded.value = true
  if (empresa.value) await fetchCargos()
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Mi Empresa"
      subtitle="Información de la empresa"
    >
      <template #actions>
        <NuxtLink v-if="empresa && authStore.role === 'ADMIN'" to="/empresa/editar">
          <Button label="Editar" icon="pi pi-pencil" severity="secondary" outlined />
        </NuxtLink>
      </template>
    </AppPageHeader>

    <div v-if="!loaded" class="text-center py-20 text-[var(--text-color-secondary)]">
      <i class="pi pi-spin pi-spinner text-4xl mb-3 block" />
      <p>Cargando información de empresa...</p>
    </div>

    <!-- W6: empty-state CTA. Surfaces when GET /empresa returns 200 { data: null }
         (the new normalized contract). The same /empresa/editar page handles
         the create form in create-mode (single-empresa system). -->
    <Card v-else-if="!empresa" data-testid="empresa-empty-state">
      <template #content>
        <div class="text-center py-10 max-w-md mx-auto">
          <i class="pi pi-building text-5xl text-violet-400 mb-4 block" />
          <h3 class="text-lg font-semibold mb-2">Aún no hay una empresa registrada</h3>
          <p class="text-sm text-[var(--text-color-secondary)] mb-5">
            Este sistema soporta una sola empresa. Cree la primera para empezar a
            gestionar empleados, pacientes y contratos.
          </p>
          <NuxtLink to="/empresa/editar">
            <Button
              label="Crear Empresa"
              icon="pi pi-plus"
              severity="success"
              data-testid="empresa-crear-cta"
            />
          </NuxtLink>
        </div>
      </template>
    </Card>

    <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-building text-violet-500" /> Datos Generales
            </h3>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">Nombre</span>
              <span class="font-medium text-[var(--text-color)]">{{ empresa.nombre }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">NIT</span>
              <span class="font-medium text-[var(--text-color)]">{{ empresa.nit }}</span>
            </div>
            <div v-if="empresa.direccion" class="flex flex-col gap-1">
              <span class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">Dirección</span>
              <span class="font-medium text-[var(--text-color)]">{{ empresa.direccion }}</span>
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-phone text-violet-500" /> Contacto
            </h3>
          </div>
        </template>
        <template #content>
          <div class="space-y-4">
            <div v-if="empresa.telefono" class="flex flex-col gap-1">
              <span class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">Teléfono</span>
              <span class="font-medium text-[var(--text-color)]">{{ empresa.telefono }}</span>
            </div>
            <div v-if="empresa.email" class="flex flex-col gap-1">
              <span class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">Email</span>
              <span class="font-medium text-[var(--text-color)]">{{ empresa.email }}</span>
            </div>
            <div v-if="!empresa.telefono && !empresa.email" class="text-[var(--text-color-secondary)] text-sm">
              Sin información de contacto registrada.
            </div>
          </div>
        </template>
      </Card>

      <!-- QA jul-11 I1: read-only cargos catalog (management lives in /empresa/editar) -->
      <Card class="lg:col-span-2" data-testid="empresa-cargos-view">
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-briefcase text-violet-500" /> Catálogo de Cargos
              <span class="ml-2 text-xs font-normal text-[var(--text-color-secondary)]">
                {{ activeCargos.length }} cargo(s) activo(s)
              </span>
            </h3>
          </div>
        </template>
        <template #content>
          <div v-if="cargosLoading" class="flex items-center justify-center py-4">
            <i class="pi pi-spin pi-spinner text-2xl text-violet-500" />
          </div>
          <div
            v-else-if="activeCargos.length === 0"
            class="text-[var(--text-color-secondary)] text-sm py-2"
          >
            No hay cargos registrados. Puedes gestionarlos desde "Editar".
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <Tag
              v-for="c in activeCargos"
              :key="c.id"
              :value="c.nombre"
              severity="secondary"
              data-testid="empresa-cargo-chip"
            />
          </div>
        </template>
      </Card>
    </div>

  </div>
</template>
