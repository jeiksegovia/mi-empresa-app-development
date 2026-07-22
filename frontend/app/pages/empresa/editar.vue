<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const authStore = useAuthStore()
const { apiFetch } = useApi()
const toast = useToast()
const saving = ref(false)
const loading = ref(true)

// W6: create-vs-edit mode is decided by `authStore.empresa` after fetchEmpresa.
// In a fresh DB (single-empresa system, no row yet) the page switches to a
// "Crear empresa" form and POSTs instead of PUTs. Same field set, same
// validation rules — only the submit target + page title differ.
const isCreateMode = computed(() => !authStore.empresa)

const form = reactive({
  nombre: '',
  nit: '',
  direccion: '',
  telefono: '',
  email: '',
})

const empresaId = ref<number | null>(null)

// D8: cargos manager (admin-only). Cards live on the same editar page
// since this page already gates access by role.
interface CargoEmpresa {
  id: number; nombre: string; activo: boolean
  createdAt: string; updatedAt: string
}
const cargos = ref<CargoEmpresa[]>([])
const cargosLoading = ref(false)
const newCargoNombre = ref('')
const newCargoSaving = ref(false)
const newCargoError = ref<string | null>(null)
const archivingCargoId = ref<number | null>(null)

async function fetchCargos() {
  cargosLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: CargoEmpresa[] }>(
      '/empresa/cargos'
    )
    cargos.value = (res.data ?? []).sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1
      return a.nombre.localeCompare(b.nombre)
    })
  } catch (e) {
    // In create mode, /empresa/cargos legitimately returns empty (or 400 if
    // the service refuses before the create — both are fine here). Don't
    // surface a toast for this — the cargos section shows its own empty state.
    cargos.value = []
  } finally {
    cargosLoading.value = false
  }
}

async function createCargo() {
  // W6: cargos cannot be created until an empresa exists (single-empresa
  // invariant). The button is disabled in create mode but guard defensively.
  if (isCreateMode.value) {
    newCargoError.value = 'Primero debe crear la empresa.'
    return
  }
  if (!newCargoNombre.value.trim()) {
    newCargoError.value = 'El nombre del cargo es obligatorio.'
    return
  }
  newCargoSaving.value = true
  newCargoError.value = null
  try {
    await apiFetch('/empresa/cargos', {
      method: 'POST',
      body: { nombre: newCargoNombre.value.trim() },
    })
    newCargoNombre.value = ''
    await fetchCargos()
    toast.add({ severity: 'success', summary: 'Cargo creado', life: 3000 })
  } catch (e: any) {
    const status = e?.response?.status ?? e?.statusCode
    const field = e?.data?.field
    const msg = e?.data?.message || ''
    if (status === 409 || /ya existe|already exists|duplicate/i.test(msg) || field === 'nombre') {
      newCargoError.value = `Ya existe un cargo con el nombre «${newCargoNombre.value.trim()}».`
    } else {
      newCargoError.value = msg || 'No se pudo crear el cargo.'
    }
  } finally {
    newCargoSaving.value = false
  }
}

async function toggleCargoActivo(c: CargoEmpresa) {
  archivingCargoId.value = c.id
  try {
    await apiFetch(`/empresa/cargos/${c.id}`, {
      method: 'PATCH',
      body: { activo: !c.activo },
    })
    await fetchCargos()
    toast.add({
      severity: 'success',
      summary: c.activo ? 'Cargo archivado' : 'Cargo reactivado',
      life: 3000,
    })
  } catch (e: any) {
    toast.add({
      severity: 'error', summary: 'Error',
      detail: e?.data?.message || 'No se pudo cambiar el estado del cargo',
      life: 5000,
    })
  } finally {
    archivingCargoId.value = null
  }
}

onMounted(async () => {
  // Only admins can edit (moved into onMounted so the role check runs AFTER
  // auth state has settled — calling navigateTo during <script setup> fires
  // synchronously and races the reactive store hydration).
  if (authStore.role !== 'ADMIN') {
    await navigateTo('/empresa')
    return
  }

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
  // D8: fetch the cargos catalog in parallel. In create mode this returns []
  // (or 400 from a defense-in-depth check in cargoEmpresaService) — both
  // are handled by fetchCargos without surfacing a toast error.
  await fetchCargos()
  loading.value = false
})

