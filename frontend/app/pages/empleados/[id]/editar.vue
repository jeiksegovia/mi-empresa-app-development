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
  // D5 (jul-9): Contrato split out of "Info. Laboral" into its own tab.
  { label: 'Contrato laboral', icon: 'pi pi-file-edit' },
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
  // nomina-asistencia-jul-18: medio de pago de nómina.
  // '' = Sin definir (null on wire).
  medioPagoTipo: '' as '' | 'NEQUI' | 'TRANSFERENCIA_BANCARIA',
  medioPagoNequi: '',
  bancoNombre: '',
  bancoTipoCuenta: '' as '' | 'AHORRO' | 'CORRIENTE',
  bancoNumeroCuenta: '',
})
const formErrors = reactive<Record<string, string>>({})
const medioPagoTipoOptions = [
  { label: 'Sin definir', value: '' },
  { label: 'Nequi', value: 'NEQUI' },
  { label: 'Transferencia bancaria', value: 'TRANSFERENCIA_BANCARIA' },
]
const bancoTipoCuentaOptions = [
  { label: 'Ahorro', value: 'AHORRO' },
  { label: 'Corriente', value: 'CORRIENTE' },
]

// D3: documentoIdentificacionUrl — nullable VARCHAR(500). Uploaded via
// useFileUpload().uploadFile(file, 'empleado-documentos') and persisted
// alongside the rest of the empleado PUT payload.
const documentoIdentificacionUrl = ref<string>('')
const documentoUploading = ref(false)
const documentoFileInputRef = ref<HTMLInputElement | null>(null)
async function onDocumentoChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  documentoUploading.value = true
  try {
    const key = await uploadFile(input.files[0], 'empleado-documentos')
    if (key) {
      documentoIdentificacionUrl.value = key
      toast.add({
        severity: 'success',
        summary: 'Documento subido',
        detail: 'El documento se subió correctamente. Guarda los cambios para aplicar.',
        life: 3000,
      })
    }
  } finally {
    documentoUploading.value = false
    if (documentoFileInputRef.value) documentoFileInputRef.value.value = ''
  }
}
async function downloadDocumento() {
  if (!documentoIdentificacionUrl.value) return
  await downloadFile(documentoIdentificacionUrl.value)
}

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
    // D3: include documentoIdentificacionUrl. Always send — null clears it.
    payload.documentoIdentificacionUrl = documentoIdentificacionUrl.value || null

    // nomina-asistencia-jul-18: medio de pago (always send so clearing works).
    if (form.medioPagoTipo === 'NEQUI') {
      payload.medioPagoTipo = 'NEQUI'
      payload.medioPagoNequi = form.medioPagoNequi.trim() || null
      payload.bancoNombre = null
      payload.bancoTipoCuenta = null
      payload.bancoNumeroCuenta = null
    } else if (form.medioPagoTipo === 'TRANSFERENCIA_BANCARIA') {
      payload.medioPagoTipo = 'TRANSFERENCIA_BANCARIA'
      payload.bancoNombre = form.bancoNombre.trim() || null
      payload.bancoTipoCuenta = form.bancoTipoCuenta || null
      payload.bancoNumeroCuenta = form.bancoNumeroCuenta.trim() || null
      payload.medioPagoNequi = null
    } else {
      payload.medioPagoTipo = null
      payload.medioPagoNequi = null
      payload.bancoNombre = null
      payload.bancoTipoCuenta = null
      payload.bancoNumeroCuenta = null
    }

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
  // D6: signed-contract URL.
  archivoFirmadoUrl: string | null
  // D7: FK to cargos_empresa. May be null during transition.
  cargoId: number | null
  // The API includes the resolved cargo object when cargoId is set.
  cargo?: { id: number; nombre: string; activo: boolean } | null
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
const contratoUploadingFirmado = ref(false)
const contratoFirmadoInputRef = ref<HTMLInputElement | null>(null)

const contratoForm = reactive({
  tipoContrato: 'OPS' as ContratoTipo,
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '' as string,
  archivoUrl: '' as string,
  // D6: archivoFirmadoUrl — signed-contract file slot (nullable).
  archivoFirmadoUrl: '' as string,
  // D7: cargoId replaces the legacy cargo string. Number FK to
  // cargos_empresa; the API accepts only `cargoId` per contract §4.7.
  cargoId: null as number | null,
  // nomina-asistencia-jul-18: valor media jornada (4h). Required on CREATE.
  valorJornada: null as number | null,
  activo: true,
})

const contratoTipoOptions: Array<{ label: string; value: ContratoTipo }> = [
  { label: 'OPS (Prestación de servicios)', value: 'OPS' },
  { label: 'Obra o labor', value: 'OBRA_O_LABOR' },
  { label: 'Término fijo', value: 'TERMINO_FIJO' },
  { label: 'Término indefinido', value: 'TERMINO_INDEFINIDO' },
]

