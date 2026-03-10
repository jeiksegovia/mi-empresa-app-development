<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()
const saving = ref(false)

// Form state
const form = reactive({
  nombre: '',
  tipoDocumento: 'CC' as 'CC' | 'CE' | 'PASAPORTE' | 'REGISTRO_CIVIL',
  numeroDocumento: '',
  fechaNacimiento: '',
  genero: '',
  telefono: '',
  email: '',
  direccion: '',
  informacionSeguro: '',
  observacionesEspeciales: '',
  estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
})

const formErrors = reactive<Record<string, string>>({})

// Emergency contacts
interface EmergencyContact {
  nombre: string
  telefono: string
  parentesco: string
}

const emergencyContacts = ref<EmergencyContact[]>([])

function addEmergencyContact() {
  emergencyContacts.value.push({
    nombre: '',
    telefono: '',
    parentesco: '',
  })
}

function removeEmergencyContact(index: number) {
  emergencyContacts.value.splice(index, 1)
}

// Validation
function validateForm() {
  Object.keys(formErrors).forEach((k) => delete formErrors[k])

  if (!form.nombre.trim()) formErrors.nombre = 'Requerido'
  if (!form.numeroDocumento.trim()) formErrors.numeroDocumento = 'Requerido'
  if (!form.fechaNacimiento) formErrors.fechaNacimiento = 'Requerido'
  if (!form.genero) formErrors.genero = 'Requerido'

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
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      tipoDocumento: form.tipoDocumento,
      numeroDocumento: form.numeroDocumento.trim(),
      fechaNacimiento: form.fechaNacimiento,
      genero: form.genero,
      estado: form.estado,
    }

    if (form.telefono.trim()) payload.telefono = form.telefono.trim()
    if (form.email.trim()) payload.email = form.email.trim()
    if (form.direccion.trim()) payload.direccion = form.direccion.trim()
    if (form.informacionSeguro.trim()) payload.informacionSeguro = form.informacionSeguro.trim()
    if (form.observacionesEspeciales.trim()) payload.observacionesEspeciales = form.observacionesEspeciales.trim()

    // Add emergency contacts
    const validContacts = emergencyContacts.value.filter(
      (c) => c.nombre.trim() && c.telefono.trim() && c.parentesco.trim()
    )
    if (validContacts.length) {
      payload.contactosEmergencia = validContacts.map((c) => ({
        nombre: c.nombre.trim(),
        telefono: c.telefono.trim(),
        parentesco: c.parentesco.trim(),
      }))
    }

    const res = await apiFetch<{ success: boolean; data: { id: number } }>('/patients', {
      method: 'POST',
      body: payload,
    })

    toast.add({
      severity: 'success',
      summary: 'Paciente creado',
      detail: `${form.nombre} registrado correctamente`,
      life: 4000,
    })

    await navigateTo(`/pacientes/${res.data.id}`)
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al crear el paciente'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  navigateTo('/pacientes')
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
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Paciente" subtitle="Registrar nuevo paciente en el sistema">
      <template #actions>
        <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined @click="handleCancel" />
        <Button label="Guardar" icon="pi pi-check" :loading="saving" @click="handleSubmit" />
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
                <InputText
                  v-model="form.genero"
                  class="w-full"
                  :class="{ 'p-invalid': formErrors.genero }"
                  placeholder="Masculino, Femenino, Otro"
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
                        <InputText v-model="contact.parentesco" class="w-full" placeholder="Padre, Madre, etc." />
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
  </div>
</template>
