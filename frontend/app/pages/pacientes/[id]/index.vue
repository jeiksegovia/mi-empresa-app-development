<script setup lang="ts">
import DynamicInstrumentForm from '~/components/instrument/DynamicInstrumentForm.vue'
import InstrumentResultView from '~/components/instrument/InstrumentResultView.vue'
import type {
  InstrumentDefinition,
  Respuestas,
} from '~/components/instrument/types'
import type { Domain } from '~/composables/useDomainAccess'

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
  instrumentoCodigo?: string | null
  estado: 'PENDIENTE' | 'COMPLETADO' | 'VENCIDO'
  fechaCompletado: string | null
  fechaVencimiento: string | null
  // Dynamic-instruments fields (W3 / W4 contract §4.4):
  puntajeTotal?: number | null
  clasificacion?: string | null
  skippedSections?: string[]
  subtotales?: Record<string, number | undefined>
  respuestas?: Respuestas | null
  instrumentoVersionId?: number | null
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
  codigo?: string | null
  tipo: string
  estado: string
  // W3 fields (backed by InstrumentoVersion + activeVersion from §4.1).
  activeVersion?: {
    id: number
    version: number
    activo: boolean
    createdAt: string
  } | null
  rolesPermitidos?: string
  periodicidad?: string
}

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()
// NOTE (W3) — file-based upload removed from instrument/ficha flows per
// contract §3.2/§3.3 (plantillaArchivo + archivoCompletado dropped from
// Instrumento / RegistroFichaCompletada). Employee/cert uploads remain.

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
  // §3.2: sin-definición instruments (no activeVersion) are not fillable →
  // disabled in the assign/llenar picker.
  ...instruments.value.map((i) => ({ ...i, _disabled: !i.activeVersion })),
  { id: CREATE_INSTRUMENT, nombreInstrumento: '➕ Crear instrumento nuevo', tipo: '', estado: '', _disabled: false },
])

// ── W3: Dynamic-instrument form dialogs ──────────────────────────────────────
// Contract §4.3 — assign + complete with respuestas (POST with respuestas).
const showFormDialog = ref(false)
const formDialogMode = ref<'assign' | 'complete'>('assign')
const formDialogTitle = ref('')
const formDialogFichaId = ref<number | null>(null)
const formDialogInstrument = ref<{
  id: number
  nombre: string
  codigo: string | null
} | null>(null)
const formDefinition = ref<InstrumentDefinition | null>(null)
const formRespuestas = ref<Respuestas>({})
const formNotas = ref('')
const formFechaVencimiento = ref('')
const submittingForm = ref(false)
const formDialogError = ref<string | null>(null)
const loadingDefinition = ref(false)

// View-result dialog (read-only InstrumentResultView over a completed ficha).
// BUG-W5-02 (W6): result dialog must work without opening the assign dialog first,
// so it loads its own definition into a dedicated ref instead of relying on
// `formDefinition` (which is only populated by the assign/complete dialogs).
const showResultDialog = ref(false)
const resultDialogFicha = ref<RegistroFicha | null>(null)
const resultDefinition = ref<InstrumentDefinition | null>(null)
const loadingResult = ref(false)

// ── B6: Ficha status dialog (kept for non-completado transitions e.g. → VENCIDO)
const showFichaDialog = ref(false)
const fichaForm = reactive({
  id: 0,
  currentEstado: 'PENDIENTE' as 'COMPLETADO' | 'PENDIENTE' | 'VENCIDO',
  newEstado: '' as 'COMPLETADO' | 'VENCIDO' | '',
  instrumentoNombre: '',
  // Free-form notes + optional next-due date.
  notasObservaciones: '',
  fechaVencimiento: '' as string,
})
const submittingFicha = ref(false)

const tabs = [
  { index: 0, label: 'Información Básica', icon: 'pi pi-user', domain: null as Domain | null },
  { index: 1, label: 'Fichas & Evaluaciones', icon: 'pi pi-file-check', domain: 'fichas' as Domain },
  { index: 2, label: 'Notas', icon: 'pi pi-book', domain: 'notas' as Domain },
]

// §1.5: hide the Fichas/Notas tabs when the profile lacks that domain.
const { can, canCreateOnly } = useDomainAccess()
const visibleTabs = computed(() => tabs.filter(t => !t.domain || can(t.domain)))

