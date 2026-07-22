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
const { uploadFile } = useFileUpload()
const step1 = reactive({
  nombre: '',
  apellido: '',
  tipoDocumento: 'CC' as 'CC' | 'CE' | 'PASAPORTE',
  numeroDocumento: '',
  genero: '',
  fechaNacimiento: '',
  estadoCivil: '',
  tipoVivienda: '' as '' | 'PROPIA' | 'ARRENDADA' | 'FAMILIAR',
  estratoSocioeconomico: '',
  direccion: '',
  telefono: '',
  email: '',
  permisoTrabajo: false,
  estado: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
  // D3: documentoIdentificacionUrl — local-only until upload completes.
  documentoIdentificacionUrl: '',
  documentoFile: null as File | null,
  documentoFilename: '',
  // nomina-asistencia-jul-18: medio de pago de nómina (optional on create).
  // '' = Sin definir (null on wire).
  medioPagoTipo: '' as '' | 'NEQUI' | 'TRANSFERENCIA_BANCARIA',
  medioPagoNequi: '',
  bancoNombre: '',
  bancoTipoCuenta: '' as '' | 'AHORRO' | 'CORRIENTE',
  bancoNumeroCuenta: '',
})
const step1Errors = reactive<Record<string, string>>({})
const medioPagoTipoOptions = [
  { label: 'Sin definir', value: '' },
  { label: 'Nequi', value: 'NEQUI' },
  { label: 'Transferencia bancaria', value: 'TRANSFERENCIA_BANCARIA' },
]
const bancoTipoCuentaOptions = [
  { label: 'Ahorro', value: 'AHORRO' },
  { label: 'Corriente', value: 'CORRIENTE' },
]
const documentoUploading = ref(false)
const documentoFileInputRef = ref<HTMLInputElement | null>(null)
async function onDocumentoChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  documentoUploading.value = true
  try {
    const key = await uploadFile(input.files[0], 'empleado-documentos')
    if (key) {
      step1.documentoIdentificacionUrl = key
      step1.documentoFile = input.files[0]
      step1.documentoFilename = input.files[0].name
      toast.add({
        severity: 'success',
        summary: 'Documento subido',
        detail: 'El documento se subió correctamente.',
        life: 3000,
      })
    }
  } finally {
    documentoUploading.value = false
    if (documentoFileInputRef.value) documentoFileInputRef.value.value = ''
  }
}

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
  salario: number | null
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
  cargos.value.push({ nombreCargo: '', ubicacion: '', fechaIngreso: '', fechaTerminacion: '', salario: null })
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
  nivelHabla: string
  capacidadTraducir: boolean
}

// D2: EducacionEmpleado rows collected locally during wizard. The
// empleado POST doesn't accept nested educacionEmpleado, so we POST
// each row after the empleado creation succeeds (mirrors how the
// contactosEmergencia pattern is used — local collection, batch on submit).
interface EducacionEmpleadoForm {
  profesion: string
  universidad: string
  fechaGraduacion: string
  diplomaUrl: string
  diplomaFile: File | null
  diplomaFilename: string
  diplomaUploading: boolean
}

interface VehiculoForm {
  tipoVehiculo: string
  placas: string
  tipoLicencia: string
  numeroLicencia: string
}

const educaciones = ref<EducacionForm[]>([])
const educacionEmpleados = ref<EducacionEmpleadoForm[]>([])
const vehiculos = ref<VehiculoForm[]>([])

function addEducacion() {
  educaciones.value.push({ institucion: '', nivelHabla: '', capacidadTraducir: false })
}

function removeEducacion(i: number) {
  educaciones.value.splice(i, 1)
}

function addEducacionEmpleado() {
  educacionEmpleados.value.push({
    profesion: '', universidad: '', fechaGraduacion: '',
    diplomaUrl: '', diplomaFile: null, diplomaFilename: '',
    diplomaUploading: false,
  })
}

function removeEducacionEmpleado(i: number) {
  educacionEmpleados.value.splice(i, 1)
}

async function onEducacionDiplomaChange(event: Event, i: number) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  const file = input.files[0]
  educacionEmpleados.value[i].diplomaUploading = true
  try {
    const key = await uploadFile(file, 'empleado-documentos')
    if (key) {
      educacionEmpleados.value[i].diplomaUrl = key
      educacionEmpleados.value[i].diplomaFile = file
      educacionEmpleados.value[i].diplomaFilename = file.name
    }
  } finally {
    educacionEmpleados.value[i].diplomaUploading = false
    input.value = ''
  }
}

