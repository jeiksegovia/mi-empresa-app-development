<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { uploadFile, downloadFile } = useFileUpload()

const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

const tabs = [
  { label: 'Datos Personales', icon: 'pi pi-user' },
  { label: 'Núcleo Familiar', icon: 'pi pi-users' },
  { label: 'Info. Laboral', icon: 'pi pi-briefcase' },
  { label: 'Educación', icon: 'pi pi-book' },
  { label: 'Certificados', icon: 'pi pi-file' },
]

// ─── Tab 1: Datos Personales ─────────────────────────────────────────────────
const saving1 = ref(false)
const form = reactive({
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
})
const formErrors = reactive<Record<string, string>>({})

function validateForm() {
  Object.keys(formErrors).forEach((k) => delete formErrors[k])
  if (!form.nombre.trim()) formErrors.nombre = 'Requerido'
  if (!form.apellido.trim()) formErrors.apellido = 'Requerido'
  if (!form.numeroDocumento.trim()) formErrors.numeroDocumento = 'Requerido'
  if (!form.genero) formErrors.genero = 'Requerido'
  if (!form.fechaNacimiento) formErrors.fechaNacimiento = 'Requerido'
  return Object.keys(formErrors).length === 0
}

async function savePersonal() {
  if (!validateForm()) return
  saving1.value = true
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
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Datos personales actualizados', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving1.value = false
  }
}

// ─── Tab 2: Núcleo Familiar ──────────────────────────────────────────────────
const saving2 = ref(false)
interface FamilyMemberForm {
  nombre: string; apellido: string; tipoDocumento: 'REGISTRO_CIVIL' | 'TI' | 'CC' | 'CE'
  numeroDocumento: string; fechaNacimiento: string; genero: string; parentesco: string; telefono: string
}
const familyMembers = ref<FamilyMemberForm[]>([])

function addFamilyMember() {
  familyMembers.value.push({ nombre: '', apellido: '', tipoDocumento: 'CC', numeroDocumento: '', fechaNacimiento: '', genero: '', parentesco: '', telefono: '' })
}
function removeFamilyMember(i: number) { familyMembers.value.splice(i, 1) }

async function saveNucleo() {
  saving2.value = true
  try {
    const valid = familyMembers.value.filter(f => f.nombre.trim() && f.apellido.trim() && f.fechaNacimiento && f.genero && f.parentesco)
    await apiFetch(`/employees/${route.params.id}/nucleo-familiar`, {
      method: 'PUT',
      body: { nucleoFamiliar: valid.map(f => ({
        nombre: f.nombre.trim(), apellido: f.apellido.trim(), tipoDocumento: f.tipoDocumento,
        numeroDocumento: f.numeroDocumento.trim() || undefined, fechaNacimiento: f.fechaNacimiento,
        genero: f.genero, parentesco: f.parentesco, telefono: f.telefono.trim() || undefined,
      })) },
    })
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Núcleo familiar actualizado', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving2.value = false
  }
}

// ─── Tab 3: Info. Laboral ────────────────────────────────────────────────────
const saving3 = ref(false)
const hojaVidaUrl = ref<string>('')
const hojaVidaUploading = ref(false)
const hojaVidaFileInputRef = ref<HTMLInputElement | null>(null)
async function onHojaVidaChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  hojaVidaUploading.value = true
  try {
    const key = await uploadFile(input.files[0], 'hojas-vida')
    if (key) {
      hojaVidaUrl.value = key
      toast.add({
        severity: 'success',
        summary: 'Hoja de vida subida',
        detail: 'El archivo se subió correctamente. Guarda los cambios para aplicar.',
        life: 3000,
      })
    }
  } finally {
    hojaVidaUploading.value = false
    if (hojaVidaFileInputRef.value) hojaVidaFileInputRef.value.value = ''
  }
}
async function saveHojaVida() {
  try {
    await apiFetch(`/employees/${route.params.id}`, {
      method: 'PUT',
      body: { hojaVidaUrl: hojaVidaUrl.value || null },
    })
    toast.add({
      severity: 'success',
      summary: 'Hoja de vida guardada',
      detail: 'Hoja de vida actualizada.',
      life: 3000,
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'Error al guardar',
      life: 5000,
    })
  }
}
async function downloadHojaVida() {
  if (!hojaVidaUrl.value) return
  await downloadFile(hojaVidaUrl.value)
}

interface CargoForm { nombreCargo: string; ubicacion: string; fechaIngreso: string; fechaTerminacion: string; salario: number | null }
interface ContactoForm { nombre: string; apellido: string; telefono: string; parentesco: string }
interface ExperienciaForm { empresa: string; telefonoEmpresa: string; cargo: string; sector: string; periodoInicio: string; periodoFin: string; funcionesLogros: string }

// Contrato model (in editar Info Laboral)
type ContratoTipo = 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO'
interface Contrato {
  id: number
  tipoContrato: ContratoTipo
  fechaInicio: string
  fechaFin: string | null
  archivoUrl: string | null
  activo: boolean
  createdAt: string
}

const contratos = ref<Contrato[]>([])
const contratosLoading = ref(false)
const contratoDialogOpen = ref(false)
const contratoEditingId = ref<number | null>(null)
const contratoSaving = ref(false)
const contratoUploadingArchivo = ref(false)
const contratoArchivoInputRef = ref<HTMLInputElement | null>(null)

const contratoForm = reactive({
  tipoContrato: 'OPS' as ContratoTipo,
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '' as string,
  archivoUrl: '' as string,
  activo: true,
})

