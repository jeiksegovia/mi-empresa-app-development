<script setup lang="ts">
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

interface EmergencyContact {
  id: number
  nombre: string
  apellido: string
  telefono: string
  parentesco: string
}

interface RegistroFicha {
  id: number
  instrumentoId: number
  // Backend now returns a nested `instrumento` object (W2 schema change).
  // Some legacy records may still serialize flat fields — accept either shape.
  instrumentoNombre?: string
  instrumentoTipo?: string
  instrumento?: { id: number; nombreInstrumento: string; tipo: string }
  estado: 'PENDIENTE' | 'COMPLETADO' | 'VENCIDO'
  fechaCompletado: string | null
  fechaVencimiento: string | null
}

interface NotaCliente {
  id: number
  tipo: string
  prioridad: string
  contenido: string
  fecha: string
  // B1/B2: REQUIRED fechaIncidente (DATE, NOT NULL). Backend enforces
  // the 2-business-day hard block.
  fechaIncidente: string
}

interface PatientDetail {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: string
  genero: string
  telefono: string | null
  email: string | null
  direccion: string | null
  estado: 'ACTIVO' | 'INACTIVO'
  fechaIngreso: string
  informacionSeguro: string | null
  // B3/B4/B5: cliente additive fields. All nullable.
  fechaCumpleanos: string | null
  tipoSangre: 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG' | null
  eps: string | null
  observacionesEspeciales: string | null
  contactosEmergencia: EmergencyContact[]
  registrosFichas: RegistroFicha[]
  notasCliente: NotaCliente[]
}

interface Instrument {
  id: number
  nombreInstrumento: string
  tipo: string
  estado: string
  // C1/C2: needed by the single-step dialog. The list endpoint returns
  // versionPlantilla; plantillaArchivo is fetched from GET /instruments/:id.
  versionPlantilla?: string
  plantillaArchivo?: string | null
}

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()

const patient = ref<PatientDetail | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

// Note dialog state
const showNoteDialog = ref(false)
const noteForm = reactive({
  tipo: 'NEUTRAL' as 'POSITIVA' | 'NEGATIVA' | 'NEUTRAL' | 'ALERTA',
  prioridad: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
  contenido: '',
  // B1/B2: fechaIncidente is REQUIRED on POST /notas-clientes. Backend
  // rejects dates >2 business days back or in the future with 400 +
  // { field: 'fechaIncidente', message }.
  fechaIncidente: '',
})
const submittingNote = ref(false)
// B1/B2: inline error state for the fechaIncidente DatePicker. Cleared
// when the dialog opens and when the field changes.
const fechaIncidenteError = ref<string | null>(null)

// ── B5: Instrument assignment ─────────────────────────────────────────────────
const instruments = ref<Instrument[]>([])
// C1/C3: model can hold an instrument id OR the "crear nuevo" sentinel.
const selectedInstrumentId = ref<number | string | null>(null)
const deletingFichaId = ref<number | null>(null)

// C3: sentinel option that routes to the create-instrument page.
const CREATE_INSTRUMENT = '__create_instrument__'
const instrumentSelectOptions = computed(() => [
  ...instruments.value,
  { id: CREATE_INSTRUMENT, nombreInstrumento: '➕ Crear instrumento nuevo', tipo: '', estado: '' },
])

// ── C1/C2: single-step ficha dialog (assign + first update in one shot) ────────
const { uploadFile } = useFileUpload()
const showSingleStepDialog = ref(false)
const loadingInstrumentDetail = ref(false)
const submittingSingleStep = ref(false)
const downloadingPlantilla = ref(false)
const singleStepFile = ref<File | null>(null)
const singleStepForm = reactive({
  instrumentoId: 0,
  instrumentoNombre: '',
  versionRegistro: '',
  plantillaArchivo: null as string | null,
  notasObservaciones: '',
  fechaVencimiento: '' as string,
})
// W7/W9 parity: IDB stash so the completed-evaluation file survives an
// Android tab discard. Scoped by patient id + instrumento id.
const singleStepFileGuard = useFileStashTitleGuard('Adjuntar evaluación completada')
const singleStepStashKey = computed(
  () => `ficha-single-step:${route.params.id}:${singleStepForm.instrumentoId || 'new'}:file`
)

// ── B6: Ficha status dialog ───────────────────────────────────────────────────
const showFichaDialog = ref(false)
const fichaForm = reactive({
  id: 0,
  currentEstado: 'PENDIENTE' as 'COMPLETADO' | 'PENDIENTE' | 'VENCIDO',
  newEstado: '' as 'COMPLETADO' | 'VENCIDO' | '',
  instrumentoNombre: '',
  // D1 mitigation + Bug 2: free-form notes + optional next-due date.
  notasObservaciones: '',
  fechaVencimiento: '' as string,
})
const submittingFicha = ref(false)

// File upload state for COMPLETADO transition
const uploadedFile = ref<File | null>(null)
const uploadingFile = ref(false)
const uploadedFileKey = ref<string | null>(null)
// Persisted display name of the last selected file (cannot persist the File itself).
const uploadedFileName = ref<string | null>(null)

// sessionStorage draft key, scoped per ficha id (line 87).
const fichaDraftKey = computed(
  () => `ficha-form-draft-${route.params.id}-${fichaForm.id || 'new'}`
)

// ── W7: IndexedDB file stash — survives full reload on Android ───────────────
const { stash: stashFile, restore: restoreFile, clear: clearFile } = useFileStash()
const fichaFileGuard = useFileStashTitleGuard('Adjuntar archivo de respaldo')
// W9: stash key MUST include the ficha id so each ficha on the same
// patient page gets its own slot. route.params.id is the patient id,
// not the ficha id — without fichaForm.id, every ficha shares the
// same stash and the second dialog opened shows the first dialog's file.
const stashKey = computed(() => `ficha:${route.params.id}:${fichaForm.id || 'new'}:file`)