function addVehiculo() {
  vehiculos.value.push({ tipoVehiculo: '', placas: '', tipoLicencia: '', numeroLicencia: '' })
}

function removeVehiculo(i: number) {
  vehiculos.value.splice(i, 1)
}

// ─── Step 5 – Certificados y Migración ───────────────────────────────────────
const certificados = ref<
  Array<{
    tipo: '' | 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
    nombre?: string
    fechaExpedicion: string
    fechaVencimiento: string
    // W11 P1: archivoUrl is the S3 key written into the create payload.
    archivoUrl?: string | null
  }>
>([])

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
    // D3: include documentoIdentificacionUrl on the create payload if set.
    if (step1.documentoIdentificacionUrl) {
      payload.documentoIdentificacionUrl = step1.documentoIdentificacionUrl
    }

    // nomina-asistencia-jul-18: optional medio de pago.
    // Omit when Sin definir; when set, send tipo + conditional fields.
    if (step1.medioPagoTipo === 'NEQUI') {
      payload.medioPagoTipo = 'NEQUI'
      payload.medioPagoNequi = step1.medioPagoNequi.trim() || undefined
    } else if (step1.medioPagoTipo === 'TRANSFERENCIA_BANCARIA') {
      payload.medioPagoTipo = 'TRANSFERENCIA_BANCARIA'
      if (step1.bancoNombre.trim()) payload.bancoNombre = step1.bancoNombre.trim()
      if (step1.bancoTipoCuenta) payload.bancoTipoCuenta = step1.bancoTipoCuenta
      if (step1.bancoNumeroCuenta.trim()) payload.bancoNumeroCuenta = step1.bancoNumeroCuenta.trim()
    }

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
        salario: c.salario != null ? c.salario : undefined,
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

    // Step 4 — Educación & Vehículos
    // D1: nivelEscritura removed from the UI. Send null so the legacy
    // concept is dropped on the new empleado per assignment.
    const validEducaciones = educaciones.value.filter(e => e.institucion.trim() && e.nivelHabla.trim())
    if (validEducaciones.length) {
      payload.educacionIdiomas = validEducaciones.map(e => ({
        institucion: e.institucion.trim(),
        nivelEscritura: null,
        nivelHabla: e.nivelHabla.trim(),
        capacidadTraducir: e.capacidadTraducir,
      }))
    }

    const validVehiculos = vehiculos.value.filter(v => v.tipoVehiculo.trim() && v.placas.trim() && v.tipoLicencia.trim() && v.numeroLicencia.trim())
    if (validVehiculos.length) {
      payload.vehiculos = validVehiculos.map(v => ({
        tipoVehiculo: v.tipoVehiculo.trim(),
        placas: v.placas.trim(),
        tipoLicencia: v.tipoLicencia.trim(),
        numeroLicencia: v.numeroLicencia.trim(),
      }))
    }

    // Step 5 — Certificados & Migración
    const validCertificados = certificados.value.filter(
      (c) => c.tipo && c.fechaExpedicion && c.fechaVencimiento
    )
    if (validCertificados.length) {
      payload.certificados = validCertificados.map((c) => ({
        tipo: c.tipo,
        nombre: c.tipo === 'OTRO' ? c.nombre?.trim() || undefined : undefined,
        fechaExpedicion: c.fechaExpedicion,
        fechaVencimiento: c.fechaVencimiento,
        // W11 P1: include the uploaded S3 key (frontend bug that lost the
        // file on the create flow too — same root cause as S7).
        archivoUrl: c.archivoUrl || undefined,
      }))
    }

    if (migracion.enabled) {
      payload.datosMigracion = {
        numeroPasaporte: migracion.numeroPasaporte || undefined,
        pasaporteExpedicion: migracion.pasaporteExpedicion || undefined,
        pasaporteVencimiento: migracion.pasaporteVencimiento || undefined,
        numeroVisa: migracion.numeroVisa || undefined,
        visaExpedicion: migracion.visaExpedicion || undefined,
        visaVencimiento: migracion.visaVencimiento || undefined,
      }
    }

    const res = await apiFetch<{ success: boolean; data: { id: number } }>('/employees', {
      method: 'POST',
      body: payload,
    })
    const newEmpleadoId = res.data.id

    // D2: persist the collected EducacionEmpleado rows now that we have
    // an id. Each row is POST'd to /employees/:id/educacion.
    const validEmpleadoEdu = educacionEmpleados.value.filter((e) => e.profesion.trim())
    if (validEmpleadoEdu.length) {
      await Promise.all(
        validEmpleadoEdu.map((e) =>
          apiFetch(`/employees/${newEmpleadoId}/educacion`, {
            method: 'POST',
            body: {
              profesion: e.profesion.trim(),
              universidad: e.universidad.trim() || undefined,
              fechaGraduacion: e.fechaGraduacion || undefined,
              diplomaUrl: e.diplomaUrl || undefined,
            },
          })
        )
      )
    }

    toast.add({ severity: 'success', summary: 'Empleado creado', detail: `${step1.nombre} ${step1.apellido} registrado correctamente`, life: 4000 })
    await navigateTo(`/empleados/${newEmpleadoId}`)
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
  { label: 'Propia', value: 'PROPIA' },
  { label: 'Arrendada', value: 'ARRENDADA' },
  { label: 'Familiar', value: 'FAMILIAR' },
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
              <InputText :model-value="step1.nombre" @update:model-value="(v) => step1.nombre = (v ?? '').toUpperCase()" placeholder="Nombres" :class="{ 'p-invalid': step1Errors.nombre }" />
              <small v-if="step1Errors.nombre" class="text-red-500">{{ step1Errors.nombre }}</small>
            </div>
            <!-- Apellido -->
            <div class="flex flex-col gap-1">
              <label class="text-sm font-medium">Apellido <span class="text-red-500">*</span></label>
              <InputText :model-value="step1.apellido" @update:model-value="(v) => step1.apellido = (v ?? '').toUpperCase()" placeholder="Apellidos" :class="{ 'p-invalid': step1Errors.apellido }" />
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

            <!-- D3: documentoIdentificacionUrl upload (PDF/imagen).
                 Same label/hidden-file pattern as hoja-vida and contrato
                 (jul-9 D4 lesson). -->
            <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
              <label class="text-sm font-medium">
                Documento de identificación
                <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
              </label>
              <div v-if="step1.documentoIdentificacionUrl" class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-md bg-[var(--surface-ground)]">
                <i class="pi pi-id-card text-violet-500" />
                <span class="flex-1 truncate text-sm">{{ step1.documentoFilename || step1.documentoIdentificacionUrl }}</span>
                <Button
                  icon="pi pi-times"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  @click="step1.documentoIdentificacionUrl = ''; step1.documentoFile = null; step1.documentoFilename = ''"
                />
              </div>
              <label
                v-else
                class="inline-flex items-center gap-2 px-3 py-2 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors w-fit"
              >
                <i class="pi pi-upload text-violet-500" />
                <span>Seleccionar archivo…</span>
                <input
                  ref="documentoFileInputRef"
                  type="file"
                  class="hidden"
                  accept="application/pdf,image/*"
                  :disabled="documentoUploading"
                  data-testid="documento-input"
                  @change="onDocumentoChange"
                />
              </label>
              <i v-if="documentoUploading" class="pi pi-spin pi-spinner text-violet-500 ml-2" />
            </div>

            <!-- nomina-asistencia-jul-18: Medio de pago de nómina (optional) -->
            <div
              class="flex flex-col gap-3 sm:col-span-2 lg:col-span-3 border-t border-[var(--surface-border)] pt-4 mt-1"
              data-testid="medio-pago-section"
            >
              <h4 class="text-sm font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-wallet text-violet-500" /> Medio de pago de nómina
                <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div class="flex flex-col gap-1">
                  <label class="text-sm font-medium" for="medio-pago-tipo">Tipo de medio</label>
                  <Select
                    id="medio-pago-tipo"
                    v-model="step1.medioPagoTipo"
                    :options="medioPagoTipoOptions"
                    option-label="label"
                    option-value="value"
                    placeholder="Sin definir"
                    class="w-full"
                    data-testid="medio-pago-tipo"
                  />
                </div>
                <div v-if="step1.medioPagoTipo === 'NEQUI'" class="flex flex-col gap-1">
                  <label class="text-sm font-medium" for="medio-pago-nequi">Número Nequi</label>
                  <InputText
                    id="medio-pago-nequi"
                    v-model="step1.medioPagoNequi"
                    placeholder="Número Nequi"
                    data-testid="medio-pago-nequi"
                  />
                </div>
                <template v-if="step1.medioPagoTipo === 'TRANSFERENCIA_BANCARIA'">
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium" for="medio-pago-banco">Banco</label>
                    <InputText
                      id="medio-pago-banco"
                      v-model="step1.bancoNombre"
                      placeholder="Nombre del banco"
                      data-testid="medio-pago-banco"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium" for="medio-pago-tipo-cuenta">Tipo de cuenta</label>
                    <Select
                      id="medio-pago-tipo-cuenta"
                      v-model="step1.bancoTipoCuenta"
                      :options="bancoTipoCuentaOptions"
                      option-label="label"
                      option-value="value"
                      placeholder="Seleccionar"
                      class="w-full"
                      data-testid="medio-pago-tipo-cuenta"
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-sm font-medium" for="medio-pago-numero-cuenta">Número de cuenta</label>
                    <InputText
                      id="medio-pago-numero-cuenta"
                      v-model="step1.bancoNumeroCuenta"
                      placeholder="Número de cuenta"
                      data-testid="medio-pago-numero-cuenta"
                    />
                  </div>
                </template>
              </div>
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
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs text-[var(--text-color-secondary)]">Salario (opcional)</label>
                  <InputNumber
                    v-model="cargo.salario"
                    mode="decimal"
                    :min-fraction-digits="0"
                    :max-fraction-digits="2"
                    placeholder="0.00"
                    size="small"
                    input-class="w-full"
                  />
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    Se extraerá de nómina cuando el módulo esté activo
                  </p>
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
                <!-- D1: nivelEscritura removed from the form. Backend
                     still accepts the legacy string + null per contract. -->
                <div class="flex flex-col gap-1 sm:col-span-2">
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

      <!-- D2: Formación Académica — repeat rows here, persisted AFTER
           empleado create (the empleado POST doesn't accept nested
           educacionEmpleado, so we POST each row to
           /employees/:id/educacion once the new id is in hand). -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0 flex items-center justify-between">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-graduation-cap text-violet-500" /> Formación Académica
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </h3>
            <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" outlined @click="addEducacionEmpleado" />
          </div>
        </template>
        <template #content>
          <div v-if="educacionEmpleados.length === 0"
            class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-graduation-cap text-3xl mb-2 block opacity-40" />
            Sin formación académica. Haz clic en "Agregar" para añadir.
          </div>
          <div v-else class="space-y-4">
            <div v-for="(row, i) in educacionEmpleados" :key="`new-edu-${i}`"
              class="border border-[var(--surface-border)] rounded-lg p-4">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Formación {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text rounded @click="removeEducacionEmpleado(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs text-[var(--text-color-secondary)]">Profesión *</label>
                  <InputText v-model="row.profesion" placeholder="Ej: Fisioterapeuta" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Universidad</label>
                  <InputText v-model="row.universidad" placeholder="Ej: Universidad Nacional" size="small" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs text-[var(--text-color-secondary)]">Fecha de graduación</label>
                  <InputText v-model="row.fechaGraduacion" type="date" size="small" />
                </div>
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs text-[var(--text-color-secondary)]">Diploma</label>
                  <div v-if="row.diplomaUrl" class="flex items-center gap-2 px-3 py-2 border border-[var(--surface-border)] rounded-md bg-[var(--surface-ground)]">
                    <i class="pi pi-paperclip text-violet-500" />
                    <span class="flex-1 truncate text-sm">{{ row.diplomaFilename || row.diplomaUrl }}</span>
                    <Button icon="pi pi-times" size="small" severity="danger" text rounded
                      @click="row.diplomaUrl = ''; row.diplomaFilename = ''; row.diplomaFile = null" />
                  </div>
                  <label
                    v-else
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors w-fit"
                  >
                    <i class="pi pi-upload text-violet-500" />
                    <span>{{ row.diplomaUploading ? 'Subiendo…' : 'Adjuntar diploma' }}</span>
                    <input
                      type="file"
                      class="hidden"
                      accept="application/pdf,image/*"
                      :disabled="row.diplomaUploading"
                      :data-testid="`educacion-diploma-input-new-${i}`"
                      @change="(e) => onEducacionDiplomaChange(e, i)"
                    />
                  </label>
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
      <!-- Certificados genéricos — shared editor used by wizard + edit page -->
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
              <i class="pi pi-shield text-violet-500" /> Certificados del Empleado
            </h3>
          </div>
        </template>
        <template #content>
          <EmpleadoCertificadosEditor v-model:certificados="certificados" />
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

  </div>
</template>
