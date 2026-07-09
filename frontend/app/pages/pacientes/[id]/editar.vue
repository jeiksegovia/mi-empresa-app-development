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

// Form state
const form = reactive({
  nombre: '',
  tipoDocumento: 'CC' as 'CC' | 'CE' | 'PASAPORTE' | 'REGISTRO_CIVIL',
  numeroDocumento: '',
  fechaNacimiento: '',
  telefono: '',
  email: '',
  direccion: '',
  informacionSeguro: '',
  observacionesEspeciales: '',
  estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
})

// Género uses Select + inline "OTRO" custom text input (P0 jul4)
const generoSelect = ref<'' | 'MASCULINO' | 'FEMENINO' | 'OTRO'>('')
const generoCustom = ref('')

const GENERO_KNOWN = ['MASCULINO', 'FEMENINO', 'OTRO'] as const
function isGeneroKnown(v: string): v is (typeof GENERO_KNOWN)[number] {
  return (GENERO_KNOWN as readonly string[]).includes(v)
}

const formErrors = reactive<Record<string, string>>({})

// Emergency contacts
interface EmergencyContact {
  id?: number
  nombre: string
  telefono: string
  parentesco: string
  parentescoSelect: '' | 'PADRE' | 'MADRE' | 'HIJO' | 'OTRO'
  parentescoCustom: string
}

const emergencyContacts = ref<EmergencyContact[]>([])

function addEmergencyContact() {
  emergencyContacts.value.push({
    nombre: '',
    telefono: '',
    parentesco: '',
    parentescoSelect: '',
    parentescoCustom: '',
  })
}

const generoOptions = [
  { label: 'Masculino', value: 'MASCULINO' },
  { label: 'Femenino', value: 'FEMENINO' },
  { label: 'Otro', value: 'OTRO' },
]

const parentescoOptions = [
  { label: 'Padre', value: 'PADRE' },
  { label: 'Madre', value: 'MADRE' },
  { label: 'Hijo/a', value: 'HIJO' },
  { label: 'Otro', value: 'OTRO' },
]

const PARENTESCO_VALUES = ['PADRE', 'MADRE', 'HIJO', 'OTRO'] as const
type ParentescoValue = (typeof PARENTESCO_VALUES)[number]
function isParentescoValue(v: string): v is ParentescoValue {
  return (PARENTESCO_VALUES as readonly string[]).includes(v)
}

function removeEmergencyContact(index: number) {
  emergencyContacts.value.splice(index, 1)
}

// Load patient data
async function loadPatient() {
  loading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: any }>(`/patients/${route.params.id}`)
    const patient = res.data

    // Populate form
    form.nombre = patient.nombre
    form.tipoDocumento = patient.tipoDocumento
    form.numeroDocumento = patient.numeroDocumento
    form.fechaNacimiento = patient.fechaNacimiento.split('T')[0]
    // Hydrate genero select + custom (P0 jul4)
    if (isGeneroKnown(patient.genero)) {
      generoSelect.value = patient.genero
    } else if (patient.genero) {
      generoSelect.value = 'OTRO'
      generoCustom.value = patient.genero
    }
    form.telefono = patient.telefono || ''
    form.email = patient.email || ''
    form.direccion = patient.direccion || ''
    form.informacionSeguro = patient.informacionSeguro || ''
    form.observacionesEspeciales = patient.observacionesEspeciales || ''
    form.estado = patient.estado

    // Load emergency contacts
    if (patient.contactosEmergencia && patient.contactosEmergencia.length) {
      emergencyContacts.value = patient.contactosEmergencia.map((c: any) => {
        const isKnownValue = isParentescoValue(c.parentesco)
        return {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          parentesco: c.parentesco,
          parentescoSelect: isKnownValue ? c.parentesco : (c.parentesco ? 'OTRO' : ''),
          parentescoCustom: !isKnownValue && c.parentesco ? c.parentesco : '',
        }
      })
    }
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || 'Error al cargar paciente',
      life: 5000,
    })
    navigateTo('/pacientes')
  } finally {
    loading.value = false
  }
}

