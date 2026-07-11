<script setup lang="ts">
import CertificateUpdateForm from '~/components/certificate/CertificateUpdateForm.vue'
import type { CertificateUpdateFormValue } from '~/components/certificate/CertificateUpdateForm.vue'

definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

// ─── Composables ──────────────────────────────────────────────────────────────
const { apiFetch } = useApi()
const toast = useToast()

// ─── Form state ───────────────────────────────────────────────────────────────
// Top block: only the 4 metadata fields (A1–A3). Periodo / fechas / archivos
// were removed on 2026-07-09 per `context/user-feedback/qa-session-jul-9.md` §1.1–1.3.
const form = reactive({
  nombre: '',
  tipoCertificado: '',
  descripcion: '',
  periodicidad: 'UNICA' as 'UNICA' | 'MENSUAL' | 'ANUAL',
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

// ─── Select options ───────────────────────────────────────────────────────────
const tipoOptions = [
  {
    label: 'Alcaldía',
    value: 'ALCALDIA',
    description: 'Uso de suelos; certificados específicos por empresa',
  },
  { label: 'Gobernación', value: 'GOBERNACION', description: '(pendiente)' },
  {
    label: 'Secretarías',
    value: 'SECRETARIAS',
    description: 'Secretaría de salud, desinfección tanques agua potable',
  },
  { label: 'Tributarios', value: 'TRIBUTARIOS', description: 'RUT' },
  {
    label: 'Registro Mercantil',
    value: 'REGISTRO_MERCANTIL',
    description: 'Cámara de comercio, bomberos, SAYCO y Acinpro',
  },
  { label: 'Otro', value: 'OTRO', description: '—' },
]


const periodicidadOptions = [
  { label: 'Única', value: 'UNICA' },
  { label: 'Mensual', value: 'MENSUAL' },
  { label: 'Anual', value: 'ANUAL' },
]

// ─── First update state (D2: optional initial CertificadoUpdate) ──────────────
// Owned by the shared <CertificateUpdateForm> component; this parent only holds
// the v-model mirror so the submit handler can read what was uploaded. File
// upload + IDB stash + sessionStorage draft live entirely inside the child.
const firstUpdate = reactive<CertificateUpdateFormValue>({
  notas: '',
  fechaEmision: '',
  fechaVencimiento: '',
  archivoUrl: null,
  comprobantePagoUrl: null,
})
const firstUpdateFormRef = ref<InstanceType<typeof CertificateUpdateForm> | null>(null)

function hasFirstUpdateContent(): boolean {
  return Boolean(
    firstUpdate.archivoUrl ||
      firstUpdate.comprobantePagoUrl ||
      firstUpdate.notas.trim() ||
      firstUpdate.fechaEmision ||
      firstUpdate.fechaVencimiento,
  )
}

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k])

  if (!form.nombre.trim()) errors.nombre = 'El nombre es requerido'
  if (!form.tipoCertificado) errors.tipoCertificado = 'El tipo es requerido'

  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    // Build payload — only the 4 metadata fields. Removed per A1–A3:
    //   fechaEmision, fechaVencimiento, archivoUrl, comprobantePagoUrl, periodo.
    // The first-update (optional) is sent as a separate POST below. A4 (jul-9):
    // comprobantePagoUrl joined the existing archivoUrl/notas/fechas set.
    const payload: Record<string, unknown> = {
      nombre: form.nombre.trim(),
      tipoCertificado: form.tipoCertificado,
      periodicidad: form.periodicidad,
    }
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()

    const created = await apiFetch<{ success: boolean; data: { id: number } }>('/certificates', {
      method: 'POST',
      body: payload,
    })

    const newId = created.data.id
    let firstUpdatePosted = false

    // D2: optional first update. Only post if at least one field is set.
    if (hasFirstUpdateContent()) {
      const updatePayload: Record<string, unknown> = {}
      if (firstUpdate.archivoUrl) updatePayload.archivoUrl = firstUpdate.archivoUrl
      if (firstUpdate.comprobantePagoUrl) {
        updatePayload.comprobantePagoUrl = firstUpdate.comprobantePagoUrl
      }
      if (firstUpdate.notas.trim()) updatePayload.notas = firstUpdate.notas.trim()
      if (firstUpdate.fechaEmision) updatePayload.fechaEmision = firstUpdate.fechaEmision
      if (firstUpdate.fechaVencimiento) updatePayload.fechaVencimiento = firstUpdate.fechaVencimiento

      try {
        await apiFetch(`/certificates/${newId}/updates`, {
          method: 'POST',
          body: updatePayload,
        })
        firstUpdatePosted = true
      } catch (updErr: any) {
        saving.value = false
        toast.add({
          severity: 'error',
          summary: 'Certificado creado, pero falló la primera actualización',
          detail: updErr?.data?.message || updErr?.message || 'Puedes agregarla luego desde el detalle del certificado.',
          life: 5000,
        })
        await navigateTo(`/certificados/${newId}`)
        return
      }
    }

    if (firstUpdatePosted) {
      toast.add({
        severity: 'success',
        summary: 'Certificado creado',
        detail: 'El certificado y la primera actualización fueron registrados.',
        life: 3500,
      })
    } else {
      toast.add({
        severity: 'success',
        summary: 'Certificado creado',
        detail: 'El certificado fue registrado exitosamente.',
        life: 3000,
      })
    }

    // W7: clear drafts on successful submit (child owns its own IDB + sessionStorage)
    clearCertCrearDraft()
    firstUpdateFormRef.value?.clearDraft()

    await navigateTo(`/certificados/${newId}`)
  } catch (e: any) {
    const detail =
      e?.data?.message || e?.message || 'Ocurrió un error al crear el certificado.'
    toast.add({ severity: 'error', summary: 'Error al crear', detail, life: 5000 })
  } finally {
    saving.value = false
  }
}

