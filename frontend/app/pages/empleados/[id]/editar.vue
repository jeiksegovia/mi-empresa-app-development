<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()

const loading = ref(true)
const saving = ref(false)
const error = ref('')

// ─── Form state (top-level employee fields only) ──────────────────────────────
const form = reactive({
  nombre: '',
  apellido: '',
  tipoDocumento: 'CC' as 'CC' | 'CE' | 'PASAPORTE',
  numeroDocumento: '',
  genero: '',
  fechaNacimiento: '',
  estadoCivil: '',
  tipoVivienda: '' as '' | 'CASA' | 'APARTAMENTO' | 'LOTE',
  estratoSocioeconomico: '',
  direccion: '',
  telefono: '',
  email: '',
  permisoTrabajo: false,
  estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
})

const formErrors = reactive<Record<string, string>>({})

async function fetchEmployee() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: any }>(`/employees/${route.params.id}`)
    const emp = res.data
    form.nombre = emp.nombre ?? ''
    form.apellido = emp.apellido ?? ''
    form.tipoDocumento = emp.tipoDocumento ?? 'CC'
    form.numeroDocumento = emp.numeroDocumento ?? ''
    form.genero = emp.genero ?? ''
    form.fechaNacimiento = emp.fechaNacimiento
      ? (new Date(emp.fechaNacimiento).toISOString().split('T')[0] ?? '')
      : ''
    form.estadoCivil = emp.estadoCivil ?? ''
    form.tipoVivienda = emp.tipoVivienda ?? ''
    form.estratoSocioeconomico = emp.estratoSocioeconomico != null
      ? String(emp.estratoSocioeconomico)
      : ''
    form.direccion = emp.direccion ?? ''
    form.telefono = emp.telefono ?? ''
    form.email = emp.email ?? ''
    form.permisoTrabajo = emp.permisoTrabajo ?? false
    form.estado = emp.estado ?? 'ACTIVO'
  } catch (e: any) {
    error.value = e?.response?.status === 404
      ? 'Empleado no encontrado'
      : 'Error al cargar los datos del empleado'
  } finally {
    loading.value = false
  }
}

function validate() {
  Object.keys(formErrors).forEach((k) => delete formErrors[k])
  if (!form.nombre.trim()) formErrors.nombre = 'Requerido'
  if (!form.apellido.trim()) formErrors.apellido = 'Requerido'
  if (!form.numeroDocumento.trim()) formErrors.numeroDocumento = 'Requerido'
  if (!form.genero) formErrors.genero = 'Requerido'
  if (!form.fechaNacimiento) formErrors.fechaNacimiento = 'Requerido'
  return Object.keys(formErrors).length === 0
}

async function save() {
  if (!validate()) return
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      apellido: form.apellido.trim(),
      tipoDocumento: form.tipoDocumento,
      numeroDocumento: form.numeroDocumento.trim(),
      genero: form.genero,
      fechaNacimiento: form.fechaNacimiento,
      permisoTrabajo: form.permisoTrabajo,
      estado: form.estado,
    }
    if (form.estadoCivil) payload.estadoCivil = form.estadoCivil
    if (form.tipoVivienda) payload.tipoVivienda = form.tipoVivienda
    if (form.estratoSocioeconomico.trim()) payload.estratoSocioeconomico = Number(form.estratoSocioeconomico)
    if (form.direccion.trim()) payload.direccion = form.direccion.trim()
    if (form.telefono.trim()) payload.telefono = form.telefono.trim()
    if (form.email.trim()) payload.email = form.email.trim()

    await apiFetch(`/employees/${route.params.id}`, { method: 'PUT', body: payload })
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Empleado actualizado correctamente', life: 4000 })
    await navigateTo(`/empleados/${route.params.id}`)
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al actualizar el empleado'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}