// Validation
function validateForm() {
  Object.keys(formErrors).forEach((k) => delete formErrors[k])

  if (!form.nombre.trim()) formErrors.nombre = 'Requerido'
  if (!form.numeroDocumento.trim()) formErrors.numeroDocumento = 'Requerido'
  if (!form.fechaNacimiento) formErrors.fechaNacimiento = 'Requerido'
  if (!generoSelect.value) formErrors.genero = 'Requerido'
  else if (generoSelect.value === 'OTRO' && !generoCustom.value.trim())
    formErrors.genero = 'Requerido'

  return Object.keys(formErrors).length === 0
}

// Submit
async function handleSubmit() {
  if (!validateForm()) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: 'Por favor completa los campos requeridos',
      life: 4000,
    })
    return
  }

  saving.value = true
  try {
    const generoResolved =
      generoSelect.value === 'OTRO' ? generoCustom.value.trim() : generoSelect.value
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      tipoDocumento: form.tipoDocumento,
      numeroDocumento: form.numeroDocumento.trim(),
      fechaNacimiento: form.fechaNacimiento,
      genero: generoResolved,
      estado: form.estado,
    }

    // Resolve parentesco for each emergency contact (OTRO uses custom text)
    const resolvedContacts = emergencyContacts.value
      .map((c) => ({
        id: c.id,
        nombre: c.nombre.trim(),
        telefono: c.telefono.trim(),
        parentesco:
          c.parentescoSelect === 'OTRO'
            ? c.parentescoCustom.trim()
            : c.parentescoSelect,
      }))
      .filter((c) => c.nombre && c.telefono && c.parentesco)
    if (resolvedContacts.length) {
      payload.contactosEmergencia = resolvedContacts.map((c) => ({
        nombre: c.nombre,
        telefono: c.telefono,
        parentesco: c.parentesco,
      }))
    }

    if (form.telefono.trim()) payload.telefono = form.telefono.trim()
    if (form.email.trim()) payload.email = form.email.trim()
    if (form.direccion.trim()) payload.direccion = form.direccion.trim()
    if (form.informacionSeguro.trim()) payload.informacionSeguro = form.informacionSeguro.trim()
    if (form.observacionesEspeciales.trim())
      payload.observacionesEspeciales = form.observacionesEspeciales.trim()

    await apiFetch(`/patients/${route.params.id}`, {
      method: 'PUT',
      body: payload,
    })

    toast.add({
      severity: 'success',
      summary: 'Cambios guardados',
      detail: 'Paciente actualizado correctamente',
      life: 4000,
    })

    await navigateTo(`/pacientes/${route.params.id}`)
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al actualizar el paciente'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  navigateTo(`/pacientes/${route.params.id}`)
}

const tipoDocumentoOptions = [
  { label: 'CC', value: 'CC' },
  { label: 'CE', value: 'CE' },
  { label: 'PASAPORTE', value: 'PASAPORTE' },
  { label: 'REGISTRO CIVIL', value: 'REGISTRO_CIVIL' },
]

const estadoOptions = [
  { label: 'Activo', value: 'ACTIVO' },
  { label: 'Inactivo', value: 'INACTIVO' },
]

