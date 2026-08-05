<script setup lang="ts">
/**
 * Asistencia — Registrar hoy matrix (nomina-asistencia-jul-18).
 * GET /asistencia?fecha=YYYY-MM-DD → employee × AM/PM board.
 * PUT /asistencia/dia → bulk upsert flags for the selected date.
 *
 * Contract: schema-contract-nomina-asistencia-jul-18.md §4
 */
definePageMeta({ middleware: 'auth', layout: 'default' })

import type { AsistenciaDiaPutBody, AsistenciaDiaRow } from '~/shared/types/api'
import { toYMD } from '~/utils/date'

const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()

// qa-session-jul-24 §5.1: "today" computed via Intl.DateTimeFormat
// with timeZone America/Bogota — byte-identical to the backend's
// canonical helper. en-CA is the only stable locale that emits ISO
// YYYY-MM-DD. Compared as strings to avoid TZ drift.
function todayYMD(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

// R6 (qa-session-jul-24 §5): a CONTRATOS sub-role of EMPLEADO can only
// edit asistencia for `fecha === today`. ADMIN bypasses. Other roles
// have no PUT access (backend enforces).
const isContratosUser = computed(() =>
  authStore.user?.rol === 'EMPLEADO' && authStore.user?.tipoEmpleado === 'CONTRATOS',
)
const dateLocked = computed(() => isContratosUser.value)
const todayDate = computed(() => todayYMD())

const fecha = ref(todayYMD())
const search = ref('')
const loading = ref(false)
const saving = ref(false)
/** Local editable board (all ACTIVO employees for the date). */
const rows = ref<AsistenciaDiaRow[]>([])

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((r) => {
    const full = `${r.empleado.nombre} ${r.empleado.apellido} ${r.empleado.numeroDocumento}`.toLowerCase()
    return full.includes(q)
  })
})

const presentCount = computed(() =>
  rows.value.filter((r) => r.jornadaAm || r.jornadaPm).length,
)

async function fetchDay() {
  if (!fecha.value) return
  loading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: AsistenciaDiaRow[] }>(
      `/asistencia?fecha=${encodeURIComponent(fecha.value)}`,
    )
    rows.value = (res.data ?? []).map((r) => ({
      ...r,
      jornadaAm: !!r.jornadaAm,
      jornadaPm: !!r.jornadaPm,
      notas: r.notas ?? null,
    }))
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || 'No se pudo cargar la asistencia',
      life: 5000,
    })
    rows.value = []
  } finally {
    loading.value = false
  }
}

function setHoy() {
  fecha.value = todayYMD()
  fetchDay()
}

// qa-session-jul-24 R6: a CONTRATOS user who attempts to pick a
// different date silently snaps back to today (display-only — the
// authoritative check is the backend's 403 on fecha !== today).
function onFechaChange() {
  if (dateLocked.value && fecha.value !== todayDate.value) {
    fecha.value = todayDate.value
  }
  if (fecha.value && fecha.value.length > 10) {
    fecha.value = toYMD(fecha.value)
  }
  fetchDay()
}

function toggleAm(row: AsistenciaDiaRow) {
  row.jornadaAm = !row.jornadaAm
}

function togglePm(row: AsistenciaDiaRow) {
  row.jornadaPm = !row.jornadaPm
}