// D7: cargos catalog from /empresa/cargos?activo=true. The "Agregar
// otro cargo" option is the special sentinel "__ADD_NEW__" rendered as
// a separate option in the Select; on pick we open the inline dialog.
interface CargoEmpresa {
  id: number; nombre: string; activo: boolean
}
const cargosEmpresa = ref<CargoEmpresa[]>([])
const ADD_NEW_CARGO_SENTINEL = '__ADD_NEW__'

const cargoEmpresaOptions = computed(() => [
  { label: '— Sin cargo —', value: null as number | null },
  ...cargosEmpresa.value.map((c) => ({ label: c.nombre, value: c.id })),
  { label: '➕ Agregar otro cargo…', value: ADD_NEW_CARGO_SENTINEL as any },
])

const showNewCargoDialog = ref(false)
const newCargoNombre = ref('')
const newCargoSaving = ref(false)
const newCargoError = ref<string | null>(null)

async function fetchCargosEmpresa() {
  try {
    const res = await apiFetch<{ success: boolean; data: CargoEmpresa[] }>(
      '/empresa/cargos?activo=true'
    )
    cargosEmpresa.value = (res.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre))
  } catch (e) {
    // Endpoint may be down — leave list empty so the Select still renders.
  }
}

async function saveNewCargo() {
  if (!newCargoNombre.value.trim()) {
    newCargoError.value = 'El nombre del cargo es obligatorio.'
    return
  }
  newCargoSaving.value = true
  newCargoError.value = null
  try {
    const res = await apiFetch<{ success: boolean; data: CargoEmpresa }>(
      '/empresa/cargos',
      { method: 'POST', body: { nombre: newCargoNombre.value.trim() } }
    )
    // Refresh + auto-select the new cargo.
    await fetchCargosEmpresa()
    contratoForm.cargoId = res.data.id
    showNewCargoDialog.value = false
    newCargoNombre.value = ''
    toast.add({
      severity: 'success', summary: 'Cargo creado',
      detail: `«${res.data.nombre}» fue agregado y seleccionado.`, life: 3000,
    })
  } catch (e: any) {
    // D8: backend returns 409 (Prisma unique constraint) when the
    // (empresaId, nombre) pair already exists.
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

// Watch the Select v-model. PrimeVue Select emits the sentinel as a value
// when the user picks the "Agregar otro cargo" option — we open the
// inline dialog instead of submitting it.
const lastSelectedCargoId = ref<number | null>(null)
function onCargoSelectChange(value: any) {
  if (value === ADD_NEW_CARGO_SENTINEL) {
    showNewCargoDialog.value = true
    // Reset to previous selection so the user sees a stable UI while the
    // dialog is open. After saveNewCargo sets cargoId, the dialog closes
    // and the v-model stays in sync via the watch above.
    contratoForm.cargoId = lastSelectedCargoId.value
  } else {
    lastSelectedCargoId.value = value ?? null
  }
}
watch(
  () => contratoForm.cargoId,
  (val) => {
    if (val !== ADD_NEW_CARGO_SENTINEL) lastSelectedCargoId.value = (val as number | null) ?? null
  }
)

function resetContratoForm() {
  contratoForm.tipoContrato = 'OPS'
  contratoForm.fechaInicio = new Date().toISOString().slice(0, 10)
  contratoForm.fechaFin = ''
  contratoForm.archivoUrl = ''
  contratoForm.archivoFirmadoUrl = ''
  contratoForm.cargoId = null
  contratoForm.valorJornada = null
  contratoForm.activo = true
  contratoEditingId.value = null
  // W9: clear the underlying HTML file input so picking a file for one
  // contrato row, then cancelling & re-opening for a different contrato,
  // does not silently retain the previous file in the input element.
  if (contratoArchivoInputRef.value) contratoArchivoInputRef.value.value = ''
  if (contratoFirmadoInputRef.value) contratoFirmadoInputRef.value.value = ''
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

// D7: load the cargos catalog when the contrato tab is opened. Called
// from fetchEmployee (Tab 3 loads contratos alongside the rest of the
// laboral data) AND from openNewContrato / openEditContrato so a fresh
// list is available even if the user opens the dialog without first
// hydrating the page.
async function ensureCargosEmpresa() {
  if (cargosEmpresa.value.length === 0) {
    await fetchCargosEmpresa()
  }
}

function openNewContrato() {
  resetContratoForm()
  // D7: ensure cargos catalog is loaded before showing the dialog.
  ensureCargosEmpresa()
  contratoDialogOpen.value = true
}

function openEditContrato(c: Contrato) {
  contratoEditingId.value = c.id
  contratoForm.tipoContrato = c.tipoContrato
  contratoForm.fechaInicio = c.fechaInicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
  contratoForm.fechaFin = c.fechaFin?.slice(0, 10) ?? ''
  contratoForm.archivoUrl = c.archivoUrl ?? ''
  // D6/D7: hydrate the new fields. `c.cargoId` is provided by the API
  // when the contrato is loaded via the Prisma include.
  contratoForm.archivoFirmadoUrl = (c as any).archivoFirmadoUrl ?? ''
  contratoForm.cargoId = (c as any).cargoId ?? null
  // nomina-asistencia-jul-18: hydrate valorJornada (Decimal may arrive as string).
  contratoForm.valorJornada = (c as any).valorJornada != null ? Number((c as any).valorJornada) : null
  contratoForm.activo = c.activo
  // D7: ensure cargos catalog is loaded before showing the dialog so the
  // Select can display the cargo name even if it was archived since.
  ensureCargosEmpresa()
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
  // nomina-asistencia-jul-18: valorJornada required on CREATE.
  if (!contratoEditingId.value && (contratoForm.valorJornada == null || Number.isNaN(Number(contratoForm.valorJornada)))) {
    toast.add({
      severity: 'warn',
      summary: 'Valor media jornada requerido',
      detail: 'Ingresa el valor de media jornada (4h) para el nuevo contrato.',
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
    // D6: archivoFirmadoUrl (signed contract).
    if (contratoForm.archivoFirmadoUrl) payload.archivoFirmadoUrl = contratoForm.archivoFirmadoUrl
    // D7: cargoId — number FK; legacy cargo string is rejected per contract §4.7.
    if (contratoForm.cargoId) payload.cargoId = contratoForm.cargoId
    // nomina-asistencia-jul-18: valorJornada required on create; optional on update.
    if (contratoForm.valorJornada != null && !Number.isNaN(Number(contratoForm.valorJornada))) {
      payload.valorJornada = Number(contratoForm.valorJornada)
    }

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
    const current = contratos.value.find((x) => x.id === cid)
    await apiFetch(`/nomina/employees/${route.params.id}/contratos/${cid}`, {
      method: 'PUT',
      body: {
        tipoContrato: current?.tipoContrato,
        fechaInicio: current?.fechaInicio?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        fechaFin: current?.fechaFin?.slice(0, 10) ?? undefined,
        archivoUrl: current?.archivoUrl ?? undefined,
        // D6/D7: include the new fields on the toggle PUT so they don't
        // get cleared when only flipping the activo bit.
        archivoFirmadoUrl: (current as any)?.archivoFirmadoUrl ?? undefined,
        cargoId: (current as any)?.cargoId ?? undefined,
        // nomina-asistencia-jul-18: preserve valorJornada on activo toggle.
        valorJornada: (current as any)?.valorJornada != null
          ? Number((current as any).valorJornada)
          : undefined,
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

// D6: separate uploader for the signed contract. Different folder keeps
// the dashboards cleaner ("contratos/firmados/*" vs "contratos/*").
async function onContratoFirmadoChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  contratoUploadingFirmado.value = true
  try {
    const key = await uploadFile(input.files[0], 'contratos-firmados')
    if (key) {
      contratoForm.archivoFirmadoUrl = key
    }
  } finally {
    contratoUploadingFirmado.value = false
    if (contratoFirmadoInputRef.value) contratoFirmadoInputRef.value.value = ''
  }
}

async function downloadContratoArchivo(c: Contrato) {
  if (!c.archivoUrl) return
  await downloadFile(c.archivoUrl)
}

// W11 C4: download affordance for the SIGNED contract file. The row used
// to only expose one download button (for the blank contrato). The signed
// version lived behind the upload slot in the edit dialog but had no
// quick-access from the list view — fixing the S10 omission.
async function downloadContratoFirmado(c: Contrato) {
  if (!c.archivoFirmadoUrl) return
  await downloadFile(c.archivoFirmadoUrl)
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
// Existing educacionIdiomas — kept. D1 removed only the form-side
// "nivelEscritura" required input (see template below); the API still
// accepts nullable nivelEscritura per the schema contract.
interface EducacionForm { institucion: string; nivelEscritura: string; nivelHabla: string; capacidadTraducir: boolean }
interface VehiculoForm { tipoVehiculo: string; placas: string; tipoLicencia: string; numeroLicencia: string }

const educaciones = ref<EducacionForm[]>([])
const vehiculos = ref<VehiculoForm[]>([])

// D2: NEW EducacionEmpleado (separate table — different model from
// educacionIdiomas). Per-row CRUD via /employees/:id/educacion.
interface EducacionEmpleado {
  id?: number
  profesion: string
  universidad: string
  fechaGraduacion: string
  diplomaUrl: string
  // Local-only: holds the picked File before upload completes (and its
  // displayed filename). Cleared on successful POST/PATCH.
  diplomaFile?: File | null
  diplomaFilename?: string
  diplomaUploading?: boolean
  // Local-only: marks a freshly-added row that hasn't been persisted yet.
  // POST happens when the user clicks "Guardar Educación" (mirrors how
  // contactosEmergencia is collected before save).
  isNew?: boolean
}
const educacionEmpleados = ref<EducacionEmpleado[]>([])

function addEducacion() { educaciones.value.push({ institucion: '', nivelEscritura: '', nivelHabla: '', capacidadTraducir: false }) }
function removeEducacion(i: number) { educaciones.value.splice(i, 1) }
function addVehiculo() { vehiculos.value.push({ tipoVehiculo: '', placas: '', tipoLicencia: '', numeroLicencia: '' }) }
function removeVehiculo(i: number) { vehiculos.value.splice(i, 1) }
function addEducacionEmpleado() {
  educacionEmpleados.value.push({
    profesion: '', universidad: '', fechaGraduacion: '', diplomaUrl: '',
    diplomaFile: null, diplomaFilename: '', diplomaUploading: false, isNew: true,
  })
}
function removeEducacionEmpleado(i: number) { educacionEmpleados.value.splice(i, 1) }

async function onEducacionDiplomaChange(event: Event, i: number) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  const file = input.files[0]
  educacionEmpleados.value[i].diplomaFile = file
  educacionEmpleados.value[i].diplomaFilename = file.name
  educacionEmpleados.value[i].diplomaUploading = true
  try {
    const key = await uploadFile(file, 'empleado-documentos')
    if (key) {
      educacionEmpleados.value[i].diplomaUrl = key
      educacionEmpleados.value[i].diplomaUploading = false
    } else {
      // upload failed (toast was raised by useFileUpload) — clear row state.
      educacionEmpleados.value[i].diplomaFile = null
      educacionEmpleados.value[i].diplomaFilename = ''
      educacionEmpleados.value[i].diplomaUploading = false
    }
  } finally {
    input.value = ''
  }
}

async function downloadEducacionDiploma(row: EducacionEmpleado) {
  if (!row.diplomaUrl) return
  await downloadFile(row.diplomaUrl)
}

async function saveEducacion() {
  saving4.value = true
  try {
    const validEdu = educaciones.value.filter(e => e.institucion.trim() && e.nivelHabla.trim())
    const validVeh = vehiculos.value.filter(v => v.tipoVehiculo.trim() && v.placas.trim() && v.tipoLicencia.trim() && v.numeroLicencia.trim())

    const promises: Promise<any>[] = [
      // D1: send nivelEscritura: null on the educacionIdiomas PUT. The
      // backend Zod accepts null/undefined and the existing string values
      // for back-compat.
      apiFetch(`/employees/${route.params.id}/educacion-idiomas`, { method: 'PUT', body: { educacionIdiomas: validEdu.map(e => ({ institucion: e.institucion.trim(), nivelEscritura: null, nivelHabla: e.nivelHabla.trim(), capacidadTraducir: e.capacidadTraducir })) } }),
      apiFetch(`/employees/${route.params.id}/vehiculos`, { method: 'PUT', body: { vehiculos: validVeh.map(v => ({ tipoVehiculo: v.tipoVehiculo.trim(), placas: v.placas.trim(), tipoLicencia: v.tipoLicencia.trim(), numeroLicencia: v.numeroLicencia.trim() })) } }),
    ]

    // D2: persist EducacionEmpleado rows. New rows (isNew === true,
    // no id yet) → POST. Existing rows → PATCH. The row is deleted from
    // local state on success so it lands in the GET next reload (avoids
    // optimistic duplication).
    for (const row of educacionEmpleados.value) {
      // Skip rows without profesion (backend requires it). User can
      // remove them with the trash icon instead.
      if (!row.profesion.trim()) continue
      const body: Record<string, unknown> = {
        profesion: row.profesion.trim(),
        universidad: row.universidad.trim() || undefined,
        fechaGraduacion: row.fechaGraduacion || undefined,
        diplomaUrl: row.diplomaUrl || undefined,
      }
      if (row.id) {
        promises.push(apiFetch(`/employees/${route.params.id}/educacion/${row.id}`, { method: 'PATCH', body }))
      } else if (row.isNew) {
        promises.push(apiFetch(`/employees/${route.params.id}/educacion`, { method: 'POST', body }))
      }
    }

    await Promise.all(promises)
    toast.add({ severity: 'success', summary: 'Guardado', detail: 'Educación y vehículos actualizados', life: 3000 })
    // Refresh the educacionEmpleado rows so persisted IDs/stamps come from the source of truth.
    await fetchEducacionEmpleado()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al guardar', life: 5000 })
  } finally {
    saving4.value = false
  }
}

async function deleteEducacionEmpleado(row: EducacionEmpleado) {
  // Local-only rows (never persisted) — just drop from the array.
  if (!row.id) {
    educacionEmpleados.value = educacionEmpleados.value.filter((r) => r !== row)
    return
  }
  try {
    await apiFetch(`/employees/${route.params.id}/educacion/${row.id}`, { method: 'DELETE' })
    educacionEmpleados.value = educacionEmpleados.value.filter((r) => r !== row)
  } catch (e: any) {
    toast.add({
      severity: 'error', summary: 'Error',
      detail: e?.data?.message || 'No se pudo eliminar el registro',
      life: 5000,
    })
  }
}

async function fetchEducacionEmpleado() {
  try {
    const res = await apiFetch<{ success: boolean; data: Array<{
      id: number; profesion: string; universidad: string | null
      fechaGraduacion: string | null; diplomaUrl: string | null
    }> }>(`/employees/${route.params.id}/educacion`)
    educacionEmpleados.value = (res.data ?? []).map((row) => ({
      id: row.id,
      profesion: row.profesion ?? '',
      universidad: row.universidad ?? '',
      fechaGraduacion: row.fechaGraduacion
        ? new Date(row.fechaGraduacion).toISOString().slice(0, 10)
        : '',
      diplomaUrl: row.diplomaUrl ?? '',
      diplomaFilename: row.diplomaUrl ? filenameFromKey(row.diplomaUrl) : '',
      isNew: false,
    }))
  } catch (e: any) {
    // Endpoint may not be available yet — silent.
  }
}

// ─── Tab 5: Certificados ─────────────────────────────────────────────────────
const saving5 = ref(false)
interface CertificadoEmpleadoInput {
  tipo: '' | 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
  nombre?: string
  fechaExpedicion: string
  fechaVencimiento: string
  // W11 P1: archivoUrl is the S3 key. Persisted in the same PUT as the
  // rest of the certificado row — previously this was missing from the
  // payload, so even after a successful upload the key never landed in
  // the DB (S7: file gone after reload).
  archivoUrl?: string | null
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
        // W11 P1: include the uploaded S3 key so the certificado row
        // retains it through save+reload (fix S7 — EmpleadoCert file
        // gone after save/reload).
        archivoUrl: c.archivoUrl || undefined,
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
    // D3: hydrate documentoIdentificacionUrl (nullable string).
    documentoIdentificacionUrl.value = emp.documentoIdentificacionUrl ?? ''
    // nomina-asistencia-jul-18: hydrate medio de pago.
    form.medioPagoTipo = emp.medioPagoTipo ?? ''
    form.medioPagoNequi = emp.medioPagoNequi ?? ''
    form.bancoNombre = emp.bancoNombre ?? ''
    form.bancoTipoCuenta = emp.bancoTipoCuenta ?? ''
    form.bancoNumeroCuenta = emp.bancoNumeroCuenta ?? ''

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
    // D7: load the cargos catalog so the Contrato dialog's Select is
    // populated when the user opens it. Fire-and-forget is OK — the
    // dialog also calls ensureCargosEmpresa() right before opening.
    fetchCargosEmpresa()
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
    // D2: hydrate EducacionEmpleado rows from the dedicated endpoint.
    await fetchEducacionEmpleado()

    // Tab 5
    certificados.value = (emp.certificados ?? []).map((c: any) => ({
      tipo: c.tipo,
      nombre: c.nombre ?? '',
      fechaExpedicion: c.fechaExpedicion ? new Date(c.fechaExpedicion).toISOString().split('T')[0] : '',
      fechaVencimiento: c.fechaVencimiento ? new Date(c.fechaVencimiento).toISOString().split('T')[0] : '',
      // W11 P1: re-hydrate the uploaded S3 key so it stays visible in
      // the editor after reload (S7) — and so a subsequent "Guardar"
      // does not accidentally drop the key by sending `archivoUrl:
      // undefined` (backend normalizes to null on PUT).
      archivoUrl: c.archivoUrl ?? '',
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
                <InputText :model-value="form.nombre" @update:model-value="(v) => form.nombre = (v ?? '').toUpperCase()" placeholder="Nombres" :class="{ 'p-invalid': formErrors.nombre }" />
                <small v-if="formErrors.nombre" class="text-red-500">{{ formErrors.nombre }}</small>
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-sm font-medium">Apellido <span class="text-red-500">*</span></label>
                <InputText :model-value="form.apellido" @update:model-value="(v) => form.apellido = (v ?? '').toUpperCase()" placeholder="Apellidos" :class="{ 'p-invalid': formErrors.apellido }" />
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

              <!-- D3: documentoIdentificacionUrl upload. Same upload
                   pattern as hoja-vida / contrato — label + hidden file
                   input + cursor-pointer (jul-9 D4 lesson). -->
              <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                <label class="text-sm font-medium">Documento de identificación</label>
                <div v-if="documentoIdentificacionUrl" class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]">
                  <i class="pi pi-id-card text-violet-500 text-xl" />
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ filenameFromKey(documentoIdentificacionUrl) }}</p>
                  </div>
                  <Button
                    icon="pi pi-download"
                    size="small"
                    severity="info"
                    outlined
                    label="Descargar"
                    data-testid="documento-download"
                    @click="downloadDocumento"
                  />
                  <Button
                    icon="pi pi-times"
                    size="small"
                    severity="danger"
                    text
                    rounded
                    v-tooltip.top="'Quitar documento'"
                    @click="documentoIdentificacionUrl = ''"
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

              <!-- nomina-asistencia-jul-18: Medio de pago de nómina -->
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
                      v-model="form.medioPagoTipo"
                      :options="medioPagoTipoOptions"
                      option-label="label"
                      option-value="value"
                      placeholder="Sin definir"
                      class="w-full"
                      data-testid="medio-pago-tipo"
                    />
                  </div>
                  <div v-if="form.medioPagoTipo === 'NEQUI'" class="flex flex-col gap-1">
                    <label class="text-sm font-medium" for="medio-pago-nequi">Número Nequi</label>
                    <InputText
                      id="medio-pago-nequi"
                      v-model="form.medioPagoNequi"
                      placeholder="Número Nequi"
                      data-testid="medio-pago-nequi"
                    />
                  </div>
                  <template v-if="form.medioPagoTipo === 'TRANSFERENCIA_BANCARIA'">
                    <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium" for="medio-pago-banco">Banco</label>
                      <InputText
                        id="medio-pago-banco"
                        v-model="form.bancoNombre"
                        placeholder="Nombre del banco"
                        data-testid="medio-pago-banco"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-sm font-medium" for="medio-pago-tipo-cuenta">Tipo de cuenta</label>
                      <Select
                        id="medio-pago-tipo-cuenta"
                        v-model="form.bancoTipoCuenta"
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
                        v-model="form.bancoNumeroCuenta"
                        placeholder="Número de cuenta"
                        data-testid="medio-pago-numero-cuenta"
                      />
                    </div>
                  </template>
                </div>
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
                <!-- D1: nivelEscritura input removed (backend now nullable).
                     API still accepts the legacy string for back-compat. -->
                <div class="flex flex-col gap-1"><label class="text-xs font-medium">Nivel Habla *</label><InputText v-model="edu.nivelHabla" placeholder="ej: Básico, Intermedio, Avanzado" /></div>
                <div class="flex items-center gap-2 pt-2"><Checkbox v-model="edu.capacidadTraducir" :binary="true" /><label class="text-sm">Capacidad de traducir</label></div>
              </div>
            </div>
          </template>
        </Card>

        <!-- D2: EducacionEmpleado (new model). Repeatable rows: profesion
             (required), universidad, fechaGraduacion, diploma (upload via
             useFileUpload). Per-row CRUD on /employees/:id/educacion. -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-graduation-cap text-violet-500" /> Formación Académica
              </h3>
              <Button
                label="Agregar"
                icon="pi pi-plus"
                size="small"
                severity="secondary"
                data-testid="educacion-empleado-add"
                @click="addEducacionEmpleado"
              />
            </div>
          </template>
          <template #content>
            <div v-if="educacionEmpleados.length === 0" class="text-center py-4 text-[var(--text-color-secondary)] text-sm">
              Sin formación académica registrada. Haz clic en "Agregar" para añadir.
            </div>
            <div v-for="(row, i) in educacionEmpleados" :key="row.id ?? `new-${i}`" class="border border-[var(--surface-border)] rounded-lg p-4 mb-3">
              <div class="flex justify-between mb-3">
                <span class="text-sm font-medium text-[var(--text-color-secondary)]">
                  Formación {{ i + 1 }}
                </span>
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  data-testid="educacion-empleado-remove"
                  @click="deleteEducacionEmpleado(row)"
                />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs font-medium">Profesión *</label>
                  <InputText v-model="row.profesion" placeholder="Ej: Fisioterapeuta" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium">Universidad</label>
                  <InputText v-model="row.universidad" placeholder="Ej: Universidad Nacional" />
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-medium">Fecha de graduación</label>
                  <InputText v-model="row.fechaGraduacion" type="date" />
                </div>
                <div class="flex flex-col gap-1 sm:col-span-2">
                  <label class="text-xs font-medium">Diploma</label>
                  <div v-if="row.diplomaUrl" class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-md bg-[var(--surface-ground)]">
                    <i class="pi pi-paperclip text-violet-500" />
                    <span class="flex-1 truncate text-sm">{{ row.diplomaFilename || filenameFromKey(row.diplomaUrl) }}</span>
                    <Button
                      icon="pi pi-download"
                      size="small"
                      severity="info"
                      text
                      rounded
                      v-tooltip.top="'Descargar diploma'"
                      @click="downloadEducacionDiploma(row)"
                    />
                    <Button
                      icon="pi pi-times"
                      size="small"
                      severity="danger"
                      text
                      rounded
                      @click="row.diplomaUrl = ''; row.diplomaFilename = ''; row.diplomaFile = null"
                    />
                  </div>
                  <label
                    v-else
                    class="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors w-fit"
                  >
                    <i class="pi pi-upload text-violet-500" />
                    <span>{{ row.diplomaUploading ? 'Subiendo…' : 'Adjuntar diploma' }}</span>
                    <input
                      :key="`diploma-input-${row.id ?? `new-${i}`}`"
                      type="file"
                      class="hidden"
                      accept="application/pdf,image/*"
                      :disabled="row.diplomaUploading"
                      :data-testid="`educacion-diploma-input-${row.id ?? i}`"
                      @change="(e) => onEducacionDiplomaChange(e, i)"
                    />
                  </label>
                </div>
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

      <!-- TAB 6: Contrato laboral (D5) -->
      <!-- Moved verbatim from the old "Info. Laboral" tab. Form logic and
           bindings unchanged — only the URL location changed. W3 will extend
           this scaffold with archivoFirmado + cargo select (task #20 / T12). -->
      <div v-show="activeTab === 5" class="space-y-4" data-testid="contrato-tab-panel">
        <Card data-testid="contrato-card">
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-file-edit text-violet-500" /> Contratos del empleado
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
              Sin contratos registrados. Usa "Agregar contrato" para crear el primero.
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
                    <!-- D7: cargo from the catalog (resolved by the API include). -->
                    <p v-if="c.cargo?.nombre" class="text-xs text-[var(--text-color-secondary)]">
                      <i class="pi pi-briefcase mr-1" />{{ c.cargo.nombre }}
                      <Tag
                        v-if="!c.cargo.activo"
                        value="(archivado)"
                        severity="secondary"
                        class="ml-1"
                      />
                    </p>
                    <p
                      v-if="(c as any).valorJornada != null"
                      class="text-xs text-[var(--text-color-secondary)]"
                      data-testid="contrato-valor-jornada-display"
                    >
                      <i class="pi pi-money-bill mr-1" />
                      Media jornada: {{ Number((c as any).valorJornada).toLocaleString('es-CO') }}
                    </p>
                    <p v-if="c.archivoUrl" class="text-xs text-[var(--text-color-secondary)] truncate">
                      <i class="pi pi-paperclip" /> {{ filenameFromKey(c.archivoUrl) }}
                    </p>
                    <!-- D6: signed-contract file indicator. -->
                    <p v-if="c.archivoFirmadoUrl" class="text-xs text-[var(--text-color-secondary)] truncate">
                      <i class="pi pi-file-edit mr-1" />Firmado: {{ filenameFromKey(c.archivoFirmadoUrl) }}
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
                    <!-- W11 C4 (S10): download the SIGNED contrato file. Hidden when
                         the contrato has no archivoFirmadoUrl yet. -->
                    <Button
                      v-if="(c as any).archivoFirmadoUrl"
                      icon="pi pi-file-edit"
                      size="small"
                      severity="success"
                      text
                      rounded
                      v-tooltip.top="'Descargar firmado'"
                      :data-testid="`contrato-firmado-download-${c.id}`"
                      @click="downloadContratoFirmado(c)"
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
            <!-- D7: cargoId Select populated from /empresa/cargos?activo=true.
                 Includes a sentinel "Agregar otro cargo" option that opens
                 an inline dialog to create a new cargo via POST /empresa/cargos.
                 The legacy `cargo: string` payload is rejected by the API per
                 contract §4.7 — only `cargoId: number` is accepted. -->
            <div>
              <label class="block text-sm font-medium mb-1">Cargo</label>
              <Select
                v-model="contratoForm.cargoId"
                :options="cargoEmpresaOptions"
                option-label="label"
                option-value="value"
                placeholder="Seleccionar cargo"
                class="w-full"
                :class="{ 'p-invalid': false }"
                data-testid="contrato-cargo"
                @change="(e: any) => onCargoSelectChange(e.value)"
              />
              <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                ¿No ves el cargo? Usa «➕ Agregar otro cargo» para crearlo.
              </p>
            </div>
            <!-- nomina-asistencia-jul-18: Valor media jornada (4h) — required on create -->
            <div>
              <label class="block text-sm font-medium mb-1">
                Valor media jornada (4h)
                <span v-if="!contratoEditingId" class="text-red-500">*</span>
              </label>
              <InputNumber
                v-model="contratoForm.valorJornada"
                mode="decimal"
                :min="0"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                input-class="w-full"
                class="w-full"
                placeholder="0"
                data-testid="contrato-valor-jornada"
              />
              <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                Monto pagado por cada media jornada (AM o PM).
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Archivo del contrato</label>
              <div v-if="contratoForm.archivoUrl" class="flex items-center gap-2 text-sm mb-2">
                <i class="pi pi-paperclip text-violet-500" />
                <span class="flex-1 truncate">{{ filenameFromKey(contratoForm.archivoUrl) }}</span>
                <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="contratoForm.archivoUrl = ''" />
              </div>
              <label
                class="inline-flex items-center gap-2 px-3 py-2 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors"
              >
                <i class="pi pi-upload text-violet-500" />
                <span>Seleccionar archivo…</span>
                <input
                  ref="contratoArchivoInputRef"
                  type="file"
                  class="hidden"
                  :disabled="contratoUploadingArchivo"
                  @change="onContratoArchivoChange"
                  data-testid="contrato-archivo-input"
                />
              </label>
              <i v-if="contratoUploadingArchivo" class="pi pi-spin pi-spinner text-violet-500 ml-2" />
            </div>
            <!-- D6: archivoFirmadoUrl — signed-contract file slot. -->
            <div>
              <label class="block text-sm font-medium mb-1">Archivo firmado</label>
              <div v-if="contratoForm.archivoFirmadoUrl" class="flex items-center gap-2 text-sm mb-2">
                <i class="pi pi-file-edit text-violet-500" />
                <span class="flex-1 truncate">{{ filenameFromKey(contratoForm.archivoFirmadoUrl) }}</span>
                <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="contratoForm.archivoFirmadoUrl = ''" />
              </div>
              <label
                class="inline-flex items-center gap-2 px-3 py-2 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors"
              >
                <i class="pi pi-upload text-violet-500" />
                <span>{{ contratoForm.archivoFirmadoUrl ? 'Reemplazar firmado…' : 'Subir contrato firmado…' }}</span>
                <input
                  ref="contratoFirmadoInputRef"
                  type="file"
                  class="hidden"
                  :disabled="contratoUploadingFirmado"
                  @change="onContratoFirmadoChange"
                  data-testid="contrato-firmado-input"
                />
              </label>
              <i v-if="contratoUploadingFirmado" class="pi pi-spin pi-spinner text-violet-500 ml-2" />
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

        <!-- D7: Inline dialog for "Agregar otro cargo". Lives inside the
             Contrato laboral tab so it sits at the same z-index as the
             contrato dialog when chained. -->
        <Dialog
          v-model:visible="showNewCargoDialog"
          header="Nuevo cargo"
          modal
          :style="{ width: '24rem' }"
          data-testid="nuevo-cargo-dialog"
        >
          <div class="space-y-3 pt-2">
            <div>
              <label for="newCargoNombre" class="block text-sm font-medium mb-1">
                Nombre del cargo <span class="text-red-500">*</span>
              </label>
              <InputText
                id="newCargoNombre"
                v-model="newCargoNombre"
                class="w-full"
                :class="{ 'p-invalid': newCargoError }"
                placeholder="Ej: Auxiliar de Enfermería"
                data-testid="nuevo-cargo-nombre"
                @keydown.enter.prevent="saveNewCargo"
              />
              <Message
                v-if="newCargoError"
                severity="error"
                :closable="true"
                class="mt-1"
                data-testid="nuevo-cargo-error"
                @close="newCargoError = null"
              >
                {{ newCargoError }}
              </Message>
            </div>
          </div>
          <template #footer>
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              :disabled="newCargoSaving"
              @click="showNewCargoDialog = false; newCargoError = null"
            />
            <Button
              label="Crear y seleccionar"
              icon="pi pi-check"
              :loading="newCargoSaving"
              data-testid="nuevo-cargo-save"
              @click="saveNewCargo"
            />
          </template>
        </Dialog>
      </div>
    </template>

  </div>
</template>
