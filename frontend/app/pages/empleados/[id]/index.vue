<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

interface FamilyMember {
  id: number; nombre: string; apellido: string; tipoDocumento: string
  numeroDocumento: string | null; fechaNacimiento: string; genero: string
  telefono: string | null; parentesco: string
}
interface EmergencyContact {
  id: number; nombre: string; apellido: string; telefono: string; parentesco: string
}
interface Cargo {
  id: number; fechaIngreso: string; fechaTerminacion: string | null
  nombreCargo: string; ubicacion: string
}
interface ExperienciaLaboral {
  id: number; empresa: string; telefonoEmpresa: string | null; cargo: string
  sector: string | null; periodoInicio: string; periodoFin: string | null; funcionesLogros: string | null
}
interface EducacionIdioma {
  id: number; institucion: string; nivelEscritura: string; nivelHabla: string; capacidadTraducir: boolean
}
interface Vehiculo {
  id: number; tipoVehiculo: string; placas: string; tipoLicencia: string; numeroLicencia: string
}
interface Certificado {
  id: number
  tipo: 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
  nombre: string | null
  fechaExpedicion: string
  fechaVencimiento: string
  archivoUrl: string | null
}
interface DatosMigracion {
  id: number; numeroPasaporte: string; pasaporteExpedicion: string; pasaporteVencimiento: string
  numeroVisa: string | null; visaExpedicion: string | null; visaVencimiento: string | null
}
interface EmployeeDetail {
  id: number; nombre: string; apellido: string; tipoDocumento: string
  numeroDocumento: string; permisoTrabajo: boolean; genero: string
  fechaNacimiento: string; tipoVivienda: string | null; direccion: string | null
  estratoSocioeconomico: number | null; estadoCivil: string | null
  telefono: string | null; email: string | null; estado: 'ACTIVO' | 'INACTIVO'
  fechaRegistro: string
  nucleoFamiliar: FamilyMember[]
  contactosEmergencia: EmergencyContact[]
  cargos: Cargo[]
  experienciasLaborales: ExperienciaLaboral[]
  educacionIdiomas: EducacionIdioma[]
  vehiculos: Vehiculo[]
  certificados: Certificado[]
  datosMigracion: DatosMigracion | null
}

const route = useRoute()
const { apiFetch } = useApi()
const toast = useToast()
const authStore = useAuthStore()
const { downloadFile, uploadFile } = useFileUpload()

const employee = ref<EmployeeDetail | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

const tabs = [
  { label: 'Información Personal', icon: 'pi pi-user' },
  { label: 'Experiencia & Educación', icon: 'pi pi-briefcase' },
  { label: 'Certificados & Documentos', icon: 'pi pi-file' },

  { label: 'Pendientes', icon: 'pi pi-exclamation-circle' },

  { label: 'Novedades', icon: 'pi pi-bell' },
]

async function fetchEmployee() {
  loading.value = true
  error.value = ''
  try {
    const res = await apiFetch<{ success: boolean; data: EmployeeDetail }>(
      `/employees/${route.params.id}`
    )
    employee.value = res.data
  } catch (e: any) {
    if (e?.response?.status === 404) {
      error.value = 'Empleado no encontrado'
    } else {
      error.value = 'Error al cargar los datos del empleado'
    }
  } finally {
    loading.value = false
  }
}

function formatShortDate(dateStr: string | null | undefined) {
  return formatDate(dateStr, 'short')
}

function isCertExpired(vencimiento: string) {
  return new Date(vencimiento) < new Date()
}

function isCertExpiringSoon(vencimiento: string) {
  const diff = new Date(vencimiento).getTime() - Date.now()
  return diff > 0 && diff < CERT_POR_VENCER_DAYS * 24 * 60 * 60 * 1000
}

const certTipoLabels: Record<string, string> = {
  ALTURAS: 'Trabajo en Alturas',
  RIESGO_ELECTRICO: 'Riesgo Eléctrico',
  MANIPULACION_ALIMENTOS: 'Manipulación de Alimentos',
  OTRO: 'Otro',
}

