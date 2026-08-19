<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'default' })

const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { uploadFile, downloadFile } = useFileUpload()

interface Contrato {
  id: number
  tipoContrato: 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO'
  fechaInicio: string
  fechaFin: string | null
  archivoUrl: string | null
  activo: boolean
  valorJornada?: number | string | null
  // qa-session-jul-31 R2: surface the monthly value so the Registrar
  // dialog can prefill the base for OBRA_O_LABOR / TERMINO_FIJO /
  // TERMINO_INDEFINIDO contracts. Nullable per backend contract §2.
  valorMensual?: number | string | null
}

interface NominaArchivo {
  tipoArchivo: 'CUENTA_COBRO' | 'INFORME_ACTIVIDADES' | 'COMPROBANTE_APORTES' | 'DESPRENDIBLE' | 'OTRO'
  nombre: string
  url: string
}

interface NominaEntrada {
  id: number
  periodo: string
  tipoContrato: string
  salario: number | null
  notas: string | null
  archivos: NominaArchivo[]
  // nomina-asistencia-jul-18 calc fields
  mediasJornadas?: number | string | null
  valorJornada?: number | string | null
  valorMensual?: number | string | null
  // qa-session-aug-17 R3: additive bonos (FIJO/INDEF only).
  bonos?: number | string | null
  subtotalCalculado?: number | string | null
  aportesSociales?: number | string | null
  totalPagado?: number | string | null
}

interface EmpleadoNomina {
  id: number
  nombre: string
  apellido: string
  numeroDocumento: string
  medioPagoTipo?: 'NEQUI' | 'TRANSFERENCIA_BANCARIA' | null
  medioPagoNequi?: string | null
  bancoNombre?: string | null
  bancoTipoCuenta?: 'AHORRO' | 'CORRIENTE' | null
  bancoNumeroCuenta?: string | null
}

interface NominaSugeridoLocal {
  mediasJornadas: number | null
  valorJornada: number | null
  // qa-session-jul-31 R2: nullable for OPS, populated for OBRA/FIJO/INDEF.
  valorMensual: number | null
  // qa-session-aug-17 R3: optional suggestion for FIJO/INDEF.
  bonos?: number | null
  subtotalCalculado: number | null
  aportesSociales: number
  totalPagado: number
}

interface NominaRow {
  empleado: EmpleadoNomina
  contratoActivo: Contrato | null
  entrada: NominaEntrada | null
  cargoSalario: number | string | null
  asistenciaMes?: { mediasJornadas: number; horas: number }
  sugerido?: NominaSugeridoLocal
}