// If the active tab becomes hidden (e.g. profile without fichas), fall back to
// the first visible tab so the body is never blank.
watchEffect(() => {
  if (!visibleTabs.value.some(t => t.index === activeTab.value)) {
    activeTab.value = visibleTabs.value[0]?.index ?? 0
  }
})

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
        // QA jul-11 B2: DatePicker yields a Date — normalize to YYYY-MM-DD
        // or the backend schema rejects the ISO timestamp with a 400.
        fechaIncidente: toYMD(noteForm.fechaIncidente),
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
  const id = Number(val)
  const fromList = instruments.value.find((i) => i.id === id)
  openAsignarForm(id, fromList?.codigo ?? null)
}

async function openAsignarForm(instrumentoId: number, codigo: string | null) {
  formDialogMode.value = 'assign'
  formDialogTitle.value = 'Asignar y completar evaluación'
  formDialogFichaId.value = null
  const fromList = instruments.value.find((i) => i.id === instrumentoId)
  formDialogInstrument.value = {
    id: instrumentoId,
    nombre: fromList?.nombreInstrumento || 'Instrumento',
    codigo: codigo ?? fromList?.codigo ?? null,
  }
  formRespuestas.value = {}
  formNotas.value = ''
  formFechaVencimiento.value = ''
  formDialogError.value = null
  showFormDialog.value = true
  await loadInstrumentDefinition(codigo ?? fromList?.codigo ?? null)
}

async function openCompleteForm(ficha: RegistroFicha) {
  formDialogMode.value = 'complete'
  formDialogTitle.value = `Completar: ${ficha.instrumento?.nombreInstrumento ?? ficha.instrumentoNombre ?? 'Ficha'}`
  formDialogFichaId.value = ficha.id
  formDialogInstrument.value = {
    id: ficha.instrumentoId,
    nombre: ficha.instrumento?.nombreInstrumento ?? ficha.instrumentoNombre ?? 'Instrumento',
    codigo: ficha.instrumentoCodigo ?? null,
  }
  formRespuestas.value = {}
  formNotas.value = ''
  formFechaVencimiento.value = ''
  formDialogError.value = null
  showFormDialog.value = true
  await loadInstrumentDefinition(ficha.instrumentoCodigo ?? null)
}

async function loadInstrumentDefinition(codigo: string | null) {
  if (!codigo) {
    formDefinition.value = null
    formDialogError.value = 'No se pudo cargar la definición del instrumento (falta codigo).'
    return
  }
  loadingDefinition.value = true
  try {
    const res = await apiFetch<{
      success: boolean
      data: {
        instrumento: { id: number; codigo: string; nombre: string; tipo: string }
        version: { id: number; version: number; definition: InstrumentDefinition }
      }
    }>(`/instruments/${codigo}/definition`)
    formDefinition.value = res.data.version.definition
  } catch (e: any) {
    console.error('Error loading instrument definition:', e)
    formDefinition.value = null
    formDialogError.value =
      e?.data?.message || e?.message || 'No se pudo cargar la definición.'
  } finally {
    loadingDefinition.value = false
  }
}

async function openResultDialog(ficha: RegistroFicha) {
  resultDialogFicha.value = ficha
  resultDefinition.value = null
  showResultDialog.value = true
  loadingResult.value = true
  try {
    // Always re-fetch to ensure we have the latest respuestas/subtotales.
    const res = await apiFetch<{
      success: boolean
      data: RegistroFicha & { instrumentoCodigo?: string }
    }>(`/patients/${patient.value!.id}/fichas/${ficha.id}`)
    if (res?.success) resultDialogFicha.value = res.data

    // BUG-W5-02 (W6): the result dialog must render even when the user opens
    // it directly via "Ver detalle" without first opening the assign dialog.
    // We resolve the codigo from the loaded instruments list (which is in
    // memory thanks to onMounted -> fetchInstruments) and pull the definition
    // into the dedicated `resultDefinition` ref.
    const codigo = await resolveInstrumentCodigo(resultDialogFicha.value)
    if (codigo) {
      await loadResultDefinition(codigo)
    } else {
      // No codigo means we cannot render the result breakdown — fall through
      // with resultDefinition=null so the empty-state path renders.
      console.warn('Result dialog: no codigo resolvable for instrumentoId', resultDialogFicha.value?.instrumentoId)
    }
  } catch (e) {
    // Fall back to the table row — at least we have something to render.
    console.error('Error loading ficha detail:', e)
  } finally {
    loadingResult.value = false
  }
}