const initials = computed(() => {
  if (!employee.value) return ''
  return ((employee.value.nombre?.[0] ?? '') + (employee.value.apellido?.[0] ?? '')).toUpperCase()
})

const currentCargo = computed(() => {
  if (!employee.value?.cargos?.length) return null
  return [...employee.value.cargos].sort(
    (a, b) => new Date(b.fechaIngreso).getTime() - new Date(a.fechaIngreso).getTime()
  )[0]
})

onMounted(async () => {
  await fetchEmployee()
  await Promise.all([fetchPendientes(), fetchNovedades()])
})

// ─── 
interface PendienteManual {
  id: number
  descripcion: string
  estado: 'PENDIENTE' | 'RESUELTO'
  creadoPor: number
  createdAt: string
  fechaResuelto: string | null
}
interface PendienteDerivado {
  id: string
  tipo: 'CERT_VENCIDO' | 'CERT_POR_VENCER' | 'HOJA_VIDA_FALTANTE' | 'SIN_CONTRATO_ACTIVO'
  descripcion: string
  severity: 'danger' | 'warn' | 'info'
  derived: true
}

const pendientesManuales = ref<PendienteManual[]>([])
const pendientesDerivados = ref<PendienteDerivado[]>([])
const pendientesLoading = ref(false)
const pendienteDialogOpen = ref(false)
const pendienteNewDescripcion = ref('')

async function fetchPendientes() {
  pendientesLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; manuales: PendienteManual[]; derivados: PendienteDerivado[] }>(
      `/employees/${route.params.id}/pendientes`
    )
    pendientesManuales.value = res.manuales ?? []
    pendientesDerivados.value = res.derivados ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
  } finally {
    pendientesLoading.value = false
  }
}

const pendientesOpenCount = computed(() => {
  const abiertos = pendientesManuales.value.filter((m) => m.estado === 'PENDIENTE').length
  const derivadosGraves = pendientesDerivados.value.filter((d) => d.tipo !== 'CERT_POR_VENCER').length
  return abiertos + derivadosGraves
})

function severityIcon(tipo: PendienteDerivado['tipo']) {
  if (tipo === 'CERT_VENCIDO') return 'pi pi-times-circle text-red-500'
  if (tipo === 'CERT_POR_VENCER') return 'pi pi-clock text-amber-500'
  if (tipo === 'HOJA_VIDA_FALTANTE') return 'pi pi-file-pdf text-blue-500'
  return 'pi pi-briefcase text-amber-500'
}

async function addPendiente() {
  if (!pendienteNewDescripcion.value.trim()) return
  try {
    await apiFetch(`/employees/${route.params.id}/pendientes`, {
      method: 'POST',
      body: { descripcion: pendienteNewDescripcion.value.trim() },
    })
    pendienteNewDescripcion.value = ''
    pendienteDialogOpen.value = false
    await fetchPendientes()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'No se pudo crear' })
  }
}

async function resolvePendiente(pid: number) {
  try {
    await apiFetch(`/employees/${route.params.id}/pendientes/${pid}`, {
      method: 'PATCH',
      body: { estado: 'RESUELTO' },
    })
    await fetchPendientes()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'No se pudo resolver' })
  }
}

async function deletePendiente(pid: number) {
  try {
    await apiFetch(`/employees/${route.params.id}/pendientes/${pid}`, { method: 'DELETE' })
    await fetchPendientes()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'No se pudo eliminar' })
  }
}


// ─── 
interface NovedadArchivo { nombre: string; url: string }
interface Novedad {
  id: number
  tipo: 'LLAMADO_ATENCION' | 'MEMORANDO' | 'PERMISO' | 'VACACIONES' | 'OTRA'
  titulo: string
  descripcion: string | null
  fechaInicio: string
  fechaFin: string | null
  archivos: NovedadArchivo[]
  createdAt: string
}

const novedades = ref<Novedad[]>([])
const novedadesLoading = ref(false)
const novedadDialogOpen = ref(false)
const novedadForm = reactive({
  tipo: 'MEMORANDO' as Novedad['tipo'],
  titulo: '',
  descripcion: '',
  fechaInicio: new Date().toISOString().slice(0, 10),
  fechaFin: '',
  archivos: [] as Array<{ nombre: string; url: string }>,
})
const uploadingNovedadArchivo = ref(false)

