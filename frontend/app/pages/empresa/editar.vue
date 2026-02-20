<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const authStore = useAuthStore()
const { apiFetch } = useApi()
const toast = useToast()
const saving = ref(false)

// Only admins can edit
if (authStore.role !== 'ADMIN') {
  navigateTo('/empresa')
}

const form = reactive({
  nombre: '',
  nit: '',
  direccion: '',
  telefono: '',
  email: '',
})

const empresaId = ref<number | null>(null)

onMounted(async () => {
  if (!authStore.empresa) {
    await authStore.fetchEmpresa()
  }
  if (authStore.empresa) {
    form.nombre = authStore.empresa.nombre
    form.nit = authStore.empresa.nit
    form.direccion = authStore.empresa.direccion ?? ''
    form.telefono = authStore.empresa.telefono ?? ''
    form.email = authStore.empresa.email ?? ''
    empresaId.value = authStore.empresa.id
  }
})

async function submit() {
  if (!empresaId.value) return
  saving.value = true
  try {
    const payload: Record<string, string> = {}
    if (form.nombre) payload.nombre = form.nombre
    if (form.nit) payload.nit = form.nit
    if (form.direccion) payload.direccion = form.direccion
    if (form.telefono) payload.telefono = form.telefono
    if (form.email) payload.email = form.email

    await apiFetch(`/empresa/${empresaId.value}`, {
      method: 'PUT',
      body: payload,
    })
    await authStore.fetchEmpresa()
    toast.add({ severity: 'success', summary: 'Empresa actualizada', detail: 'Los datos fueron guardados correctamente', life: 3000 })
    await navigateTo('/empresa')
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al actualizar empresa'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader
      title="Editar Empresa"
      subtitle="Actualizar información de la empresa"
    >
      <template #actions>
        <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
          @click="navigateTo('/empresa')" />
      </template>
    </AppPageHeader>

    <Card>
      <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="text-sm font-medium">Nombre de la Empresa</label>
            <InputText v-model="form.nombre" placeholder="Mi Empresa S.A.S." />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">NIT</label>
            <InputText v-model="form.nit" placeholder="900123456-1" />
          </div>
          <div class="flex flex-col gap-1">
            <label class="text-sm font-medium">Teléfono</label>
            <InputText v-model="form.telefono" placeholder="6014567890" />
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="text-sm font-medium">Dirección</label>
            <InputText v-model="form.direccion" placeholder="Calle 100 # 15-20, Bogotá" />
          </div>
          <div class="flex flex-col gap-1 sm:col-span-2">
            <label class="text-sm font-medium">Email</label>
            <InputText v-model="form.email" type="email" placeholder="info@miempresa.com" />
          </div>
        </div>

        <div class="mt-6">
          <Button
            label="Guardar Cambios"
            icon="pi pi-check"
            severity="success"
            :loading="saving"
            @click="submit"
          />
        </div>
      </template>
    </Card>

    <Toast />
  </div>
</template>