const periodRef = ref<string>('')
const rows = ref<NominaRow[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingRow = ref<NominaRow | null>(null)
const editingTipo = ref<'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO' | ''>('')

// D5: server-side tipoContrato filter. UI uses 'SIN_CONTRATO', wire uses 'NONE'.
const TIPO_FILTER_OPTIONS = [
  { label: 'OPS', value: 'OPS', wireValue: 'OPS' },
  { label: 'Obra o labor', value: 'OBRA_O_LABOR', wireValue: 'OBRA_O_LABOR' },
  { label: 'Término fijo', value: 'TERMINO_FIJO', wireValue: 'TERMINO_FIJO' },
  { label: 'Término indefinido', value: 'TERMINO_INDEFINIDO', wireValue: 'TERMINO_INDEFINIDO' },
  { label: 'Sin contrato', value: 'SIN_CONTRATO', wireValue: 'NONE' },
]
const selectedTipoFilter = ref<string[]>(['OPS', 'OBRA_O_LABOR', 'TERMINO_FIJO', 'TERMINO_INDEFINIDO'])

function buildTipoContratoQuery(): string {
  if (selectedTipoFilter.value.length === 0) return ''
  return selectedTipoFilter.value
    .map((v) => TIPO_FILTER_OPTIONS.find((o) => o.value === v)?.wireValue ?? v)
    .join(',')
}

// D4: backend returns { field: 'archivos.CUENTA_COBRO', message } when cuenta-de-cobro is missing.
// Render that inline next to the slot.
const cuentaCobroError = ref<string | null>(null)

// A: per-slot upload spinner tracking. Keys are NominaArchivo['tipoArchivo'] or 'OTRO'.
const uploadingSlots = reactive<Record<string, boolean>>({})
// B: saving spinner for the Guardar button.
const savingEntrada = ref(false)
// C: read-only detail dialog state.
const detailsRow = ref<NominaRow | null>(null)
const detailsVisible = ref(false)

// Dialog form — nomina-asistencia-jul-18 calc fields + legacy salario dual-write
const dialogForm = reactive({
  salario: null as number | null,
  mediasJornadas: null as number | null,
  valorJornada: null as number | null,
  // qa-session-jul-31 R2: base for OBRA/FIJO/INDEF contracts. Hidden
  // input on OPS — recomputeSubtotal writes there indirectly.
  valorMensual: null as number | null,
  // qa-session-aug-17 R3: bonos only for TERMINO_FIJO | TERMINO_INDEFINIDO.
  bonos: null as number | null,
  subtotalCalculado: null as number | null,
  aportesSociales: null as number | null,
  totalPagado: null as number | null,
  notas: '',
  archivos: [] as NominaArchivo[],
})

/** True when aportes sociales apply (TERMINO_FIJO | TERMINO_INDEFINIDO). */
const aportesAllowed = computed(() => {
  const t = editingTipo.value
  return t === 'TERMINO_FIJO' || t === 'TERMINO_INDEFINIDO'
})

/** qa-session-aug-17 R3 / contract §3.2: bonos only for FIJO/INDEF. */
const bonosAllowed = computed(() => {
  const t = editingTipo.value
  return t === 'TERMINO_FIJO' || t === 'TERMINO_INDEFINIDO'
})

/** qa-session-jul-31 R2: True for non-OPS contracts where the dialog
 *  branches to the Valor Mensual layout (hide jornada inputs, show a
 *  base input that drives the subtotal). OPS path is unchanged. */
const usaValorMensual = computed(() => {
  const t = editingTipo.value
  return (
    t === 'OBRA_O_LABOR' ||
    t === 'TERMINO_FIJO' ||
    t === 'TERMINO_INDEFINIDO'
  )
})

/** Complete medio display, or null when missing/incomplete → warning. */
function medioPagoDisplay(emp: EmpleadoNomina): string | null {
  if (emp.medioPagoTipo === 'NEQUI' && emp.medioPagoNequi) {
    // qa-session-jul-31 R1: display label includes Bre-B alias. Stored
    // enum value stays `NEQUI`; this is display-only.
    return `Nequi/Bre-B · ${emp.medioPagoNequi}`
  }
  if (emp.medioPagoTipo === 'TRANSFERENCIA_BANCARIA') {
    const tipo =
      emp.bancoTipoCuenta === 'AHORRO'
        ? 'Ahorro'
        : emp.bancoTipoCuenta === 'CORRIENTE'
          ? 'Corriente'
          : emp.bancoTipoCuenta
    const parts = [emp.bancoNombre, tipo, emp.bancoNumeroCuenta].filter(Boolean)
    if (parts.length >= 2) return `Transferencia · ${parts.join(' · ')}`
  }
  return null
}

const tipoContratoLabel = (tipo: string) =>
  ({
    OPS: 'OPS',
    OBRA_O_LABOR: 'Obra o labor',
    TERMINO_FIJO: 'Término fijo',
    TERMINO_INDEFINIDO: 'Término indefinido',
  }[tipo] || tipo)

function recomputeSubtotal() {
  // qa-session-jul-31 R2 + qa-session-aug-17 R3:
  // OPS keeps medias × valorJornada (unchanged this cycle — contract D4).
  // FIJO/INDEF: subtotal = valorMensual + bonos (aportes NOT added).
  // OBRA: subtotal stays null; total = valorMensual (contract D5).
  if (editingTipo.value === 'OBRA_O_LABOR') {
    dialogForm.subtotalCalculado = null
    recomputeTotal()
    return
  }
  if (bonosAllowed.value) {
    const v = Number(dialogForm.valorMensual ?? 0)
    const b = Number(dialogForm.bonos ?? 0)
    dialogForm.subtotalCalculado = v + b
    recomputeTotal()
    return
  }
  if (usaValorMensual.value) {
    dialogForm.subtotalCalculado = dialogForm.valorMensual ?? 0
    recomputeTotal()
    return
  }
  const m = dialogForm.mediasJornadas
  const v = dialogForm.valorJornada
  if (m == null || v == null) {
    dialogForm.subtotalCalculado = 0
  } else {
    dialogForm.subtotalCalculado = Number(m) * Number(v)
  }
  recomputeTotal()
}

function recomputeTotal() {
  // qa-session-aug-17 R3 / contract §3.3:
  // FIJO/INDEF: totalPagado = valorMensual + bonos (aportes stored, NOT added).
  // OBRA: totalPagado = valorMensual.
  // OPS: keep prior behavior (subtotal + aportes when applicable).
  if (bonosAllowed.value) {
    const v = Number(dialogForm.valorMensual ?? 0)
    const b = Number(dialogForm.bonos ?? 0)
    dialogForm.totalPagado = v + b
  } else if (editingTipo.value === 'OBRA_O_LABOR') {
    dialogForm.totalPagado = Number(dialogForm.valorMensual ?? 0)
  } else {
    const sub = dialogForm.subtotalCalculado ?? 0
    const ap = aportesAllowed.value ? (dialogForm.aportesSociales ?? 0) : 0
    dialogForm.totalPagado = Number(sub) + Number(ap)
  }
  // Dual-write mirror for legacy salario field display
  dialogForm.salario = dialogForm.totalPagado
}

const requiredSlotsForTipo = (tipo: string) => {
  if (tipo === 'OPS' || tipo === 'OBRA_O_LABOR') {
    return ['CUENTA_COBRO', 'INFORME_ACTIVIDADES', 'COMPROBANTE_APORTES'] as const
  }
  if (tipo === 'TERMINO_FIJO' || tipo === 'TERMINO_INDEFINIDO') {
    return ['DESPRENDIBLE'] as const
  }
  return [] as const
}

const archivoLabel = (ta: string) => {
  return {
    CUENTA_COBRO: 'Cuenta de cobro',
    INFORME_ACTIVIDADES: 'Informe de actividades',
    COMPROBANTE_APORTES: 'Comprobante de aportes',
    DESPRENDIBLE: 'Desprendible de pago',
    OTRO: 'Otro',
  }[ta] || ta
}

function currentPeriodYYYYMM(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

async function fetchRows() {
  if (!periodRef.value) return
  loading.value = true
  try {
    const tipoQuery = buildTipoContratoQuery()
    const url = tipoQuery
      ? `/nomina?periodo=${periodRef.value}&tipoContrato=${encodeURIComponent(tipoQuery)}`
      : `/nomina?periodo=${periodRef.value}`
    const res = await apiFetch<{ success: boolean; data: NominaRow[] }>(url)
    rows.value = res.data ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la nómina' })
  } finally {
    loading.value = false
  }
}

function openDialog(row: NominaRow) {
  editingRow.value = row
  editingTipo.value = (row.contratoActivo?.tipoContrato ?? '') as any
  const sug = row.sugerido
  const ent = row.entrada
  // Prefer existing entrada values; fall back to sugerido / asistenciaMes / contrato.
  const n = (v: unknown) => (v != null && v !== '' ? Number(v) : null)

  // qa-session-jul-31 R2: prefill source depends on the contrato tipo.
  // OPS still reads medias × valorJornada. Non-OPS reads valorMensual
  // (entrada first, then sugerido, then contrato, per contract §3).
  if (usaValorMensual.value) {
    dialogForm.valorMensual =
      n(ent?.valorMensual) ?? n(sug?.valorMensual) ?? n(row.contratoActivo?.valorMensual) ?? null
  } else {
    dialogForm.mediasJornadas =
      n(ent?.mediasJornadas) ?? n(sug?.mediasJornadas) ?? n(row.asistenciaMes?.mediasJornadas) ?? 0
    dialogForm.valorJornada =
      n(ent?.valorJornada) ?? n(sug?.valorJornada) ?? n(row.contratoActivo?.valorJornada) ?? null
  }
  // qa-session-aug-17 R3: prefill bonos for FIJO/INDEF; force null otherwise.
  if (bonosAllowed.value) {
    dialogForm.bonos = n(ent?.bonos) ?? n(sug?.bonos) ?? 0
  } else {
    dialogForm.bonos = null
  }
  dialogForm.subtotalCalculado =
    n(ent?.subtotalCalculado) ?? n(sug?.subtotalCalculado) ?? null
  dialogForm.aportesSociales =
    n(ent?.aportesSociales) ?? n(sug?.aportesSociales) ?? 0
  dialogForm.totalPagado =
    n(ent?.totalPagado) ?? n(ent?.salario) ?? n(sug?.totalPagado) ?? null
  // Legacy salario: mirror totalPagado for dual-write UX.
  dialogForm.salario =
    dialogForm.totalPagado != null
      ? dialogForm.totalPagado
      : row.cargoSalario != null
        ? Number(row.cargoSalario)
        : null
  // Always recompute FIJO/INDEF/OBRA so the new formula (mensual+bonos,
  // aportes not added) wins over stale entrada totals from prior cycles.
  if (bonosAllowed.value || editingTipo.value === 'OBRA_O_LABOR') {
    recomputeSubtotal()
  } else if (dialogForm.subtotalCalculado == null) {
    recomputeSubtotal()
  } else if (dialogForm.totalPagado == null) {
    recomputeTotal()
  }
  // OPS/OBRA force aportes 0 on open (server also rejects >0).
  if (!aportesAllowed.value) {
    dialogForm.aportesSociales = 0
  }
  dialogForm.notas = ent?.notas ?? ''
  dialogForm.archivos = (ent?.archivos ?? []).map((a) => ({ ...a }))
  // Clear any inline error from a previous open.
  cuentaCobroError.value = null
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
  editingRow.value = null
  editingTipo.value = ''
  dialogForm.salario = null
  dialogForm.mediasJornadas = null
  dialogForm.valorJornada = null
  dialogForm.valorMensual = null
  dialogForm.bonos = null
  dialogForm.subtotalCalculado = null
  dialogForm.aportesSociales = null
  dialogForm.totalPagado = null
  dialogForm.notas = ''
  dialogForm.archivos = []
  cuentaCobroError.value = null
}

async function uploadAndAttach(file: File, tipoArchivo: NominaArchivo['tipoArchivo']) {
  const key = await uploadFile(file, 'nomina')
  if (key) {
    dialogForm.archivos.push({ tipoArchivo, nombre: file.name, url: key })
  }
}

function onSlotFileChange(tipoArchivo: NominaArchivo['tipoArchivo'], event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    uploadingSlots[tipoArchivo] = true
    uploadAndAttach(input.files[0], tipoArchivo)
      .catch(() => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir archivo' })
      })
      .finally(() => {
        uploadingSlots[tipoArchivo] = false
      })
    input.value = ''
  }
}

