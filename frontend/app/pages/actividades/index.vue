<script setup lang="ts">
/**
 * Registro de actividades — qa-session-aug-17 R6.
 * Contract: contract-schema-qa-aug-17.md §1 / §4 / §6.
 *
 * Matrix (FE mirror):
 *   PROFESORES / AUXILIARES → create-only (form today + list own)
 *   GERONTOLOGA / CONTRATOS → read-only (list all, no form)
 *   ADMIN → full (list all + edit/delete affordances)
 *
 * Own-item + today-only are service rules (BE). FE locks the date for
 * create-only profiles as a courtesy.
 */
definePageMeta({ middleware: 'auth', layout: 'default' })

import type {
  RegistroActividadCreateBody,
  RegistroActividadDto,
  RegistroActividadUpdateBody,
} from '~/shared/types/api'
import { toYMD } from '~/utils/date'

const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { can, canCreateOnly, isReadOnly, access } = useDomainAccess()

function todayYMD(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

const todayDate = computed(() => todayYMD())

/** create-only profiles (PROFESORES/AUXILIARES) may POST but only for today. */
const isSelfServiceWriter = computed(() => canCreateOnly('actividades'))
/** Hide every write affordance when matrix is read-only. */
const writesHidden = computed(() => isReadOnly('actividades') || access('actividades') === false)
/** ADMIN (or full-access) can PUT/DELETE. create-only cannot. */
const canManage = computed(() => {
  if (writesHidden.value) return false
  if (isSelfServiceWriter.value) return false
  return can('actividades') && !canCreateOnly('actividades')
})
/** Show the create form when the user can write (create-only or full). */
const showForm = computed(() => !writesHidden.value && can('actividades'))

const filterFecha = ref('')
const loading = ref(false)
const saving = ref(false)
const rows = ref<RegistroActividadDto[]>([])

// Create form — use refs (not reactive+v-model) to avoid the const-reactive pitfall.
const formFecha = ref(todayYMD())
const formTexto = ref('')

// ADMIN edit dialog
const editVisible = ref(false)
const editId = ref<number | null>(null)
const editFecha = ref('')
const editTexto = ref('')
const editSaving = ref(false)

async function fetchList() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (filterFecha.value) params.set('fecha', filterFecha.value)
    const qs = params.toString()
    const res = await apiFetch<{ success: boolean; data: RegistroActividadDto[] }>(
      qs ? `/actividades?${qs}` : '/actividades',
    )
    rows.value = res.data ?? []
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || 'No se pudo cargar el registro de actividades',
      life: 5000,
    })
    rows.value = []
  } finally {
    loading.value = false
  }
}

function onFilterFechaChange() {
  if (filterFecha.value && filterFecha.value.length > 10) {
    filterFecha.value = toYMD(filterFecha.value)
  }
  fetchList()
}

function clearFilter() {
  filterFecha.value = ''
  fetchList()
}

async function saveNuevo() {
  const texto = formTexto.value.trim()
  if (!texto) {
    toast.add({
      severity: 'warn',
      summary: 'Texto requerido',
      detail: 'Escriba la actividad del día.',
      life: 3000,
    })
    return
  }
  let fecha = formFecha.value
  if (isSelfServiceWriter.value) {
    fecha = todayDate.value
    formFecha.value = todayDate.value
  }
  saving.value = true
  try {
    const body: RegistroActividadCreateBody = { fecha, texto }
    await apiFetch('/actividades', { method: 'POST', body })
    toast.add({
      severity: 'success',
      summary: 'Actividad registrada',
      detail: `Registro del ${fecha} guardado.`,
      life: 3000,
    })
    formTexto.value = ''
    formFecha.value = todayDate.value
    await fetchList()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'No se pudo guardar la actividad',
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

function openEdit(row: RegistroActividadDto) {
  editId.value = row.id
  editFecha.value = row.fecha
  editTexto.value = row.texto
  editVisible.value = true
}

function closeEdit() {
  editVisible.value = false
  editId.value = null
  editFecha.value = ''
  editTexto.value = ''
}

async function saveEdit() {
  if (editId.value == null) return
  const texto = editTexto.value.trim()
  if (!texto) {
    toast.add({
      severity: 'warn',
      summary: 'Texto requerido',
      detail: 'El texto no puede quedar vacío.',
      life: 3000,
    })
    return
  }
  editSaving.value = true
  try {
    const body: RegistroActividadUpdateBody = {
      texto,
      fecha: editFecha.value || undefined,
    }
    await apiFetch(`/actividades/${editId.value}`, { method: 'PUT', body })
    toast.add({
      severity: 'success',
      summary: 'Actualizado',
      detail: 'Registro de actividad actualizado.',
      life: 3000,
    })
    closeEdit()
    await fetchList()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'No se pudo actualizar',
      life: 5000,
    })
  } finally {
    editSaving.value = false
  }
}

async function removeRow(row: RegistroActividadDto) {
  if (!confirm(`¿Eliminar el registro del ${row.fecha}?`)) return
  try {
    await apiFetch(`/actividades/${row.id}`, { method: 'DELETE' })
    toast.add({
      severity: 'success',
      summary: 'Eliminado',
      detail: 'Registro eliminado.',
      life: 3000,
    })
    await fetchList()
  } catch (e: any) {
    toast.add({
      severity: 'error',
      summary: 'Error',
      detail: e?.data?.message || e?.message || 'No se pudo eliminar',
      life: 5000,
    })
  }
}