const tabs = [
  { label: 'Información Básica', icon: 'pi pi-user' },
  { label: 'Fichas & Evaluaciones', icon: 'pi pi-file-check' },
  { label: 'Notas', icon: 'pi pi-book' },
]

// Valid status transitions (mirrors backend logic).
// D3 (scope-decisions): VENCIDO → COMPLETADO is now allowed when an archive is supplied.
const validTransitions: Record<string, Array<'COMPLETADO' | 'VENCIDO'>> = {
  PENDIENTE: ['COMPLETADO', 'VENCIDO'],
  COMPLETADO: ['VENCIDO'],
  VENCIDO: ['COMPLETADO'],
}

const availableTransitions = computed(() => {
  return validTransitions[fichaForm.currentEstado] ?? []
})

const transitionOptions = computed(() =>
  availableTransitions.value.map((v) => ({
    label: v === 'COMPLETADO' ? 'Completado' : 'Vencido',
    value: v,
  }))
)

const requiresFileUpload = computed(() => fichaForm.newEstado === 'COMPLETADO')

async function fetchPatient() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: PatientDetail }>(
      `/patients/${route.params.id}`
    )
    patient.value = res.data
  } catch (e: any) {
    if (e?.response?.status === 404) {
      error.value = 'Paciente no encontrado'
    } else {
      error.value = 'Error al cargar los datos del paciente'
    }
  } finally {
    loading.value = false
  }
}

async function fetchInstruments() {
  try {
    const res = await apiFetch<{ success: boolean; data: Instrument[]; total: number }>(
      '/instruments?estado=ACTIVO&limit=100'
    )
    // The list endpoint returns { data, total, page, ... }
    instruments.value = (res as any).data ?? []
  } catch (e) {
    console.error('Error fetching instruments:', e)
  }
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function formatShortDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function calculateAge(fechaNacimiento: string) {
  const birth = new Date(fechaNacimiento)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }
  return age
}

const initials = computed(() => {
  if (!patient.value) return ''
  return (patient.value.nombre?.[0] ?? '').toUpperCase()
})

const estadoSeverityMap: Record<string, 'success' | 'warn' | 'danger' | 'info'> = {
  'COMPLETADO': 'success',
  'EN_PROGRESO': 'info',
  'PENDIENTE': 'warn',
  'VENCIDO': 'danger',
}

const prioridadSeverityMap: Record<string, 'success' | 'warn' | 'danger' | 'info'> = {
  'ALTA': 'danger',
  'MEDIA': 'warn',
  'BAJA': 'info',
}

const tipoNotaOptions = [
  { label: 'Positiva', value: 'POSITIVA' },
  { label: 'Negativa', value: 'NEGATIVA' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Alerta', value: 'ALERTA' },
]

const prioridadOptions = [
  { label: 'Alta', value: 'ALTA' },
  { label: 'Media', value: 'MEDIA' },
  { label: 'Baja', value: 'BAJA' },
]

// B4: TipoSangre enum (8 values). Display in Spanish-friendly notation
// (A+, A-, B+, B-, AB+, AB-, O+, O-) mapped to enum values from contract §2.
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
function formatTipoSangre(value: PatientDetail['tipoSangre']) {
  if (!value) return '—'
  return tipoSangreOptions.find((t) => t.value === value)?.label ?? value
}

async function handleNoteSubmit() {
  if (!noteForm.contenido.trim() || !patient.value) {
    return
  }
  // B1/B2: client-side guard for the required fechaIncidente field. The
  // backend will also reject it (400 + field: 'fechaIncidente') but we
  // surface a friendlier message without a round-trip.
  if (!noteForm.fechaIncidente) {
    fechaIncidenteError.value = 'Selecciona la fecha del incidente.'
    return
  }

  submittingNote.value = true
  try {
    await apiFetch(`/patients/${patient.value.id}/notes`, {
      method: 'POST',
      body: {
        tipo: noteForm.tipo,
        prioridad: noteForm.prioridad,
        contenido: noteForm.contenido.trim(),
        fechaIncidente: noteForm.fechaIncidente,
      },
    })

    await fetchPatient()

    noteForm.tipo = 'NEUTRAL'
    noteForm.prioridad = 'MEDIA'
    noteForm.contenido = ''
    noteForm.fechaIncidente = ''
    fechaIncidenteError.value = null
    showNoteDialog.value = false
    toast.add({ severity: 'success', summary: 'Nota guardada', life: 3000 })
  } catch (e: any) {
    console.error('Error creating note:', e)
    // B1/B2: backend field-level 400 — render inline next to the field,
    // not just as a toast (matches nomina CUENTA_COBRO pattern).
    if (e?.data?.field === 'fechaIncidente') {
      fechaIncidenteError.value =
        e.data.message || 'La fecha del incidente no es válida.'
    }
    const msg = e?.data?.message || e?.message || 'Error al crear la nota'
    toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 4000 })
  } finally {
    submittingNote.value = false
  }
}

function openNoteDialog() {
  noteForm.tipo = 'NEUTRAL'
  noteForm.prioridad = 'MEDIA'
  noteForm.contenido = ''
  noteForm.fechaIncidente = ''
  fechaIncidenteError.value = null
  showNoteDialog.value = true
}

// ── B5 handlers ───────────────────────────────────────────────────────────────

// C1/C3: selecting an instrument immediately opens the combined dialog.
// The "crear nuevo" sentinel routes to the create-instrument page instead.
function onInstrumentSelected() {
  const val = selectedInstrumentId.value
  if (val === null) return
  if (val === CREATE_INSTRUMENT) {
    selectedInstrumentId.value = null
    navigateTo(`/instrumentos/crear?return=${encodeURIComponent(route.fullPath)}`)
    return
  }
  openSingleStepDialog(Number(val))
}