async function resolveInstrumentCodigo(ficha: RegistroFicha | null): Promise<string | null> {
  if (!ficha) return null
  // 1. Already on the ficha row (works when the GET /fichas/:id response
  //    surfaces it; some endpoints may not).
  if (ficha.instrumentoCodigo) return ficha.instrumentoCodigo
  // 2. Look up in the in-memory instrument list (fetchInstruments in onMounted).
  const fromList = instruments.value.find((i) => i.id === ficha.instrumentoId)
  return fromList?.codigo ?? null
}

async function loadResultDefinition(codigo: string) {
  try {
    const res = await apiFetch<{
      success: boolean
      data: {
        instrumento: { id: number; codigo: string; nombre: string; tipo: string }
        version: { id: number; version: number; definition: InstrumentDefinition }
      }
    }>(`/instruments/${codigo}/definition`)
    resultDefinition.value = res.data.version.definition
  } catch (e: any) {
    console.error('Error loading instrument definition (result dialog):', e)
    resultDefinition.value = null
  }
}

async function submitForm() {
  if (!patient.value || !formDialogInstrument.value || !formDefinition.value) return
  submittingForm.value = true
  formDialogError.value = null
  try {
    const payload: Record<string, unknown> = {}
    const notas = formNotas.value.trim()
    if (notas) payload.notasObservaciones = notas
    const fechaVenc = toYMD(formFechaVencimiento.value)
    if (fechaVenc) payload.fechaVencimiento = fechaVenc

    if (formDialogMode.value === 'assign') {
      // Contract §4.3: POST with respuestas present → single-step assign+complete.
      // G2-11: server resolves instrumentoVersionId from the active version
      // (any client-supplied value is ignored). G2-12: server defaults
      // versionRegistro to `v{version}` from the resolved version. We send
      // just the keys the server needs.
      payload.instrumentoId = formDialogInstrument.value.id
      payload.respuestas = formRespuestas.value
      await apiFetch(`/patients/${patient.value.id}/fichas`, {
        method: 'POST',
        body: payload,
      })
    } else {
      // Contract §4.3b: PATCH completar a pending ficha.
      payload.respuestas = formRespuestas.value
      await apiFetch(
        `/patients/${patient.value.id}/fichas/${formDialogFichaId.value}/completar`,
        { method: 'PATCH', body: payload },
      )
    }
    await fetchPatient()
    showFormDialog.value = false
    selectedInstrumentId.value = null
    formDialogIsDirty.value = false
    toast.add({
      severity: 'success',
      summary: 'Ficha guardada',
      detail: formDialogMode.value === 'assign'
        ? 'La evaluación se registró como COMPLETADO.'
        : 'La evaluación pendiente se completó correctamente.',
      life: 3500,
    })
  } catch (e: any) {
    console.error('Error submitting form:', e)
    const msg = e?.data?.message || e?.message || 'Error al guardar la evaluación'
    formDialogError.value = msg
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally {
    submittingForm.value = false
  }
}

// Jul-22 §8: form-fill dialog cancel-with-dirty guard. The fill dialog is not
// a separate route, so SPA-leave doesn't apply; we protect the Cancel button
// and the dialog hide event with a confirm() prompt when there are unsaved
// answers/notes/fechaVencimiento. Submit (above) resets dirty on success.
const formDialogIsDirty = ref(false)
watch(
  () => [
    JSON.stringify(formRespuestas.value),
    formNotas.value,
    formFechaVencimiento.value ? '1' : '',
  ],
  () => {
    const resp = formRespuestas.value ?? {}
    const hasAnswers =
      Object.keys(resp).length > 0 &&
      Object.values(resp).some((v) => {
        if (v === undefined || v === null || v === '') return false
        if (Array.isArray(v)) return v.length > 0
        return true
      })
    formDialogIsDirty.value =
      hasAnswers || !!formNotas.value.trim() || !!formFechaVencimiento.value
  },
  { deep: true },
)

function closeFormDialog() {
  if (formDialogIsDirty.value && !submittingForm.value) {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      'Tienes respuestas sin guardar en esta evaluación. ¿Cerrar y descartar?',
    )
    if (!ok) return
  }
  showFormDialog.value = false
  selectedInstrumentId.value = null
  formDialogIsDirty.value = false
}