const contratoTipoOptions: Array<{ label: string; value: ContratoTipo }> = [
  { label: 'OPS (Prestación de servicios)', value: 'OPS' },
  { label: 'Obra o labor', value: 'OBRA_O_LABOR' },
  { label: 'Término fijo', value: 'TERMINO_FIJO' },
  { label: 'Término indefinido', value: 'TERMINO_INDEFINIDO' },
]

function resetContratoForm() {
  contratoForm.tipoContrato = 'OPS'
  contratoForm.fechaInicio = new Date().toISOString().slice(0, 10)
  contratoForm.fechaFin = ''
  contratoForm.archivoUrl = ''
  contratoForm.activo = true
  contratoEditingId.value = null
  // W9: clear the underlying HTML file input so picking a file for one
  // contrato row, then cancelling & re-opening for a different contrato,
  // does not silently retain the previous file in the input element.
  if (contratoArchivoInputRef.value) contratoArchivoInputRef.value.value = ''
}

async function fetchContratos() {
  contratosLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: Contrato[] }>(
      `/nomina/employees/${route.params.id}/contratos`
    )
    contratos.value = res.data ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
  } finally {
    contratosLoading.value = false
  }
}

function openNewContrato() {
  resetContratoForm()
  contratoDialogOpen.value = true
}

function openEditContrato(c: Contrato) {
  contratoEditingId.value = c.id
  contratoForm.tipoContrato = c.tipoContrato
  contratoForm.fechaInicio = c.fechaInicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  contratoForm.fechaFin = c.fechaFin?.slice(0, 10) ?? ''
  contratoForm.archivoUrl = c.archivoUrl ?? ''
  contratoForm.activo = c.activo
  contratoDialogOpen.value = true
}

async function saveContrato() {
  // Inline validation: TERMINO_INDEFINIDO can omit fechaFin; others require it.
  if (contratoForm.tipoContrato !== 'TERMINO_INDEFINIDO' && !contratoForm.fechaFin) {
    toast.add({
      severity: 'warn',
      summary: 'Fecha fin requerida',
      detail: 'Solo los contratos a término indefinido pueden omitir la fecha de fin.',
      life: 4000,
    })
    return
  }
  contratoSaving.value = true
  try {
    const payload: Record<string, unknown> = {
      tipoContrato: contratoForm.tipoContrato,
      fechaInicio: contratoForm.fechaInicio,
      activo: contratoForm.activo,
    }
    if (contratoForm.tipoContrato !== 'TERMINO_INDEFINIDO' && contratoForm.fechaFin) {
      payload.fechaFin = contratoForm.fechaFin
    }
    if (contratoForm.archivoUrl) payload.archivoUrl = contratoForm.archivoUrl

    if (contratoEditingId.value) {
      await apiFetch(`/nomina/employees/${route.params.id}/contratos/${contratoEditingId.value}`, {
        method: 'PUT',
        body: payload,
      })
    } else {
      await apiFetch(`/nomina/employees/${route.params.id}/contratos`, {
        method: 'POST',
        body: payload,
      })
    }
    contratoDialogOpen.value = false
    resetContratoForm()
    await fetchContratos()
    toast.add({
      severity: 'success',
      summary: 'Contrato guardado',
      detail: 'Cambios aplicados.',
      life: 3000,
    })
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'No se pudo guardar el contrato',
      life: 5000,
    })
  } finally {
    contratoSaving.value = false
  }
}

async function deleteContrato(cid: number) {
  try {
    await apiFetch(`/nomina/employees/${route.params.id}/contratos/${cid}`, { method: 'DELETE' })
    await fetchContratos()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || 'No se pudo eliminar el contrato',
      life: 5000,
    })
  }
}

async function setContratoActivo(c: Contrato) {
  if (c.activo) return
  await saveContratoActivo(c.id, true)
}

async function unsetContratoActivo(c: Contrato) {
  if (!c.activo) return
  await saveContratoActivo(c.id, false)
}

async function saveContratoActivo(cid: number, activo: boolean) {
  try {
    await apiFetch(`/nomina/employees/${route.params.id}/contratos/${cid}`, {
      method: 'PUT',
      body: {
        tipoContrato: contratos.value.find((x) => x.id === cid)?.tipoContrato,
        fechaInicio: contratos.value.find((x) => x.id === cid)?.fechaInicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        fechaFin: contratos.value.find((x) => x.id === cid)?.fechaFin?.slice(0, 10) ?? undefined,
        archivoUrl: contratos.value.find((x) => x.id === cid)?.archivoUrl ?? undefined,
        activo,
      },
    })
    await fetchContratos()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || 'No se pudo cambiar el estado del contrato',
      life: 5000,
    })
  }
}

async function onContratoArchivoChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  contratoUploadingArchivo.value = true
  try {
    const key = await uploadFile(input.files[0], 'contratos')
    if (key) {
      contratoForm.archivoUrl = key
    }
  } finally {
    contratoUploadingArchivo.value = false
    if (contratoArchivoInputRef.value) contratoArchivoInputRef.value.value = ''
  }
}

async function downloadContratoArchivo(c: Contrato) {
  if (!c.archivoUrl) return
  await downloadFile(c.archivoUrl)
}

function formatShortDate(dateStr: string | null | undefined): string {
  return formatDate(dateStr, 'short')
}

const cargos = ref<CargoForm[]>([])
const contactosEmergencia = ref<ContactoForm[]>([])
const experiencias = ref<ExperienciaForm[]>([])