async function saveDay() {
  if (!fecha.value) return
  saving.value = true
  try {
    // Persist all loaded rows (not only filtered) so hidden search matches keep flags.
    const body: AsistenciaDiaPutBody = {
      fecha: fecha.value,
      items: rows.value.map((r) => ({
        empleadoId: r.empleadoId,
        jornadaAm: !!r.jornadaAm,
        jornadaPm: !!r.jornadaPm,
        notas: r.notas?.trim() ? r.notas.trim() : null,
      })),
    }
    await apiFetch('/asistencia/dia', {
      method: 'PUT',
      body,
    })
    toast.add({
      severity: 'success',
      summary: 'Asistencia guardada',
      detail: `Registro del ${fecha.value} actualizado.`,
      life: 3000,
    })
    await fetchDay()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'No se pudo guardar la asistencia',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

onMounted(fetchDay)
</script>

<template>
  <div data-testid="asistencia-page">
    <AppPageHeader
      title="Asistencia de empleados"
      subtitle="Registrar hoy — jornadas AM / PM por empleado"
    >
      <template #actions>
        <Button
          label="Guardar asistencia"
          icon="pi pi-save"
          data-testid="asistencia-guardar"
          :loading="saving"
          :disabled="loading || saving || rows.length === 0"
          @click="saveDay"
        />
      </template>
    </AppPageHeader>

    <Card class="mb-4">
      <template #content>
        <div class="flex flex-col lg:flex-row gap-3 lg:items-end">
          <div class="flex flex-col gap-1">
            <label for="asistencia-fecha" class="text-sm font-medium">Fecha</label>
            <div class="flex items-center gap-2">
              <input
                id="asistencia-fecha"
                v-model="fecha"
                type="date"
                :min="dateLocked ? todayDate : undefined"
                :max="dateLocked ? todayDate : undefined"
                :readonly="dateLocked"
                class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm min-w-[11rem]"
                data-testid="asistencia-fecha"
                @change="onFechaChange"
              />
              <Button
                v-if="!dateLocked"
                label="Hoy"
                icon="pi pi-calendar"
                severity="secondary"
                outlined
                data-testid="asistencia-hoy"
                @click="setHoy"
              />
              <!-- qa-session-jul-24 R6: visible-only date lock indicator
                   for the CONTRATOS sub-role. Backend enforces; this is
                   a courtesy affordance. -->
              <span
                v-if="dateLocked"
                class="text-xs text-[var(--text-color-secondary)] flex items-center gap-1"
                data-testid="asistencia-fecha-locked"
              >
                <i class="pi pi-lock text-xs" />
                Solo hoy
              </span>
            </div>
          </div>

          <div class="flex-1 flex flex-col gap-1">
            <label for="asistencia-buscar" class="text-sm font-medium">Buscar</label>
            <div class="relative">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-color-secondary)] z-10 pointer-events-none" />
              <InputText
                id="asistencia-buscar"
                v-model="search"
                placeholder="Buscar por nombre, apellido o documento…"
                class="w-full pl-10"
                data-testid="asistencia-buscar"
              />
            </div>
          </div>

          <div
            class="text-sm text-[var(--text-color-secondary)] whitespace-nowrap pb-2"
            data-testid="asistencia-summary"
          >
            {{ presentCount }} con asistencia · {{ rows.length }} empleados
          </div>
        </div>
      </template>
    </Card>

    <Card>
      <template #content>
        <div v-if="loading" class="flex items-center justify-center py-12" data-testid="asistencia-loading">
          <i class="pi pi-spin pi-spinner text-3xl text-violet-500" />
        </div>

        <div
          v-else-if="filteredRows.length === 0"
          class="text-center py-10 text-[var(--text-color-secondary)]"
          data-testid="asistencia-empty"
        >
          <i class="pi pi-users text-3xl mb-3 block opacity-40" />
          <p class="font-medium">Sin empleados activos para esta fecha.</p>
          <p class="text-sm mt-1">Solo se listan empleados en estado ACTIVO.</p>
        </div>

        <div v-else class="overflow-x-auto" data-testid="asistencia-matrix">
          <!-- Header: Empleado | Documento | AM | PM | Notas -->
          <div
            class="grid grid-cols-[minmax(10rem,1.4fr)_minmax(6rem,0.8fr)_4.5rem_4.5rem_minmax(8rem,1fr)] gap-2 items-center px-2 py-2 border-b border-[var(--surface-border)] text-xs font-semibold uppercase tracking-wide text-[var(--text-color-secondary)] min-w-[36rem]"
          >
            <div>Empleado</div>
            <div>Documento</div>
            <div class="text-center">Jornada AM</div>
            <div class="text-center">Jornada PM</div>
            <div>Notas</div>
          </div>

          <div
            v-for="row in filteredRows"
            :key="row.empleadoId"
            class="grid grid-cols-[minmax(10rem,1.4fr)_minmax(6rem,0.8fr)_4.5rem_4.5rem_minmax(8rem,1fr)] gap-2 items-center px-2 py-2 border-b border-[var(--surface-border)] last:border-0 hover:bg-[var(--surface-hover)] min-w-[36rem]"
            :data-testid="`asistencia-row-${row.empleadoId}`"
          >
            <div class="min-w-0">
              <p class="font-medium text-sm truncate">
                {{ row.empleado.nombre }} {{ row.empleado.apellido }}
              </p>
            </div>

            <div class="min-w-0">
              <p class="text-sm text-[var(--text-color-secondary)] truncate">
                {{ row.empleado.numeroDocumento }}
              </p>
            </div>

            <!-- Large touch targets for AM (WCAG / mobile) -->
            <div class="flex justify-center">
              <button
                type="button"
                role="checkbox"
                :aria-checked="row.jornadaAm"
                :aria-label="`Jornada AM ${row.empleado.nombre} ${row.empleado.apellido}`"
                class="min-w-[3rem] min-h-[3rem] sm:min-w-[3.25rem] sm:min-h-[3.25rem] rounded-xl border-2 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                :class="row.jornadaAm
                  ? 'bg-violet-500 border-violet-500 text-white'
                  : 'bg-[var(--surface-card)] border-[var(--surface-border)] text-[var(--text-color-secondary)]'"
                :data-testid="`asistencia-am-${row.empleadoId}`"
                @click="toggleAm(row)"
              >
                <i :class="row.jornadaAm ? 'pi pi-check text-lg' : 'pi pi-minus text-sm opacity-40'" />
              </button>
            </div>

            <div class="flex justify-center">
              <button
                type="button"
                role="checkbox"
                :aria-checked="row.jornadaPm"
                :aria-label="`Jornada PM ${row.empleado.nombre} ${row.empleado.apellido}`"
                class="min-w-[3rem] min-h-[3rem] sm:min-w-[3.25rem] sm:min-h-[3.25rem] rounded-xl border-2 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                :class="row.jornadaPm
                  ? 'bg-violet-500 border-violet-500 text-white'
                  : 'bg-[var(--surface-card)] border-[var(--surface-border)] text-[var(--text-color-secondary)]'"
                :data-testid="`asistencia-pm-${row.empleadoId}`"
                @click="togglePm(row)"
              >
                <i :class="row.jornadaPm ? 'pi pi-check text-lg' : 'pi pi-minus text-sm opacity-40'" />
              </button>
            </div>

            <div class="min-w-0">
              <InputText
                v-model="row.notas"
                placeholder="Opcional"
                class="w-full text-sm"
                maxlength="500"
                :data-testid="`asistencia-notas-${row.empleadoId}`"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>
