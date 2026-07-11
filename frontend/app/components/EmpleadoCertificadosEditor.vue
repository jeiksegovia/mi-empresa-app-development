<script setup lang="ts">
/**
 * EmpleadoCertificadosEditor — shared component used by both
 * /empleados/nuevo (wizard step 5) and /empleados/[id]/editar (tab 5).
 *
 * Guarantees parity between create and edit forms so certificates never
 * "disappear" on edit.
 *
 * `v-model:certificados` semantics: replace-all (parent gets the full array).
 */
import { computed, ref } from 'vue'
import { useToast } from 'primevue/usetoast'

export interface CertificadoEmpleadoInput {
  tipo: '' | 'ALTURAS' | 'RIESGO_ELECTRICO' | 'MANIPULACION_ALIMENTOS' | 'OTRO'
  nombre?: string
  fechaExpedicion: string
  fechaVencimiento: string
  archivoUrl?: string         // presigned key (not raw URL)
}

const props = defineProps<{
  certificados: CertificadoEmpleadoInput[]
}>()

const emit = defineEmits<{
  (e: 'update:certificados', value: CertificadoEmpleadoInput[]): void
}>()

const toast = useToast()
const { uploadFile, downloadFile } = useFileUpload()

const tipoOptions = [
  { label: 'Trabajo en Alturas', value: 'ALTURAS' },
  { label: 'Riesgo Eléctrico', value: 'RIESGO_ELECTRICO' },
  { label: 'Manipulación de Alimentos', value: 'MANIPULACION_ALIMENTOS' },
  { label: 'Otro', value: 'OTRO' },
]

const localList = computed({
  get: () => props.certificados ?? [],
  set: (v) => emit('update:certificados', v),
})

function addRow() {
  localList.value = [
    ...localList.value,
    { tipo: '', nombre: '', fechaExpedicion: '', fechaVencimiento: '', archivoUrl: '' },
  ]
}

function removeRow(i: number) {
  const next = [...localList.value]
  next.splice(i, 1)
  localList.value = next
}

function patchRow(i: number, patch: Partial<CertificadoEmpleadoInput>) {
  const next = [...localList.value]
  next[i] = { ...next[i], ...patch }
  // Clear `nombre` when switching away from OTRO so we don't send stale data
  if (patch.tipo !== undefined && patch.tipo !== 'OTRO') {
    next[i].nombre = ''
  }
  localList.value = next
}

const uploadingRow = ref<number | null>(null)

async function uploadArchivo(rowIndex: number, file: File) {
  uploadingRow.value = rowIndex
  try {
    const key = await uploadFile(file, 'certificados-empleado')
    if (key) {
      patchRow(rowIndex, { archivoUrl: key })
      toast.add({
        severity: 'success',
        summary: 'Archivo subido',
        detail: 'Certificado adjuntado correctamente.',
        life: 3000,
      })
    }
  } finally {
    uploadingRow.value = null
  }
}

function onArchivoChange(rowIndex: number, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) uploadArchivo(rowIndex, input.files[0])
}

function removeArchivo(rowIndex: number) {
  patchRow(rowIndex, { archivoUrl: '' })
}

// W11 P1 (S7 second half): download affordance for an existing key.
// Mirrors the diploma path on empleados/[id]/editar → EducacionEmpleado
// rows (`downloadEducacionDiploma`). Without this, the certificado row
// shows "adjuntado" but offers no way to re-view the file — the QA
// transcript explicitly flagged the inconsistency with the diploma UI.
async function downloadArchivo(key: string) {
  if (!key) return
  try {
    await downloadFile(key)
  } catch {
    // downloadFile already toasts on error; nothing else to do here.
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-sm text-[var(--text-color-secondary)]">
        Certificados del empleado. Agregue uno o varios según corresponda.
      </p>
      <Button
        type="button"
        icon="pi pi-plus"
        label="Agregar certificado"
        size="small"
        severity="secondary"
        outlined
        @click="addRow"
      />
    </div>

    <div v-if="localList.length === 0" class="text-center py-4 text-sm text-[var(--text-color-secondary)]">
      Sin certificados registrados.
    </div>

    <div
      v-for="(cert, i) in localList"
      :key="i"
      class="border border-[var(--surface-border)] rounded-lg p-4 space-y-3"
    >
      <div class="flex items-center justify-between">
        <span class="text-sm font-medium text-[var(--text-color-secondary)]">
          Certificado {{ i + 1 }}
        </span>
        <Button
          type="button"
          icon="pi pi-trash"
          size="small"
          severity="danger"
          text
          rounded
          aria-label="Eliminar certificado"
          @click="removeRow(i)"
        />
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium">Tipo *</label>
          <Select
            :model-value="cert.tipo"
            :options="tipoOptions"
            option-label="label"
            option-value="value"
            placeholder="Seleccionar tipo"
            size="small"
            @update:model-value="(v: any) => patchRow(i, { tipo: v })"
          />
        </div>

        <div v-if="cert.tipo === 'OTRO'" class="flex flex-col gap-1">
          <label class="text-xs font-medium">Nombre *</label>
          <InputText
            :model-value="cert.nombre"
            placeholder="Ej: Operador de montacargas"
            size="small"
            @update:model-value="(v: string) => patchRow(i, { nombre: v })"
          />
        </div>

        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium">Fecha de Expedición *</label>
          <InputText
            type="date"
            size="small"
            :model-value="cert.fechaExpedicion"
            @update:model-value="(v: string) => patchRow(i, { fechaExpedicion: v })"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-xs font-medium">Fecha de Vencimiento *</label>
          <InputText
            type="date"
            size="small"
            :model-value="cert.fechaVencimiento"
            @update:model-value="(v: string) => patchRow(i, { fechaVencimiento: v })"
          />
        </div>
      </div>

      
      <div class="flex flex-col gap-1">
        <label class="text-xs font-medium">Archivo adjunto</label>
        <div v-if="cert.archivoUrl" class="flex items-center gap-2 px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-ground)]">
          <i class="pi pi-file text-violet-500" />
          <span class="flex-1 text-xs truncate">{{ filenameFromKey(cert.archivoUrl) }}</span>
          <Button
            type="button"
            icon="pi pi-download"
            size="small"
            severity="info"
            text
            rounded
            v-tooltip.top="'Descargar certificado'"
            :aria-label="`Descargar certificado ${i + 1}`"
            :data-testid="`cert-descargar-${i}`"
            @click="downloadArchivo(cert.archivoUrl!)"
          />
          <Button
            type="button"
            icon="pi pi-times"
            size="small"
            severity="secondary"
            text
            rounded
            aria-label="Quitar archivo"
            @click="removeArchivo(i)"
          />
        </div>
        <div v-else class="flex items-center gap-2">
          <label
            :for="`cert-archivo-${i}`"
            class="flex items-center gap-2 px-3 py-1.5 text-xs border border-[var(--surface-border)] rounded-md bg-[var(--surface-card)] cursor-pointer hover:bg-[var(--surface-hover)] hover:border-violet-300 transition-colors"
          >
            <i class="pi pi-upload text-violet-500" />
            <span>Seleccionar archivo…</span>
            <input
              :id="`cert-archivo-${i}`"
              type="file"
              class="hidden"
              :disabled="uploadingRow === i"
              @change="(e: any) => onArchivoChange(i, e)"
            />
          </label>
          <i v-if="uploadingRow === i" class="pi pi-spin pi-spinner text-violet-500 text-sm" />
        </div>
      </div>
    </div>
  </div>
</template>
