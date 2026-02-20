<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()

// ─── Step config ────────────────────────────────────────────────────────────
const TOTAL_STEPS = 5
const currentStep = ref(1)
const saving = ref(false)

const steps = [
  { label: 'Datos Personales', icon: 'pi pi-user' },
  { label: 'Núcleo Familiar', icon: 'pi pi-users' },
  { label: 'Info. Laboral', icon: 'pi pi-briefcase' },
  { label: 'Educación', icon: 'pi pi-book' },
  { label: 'Certificados', icon: 'pi pi-file' },
]

// ─── Step 1 – Datos Personales ───────────────────────────────────────────────
const step1 = reactive({
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
const step1Errors = reactive<Record<string, string>>({})

function validateStep1() {
  Object.keys(step1Errors).forEach((k) => delete step1Errors[k])
  if (!step1.nombre.trim()) step1Errors.nombre = 'Requerido'
  if (!step1.apellido.trim()) step1Errors.apellido = 'Requerido'
  if (!step1.numeroDocumento.trim()) step1Errors.numeroDocumento = 'Requerido'
  if (!step1.genero) step1Errors.genero = 'Requerido'
  if (!step1.fechaNacimiento) step1Errors.fechaNacimiento = 'Requerido'
  return Object.keys(step1Errors).length === 0
}

// ─── Step 2 – Núcleo Familiar ────────────────────────────────────────────────
interface FamilyMemberForm {
  nombre: string
  apellido: string
  tipoDocumento: 'REGISTRO_CIVIL' | 'TI' | 'CC' | 'CE'
  numeroDocumento: string
  fechaNacimiento: string
  genero: string
  parentesco: string
  telefono: string
}

const familyMembers = ref<FamilyMemberForm[]>([])

function addFamilyMember() {
  familyMembers.value.push({
    nombre: '', apellido: '', tipoDocumento: 'CC', numeroDocumento: '',
    fechaNacimiento: '', genero: '', parentesco: '', telefono: '',
  })
}

function removeFamilyMember(i: number) {
  familyMembers.value.splice(i, 1)
}

// ─── Step 3 – Información Laboral ────────────────────────────────────────────
interface CargoForm {
  nombreCargo: string
  ubicacion: string
  fechaIngreso: string
  fechaTerminacion: string
}

interface EmergencyContactForm {
  nombre: string
  apellido: string
  telefono: string
  parentesco: string
}

const cargos = ref<CargoForm[]>([])
const emergencyContacts = ref<EmergencyContactForm[]>([])

function addCargo() {
  cargos.value.push({ nombreCargo: '', ubicacion: '', fechaIngreso: '', fechaTerminacion: '' })
}

function removeCargo(i: number) {
  cargos.value.splice(i, 1)
}

function addEmergencyContact() {
  emergencyContacts.value.push({ nombre: '', apellido: '', telefono: '', parentesco: '' })
}

function removeEmergencyContact(i: number) {
  emergencyContacts.value.splice(i, 1)
}

// ─── Step 4 – Educación y Vehículos ──────────────────────────────────────────
interface EducacionForm {
  institucion: string
  nivelEscritura: string
  nivelHabla: string
  capacidadTraducir: boolean
}

interface VehiculoForm {
  tipoVehiculo: string
  placas: string
  tipoLicencia: string
  numeroLicencia: string
}

const educaciones = ref<EducacionForm[]>([])
const vehiculos = ref<VehiculoForm[]>([])

function addEducacion() {
  educaciones.value.push({ institucion: '', nivelEscritura: '', nivelHabla: '', capacidadTraducir: false })
}

function removeEducacion(i: number) {
  educaciones.value.splice(i, 1)
}

function addVehiculo() {
  vehiculos.value.push({ tipoVehiculo: '', placas: '', tipoLicencia: '', numeroLicencia: '' })
}

function removeVehiculo(i: number) {
  vehiculos.value.splice(i, 1)
}

// ─── Step 5 – Certificados y Migración ───────────────────────────────────────
const certAlturas = reactive({
  enabled: false,
  fechaExpedicion: '',
  fechaVencimiento: '',
})

const certRiesgo = reactive({
  enabled: false,
  fechaExpedicion: '',
  fechaVencimiento: '',
})

const migracion = reactive({
  enabled: false,
  numeroPasaporte: '',
  pasaporteExpedicion: '',
  pasaporteVencimiento: '',
  numeroVisa: '',
  visaExpedicion: '',
  visaVencimiento: '',
})

// ─── Navigation ──────────────────────────────────────────────────────────────
function goNext() {
  if (currentStep.value === 1 && !validateStep1()) return
  if (currentStep.value < TOTAL_STEPS) currentStep.value++
}

function goPrev() {
  if (currentStep.value > 1) currentStep.value--
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submit() {
  if (!validateStep1()) {
    currentStep.value = 1
    return
  }

  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      nombre: step1.nombre.trim(),
      apellido: step1.apellido.trim(),
      tipoDocumento: step1.tipoDocumento,
      numeroDocumento: step1.numeroDocumento.trim(),
      genero: step1.genero,
      fechaNacimiento: step1.fechaNacimiento,
      permisoTrabajo: step1.permisoTrabajo,
      estado: step1.estado,
    }

    if (step1.estadoCivil) payload.estadoCivil = step1.estadoCivil
    if (step1.tipoVivienda) payload.tipoVivienda = step1.tipoVivienda
    if (step1.estratoSocioeconomico.trim() !== '') payload.estratoSocioeconomico = Number(step1.estratoSocioeconomico)
    if (step1.direccion.trim()) payload.direccion = step1.direccion.trim()
    if (step1.telefono.trim()) payload.telefono = step1.telefono.trim()
    if (step1.email.trim()) payload.email = step1.email.trim()

    const validFamily = familyMembers.value.filter((f) => f.nombre.trim() && f.apellido.trim() && f.fechaNacimiento && f.genero && f.parentesco)
    if (validFamily.length) {
      payload.nucleoFamiliar = validFamily.map((f) => ({
        nombre: f.nombre.trim(),
        apellido: f.apellido.trim(),
        tipoDocumento: f.tipoDocumento,
        numeroDocumento: f.numeroDocumento.trim() || undefined,
        fechaNacimiento: f.fechaNacimiento,
        genero: f.genero,
        parentesco: f.parentesco,
        telefono: f.telefono.trim() || undefined,
      }))
    }

    const validCargos = cargos.value.filter((c) => c.nombreCargo.trim() && c.ubicacion.trim() && c.fechaIngreso)
    if (validCargos.length) {
      payload.cargos = validCargos.map((c) => ({
        nombreCargo: c.nombreCargo.trim(),
        ubicacion: c.ubicacion.trim(),
        fechaIngreso: c.fechaIngreso,
        fechaTerminacion: c.fechaTerminacion || undefined,
      }))
    }

    const validContacts = emergencyContacts.value.filter((c) => c.nombre.trim() && c.apellido.trim() && c.telefono.trim() && c.parentesco)
    if (validContacts.length) {
      payload.contactosEmergencia = validContacts.map((c) => ({
        nombre: c.nombre.trim(),
        apellido: c.apellido.trim(),
        telefono: c.telefono.trim(),
        parentesco: c.parentesco,
      }))
    }

    const res = await apiFetch<{ success: boolean; data: { id: number } }>('/employees', {
      method: 'POST',
      body: payload,
    })

    toast.add({ severity: 'success', summary: 'Empleado creado', detail: `${step1.nombre} ${step1.apellido} registrado correctamente`, life: 4000 })
    await navigateTo(`/empleados/${res.data.id}`)
  } catch (e: any) {
    const msg = e?.data?.message || e?.message || 'Error al crear el empleado'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 5000 })
  } finally {
    saving.value = false
  }
}

