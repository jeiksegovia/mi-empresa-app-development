<script setup lang="ts">
/**
 * Recibo — feature-centro-costos-ago-5 (aug-17 update, R29–R30).
 *
 * Renders a single ítem as a simple text receipt (label left / value right).
 * No PDF; `window.print()` with `@media print` rules hides app chrome.
 *
 * Data shape: GET /centro-costos/items/:itemId → extends CentroCostosItem
 * with `centro: CentroCostos` and `beneficiario: { id, nombre } | null`.
 */
definePageMeta({
  middleware: 'auth',
  // The layout renders the sidebar/header; @media print below strips them.
  layout: 'default',
})

interface ReciboItem {
  id: number
  centroCostosId: number
  nombre: string
  notas: string | null
  cantidad: number
  valorUnitario: number | string
  valorTotal: number | string
  fecha: string
  periodo: string
  numeroFactura: string | null
  proveedor: string | null
  fechaFactura: string | null
  pagador: string | null
  beneficiarioClienteId: number | null
  medioPago: 'EFECTIVO' | 'TRANSFERENCIA' | null
  createdAt: string
  updatedAt: string
  centro: {
    id: number
    nombre: string
    tipo: 'INGRESOS' | 'EGRESOS'
    descripcion: string | null
    precioUnitario: string | null
    habilitarRecibo: boolean
  }
  beneficiario: { id: number; nombre: string } | null
}

const route = useRoute()
const itemId = computed(() => {
  const v = route.params.itemId
  const n = Number(Array.isArray(v) ? v[0] : v)
  return Number.isFinite(n) ? n : NaN
})

const { apiFetch } = useApi()
const toast = useToast()

const loading = ref(false)
const item = ref<ReciboItem | null>(null)
const empresa = ref<{ nombre: string; nit: string; direccion: string | null; telefono: string | null } | null>(null)
const loadError = ref<string | null>(null)