async function openSingleStepDialog(instrumentoId: number) {
  // Reset FIRST so a previously opened instrument never leaks its state.
  singleStepFile.value = null
  singleStepForm.instrumentoId = instrumentoId
  const fromList = instruments.value.find((i) => i.id === instrumentoId)
  singleStepForm.instrumentoNombre = fromList?.nombreInstrumento || 'Instrumento'
  singleStepForm.versionRegistro = fromList?.versionPlantilla || ''
  singleStepForm.plantillaArchivo = null
  singleStepForm.notasObservaciones = ''
  singleStepForm.fechaVencimiento = ''
  singleStepFileGuard.disarm()
  showSingleStepDialog.value = true

  // Fetch detail for plantillaArchivo (not present in the list payload) and
  // the authoritative versionPlantilla → versionRegistro.
  loadingInstrumentDetail.value = true
  try {
    const res = await apiFetch<{
      success: boolean
      data: { nombreInstrumento: string; plantillaArchivo: string | null; versionPlantilla: string }
    }>(`/instruments/${instrumentoId}`)
    singleStepForm.instrumentoNombre = res.data.nombreInstrumento || singleStepForm.instrumentoNombre
    singleStepForm.plantillaArchivo = res.data.plantillaArchivo ?? null
    singleStepForm.versionRegistro = res.data.versionPlantilla || singleStepForm.versionRegistro || '1.0'
  } catch (e) {
    console.error('Error fetching instrument detail:', e)
    if (!singleStepForm.versionRegistro) singleStepForm.versionRegistro = '1.0'
  } finally {
    loadingInstrumentDetail.value = false
  }

  // Re-hydrate the completed file from the IDB stash (Android tab-discard).
  if (import.meta.client) {
    restoreFile(singleStepStashKey.value).then((restored) => {
      if (restored && !singleStepFile.value) {
        singleStepFile.value = restored
        toast.add({
          severity: 'success',
          summary: 'Archivo restaurado',
          detail: `«${restored.name}» se restauró automáticamente.`,
          life: 4000,
        })
      }
    }).catch(() => { /* IDB may be unavailable — silent */ })
  }
}

async function onSingleStepFileSelected(event: Event) {
  singleStepFileGuard.disarm()
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  singleStepFile.value = file
  if (file) {
    await stashFile(singleStepStashKey.value, file).catch(() => { /* IDB best-effort */ })
  }
}

// C2: download the blank plantilla, renamed client-side to
// {instrumentoNombre}_{pacienteNombre}.{ext}. If the blob fetch is blocked
// (S3 CORS), fall back to opening the file + a toast with the rename hint.
async function downloadPlantillaRenamed() {
  const key = singleStepForm.plantillaArchivo
  if (!key || !patient.value) return
  downloadingPlantilla.value = true
  const sanitize = (s: string) =>
    (s || '').trim().replace(/[^\w\sÀ-ÿ.-]/g, '').replace(/\s+/g, '_') || 'archivo'
  const ext = (filenameFromKey(key).split('.').pop() || 'pdf').toLowerCase()
  const filename = `${sanitize(singleStepForm.instrumentoNombre)}_${sanitize(patient.value.nombre)}.${ext}`
  try {
    const res = await apiFetch<{ success: boolean; data: { downloadUrl: string } }>(
      `/uploads/download-url?key=${encodeURIComponent(key)}`
    )
    const url = res.data.downloadUrl
    try {
      const blobRes = await fetch(url)
      if (!blobRes.ok) throw new Error(`fetch ${blobRes.status}`)
      const blob = await blobRes.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
      toast.add({ severity: 'success', summary: 'Plantilla descargada', detail: filename, life: 3500 })
    } catch {
      // CORS / network blocked the client-side rename → open + rename hint.
      window.open(url, '_blank')
      toast.add({
        severity: 'info',
        summary: 'Plantilla abierta',
        detail: `Guárdala con el nombre «${filename}».`,
        life: 6000,
      })
    }
  } catch {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo descargar la plantilla.', life: 4000 })
  } finally {
    downloadingPlantilla.value = false
  }
}

async function handleSingleStepSubmit() {
  if (!patient.value || !singleStepForm.instrumentoId) return
  if (!singleStepFile.value) {
    toast.add({
      severity: 'warn',
      summary: 'Debes adjuntar el archivo de la evaluación completada',
      life: 4000,
    })
    return
  }

  submittingSingleStep.value = true
  try {
    // Upload the completed evaluation first → S3 key.
    const key = await uploadFile(singleStepFile.value, 'fichas')
    if (!key) {
      submittingSingleStep.value = false
      return
    }

    const notas = singleStepForm.notasObservaciones.trim()
    const fechaVenc = singleStepForm.fechaVencimiento || ''
    // C1 single-step: archivoCompletado present → backend creates COMPLETADO.
    await apiFetch(`/patients/${patient.value.id}/fichas`, {
      method: 'POST',
      body: {
        instrumentoId: singleStepForm.instrumentoId,
        versionRegistro: singleStepForm.versionRegistro || '1.0',
        archivoCompletado: key,
        ...(notas ? { notasObservaciones: notas } : {}),
        ...(fechaVenc ? { fechaVencimiento: fechaVenc } : {}),
      },
    })

    await fetchPatient()
    await clearFile(singleStepStashKey.value).catch(() => { /* noop */ })
    singleStepFile.value = null
    showSingleStepDialog.value = false
    selectedInstrumentId.value = null
    singleStepFileGuard.disarm()
    toast.add({
      severity: 'success',
      summary: 'Ficha completada',
      detail: 'La evaluación se registró como COMPLETADO.',
      life: 3500,
    })
  } catch (e: any) {
    console.error('Error creating single-step ficha:', e)
    const msg = e?.data?.message || 'Error al registrar la ficha'
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    submittingSingleStep.value = false
  }
}

