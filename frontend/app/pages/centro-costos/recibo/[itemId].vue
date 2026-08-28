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

async function loadItem() {
  if (!Number.isFinite(itemId.value)) {
    loadError.value = 'Identificador de ítem inválido.'
    return
  }
  loading.value = true
  loadError.value = null
  try {
    const res = await apiFetch<{ success: boolean; data: ReciboItem }>(
      `/centro-costos/items/${itemId.value}`,
    )
    item.value = res.data ?? null
    // Auto-trigger print once the data lands.
    if (item.value) {
      // Defer to allow the DOM to settle; print() opens the OS print dialog.
      setTimeout(() => window.print(), 250)
    }
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'No se pudo cargar el recibo.'
    loadError.value = detail
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  } finally {
    loading.value = false
  }
}

function goBack() {
  // Avoid triggering print on a back-nav; the receipt lives in its own page.
  if (typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back()
  } else {
    navigateTo('/centro-costos')
  }
}

onMounted(loadItem)
</script>

<template>
  <div class="recibo-page">
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
        @click="() => window.print()"
      />
    </div>

    <div v-if="loading" class="text-center py-8 text-[var(--text-color-secondary)]">
      Cargando recibo...
    </div>

    <div v-else-if="loadError" class="text-center py-8">
      <p class="text-red-600">{{ loadError }}</p>
    </div>

    <article v-else-if="item" class="recibo" data-testid="recibo-content">
      <header class="recibo-header">
        <h1 class="recibo-title">Recibo #{{ item.id }}</h1>
        <p class="recibo-subtitle">{{ item.centro.nombre }}</p>
      </header>

      <dl class="recibo-list">
        <div class="recibo-row">
          <dt class="recibo-label">Recibo #</dt>
          <dd class="recibo-value" data-testid="recibo-id">{{ item.id }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Fecha</dt>
          <dd class="recibo-value" data-testid="recibo-fecha">{{ item.fecha }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Pagador</dt>
          <dd class="recibo-value" data-testid="recibo-pagador">{{ item.pagador ?? '—' }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Beneficiario</dt>
          <dd class="recibo-value" data-testid="recibo-beneficiario">
            {{ item.beneficiario?.nombre ?? '—' }}
          </dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Concepto</dt>
          <dd class="recibo-value" data-testid="recibo-concepto">{{ item.centro.nombre }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Cantidad</dt>
          <dd class="recibo-value" data-testid="recibo-cantidad">{{ item.cantidad }}</dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Valor unitario</dt>
          <dd class="recibo-value" data-testid="recibo-valor-unitario">
            $ {{ fmtMoney(item.valorUnitario) }}
          </dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Valor total</dt>
          <dd class="recibo-value" data-testid="recibo-valor-total">
            $ {{ fmtMoney(item.valorTotal) }}
          </dd>
        </div>
        <div class="recibo-row">
          <dt class="recibo-label">Medio de pago</dt>
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
        <p>
          Impreso el
          {{ new Date().toLocaleDateString('es-CO') }} —
          Recibo generado automáticamente por el sistema.
        </p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.recibo-page {
  max-width: 640px;
  margin: 0 auto;
  padding: 1.5rem;
}

.recibo {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 1.5rem 2rem;
  font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
}

.recibo-header {
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.75rem;
  margin-bottom: 1rem;
}
.recibo-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}
.recibo-subtitle {
  color: #6b7280;
  margin-top: 0.25rem;
}

.recibo-list {
  margin: 0;
  padding: 0;
}
.recibo-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 0.5rem 0;
  border-bottom: 1px dashed #e5e7eb;
}
.recibo-row:last-of-type {
  border-bottom: none;
}
.recibo-label {
  font-weight: 500;
  color: #6b7280;
  margin: 0;
}
.recibo-value {
  font-weight: 600;
  color: #111827;
  margin: 0;
  text-align: right;
}

.recibo-footer {
  margin-top: 1.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
  font-size: 0.8rem;
  text-align: center;
}

/* Print rules: hide the toolbar and any non-print chrome.
 * The default layout renders the app sidebar in <aside> and the app header
 * in <header class="sticky top-0 z-30 ...">. We hide those plus our own
 * `.no-print` toolbar. The receipt's own `<header class="recibo-header">`
 * does NOT carry the .sticky utility, so it survives.
 */
@media print {
  :global(.no-print),
  :global(aside),
  :global(header.sticky) {
    display: none !important;
  }
  .recibo {
    border: none;
    padding: 0;
  }
  .recibo-page {
    padding: 0;
  }
}
</style>