function asNum(v: number | string | null | undefined): number {
  if (v == null || v === '') return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function fmtMoney(v: number | string | null | undefined): string {
  return asNum(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMedioPago(m: ReciboItem['medioPago']): string {
  if (m === 'EFECTIVO') return 'Efectivo'
  if (m === 'TRANSFERENCIA') return 'Transferencia'
  return '—'
}

function hasBeneficiario(it: ReciboItem): boolean {
  return !!it.beneficiario?.nombre?.trim()
}

async function loadItem() {
  if (!Number.isFinite(itemId.value)) {
    loadError.value = 'Identificador de ítem inválido.'
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const [res, emp] = await Promise.all([
      apiFetch<{ success: boolean; data: ReciboItem }>(
        `/centro-costos/items/${itemId.value}`,
      ),
      apiFetch<{ success: boolean; data: { nombre: string; nit: string; direccion: string | null; telefono: string | null } }>(
        '/empresa',
      ).catch(() => null),
    ])
    item.value = res.data ?? null
    empresa.value = emp?.data ?? null
    if (item.value) {
      requestPrint()
    }
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo cargar el recibo.'
    loadError.value = detail
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    loading.value = false
  }
}

/** Ignore a second Imprimir click for 1.5s so cancel/idle can finish. */
const PRINT_COOLDOWN_MS = 1500
const printLocked = ref(false)
let lastPrintIntentAt = 0
let unlockTimer: ReturnType<typeof setTimeout> | null = null

function requestPrint() {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (printLocked.value) return
  if (now - lastPrintIntentAt < PRINT_COOLDOWN_MS) return
  lastPrintIntentAt = now
  printLocked.value = true
  window.focus()
  // Defer so a cancelled OS dialog can close before the next print().
  setTimeout(() => window.print(), 50)
  if (unlockTimer) clearTimeout(unlockTimer)
  unlockTimer = setTimeout(() => {
    printLocked.value = false
    unlockTimer = null
  }, PRINT_COOLDOWN_MS)
}

function goBack() {
  if (typeof window === 'undefined') {
    navigateTo('/centro-costos')
    return
  }
  // Script-opened tab: close it so the list tab keeps accordion / month / scroll.
  // `?popup=1` is the fallback when window.opener is missing (some Chromium
  // builds). Browsers ignore close() on a tab the user typed or bookmarked.
  const openedAsPopup =
    (window.opener && !window.opener.closed) ||
    new URLSearchParams(window.location.search).get('popup') === '1'
  if (openedAsPopup) {
    window.close()
    return
  }
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  navigateTo('/centro-costos')
}

onMounted(loadItem)
</script>

<template>
  <div class="recibo-page" data-testid="recibo-print-page">
    <!-- Non-print toolbar: visible on screen, hidden on @media print. -->
    <div class="no-print mb-4 flex items-center justify-between">
      <Button
        label="Volver"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        data-testid="recibo-back"
        @click="goBack"
      />
      <Button
        label="Imprimir"
        icon="pi pi-print"
        severity="primary"
        data-testid="recibo-print"
        :disabled="printLocked"
        @click="requestPrint"
      />
    </div>

    <div v-if="loading" class="text-center py-8 text-[var(--text-color-secondary)]">
      Cargando recibo...
    </div>

    <div v-else-if="loadError" class="text-center py-8">
      <p class="text-red-600">{{ loadError }}</p>
    </div>

    <article v-else-if="item" class="recibo" data-testid="recibo-content" data-print-ready="true">
      <header class="recibo-header">
        <p v-if="empresa" class="recibo-empresa" data-testid="recibo-empresa">{{ empresa.nombre }}</p>
        <p v-if="empresa?.nit" class="recibo-meta">NIT {{ empresa.nit }}</p>
        <p v-if="empresa?.direccion" class="recibo-meta">{{ empresa.direccion }}</p>
        <p v-if="empresa?.telefono" class="recibo-meta" data-testid="recibo-telefono">{{ empresa.telefono }}</p>
        <h1 class="recibo-title">RECIBO DE CAJA</h1>
        <p class="recibo-subtitle">Nº <span data-testid="recibo-id">{{ item.id }}</span></p>
      </header>

      <dl class="recibo-list">
        <div class="recibo-row">
          <dt class="recibo-label">Fecha</dt>
          <dd class="recibo-value" data-testid="recibo-fecha">{{ item.fecha }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Pagador</dt>
          <dd class="recibo-value" data-testid="recibo-pagador">{{ item.pagador ?? '—' }}</dd>
        </div>
        <div v-if="hasBeneficiario(item)" class="recibo-row">
          <dt class="recibo-label">Beneficiario</dt>
          <dd class="recibo-value" data-testid="recibo-beneficiario">
            {{ item.beneficiario?.nombre }}
          </dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Concepto</dt>
          <dd class="recibo-value" data-testid="recibo-concepto">{{ item.centro.nombre }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Detalle</dt>
          <dd class="recibo-value" data-testid="recibo-detalle">{{ item.nombre }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Cantidad</dt>
          <dd class="recibo-value" data-testid="recibo-cantidad">{{ item.cantidad }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">V. unitario</dt>
          <dd class="recibo-value" data-testid="recibo-valor-unitario">
            $ {{ fmtMoney(item.valorUnitario) }}
          </dd>
        </div>
        <div class="recibo-row recibo-row-total">
          <dt class="recibo-label">TOTAL</dt>
          <dd class="recibo-value" data-testid="recibo-valor-total">
            $ {{ fmtMoney(item.valorTotal) }}
          </dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Medio</dt>
          <dd class="recibo-value" data-testid="recibo-medio-pago">
            {{ fmtMedioPago(item.medioPago) }}
          </dd>
        </div>
        <div v-if="item.notas" class="recibo-row">
          <dt class="recibo-label">Notas</dt>
          <dd class="recibo-value" data-testid="recibo-notas">{{ item.notas }}</dd>
        </div>
      </dl>

      <footer class="recibo-footer">
        <p data-testid="recibo-footer">
          Impreso {{ new Date().toLocaleDateString('es-CO') }}
        </p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
/* 80mm thermal sheet. Screen = print: 80mm paper, 4mm margin, 72mm ticket. */
.recibo-page {
  box-sizing: border-box;
  width: 80mm;
  max-width: 80mm;
  margin: 0 auto;
  padding: 4mm;
  background: #fff;
}

.recibo {
  box-sizing: border-box;
  width: 100%;
  background: #fff;
  color: #000;
  border: 1px dashed #000;
  border-radius: 0;
  padding: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.35;
  overflow: visible;
  print-color-adjust: exact;
  -webkit-print-color-adjust: exact;
}
.recibo,
.recibo * {
  color: #000;
}

.recibo-header {
  text-align: center;
  border-bottom: 1px dashed #000;
  padding-bottom: 8px;
  margin-bottom: 8px;
}
.recibo-empresa {
  font-weight: 700;
  font-size: 13px;
  margin: 0 0 2px;
  text-transform: uppercase;
  word-break: break-word;
}
.recibo-meta {
  margin: 0;
  font-size: 11px;
  color: #000;
  word-break: break-word;
}
.recibo-title {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 8px 0 0;
}
.recibo-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
}

.recibo-list {
  margin: 0;
  padding: 0;
}
.recibo-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px dotted #000;
}
/* Drop the dotted rule immediately above TOTAL so it does not stack
 * with TOTAL's dashed top (that was the double line under V. unitario). */
.recibo-row:has(+ .recibo-row-total) {
  border-bottom: none;
}
.recibo-row:last-child {
  border-bottom: none;
}
.recibo-label {
  flex: 0 0 38%;
  font-weight: 500;
  color: #000;
  margin: 0;
  word-break: break-word;
}
.recibo-value {
  flex: 1 1 62%;
  font-weight: 600;
  color: #000;
  margin: 0;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.recibo-row-total {
  border-top: 1px dashed #000;
  border-bottom: 1px dashed #000;
  margin-top: 4px;
  padding: 6px 0;
  font-size: 13px;
}
.recibo-row-total .recibo-label,
.recibo-row-total .recibo-value {
  color: #000;
  font-weight: 700;
}

.recibo-footer {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed #000;
  color: #000;
  font-size: 10px;
  text-align: center;
}
.recibo-footer p {
  margin: 0;
}

@media print {
  @page {
    size: 80mm auto;
    margin: 0;
  }
  :global(html),
  :global(body) {
    background: #fff !important;
    margin: 0 !important;
    padding: 0 !important;
    min-height: 0 !important;
    height: auto !important;
    overflow: visible !important;
  }
  :global(.min-h-screen) {
    min-height: 0 !important;
    height: auto !important;
  }
  :global(.no-print),
  :global(aside),
  :global(header.sticky),
  :global(.p-toast),
  :global(.p-toast-message) {
    display: none !important;
  }
  :global(main) {
    padding: 0 !important;
    margin: 0 !important;
    overflow: visible !important;
  }
  .recibo-page {
    width: 80mm;
    max-width: 80mm;
    margin: 0;
    padding: 4mm;
  }
  .recibo {
    border: none;
    padding: 0;
    width: 100%;
    overflow: visible;
    color: #000 !important;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .recibo,
  .recibo * {
    color: #000 !important;
    border-color: #000 !important;
  }
}
</style>