// Reset the select when the dialog closes so re-picking the SAME instrument
// re-triggers @change (PrimeVue Select won't fire if the value is unchanged).
watch(showSingleStepDialog, (open) => {
  if (!open) {
    selectedInstrumentId.value = null
    singleStepFileGuard.disarm()
  }
})

async function deleteFicha(fichaId: number) {
  if (!patient.value) return

  deletingFichaId.value = fichaId
  try {
    await apiFetch(`/patients/${patient.value.id}/fichas/${fichaId}`, {
      method: 'DELETE',
    })
    await fetchPatient()
    toast.add({ severity: 'success', summary: 'Ficha eliminada', life: 3000 })
  } catch (e: any) {
    console.error('Error deleting ficha:', e)
    const msg = e?.data?.message || 'Error al eliminar la ficha'
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    deletingFichaId.value = null
  }
}

// ── B6 handlers ───────────────────────────────────────────────────────────────

function openFichaDialog(ficha: RegistroFicha) {
  // W9: explicit reset FIRST — before anything that might read or
  // restore state — so closing & re-opening for a DIFFERENT ficha on
  // the same page never shows the previous ficha's file/filename/key.
  uploadedFile.value = null
  uploadedFileName.value = null
  uploadedFileKey.value = null

  fichaForm.id = ficha.id
  fichaForm.currentEstado = ficha.estado
  fichaForm.newEstado = ''
  fichaForm.instrumentoNombre =
    ficha.instrumento?.nombreInstrumento
    || ficha.instrumentoNombre
    || 'Ficha'

  // D1 mitigation: restore any in-progress draft (Android tab-unload protection).
  // readFichaDraft() internally validates parsed.id === fichaForm.id so
  // drafts from another ficha are ignored here.
  const draft = readFichaDraft()
  if (draft) {
    fichaForm.newEstado = (draft.newEstado as typeof fichaForm.newEstado) || ''
    fichaForm.notasObservaciones = draft.notasObservaciones ?? ''
    fichaForm.fechaVencimiento = draft.fechaVencimiento ?? ''
    uploadedFileName.value = draft.uploadedFileName ?? null
    if (draft.uploadedFileName) {
      toast.add({
        severity: 'info',
        summary: 'Borrador restaurado',
        detail: `Vuelve a seleccionar "${draft.uploadedFileName}" para continuar.`,
        life: 5000,
      })
    }
  } else {
    fichaForm.notasObservaciones = ''
    fichaForm.fechaVencimiento = ''
    uploadedFileName.value = null
  }

  // W7 + W9: try to re-hydrate File from IndexedDB stash UNDER THE
  // ficha-scoped key. If found, populate uploadedFile directly so the
  // user sees the file is "still there" — no re-pick needed.
  // Switching fichas: the new stashKey is ficha:<patientId>:<fichaId>:file,
  // so the previous ficha's IDB entry is NOT picked up.
  if (import.meta.client) {
    restoreFile(stashKey.value).then((restoredFile) => {
      if (restoredFile && !uploadedFile.value) {
        uploadedFile.value = restoredFile
        uploadedFileName.value = restoredFile.name
        toast.add({
          severity: 'success',
          summary: 'Archivo restaurado',
          detail: `«${restoredFile.name}» se restauró automáticamente.`,
          life: 4000,
        })
      }
    }).catch(() => { /* IDB may be unavailable — silent */ })
  }

  showFichaDialog.value = true
}

async function onFileSelected(event: Event) {
  fichaFileGuard.disarm() // reset the title-guard prefix (Fix Option B)
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  uploadedFile.value = file
  uploadedFileKey.value = null
  if (file) {
    uploadedFileName.value = file.name
    // W7: persist the File to IndexedDB so Android Chrome can re-hydrate
    // after a tab discard. sessionStorage can only hold the file NAME.
    await stashFile(stashKey.value, file)
    writeFichaDraft() // keep sessionStorage draft in sync (existing line)
  }
}

// ── D1: form-state draft persistence (sessionStorage) ────────────────────────
function readFichaDraft(): {
  newEstado?: string
  notasObservaciones?: string
  fechaVencimiento?: string
  uploadedFileName?: string
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(fichaDraftKey.value)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Discard drafts from a different ficha id — fichaForm.id changed.
    if (!parsed || parsed.id !== fichaForm.id) return null
    const { newEstado, notasObservaciones, fechaVencimiento, uploadedFileName } = parsed
    return { newEstado, notasObservaciones, fechaVencimiento, uploadedFileName }
  } catch {
    return null
  }
}

function writeFichaDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      fichaDraftKey.value,
      JSON.stringify({
        id: fichaForm.id,
        newEstado: fichaForm.newEstado,
        notasObservaciones: fichaForm.notasObservaciones,
        fechaVencimiento: fichaForm.fechaVencimiento,
        uploadedFileName: uploadedFileName.value,
      })
    )
  } catch {
    // sessionStorage may be disabled — silently ignore.
  }
}

function clearFichaDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(fichaDraftKey.value) } catch { /* noop */ }
}

watch(
  () => [fichaForm.newEstado, fichaForm.notasObservaciones, fichaForm.fechaVencimiento],
  () => { if (showFichaDialog.value) writeFichaDraft() }
)

watch(uploadedFileName, () => { if (showFichaDialog.value) writeFichaDraft() })

