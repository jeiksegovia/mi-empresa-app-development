<script setup lang="ts">
/**
 * Centro de Costos — feature-centro-costos-ago-5 (aug-17 update).
 *
 * Implements the aug-17 UI contract per decisions D9–D14:
 *  - R19: every centro starts collapsed; click header to expand; one does NOT
 *    force-expand others; add-ítem only when expanded.
 *  - R20: ADMIN can create/edit a centro (nombre, tipo, descripcion, orden,
 *    precioUnitario, habilitarRecibo). POST creates; PUT for edit including
 *    deactivate (activo:false).
 *  - R21–R22: CONTRATOS hides create-centro, balance card, month `<input>`.
 *    Periodo is locked to the current Bogotá YYYY-MM derived from today.
 *  - R24: every ítem requires `fecha` (YYYY-MM-DD). Do NOT send `periodo`
 *    (server derives it). Dialog shows a day date, not a month-only period.
 *  - R25–R28: INGRESOS requires pagador (text) + beneficiarioClienteId
 *    (existing Cliente from /patients); optional medioPago. valorUnitario is
 *    server-copied from centro.precioUnitario (ignored on INGRESOS). If
 *    centro.precioUnitario is null → 400 → UI blocks save.
 *  - R29–R30: after an INGRESOS create, if centro.habilitarRecibo → offer
 *    print → navigate /centro-costos/recibo/:itemId.
 *
 * Money wire type is `string` (Prisma Decimal serialized as `"1500.00"`).
 * Sum/render only at the leaf via Number() — see comment on `sumGrupo`.
 *
 * Traps:
 *  - v-model on a child of `const reactive()` drops emits — bind `:model-value`
 *    + `@update:model-value` via Object.assign OR keep the form fields in the
 *    same template bound directly. We do the latter.
 *  - Money is a STRING — Number() only at render.
 *  - The DatePicker MUST be driven explicitly in tests (native <input type=date>).
 */
definePageMeta({ middleware: 'auth', layout: 'default' })

// ─── Wire types (mirror contract §1.2 / §2.3) ────────────────────────────────
type TipoCentro = 'INGRESOS' | 'EGRESOS'
type MedioPago = 'EFECTIVO' | 'TRANSFERENCIA'

interface CentroCostos {
  id: number
  nombre: string
  tipo: TipoCentro
  descripcion: string | null
  activo: boolean
  orden: number
  // aug-17 D11: per-centro unit price for INGRESOS — copied into ítems.
  precioUnitario: string | null
  // aug-17 D13: enables print-recibo CTA after creating an ítem on this centro.
  habilitarRecibo: boolean
  createdAt: string
  updatedAt: string
}

interface CentroCostosItem {
  id: number
  centroCostosId: number
  nombre: string
  notas: string | null
  cantidad: number
  valorUnitario: number | string
  valorTotal: number | string
  fecha: string                  // aug-17 D10: YYYY-MM-DD, required
  periodo: string                // YYYY-MM-DD, always day 1 (server-derived)
  numeroFactura: string | null
  proveedor: string | null
  fechaFactura: string | null
  // aug-17 D11:
  pagador: string | null
  beneficiarioClienteId: number | null
  medioPago: MedioPago | null
  createdAt: string
  updatedAt: string
}

interface GrupoCentro {
  centro: CentroCostos
  items: CentroCostosItem[]
  subtotal: number | string
}

interface BalancePorCentro {
  centroId: number
  nombre: string
  tipo: TipoCentro
  subtotal: number | string
}

interface BalanceMes {
  periodo: string
  porCentro: BalancePorCentro[]
  totalIngresos: number | string
  totalEgresos: number | string
  balance: number | string
}

// Patient dropdown (mirrors `/patients?limit=...` shape, but we only need
// {id, nombre}; other fields are nullable/unused).
interface PatientOption {
  id: number
  nombre: string
}

// ─── Composables ──────────────────────────────────────────────────────────────
const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()

// ─── RBAC mirrors ─────────────────────────────────────────────────────────────
// CONTRATOS: hide balance, month input, create-centro. Lock periodo.
// (authStore.role + tipoEmpleado is the FE mirror per the assignment.)
const isContratosUser = computed(
  () => authStore.user?.rol === 'EMPLEADO' && authStore.user?.tipoEmpleado === 'CONTRATOS',
)
const isAdmin = computed(() => authStore.isAdmin)

interface ContratosFechaPolicy {
  limitarFechaContratos: boolean
  today: string
  previousBusinessDay: string
  allowed: string[]
}

const fechaPolicy = ref<ContratosFechaPolicy | null>(null)
const fechaLockSaving = ref(false)

// ─── State ────────────────────────────────────────────────────────────────────
const periodRef = ref<string>('') // YYYY-MM
const centros = ref<CentroCostos[]>([])
const grupos = ref<GrupoCentro[]>([])
const balance = ref<BalanceMes | null>(null)
const loading = ref(false)

