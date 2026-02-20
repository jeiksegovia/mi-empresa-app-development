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
interface CertificadoFecha {
  id: number; fechaExpedicion: string; fechaVencimiento: string
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
  certificadoAlturas: CertificadoFecha | null
  certificadoRiesgoElectrico: CertificadoFecha | null
  datosMigracion: DatosMigracion | null
}

const route = useRoute()
const { apiFetch } = useApi()

const employee = ref<EmployeeDetail | null>(null)
const loading = ref(true)
const error = ref('')
const activeTab = ref(0)

const tabs = [
  { label: 'Información Personal', icon: 'pi pi-user' },
  { label: 'Experiencia & Educación', icon: 'pi pi-briefcase' },
  { label: 'Certificados & Documentos', icon: 'pi pi-file' },
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

function isCertExpired(vencimiento: string) {
  return new Date(vencimiento) < new Date()
}

function isCertExpiringSoon(vencimiento: string) {
  const diff = new Date(vencimiento).getTime() - Date.now()
  return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000 // 60 days
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

onMounted(fetchEmployee)
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
        <!-- Cert Alturas -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-shield text-violet-500" /> Certificado de Alturas
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.certificadoAlturas"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No tiene certificado de alturas registrado
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha Expedición</p>
                <p class="font-medium">{{ formatDate(employee.certificadoAlturas.fechaExpedicion) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Vencimiento</p>
                <p :class="[
                  'font-medium',
                  isCertExpired(employee.certificadoAlturas.fechaVencimiento) ? 'text-red-600' :
                  isCertExpiringSoon(employee.certificadoAlturas.fechaVencimiento) ? 'text-orange-500' : 'text-green-600'
                ]">{{ formatDate(employee.certificadoAlturas.fechaVencimiento) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado</p>
                <Tag
                  :value="isCertExpired(employee.certificadoAlturas.fechaVencimiento) ? 'Vencido' :
                    isCertExpiringSoon(employee.certificadoAlturas.fechaVencimiento) ? 'Por vencer' : 'Vigente'"
                  :severity="isCertExpired(employee.certificadoAlturas.fechaVencimiento) ? 'danger' :
                    isCertExpiringSoon(employee.certificadoAlturas.fechaVencimiento) ? 'warn' : 'success'"
                />
              </div>
            </div>
          </template>
        </Card>

        <!-- Cert Riesgo Electrico -->
        <Card>
          <template #header>
            <div class="px-6 pt-5 pb-0">
              <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
                <i class="pi pi-bolt text-violet-500" /> Certificado Riesgo Eléctrico
              </h3>
            </div>
          </template>
          <template #content>
            <div v-if="!employee.certificadoRiesgoElectrico"
              class="text-center py-6 text-[var(--text-color-secondary)] text-sm">
              No tiene certificado de riesgo eléctrico registrado
            </div>
            <div v-else class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Fecha Expedición</p>
                <p class="font-medium">{{ formatDate(employee.certificadoRiesgoElectrico.fechaExpedicion) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Vencimiento</p>
                <p :class="[
                  'font-medium',
                  isCertExpired(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'text-red-600' :
                  isCertExpiringSoon(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'text-orange-500' : 'text-green-600'
                ]">{{ formatDate(employee.certificadoRiesgoElectrico.fechaVencimiento) }}</p></div>
              <div><p class="text-xs text-[var(--text-color-secondary)] mb-1">Estado</p>
                <Tag
                  :value="isCertExpired(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'Vencido' :
                    isCertExpiringSoon(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'Por vencer' : 'Vigente'"
                  :severity="isCertExpired(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'danger' :
                    isCertExpiringSoon(employee.certificadoRiesgoElectrico.fechaVencimiento) ? 'warn' : 'success'"
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
    </template>
  </div>
</template>