// ─── Option lists ─────────────────────────────────────────────────────────────
const tiposDoc = [
  { label: 'Cédula de Ciudadanía (CC)', value: 'CC' },
  { label: 'Cédula de Extranjería (CE)', value: 'CE' },
  { label: 'Pasaporte', value: 'PASAPORTE' },
]

const tiposDocFamiliar = [
  { label: 'Registro Civil', value: 'REGISTRO_CIVIL' },
  { label: 'T. Identidad (TI)', value: 'TI' },
  { label: 'Cédula (CC)', value: 'CC' },
  { label: 'Cédula Ext. (CE)', value: 'CE' },
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

const parentescos = [
  { label: 'Cónyuge', value: 'CONYUGE' },
  { label: 'Hijo/a', value: 'HIJO' },
  { label: 'Padre', value: 'PADRE' },
  { label: 'Madre', value: 'MADRE' },
  { label: 'Hermano/a', value: 'HERMANO' },
  { label: 'Otro', value: 'OTRO' },
]

const nivelesIdioma = [
  { label: 'Básico', value: 'BASICO' },
  { label: 'Intermedio', value: 'INTERMEDIO' },
  { label: 'Avanzado', value: 'AVANZADO' },
  { label: 'Nativo', value: 'NATIVO' },
]

const tiposVehiculo = [
  { label: 'Moto', value: 'MOTO' },
  { label: 'Carro', value: 'CARRO' },
  { label: 'Camión', value: 'CAMION' },
  { label: 'Bicicleta', value: 'BICICLETA' },
]
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Empleado" subtitle="Registro de nuevo colaborador">
      <template #actions>
        <Button label="Cancelar" icon="pi pi-times" severity="secondary" outlined
          @click="navigateTo('/empleados')" />
      </template>
    </AppPageHeader>

    <!-- Step progress bar -->
    <Card class="mb-6">
      <template #content>
        <div class="flex items-center gap-0">
          <template v-for="(step, i) in steps" :key="i">
            <div class="flex flex-col items-center flex-1 min-w-0">
              <div :class="[
                'w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors mb-1',
                currentStep > i + 1 ? 'bg-green-500 text-white' :
                currentStep === i + 1 ? 'bg-violet-600 text-white' :
                'bg-[var(--surface-200)] text-[var(--text-color-secondary)]'
              ]">
                <i v-if="currentStep > i + 1" class="pi pi-check text-xs" />
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span :class="[
                'text-xs text-center leading-tight hidden sm:block',
                currentStep === i + 1 ? 'text-violet-600 font-medium dark:text-violet-400' : 'text-[var(--text-color-secondary)]'
              ]">{{ step.label }}</span>
            </div>
            <div v-if="i < steps.length - 1"
              :class="['h-0.5 flex-1 mx-1 transition-colors', currentStep > i + 1 ? 'bg-green-500' : 'bg-[var(--surface-200)]']" />
          </template>
        </div>
      </template>
    </Card>

    <!-- ───────────────────── STEP 1: Datos Personales ───────────────────────── -->
    <div v-show="currentStep === 1" data-step="1">
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
            <!-- Nombre -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Nombre <span class="text-red-500">*</span></label>
              <InputText v-model="step1.nombre" placeholder="Nombres" :class="{ 'p-invalid': step1Errors.nombre }" />
              <small v-if="step1Errors.nombre" class="text-red-500">{{ step1Errors.nombre }}</small>
            </div>
            <!-- Apellido -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Apellido <span class="text-red-500">*</span></label>
              <InputText v-model="step1.apellido" placeholder="Apellidos" :class="{ 'p-invalid': step1Errors.apellido }" />
              <small v-if="step1Errors.apellido" class="text-red-500">{{ step1Errors.apellido }}</small>
            </div>
            <!-- Tipo Documento -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Tipo Documento</label>
              <Select v-model="step1.tipoDocumento" :options="tiposDoc" option-label="label" option-value="value" />
            </div>
            <!-- Número Documento -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Número Documento <span class="text-red-500">*</span></label>
              <InputText v-model="step1.numeroDocumento" placeholder="Número de documento" :class="{ 'p-invalid': step1Errors.numeroDocumento }" />
              <small v-if="step1Errors.numeroDocumento" class="text-red-500">{{ step1Errors.numeroDocumento }}</small>
            </div>
            <!-- Género -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Género <span class="text-red-500">*</span></label>
              <Select v-model="step1.genero" :options="generos" option-label="label" option-value="value"
                placeholder="Seleccionar" :class="{ 'p-invalid': step1Errors.genero }" />
              <small v-if="step1Errors.genero" class="text-red-500">{{ step1Errors.genero }}</small>
            </div>
            <!-- Fecha Nacimiento -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha de Nacimiento <span class="text-red-500">*</span></label>
              <InputText v-model="step1.fechaNacimiento" type="date" :class="{ 'p-invalid': step1Errors.fechaNacimiento }" />
              <small v-if="step1Errors.fechaNacimiento" class="text-red-500">{{ step1Errors.fechaNacimiento }}</small>
            </div>
            <!-- Estado Civil -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estado Civil</label>
              <Select v-model="step1.estadoCivil" :options="estadosCiviles" option-label="label" option-value="value"
                placeholder="Seleccionar" show-clear />
            </div>
            <!-- Tipo Vivienda -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Tipo Vivienda</label>
              <Select v-model="step1.tipoVivienda" :options="tiposVivienda" option-label="label" option-value="value"
                placeholder="Seleccionar" show-clear />
            </div>
            <!-- Estrato -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estrato Socioeconómico</label>
              <InputText v-model="step1.estratoSocioeconomico" type="number" min="1" max="6" placeholder="1-6" />
            </div>
            <!-- Dirección -->
            <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label class="text-sm font-medium">Dirección</label>
              <InputText v-model="step1.direccion" placeholder="Dirección de residencia" />
            </div>
            <!-- Teléfono -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Teléfono</label>
              <InputText v-model="step1.telefono" placeholder="Número de teléfono" />
            </div>
            <!-- Email -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Email</label>
              <InputText v-model="step1.email" type="email" placeholder="correo@ejemplo.com" />
            </div>
            <!-- Estado -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Estado</label>
              <Select v-model="step1.estado"
                :options="[{ label: 'Activo', value: 'ACTIVO' }, { label: 'Inactivo', value: 'INACTIVO' }]"
                option-label="label" option-value="value" />
            </div>
            <!-- Permiso Trabajo -->
            <div class="flex items-center gap-2 pt-2 sm:col-span-2 lg:col-span-3">
              <Checkbox v-model="step1.permisoTrabajo" :binary="true" input-id="permisoTrabajo" />
              <label for="permisoTrabajo" class="text-sm">Tiene permiso de trabajo</label>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ───────────────────── STEP 2: Núcleo Familiar ────────────────────────── -->
    <div v-show="currentStep === 2" data-step="2">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-users text-violet-500" /> Núcleo Familiar
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addFamilyMember" />
          </div>
        </template>
        <template #content>
          <div v-if="familyMembers.length === 0"
            class="text-center py-10 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-users text-3xl mb-2 block opacity-40" />
            Sin miembros registrados. Haz clic en "Agregar" para añadir.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(member, i) in familyMembers" :key="i"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Miembro {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeFamilyMember(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Nombre</label>
                  <InputText v-model="member.nombre" placeholder="Nombre" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Apellido</label>
                  <InputText v-model="member.apellido" placeholder="Apellido" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Parentesco</label>
                  <Select v-model="member.parentesco" :options="parentescos" option-label="label" option-value="value"
                    placeholder="Parentesco" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Tipo Documento</label>
                  <Select v-model="member.tipoDocumento" :options="tiposDocFamiliar" option-label="label" option-value="value"
                    size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">N° Documento</label>
                  <InputText v-model="member.numeroDocumento" placeholder="Opcional" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Género</label>
                  <Select v-model="member.genero" :options="generos" option-label="label" option-value="value"
                    placeholder="Género" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Fecha Nacimiento</label>
                  <InputText v-model="member.fechaNacimiento" type="date" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Teléfono</label>
                  <InputText v-model="member.telefono" placeholder="Opcional" size="small" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ───────────────────── STEP 3: Información Laboral ────────────────────── -->
    <div v-show="currentStep === 3" data-step="3" class="space-y-4">
      <!-- Cargos -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-building text-violet-500" /> Cargo en la Empresa
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addCargo" />
          </div>
        </template>
        <template #content>
          <div v-if="cargos.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-building text-3xl mb-2 block opacity-40" />
            Sin cargos registrados.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(cargo, i) in cargos" :key="i"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Cargo {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeCargo(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Nombre del Cargo</label>
                  <InputText v-model="cargo.nombreCargo" placeholder="Ej: Técnico Electricista" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Ubicación</label>
                  <InputText v-model="cargo.ubicacion" placeholder="Ej: Bogotá - Sede Norte" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Fecha de Ingreso</label>
                  <InputText v-model="cargo.fechaIngreso" type="date" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Fecha Terminación (si aplica)</label>
                  <InputText v-model="cargo.fechaTerminacion" type="date" size="small" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Contactos de Emergencia -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-phone text-violet-500" /> Contactos de Emergencia
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addEmergencyContact" />
          </div>
        </template>
        <template #content>
          <div v-if="emergencyContacts.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-phone text-3xl mb-2 block opacity-40" />
            Sin contactos de emergencia.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(contact, i) in emergencyContacts" :key="i"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Contacto {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeEmergencyContact(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Nombre</label>
                  <InputText v-model="contact.nombre" placeholder="Nombre" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Apellido</label>
                  <InputText v-model="contact.apellido" placeholder="Apellido" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Teléfono</label>
                  <InputText v-model="contact.telefono" placeholder="Teléfono" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Parentesco</label>
                  <Select v-model="contact.parentesco" :options="parentescos" option-label="label" option-value="value"
                    placeholder="Parentesco" size="small" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ───────────────────── STEP 4: Educación y Vehículos ──────────────────── -->
    <div v-show="currentStep === 4" data-step="4" class="space-y-4">
      <!-- Educación / Idiomas -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-book text-violet-500" /> Educación e Idiomas
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addEducacion" />
          </div>
        </template>
        <template #content>
          <div v-if="educaciones.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-book text-3xl mb-2 block opacity-40" />
            Sin registros de educación.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(edu, i) in educaciones" :key="i"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Institución / Idioma {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeEducacion(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs text-[var(--text-color-secondary)]">Institución / Idioma</label>
                  <InputText v-model="edu.institucion" placeholder="Ej: Universidad Nacional / Inglés" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Nivel Escritura</label>
                  <Select v-model="edu.nivelEscritura" :options="nivelesIdioma" option-label="label" option-value="value"
                    placeholder="Nivel" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Nivel Habla</label>
                  <Select v-model="edu.nivelHabla" :options="nivelesIdioma" option-label="label" option-value="value"
                    placeholder="Nivel" size="small" />
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <Checkbox v-model="edu.capacidadTraducir" :binary="true" :input-id="`traducir-${i}`" />
                  <label :for="`traducir-${i}`" class="text-sm">Puede traducir</label>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Vehículos -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-car text-violet-500" /> Vehículos
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addVehiculo" />
          </div>
        </template>
        <template #content>
          <div v-if="vehiculos.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-car text-3xl mb-2 block opacity-40" />
            Sin vehículos registrados.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(v, i) in vehiculos" :key="i"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Vehículo {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeVehiculo(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Tipo Vehículo</label>
                  <Select v-model="v.tipoVehiculo" :options="tiposVehiculo" option-label="label" option-value="value"
                    placeholder="Tipo" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Placas</label>
                  <InputText v-model="v.placas" placeholder="ABC-123" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Tipo Licencia</label>
                  <InputText v-model="v.tipoLicencia" placeholder="A1, B1, C1..." size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">N° Licencia</label>
                  <InputText v-model="v.numeroLicencia" placeholder="Número" size="small" />
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ───────────────────── STEP 5: Certificados y Migración ───────────────── -->
    <div v-show="currentStep === 5" data-step="5" class="space-y-4">
      <!-- Certificado Alturas -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-shield text-violet-500" /> Certificado de Alturas
            </h3>
            <div class="flex items-center gap-2">
              <Checkbox v-model="certAlturas.enabled" :binary="true" input-id="certAlturasEnabled" />
              <label for="certAlturasEnabled" class="text-sm">Tiene certificado</label>
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="!certAlturas.enabled" class="text-center py-6 text-[var(--text-color-secondary)] text-sm opacity-60">
            Marca la casilla si el empleado tiene certificado de alturas.
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha Expedición</label>
              <InputText v-model="certAlturas.fechaExpedicion" type="date" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha Vencimiento</label>
              <InputText v-model="certAlturas.fechaVencimiento" type="date" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Certificado Riesgo Eléctrico -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-bolt text-violet-500" /> Certificado Riesgo Eléctrico
            </h3>
            <div class="flex items-center gap-2">
              <Checkbox v-model="certRiesgo.enabled" :binary="true" input-id="certRiesgoEnabled" />
              <label for="certRiesgoEnabled" class="text-sm">Tiene certificado</label>
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="!certRiesgo.enabled" class="text-center py-6 text-[var(--text-color-secondary)] text-sm opacity-60">
            Marca la casilla si el empleado tiene certificado de riesgo eléctrico.
          </div>
          <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha Expedición</label>
              <InputText v-model="certRiesgo.fechaExpedicion" type="date" />
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Fecha Vencimiento</label>
              <InputText v-model="certRiesgo.fechaVencimiento" type="date" />
            </div>
          </div>
        </template>
      </Card>

      <!-- Datos de Migración -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-globe text-violet-500" /> Datos de Migración
            </h3>
            <div class="flex items-center gap-2">
              <Checkbox v-model="migracion.enabled" :binary="true" input-id="migracionEnabled" />
              <label for="migracionEnabled" class="text-sm">Tiene datos de migración</label>
            </div>
          </div>
        </template>
        <template #content>
          <div v-if="!migracion.enabled" class="text-center py-6 text-[var(--text-color-secondary)] text-sm opacity-60">
            Marca la casilla para registrar pasaporte y/o visa.
          </div>
          <div v-else class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">N° Pasaporte</label>
                <InputText v-model="migracion.numeroPasaporte" placeholder="Número" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Expedición Pasaporte</label>
                <InputText v-model="migracion.pasaporteExpedicion" type="date" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Vencimiento Pasaporte</label>
                <InputText v-model="migracion.pasaporteVencimiento" type="date" />
              </div>
            </div>
            <Divider />
            <p class="text-sm font-medium text-[var(--text-color-secondary)]">Visa (opcional)</p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">N° Visa</label>
                <InputText v-model="migracion.numeroVisa" placeholder="Opcional" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Expedición Visa</label>
                <InputText v-model="migracion.visaExpedicion" type="date" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Vencimiento Visa</label>
                <InputText v-model="migracion.visaVencimiento" type="date" />
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Summary before submit -->
      <Card class="border border-violet-200 dark:border-violet-800">
        <template #content>
          <div class="flex items-start gap-3">
            <i class="pi pi-info-circle text-violet-500 text-xl mt-0.5" />
            <div>
              <p class="font-medium text-[var(--text-color)]">Resumen del registro</p>
              <ul class="mt-1 text-sm text-[var(--text-color-secondary)] space-y-0.5">
                <li><strong>Empleado:</strong> {{ step1.nombre }} {{ step1.apellido }}</li>
                <li><strong>Documento:</strong> {{ step1.tipoDocumento }} {{ step1.numeroDocumento }}</li>
                <li v-if="familyMembers.length"><strong>Núcleo familiar:</strong> {{ familyMembers.length }} miembro(s)</li>
                <li v-if="cargos.length"><strong>Cargos:</strong> {{ cargos.length }}</li>
                <li v-if="emergencyContacts.length"><strong>Contactos emergencia:</strong> {{ emergencyContacts.length }}</li>
              </ul>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ───────────────────── Navigation Footer ───────────────────────────────── -->
    <div class="mt-6 flex items-center justify-between">
      <Button v-if="currentStep > 1" label="Anterior" icon="pi pi-arrow-left" severity="secondary" outlined
        @click="goPrev" />
      <div v-else />

      <div class="flex gap-2">
        <Button v-if="currentStep < TOTAL_STEPS"
          label="Siguiente" icon="pi pi-arrow-right" icon-pos="right" severity="info"
          @click="goNext" />
        <Button v-else
          label="Guardar Empleado" icon="pi pi-check" severity="success"
          :loading="saving" @click="submit" />
      </div>
    </div>

    <Toast />
  </div>
</template>
