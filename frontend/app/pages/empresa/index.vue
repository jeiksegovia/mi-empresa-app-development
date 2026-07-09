<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const authStore = useAuthStore()
const empresa = computed(() => authStore.empresa)

onMounted(async () => {
  if (!authStore.isAdmin) {
    await navigateTo('/')
    return
  }
  if (!empresa.value) {
    await authStore.fetchEmpresa()
  }
})
</script>

<template>
  <div>
    <AppPageHeader
      title="Mi Empresa"
      subtitle="Información de la empresa"
    >
      <template #actions>
        <NuxtLink v-if="authStore.role === 'ADMIN'" to="/empresa/editar">
          <Button label="Editar" icon="pi pi-pencil" severity="secondary" outlined />
        </NuxtLink>
      </template>
    </AppPageHeader>

    <div v-if="!empresa" class="text-center py-20 text-[var(--text-color-secondary)]">
      <i class="pi pi-spin pi-spinner text-4xl mb-3 block" />
      <p>Cargando información de empresa...</p>
    </div>

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
    </div>

    <Toast />
  </div>
</template>