onMounted(loadPatient)
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-16">
      <i class="pi pi-spin pi-spinner text-4xl text-violet-500" />
    </div>

    <template v-else>
      <AppPageHeader title="Editar Paciente" subtitle="Actualizar información del paciente">
        <template #actions>
          <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined @click="handleCancel" />
          <Button label="Guardar Cambios" icon="pi pi-check" :loading="saving" @click="handleSubmit" />
        </template>
      </AppPageHeader>

      <Card>
        <template #content>
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Datos Personales -->
            <div>
              <h3 class="text-lg font-semibold text-[var(--text-color)] mb-4 flex items-center gap-2">
                <i class="pi pi-user text-violet-500" />
                Datos Personales
              </h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium mb-2">
                    Nombre <span class="text-red-500">*</span>
                  </label>
                  <InputText
                    v-model="form.nombre"
                    class="w-full"
                    :class="{ 'p-invalid': formErrors.nombre }"
                    placeholder="Nombre completo"
                  />
                  <small v-if="formErrors.nombre" class="text-red-500">{{ formErrors.nombre }}</small>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">
                    Tipo de Documento <span class="text-red-500">*</span>
                  </label>
                  <Select
                    v-model="form.tipoDocumento"
                    :options="tipoDocumentoOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">
                    Número de Documento <span class="text-red-500">*</span>
                  </label>
                  <InputText
                    v-model="form.numeroDocumento"
                    class="w-full"
                    :class="{ 'p-invalid': formErrors.numeroDocumento }"
                    placeholder="123456789"
                  />
                  <small v-if="formErrors.numeroDocumento" class="text-red-500">{{
                    formErrors.numeroDocumento
                  }}</small>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">
                    Fecha de Nacimiento <span class="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    v-model="form.fechaNacimiento"
                    class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg"
                    :class="{ 'border-red-500': formErrors.fechaNacimiento }"
                  />
                  <small v-if="formErrors.fechaNacimiento" class="text-red-500">{{
                    formErrors.fechaNacimiento
                  }}</small>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">
                    Género <span class="text-red-500">*</span>
                  </label>
                  <Select
                    v-model="generoSelect"
                    :options="generoOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                    :class="{ 'p-invalid': formErrors.genero }"
                    placeholder="Seleccionar"
                    show-clear
                  />
                  <InputText
                    v-if="generoSelect === 'OTRO'"
                    v-model="generoCustom"
                    class="w-full mt-2"
                    placeholder="¿Cuál?"
                    maxlength="20"
                  />
                  <small v-if="formErrors.genero" class="text-red-500">{{ formErrors.genero }}</small>
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Estado</label>
                  <Select
                    v-model="form.estado"
                    :options="estadoOptions"
                    option-label="label"
                    option-value="value"
                    class="w-full"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Teléfono</label>
                  <InputText v-model="form.telefono" class="w-full" placeholder="+57 300 123 4567" />
                </div>

                <div>
                  <label class="block text-sm font-medium mb-2">Email</label>
                  <InputText v-model="form.email" type="email" class="w-full" placeholder="ejemplo@correo.com" />
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium mb-2">Dirección</label>
                  <InputText v-model="form.direccion" class="w-full" placeholder="Calle 123 # 45-67" />
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium mb-2">Información del Seguro</label>
                  <Textarea
                    v-model="form.informacionSeguro"
                    rows="2"
                    class="w-full"
                    placeholder="EPS, póliza, etc."
                  />
                </div>

                <div class="md:col-span-2">
                  <label class="block text-sm font-medium mb-2">Observaciones Especiales</label>
                  <Textarea
                    v-model="form.observacionesEspeciales"
                    rows="3"
                    class="w-full"
                    placeholder="Alergias, condiciones médicas, etc."
                  />
                </div>
              </div>
            </div>

            <!-- Emergency Contacts -->
            <div>
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-lg font-semibold text-[var(--text-color)] flex items-center gap-2">
                  <i class="pi pi-phone text-violet-500" />
                  Contactos de Emergencia
                </h3>
                <Button
                  label="Agregar"
                  icon="pi pi-plus"
                  size="small"
                  severity="secondary"
                  outlined
                  @click="addEmergencyContact"
                />
              </div>

              <div v-if="emergencyContacts.length === 0" class="text-center py-6 text-[var(--text-color-secondary)]">
                No hay contactos de emergencia. Haz clic en "Agregar" para añadir uno.
              </div>

              <div v-else class="space-y-4">
                <Card v-for="(contact, index) in emergencyContacts" :key="index">
                  <template #content>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label class="block text-sm font-medium mb-2">Nombre</label>
                        <InputText v-model="contact.nombre" class="w-full" placeholder="Nombre completo" />
                      </div>
                      <div>
                        <label class="block text-sm font-medium mb-2">Teléfono</label>
                        <InputText v-model="contact.telefono" class="w-full" placeholder="+57 300 123 4567" />
                      </div>
                      <div class="flex items-end gap-2">
                        <div class="flex-1">
                          <label class="block text-sm font-medium mb-2">Parentesco</label>
                          <Select
                            v-model="contact.parentescoSelect"
                            :options="parentescoOptions"
                            option-label="label"
                            option-value="value"
                            class="w-full"
                            placeholder="Seleccionar"
                            show-clear
                          />
                          <InputText
                            v-if="contact.parentescoSelect === 'OTRO'"
                            v-model="contact.parentescoCustom"
                            class="w-full mt-2"
                            placeholder="¿Cuál?"
                          />
                        </div>
                        <Button
                          icon="pi pi-trash"
                          severity="danger"
                          text
                          rounded
                          @click="removeEmergencyContact(index)"
                        />
                      </div>
                    </div>
                  </template>
                </Card>
              </div>
            </div>
          </form>
        </template>
      </Card>
    </template>
  </div>
</template>