function addCargo() { cargos.value.push({ nombreCargo: '', ubicacion: '', fechaIngreso: '', fechaTerminacion: '', salario: null }) }
function removeCargo(i: number) { cargos.value.splice(i, 1) }
function addContacto() { contactosEmergencia.value.push({ nombre: '', apellido: '', telefono: '', parentesco: '' }) }
function removeContacto(i: number) { contactosEmergencia.value.splice(i, 1) }
function addExperiencia() { experiencias.value.push({ empresa: '', telefonoEmpresa: '', cargo: '', sector: '', periodoInicio: '', periodoFin: '', funcionesLogros: '' }) }
function removeExperiencia(i: number) { experiencias.value.splice(i, 1) }

async function saveLaboral() {
  saving3.value = true
  try {
    const validCargos = cargos.value.filter(c => c.nombreCargo.trim() && c.ubicacion.trim() && c.fechaIngreso)
    const validContacts = contactosEmergencia.value.filter(c => c.nombre.trim() && c.apellido.trim() && c.telefono.trim() && c.parentesco)
    const validExp = experiencias.value.filter(e => e.empresa.trim() && e.cargo.trim() && e.periodoInicio)

    await Promise.all([
      apiFetch(`/employees/${route.params.id}/cargos`, { method: 'PUT', body: { cargos: validCargos.map(c => ({ nombreCargo: c.nombreCargo.trim(), ubicacion: c.ubicacion.trim(), fechaIngreso: c.fechaIngreso, fechaTerminacion: c.fechaTerminacion || undefined, salario: c.salario != null ? c.salario : undefined })) } }),
      apiFetch(`/employees/${route.params.id}/contactos-emergencia`, { method: 'PUT', body: { contactosEmergencia: validContacts.map(c => ({ nombre: c.nombre.trim(), apellido: c.apellido.trim(), telefono: c.telefono.trim(), parentesco: c.parentesco })) } }),
      apiFetch(`/employees/${route.params.id}/experiencias-laborales`, { method: 'PUT', body: { experienciasLaborales: validExp.map(e => ({ empresa: e.empresa.trim(), telefonoEmpresa: e.telefonoEmpresa.trim() || undefined, cargo: e.cargo.trim(), sector: e.sector.trim() || undefined, periodoInicio: e.periodoInicio, periodoFin: e.periodoFin || undefined, funcionesLogros: e.funcionesLogros.trim() || undefined })) } }),
    ])
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Info. laboral actualizada', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving3.value = false
  }
}

// ─── Tab 4: Educación ────────────────────────────────────────────────────────
const saving4 = ref(false)
interface EducacionForm { institucion: string; nivelEscritura: string; nivelHabla: string; capacidadTraducir: boolean }
interface VehiculoForm { tipoVehiculo: string; placas: string; tipoLicencia: string; numeroLicencia: string }

const educaciones = ref<EducacionForm[]>([])
const vehiculos = ref<VehiculoForm[]>([])

function addEducacion() { educaciones.value.push({ institucion: '', nivelEscritura: '', nivelHabla: '', capacidadTraducir: false }) }
function removeEducacion(i: number) { educaciones.value.splice(i, 1) }
function addVehiculo() { vehiculos.value.push({ tipoVehiculo: '', placas: '', tipoLicencia: '', numeroLicencia: '' }) }
function removeVehiculo(i: number) { vehiculos.value.splice(i, 1) }

async function saveEducacion() {
  saving4.value = true
  try {
    const validEdu = educaciones.value.filter(e => e.institucion.trim() && e.nivelEscritura.trim() && e.nivelHabla.trim())
    const validVeh = vehiculos.value.filter(v => v.tipoVehiculo.trim() && v.placas.trim() && v.tipoLicencia.trim() && v.numeroLicencia.trim())

    await Promise.all([
      apiFetch(`/employees/${route.params.id}/educacion-idiomas`, { method: 'PUT', body: { educacionIdiomas: validEdu.map(e => ({ institucion: e.institucion.trim(), nivelEscritura: e.nivelEscritura.trim(), nivelHabla: e.nivelHabla.trim(), capacidadTraducir: e.capacidadTraducir })) } }),
      apiFetch(`/employees/${route.params.id}/vehiculos`, { method: 'PUT', body: { vehiculos: validVeh.map(v => ({ tipoVehiculo: v.tipoVehiculo.trim(), placas: v.placas.trim(), tipoLicencia: v.tipoLicencia.trim(), numeroLicencia: v.numeroLicencia.trim() })) } }),
    ])
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Educación y vehículos actualizados', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving4.value = false
  }
}

// ─── Tab 5: Certificados ─────────────────────────────────────────────────────
const saving5 = ref(false)
interface CertificadoEmpleadoInput {
  tipo: '' | 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
  nombre?: string
  fechaExpedicion: string
  fechaVencimiento: string
}
const certificados = ref<CertificadoEmpleadoInput[]>([])
const migracion = reactive({ enabled: false, numeroPasaporte: '', pasaporteExpedicion: '', pasaporteVencimiento: '', numeroVisa: '', visaExpedicion: '', visaVencimiento: '' })