// Accordion: centro ids currently expanded (Set of centro.id).
// R19: every centro starts collapsed. Expanding one does NOT force-expand others.
const expandedIds = ref<Set<number>>(new Set())
function toggleExpanded(centroId: number): void {
  const next = new Set(expandedIds.value)
  if (next.has(centroId)) next.delete(centroId)
  else next.add(centroId)
  expandedIds.value = next
}
function isExpanded(centroId: number): boolean {
  return expandedIds.value.has(centroId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// D14: locked-period and default `fecha` MUST use America/Bogota (not UTC) so
// that after 19:00 Colombia on the last day of a month, UTC isn't already the
// next month and CONTRATOS doesn't hit the month guard with 403.
function todayBogotaYYYYMMDD(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}
function currentPeriodYYYYMM(): string {
  return todayBogotaYYYYMMDD().slice(0, 7)
}
function todayYYYYMMDD(): string {
  return todayBogotaYYYYMMDD()
}

// Trap #2: Money arrives as a STRING. Always convert at the leaf.
function asNum(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function sumGrupo(g: GrupoCentro): number {
  return g.items.reduce((acc, it) => acc + asNum(it.valorTotal), 0)
}

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchFechaPolicy() {
  try {
    const res = await apiFetch<{ success: boolean; data: ContratosFechaPolicy }>('/centro-costos/policy')
    fechaPolicy.value = res.data ?? null
  } catch {
    fechaPolicy.value = null
  }
}

async function toggleFechaLock(next: boolean) {
  if (!isAdmin.value) return
  fechaLockSaving.value = true
  try {
    const empresa = await apiFetch<{ success: boolean; data: { id: number } }>('/empresa')
    const id = empresa.data?.id
    if (!id) throw new Error('Empresa no encontrada')
    await apiFetch(`/empresa/${id}`, {
      method: 'PUT',
      body: { limitarFechaContratos: next },
    })
    await fetchFechaPolicy()
    toast.add({
      severity: 'success',
      summary: next ? 'Limitación activa' : 'Limitación desactivada',
      detail: next
        ? 'CONTRATOS solo puede usar hoy o el día hábil anterior.'
        : 'CONTRATOS puede ingresar cualquier fecha (carga histórica).',
      life: 4000,
    })
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo actualizar la limitación.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    fechaLockSaving.value = false
  }
}

async function fetchCentros() {
  try {
    const res = await apiFetch<{ success: boolean; data: CentroCostos[] }>('/centro-costos')
    centros.value = res.data ?? []
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudieron cargar los centros de costos.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  }
}

async function fetchItems() {
  if (!periodRef.value) return
  loading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: { periodo: string; grupos: GrupoCentro[] } }>(
      `/centro-costos/items?periodo=${periodRef.value}`,
    )
    grupos.value = res.data?.grupos ?? []
  } catch (e: any) {
    // R22: CONTRATOS gets 403 for non-current month. We never let them pick one,
    // but surface a clean message if a stale month slips through.
    const detail = e?.data?.message || e?.message || 'No se pudieron cargar los ítems.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    loading.value = false
  }
}

async function fetchBalance() {
  if (!periodRef.value) return
  if (isContratosUser.value) {
    // R22: CONTRATOS must never see the balance. Backend returns 403; we skip.
    balance.value = null
    return
  }
  try {
    const res = await apiFetch<{ success: boolean; data: BalanceMes }>(
      `/centro-costos/balance?periodo=${periodRef.value}`,
    )
    balance.value = res.data ?? null
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo cargar el balance.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  }
}

async function fetchAll() {
  await Promise.all([fetchItems(), fetchBalance()])
}

// ─── Section builders (Ingresos / Egresos) ────────────────────────────────────
const gruposPorTipo = computed<
  Record<TipoCentro, Array<GrupoCentro | { centro: CentroCostos; items: []; subtotal: 0 }>>
>(() => {
  const buckets: Record<TipoCentro, Array<GrupoCentro | { centro: CentroCostos; items: []; subtotal: 0 }>> = {
    INGRESOS: [],
    EGRESOS: [],
  }
  for (const c of centros.value) {
    if (!c.activo) continue
    const found = grupos.value.find((g) => g.centro.id === c.id)
    if (found) {
      buckets[c.tipo].push(found)
    } else {
      buckets[c.tipo].push({ centro: c, items: [], subtotal: 0 })
    }
  }
  return buckets
})

// ─── Item dialog state ────────────────────────────────────────────────────────
interface ItemDialogForm {
  nombre: string
  notas: string
  cantidad: number
  // INGRESOS only: precio is hidden / read-only from `centro.precioUnitario`.
  // We still keep this in the form for EGRESOS where the user types it.
  valorUnitario: number | null
  fecha: string                // aug-17 D10: YYYY-MM-DD (REPLACES old `periodo`)
  // Egreso-only invoice fields (unchanged).
  numeroFactura: string
  proveedor: string
  fechaFactura: string
  // aug-17 D11: INGRESOS-only fields.
  pagador: string
  beneficiarioClienteId: number | null
  medioPago: MedioPago | ''
}

const dialogVisible = ref(false)
const dialogEditingItem = ref<CentroCostosItem | null>(null)
const dialogCentroId = ref<number | null>(null)
const dialogCentroTipo = ref<TipoCentro | null>(null)
const dialogCentroRef = ref<CentroCostos | null>(null) // for precioUnitario / habilitarRecibo
const savingItem = ref(false)

const dialogForm = reactive<ItemDialogForm>({
  nombre: '',
  notas: '',
  cantidad: 1,
  valorUnitario: null,
  fecha: '',
  numeroFactura: '',
  proveedor: '',
  fechaFactura: '',
  pagador: '',
  beneficiarioClienteId: null,
  medioPago: '',
})

const isEgresoDialog = computed(() => dialogCentroTipo.value === 'EGRESOS')
const isIngresoDialog = computed(() => dialogCentroTipo.value === 'INGRESOS')

// Live preview of valorTotal in the dialog — read-only display.
const dialogPreviewTotal = computed(() => asNum(dialogForm.cantidad) * asNum(dialogForm.valorUnitario))

// Trap: on INGRESOS the precio is read from the parent centro. If null → block save.
const dialogIngresoPrecioSource = computed<string | null>(() => {
  if (!isIngresoDialog.value) return null
  return dialogCentroRef.value?.precioUnitario ?? null
})

function resetDialogForm(): void {
  dialogForm.nombre = ''
  dialogForm.notas = ''
  dialogForm.cantidad = 1
  dialogForm.valorUnitario = null
  dialogForm.fecha = ''
  dialogForm.numeroFactura = ''
  dialogForm.proveedor = ''
  dialogForm.fechaFactura = ''
  dialogForm.pagador = ''
  dialogForm.beneficiarioClienteId = null
  dialogForm.medioPago = ''
}

function openItemDialog(centro: CentroCostos, item: CentroCostosItem | null) {
  dialogCentroId.value = centro.id
  dialogCentroTipo.value = centro.tipo
  dialogCentroRef.value = centro
  dialogEditingItem.value = item
  resetDialogForm()
  if (item) {
    dialogForm.nombre = item.nombre
    dialogForm.notas = item.notas ?? ''
    dialogForm.cantidad = item.cantidad
    // On INGRESOS we keep the server-resolved value for display but do NOT
    // allow the user to edit it — it comes from `centro.precioUnitario`.
    dialogForm.valorUnitario = asNum(item.valorUnitario)
    // aug-17 D10: `fecha` is the day; `periodo` is server-derived.
    dialogForm.fecha = item.fecha
    dialogForm.numeroFactura = item.numeroFactura ?? ''
    dialogForm.proveedor = item.proveedor ?? ''
    dialogForm.fechaFactura = item.fechaFactura ?? ''
    dialogForm.pagador = item.pagador ?? ''
    dialogForm.beneficiarioClienteId = item.beneficiarioClienteId ?? null
    dialogForm.medioPago = item.medioPago ?? ''
  } else {
    dialogForm.fecha = todayYYYYMMDD()
    // Pre-seed INGRESOS unit price from the centro (server will ignore anyway).
    if (centro.tipo === 'INGRESOS') {
      dialogForm.valorUnitario = asNum(centro.precioUnitario)
    }
  }
  dialogVisible.value = true
}

function closeItemDialog() {
  dialogVisible.value = false
  dialogEditingItem.value = null
  dialogCentroId.value = null
  dialogCentroTipo.value = null
  dialogCentroRef.value = null
}

// ─── Patients (for beneficiario dropdown on INGRESOS dialog) ──────────────────
const patients = ref<PatientOption[]>([])
const patientsLoading = ref(false)
async function fetchPatients() {
  patientsLoading.value = true
  try {
    const res = await apiFetch<{
      success: boolean
      data: Array<{ id: number; nombre: string }>
    }>('/patients?limit=200')
    patients.value = (res.data ?? []).map((p) => ({ id: p.id, nombre: p.nombre }))
  } catch {
    // Non-fatal — dropdown just stays empty.
    patients.value = []
  } finally {
    patientsLoading.value = false
  }
}

// ─── Save / delete ítem ───────────────────────────────────────────────────────
async function saveItem() {
  if (!dialogCentroId.value) return
  if (!dialogForm.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Validación', detail: 'El nombre es obligatorio.', life: 3000 })
    return
  }
  if (!dialogForm.fecha) {
    toast.add({ severity: 'warn', summary: 'Validación', detail: 'La fecha es obligatoria.', life: 3000 })
    return
  }

  // EGRESOS: typed precio required.
  if (isEgresoDialog.value && (dialogForm.valorUnitario == null || asNum(dialogForm.valorUnitario) <= 0)) {
    toast.add({ severity: 'warn', summary: 'Validación', detail: 'El valor unitario debe ser mayor a 0.', life: 3000 })
    return
  }

  // INGRESOS: server copies precioUnitario; we block save if the centro has none.
  if (isIngresoDialog.value && dialogIngresoPrecioSource.value == null) {
    toast.add({
      severity: 'warn',
      summary: 'Precio no configurado',
      detail: 'Este centro no tiene precio unitario. Un ADMIN debe editar el centro y asignarle un precio antes de registrar ítems.',
      life: 6000,
    })
    return
  }

  // INGRESOS: pagador + beneficiario required.
  if (isIngresoDialog.value) {
    if (!dialogForm.pagador.trim()) {
      toast.add({ severity: 'warn', summary: 'Validación', detail: 'El pagador es obligatorio en ingresos.', life: 3000 })
      return
    }
    if (dialogForm.beneficiarioClienteId == null) {
      toast.add({ severity: 'warn', summary: 'Validación', detail: 'El beneficiario es obligatorio en ingresos.', life: 3000 })
      return
    }
  }

  savingItem.value = true
  try {
    // Trap #6: never send valorTotal — server computes it from cantidad × valorUnitario.
    // aug-17 D10: never send `periodo` — server derives it from `fecha`.
    const body: Record<string, unknown> = {
      nombre: dialogForm.nombre.trim(),
      notas: dialogForm.notas.trim() || null,
      cantidad: Number(dialogForm.cantidad) || 1,
      fecha: dialogForm.fecha,
    }
    if (isEgresoDialog.value) {
      body.valorUnitario = asNum(dialogForm.valorUnitario)
      body.numeroFactura = dialogForm.numeroFactura.trim() || null
      body.proveedor = dialogForm.proveedor.trim() || null
      body.fechaFactura = dialogForm.fechaFactura || null
    }
    if (isIngresoDialog.value) {
      // aug-17 R26: server copies centro.precioUnitario; client value is ignored.
      // We still send it for explicitness — backend will drop it.
      body.valorUnitario = asNum(dialogIngresoPrecioSource.value)
      body.pagador = dialogForm.pagador.trim()
      body.beneficiarioClienteId = dialogForm.beneficiarioClienteId
      if (dialogForm.medioPago) body.medioPago = dialogForm.medioPago
    }
    let savedItem: CentroCostosItem | null = null
    if (dialogEditingItem.value) {
      const res = await apiFetch<{ success: boolean; data: CentroCostosItem }>(
        `/centro-costos/items/${dialogEditingItem.value.id}`,
        { method: 'PUT', body },
      )
      savedItem = res.data ?? null
    } else {
      const res = await apiFetch<{ success: boolean; data: CentroCostosItem }>(
        `/centro-costos/${dialogCentroId.value}/items`,
        { method: 'POST', body },
      )
      savedItem = res.data ?? null
    }
    const editing = !!dialogEditingItem.value
    // Capture the values BEFORE closeItemDialog() nulls out dialogCentroRef.
    const wasIngreso = isIngresoDialog.value
    const wasHabilitarRecibo = !!dialogCentroRef.value?.habilitarRecibo
    const parentNombre = dialogCentroRef.value?.nombre ?? ''
    closeItemDialog()
    await fetchAll()
    toast.add({
      severity: 'success',
      summary: 'Guardado',
      detail: editing ? 'Ítem actualizado.' : 'Ítem creado.',
      life: 2500,
    })

    // R29: offer print-recibo when creating on a `habilitarRecibo` INGRESOS centro.
    if (!editing && savedItem && wasIngreso && wasHabilitarRecibo) {
      printAfterCreateItemId.value = savedItem.id
      printAfterCreateCentroNombre.value = parentNombre
      printAfterCreateVisible.value = true
    }
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo guardar el ítem.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    savingItem.value = false
  }
}

async function deleteItem(item: CentroCostosItem) {
  savingItem.value = true
  try {
    await apiFetch(`/centro-costos/items/${item.id}`, { method: 'DELETE' })
    await fetchAll()
    toast.add({ severity: 'success', summary: 'Eliminado', detail: 'Ítem eliminado.', life: 2500 })
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo eliminar el ítem.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    savingItem.value = false
  }
}

// ─── Recibo CTA after create (R29) ───────────────────────────────────────────
const printAfterCreateVisible = ref(false)
const printAfterCreateItemId = ref<number | null>(null)
const printAfterCreateCentroNombre = ref<string>('')
function dismissPrintAfterCreate() {
  printAfterCreateVisible.value = false
  printAfterCreateItemId.value = null
  printAfterCreateCentroNombre.value = ''
}
function navigateToRecibo() {
  if (printAfterCreateItemId.value == null) return
  const id = printAfterCreateItemId.value
  dismissPrintAfterCreate()
  navigateTo(`/centro-costos/recibo/${id}`)
}

// ─── Create / edit centro dialog (R20) ───────────────────────────────────────
interface CentroDialogForm {
  id: number | null           // null = create
  nombre: string
  tipo: TipoCentro
  descripcion: string
  orden: number
  precioUnitario: string | null   // INGRESOS only; stored as "1500.00" or "" (null)
  habilitarRecibo: boolean        // INGRESOS only
  activo: boolean                 // for PUT deactivate
}

const centroDialogVisible = ref(false)
const centroDialogEditing = ref(false)
const centroDialogSaving = ref(false)
const centroDialogForm = reactive<CentroDialogForm>({
  id: null,
  nombre: '',
  tipo: 'INGRESOS',
  descripcion: '',
  orden: 0,
  precioUnitario: null,
  habilitarRecibo: false,
  activo: true,
})

function resetCentroDialog(): void {
  centroDialogForm.id = null
  centroDialogForm.nombre = ''
  centroDialogForm.tipo = 'INGRESOS'
  centroDialogForm.descripcion = ''
  centroDialogForm.orden = 0
  centroDialogForm.precioUnitario = null
  centroDialogForm.habilitarRecibo = false
  centroDialogForm.activo = true
}

function openCreateCentro() {
  resetCentroDialog()
  centroDialogEditing.value = false
  centroDialogVisible.value = true
}

function openEditCentro(centro: CentroCostos) {
  centroDialogForm.id = centro.id
  centroDialogForm.nombre = centro.nombre
  centroDialogForm.tipo = centro.tipo
  centroDialogForm.descripcion = centro.descripcion ?? ''
  centroDialogForm.orden = centro.orden
  centroDialogForm.precioUnitario = centro.precioUnitario
  centroDialogForm.habilitarRecibo = centro.habilitarRecibo
  centroDialogForm.activo = centro.activo
  centroDialogEditing.value = true
  centroDialogVisible.value = true
}

function closeCentroDialog() {
  centroDialogVisible.value = false
  if (!centroDialogSaving.value) {
    resetCentroDialog()
    centroDialogEditing.value = false
  }
}

async function saveCentro() {
  if (!centroDialogForm.nombre.trim()) {
    toast.add({ severity: 'warn', summary: 'Validación', detail: 'El nombre es obligatorio.', life: 3000 })
    return
  }
  if (centroDialogForm.tipo === 'INGRESOS' && centroDialogForm.precioUnitario !== null) {
    const n = Number(centroDialogForm.precioUnitario)
    if (!Number.isFinite(n) || n < 0) {
      toast.add({ severity: 'warn', summary: 'Validación', detail: 'El precio unitario debe ser ≥ 0.', life: 3000 })
      return
    }
  }
  centroDialogSaving.value = true
  try {
    if (centroDialogEditing.value && centroDialogForm.id != null) {
      const body: Record<string, unknown> = {
        nombre: centroDialogForm.nombre.trim(),
        descripcion: centroDialogForm.descripcion.trim() || null,
        orden: Number(centroDialogForm.orden) || 0,
        activo: centroDialogForm.activo,
      }
      if (centroDialogForm.tipo === 'INGRESOS') {
        body.precioUnitario =
          centroDialogForm.precioUnitario === null || centroDialogForm.precioUnitario === ''
            ? null
            : Number(centroDialogForm.precioUnitario)
        body.habilitarRecibo = centroDialogForm.habilitarRecibo
      }
      await apiFetch(`/centro-costos/${centroDialogForm.id}`, { method: 'PUT', body })
      toast.add({ severity: 'success', summary: 'Guardado', detail: 'Centro actualizado.', life: 2500 })
    } else {
      const body: Record<string, unknown> = {
        nombre: centroDialogForm.nombre.trim(),
        tipo: centroDialogForm.tipo,
        descripcion: centroDialogForm.descripcion.trim() || null,
        orden: Number(centroDialogForm.orden) || 0,
      }
      if (centroDialogForm.tipo === 'INGRESOS') {
        body.precioUnitario =
          centroDialogForm.precioUnitario === null || centroDialogForm.precioUnitario === ''
            ? null
            : Number(centroDialogForm.precioUnitario)
        body.habilitarRecibo = centroDialogForm.habilitarRecibo
      }
      await apiFetch('/centro-costos', { method: 'POST', body })
      toast.add({ severity: 'success', summary: 'Guardado', detail: 'Centro creado.', life: 2500 })
    }
    centroDialogVisible.value = false
    resetCentroDialog()
    centroDialogEditing.value = false
    await fetchCentros()
    await fetchAll()
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo guardar el centro.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    centroDialogSaving.value = false
  }
}

// ─── Centro delete (409 surface + deactivate suggestion) ─────────────────────
const deactivateDialogVisible = ref(false)
const deactivateTarget = ref<CentroCostos | null>(null)
const deactivateSaving = ref(false)

function openDeleteCentro(centro: CentroCostos) {
  deactivateTarget.value = centro
  deactivateDialogVisible.value = true
}

async function performDeleteCentro() {
  if (!deactivateTarget.value) return
  const c = deactivateTarget.value
  deactivateSaving.value = true
  try {
    await apiFetch(`/centro-costos/${c.id}`, { method: 'DELETE' })
    deactivateDialogVisible.value = false
    deactivateTarget.value = null
    toast.add({
      severity: 'success',
      summary: 'Eliminado',
      detail: 'Centro eliminado.',
      life: 2500,
    })
    await fetchAll()
  } catch (e: any) {
    if (e?.data?.field === 'centroCostosId') {
      toast.add({
        severity: 'warn',
        summary: 'Tiene ítems',
        detail: e.data.message || 'El centro tiene ítems; desactívelo en lugar de eliminarlo.',
        life: 6000,
      })
    } else {
      const detail = e?.data?.message || e?.message || 'No se pudo eliminar el centro.'
      toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
    }
  } finally {
    deactivateSaving.value = false
  }
}

async function performDeactivateCentro() {
  if (!deactivateTarget.value) return
  const c = deactivateTarget.value
  deactivateSaving.value = true
  try {
    await apiFetch(`/centro-costos/${c.id}`, {
      method: 'PUT',
      body: { activo: false },
    })
    deactivateDialogVisible.value = false
    deactivateTarget.value = null
    toast.add({
      severity: 'success',
      summary: 'Desactivado',
      detail: `Centro "${c.nombre}" desactivado.`,
      life: 2500,
    })
    await fetchAll()
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo desactivar el centro.'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    deactivateSaving.value = false
  }
}

// ─── Display helpers ─────────────────────────────────────────────────────────
const monthLabel = computed(() => {
  if (!periodRef.value) return ''
  const [y, m] = periodRef.value.split('-').map(Number)
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ]
  return `${meses[(m ?? 1) - 1] ?? ''} ${y ?? ''}`
})

