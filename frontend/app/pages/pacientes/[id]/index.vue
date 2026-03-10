<script setup lang="ts">
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
  instrumentoNombre: string
  instrumentoTipo: string
  estado: string
  fechaCompletado: string | null
  fechaVencimiento: string | null
}

interface NotaCliente {
  id: number
  tipo: string
  prioridad: string
  contenido: string
  fecha: string
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
  observacionesEspeciales: string | null
  contactosEmergencia: EmergencyContact[]
  registrosFichas: RegistroFicha[]
  notasCliente: NotaCliente[]
}

const route = useRoute()
const { apiFetch } = useApi()

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
})
const submittingNote = ref(false)

const showFichaDialog = ref(false)
const fichaForm = reactive({
  id: 0,
  estado: 'PENDIENTE' as 'COMPLETADO' | 'PENDIENTE' | 'VENCIDO',
  fechaCompletado: '',
  fechaVencimiento: '',
  notasObservaciones: '',
  instrumentoNombre: '',
})
const submittingFicha = ref(false)

const tabs = [
  { label: 'Información Básica', icon: 'pi pi-user' },
  { label: 'Fichas & Evaluaciones', icon: 'pi pi-file-check' },
  { label: 'Notas', icon: 'pi pi-book' },
]

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

const estadoFichaOptions = [
  { label: 'Completado', value: 'COMPLETADO' },
  { label: 'Pendiente', value: 'PENDIENTE' },
  { label: 'Vencido', value: 'VENCIDO' },
]

async function handleNoteSubmit() {
  if (!noteForm.contenido.trim() || !patient.value) {
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
      },
    })

    // Refresh patient data to show new note
    await fetchPatient()

    // Reset form and close dialog
    noteForm.tipo = 'NEUTRAL'
    noteForm.prioridad = 'MEDIA'
    noteForm.contenido = ''
    showNoteDialog.value = false
  } catch (e: any) {
    console.error('Error creating note:', e)
    alert('Error al crear la nota. Por favor, intenta nuevamente.')
  } finally {
    submittingNote.value = false
  }
}

function openNoteDialog() {
  noteForm.tipo = 'NEUTRAL'
  noteForm.prioridad = 'MEDIA'
  noteForm.contenido = ''
  showNoteDialog.value = true
}

function openFichaDialog(ficha: any) {
  fichaForm.id = ficha.id
  fichaForm.estado = ficha.estado
  fichaForm.fechaCompletado = ficha.fechaCompletado || ''
  fichaForm.fechaVencimiento = ficha.fechaVencimiento || ''
  fichaForm.notasObservaciones = ficha.notasObservaciones || ''
  fichaForm.instrumentoNombre = ficha.instrumento?.nombre || 'Ficha'
  showFichaDialog.value = true
}

async function handleFichaSubmit() {
  if (!fichaForm.id) {
    return
  }

  submittingFicha.value = true
  try {
    const payload: any = {
      estado: fichaForm.estado,
    }

    if (fichaForm.fechaCompletado) {
      payload.fechaCompletado = fichaForm.fechaCompletado
    }

    if (fichaForm.fechaVencimiento) {
      payload.fechaVencimiento = fichaForm.fechaVencimiento
    }

    if (fichaForm.notasObservaciones.trim()) {
      payload.notasObservaciones = fichaForm.notasObservaciones.trim()
    }

    await apiFetch(`/instruments/records/${fichaForm.id}`, {
      method: 'PUT',
      body: payload,
    })

    // Refresh patient data to show updated ficha
    await fetchPatient()

    // Close dialog
    showFichaDialog.value = false
  } catch (e: any) {
    console.error('Error updating ficha:', e)
    alert('Error al actualizar la ficha. Por favor, intenta nuevamente.')
  } finally {
    submittingFicha.value = false
  }
}

onMounted(fetchPatient)
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
                    <p class="font-medium text-[var(--text-color)]">{{ data.instrumentoNombre }}</p>
                    <p class="text-xs text-[var(--text-color-secondary)]">{{ data.instrumentoTipo }}</p>
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

              <Column header="Acciones" style="min-width: 80px">
                <template #body="{ data }">
                  <Button
                    icon="pi pi-eye"
                    size="small"
                    severity="secondary"
                    text
                    rounded
                    v-tooltip.top="'Ver detalles'"
                    @click="openFichaDialog(data)"
                  />
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
                  <span class="text-xs text-[var(--text-color-secondary)] ml-auto">
                    {{ formatShortDate(nota.fecha) }}
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
              :disabled="!noteForm.contenido.trim()"
            />
          </div>
        </form>
      </Dialog>

      <!-- Ficha Update Dialog -->
      <Dialog
        v-model:visible="showFichaDialog"
        modal
        :header="`Actualizar: ${fichaForm.instrumentoNombre}`"
        :style="{ width: '32rem' }"
        :breakpoints="{ '640px': '95vw' }"
      >
        <form @submit.prevent="handleFichaSubmit" class="space-y-4 pt-4">
          <div>
            <label for="estado" class="block text-sm font-medium mb-2">Estado *</label>
            <Select
              id="estado"
              v-model="fichaForm.estado"
              :options="estadoFichaOptions"
              option-label="label"
              option-value="value"
              placeholder="Selecciona el estado"
              class="w-full"
            />
          </div>

          <div>
            <label for="fechaCompletado" class="block text-sm font-medium mb-2">Fecha Completado</label>
            <input
              id="fechaCompletado"
              v-model="fichaForm.fechaCompletado"
              type="date"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-md text-sm"
            />
          </div>

          <div>
            <label for="fechaVencimiento" class="block text-sm font-medium mb-2">Fecha Vencimiento</label>
            <input
              id="fechaVencimiento"
              v-model="fichaForm.fechaVencimiento"
              type="date"
              class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-md text-sm"
            />
          </div>

          <div>
            <label for="notasObservaciones" class="block text-sm font-medium mb-2">Notas / Observaciones</label>
            <Textarea
              id="notasObservaciones"
              v-model="fichaForm.notasObservaciones"
              rows="4"
              placeholder="Agrega notas u observaciones sobre este registro..."
              class="w-full"
            />
          </div>

          <div class="flex justify-end gap-2">
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              @click="showFichaDialog = false"
              :disabled="submittingFicha"
            />
            <Button
              type="submit"
              label="Guardar Cambios"
              icon="pi pi-save"
              :loading="submittingFicha"
            />
          </div>
        </form>
      </Dialog>
    </template>
  </div>
</template>