async function saveCertificados() {
  saving5.value = true
  try {
    const validCertificados = certificados.value.filter(
      (c) => c.tipo && c.fechaExpedicion && c.fechaVencimiento
    )
    const certPayload: Record<string, unknown> = {
      certificados: validCertificados.map((c) => ({
        tipo: c.tipo,
        nombre: c.tipo === 'OTRO' ? c.nombre?.trim() || undefined : undefined,
        fechaExpedicion: c.fechaExpedicion,
        fechaVencimiento: c.fechaVencimiento,
      })),
    }

    const promises = []
    if (Object.keys(certPayload).length > 0) {
      promises.push(apiFetch(`/employees/${route.params.id}/certificados`, { method: 'PUT', body: certPayload }))
    }
    if (migracion.enabled) {
      promises.push(apiFetch(`/employees/${route.params.id}/datos-migracion`, { method: 'PUT', body: { datosMigracion: { numeroPasaporte: migracion.numeroPasaporte || undefined, pasaporteExpedicion: migracion.pasaporteExpedicion || undefined, pasaporteVencimiento: migracion.pasaporteVencimiento || undefined, numeroVisa: migracion.numeroVisa || undefined, visaExpedicion: migracion.visaExpedicion || undefined, visaVencimiento: migracion.visaVencimiento || undefined } } }))
    }
    if (promises.length > 0) await Promise.all(promises)
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Certificados y migración actualizados', life: 3000 })
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving5.value = false
  }
}

// ─── Load employee data ───────────────────────────────────────────────────────
async function fetchEmployee() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: any }>(`/employees/${route.params.id}`)
    const emp = res.data

    // Tab 1
    form.nombre = emp.nombre ?? ''
    form.apellido = emp.apellido ?? ''
    form.tipoDocumento = emp.tipoDocumento ?? 'CC'
    form.numeroDocumento = emp.numeroDocumento ?? ''
    form.genero = emp.genero ?? ''
    form.fechaNacimiento = emp.fechaNacimiento ? new Date(emp.fechaNacimiento).toISOString().split('T')[0] : ''
    form.estadoCivil = emp.estadoCivil ?? ''
    form.tipoVivienda = emp.tipoVivienda ?? ''
    form.estratoSocioeconomico = emp.estratoSocioeconomico != null ? String(emp.estratoSocioeconomico) : ''
    form.direccion = emp.direccion ?? ''
    form.telefono = emp.telefono ?? ''
    form.email = emp.email ?? ''
    form.permisoTrabajo = emp.permisoTrabajo ?? false
    form.estado = emp.estado ?? 'ACTIVO'

    // Tab 2
    familyMembers.value = (emp.nucleoFamiliar ?? []).map((nf: any) => ({
      nombre: nf.nombre, apellido: nf.apellido, tipoDocumento: nf.tipoDocumento,
      numeroDocumento: nf.numeroDocumento ?? '', fechaNacimiento: nf.fechaNacimiento ? new Date(nf.fechaNacimiento).toISOString().split('T')[0] : '',
      genero: nf.genero, parentesco: nf.parentesco, telefono: nf.telefono ?? '',
    }))

    // Tab 3
    hojaVidaUrl.value = emp.hojaVidaUrl ?? ''
    // contratos are fetched separately (different service / route)
    await fetchContratos()
    cargos.value = (emp.cargos ?? []).map((c: any) => ({
      nombreCargo: c.nombreCargo, ubicacion: c.ubicacion,
      fechaIngreso: c.fechaIngreso ? new Date(c.fechaIngreso).toISOString().split('T')[0] : '',
      fechaTerminacion: c.fechaTerminacion ? new Date(c.fechaTerminacion).toISOString().split('T')[0] : '',
      salario: c.salario != null ? Number(c.salario) : null,
    }))
    contactosEmergencia.value = (emp.contactosEmergencia ?? []).map((c: any) => ({
      nombre: c.nombre, apellido: c.apellido, telefono: c.telefono, parentesco: c.parentesco,
    }))
    experiencias.value = (emp.experienciasLaborales ?? []).map((e: any) => ({
      empresa: e.empresa, telefonoEmpresa: e.telefonoEmpresa ?? '', cargo: e.cargo, sector: e.sector ?? '',
      periodoInicio: e.periodoInicio ? new Date(e.periodoInicio).toISOString().split('T')[0] : '',
      periodoFin: e.periodoFin ? new Date(e.periodoFin).toISOString().split('T')[0] : '',
      funcionesLogros: e.funcionesLogros ?? '',
    }))

    // Tab 4
    educaciones.value = (emp.educacionIdiomas ?? []).map((e: any) => ({
      institucion: e.institucion, nivelEscritura: e.nivelEscritura, nivelHabla: e.nivelHabla, capacidadTraducir: e.capacidadTraducir,
    }))
    vehiculos.value = (emp.vehiculos ?? []).map((v: any) => ({
      tipoVehiculo: v.tipoVehiculo, placas: v.placas, tipoLicencia: v.tipoLicencia, numeroLicencia: v.numeroLicencia,
    }))

    // Tab 5
    certificados.value = (emp.certificados ?? []).map((c: any) => ({
      tipo: c.tipo,
      nombre: c.nombre ?? '',
      fechaExpedicion: c.fechaExpedicion ? new Date(c.fechaExpedicion).toISOString().split('T')[0] : '',
      fechaVencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento).toISOString().split('T')[0] : '',
    }))
    if (emp.datosMigracion) {
      migracion.enabled = true
      migracion.numeroPasaporte = emp.datosMigracion.numeroPasaporte ?? ''
      migracion.pasaporteExpedicion = emp.datosMigracion.pasaporteExpedicion ? new Date(emp.datosMigracion.pasaporteExpedicion).toISOString().split('T')[0] : ''
      migracion.pasaporteVencimiento = emp.datosMigracion.pasaporteVencimiento ? new Date(emp.datosMigracion.pasaporteVencimiento).toISOString().split('T')[0] : ''
      migracion.numeroVisa = emp.datosMigracion.numeroVisa ?? ''
      migracion.visaExpedicion = emp.datosMigracion.visaExpedicion ? new Date(emp.datosMigracion.visaExpedicion).toISOString().split('T')[0] : ''
      migracion.visaVencimiento = emp.datosMigracion.visaVencimiento ? new Date(emp.datosMigracion.visaVencimiento).toISOString().split('T')[0] : ''
    }
  } catch (e: any) {
    error.value = e?.response?.status === 404 ? 'Empleado no encontrado' : 'Error al cargar los datos del empleado'
  } finally {
    loading.value = false
  }
}