function addOtroSlot(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    uploadingSlots['OTRO'] = true
    uploadAndAttach(input.files[0], 'OTRO')
      .catch(() => {
        toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir archivo' })
      })
      .finally(() => {
        uploadingSlots['OTRO'] = false
      })
    input.value = ''
  }
}

function removeArchivo(i: number) {
  dialogForm.archivos.splice(i, 1)
}

async function saveEntrada() {
  if (!editingRow.value) return
  const id = editingRow.value.empleado.id
  // Only POST if no entrada yet (PUT requires existing id)
  const isUpdate = !!editingRow.value.entrada
  // Clear any inline error before submitting again.
  cuentaCobroError.value = null
  savingEntrada.value = true
  try {
    const calcBody: Record<string, unknown> = {
      mediasJornadas: dialogForm.mediasJornadas,
      valorJornada: dialogForm.valorJornada,
      // qa-session-jul-31 R2: send the Valor Mensual base for
      // OBRA/FIJO/INDEF contracts. The backend already accepts this on
      // jul-24 R7; including it here just keeps the dialog round-trip
      // honest. For OPS we explicitly null it out (no stale column).
      valorMensual: usaValorMensual.value ? (dialogForm.valorMensual ?? 0) : null,
      // qa-session-aug-17 R3: include bonos for FIJO/INDEF; omit/null for OPS/OBRA.
      bonos: bonosAllowed.value ? (dialogForm.bonos ?? 0) : null,
      subtotalCalculado: dialogForm.subtotalCalculado,
      aportesSociales: aportesAllowed.value ? (dialogForm.aportesSociales ?? 0) : 0,
      totalPagado: dialogForm.totalPagado,
      // Dual-write: salario mirrors totalPagado (server also sets this).
      salario: dialogForm.totalPagado ?? dialogForm.salario,
      notas: dialogForm.notas.trim() || null,
      archivos: dialogForm.archivos,
    }
    if (isUpdate) {
      await apiFetch(`/nomina/periodos/${editingRow.value.entrada!.id}`, {
        method: 'PUT',
        body: calcBody,
      })
    } else {
      await apiFetch('/nomina/periodos', {
        method: 'POST',
        body: {
          empleadoId: id,
          periodo: periodRef.value,
          ...calcBody,
        },
      })
    }
    closeDialog()
    await fetchRows()
  } catch (e: any) {
    // D4: backend returns { field: 'archivos.CUENTA_COBRO', message } on this specific 400.
    if (e?.data?.field === 'archivos.CUENTA_COBRO') {
      cuentaCobroError.value = e.data.message || 'Falta la cuenta de cobro.'
    }
    const detail = e?.data?.message || e?.message || 'Error al guardar la entrada'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    savingEntrada.value = false
  }
}