onMounted(fetchList)
</script>

<template>
  <div data-testid="actividades-page">
    <AppPageHeader
      title="Registro de actividades"
      subtitle="Actividades diarias por empleado"
    />

    <!-- Create form: hidden for read-only (GERONTOLOGA/CONTRATOS). -->
    <Card
      v-if="showForm"
      class="mb-4"
      data-testid="actividades-form-card"
    >
      <template #content>
        <div class="flex flex-col gap-3">
          <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div class="flex flex-col gap-1">
              <label for="actividades-fecha" class="text-sm font-medium">Fecha</label>
              <input
                id="actividades-fecha"
                v-model="formFecha"
                type="date"
                :min="isSelfServiceWriter ? todayDate : undefined"
                :max="isSelfServiceWriter ? todayDate : undefined"
                :readonly="isSelfServiceWriter"
                class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm min-w-[11rem]"
                data-testid="actividades-fecha"
              />
              <span
                v-if="isSelfServiceWriter"
                class="text-xs text-[var(--text-color-secondary)] flex items-center gap-1"
              >
                <i class="pi pi-lock text-xs" />
                Solo puede registrar la fecha de hoy
              </span>
            </div>
            <div class="flex-1 flex flex-col gap-1">
              <label for="actividades-texto" class="text-sm font-medium">Actividad</label>
              <Textarea
                id="actividades-texto"
                v-model="formTexto"
                rows="3"
                class="w-full"
                placeholder="Describa la actividad del día…"
                data-testid="actividades-texto"
              />
            </div>
          </div>
          <div class="flex justify-end">
            <Button
              label="Guardar"
              icon="pi pi-save"
              data-testid="actividades-guardar"
              :loading="saving"
              :disabled="saving || !formTexto.trim()"
              @click="saveNuevo"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- List -->
    <Card>
      <template #content>
        <div class="flex flex-col sm:flex-row gap-3 mb-4 sm:items-end">
          <div class="flex flex-col gap-1">
            <label for="actividades-filter-fecha" class="text-sm font-medium">Filtrar por fecha</label>
            <div class="flex items-center gap-2">
              <input
                id="actividades-filter-fecha"
                v-model="filterFecha"
                type="date"
                class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm min-w-[11rem]"
                data-testid="actividades-filter-fecha"
                @change="onFilterFechaChange"
              />
              <Button
                v-if="filterFecha"
                icon="pi pi-times"
                severity="secondary"
                text
                rounded
                aria-label="Limpiar filtro"
                @click="clearFilter"
              />
            </div>
          </div>
        </div>

        <DataTable
          :value="rows"
          :loading="loading"
          striped-rows
          responsive-layout="scroll"
          class="w-full"
          data-key="id"
          data-testid="actividades-table"
        >
          <template #empty>
            <div class="text-center py-8 text-[var(--text-color-secondary)]">
              <i class="pi pi-list text-4xl mb-3 block opacity-30" />
              <p>No hay registros de actividades</p>
            </div>
          </template>

          <Column header="Fecha" style="min-width: 120px">
            <template #body="{ data }">
              <span class="text-sm font-medium">{{ data.fecha }}</span>
            </template>
          </Column>

          <Column header="Empleado" style="min-width: 100px">
            <template #body="{ data }">
              <span class="text-sm text-[var(--text-color-secondary)]">#{{ data.empleadoId }}</span>
            </template>
          </Column>

          <Column header="Actividad" style="min-width: 240px">
            <template #body="{ data }">
              <p class="text-sm whitespace-pre-wrap">{{ data.texto }}</p>
            </template>
          </Column>

          <Column v-if="canManage" header="Acciones" style="min-width: 120px">
            <template #body="{ data }">
              <div class="flex items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  size="small"
                  severity="info"
                  text
                  rounded
                  v-tooltip.top="'Editar'"
                  data-testid="actividades-editar"
                  @click="openEdit(data)"
                />
                <Button
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Eliminar'"
                  data-testid="actividades-eliminar"
                  @click="removeRow(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- ADMIN edit dialog -->
    <Dialog
      v-model:visible="editVisible"
      header="Editar actividad"
      :modal="true"
      :style="{ width: '32rem' }"
      data-testid="actividades-edit-dialog"
    >
      <div class="space-y-3">
        <div class="flex flex-col gap-1">
          <label for="actividades-edit-fecha" class="text-sm font-medium">Fecha</label>
          <input
            id="actividades-edit-fecha"
            v-model="editFecha"
            type="date"
            class="px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)] text-[var(--text-color)] text-sm"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="actividades-edit-texto" class="text-sm font-medium">Actividad</label>
          <Textarea
            id="actividades-edit-texto"
            v-model="editTexto"
            rows="4"
            class="w-full"
          />
        </div>
      </div>
      <template #footer>
        <Button label="Cancelar" severity="secondary" outlined :disabled="editSaving" @click="closeEdit" />
        <Button
          label="Guardar cambios"
          icon="pi pi-check"
          :loading="editSaving"
          :disabled="editSaving || !editTexto.trim()"
          @click="saveEdit"
        />
      </template>
    </Dialog>
  </div>
</template>