// Option lists
const tiposDoc = [{ label: 'Cédula de Ciudadanía (CC)', value: 'CC' }, { label: 'Cédula de Extranjería (CE)', value: 'CE' }, { label: 'Pasaporte', value: 'PASAPORTE' }]
const generos = [{ label: 'Masculino', value: 'MASCULINO' }, { label: 'Femenino', value: 'FEMENINO' }, { label: 'Otro', value: 'OTRO' }]
const estadosCiviles = [{ label: 'Soltero/a', value: 'SOLTERO' }, { label: 'Casado/a', value: 'CASADO' }, { label: 'Unión libre', value: 'UNION_LIBRE' }, { label: 'Divorciado/a', value: 'DIVORCIADO' }, { label: 'Viudo/a', value: 'VIUDO' }]
const tiposVivienda = [{ label: 'Propia', value: 'PROPIA' }, { label: 'Arrendada', value: 'ARRENDADA' }, { label: 'Familiar', value: 'FAMILIAR' }]
const tiposDocFamiliar = [{ label: 'Registro Civil', value: 'REGISTRO_CIVIL' }, { label: 'T.I.', value: 'TI' }, { label: 'C.C.', value: 'CC' }, { label: 'C.E.', value: 'CE' }]

const employeeFullName = computed(() => `${form.nombre} ${form.apellido}`.trim() || 'Empleado')

onMounted(fetchEmployee)
</script>

