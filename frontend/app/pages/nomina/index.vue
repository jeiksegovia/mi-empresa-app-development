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
}

interface NominaRow {
  empleado: { id: number; nombre: string; apellido: string; numeroDocumento: string }
  contratoActivo: Contrato | null
  entrada: NominaEntrada | null
  cargoSalario: number | string | null
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

// Dialog form
const dialogForm = reactive({
  salario: null as number | null,
  notas: '',
  archivos: [] as NominaArchivo[],
})

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
  // Prisma Decimal serializes to string — always Number() before InputNumber.
  dialogForm.salario = row.entrada?.salario != null
    ? Number(row.entrada.salario)
    : row.cargoSalario != null
      ? Number(row.cargoSalario)
      : null
  dialogForm.notas = row.entrada?.notas ?? ''
  dialogForm.archivos = (row.entrada?.archivos ?? []).map((a) => ({ ...a }))
  // Clear any inline error from a previous open.
  cuentaCobroError.value = null
  dialogVisible.value = true
}

function closeDialog() {
  dialogVisible.value = false
  editingRow.value = null
  editingTipo.value = ''
  dialogForm.salario = null
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
    uploadAndAttach(input.files[0], tipoArchivo).catch((e: any) => {
      toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir archivo' })
    })
    input.value = ''
  }
}

function addOtroSlot(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    uploadAndAttach(input.files[0], 'OTRO').catch(() => {
      toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo subir archivo' })
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
  try {
    if (isUpdate) {
      await apiFetch(`/nomina/periodos/${editingRow.value.entrada!.id}`, {
        method: 'PUT',
        body: {
          salario: dialogForm.salario,
          notas: dialogForm.notas.trim() || null,
          archivos: dialogForm.archivos,
        },
      })
    } else {
      await apiFetch('/nomina/periodos', {
        method: 'POST',
        body: {
          empleadoId: id,
          periodo: periodRef.value,
          salario: dialogForm.salario,
          notas: dialogForm.notas.trim() || null,
          archivos: dialogForm.archivos,
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
  }
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

    <Toast />

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
    >
      <div class="space-y-4">
        <p class="text-sm text-[var(--text-color-secondary)]">
          Tipo de contrato: <span class="font-medium">{{ editingTipo }}</span>
        </p>

        <div v-if="editingTipo === 'TERMINO_FIJO' || editingTipo === 'TERMINO_INDEFINIDO'">
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
              <input
                type="file"
                class="hidden"
                :data-testid="`nomina-slot-${slot}`"
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
            <input type="file" class="hidden" @change="addOtroSlot" />
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
        <Button label="Cancelar" severity="secondary" outlined @click="closeDialog" />
        <Button label="Guardar" icon="pi pi-check" data-testid="nomina-save" @click="saveEntrada" />
      </template>
    </Dialog>
  </div>
</template>