async function fetchNovedades() {
  novedadesLoading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: Novedad[] }>(
      `/employees/${route.params.id}/novedades`
    )
    novedades.value = res.data ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la información.', life: 5000 })
  } finally {
    novedadesLoading.value = false
  }
}

const novedadTipoLabels: Record<Novedad['tipo'], string> = {
  LLAMADO_ATENCION: 'Llamado de atención',
  MEMORANDO: 'Memorando',
  PERMISO: 'Permiso',
  VACACIONES: 'Vacaciones',
  OTRA: 'Otra',
}
const novedadTipoSeverity: Record<Novedad['tipo'], 'danger' | 'warn' | 'info' | 'success' | 'secondary'> = {
  LLAMADO_ATENCION: 'danger',
  MEMORANDO: 'warn',
  PERMISO: 'info',
  VACACIONES: 'success',
  OTRA: 'secondary',
}

function resetNovedadForm() {
  novedadForm.tipo = 'MEMORANDO'
  novedadForm.titulo = ''
  novedadForm.descripcion = ''
  novedadForm.fechaInicio = new Date().toISOString().slice(0, 10)
  novedadForm.fechaFin = ''
  novedadForm.archivos = []
}

async function saveNovedad() {
  if (!novedadForm.titulo.trim()) return
  try {
    await apiFetch(`/employees/${route.params.id}/novedades`, {
      method: 'POST',
      body: {
        tipo: novedadForm.tipo,
        titulo: novedadForm.titulo.trim(),
        descripcion: novedadForm.descripcion.trim() || undefined,
        fechaInicio: novedadForm.fechaInicio,
        fechaFin: novedadForm.fechaFin || undefined,
        archivos: novedadForm.archivos.length ? novedadForm.archivos : undefined,
      },
    })
    novedadDialogOpen.value = false
    resetNovedadForm()
    await fetchNovedades()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'No se pudo guardar' })
  }
}

async function onNovedadArchivoChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || !input.files[0]) return
  uploadingNovedadArchivo.value = true
  const key = await uploadFile(input.files[0], 'novedades')
  if (key) {
    novedadForm.archivos.push({ nombre: input.files[0].name, url: key })
  }
  uploadingNovedadArchivo.value = false
  input.value = ''
}

function removeNovedadArchivo(i: number) {
  novedadForm.archivos.splice(i, 1)
}