function closeResultDialog() {
  showResultDialog.value = false
  resultDialogFicha.value = null
  resultDefinition.value = null
}

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
  // W3: file-upload removed; this dialog now only handles → VENCIDO
  // transitions (PENDIENTE/COMPLETADO → VENCIDO). Going to COMPLETADO is
  // handled by openCompleteForm() via the dynamic form (PATCH /completar).
  fichaForm.id = ficha.id
  fichaForm.currentEstado = ficha.estado
  fichaForm.newEstado = ''
  fichaForm.instrumentoNombre =
    ficha.instrumento?.nombreInstrumento
    || ficha.instrumentoNombre
    || 'Ficha'
  fichaForm.notasObservaciones = ''
  fichaForm.fechaVencimiento = ''
  showFichaDialog.value = true
}

async function handleFichaSubmit() {
  if (!fichaForm.id || !fichaForm.newEstado || !patient.value) return

  submittingFicha.value = true
  try {
    const notas = fichaForm.notasObservaciones.trim()
    // QA jul-11 B1 parity: normalize the DatePicker Date to YYYY-MM-DD.
    const fechaVenc = toYMD(fichaForm.fechaVencimiento)
    // Contract §4.6: → VENCIDO is still a status-only transition
    // (no archivoCompletado; the contract dropped that field).
    await apiFetch(`/patients/${patient.value.id}/fichas/${fichaForm.id}/status`, {
      method: 'PATCH',
      body: {
        estado: fichaForm.newEstado,
        ...(notas ? { notasObservaciones: notas } : {}),
        ...(fechaVenc ? { fechaVencimiento: fechaVenc } : {}),
      },
    })

    await fetchPatient()
    showFichaDialog.value = false
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
          <Button v-if="!canCreateOnly('pacientes')" label="Editar" icon="pi pi-pencil" severity="info" @click="navigateTo(`/pacientes/${patient.id}/editar`)" />
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
          v-for="tab in visibleTabs"
          :key="tab.index"
          :class="[
            'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === tab.index
              ? 'border-violet-500 text-violet-600 dark:text-violet-400'
              : 'border-transparent text-[var(--text-color-secondary)] hover:text-[var(--text-color)]'
          ]"
          @click="activeTab = tab.index"
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
      <div v-if="can('fichas')" v-show="activeTab === 1" class="space-y-4">

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
                option-disabled="_disabled"
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
                  <span v-else class="flex items-center gap-2">
                    <span>{{ option.nombreInstrumento }}</span>
                    <Tag
                      v-if="option._disabled"
                      value="Sin definición"
                      severity="warn"
                      data-testid="picker-sin-definicion"
                    />
                  </span>
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

              <Column header="Acciones" style="min-width: 180px">
                <template #body="{ data }">
                  <div class="flex items-center gap-1">
                    <!-- W3: View completed-detail result view (contract §4.4). -->
                    <Button
                      v-if="data.estado === 'COMPLETADO'"
                      icon="pi pi-eye"
                      size="small"
                      severity="info"
                      text
                      rounded
                      v-tooltip.top="'Ver detalle'"
                      data-testid="ficha-view-result"
                      @click="openResultDialog(data)"
                    />
                    <!-- W3: Completar / Re-completar pending/vencida ficha
                         (contract §4.3b PATCH .../completar). -->
                    <Button
                      v-if="data.estado !== 'COMPLETADO'"
                      icon="pi pi-pencil"
                      size="small"
                      severity="success"
                      text
                      rounded
                      v-tooltip.top="data.estado === 'PENDIENTE' ? 'Completar evaluación' : 'Re-completar evaluación'"
                      data-testid="ficha-complete"
                      @click="openCompleteForm(data)"
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
      <div v-if="can('notas')" v-show="activeTab === 2" class="space-y-4">
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

      <!-- W3: Dynamic-instrument form dialog (assign + complete flows). -->
      <Dialog
        v-model:visible="showFormDialog"
        modal
        :header="formDialogTitle"
        :style="{ width: 'min(64rem, 95vw)' }"
        :breakpoints="{ '640px': '95vw' }"
        data-testid="ficha-form-dialog"
      >
        <div class="space-y-4 pt-4">
          <!-- Loading / error states -->
          <div
            v-if="loadingDefinition"
            class="flex items-center gap-2 text-sm text-[var(--text-color-secondary)]"
          >
            <i class="pi pi-spin pi-spinner" /> Cargando definición del instrumento…
          </div>

          <Message
            v-else-if="formDialogError"
            severity="error"
            :closable="false"
            data-testid="form-dialog-error"
          >
            {{ formDialogError }}
          </Message>

          <!-- Read-only patient header band (contract §7). NEVER renders as form items. -->
          <Card v-if="patient">
            <template #content>
              <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div class="flex items-center gap-3">
                  <Avatar
                    :label="patient.nombre?.[0]?.toUpperCase() ?? '?'"
                    shape="circle"
                    class="bg-violet-500 text-white font-bold"
                  />
                  <div>
                    <p class="font-semibold text-[var(--text-color)]">{{ patient.nombre }}</p>
                    <p class="text-xs text-[var(--text-color-secondary)]">
                      {{ patient.tipoDocumento }} {{ patient.numeroDocumento }}
                      · {{ calculateAge(patient.fechaNacimiento) }} años · {{ patient.genero }}
                    </p>
                  </div>
                </div>
                <div class="text-xs text-[var(--text-color-secondary)] text-right">
                  <p><strong>Instrumento:</strong> {{ formDialogInstrument?.nombre }}</p>
                </div>
              </div>
            </template>
          </Card>

          <!-- THE dynamic form -->
          <DynamicInstrumentForm
            v-if="formDefinition"
            :definition="formDefinition"
            v-model="formRespuestas"
          />

          <!-- Optional metadata (notas + fechaVencimiento) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--surface-border)]">
            <div>
              <label for="formNotas" class="block text-sm font-medium mb-2">
                Notas / Observaciones
                <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
              </label>
              <Textarea
                id="formNotas"
                v-model="formNotas"
                rows="3"
                placeholder="Anota observaciones sobre la evaluación..."
                class="w-full"
                data-testid="form-notas"
              />
            </div>
            <div>
              <label for="formFechaVencimiento" class="block text-sm font-medium mb-2">
                Fecha de vencimiento
                <span class="text-xs font-normal text-[var(--text-color-secondary)] ml-1">(opcional)</span>
              </label>
              <DatePicker
                id="formFechaVencimiento"
                v-model="formFechaVencimiento"
                date-format="yy-mm-dd"
                show-icon
                class="w-full"
                :show-button-bar="true"
                data-testid="form-fecha-vencimiento"
              />
            </div>
          </div>

          <!-- Footer actions -->
          <div class="flex justify-end gap-2 pt-2">
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              :disabled="submittingForm"
              @click="closeFormDialog"
            />
            <Button
              :label="formDialogMode === 'assign' ? 'Asignar y completar' : 'Guardar evaluación'"
              icon="pi pi-check"
              :loading="submittingForm"
              :disabled="!formDefinition || submittingForm"
              data-testid="form-submit"
              @click="submitForm"
            />
          </div>
        </div>
      </Dialog>

      <!-- W3: Result view dialog (read-only). -->
      <Dialog
        v-model:visible="showResultDialog"
        modal
        :header="`Detalle: ${resultDialogFicha?.instrumento?.nombreInstrumento ?? resultDialogFicha?.instrumentoNombre ?? 'Ficha'}`"
        :style="{ width: 'min(56rem, 95vw)' }"
        :breakpoints="{ '640px': '95vw' }"
        data-testid="ficha-result-dialog"
      >
        <div class="pt-4">
          <div v-if="loadingResult" class="flex items-center gap-2 text-sm text-[var(--text-color-secondary)] py-6">
            <i class="pi pi-spin pi-spinner" /> Cargando detalle…
          </div>
          <InstrumentResultView
            v-else-if="resultDialogFicha?.respuestas && resultDefinition"
            :definition="resultDefinition"
            :respuestas="resultDialogFicha.respuestas ?? null"
            :subtotales="resultDialogFicha.subtotales ?? null"
            :puntaje-total="resultDialogFicha.puntajeTotal ?? null"
            :clasificacion="resultDialogFicha.clasificacion ?? null"
            :skipped-sections="resultDialogFicha.skippedSections ?? []"
          />
          <div v-else class="text-center py-8 text-[var(--text-color-secondary)] text-sm">
            <i class="pi pi-info-circle text-3xl block mb-2" />
            Esta ficha no tiene respuestas registradas (estado
            {{ resultDialogFicha?.estado ?? '—' }}).
          </div>
        </div>
        <template #footer>
          <Button
            label="Cerrar"
            severity="secondary"
            outlined
            @click="closeResultDialog"
          />
        </template>
      </Dialog>

      <!-- B6: Ficha Status Dialog (kept for → VENCIDO transitions; no file UI). -->
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

          <!-- Free-form notes + optional next due-date (no file UI per W3). -->
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
              :loading="submittingFicha"
              :disabled="availableTransitions.length === 0 || !fichaForm.newEstado"
              @click="handleFichaSubmit"
            />
          </div>
        </div>
      </Dialog>
    </template>
  </div>
</template>