// ─── W7: sessionStorage metadata draft persistence (top-block fields only) ───
// The shared CertificateUpdateForm owns the first-update draft. This top-level
// draft persists name/tipo/descripcion/periodicidad under `cert-crear:top`.
const TOP_DRAFT_KEY = 'cert-crear:top'

function readTopDraft(): {
  nombre?: string
  tipoCertificado?: string
  descripcion?: string
  periodicidad?: 'UNICA' | 'MENSUAL' | 'ANUAL'
  ts?: number
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(TOP_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeTopDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      TOP_DRAFT_KEY,
      JSON.stringify({
        nombre: form.nombre,
        tipoCertificado: form.tipoCertificado,
        descripcion: form.descripcion,
        periodicidad: form.periodicidad,
        ts: Date.now(),
      })
    )
  } catch { /* sessionStorage may be disabled — silently ignore. */ }
}

function clearCertCrearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(TOP_DRAFT_KEY) } catch { /* noop */ }
}

async function restoreTopDraft() {
  if (!import.meta.client) return
  const draft = readTopDraft()
  if (!draft) return
  form.nombre = draft.nombre ?? ''
  form.tipoCertificado = draft.tipoCertificado ?? ''
  form.descripcion = draft.descripcion ?? ''
  form.periodicidad = (draft.periodicidad as any) ?? 'UNICA'
  if (draft.nombre || draft.descripcion) {
    toast.add({
      severity: 'info',
      summary: 'Borrador restaurado',
      detail: 'Se recuperaron los datos del certificado de tu sesión anterior.',
      life: 4000,
    })
  }
}

watch(
  () => [form.nombre, form.tipoCertificado, form.descripcion, form.periodicidad],
  () => writeTopDraft()
)

onMounted(async () => {
  await restoreTopDraft()
})
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Certificado" subtitle="Registrar un nuevo certificado de empresa">
      <template #actions>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="navigateTo('/certificados')"
        />
      </template>
    </AppPageHeader>

    <Toast />

    <div class="max-w-2xl">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
              <i class="pi pi-file-pdf text-violet-500" /> Información del Certificado
            </h3>
          </div>
        </template>
        <template #content>
          <form class="space-y-5" @submit.prevent="onSubmit">

            <!-- Tipo -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Tipo de Certificado <span class="text-red-500">*</span>
              </label>
              <Select
                v-model="form.tipoCertificado"
                :options="tipoOptions"
                option-label="label"
                option-value="value"
                placeholder="Seleccionar tipo"
                class="w-full"
                :invalid="!!errors.tipoCertificado"
              >
                <template #option="{ option }">
                  <div class="flex flex-col">
                    <span class="font-medium">{{ option.label }}</span>
                    <span v-if="option.description" class="text-xs text-[var(--text-color-secondary)]">
                      {{ option.description }}
                    </span>
                  </div>
                </template>
              </Select>
              <p v-if="errors.tipoCertificado" class="mt-1 text-xs text-red-500">
                {{ errors.tipoCertificado }}
              </p>
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Nombre <span class="text-red-500">*</span>
              </label>
              <InputText
                :model-value="form.nombre"
                @update:model-value="(v) => form.nombre = (v ?? '').toUpperCase()"
                placeholder="Ej: RUT 2024"
                class="w-full"
                :invalid="!!errors.nombre"
              />
              <p v-if="errors.nombre" class="mt-1 text-xs text-red-500">{{ errors.nombre }}</p>
            </div>

            <!-- Fechas removed per A1–A3 (2026-07-09): the dates belong to the
                 "Primera actualización" section below. This block intentionally
                 keeps no date inputs. -->

            <!-- Descripción -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Descripción <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <Textarea
                v-model="form.descripcion"
                rows="3"
                placeholder="Descripción adicional del certificado..."
                class="w-full"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Periodicidad
                </label>
                <Select
                  v-model="form.periodicidad"
                  :options="periodicidadOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar periodicidad"
                  class="w-full"
                />
              </div>
              <!-- Periodo removed per A1–A3 (2026-07-09) — periodicidad dropdown
                   + dates from the first-update section carry the same
                   information. -->
            </div>

            <!-- Archivo + Comprobante removed from the top block per A1–A3
                 (2026-07-09). They live exclusively in the "Primera
                 actualización" section below (and in the CertificadoUpdate
                 form for subsequent updates, see §1.5). -->

            <Divider />

            <!-- D2: optional first update section (now uses shared form, A4+jul-9) -->
            <Card class="bg-[var(--surface-ground)]">
              <template #content>
                <div class="space-y-4">
                  <div>
                    <h4 class="text-sm font-semibold text-[var(--text-color)] flex items-center gap-2">
                      <i class="pi pi-history text-violet-500" /> Primera actualización <span class="text-xs font-normal text-[var(--text-color-secondary)]">(opcional)</span>
                    </h4>
                    <p class="text-xs text-[var(--text-color-secondary)] mt-1">
                      Si lo requieres, registra aquí la primera actualización del historial
                      (archivo, comprobante de pago, notas o fechas). Debe proporcionarse
                      al menos uno de los campos.
                    </p>
                  </div>

                  <CertificateUpdateForm
                    ref="firstUpdateFormRef"
                    v-model="firstUpdate"
                    stash-key-prefix="cert-crear"
                    test-id-prefix="cert-first-update"
                  />
                </div>
              </template>
            </Card>

            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <Button
                type="button"
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                @click="navigateTo('/certificados')"
              />
              <Button
                type="submit"
                label="Crear Certificado"
                icon="pi pi-check"
                :loading="saving"
              />
            </div>

          </form>
        </template>
      </Card>
    </div>
  </div>
</template>