async function submit() {
  // Basic client-side validation — mirror the backend Zod rules. Backend will
  // re-validate, but catching obvious problems here gives faster feedback.
  if (!form.nombre.trim() || !form.nit.trim()) {
    toast.add({
      severity: 'warn',
      summary: 'Datos requeridos',
      detail: 'Nombre y NIT son obligatorios.',
      life: 4000,
    })
    return
  }
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    toast.add({
      severity: 'warn',
      summary: 'Email inválido',
      detail: 'Verifica el formato del correo electrónico.',
      life: 4000,
    })
    return
  }

  saving.value = true
  try {
    // Build payload — empty strings ARE included so Prisma can clear a field
    // when the user removes its content (otherwise the previous value would
    // silently stick and the user would think the save "didn't persist").
    const payload: Record<string, string> = {
      nombre: form.nombre.trim(),
      nit: form.nit.trim(),
    }
    if (form.direccion.trim()) payload.direccion = form.direccion.trim()
    if (form.telefono.trim()) payload.telefono = form.telefono.trim()
    if (form.email.trim()) payload.email = form.email.trim()

    if (isCreateMode.value) {
      // W6: bootstrap from empty DB. POST creates the empresa + seeds the
      // default cargos atomically server-side. After success, refresh the
      // auth store so /empresa now resolves to the new row.
      await apiFetch<{ success: boolean; data: { id: number } }>('/empresa', {
        method: 'POST',
        body: payload,
      })
      await authStore.fetchEmpresa()
      toast.add({
        severity: 'success',
        summary: 'Empresa creada',
        detail: 'Los datos fueron guardados correctamente',
        life: 3000,
      })
      // Reload cargos — the createEmpresa service seeds the 7 default cargos
      // inside the same transaction, so the manager is now populated.
      await fetchCargos()
      await navigateTo('/empresa')
      return
    }

    // Defensive: if empresaId wasn't populated (auth store race / failed fetch),
    // surface a visible error instead of returning silently. Earlier versions did
    // `if (!empresaId.value) return` and the user got zero feedback — they saw
    // the click do nothing, which the QA report described as "doesn't persist".
    if (!empresaId.value) {
      toast.add({
        severity: 'error',
        summary: 'No se pudo identificar la empresa',
        detail: 'Recarga la página e inténtalo de nuevo.',
        life: 5000,
      })
      return
    }

    await apiFetch(`/empresa/${empresaId.value}`, {
      method: 'PUT',
      body: payload,
    })
    // Refresh the auth store so the next /empresa read shows fresh values.
    await authStore.fetchEmpresa()
    toast.add({
      severity: 'success',
      summary: 'Empresa actualizada',
      detail: 'Los datos fueron guardados correctamente',
      life: 3000,
    })
    await navigateTo('/empresa')
  } catch (e: any) {
    const msg =
      e?.data?.message || e?.data?.error || e?.message || 'Error al guardar empresa'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader
      :title="isCreateMode ? 'Crear Empresa' : 'Editar Empresa'"
      :subtitle="isCreateMode ? 'Configurar la información inicial de la empresa' : 'Actualizar información de la empresa'"
    >
      <template #actions>
        <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
          @click="navigateTo('/empresa')" />
      </template>
    </AppPageHeader>

    <Card class="mb-4">
      <template #content>
        <div v-if="loading" class="flex items-center justify-center py-10 text-[var(--text-color-secondary)]">
          <i class="pi pi-spin pi-spinner text-2xl text-violet-500 mr-2" />
          Cargando información…
        </div>
        <form v-else class="space-y-4" @submit.prevent="submit" data-testid="empresa-form">
          <div v-if="isCreateMode" class="bg-blue-50 border border-blue-200 text-blue-800 rounded-md p-3 text-sm" data-testid="empresa-create-banner">
            <i class="pi pi-info-circle mr-1" />
            Aún no existe una empresa registrada. Complete los datos para crear la primera y única empresa del sistema.
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <div class="flex flex-col gap-1 sm:col-span-2">
              <label class="text-sm font-medium">Nombre de la Empresa <span class="text-red-500">*</span></label>
              <InputText :model-value="form.nombre" @update:model-value="(v) => form.nombre = (v ?? '').toUpperCase()" placeholder="Mi Empresa S.A.S." data-testid="empresa-nombre" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">NIT <span class="text-red-500">*</span></label>
              <InputText v-model="form.nit" placeholder="900123456-1" data-testid="empresa-nit" />
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
              type="submit"
              :label="isCreateMode ? 'Crear Empresa' : 'Guardar Cambios'"
              :icon="isCreateMode ? 'pi pi-plus' : 'pi pi-check'"
              severity="success"
              :loading="saving"
              :disabled="loading"
              data-testid="empresa-guardar"
            />
          </div>
        </form>
      </template>
    </Card>

    <!-- D8: Cargos manager (admin-only section). Hidden in create mode because
         the cargos catalog doesn't exist until the empresa is created. The
         page will refetch automatically after a successful create. -->
    <Card v-if="!isCreateMode" data-testid="cargos-manager-card">
      <template #header>
        <div class="px-6 pt-5 pb-0">
          <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
            <i class="pi pi-briefcase text-violet-500" /> Catálogo de Cargos
          </h3>
          <p class="text-xs text-[var(--text-color-secondary)] mt-1">
            Lista maestra de cargos disponibles para asignar en los contratos.
            Archivar un cargo lo mantiene visible en contratos históricos pero
            lo oculta del selector de contratos nuevos.
          </p>
        </div>
      </template>
      <template #content>
        <div class="space-y-4">
          <!-- Add new cargo -->
          <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
            <div class="flex-1">
              <label for="newCargo" class="block text-sm font-medium mb-1">
                Nuevo cargo
              </label>
              <InputText
                id="newCargo"
                v-model="newCargoNombre"
                placeholder="Ej: Auxiliar de Enfermería"
                class="w-full"
                :class="{ 'p-invalid': newCargoError }"
                :disabled="newCargoSaving"
                data-testid="cargos-new-nombre"
                @keydown.enter.prevent="createCargo"
              />
              <Message
                v-if="newCargoError"
                severity="error"
                :closable="true"
                class="mt-1"
                data-testid="cargos-new-error"
                @close="newCargoError = null"
              >
                {{ newCargoError }}
              </Message>
            </div>
            <Button
              label="Agregar"
              icon="pi pi-plus"
              :loading="newCargoSaving"
              :disabled="!newCargoNombre.trim()"
              data-testid="cargos-new-add"
              @click="createCargo"
            />
          </div>

          <!-- List -->
          <div v-if="cargosLoading" class="flex items-center justify-center py-4">
            <i class="pi pi-spin pi-spinner text-2xl text-violet-500" />
          </div>
          <div v-else-if="cargos.length === 0" class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
            Sin cargos registrados. Crea el primero arriba.
          </div>
          <ul v-else class="divide-y divide-[var(--surface-border)]" data-testid="cargos-list">
            <li
              v-for="cargo in cargos"
              :key="cargo.id"
              class="py-3 flex flex-wrap items-center gap-2"
              :data-testid="`cargo-row-${cargo.id}`"
            >
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm">{{ cargo.nombre }}</p>
                <p class="text-xs text-[var(--text-color-secondary)]">
                  <span v-if="cargo.activo" class="text-green-600">Activo</span>
                  <span v-else class="text-[var(--text-color-secondary)] italic">Archivado</span>
                </p>
              </div>
              <Button
                v-if="cargo.activo"
                icon="pi pi-archive"
                size="small"
                severity="secondary"
                outlined
                label="Archivar"
                :loading="archivingCargoId === cargo.id"
                :data-testid="`cargo-archive-${cargo.id}`"
                @click="toggleCargoActivo(cargo)"
              />
              <Button
                v-else
                icon="pi pi-undo"
                size="small"
                severity="success"
                outlined
                label="Reactivar"
                :loading="archivingCargoId === cargo.id"
                :data-testid="`cargo-reactivate-${cargo.id}`"
                @click="toggleCargoActivo(cargo)"
              />
            </li>
          </ul>
        </div>
      </template>
    </Card>

  </div>
</template>