async function handleFichaSubmit() {
  if (!fichaForm.id || !fichaForm.newEstado || !patient.value) return

  submittingFicha.value = true
  try {
    let archivoCompletado: string | undefined

    // Upload file when transitioning to COMPLETADO
    if (fichaForm.newEstado === 'COMPLETADO') {
      if (!uploadedFile.value) {
        toast.add({ severity: 'warn', summary: 'Debes adjuntar un archivo para marcar como completado', life: 4000 })
        submittingFicha.value = false
        return
      }

      uploadingFile.value = true
      try {
        // Step 1: Get presigned URL
        const presignedRes = await apiFetch<{ success: boolean; data: { uploadUrl: string; key: string } }>(
          '/uploads/presigned-url',
          {
            method: 'POST',
            body: {
              contentType: uploadedFile.value.type,
              folder: 'fichas',
            },
          }
        )

        const { uploadUrl, key } = presignedRes.data

        // Step 2: Upload directly to S3 using the presigned URL
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          body: uploadedFile.value,
          headers: { 'Content-Type': uploadedFile.value.type },
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`)
        }

        archivoCompletado = key
      } finally {
        uploadingFile.value = false
      }
    }

    // Step 3: Update ficha status (Bug 2: include notasObservaciones + fechaVencimiento).
    const notas = fichaForm.notasObservaciones.trim()
    const fechaVenc = fichaForm.fechaVencimiento || ''
    await apiFetch(`/patients/${patient.value.id}/fichas/${fichaForm.id}/status`, {
      method: 'PATCH',
      body: {
        estado: fichaForm.newEstado,
        ...(archivoCompletado ? { archivoCompletado } : {}),
        ...(notas ? { notasObservaciones: notas } : {}),
        ...(fechaVenc ? { fechaVencimiento: fechaVenc } : {}),
      },
    })

    await fetchPatient()
    clearFichaDraft()
    // W7: clear the IndexedDB file stash on successful submit so the
    // next session starts clean. (Fix Option A — Diff 4)
    await clearFile(stashKey.value)
    uploadedFile.value = null
    uploadedFileName.value = null
    uploadedFileKey.value = null
    showFichaDialog.value = false
    fichaFileGuard.disarm()
    toast.add({ severity: 'success', summary: 'Estado actualizado', life: 3000 })
  } catch (e: any) {
    console.error('Error updating ficha status:', e)
    const msg = e?.data?.message || 'Error al actualizar el estado'
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    submittingFicha.value = false
  }
}

onMounted(async () => {
  await fetchPatient()
  await fetchInstruments()
})
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
        @click="navigateTo('/pacientes')" />
    </div>

    <template v-else-if="patient">
      <!-- Page Header -->
      <AppPageHeader :title="patient.nombre" subtitle="Perfil del paciente">
        <template #actions>
          <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" outlined
            @click="navigateTo('/pacientes')" />
          <Button label="Editar" icon="pi pi-pencil" severity="info" @click="navigateTo(`/pacientes/${patient.id}/editar`)" />
        </template>
      </AppPageHeader>

      <!-- Profile Header Card -->
      <Card class="mb-6">
        <template #content>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Avatar :label="initials"
              class="bg-violet-500 text-white text-2xl font-bold flex-shrink-0"
              shape="circle" size="xlarge" />
            <div class="flex-1 min-w-0">
              <div class="flex flex-wrap items-center gap-3 mb-1">
                <h2 class="text-2xl font-bold text-[var(--text-color)]">
                  {{ patient.nombre }}
                </h2>
                <AppStatusBadge :status="patient.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
              </div>
              <p class="text-[var(--text-color-secondary)] mb-2">
                {{ calculateAge(patient.fechaNacimiento) }} años · {{ patient.genero }}
              </p>
              <div class="flex flex-wrap gap-4 text-sm text-[var(--text-color-secondary)]">
                <span><i class="pi pi-id-card mr-1" />{{ patient.tipoDocumento }} {{ patient.numeroDocumento }}</span>
                <span v-if="patient.telefono"><i class="pi pi-phone mr-1" />{{ patient.telefono }}</span>
                <span v-if="patient.email"><i class="pi pi-envelope mr-1" />{{ patient.email }}</span>
              </div>
            </div>
          </div>
        </template>
      </Card>

      <!-- Tabs -->
      <div class="mb-4 flex gap-1 border-b border-[var(--surface-border)]">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          :class="[
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === i
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-[var(--text-color-secondary)] hover:text-[var(--text-color)]'
          ]"
          @click="activeTab = i"
        >
          <i :class="tab.icon" />
          {{ tab.label }}
        </button>
      </div>

      <!-- TAB 0: Información Básica -->
      <div v-show="activeTab === 0" class="space-y-4">
        <!-- Personal Data -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-user text-violet-500" /> Datos Personales
              </h3>
            </div>
          </template>
          <template #content>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo de Documento</p>
                <p class="font-medium">{{ patient.tipoDocumento }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Número de Documento</p>
                <p class="font-medium">{{ patient.numeroDocumento }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Nacimiento</p>
                <p class="font-medium">{{ formatDate(patient.fechaNacimiento) }}</p></div>
              <!-- B3: cliente additive fields — rendered above Información del Seguro. -->
              <div v-if="patient.fechaCumpleanos">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de cumpleaños</p>
                <p class="font-medium">{{ formatShortDate(patient.fechaCumpleanos) }}</p>
              </div>
              <div v-if="patient.tipoSangre">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo de sangre</p>
                <p class="font-medium">{{ formatTipoSangre(patient.tipoSangre) }}</p>
              </div>
              <div v-if="patient.eps">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">EPS</p>
                <p class="font-medium">{{ patient.eps }}</p>
              </div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Género</p>
                <p class="font-medium">{{ patient.genero || '—' }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Ingreso</p>
                <p class="font-medium">{{ formatDate(patient.fechaIngreso) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado</p>
                <p class="font-medium">{{ patient.estado }}</p></div>
              <div v-if="patient.informacionSeguro" class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Información del Seguro</p>
                <p class="font-medium">{{ patient.informacionSeguro }}</p></div>
              <div v-if="patient.direccion" class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Dirección</p>
                <p class="font-medium">{{ patient.direccion }}</p></div>
            </div>
          </template>
        </Card>

        <!-- Emergency Contacts -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-phone text-violet-500" /> Contactos de Emergencia
                <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ patient.contactosEmergencia.length }} contacto(s)
                </span>
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="patient.contactosEmergencia.length === 0"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay contactos registrados
            </div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="c in patient.contactosEmergencia" :key="c.id"
                class="py-3 flex items-center justify-between">
                <div>
                  <p class="font-medium">{{ c.nombre }} {{ c.apellido }}</p>
                  <p class="text-sm text-[var(--text-color-secondary)]">{{ c.parentesco }}</p>
                </div>
                <a :href="`tel:${c.telefono}`"
                  class="flex items-center gap-1 text-sm text-violet-600 hover:underline">
                  <i class="pi pi-phone text-xs" />{{ c.telefono }}
                </a>
              </div>
            </div>
          </template>
        </Card>

        <!-- Observaciones Especiales -->
        <Card v-if="patient.observacionesEspeciales">
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-info-circle text-violet-500" /> Observaciones Especiales
              </h3>
            </div>
          </template>
          <template #content>
            <p class="text-sm text-[var(--text-color)]">{{ patient.observacionesEspeciales }}</p>
          </template>
        </Card>
      </div>

      <!-- TAB 1: Fichas & Evaluaciones -->
      <div v-show="activeTab === 1" class="space-y-4">

        <!-- B5: Assign Instrument Card -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-plus-circle text-violet-500" /> Asignar Instrumento
              </h3>
            </div>
          </template>
          <template #content>
            <div class="flex flex-col gap-2">
              <label class="block text-sm font-medium">Seleccionar instrumento</label>
              <Select
                v-model="selectedInstrumentId"
                :options="instrumentSelectOptions"
                option-label="nombreInstrumento"
                option-value="id"
                placeholder="Seleccionar instrumento"
                class="w-full"
                filter
                filter-placeholder="Buscar..."
                data-testid="ficha-instrumento-select"
                @change="onInstrumentSelected"
              >
                <template #option="{ option }">
                  <span
                    v-if="option.id === CREATE_INSTRUMENT"
                    class="text-violet-600 dark:text-violet-400 font-medium"
                    data-testid="instrumento-crear-shortcut"
                  >
                    {{ option.nombreInstrumento }}
                  </span>
                  <span v-else>{{ option.nombreInstrumento }}</span>
                </template>
              </Select>
              <p class="text-xs text-[var(--text-color-secondary)]">
                Al seleccionar un instrumento se abre el formulario para asignar y
                cargar la evaluación completada en un solo paso.
              </p>
            </div>
          </template>
        </Card>

        <!-- Fichas List Card -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-file-check text-violet-500" /> Historial de Fichas
                <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ patient.registrosFichas.length }} registro(s)
                </span>
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="patient.registrosFichas.length === 0"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay fichas registradas
            </div>
            <DataTable v-else
              :value="patient.registrosFichas"
              striped-rows
              responsive-layout="scroll"
              class="w-full"
            >
              <Column header="Instrumento" style="min-width: 200px">
                <template #body="{ data }">
                  <div>
                    <!-- Bug 1: backend now returns the instrumento as a nested object
                         (W2 shape change). Read from either the nested or flat shape. -->
                    <p class="font-medium text-[var(--text-color)]">
                      {{
                        data.instrumento?.nombreInstrumento
                          || data.instrumentoNombre
                          || '—'
                      }}
                    </p>
                    <p class="text-xs text-[var(--text-color-secondary)]">
                      {{
                        data.instrumento?.tipo
                          || data.instrumentoTipo
                          || '—'
                      }}
                    </p>
                  </div>
                </template>
              </Column>

              <Column header="Estado" style="min-width: 120px">
                <template #body="{ data }">
                  <Tag
                    :value="data.estado"
                    :severity="estadoSeverityMap[data.estado] || 'info'"
                  />
                </template>
              </Column>

              <Column header="Fecha Completado" style="min-width: 140px">
                <template #body="{ data }">
                  <span class="text-sm">{{ formatShortDate(data.fechaCompletado) }}</span>
                </template>
              </Column>

              <Column header="Vencimiento" style="min-width: 140px">
                <template #body="{ data }">
                  <span class="text-sm">{{ formatShortDate(data.fechaVencimiento) }}</span>
                </template>
              </Column>

              <Column header="Acciones" style="min-width: 120px">
                <template #body="{ data }">
                  <div class="flex items-center gap-1">
                    <!-- View / update status button — Bug 3: drives disabled from the transitions map,
                         so VENCIDO rows are editable once the backend allows VENCIDO → COMPLETADO. -->
                    <Button
                      icon="pi pi-pencil"
                      size="small"
                      severity="secondary"
                      text
                      rounded
                      v-tooltip.top="
                        (validTransitions[data.estado]?.length ?? 0) > 0
                          ? 'Cambiar estado'
                          : 'Sin transiciones disponibles'
                      "
                      :disabled="!validTransitions[data.estado]?.length"
                      @click="openFichaDialog(data)"
                    />
                    <!-- B5: Delete button — only for PENDIENTE fichas -->
                    <Button
                      v-if="data.estado === 'PENDIENTE'"
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      text
                      rounded
                      v-tooltip.top="'Eliminar ficha'"
                      :loading="deletingFichaId === data.id"
                      @click="deleteFicha(data.id)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>

      <!-- TAB 2: Notas -->
      <div v-show="activeTab === 2" class="space-y-4">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-book text-violet-500" /> Notas del Cliente
                <span class="ml-2 text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ patient.notasCliente.length }} nota(s)
                </span>
              </h3>
              <Button
                label="Nueva Nota"
                icon="pi pi-plus"
                size="small"
                @click="openNoteDialog"
              />
            </div>
          </template>
          <template #content>
            <div v-if="patient.notasCliente.length === 0"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay notas registradas
            </div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="nota in patient.notasCliente" :key="nota.id" class="py-4">
                <div class="flex flex-wrap items-start gap-2 mb-2">
                  <Badge :value="nota.tipo" severity="info" />
                  <Badge
                    :value="`Prioridad: ${nota.prioridad}`"
                    :severity="prioridadSeverityMap[nota.prioridad] || 'info'"
                  />
                  <!-- B1/B6: show fechaIncidente (the event date) as the
                       primary date; the row was previously showing `fecha`
                       (creation timestamp). DD/MM/YYYY per spec. -->
                  <span class="text-xs text-[var(--text-color-secondary)] ml-auto">
                    <i class="pi pi-calendar mr-1" />
                    {{ formatShortDate(nota.fechaIncidente) }}
                  </span>
                </div>
                <p class="text-sm text-[var(--text-color)]">{{ nota.contenido }}</p>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- Note Creation Dialog -->
      <Dialog
        v-model:visible="showNoteDialog"
        modal
        header="Nueva Nota"
        :style="{ width: '32rem' }"
        :breakpoints="{ '640px': '95vw' }"
      >
        <form @submit.prevent="handleNoteSubmit" class="space-y-4 pt-4">
          <div>
            <label for="tipo" class="block text-sm font-medium mb-2">Tipo de Nota</label>
            <Select
              id="tipo"
              v-model="noteForm.tipo"
              :options="tipoNotaOptions"
              option-label="label"
              option-value="value"
              placeholder="Selecciona el tipo"
              class="w-full"
            />
          </div>

          <div>
            <label for="prioridad" class="block text-sm font-medium mb-2">Prioridad</label>
            <Select
              id="prioridad"
              v-model="noteForm.prioridad"
              :options="prioridadOptions"
              option-label="label"
              option-value="value"
              placeholder="Selecciona la prioridad"
              class="w-full"
            />
          </div>

          <!-- B1/B2: required fechaIncidente DatePicker. Backend enforces
               the 2-business-day hard block; the field-level 400 with
               { field: 'fechaIncidente' } is rendered inline below. -->
          <div>
            <label for="fechaIncidente" class="block text-sm font-medium mb-2">
              Fecha del incidente <span class="text-red-500">*</span>
            </label>
            <DatePicker
              id="fechaIncidente"
              v-model="noteForm.fechaIncidente"
              date-format="yy-mm-dd"
              show-icon
              class="w-full"
              :class="{ 'p-invalid': fechaIncidenteError }"
              :show-button-bar="true"
              data-testid="nota-fecha-incidente"
              @update:model-value="fechaIncidenteError = null"
            />
            <!-- B1/B2: inline field-level error (matches nomina CUENTA_COBRO pattern). -->
            <Message
              v-if="fechaIncidenteError"
              severity="error"
              :closable="true"
              class="mt-1"
              data-testid="nota-fecha-incidente-error"
              @close="fechaIncidenteError = null"
            >
              {{ fechaIncidenteError }}
            </Message>
          </div>

          <div>
            <label for="contenido" class="block text-sm font-medium mb-2">Contenido *</label>
            <Textarea
              id="contenido"
              v-model="noteForm.contenido"
              rows="5"
              placeholder="Escribe el contenido de la nota..."
              class="w-full"
              required
            />
          </div>

          <div class="flex justify-end gap-2">
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              @click="showNoteDialog = false"
              :disabled="submittingNote"
            />
            <Button
              type="submit"
              label="Guardar Nota"
              icon="pi pi-check"
              :loading="submittingNote"
              :disabled="!noteForm.contenido.trim() || !noteForm.fechaIncidente"
            />
          </div>
        </form>
      </Dialog>

      <!-- C1/C2: Single-step ficha dialog (assign + first update in one shot) -->
      <Dialog
        v-model:visible="showSingleStepDialog"
        modal
        :header="`Asignar y completar: ${singleStepForm.instrumentoNombre}`"
        :style="{ width: '34rem' }"
        :breakpoints="{ '640px': '95vw' }"
        data-testid="ficha-single-step-dialog"
      >
        <div class="space-y-5 pt-4">
          <!-- C2: download blank plantilla (renamed client-side). -->
          <div
            v-if="singleStepForm.plantillaArchivo"
            class="flex items-center justify-between gap-3 p-3 rounded-lg bg-[var(--surface-ground)]"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-[var(--text-color)]">Plantilla en blanco</p>
              <p class="text-xs text-[var(--text-color-secondary)]">
                Se descarga con el nombre del paciente para evitar confusiones.
              </p>
            </div>
            <Button
              label="Descargar plantilla"
              icon="pi pi-download"
              size="small"
              severity="secondary"
              outlined
              :loading="downloadingPlantilla"
              data-testid="ficha-descargar-plantilla"
              @click="downloadPlantillaRenamed"
            />
          </div>
          <div
            v-else-if="loadingInstrumentDetail"
            class="flex items-center gap-2 text-sm text-[var(--text-color-secondary)]"
          >
            <i class="pi pi-spin pi-spinner" /> Cargando instrumento…
          </div>

          <!-- REQUIRED: completed evaluation file. -->
          <div>
            <label class="block text-sm font-medium mb-2">
              Archivo de la evaluación <span class="text-red-500">*</span>
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">
                (evaluación diligenciada)
              </span>
            </label>
            <div class="flex items-center gap-3">
              <label
                class="flex items-center gap-2 px-4 py-2 border border-[var(--surface-border)] rounded-md cursor-pointer hover:bg-[var(--surface-hover)] transition-colors text-sm"
                @click="singleStepFileGuard.arm()"
              >
                <i class="pi pi-upload text-violet-500" />
                {{ singleStepFile ? singleStepFile.name : 'Seleccionar archivo' }}
                <input
                  type="file"
                  class="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  data-testid="ficha-single-step-file-input"
                  @change="onSingleStepFileSelected"
                />
              </label>
              <span v-if="singleStepFile" class="text-xs text-[var(--text-color-secondary)]">
                {{ (singleStepFile.size / 1024).toFixed(1) }} KB
              </span>
            </div>
            <p v-if="singleStepFile" class="mt-1.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <i class="pi pi-check-circle" /> Archivo seleccionado
            </p>
          </div>

          <!-- Optional notes. -->
          <div>
            <label for="singleStepNotas" class="block text-sm font-medium mb-2">
              Notas / Observaciones
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </label>
            <Textarea
              id="singleStepNotas"
              v-model="singleStepForm.notasObservaciones"
              rows="3"
              placeholder="Anota observaciones sobre la evaluación..."
              class="w-full"
              data-testid="ficha-single-step-notas"
            />
          </div>

          <!-- Optional next due-date. -->
          <div>
            <label for="singleStepVencimiento" class="block text-sm font-medium mb-2">
              Fecha de vencimiento
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </label>
            <DatePicker
              id="singleStepVencimiento"
              v-model="singleStepForm.fechaVencimiento"
              date-format="yy-mm-dd"
              show-icon
              class="w-full"
              :show-button-bar="true"
              data-testid="ficha-single-step-vencimiento"
            />
          </div>

          <!-- Footer actions. -->
          <div class="flex justify-end gap-2 pt-1">
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              :disabled="submittingSingleStep"
              @click="showSingleStepDialog = false"
            />
            <Button
              label="Asignar y completar"
              icon="pi pi-check"
              :loading="submittingSingleStep"
              :disabled="!singleStepFile || submittingSingleStep"
              data-testid="ficha-single-step-submit"
              @click="handleSingleStepSubmit"
            />
          </div>
        </div>
      </Dialog>

      <!-- B6: Ficha Status Dialog -->
      <Dialog
        v-model:visible="showFichaDialog"
        modal
        :header="`Actualizar Estado: ${fichaForm.instrumentoNombre}`"
        :style="{ width: '34rem' }"
        :breakpoints="{ '640px': '95vw' }"
      >
        <div class="space-y-5 pt-4">
          <!-- Current status display -->
          <div class="flex items-center gap-3 p-3 rounded-lg bg-[var(--surface-ground)]">
            <span class="text-sm text-[var(--text-color-secondary)]">Estado actual:</span>
            <Tag
              :value="fichaForm.currentEstado"
              :severity="estadoSeverityMap[fichaForm.currentEstado] || 'info'"
            />
          </div>

          <!-- Transition target — disabled only when no valid transitions exist. -->
          <div>
            <label for="newEstado" class="block text-sm font-medium mb-2">Nuevo Estado *</label>
            <div v-if="availableTransitions.length === 0"
              class="text-sm text-[var(--text-color-secondary)] italic">
              Este registro está en estado final y no puede cambiar.
            </div>
            <Select
              v-else
              id="newEstado"
              v-model="fichaForm.newEstado"
              :options="transitionOptions"
              option-label="label"
              option-value="value"
              placeholder="Selecciona el nuevo estado"
              class="w-full"
            />
          </div>

          <!-- Bug 2: free-form notes (always available, sent with the PATCH when set). -->
          <div>
            <label for="notasObservaciones" class="block text-sm font-medium mb-2">
              Notas / Observaciones
            </label>
            <Textarea
              id="notasObservaciones"
              v-model="fichaForm.notasObservaciones"
              rows="3"
              placeholder="Anota observaciones sobre el cambio de estado..."
              class="w-full"
            />
          </div>

          <!-- Bug 2: optional next due-date (e.g. to flag the next periodicidad). -->
          <div>
            <label for="fechaVencimiento" class="block text-sm font-medium mb-2">
              Próximo vencimiento
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
            </label>
            <DatePicker
              id="fechaVencimiento"
              v-model="fichaForm.fechaVencimiento"
              date-format="yy-mm-dd"
              show-icon
              class="w-full"
              :show-button-bar="true"
              data-testid="ficha-fecha-vencimiento"
            />
          </div>

          <!-- File upload — required when transitioning to COMPLETADO.
               If we restored `uploadedFileName` from sessionStorage but not the File,
               we show that name + a hint so the user knows to re-select. -->
          <div v-if="requiresFileUpload">
            <label class="block text-sm font-medium mb-2">
              Archivo de respaldo *
              <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">
                (requerido para marcar como completado)
              </span>
            </label>
            <div class="flex items-center gap-3">
              <label
                class="flex items-center gap-2 px-4 py-2 border border-[var(--surface-border)] rounded-md cursor-pointer hover:bg-[var(--surface-hover)] transition-colors text-sm"
                @click="fichaFileGuard.arm()"
              >
                <i class="pi pi-upload text-violet-500" />
                {{
                  uploadedFile
                    ? uploadedFile.name
                    : (uploadedFileName || 'Seleccionar archivo')
                }}
                <input
                  type="file"
                  class="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  data-testid="ficha-file-input"
                  @change="onFileSelected"
                />
              </label>
              <span v-if="uploadedFile" class="text-xs text-[var(--text-color-secondary)]">
                {{ (uploadedFile.size / 1024).toFixed(1) }} KB
              </span>
            </div>
            <p v-if="uploadedFile" class="mt-1.5 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <i class="pi pi-check-circle" /> Archivo seleccionado
            </p>
            <p v-else-if="uploadedFileName" class="mt-1.5 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <i class="pi pi-info-circle" /> Vuelve a seleccionar
              &laquo;{{ uploadedFileName }}&raquo; para continuar.
            </p>
          </div>

          <!-- Footer actions -->
          <div class="flex justify-end gap-2 pt-1">
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              :disabled="submittingFicha"
              @click="showFichaDialog = false"
            />
            <Button
              label="Guardar Cambios"
              icon="pi pi-save"
              :loading="submittingFicha || uploadingFile"
              :disabled="
                availableTransitions.length === 0
                  || !fichaForm.newEstado
                  || (requiresFileUpload && !uploadedFile)
              "
              @click="handleFichaSubmit"
            />
          </div>
        </div>
      </Dialog>
    </template>
  </div>
</template>