<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-16">
      <i class="pi pi-spin pi-spinner text-4xl text-violet-500" />
    </div>

    <div v-else-if="error" class="text-center py-16">
      <i class="pi pi-exclamation-triangle text-4xl text-orange-400 mb-4 block" />
      <p class="text-[var(--text-color-secondary)]">{{ error }}</p>
      <Button label="Volver" icon="pi pi-arrow-left" class="mt-4" severity="secondary"
        @click="navigateTo(`/empleados/${route.params.id}`)" />
    </div>

    <template v-else>
      <AppPageHeader :title="`Editar: ${employeeFullName}`" subtitle="Modificar datos del empleado">
        <template #actions>
          <Button label="Ver Perfil" icon="pi pi-eye" severity="secondary" outlined
            @click="navigateTo(`/empleados/${route.params.id}`)" />
        </template>
      </AppPageHeader>

      <!-- Tab Navigation -->
      <div class="mb-6 flex gap-1 border-b border-[var(--surface-border)] overflow-x-auto">
        <button
          v-for="(tab, i) in tabs" :key="i"
          :class="['flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
            activeTab === i ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-[var(--text-color-secondary)] hover:text-[var(--text-color)]']"
          @click="activeTab = i"
        >
          <i :class="tab.icon" />{{ tab.label }}
        </button>
      </div>

      <!-- TAB 1: Datos Personales -->
      <div v-show="activeTab === 0">
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
                <InputText v-model="form.nombre" placeholder="Nombres" :class="{ 'p-invalid': formErrors.nombre }" />
                <small v-if="formErrors.nombre" class="text-red-500">{{ formErrors.nombre }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Apellido <span class="text-red-500">*</span></label>
                <InputText v-model="form.apellido" placeholder="Apellidos" :class="{ 'p-invalid': formErrors.apellido }" />
                <small v-if="formErrors.apellido" class="text-red-500">{{ formErrors.apellido }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Tipo Documento</label>
                <Select v-model="form.tipoDocumento" :options="tiposDoc" option-label="label" option-value="value" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Número Documento <span class="text-red-500">*</span></label>
                <InputText v-model="form.numeroDocumento" :class="{ 'p-invalid': formErrors.numeroDocumento }" />
                <small v-if="formErrors.numeroDocumento" class="text-red-500">{{ formErrors.numeroDocumento }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Género <span class="text-red-500">*</span></label>
                <Select v-model="form.genero" :options="generos" option-label="label" option-value="value" placeholder="Seleccionar" :class="{ 'p-invalid': formErrors.genero }" />
                <small v-if="formErrors.genero" class="text-red-500">{{ formErrors.genero }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Fecha de Nacimiento <span class="text-red-500">*</span></label>
                <InputText v-model="form.fechaNacimiento" type="date" :class="{ 'p-invalid': formErrors.fechaNacimiento }" />
                <small v-if="formErrors.fechaNacimiento" class="text-red-500">{{ formErrors.fechaNacimiento }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Estado Civil</label>
                <Select v-model="form.estadoCivil" :options="estadosCiviles" option-label="label" option-value="value" placeholder="Seleccionar" show-clear />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Tipo Vivienda</label>
                <Select v-model="form.tipoVivienda" :options="tiposVivienda" option-label="label" option-value="value" placeholder="Seleccionar" show-clear />
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
                <InputText v-model="form.telefono" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Email</label>
                <InputText v-model="form.email" type="email" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Estado</label>
                <Select v-model="form.estado" :options="[{ label: 'Activo', value: 'ACTIVO' }, { label: 'Inactivo', value: 'INACTIVO' }]" option-label="label" option-value="value" />
              </div>
              <div class="flex items-center gap-2 pt-2 sm:col-span-2 lg:col-span-3">
                <Checkbox v-model="form.permisoTrabajo" :binary="true" input-id="permisoTrabajo" />
                <label for="permisoTrabajo" class="text-sm">Tiene permiso de trabajo</label>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Guardar Datos Personales" icon="pi pi-check" severity="success" :loading="saving1" @click="savePersonal" />
            </div>
          </template>
        </Card>
      </div>

      <!-- TAB 2: Núcleo Familiar -->
      <div v-show="activeTab === 1">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-users text-violet-500" /> Núcleo Familiar
              </h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addFamilyMember" />
            </div>
          </template>
          <template #content>
            <div v-if="familyMembers.length === 0" class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay miembros registrados. Haz clic en "Agregar" para añadir.
            </div>
            <div v-for="(member, i) in familyMembers" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between items-start mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Miembro {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeFamilyMember(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nombre *</label><InputText v-model="member.nombre" placeholder="Nombre" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Apellido *</label><InputText v-model="member.apellido" placeholder="Apellido" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Tipo Documento</label><Select v-model="member.tipoDocumento" :options="tiposDocFamiliar" option-label="label" option-value="value" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Número Documento</label><InputText v-model="member.numeroDocumento" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Fecha Nacimiento *</label><InputText v-model="member.fechaNacimiento" type="date" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Género *</label><Select v-model="member.genero" :options="generos" option-label="label" option-value="value" placeholder="Seleccionar" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Parentesco *</label><InputText v-model="member.parentesco" placeholder="ej: Hijo/a, Cónyuge" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Teléfono</label><InputText v-model="member.telefono" /></div>
              </div>
            </div>
            <div class="mt-4 flex justify-end">
              <Button label="Guardar Núcleo Familiar" icon="pi pi-check" severity="success" :loading="saving2" @click="saveNucleo" />
            </div>
          </template>
        </Card>
      </div>

      <!-- TAB 3: Info. Laboral -->
      <div v-show="activeTab === 2" class="space-y-4">
        <!-- Cargos -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-briefcase text-violet-500" /> Cargos</h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addCargo" />
            </div>
          </template>
          <template #content>
            <div v-if="cargos.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">Sin cargos registrados</div>
            <div v-for="(cargo, i) in cargos" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between items-start mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">Cargo {{ i + 1 }}</span>
                <Button icon="pi pi-trash" size="small" severity="danger" text @click="removeCargo(i)" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nombre del Cargo *</label><InputText v-model="cargo.nombreCargo" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Ubicación *</label><InputText v-model="cargo.ubicacion" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Fecha Ingreso *</label><InputText v-model="cargo.fechaIngreso" type="date" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Fecha Terminación</label><InputText v-model="cargo.fechaTerminacion" type="date" /></div>
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs font-medium">Salario (opcional)</label>
                  <InputNumber
                    v-model="cargo.salario"
                    mode="decimal"
                    :min-fraction-digits="0"
                    :max-fraction-digits="2"
                    placeholder="0.00"
                    input-class="w-full"
                  />
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    Se extraerá de nómina cuando el módulo esté activo
                  </p>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Hoja de vida -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-file-pdf text-violet-500" /> Hoja de Vida
              </h3>
            </div>
          </template>
          <template #content>
            <div class="space-y-3">
              <div v-if="hojaVidaUrl" class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]">
                <i class="pi pi-file text-violet-500 text-xl" />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">{{ filenameFromKey(hojaVidaUrl) }}</p>
                </div>
                <Button
                  icon="pi pi-download"
                  size="small"
                  severity="info"
                  outlined
                  label="Descargar"
                  data-testid="hoja-vida-download"
                  @click="downloadHojaVida"
                />
                <Button
                  icon="pi pi-times"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Quitar hoja de vida'"
                  @click="hojaVidaUrl = ''"
                />
              </div>
              <div v-else class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-6 text-center">
                <i class="pi pi-upload text-3xl text-[var(--text-color-secondary)] mb-2 block" />
                <p class="text-sm text-[var(--text-color-secondary)] mb-2">
                  Subir hoja de vida (PDF / imagen)
                </p>
                <input
                  ref="hojaVidaFileInputRef"
                  type="file"
                  accept="application/pdf,image/*"
                  data-testid="hoja-vida-input"
                  :disabled="hojaVidaUploading"
                  @change="onHojaVidaChange"
                />
                <i v-if="hojaVidaUploading" class="pi pi-spin pi-spinner text-violet-500 ml-2" />
              </div>
              <div class="flex justify-end">
                <Button
                  label="Guardar Hoja de Vida"
                  icon="pi pi-check"
                  severity="success"
                  :disabled="hojaVidaUploading"
                  data-testid="hoja-vida-save"
                  @click="saveHojaVida"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Contrato card (Info Laboral tab) -->
        <Card data-testid="contrato-card">
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-briefcase text-violet-500" /> Contrato
              </h3>
              <Button
                v-if="authStore.isAdmin"
                label="Agregar contrato"
                icon="pi pi-plus"
                size="small"
                severity="secondary"
                outlined
                data-testid="contrato-add-btn"
                @click="openNewContrato"
              />
            </div>
          </template>
          <template #content>
            <div v-if="contratosLoading" class="flex items-center justify-center py-4">
              <i class="pi pi-spin pi-spinner text-2xl text-violet-500" />
            </div>
            <div v-else-if="contratos.length === 0" class="text-center py-4 text-sm text-[var(--text-color-secondary)]">
              Sin contratos registrados.
            </div>
            <div v-else class="space-y-3" data-testid="contrato-list">
              <div
                v-for="c in contratos"
                :key="c.id"
                class="border border-[var(--surface-border)] rounded-lg p-4 space-y-2"
                :class="c.activo ? 'border-violet-400 bg-violet-50/30 dark:bg-violet-900/10' : ''"
                data-testid="contrato-row"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-sm">{{ c.tipoContrato }}</span>
                      <Tag v-if="c.activo" value="Activo" severity="success" />
                      <Tag v-else value="Inactivo" severity="secondary" />
                    </div>
                    <p class="text-xs text-[var(--text-color-secondary)]">
                      Desde {{ formatShortDate(c.fechaInicio) }}
                      <span v-if="c.fechaFin"> · Hasta {{ formatShortDate(c.fechaFin) }}</span>
                      <span v-else class="italic">(sin fecha de fin)</span>
                    </p>
                    <p v-if="c.archivoUrl" class="text-xs text-[var(--text-color-secondary)] truncate">
                      <i class="pi pi-paperclip" /> {{ filenameFromKey(c.archivoUrl) }}
                    </p>
                  </div>
                  <div v-if="authStore.isAdmin" class="flex items-center gap-1">
                    <Button
                      v-if="!c.activo"
                      icon="pi pi-check"
                      size="small"
                      severity="success"
                      text
                      rounded
                      v-tooltip.top="'Marcar como activo'"
                      :data-testid="`contrato-activate-${c.id}`"
                      @click="setContratoActivo(c)"
                    />
                    <Button
                      v-else
                      icon="pi pi-pause"
                      size="small"
                      severity="secondary"
                      text
                      rounded
                      v-tooltip.top="'Desactivar'"
                      @click="unsetContratoActivo(c)"
                    />
                    <Button
                      icon="pi pi-download"
                      size="small"
                      severity="info"
                      text
                      rounded
                      v-tooltip.top="'Descargar archivo'"
                      @click="downloadContratoArchivo(c)"
                    />
                    <Button
                      icon="pi pi-pencil"
                      size="small"
                      severity="secondary"
                      text
                      rounded
                      v-tooltip.top="'Editar'"
                      :data-testid="`contrato-edit-${c.id}`"
                      @click="openEditContrato(c)"
                    />
                    <Button
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      text
                      rounded
                      v-tooltip.top="'Eliminar'"
                      @click="deleteContrato(c.id)"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Dialog
          v-model:visible="contratoDialogOpen"
          :header="contratoEditingId ? 'Editar contrato' : 'Nuevo contrato'"
          :modal="true"
          :style="{ width: '36rem' }"
        >
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">Tipo de contrato *</label>
              <Select
                v-model="contratoForm.tipoContrato"
                :options="contratoTipoOptions"
                option-label="label"
                option-value="value"
                placeholder="Seleccionar tipo"
                class="w-full"
                data-testid="contrato-tipo"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Fecha de inicio *</label>
                <input
                  type="date"
                  v-model="contratoForm.fechaInicio"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm"
                  data-testid="contrato-fecha-inicio"
                />
              </div>
              <div v-if="contratoForm.tipoContrato !== 'TERMINO_INDEFINIDO'">
                <label class="block text-sm font-medium mb-1">Fecha de fin *</label>
                <input
                  type="date"
                  v-model="contratoForm.fechaFin"
                  class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm"
                  data-testid="contrato-fecha-fin"
                />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox v-model="contratoForm.activo" :binary="true" input-id="contrato-activo" />
              <label for="contrato-activo" class="text-sm">Contrato activo</label>
              <span class="text-xs text-[var(--text-color-secondary)] ml-2">(sólo uno activo por empleado)</span>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Archivo del contrato</label>
              <div v-if="contratoForm.archivoUrl" class="flex items-center gap-2 text-sm mb-2">
                <i class="pi pi-paperclip text-violet-500" />
                <span class="flex-1 truncate">{{ filenameFromKey(contratoForm.archivoUrl) }}</span>
                <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="contratoForm.archivoUrl = ''" />
              </div>
              <input
                ref="contratoArchivoInputRef"
                type="file"
                :disabled="contratoUploadingArchivo"
                @change="onContratoArchivoChange"
                data-testid="contrato-archivo-input"
              />
              <i v-if="contratoUploadingArchivo" class="pi pi-spin pi-spinner text-violet-500 ml-2" />
            </div>
          </div>
          <template #footer>
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              @click="contratoDialogOpen = false"
            />
            <Button
              label="Guardar"
              icon="pi pi-check"
              :loading="contratoSaving"
              data-testid="contrato-save"
              @click="saveContrato"
            />
          </template>
        </Dialog>

        <!-- Contactos Emergencia -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-phone text-violet-500" /> Contactos de Emergencia</h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addContacto" />
            </div>
          </template>
          <template #content>
            <div v-if="contactosEmergencia.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">Sin contactos registrados</div>
            <div v-for="(c, i) in contactosEmergencia" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between mb-3"><span class="text-sm font-medium text-[var(--text-color-secondary)]">Contacto {{ i + 1 }}</span><Button icon="pi pi-trash" size="small" severity="danger" text @click="removeContacto(i)" /></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nombre *</label><InputText v-model="c.nombre" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Apellido *</label><InputText v-model="c.apellido" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Teléfono *</label><InputText v-model="c.telefono" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Parentesco *</label><InputText v-model="c.parentesco" /></div>
              </div>
            </div>
          </template>
        </Card>
        <!-- Experiencias Laborales -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-history text-violet-500" /> Experiencias Laborales</h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addExperiencia" />
            </div>
          </template>
          <template #content>
            <div v-if="experiencias.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">Sin experiencias registradas</div>
            <div v-for="(exp, i) in experiencias" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between mb-3"><span class="text-sm font-medium text-[var(--text-color-secondary)]">Experiencia {{ i + 1 }}</span><Button icon="pi pi-trash" size="small" severity="danger" text @click="removeExperiencia(i)" /></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Empresa *</label><InputText v-model="exp.empresa" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Cargo *</label><InputText v-model="exp.cargo" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Teléfono Empresa</label><InputText v-model="exp.telefonoEmpresa" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Sector</label><InputText v-model="exp.sector" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Período Inicio *</label><InputText v-model="exp.periodoInicio" type="date" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Período Fin</label><InputText v-model="exp.periodoFin" type="date" /></div>
                <div class="flex flex-col gap-1 sm:col-span-2"><label class="text-xs font-medium">Funciones y Logros</label><Textarea v-model="exp.funcionesLogros" rows="2" /></div>
              </div>
            </div>
          </template>
        </Card>
        <div class="flex justify-end">
          <Button label="Guardar Info. Laboral" icon="pi pi-check" severity="success" :loading="saving3" @click="saveLaboral" />
        </div>
      </div>

      <!-- TAB 4: Educación -->
      <div v-show="activeTab === 3" class="space-y-4">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-book text-violet-500" /> Educación e Idiomas</h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addEducacion" />
            </div>
          </template>
          <template #content>
            <div v-if="educaciones.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">Sin educación registrada</div>
            <div v-for="(edu, i) in educaciones" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between mb-3"><span class="text-sm font-medium text-[var(--text-color-secondary)]">Idioma/Educación {{ i + 1 }}</span><Button icon="pi pi-trash" size="small" severity="danger" text @click="removeEducacion(i)" /></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 sm:col-span-2"><label class="text-xs font-medium">Institución *</label><InputText v-model="edu.institucion" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nivel Escritura *</label><InputText v-model="edu.nivelEscritura" placeholder="ej: Básico, Intermedio, Avanzado" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nivel Habla *</label><InputText v-model="edu.nivelHabla" placeholder="ej: Básico, Intermedio, Avanzado" /></div>
                <div class="flex items-center gap-2 pt-2"><Checkbox v-model="edu.capacidadTraducir" :binary="true" /><label class="text-sm">Capacidad de traducir</label></div>
              </div>
            </div>
          </template>
        </Card>
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-car text-violet-500" /> Vehículos</h3>
              <Button label="Agregar" icon="pi pi-plus" size="small" severity="secondary" @click="addVehiculo" />
            </div>
          </template>
          <template #content>
            <div v-if="vehiculos.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">Sin vehículos registrados</div>
            <div v-for="(v, i) in vehiculos" :key="i" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between mb-3"><span class="text-sm font-medium text-[var(--text-color-secondary)]">Vehículo {{ i + 1 }}</span><Button icon="pi pi-trash" size="small" severity="danger" text @click="removeVehiculo(i)" /></div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Tipo Vehículo *</label><InputText v-model="v.tipoVehiculo" placeholder="ej: Moto, Carro" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Placas *</label><InputText v-model="v.placas" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Tipo Licencia *</label><InputText v-model="v.tipoLicencia" placeholder="ej: A1, B1, C1" /></div>
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Número Licencia *</label><InputText v-model="v.numeroLicencia" /></div>
              </div>
            </div>
          </template>
        </Card>
        <div class="flex justify-end">
          <Button label="Guardar Educación y Vehículos" icon="pi pi-check" severity="success" :loading="saving4" @click="saveEducacion" />
        </div>
      </div>

      <!-- TAB 5: Certificados -->
      <div v-show="activeTab === 4" class="space-y-4">
        <!-- Certificados genéricos — shared editor used by wizard + edit page -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-shield text-violet-500" /> Certificados del Empleado</h3>
            </div>
          </template>
          <template #content>
            <EmpleadoCertificadosEditor v-model:certificados="certificados" />
          </template>
        </Card>
        <!-- Datos Migración -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]"><i class="pi pi-globe text-violet-500" /> Datos de Migración</h3>
            </div>
          </template>
          <template #content>
            <div class="flex items-center gap-2 mb-4">
              <Checkbox v-model="migracion.enabled" :binary="true" input-id="migracionEnabled" />
              <label for="migracionEnabled" class="text-sm">Tiene datos de migración</label>
            </div>
            <div v-if="migracion.enabled" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Número Pasaporte</label><InputText v-model="migracion.numeroPasaporte" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Expedición Pasaporte</label><InputText v-model="migracion.pasaporteExpedicion" type="date" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Vencimiento Pasaporte</label><InputText v-model="migracion.pasaporteVencimiento" type="date" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Número Visa</label><InputText v-model="migracion.numeroVisa" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Expedición Visa</label><InputText v-model="migracion.visaExpedicion" type="date" /></div>
              <div class="flex flex-col gap-1"><label class="text-xs font-medium">Vencimiento Visa</label><InputText v-model="migracion.visaVencimiento" type="date" /></div>
            </div>
          </template>
        </Card>
        <div class="flex justify-end">
          <Button label="Guardar Certificados y Migración" icon="pi pi-check" severity="success" :loading="saving5" @click="saveCertificados" />
        </div>
      </div>
    </template>

    <Toast />
  </div>
</template>
