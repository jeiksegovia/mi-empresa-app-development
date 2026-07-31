<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()
const saving = ref(false)

// ─── Jul-22 §1.2: hide estado control for CONTRATOS. ────────────────────────
// `useDomainAccess` mirrors the backend RBAC matrix. CONTRATOS has create-only
// access on `pacientes` and the backend will force `estado = ACTIVO` regardless
// of the body value, so the UI simply omits the control AND the payload field.
const { profile } = useDomainAccess()
const hideEstadoCreate = computed(() => profile.value === 'CONTRATOS')

// ─── Jul-22 §8: unsaved-changes guard (W2-frontend task #8). ───────────────
// `dirty` flips true on the first user-driven change after mount; the guard
// blocks SPA route changes + browser unload until `markClean` is called
// (which happens inside `handleSubmit` only after the server returns 201).
const isDirty = ref(false)
const { markDirty, markClean } = useUnsavedGuard(isDirty)

// Form state
const form = reactive({
  nombre: '',
  tipoDocumento: 'CC' as 'CC' | 'CE' | 'PASAPORTE' | 'REGISTRO_CIVIL',
  numeroDocumento: '',
  fechaNacimiento: '',
  // B3/B4/B5: additive cliente fields (all optional).
  fechaCumpleanos: '',
  tipoSangre: '' as
    | ''
    | 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG'
    | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG',
  eps: '',
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

const formErrors = reactive<Record<string, string>>({})

// Emergency contacts
interface EmergencyContact {
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
  markDirty()
}

function removeEmergencyContact(index: number) {
  emergencyContacts.value.splice(index, 1)
  markDirty()
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
    }

    // Jul-22 §1.2: CONTRATOS callers must not send `estado` — backend ignores
    // the field for them and forces ACTIVO. Hiding the Select + omitting the
    // payload key keeps the wire payload aligned with the contract.
    if (!hideEstadoCreate.value) {
      payload.estado = form.estado
    }

    if (form.telefono.trim()) payload.telefono = form.telefono.trim()
    if (form.email.trim()) payload.email = form.email.trim()
    if (form.direccion.trim()) payload.direccion = form.direccion.trim()
    // B3/B4/B5: additive cliente fields. Only include when set — backend
    // accepts nulls but we keep the payload tight.
    if (form.fechaCumpleanos) payload.fechaCumpleanos = form.fechaCumpleanos
    if (form.tipoSangre) payload.tipoSangre = form.tipoSangre
    if (form.eps.trim()) payload.eps = form.eps.trim()
    if (form.informacionSeguro.trim()) payload.informacionSeguro = form.informacionSeguro.trim()
    if (form.observacionesEspeciales.trim()) payload.observacionesEspeciales = form.observacionesEspeciales.trim()

    // Add emergency contacts
    const validContacts = emergencyContacts.value
      .map((c) => ({
        ...c,
        parentescoResolved:
          c.parentescoSelect === 'OTRO'
            ? c.parentescoCustom.trim()
            : c.parentescoSelect,
      }))
      .filter(
        (c) =>
          c.nombre.trim() &&
          c.telefono.trim() &&
          (c.parentescoResolved ?? '').length > 0
      )
    if (validContacts.length) {
      payload.contactosEmergencia = validContacts.map((c) => ({
        nombre: c.nombre.trim(),
        telefono: c.telefono.trim(),
        parentesco: c.parentescoResolved,
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

    // Mark clean BEFORE navigation so the guard does not prompt on the way out.
    markClean()
    await navigateTo(`/pacientes/${res.data.id}`)
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al crear el paciente'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  // Cancel is an explicit user intent — bypass the guard by clearing dirty.
  markClean()
  navigateTo('/pacientes')
}

// ─── Wire dirty tracking ───────────────────────────────────────────────────
// Snapshot initial values once; a field is considered "changed" if its current
// value no longer matches the snapshot. We watch all form scalars + the two
// genero refs + the emergencyContacts array (deep) in a single watcher so the
// first edit flips dirty to true exactly once.
const initialSnapshot = {
  ...form,
  generoSelect: generoSelect.value,
  generoCustom: generoCustom.value,
  contactos: JSON.stringify(emergencyContacts.value),
}

watch(
  () => [
    form.nombre,
    form.tipoDocumento,
    form.numeroDocumento,
    form.fechaNacimiento,
    form.fechaCumpleanos,
    form.tipoSangre,
    form.eps,
    form.telefono,
    form.email,
    form.direccion,
    form.informacionSeguro,
    form.observacionesEspeciales,
    form.estado,
    generoSelect.value,
    generoCustom.value,
    JSON.stringify(emergencyContacts.value),
  ],
  () => {
    const current = {
      ...form,
      generoSelect: generoSelect.value,
      generoCustom: generoCustom.value,
      contactos: JSON.stringify(emergencyContacts.value),
    }
    const changed =
      current.nombre !== initialSnapshot.nombre ||
      current.tipoDocumento !== initialSnapshot.tipoDocumento ||
      current.numeroDocumento !== initialSnapshot.numeroDocumento ||
      current.fechaNacimiento !== initialSnapshot.fechaNacimiento ||
      current.fechaCumpleanos !== initialSnapshot.fechaCumpleanos ||
      current.tipoSangre !== initialSnapshot.tipoSangre ||
      current.eps !== initialSnapshot.eps ||
      current.telefono !== initialSnapshot.telefono ||
      current.email !== initialSnapshot.email ||
      current.direccion !== initialSnapshot.direccion ||
      current.informacionSeguro !== initialSnapshot.informacionSeguro ||
      current.observacionesEspeciales !== initialSnapshot.observacionesEspeciales ||
      current.estado !== initialSnapshot.estado ||
      current.generoSelect !== initialSnapshot.generoSelect ||
      current.generoCustom !== initialSnapshot.generoCustom ||
      current.contactos !== initialSnapshot.contactos
    if (changed) isDirty.value = true
  },
  { deep: true },
)

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

// B4: TipoSangre enum (8 values from contract §2) — display as
// Spanish-friendly notation, e.g. "A+", mapped to enum values like A_POS.
const tipoSangreOptions = [
  { label: 'A+', value: 'A_POS' },
  { label: 'A-', value: 'A_NEG' },
  { label: 'B+', value: 'B_POS' },
  { label: 'B-', value: 'B_NEG' },
  { label: 'AB+', value: 'AB_POS' },
  { label: 'AB-', value: 'AB_NEG' },
  { label: 'O+', value: 'O_POS' },
  { label: 'O-', value: 'O_NEG' },
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
                  :model-value="form.nombre"
                  @update:model-value="(v) => form.nombre = (v ?? '').toUpperCase()"
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

              <!-- Jul-22 §1.2: estado control hidden for CONTRATOS (create-only
                   access on `pacientes`). Backend forces ACTIVO regardless. -->
              <div v-if="!hideEstadoCreate" data-testid="estado-field">
                <label class="block text-sm font-medium mb-2">Estado</label>
                <Select
                  v-model="form.estado"
                  :options="estadoOptions"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                  data-testid="estado-select"
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

              <!-- B3/B4/B5: additive cliente fields. All optional. Positioned
                   ABOVE "Información del seguro" per assignment spec. -->
              <div>
                <label class="block text-sm font-medium mb-2">
                  Fecha de cumpleaños
                  <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
                </label>
                <input
                  type="date"
                  v-model="form.fechaCumpleanos"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg"
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">
                  Tipo de sangre
                  <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
                </label>
                <Select
                  v-model="form.tipoSangre"
                  :options="tipoSangreOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="—"
                  class="w-full"
                  show-clear
                />
              </div>

              <div>
                <label class="block text-sm font-medium mb-2">
                  EPS
                  <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
                </label>
                <InputText v-model="form.eps" class="w-full" placeholder="Sura Póliza 12345" />
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
  </div>
</template>