function openDetails(row: NominaRow) {
  detailsRow.value = row
  detailsVisible.value = true
}

function statusBadge(row: NominaRow): { label: string; severity: 'success' | 'danger' | 'secondary' } {
  if (!row.contratoActivo) return { label: 'Sin contrato', severity: 'danger' }
  if (row.entrada) return { label: '✓ Completa', severity: 'success' }
  return { label: 'Falta', severity: 'secondary' }
}

function downloadArchivo(key: string) {
  return downloadFile(key)
}

onMounted(async () => {
  periodRef.value = currentPeriodYYYYMM()
  await fetchRows()
})

// D5: when the tipoContrato filter changes, refetch the rows.
watch(selectedTipoFilter, () => { fetchRows() })
</script>

<template>
  <div>
    <AppPageHeader title="Nómina" subtitle="Período y entradas por empleado">
      <template #actions>
        <input
          type="month"
          v-model="periodRef"
          class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
          @change="fetchRows"
          data-testid="nomina-periodo"
        />
      </template>
    </AppPageHeader>


    <!-- D5: filter by tipoContrato (multi-select). Default = all 4 tipos activos, no 'SIN_CONTRATO'. -->
    <Card class="mb-4">
      <template #content>
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <label class="text-sm font-medium text-[var(--text-color)] sm:w-44">
            Tipos de contrato
          </label>
          <MultiSelect
            v-model="selectedTipoFilter"
            :options="TIPO_FILTER_OPTIONS"
            option-label="label"
            option-value="value"
            placeholder="Selecciona tipos de contrato"
            class="w-full"
            display="chip"
            data-testid="nomina-tipo-filter"
          />
          <Button
            v-if="selectedTipoFilter.length === 0"
            label="Incluir sin contrato"
            icon="pi pi-plus"
            size="small"
            severity="secondary"
            text
            @click="selectedTipoFilter = ['OPS','OBRA_O_LABOR','TERMINO_FIJO','TERMINO_INDEFINIDO','SIN_CONTRATO']"
          />
        </div>
      </template>
    </Card>

    <Card>
      <template #content>
        <DataTable
          :value="rows"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="empleado.id"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              Sin empleados activos en este período.
            </div>
          </template>

          <Column header="Empleado" style="min-width: 220px">
            <template #body="{ data }">
              <div>
                <p class="font-medium">{{ data.empleado.nombre }} {{ data.empleado.apellido }}</p>
                <p class="text-xs text-[var(--text-color-secondary)]">{{ data.empleado.numeroDocumento }}</p>
              </div>
            </template>
          </Column>

          <Column header="Contrato" style="min-width: 160px">
            <template #body="{ data }">
              <span v-if="data.contratoActivo" class="text-sm">{{ data.contratoActivo.tipoContrato }}</span>
              <span v-else class="text-sm text-red-500">Sin contrato</span>
            </template>
          </Column>

          <Column header="Estado Entrada" style="min-width: 140px">
            <template #body="{ data }">
              <Tag :value="statusBadge(data).label" :severity="statusBadge(data).severity" />
            </template>
          </Column>

          <Column header="Acciones" style="min-width: 120px">
            <template #body="{ data }">
              <Button
                v-if="data.entrada"
                icon="pi pi-eye"
                size="small"
                severity="secondary"
                text
                v-tooltip.top="'Ver detalles'"
                data-testid="nomina-view-details"
                class="mr-1"
                @click="openDetails(data)"
              />
              <Button
                v-if="authStore.isAdmin"
                :label="data.entrada ? 'Editar' : 'Registrar'"
                icon="pi pi-pencil"
                size="small"
                severity="secondary"
                :disabled="!data.contratoActivo"
                data-testid="nomina-open-dialog"
                @click="openDialog(data)"
              />
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <Dialog
      v-model:visible="dialogVisible"
      :header="editingRow ? `${editingRow.empleado.nombre} ${editingRow.empleado.apellido} — ${periodRef}` : ''"
      :modal="true"
      :style="{ width: '44rem' }"
      data-testid="nomina-dialog"
    >
      <div class="space-y-4">
        <!-- nomina-asistencia-jul-18: read-only summary + editable calc fields -->
        <div
          v-if="editingRow"
          class="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-ground)] p-3 space-y-2 text-sm"
          data-testid="nomina-dialog-summary"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p class="text-xs text-[var(--text-color-secondary)]">Nombre completo</p>
              <p class="font-medium" data-testid="nomina-info-nombre">
                {{ editingRow.empleado.nombre }} {{ editingRow.empleado.apellido }}
              </p>
            </div>
            <div>
              <p class="text-xs text-[var(--text-color-secondary)]">Documento</p>
              <p class="font-medium" data-testid="nomina-info-documento">
                {{ editingRow.empleado.numeroDocumento }}
              </p>
            </div>
          </div>

          <div>
            <p class="text-xs text-[var(--text-color-secondary)]">Medio de pago</p>
            <p
              v-if="medioPagoDisplay(editingRow.empleado)"
              class="font-medium"
              data-testid="nomina-info-medio"
            >
              {{ medioPagoDisplay(editingRow.empleado) }}
            </p>
            <Message
              v-else
              severity="warn"
              :closable="false"
              class="mt-1"
              data-testid="nomina-medio-warning"
            >
              Sin medio de pago
            </Message>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p class="text-xs text-[var(--text-color-secondary)]">Tipo de contrato</p>
              <p class="font-medium" data-testid="nomina-info-tipo-contrato">
                {{ tipoContratoLabel(editingTipo) }}
              </p>
            </div>
            <!-- qa-session-jul-31 R2: the "Valor media jornada (contrato)"
                 info/warning chip is OPS-only. For OBRA/FIJO/INDEF the
                 Valor Mensual summary block below replaces it. -->
            <div v-if="editingTipo === 'OPS'">
              <p class="text-xs text-[var(--text-color-secondary)]">Valor media jornada (contrato)</p>
              <p
                v-if="editingRow.contratoActivo?.valorJornada != null && editingRow.contratoActivo.valorJornada !== ''"
                class="font-medium"
                data-testid="nomina-info-valor-contrato"
              >
                {{ Number(editingRow.contratoActivo.valorJornada).toLocaleString('es-CO') }}
              </p>
              <Message
                v-else
                severity="warn"
                :closable="false"
                class="mt-1"
                data-testid="nomina-valor-jornada-warning"
              >
                Sin valor de jornada en el contrato
              </Message>
            </div>
            <div v-else>
              <p class="text-xs text-[var(--text-color-secondary)]">Valor mensual (contrato)</p>
              <p
                v-if="editingRow.contratoActivo?.valorMensual != null && editingRow.contratoActivo.valorMensual !== ''"
                class="font-medium"
                data-testid="nomina-info-valor-mensual-contrato"
              >
                {{ Number(editingRow.contratoActivo.valorMensual).toLocaleString('es-CO') }}
              </p>
              <Message
                v-else
                severity="warn"
                :closable="false"
                class="mt-1"
                data-testid="nomina-valor-mensual-warning"
              >
                Sin valor mensual en el contrato
              </Message>
            </div>
          </div>

          <div>
            <p class="text-xs text-[var(--text-color-secondary)]">Asistencia del mes</p>
            <p class="font-medium" data-testid="nomina-info-asistencia">
              <template v-if="editingRow.asistenciaMes">
                {{ Number(editingRow.asistenciaMes.mediasJornadas) }} medias ·
                {{ Number(editingRow.asistenciaMes.horas) }} horas
              </template>
              <template v-else>
                Sin registros de asistencia
              </template>
            </p>
            <NuxtLink
              to="/asistencia"
              class="text-xs text-violet-600 hover:underline"
              data-testid="nomina-link-asistencia"
            >
              Ver asistencia
            </NuxtLink>
          </div>
        </div>

        <!-- qa-session-jul-31 R2: branch the editable calc fields on tipoContrato.
     OPS keeps medias × valorJornada (jul-18 behavior).
     OBRA/FIJO/INDEF use a Valor Mensual base (no medias/valor inputs). -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="nomina-calc-fields">
          <!-- OPS: medias + valor jornada inputs (jul-18 layout, unchanged) -->
          <template v-if="!usaValorMensual">
            <div>
              <label class="block text-sm font-medium mb-1" for="nomina-medias">Medias jornadas</label>
              <InputNumber
                id="nomina-medias"
                v-model="dialogForm.mediasJornadas"
                mode="decimal"
                :min="0"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                input-class="w-full"
                class="w-full"
                data-testid="nomina-medias"
                @update:model-value="recomputeSubtotal"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" for="nomina-valor-jornada">Valor media jornada</label>
              <InputNumber
                id="nomina-valor-jornada"
                v-model="dialogForm.valorJornada"
                mode="decimal"
                :min="0"
                :min-fraction-digits="0"
                :max-fraction-digits="2"
                input-class="w-full"
                class="w-full"
                data-testid="nomina-valor-jornada"
                @update:model-value="recomputeSubtotal"
              />
            </div>
          </template>
          <!-- Non-OPS: Valor Mensual base (R2). Subtotal derives from it (+ bonos for FIJO/INDEF). -->
          <div v-else class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1" for="nomina-valor-mensual">Valor mensual</label>
            <InputNumber
              id="nomina-valor-mensual"
              v-model="dialogForm.valorMensual"
              mode="decimal"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              input-class="w-full"
              class="w-full"
              data-testid="nomina-valor-mensual"
              @update:model-value="recomputeSubtotal"
            />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">
              Base del período para {{ tipoContratoLabel(editingTipo) }}.
            </p>
          </div>
          <!-- qa-session-aug-17 R3 / contract §6.2: Bonos only for FIJO/INDEF. Hidden for OPS/OBRA. -->
          <div v-if="bonosAllowed" class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1" for="nomina-bonos">Bonos</label>
            <InputNumber
              id="nomina-bonos"
              v-model="dialogForm.bonos"
              mode="decimal"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              input-class="w-full"
              class="w-full"
              data-testid="nomina-bonos"
              @update:model-value="recomputeSubtotal"
            />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">
              Se suma al valor mensual.
            </p>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="nomina-subtotal">Subtotal</label>
            <InputNumber
              id="nomina-subtotal"
              :model-value="dialogForm.subtotalCalculado"
              mode="decimal"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              input-class="w-full"
              class="w-full"
              :readonly="true"
              :disabled="true"
              data-testid="nomina-subtotal"
            />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">
              <template v-if="bonosAllowed">
                Calculado: valor mensual + bonos
              </template>
              <template v-else-if="usaValorMensual">
                Calculado: valor mensual
              </template>
              <template v-else>
                Calculado: medias × valor media jornada
              </template>
            </p>
          </div>
          <div v-if="aportesAllowed">
            <label class="block text-sm font-medium mb-1" for="nomina-aportes">Aportes sociales</label>
            <InputNumber
              id="nomina-aportes"
              v-model="dialogForm.aportesSociales"
              mode="decimal"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              input-class="w-full"
              class="w-full"
              data-testid="nomina-aportes"
              @update:model-value="recomputeTotal"
            />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">
              Referente / no se suma al total.
            </p>
          </div>
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1" for="nomina-total">Total a pagar</label>
            <InputNumber
              id="nomina-total"
              v-model="dialogForm.totalPagado"
              mode="decimal"
              :min="0"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              input-class="w-full font-semibold"
              class="w-full"
              data-testid="nomina-total"
              @update:model-value="(v: number | null) => { dialogForm.salario = v }"
            />
            <p class="text-xs text-[var(--text-color-secondary)] mt-1">
              <template v-if="bonosAllowed">
                Mensual + bonos (los aportes no se suman); se puede ajustar manualmente
              </template>
              <template v-else-if="usaValorMensual">
                Por defecto valor mensual; se puede ajustar manualmente
              </template>
              <template v-else>
                Por defecto subtotal + aportes; se puede ajustar manualmente
              </template>
            </p>
          </div>
        </div>

        <!-- Keep legacy salario input for FIJO/INDEFINIDO as alias of total (hidden when calc present) -->
        <div v-if="false && (editingTipo === 'TERMINO_FIJO' || editingTipo === 'TERMINO_INDEFINIDO')">
          <label class="block text-sm font-medium mb-1">Salario</label>
          <InputNumber
            v-model="dialogForm.salario"
            mode="decimal"
            :min-fraction-digits="0"
            :max-fraction-digits="2"
            input-class="w-full"
            data-testid="nomina-salario"
          />
        </div>

        <div v-for="slot in requiredSlotsForTipo(editingTipo)" :key="slot">
          <label class="block text-sm font-medium mb-1">{{ archivoLabel(slot) }}</label>
          <div class="space-y-1">
            <label
              class="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors"
            >
              <i class="pi pi-upload text-violet-500" />
              <span>Seleccionar archivo…</span>
              <i
                v-if="uploadingSlots[slot]"
                class="pi pi-spin pi-spinner text-violet-500"
                data-testid="nomina-slot-uploading"
              />
              <span v-if="uploadingSlots[slot]">Subiendo…</span>
              <input
                type="file"
                class="hidden"
                :data-testid="`nomina-slot-${slot}`"
                :disabled="uploadingSlots[slot]"
                @change="(e: any) => onSlotFileChange(slot, e)"
              />
            </label>
            <div v-for="(a, i) in dialogForm.archivos.filter((x) => x.tipoArchivo === slot)" :key="i" class="flex items-center gap-2 text-sm">
              <i class="pi pi-paperclip text-violet-500" />
              <span class="flex-1">{{ a.nombre }}</span>
              <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="removeArchivo(dialogForm.archivos.indexOf(a))" />
            </div>
            <!-- D4: backend field-level error for the CUENTA_COBRO slot. -->
            <Message
              v-if="slot === 'CUENTA_COBRO' && cuentaCobroError"
              severity="error"
              :closable="true"
              class="mt-1"
              data-testid="nomina-cuenta-cobro-error"
              @close="cuentaCobroError = null"
            >
              {{ cuentaCobroError }}
            </Message>
          </div>
        </div>

        <div v-if="editingTipo === 'OPS' || editingTipo === 'OBRA_O_LABOR'">
          <label class="block text-sm font-medium mb-1">Agregar otro (opcional)</label>
          <label
            class="inline-flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors"
          >
            <i class="pi pi-plus text-violet-500" />
            <span>Adjuntar otro archivo…</span>
            <i
              v-if="uploadingSlots['OTRO']"
              class="pi pi-spin pi-spinner text-violet-500"
              data-testid="nomina-slot-uploading"
            />
            <span v-if="uploadingSlots['OTRO']">Subiendo…</span>
            <input
              type="file"
              class="hidden"
              :disabled="uploadingSlots['OTRO']"
              @change="addOtroSlot"
            />
          </label>
          <div v-for="(a, i) in dialogForm.archivos.filter((x) => x.tipoArchivo === 'OTRO')" :key="i" class="flex items-center gap-2 text-sm mt-1">
            <i class="pi pi-paperclip text-violet-500" />
            <span class="flex-1">{{ a.nombre }}</span>
            <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="removeArchivo(dialogForm.archivos.indexOf(a))" />
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium mb-1">Notas</label>
          <Textarea v-model="dialogForm.notas" rows="2" class="w-full" />
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="savingEntrada"
          @click="closeDialog"
        />
        <Button
          label="Guardar"
          icon="pi pi-check"
          data-testid="nomina-guardar"
          :loading="savingEntrada"
          :disabled="savingEntrada || Object.values(uploadingSlots).some(Boolean)"
          @click="saveEntrada"
        />
      </template>
    </Dialog>

    <!-- C: read-only detail dialog (Ver detalles). -->
    <Dialog
      v-model:visible="detailsVisible"
      :header="detailsRow ? `Detalle — ${detailsRow.empleado.nombre} ${detailsRow.empleado.apellido} — ${periodRef}` : ''"
      :modal="true"
      :style="{ width: '40rem' }"
      data-testid="nomina-details-dialog"
    >
      <div v-if="detailsRow?.entrada" class="space-y-4">
        <div>
          <p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo de contrato</p>
          <p class="font-medium">{{ detailsRow.entrada.tipoContrato }}</p>
        </div>
        <div v-if="detailsRow.entrada.totalPagado != null || detailsRow.entrada.salario != null">
          <p class="text-xs text-[var(--text-color-secondary)] mb-1">Total a pagar</p>
          <p class="font-medium">{{ Number(detailsRow.entrada.totalPagado ?? detailsRow.entrada.salario).toLocaleString('es-CO') }}</p>
        </div>
        <div v-if="detailsRow.entrada.mediasJornadas != null">
          <p class="text-xs text-[var(--text-color-secondary)] mb-1">Medias jornadas</p>
          <p class="font-medium">{{ Number(detailsRow.entrada.mediasJornadas) }}</p>
        </div>
        <div v-if="detailsRow.entrada.notas">
          <p class="text-xs text-[var(--text-color-secondary)] mb-1">Notas</p>
          <p class="text-sm whitespace-pre-wrap">{{ detailsRow.entrada.notas }}</p>
        </div>
        <div>
          <p class="text-xs text-[var(--text-color-secondary)] mb-2">Archivos</p>
          <div
            v-if="detailsRow.entrada.archivos.length === 0"
            class="text-sm text-[var(--text-color-secondary)]"
          >
            Sin archivos registrados.
          </div>
          <div v-else class="space-y-2">
            <div
              v-for="a in detailsRow.entrada.archivos"
              :key="a.url"
              class="flex items-center gap-2"
            >
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium">{{ archivoLabel(a.tipoArchivo) }}</p>
                <p class="text-xs text-[var(--text-color-secondary)] truncate">{{ a.nombre }}</p>
              </div>
              <Button
                icon="pi pi-download"
                size="small"
                outlined
                data-testid="nomina-detail-download"
                @click="downloadArchivo(a.url)"
              />
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cerrar"
          severity="secondary"
          outlined
          @click="detailsVisible = false"
        />
      </template>
    </Dialog>
  </div>
</template>