async function deleteNovedad(nid: number) {
  try {
    await apiFetch(`/employees/${route.params.id}/novedades/${nid}`, { method: 'DELETE' })
    await fetchNovedades()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'No se pudo eliminar' })
  }
}
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
        @click="navigateTo('/empleados')" />
    </div>

    <template v-else-if="employee">
      <!-- Page Header -->
      <AppPageHeader :title="`${employee.nombre} ${employee.apellido}`" subtitle="Perfil del empleado">
        <template #actions>
          <Button label="Volver" icon="pi pi-arrow-left" severity="secondary" outlined
            @click="navigateTo('/empleados')" />
          <Button label="Historial" icon="pi pi-history" severity="secondary"
            @click="navigateTo(`/empleados/${employee.id}/historial`)" />
          <Button label="Editar" icon="pi pi-pencil" severity="info"
            @click="navigateTo(`/empleados/${employee.id}/editar`)" />
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
                  {{ employee.nombre }} {{ employee.apellido }}
                </h2>
                <AppStatusBadge :status="employee.estado === 'ACTIVO' ? 'Activo' : 'Inactivo'" />
              </div>
              <p v-if="currentCargo" class="text-[var(--text-color-secondary)] mb-2">
                {{ currentCargo.nombreCargo }}
                <span class="text-xs ml-2 opacity-70">· {{ currentCargo.ubicacion }}</span>
              </p>
              <div class="flex flex-wrap gap-4 text-sm text-[var(--text-color-secondary)]">
                <span><i class="pi pi-id-card mr-1" />{{ employee.tipoDocumento }} {{ employee.numeroDocumento }}</span>
                <span v-if="employee.telefono"><i class="pi pi-phone mr-1" />{{ employee.telefono }}</span>
                <span v-if="employee.email"><i class="pi pi-envelope mr-1" />{{ employee.email }}</span>
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

      <!-- TAB 0: Información Personal -->
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
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Género</p>
                <p class="font-medium">{{ employee.genero || '—' }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha de Nacimiento</p>
                <p class="font-medium">{{ formatDate(employee.fechaNacimiento) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado Civil</p>
                <p class="font-medium">{{ employee.estadoCivil || '—' }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo de Vivienda</p>
                <p class="font-medium">{{ employee.tipoVivienda || '—' }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Estrato</p>
                <p class="font-medium">{{ employee.estratoSocioeconomico ?? '—' }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Permiso de Trabajo</p>
                <p class="font-medium">{{ employee.permisoTrabajo ? 'Sí' : 'No' }}</p></div>
              <div class="sm:col-span-2 lg:col-span-3">
                <p class="text-xs text-[var(--text-color-secondary)] mb-1">Dirección</p>
                <p class="font-medium">{{ employee.direccion || '—' }}</p></div>
            </div>
          </template>
        </Card>

        <!-- Family -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-users text-violet-500" /> Núcleo Familiar
                <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
                  {{ employee.nucleoFamiliar.length }} miembro(s)
                </span>
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="employee.nucleoFamiliar.length === 0"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay miembros registrados
            </div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="m in employee.nucleoFamiliar" :key="m.id"
                class="py-3 flex items-start justify-between gap-4">
                <div>
                  <p class="font-medium">{{ m.nombre }} {{ m.apellido }}</p>
                  <p class="text-sm text-[var(--text-color-secondary)]">
                    {{ m.parentesco }} · {{ m.genero }} · {{ m.tipoDocumento }} {{ m.numeroDocumento || '—' }}
                  </p>
                  <p class="text-xs text-[var(--text-color-secondary)]">
                    Nacimiento: {{ formatShortDate(m.fechaNacimiento) }}
                    <span v-if="m.telefono"> · {{ m.telefono }}</span>
                  </p>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Emergency Contacts -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-phone text-violet-500" /> Contactos de Emergencia
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="employee.contactosEmergencia.length === 0"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No hay contactos registrados
            </div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="c in employee.contactosEmergencia" :key="c.id"
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
      </div>

      <!-- TAB 1: Experiencia & Educación -->
      <div v-show="activeTab === 1" class="space-y-4">
        <!-- Positions / Cargos -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-building text-violet-500" /> Cargos en la Empresa
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.cargos.length"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">Sin cargos registrados</div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="c in employee.cargos" :key="c.id" class="py-3 flex justify-between gap-4">
                <div>
                  <p class="font-medium">{{ c.nombreCargo }}</p>
                  <p class="text-sm text-[var(--text-color-secondary)]">{{ c.ubicacion }}</p>
                </div>
                <div class="text-right text-xs text-[var(--text-color-secondary)] shrink-0">
                  <p>Ingreso: {{ formatShortDate(c.fechaIngreso) }}</p>
                  <p v-if="c.fechaTerminacion">Hasta: {{ formatShortDate(c.fechaTerminacion) }}</p>
                  <span v-else class="text-green-600 font-medium">Actual</span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- External Experience -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-briefcase text-violet-500" /> Experiencia Laboral Externa
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.experienciasLaborales.length"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">Sin experiencia registrada</div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="e in employee.experienciasLaborales" :key="e.id" class="py-3">
                <div class="flex justify-between gap-4 mb-1">
                  <div>
                    <p class="font-medium">{{ e.cargo }}</p>
                    <p class="text-sm text-[var(--text-color-secondary)]">
                      {{ e.empresa }}<span v-if="e.sector"> · {{ e.sector }}</span>
                    </p>
                  </div>
                  <div class="text-right text-xs text-[var(--text-color-secondary)] shrink-0">
                    <p>{{ formatShortDate(e.periodoInicio) }} – {{ e.periodoFin ? formatShortDate(e.periodoFin) : 'Actual' }}</p>
                  </div>
                </div>
                <p v-if="e.funcionesLogros"
                  class="text-sm text-[var(--text-color-secondary)] mt-1">{{ e.funcionesLogros }}</p>
              </div>
            </div>
          </template>
        </Card>

        <!-- Education / Languages -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-book text-violet-500" /> Educación e Idiomas
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.educacionIdiomas.length"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">Sin registros de educación</div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="e in employee.educacionIdiomas" :key="e.id" class="py-3">
                <p class="font-medium">{{ e.institucion }}</p>
                <div class="flex flex-wrap gap-3 mt-1 text-sm text-[var(--text-color-secondary)]">
                  <span>Escritura: <strong>{{ e.nivelEscritura }}</strong></span>
                  <span>Habla: <strong>{{ e.nivelHabla }}</strong></span>
                  <span v-if="e.capacidadTraducir" class="text-green-600">
                    <i class="pi pi-check text-xs mr-1" />Puede traducir
                  </span>
                </div>
              </div>
            </div>
          </template>
        </Card>

        <!-- Vehicles -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-car text-violet-500" /> Vehículos
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.vehiculos.length"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">Sin vehículos registrados</div>
            <div v-else class="divide-y divide-[var(--surface-border)]">
              <div v-for="v in employee.vehiculos" :key="v.id"
                class="py-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo</p>
                  <p class="font-medium">{{ v.tipoVehiculo }}</p></div>
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Placas</p>
                  <p class="font-medium font-mono">{{ v.placas }}</p></div>
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Tipo Licencia</p>
                  <p class="font-medium">{{ v.tipoLicencia }}</p></div>
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">N° Licencia</p>
                  <p class="font-medium">{{ v.numeroLicencia }}</p></div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <!-- TAB 2: Certificados & Documentos -->
      <div v-show="activeTab === 2" class="space-y-4">
        <!-- Certificados (unified) -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-shield text-violet-500" /> Certificados
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.certificados?.length"
              class="text-sm text-[var(--text-color-secondary)]">
              No tiene certificados registrados.
            </div>
            <div v-for="cert in employee.certificados" :key="cert.id"
              class="border border-[var(--surface-border)] rounded-lg p-4 mb-3 flex items-center justify-between">
              <div>
                <p class="font-medium">
                  {{ certTipoLabels[cert.tipo] }}<span v-if="cert.tipo === 'OTRO' && cert.nombre"> — {{ cert.nombre }}</span>
                </p>
                <p class="text-sm text-[var(--text-color-secondary)]">
                  {{ formatShortDate(cert.fechaExpedicion) }} → {{ formatShortDate(cert.fechaVencimiento) }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <Tag v-if="isCertExpired(cert.fechaVencimiento)" severity="danger" value="VENCIDO" />
                <Tag v-else-if="isCertExpiringSoon(cert.fechaVencimiento)" severity="warn" value="POR VENCER" />
                <Button
                  v-if="cert.archivoUrl"
                  icon="pi pi-download"
                  text
                  rounded
                  size="small"
                  @click="downloadFile(cert.archivoUrl)"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Migration Data -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-globe text-violet-500" /> Datos de Migración
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.datosMigracion"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No tiene datos de migración registrados
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">N° Pasaporte</p>
                <p class="font-medium font-mono">{{ employee.datosMigracion.numeroPasaporte }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Expedición Pasaporte</p>
                <p class="font-medium">{{ formatDate(employee.datosMigracion.pasaporteExpedicion) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Vencimiento Pasaporte</p>
                <p class="font-medium">{{ formatDate(employee.datosMigracion.pasaporteVencimiento) }}</p></div>
              <template v-if="employee.datosMigracion.numeroVisa">
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">N° Visa</p>
                  <p class="font-medium font-mono">{{ employee.datosMigracion.numeroVisa }}</p></div>
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Expedición Visa</p>
                  <p class="font-medium">{{ formatDate(employee.datosMigracion.visaExpedicion) }}</p></div>
                <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Vencimiento Visa</p>
                  <p class="font-medium">{{ formatDate(employee.datosMigracion.visaVencimiento) }}</p></div>
              </template>
            </div>
          </template>
        </Card>
      </div>

      <!-- TAB: Pendientes -->
      <div v-show="activeTab === 3" class="space-y-4" data-testid="pendientes-tab">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-exclamation-circle text-violet-500" /> Pendientes
                <span v-if="pendientesOpenCount > 0" class="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  {{ pendientesOpenCount }}
                </span>
              </h3>
              <Button
                v-if="authStore.isAdmin"
                label="Agregar pendiente"
                icon="pi pi-plus"
                size="small"
                severity="secondary"
                outlined
                data-testid="pendiente-add-btn"
                @click="pendienteDialogOpen = true"
              />
            </div>
          </template>
          <template #content>
            <div v-if="pendientesLoading" class="flex items-center justify-center py-8">
              <i class="pi pi-spin pi-spinner text-3xl text-violet-500" />
            </div>
            <div v-else-if="pendientesManuales.length === 0 && pendientesDerivados.length === 0" class="text-center py-6 text-[var(--text-color-secondary)]">
              Sin pendientes.
            </div>
            <div v-else class="space-y-2">
              <!-- Derivados (read-only, computed) -->
              <div
                v-for="d in pendientesDerivados"
                :key="d.id"
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]"
                data-testid="pendiente-derivado"
              >
                <i :class="severityIcon(d.tipo)" />
                <span class="flex-1 text-sm">{{ d.descripcion }}</span>
                <span class="text-xs text-[var(--text-color-secondary)]">Auto</span>
              </div>
              <!-- Manuales -->
              <div
                v-for="m in pendientesManuales"
                :key="m.id"
                class="flex items-center gap-3 px-4 py-3 border border-[var(--surface-border)] rounded-lg"
                :class="m.estado === 'RESUELTO' ? 'opacity-60 line-through' : ''"
                data-testid="pendiente-manual"
              >
                <i class="pi pi-list text-violet-500" />
                <span class="flex-1 text-sm">{{ m.descripcion }}</span>
                <Tag v-if="m.estado === 'RESUELTO'" value="Resuelto" severity="success" />
                <Button
                  v-else-if="authStore.isAdmin"
                  icon="pi pi-check"
                  size="small"
                  severity="success"
                  text
                  rounded
                  v-tooltip.top="'Resolver'"
                  :data-testid="`pendiente-resolve-${m.id}`"
                  @click="resolvePendiente(m.id)"
                />
                <Button
                  v-if="authStore.isAdmin"
                  icon="pi pi-trash"
                  size="small"
                  severity="danger"
                  text
                  rounded
                  v-tooltip.top="'Eliminar'"
                  @click="deletePendiente(m.id)"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Add pendiente dialog -->
        <Dialog
          v-model:visible="pendienteDialogOpen"
          header="Nuevo pendiente"
          :modal="true"
          :style="{ width: '32rem' }"
        >
          <div class="space-y-3">
            <label class="block text-sm font-medium">Descripción</label>
            <Textarea
              v-model="pendienteNewDescripcion"
              rows="3"
              class="w-full"
              placeholder="Describe la acción pendiente"
              data-testid="pendiente-new-descripcion"
            />
          </div>
          <template #footer>
            <Button
              label="Cancelar"
              severity="secondary"
              outlined
              @click="pendienteDialogOpen = false"
            />
            <Button
              label="Guardar"
              icon="pi pi-check"
              :disabled="!pendienteNewDescripcion.trim()"
              data-testid="pendiente-save"
              @click="addPendiente"
            />
          </template>
        </Dialog>
      </div>
      <!-- TAB: Pendientes -->
      <div v-show="activeTab === 4" class="space-y-4" data-testid="novedades-tab">
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0 flex items-center justify-between">
              <h3 class="text-base font-semibold flex items-center gap-2 text-[var(--text-color)]">
                <i class="pi pi-bell text-violet-500" /> Novedades
              </h3>
              <Button
                v-if="authStore.isAdmin"
                label="Nueva novedad"
                icon="pi pi-plus"
                size="small"
                severity="secondary"
                outlined
                data-testid="novedad-add-btn"
                @click="novedadDialogOpen = true"
              />
            </div>
          </template>
          <template #content>
            <div v-if="novedadesLoading" class="flex items-center justify-center py-6">
              <i class="pi pi-spin pi-spinner text-3xl text-violet-500" />
            </div>
            <div v-else-if="novedades.length === 0" class="text-center py-6 text-[var(--text-color-secondary)]">
              Sin novedades registradas.
            </div>
            <div v-else class="space-y-3" data-testid="novedades-timeline">
              <div
                v-for="n in novedades"
                :key="n.id"
                class="border border-[var(--surface-border)] rounded-lg p-4 space-y-2"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <Tag :value="novedadTipoLabels[n.tipo]" :severity="novedadTipoSeverity[n.tipo]" />
                    <span class="text-sm font-medium">{{ n.titulo }}</span>
                  </div>
                  <Button
                    v-if="authStore.isAdmin"
                    icon="pi pi-trash"
                    size="small"
                    severity="danger"
                    text
                    rounded
                    @click="deleteNovedad(n.id)"
                  />
                </div>
                <div class="text-xs text-[var(--text-color-secondary)]">
                  {{ formatDate(n.fechaInicio) }}<span v-if="n.fechaFin"> → {{ formatDate(n.fechaFin) }}</span>
                </div>
                <p v-if="n.descripcion" class="text-sm">{{ n.descripcion }}</p>
                <div v-if="n.archivos?.length" class="flex flex-wrap gap-2 pt-1">
                  <Button
                    v-for="(a, ai) in n.archivos"
                    :key="ai"
                    icon="pi pi-paperclip"
                    :label="a.nombre"
                    size="small"
                    severity="secondary"
                    outlined
                    @click="downloadFile(a.url)"
                  />
                </div>
              </div>
            </div>
          </template>
        </Card>

        <Dialog
          v-model:visible="novedadDialogOpen"
          header="Nueva novedad"
          :modal="true"
          :style="{ width: '40rem' }"
        >
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-medium mb-1">Tipo</label>
              <Select
                v-model="novedadForm.tipo"
                :options="[
                  { label: 'Llamado de atención', value: 'LLAMADO_ATENCION' },
                  { label: 'Memorando', value: 'MEMORANDO' },
                  { label: 'Permiso', value: 'PERMISO' },
                  { label: 'Vacaciones', value: 'VACACIONES' },
                  { label: 'Otra', value: 'OTRA' },
                ]"
                option-label="label"
                option-value="value"
                class="w-full"
                data-testid="novedad-tipo"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Título</label>
              <InputText
                v-model="novedadForm.titulo"
                class="w-full"
                placeholder="Resumen breve"
                data-testid="novedad-titulo"
              />
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium mb-1">Fecha inicio</label>
                <input type="date" v-model="novedadForm.fechaInicio" class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg" data-testid="novedad-fecha-inicio" />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">Fecha fin (opcional)</label>
                <input type="date" v-model="novedadForm.fechaFin" class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg" data-testid="novedad-fecha-fin" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Descripción</label>
              <Textarea v-model="novedadForm.descripcion" rows="3" class="w-full" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Archivos adjuntos</label>
              <input type="file" :disabled="uploadingNovedadArchivo" @change="onNovedadArchivoChange" />
              <div v-if="novedadForm.archivos.length" class="mt-2 space-y-1">
                <div v-for="(a, i) in novedadForm.archivos" :key="i" class="flex items-center gap-2 text-sm">
                  <i class="pi pi-paperclip text-violet-500" />
                  <span class="flex-1">{{ a.nombre }}</span>
                  <Button icon="pi pi-times" size="small" severity="danger" text rounded @click="removeNovedadArchivo(i)" />
                </div>
              </div>
            </div>
          </div>
          <template #footer>
            <Button label="Cancelar" severity="secondary" outlined @click="novedadDialogOpen = false" />
            <Button
              label="Guardar"
              icon="pi pi-check"
              :disabled="!novedadForm.titulo.trim()"
              data-testid="novedad-save"
              @click="saveNovedad"
            />
          </template>
        </Dialog>
      </div>
    </template>
  </div>
</template>