// Option lists
const tiposDoc = [
  { label: 'Cédula de Ciudadanía (CC)', value: 'CC' },
  { label: 'Cédula de Extranjería (CE)', value: 'CE' },
  { label: 'Pasaporte', value: 'PASAPORTE' },
]
const generos = [
  { label: 'Masculino', value: 'MASCULINO' },
  { label: 'Femenino', value: 'FEMENINO' },
  { label: 'Otro', value: 'OTRO' },
]
const estadosCiviles = [
  { label: 'Soltero/a', value: 'SOLTERO' },
  { label: 'Casado/a', value: 'CASADO' },
  { label: 'Unión libre', value: 'UNION_LIBRE' },
  { label: 'Divorciado/a', value: 'DIVORCIADO' },
  { label: 'Viudo/a', value: 'VIUDO' },
]
const tiposVivienda = [
  { label: 'Casa', value: 'CASA' },
  { label: 'Apartamento', value: 'APARTAMENTO' },
  { label: 'Lote', value: 'LOTE' },
]

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

    <template v-else>
      <AppPageHeader
        :title="`Editar: ${form.nombre} ${form.apellido}`"
        subtitle="Modificar datos del empleado">
        <template #actions>
          <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
            @click="navigateTo(`/empleados/${route.params.id}`)" />
          <Button label="Guardar Cambios" icon="pi pi-check" severity="success"
            :loading="saving" @click="save" />
        </template>
      </AppPageHeader>

      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-user text-violet-500" /> Datos Personales
            </h3>
          </div>
        </template>
        <template #content>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Nombre <span class="text-red-500">*</span></label>
              <InputText v-model="form.nombre" placeholder="Nombres"
                :class="{ 'p-invalid': formErrors.nombre }" />
              <small v-if="formErrors.nombre" class="text-red-500">{{ formErrors.nombre }}</small>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Apellido <span class="text-red-500">*</span></label>
              <InputText v-model="form.apellido" placeholder="Apellidos"
                :class="{ 'p-invalid': formErrors.apellido }" />
              <small v-if="formErrors.apellido" class="text-red-500">{{ formErrors.apellido }}</small>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Tipo Documento</label>
              <Select v-model="form.tipoDocumento" :options="tiposDoc"
                option-label="label" option-value="value" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Número Documento <span class="text-red-500">*</span></label>
              <InputText v-model="form.numeroDocumento" placeholder="Número de documento"
                :class="{ 'p-invalid': formErrors.numeroDocumento }" />
              <small v-if="formErrors.numeroDocumento" class="text-red-500">{{ formErrors.numeroDocumento }}</small>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Género <span class="text-red-500">*</span></label>
              <Select v-model="form.genero" :options="generos"
                option-label="label" option-value="value" placeholder="Seleccionar"
                :class="{ 'p-invalid': formErrors.genero }" />
              <small v-if="formErrors.genero" class="text-red-500">{{ formErrors.genero }}</small>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha de Nacimiento <span class="text-red-500">*</span></label>
              <InputText v-model="form.fechaNacimiento" type="date"
                :class="{ 'p-invalid': formErrors.fechaNacimiento }" />
              <small v-if="formErrors.fechaNacimiento" class="text-red-500">{{ formErrors.fechaNacimiento }}</small>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estado Civil</label>
              <Select v-model="form.estadoCivil" :options="estadosCiviles"
                option-label="label" option-value="value" placeholder="Seleccionar" show-clear />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Tipo Vivienda</label>
              <Select v-model="form.tipoVivienda" :options="tiposVivienda"
                option-label="label" option-value="value" placeholder="Seleccionar" show-clear />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estrato Socioeconómico</label>
              <InputText v-model="form.estratoSocioeconomico" type="number" min="1" max="6" placeholder="1-6" />
            </div>

            <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label class="text-sm font-medium">Dirección</label>
              <InputText v-model="form.direccion" placeholder="Dirección de residencia" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Teléfono</label>
              <InputText v-model="form.telefono" placeholder="Número de teléfono" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Email</label>
              <InputText v-model="form.email" type="email" placeholder="correo@ejemplo.com" />
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estado</label>
              <Select v-model="form.estado"
                :options="[{ label: 'Activo', value: 'ACTIVO' }, { label: 'Inactivo', value: 'INACTIVO' }]"
                option-label="label" option-value="value" />
            </div>

            <div class="flex items-center gap-2 pt-2 sm:col-span-2 lg:col-span-3">
              <Checkbox v-model="form.permisoTrabajo" :binary="true" input-id="permisoTrabajo" />
              <label for="permisoTrabajo" class="text-sm">Tiene permiso de trabajo</label>
            </div>
          </div>
        </template>
      </Card>

      <!-- Bottom action bar -->
      <div class="mt-6 flex justify-end gap-3">
        <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
          @click="navigateTo(`/empleados/${route.params.id}`)" />
        <Button label="Guardar Cambios" icon="pi pi-check" severity="success"
          :loading="saving" @click="save" />
      </div>
    </template>

    <Toast />
  </div>
</template>