const balancePositive = computed(() => balance.value != null && asNum(balance.value.balance) >= 0)

function fmtMoney(v: number | string | null | undefined): string {
  return asNum(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(async () => {
  periodRef.value = currentPeriodYYYYMM()
  await Promise.all([fetchCentros(), fetchAll(), fetchPatients(), fetchFechaPolicy()])
})

// CONTRATOS: the month picker is hidden but we still re-fetch if it ever
// changes (defensive — should never fire for CONTRATOS).
watch(periodRef, async () => {
  await fetchAll()
})
</script>

<template>
  <div>
    <AppPageHeader title="Centro de Costos" :subtitle="`Balance mensual — ${monthLabel}`">
      <template #actions>
        <!-- R22: CONTRATOS hide month picker while the F4 lock is on.
             When ADMIN turns the lock off (backfill), CONTRATOS can pick any month. -->
        <input
          v-if="!isContratosUser || !fechaPolicy?.limitarFechaContratos"
          type="month"
          v-model="periodRef"
          class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
          data-testid="centro-costos-periodo"
          @change="fetchAll"
        />
        <!-- aug-27 F4: ADMIN lock for CONTRATOS fecha window. Default off = backfill. -->
        <div
          v-if="isAdmin && fechaPolicy"
          class="flex items-center gap-2 text-sm"
          data-testid="centro-costos-fecha-lock"
        >
          <span class="text-[var(--text-color-secondary)]">Limitar fechas CONTRATOS</span>
          <InputSwitch
            :model-value="fechaPolicy.limitarFechaContratos"
            :disabled="fechaLockSaving"
            data-testid="centro-costos-fecha-lock-switch"
            @update:model-value="toggleFechaLock"
          />
        </div>
        <!-- R20: ADMIN can create new centros. CONTRATOS does NOT see this button. -->
        <Button
          v-if="isAdmin"
          label="Nuevo centro"
          icon="pi pi-plus"
          size="small"
          severity="primary"
          data-testid="centro-costos-create-centro"
          @click="openCreateCentro"
        />
      </template>
    </AppPageHeader>

    <!-- Balance summary card. R22: hidden for CONTRATOS. -->
    <Card v-if="!isContratosUser" class="mb-4" data-testid="centro-costos-balance-card">
      <template #content>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="centro-costos-balance">
          <div>
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Total Ingresos
            </p>
            <p
              class="text-2xl font-semibold text-emerald-600 mt-1"
              data-testid="centro-costos-total-ingresos"
            >
              $ {{ fmtMoney(balance?.totalIngresos ?? 0) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Total Egresos
            </p>
            <p
              class="text-2xl font-semibold text-red-600 mt-1"
              data-testid="centro-costos-total-egresos"
            >
              $ {{ fmtMoney(balance?.totalEgresos ?? 0) }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Balance
            </p>
            <p
              :class="[
                'text-2xl font-semibold mt-1',
                balancePositive ? 'text-emerald-600' : 'text-red-600',
              ]"
              data-testid="centro-costos-balance-value"
            >
              $ {{ fmtMoney(balance?.balance ?? 0) }}
            </p>
          </div>
        </div>
      </template>
    </Card>

    <div v-for="tipo in (['INGRESOS', 'EGRESOS'] as TipoCentro[])" :key="tipo" class="mb-6">
      <h2
        class="text-lg font-semibold mb-2"
        :data-testid="`centro-costos-section-${tipo.toLowerCase()}`"
      >
        {{ tipo === 'INGRESOS' ? 'Ingresos' : 'Egresos' }}
      </h2>

      <Card v-if="gruposPorTipo[tipo].length === 0">
        <template #content>
          <p class="text-center py-4 text-[var(--text-color-secondary)] text-sm">
            Sin centros de {{ tipo === 'INGRESOS' ? 'ingresos' : 'egresos' }} activos.
          </p>
        </template>
      </Card>

      <div
        v-for="g in gruposPorTipo[tipo]"
        :key="g.centro.id"
        class="mb-3"
        :data-testid="`centro-costos-grupo-${g.centro.id}`"
      >
        <Card>
          <template #content>
            <!-- R19: accordion header. Click to expand/collapse. -->
            <button
              type="button"
              class="w-full flex items-center justify-between text-left"
              :aria-expanded="isExpanded(g.centro.id)"
              :aria-controls="`centro-costos-grupo-body-${g.centro.id}`"
              :data-testid="`centro-costos-grupo-header-${g.centro.id}`"
              @click="toggleExpanded(g.centro.id)"
            >
              <div class="flex items-center gap-2">
                <i
                  :class="[
                    'pi',
                    isExpanded(g.centro.id) ? 'pi-chevron-down' : 'pi-chevron-right',
                    'text-[var(--text-color-secondary)]',
                  ]"
                  aria-hidden="true"
                ></i>
                <div>
                  <p class="font-semibold text-[var(--text-color)]">
                    {{ g.centro.nombre }}
                    <span
                      v-if="g.centro.tipo === 'INGRESOS' && g.centro.habilitarRecibo"
                      class="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"
                      data-testid="centro-costos-recibo-flag"
                    >
                      Recibo
                    </span>
                    <span
                      v-if="g.centro.tipo === 'INGRESOS' && !g.centro.precioUnitario"
                      class="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"
                      data-testid="centro-costos-no-precio-flag"
                    >
                      Sin precio
                    </span>
                  </p>
                  <p
                    v-if="g.centro.descripcion"
                    class="text-xs text-[var(--text-color-secondary)] mt-0.5"
                  >
                    {{ g.centro.descripcion }}
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <div class="text-right">
                  <p class="text-xs text-[var(--text-color-secondary)]">Subtotal</p>
                  <p
                    class="font-semibold"
                    :data-testid="`centro-costos-subtotal-${g.centro.id}`"
                  >
                    $ {{ fmtMoney(sumGrupo(g)) }}
                  </p>
                </div>
                <!-- R20: ADMIN can edit a centro inline. -->
                <Button
                  v-if="isAdmin"
                  icon="pi pi-pencil"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Editar centro'"
                  :data-testid="`centro-costos-edit-centro-${g.centro.id}`"
                  @click.stop="openEditCentro(g.centro)"
                />
                <Button
                  v-if="isAdmin && g.items.length === 0"
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Eliminar centro'"
                  :data-testid="`centro-costos-delete-centro-${g.centro.id}`"
                  @click.stop="openDeleteCentro(g.centro)"
                />
              </div>
            </button>

            <!-- R19: body renders only when expanded. -->
            <div
              v-show="isExpanded(g.centro.id)"
              :id="`centro-costos-grupo-body-${g.centro.id}`"
              class="mt-3"
              :data-testid="`centro-costos-grupo-body-${g.centro.id}`"
            >
              <DataTable
                :value="g.items"
                striped-rows
                responsive-layout="scroll"
                class="w-full"
                data-key="id"
              >
                <template #empty>
                  <div
                    class="text-center py-3 text-[var(--text-color-secondary)] text-sm"
                    :data-testid="`centro-costos-grupo-empty-${g.centro.id}`"
                  >
                    Sin ítems en este mes.
                  </div>
                </template>
                <Column header="Fecha" style="min-width: 110px">
                  <template #body="{ data }">
                    <span class="text-sm">{{ data.fecha }}</span>
                  </template>
                </Column>
                <Column header="Nombre" style="min-width: 180px">
                  <template #body="{ data }">
                    <div>
                      <p class="font-medium">{{ data.nombre }}</p>
                      <p
                        v-if="data.notas"
                        class="text-xs text-[var(--text-color-secondary)] mt-0.5 whitespace-pre-wrap"
                      >
                        {{ data.notas }}
                      </p>
                    </div>
                  </template>
                </Column>
                <Column header="Cantidad" style="min-width: 80px">
                  <template #body="{ data }">
                    <span class="text-sm">{{ data.cantidad }}</span>
                  </template>
                </Column>
                <Column header="Valor unitario" style="min-width: 130px">
                  <template #body="{ data }">
                    <span class="text-sm">$ {{ fmtMoney(data.valorUnitario) }}</span>
                  </template>
                </Column>
                <Column header="Valor total" style="min-width: 130px">
                  <template #body="{ data }">
                    <!-- D6: read-only — server computes. -->
                    <span class="text-sm font-semibold">$ {{ fmtMoney(data.valorTotal) }}</span>
                  </template>
                </Column>
                <Column
                  v-if="g.centro.tipo === 'INGRESOS'"
                  header="Pagador / Beneficiario"
                  style="min-width: 200px"
                >
                  <template #body="{ data }">
                    <div class="text-xs">
                      <p v-if="data.pagador">{{ data.pagador }}</p>
                      <p
                        v-if="data.beneficiarioClienteId != null"
                        class="text-[var(--text-color-secondary)]"
                      >
                        Beneficiario #{{ data.beneficiarioClienteId }}
                      </p>
                      <p
                        v-if="data.medioPago"
                        class="text-[var(--text-color-secondary)]"
                      >
                        {{ data.medioPago === 'EFECTIVO' ? 'Efectivo' : 'Transferencia' }}
                      </p>
                    </div>
                  </template>
                </Column>
                <Column
                  v-if="g.centro.tipo === 'EGRESOS'"
                  header="Factura"
                  style="min-width: 160px"
                >
                  <template #body="{ data }">
                    <div v-if="data.numeroFactura || data.proveedor || data.fechaFactura" class="text-xs">
                      <p v-if="data.numeroFactura">Nº {{ data.numeroFactura }}</p>
                      <p v-if="data.proveedor">{{ data.proveedor }}</p>
                      <p v-if="data.fechaFactura">{{ data.fechaFactura }}</p>
                    </div>
                    <span v-else class="text-xs text-[var(--text-color-secondary)]">—</span>
                  </template>
                </Column>
                <Column header="Acciones" style="min-width: 110px">
                  <template #body="{ data }">
                    <Button
                      icon="pi pi-pencil"
                      size="small"
                      severity="secondary"
                      text
                      rounded
                      v-tooltip.top="'Editar ítem'"
                      :data-testid="`centro-costos-edit-item-${data.id}`"
                      @click="openItemDialog(g.centro, data)"
                    />
                    <Button
                      v-if="!isContratosUser"
                      icon="pi pi-trash"
                      size="small"
                      severity="danger"
                      text
                      rounded
                      v-tooltip.top="'Eliminar ítem'"
                      :data-testid="`centro-costos-delete-item-${data.id}`"
                      @click="deleteItem(data)"
                    />
                  </template>
                </Column>
              </DataTable>

              <div class="mt-3 flex justify-end">
                <Button
                  label="Añadir ítem"
                  icon="pi pi-plus"
                  size="small"
                  severity="secondary"
                  :data-testid="`centro-costos-add-item-${g.centro.id}`"
                  @click="openItemDialog(g.centro, null)"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- Item dialog (add/edit). -->
    <Dialog
      v-model:visible="dialogVisible"
      :header="dialogEditingItem ? `Editar ítem — ${dialogEditingItem.nombre}` : 'Nuevo ítem'"
      :modal="true"
      :style="{ width: '40rem' }"
      :closable="!savingItem"
      data-testid="centro-costos-item-dialog"
    >
      <div class="space-y-3">
        <div>
          <label class="block text-sm font-medium mb-1" for="cc-nombre">Nombre *</label>
          <div data-testid="cc-item-nombre">
            <InputText
              id="cc-nombre"
              v-model="dialogForm.nombre"
              class="w-full"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="cc-cantidad">Cantidad *</label>
            <div data-testid="cc-item-cantidad">
              <InputNumber
                id="cc-cantidad"
                v-model="dialogForm.cantidad"
                :min="1"
                :max-fraction-digits="0"
                :min-fraction-digits="0"
                input-class="w-full"
                class="w-full"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="cc-fecha">
              Fecha *
            </label>
            <!-- aug-17 D10: required `fecha` (YYYY-MM-DD). Do NOT show a month-only `periodo` field. -->
            <input
              id="cc-fecha"
              type="date"
              v-model="dialogForm.fecha"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              data-testid="cc-item-fecha"
              :min="isContratosUser && fechaPolicy?.limitarFechaContratos ? fechaPolicy.previousBusinessDay : undefined"
              :max="isContratosUser && fechaPolicy?.limitarFechaContratos ? fechaPolicy.today : undefined"
            />
            <p
              v-if="isContratosUser && fechaPolicy?.limitarFechaContratos"
              class="text-xs text-[var(--text-color-secondary)] mt-1"
            >
              Solo hoy ({{ fechaPolicy.today }}) o el día hábil anterior ({{ fechaPolicy.previousBusinessDay }}).
            </p>
          </div>
        </div>

        <!-- EGRESOS: typed valorUnitario. -->
        <div v-if="isEgresoDialog">
          <label class="block text-sm font-medium mb-1" for="cc-valor-unitario">
            Valor unitario *
          </label>
          <div data-testid="cc-item-valor-unitario">
            <InputNumber
              id="cc-valor-unitario"
              v-model="dialogForm.valorUnitario"
              mode="decimal"
              :min-fraction-digits="2"
              :max-fraction-digits="2"
              input-class="w-full"
              class="w-full"
            />
          </div>
        </div>

        <!-- INGRESOS: valorUnitario is read-only from `centro.precioUnitario` (R26). -->
        <div v-else-if="isIngresoDialog">
          <label class="block text-sm font-medium mb-1">Valor unitario</label>
          <div
            class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color-secondary)]"
            data-testid="cc-item-valor-unitario-readonly"
          >
            <template v-if="dialogIngresoPrecioSource != null">
              $ {{ fmtMoney(dialogIngresoPrecioSource) }}
              <span class="text-xs">(precio del centro)</span>
            </template>
            <template v-else>
              <span class="text-amber-700 font-medium">
                El centro no tiene precio configurado. Un ADMIN debe editarlo.
              </span>
            </template>
          </div>
        </div>

        <!-- INGRESOS-only fields (R25, R28). -->
        <template v-if="isIngresoDialog">
          <div class="border-t border-[var(--surface-border)] pt-3 space-y-3">
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Datos del ingreso
            </p>
            <div>
              <label class="block text-sm font-medium mb-1" for="cc-pagador">Pagador *</label>
              <div data-testid="cc-item-pagador">
                <InputText
                  id="cc-pagador"
                  v-model="dialogForm.pagador"
                  class="w-full"
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" for="cc-beneficiario">
                Beneficiario *
              </label>
              <select
                id="cc-beneficiario"
                v-model="dialogForm.beneficiarioClienteId"
                class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
                data-testid="cc-item-beneficiario"
              >
                <option :value="null">— Seleccione —</option>
                <option v-for="p in patients" :key="p.id" :value="p.id">{{ p.nombre }}</option>
              </select>
              <p v-if="patientsLoading" class="text-xs text-[var(--text-color-secondary)] mt-1">
                Cargando pacientes...
              </p>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" for="cc-medio-pago">
                Medio de pago
              </label>
              <select
                id="cc-medio-pago"
                v-model="dialogForm.medioPago"
                class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
                data-testid="cc-item-medio-pago"
              >
                <option value="">— (Opcional) —</option>
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>
          </div>
        </template>

        <!-- EGRESOS-only invoice fields (unchanged). -->
        <template v-if="isEgresoDialog">
          <div class="border-t border-[var(--surface-border)] pt-3 space-y-3">
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Datos de factura (egreso)
            </p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1" for="cc-factura">Nº de factura</label>
                <div data-testid="cc-item-numero-factura">
                  <InputText
                    id="cc-factura"
                    v-model="dialogForm.numeroFactura"
                    class="w-full"
                  />
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1" for="cc-proveedor">Proveedor</label>
                <div data-testid="cc-item-proveedor">
                  <InputText
                    id="cc-proveedor"
                    v-model="dialogForm.proveedor"
                    class="w-full"
                  />
                </div>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1" for="cc-fecha-factura">Fecha de factura</label>
              <input
                id="cc-fecha-factura"
                type="date"
                v-model="dialogForm.fechaFactura"
                class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
                data-testid="cc-item-fecha-factura"
              />
            </div>
          </div>
        </template>

        <div>
          <label class="block text-sm font-medium mb-1">Notas</label>
          <div data-testid="cc-item-notas">
            <Textarea v-model="dialogForm.notas" rows="2" class="w-full" />
          </div>
        </div>

        <!-- D6: derived read-only preview. Server recomputes; never sent. -->
        <div
          class="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-ground)] p-3 flex items-center justify-between"
          data-testid="cc-item-total-preview"
        >
          <span class="text-sm text-[var(--text-color-secondary)]">Valor total (calculado por el servidor)</span>
          <span class="font-semibold">$ {{ fmtMoney(dialogPreviewTotal) }}</span>
        </div>
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="savingItem"
          data-testid="cc-item-cancelar"
          @click="closeItemDialog"
        />
        <Button
          :label="dialogEditingItem ? 'Guardar' : 'Crear'"
          icon="pi pi-check"
          :loading="savingItem"
          :disabled="savingItem"
          data-testid="cc-item-guardar"
          @click="saveItem"
        />
      </template>
    </Dialog>

    <!-- Create / edit centro dialog (R20). -->
    <Dialog
      v-model:visible="centroDialogVisible"
      :header="centroDialogEditing ? 'Editar centro' : 'Nuevo centro'"
      :modal="true"
      :style="{ width: '38rem' }"
      :closable="!centroDialogSaving"
      data-testid="centro-costos-centro-dialog"
    >
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="cc-centro-nombre">Nombre *</label>
            <div data-testid="cc-centro-nombre">
              <InputText
                id="cc-centro-nombre"
                v-model="centroDialogForm.nombre"
                class="w-full"
              />
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1" for="cc-centro-tipo">Tipo *</label>
            <select
              id="cc-centro-tipo"
              v-model="centroDialogForm.tipo"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
              data-testid="cc-centro-tipo"
              :disabled="centroDialogEditing"
            >
              <option value="INGRESOS">Ingresos</option>
              <option value="EGRESOS">Egresos</option>
            </select>
          </div>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1" for="cc-centro-descripcion">Descripción</label>
          <div data-testid="cc-centro-descripcion">
            <Textarea
              id="cc-centro-descripcion"
              v-model="centroDialogForm.descripcion"
              rows="2"
              class="w-full"
            />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-sm font-medium mb-1" for="cc-centro-orden">Orden</label>
            <div data-testid="cc-centro-orden">
              <InputNumber
                id="cc-centro-orden"
                v-model="centroDialogForm.orden"
                :min="0"
                :max-fraction-digits="0"
                :min-fraction-digits="0"
                input-class="w-full"
                class="w-full"
              />
            </div>
          </div>
          <div v-if="centroDialogEditing" class="flex items-end">
            <label class="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="centroDialogForm.activo"
                data-testid="cc-centro-activo"
              />
              Activo
            </label>
          </div>
        </div>

        <!-- INGRESOS-only fields (precioUnitario, habilitarRecibo). -->
        <template v-if="centroDialogForm.tipo === 'INGRESOS'">
          <div class="border-t border-[var(--surface-border)] pt-3 space-y-3">
            <p class="text-xs text-[var(--text-color-secondary)] uppercase tracking-wide">
              Datos del centro de ingresos
            </p>
            <div>
              <label class="block text-sm font-medium mb-1" for="cc-centro-precio">
                Precio unitario (copiado a los ítems)
              </label>
              <div data-testid="cc-centro-precio">
                <InputNumber
                  id="cc-centro-precio"
                  :model-value="
                    centroDialogForm.precioUnitario === null || centroDialogForm.precioUnitario === ''
                      ? null
                      : Number(centroDialogForm.precioUnitario)
                  "
                  @update:model-value="
                    (v: number | null) =>
                      Object.assign(centroDialogForm, {
                        precioUnitario: v == null ? null : String(v),
                      })
                  "
                  mode="decimal"
                  :min-fraction-digits="2"
                  :max-fraction-digits="2"
                  input-class="w-full"
                  class="w-full"
                />
              </div>
              <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                Si lo dejas vacío, no se podrán registrar ítems de ingreso hasta asignar un precio.
              </p>
            </div>
            <label class="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                v-model="centroDialogForm.habilitarRecibo"
                data-testid="cc-centro-habilitar-recibo"
              />
              Habilitar impresión de recibo al crear ítems
            </label>
          </div>
        </template>
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="centroDialogSaving"
          data-testid="cc-centro-cancelar"
          @click="closeCentroDialog"
        />
        <Button
          :label="centroDialogEditing ? 'Guardar cambios' : 'Crear centro'"
          icon="pi pi-check"
          :loading="centroDialogSaving"
          :disabled="centroDialogSaving"
          data-testid="cc-centro-guardar"
          @click="saveCentro"
        />
      </template>
    </Dialog>

    <!-- R29: print-recibo CTA after INGRESOS create on a `habilitarRecibo` centro. -->
    <Dialog
      v-model:visible="printAfterCreateVisible"
      header="Imprimir recibo"
      :modal="true"
      :closable="true"
      :style="{ width: '32rem' }"
      data-testid="centro-costos-print-after-create-dialog"
    >
      <div class="py-1">
        <p class="text-[var(--text-color)]">
          Se creó el ítem en
          <span class="font-semibold">{{ printAfterCreateCentroNombre }}</span>.
        </p>
        <p class="text-sm text-[var(--text-color-secondary)] mt-1">
          Este centro tiene habilitada la impresión de recibos. ¿Deseas imprimir ahora?
        </p>
      </div>
      <template #footer>
        <Button
          label="Más tarde"
          severity="secondary"
          outlined
          data-testid="cc-print-later"
          @click="dismissPrintAfterCreate"
        />
        <Button
          label="Imprimir recibo"
          icon="pi pi-print"
          severity="primary"
          data-testid="cc-print-now"
          @click="navigateToRecibo"
        />
      </template>
    </Dialog>

    <!-- Centro delete / deactivate dialog (D8). -->
    <Dialog
      v-model:visible="deactivateDialogVisible"
      header="Eliminar centro"
      :modal="true"
      :closable="!deactivateSaving"
      :style="{ width: '32rem' }"
      data-testid="centro-costos-delete-centro-dialog"
    >
      <div class="space-y-3 py-1">
        <p class="text-[var(--text-color)]">
          ¿Eliminar el centro
          <span class="font-semibold">{{ deactivateTarget?.nombre }}</span>?
        </p>
        <p class="text-sm text-[var(--text-color-secondary)]">
          Si el centro tiene ítems, el servidor devolverá 409 y debes
          <strong>desactivarlo</strong> en lugar de eliminarlo.
        </p>
      </div>
      <template #footer>
        <Button
          label="Cancelar"
          severity="secondary"
          outlined
          :disabled="deactivateSaving"
          @click="deactivateDialogVisible = false"
        />
        <Button
          label="Desactivar"
          icon="pi pi-ban"
          severity="warn"
          :loading="deactivateSaving"
          :disabled="deactivateSaving"
          data-testid="centro-costos-deactivate-btn"
          @click="performDeactivateCentro"
        />
        <Button
          label="Eliminar"
          icon="pi pi-trash"
          severity="danger"
          :loading="deactivateSaving"
          :disabled="deactivateSaving"
          data-testid="centro-costos-confirm-delete-centro"
          @click="performDeleteCentro"
        />
      </template>
    </Dialog>
  </div>
</template>