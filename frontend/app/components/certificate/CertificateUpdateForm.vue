<script setup lang="ts">
/**
 * CertificateUpdateForm — shared sub-form for `CertificadoUpdate` records.
 *
 * Used in TWO places (jul-9):
 *   1. `frontend/app/pages/certificados/crear.vue` — "Primera actualización"
 *      inside the create form (the first update is sent together with the new
 *      certificate).
 *   2. `frontend/app/pages/certificados/[id].vue` — body of the
 *      "Agregar actualización" dialog (subsequent updates).
 *
 * Rendering is byte-equivalent so the existing jul-8 specs that target
 * `data-testid="cert-first-update-dropzone"` / `"cert-update-file-dropzone"`
 * etc. keep finding their markup.
 *
 * v-model shape:
 *   { notas, fechaEmision, fechaVencimiento, archivoUrl, comprobantePagoUrl }
 * — parent passes a reactive object; the component patches it via emit.
 *
 * File-stash scoping (jul-9 W9 lesson — row-scoped keys prevent
 * "wrong file leaked into wrong row" on rapid dialog open/close):
 *   - IDB file blobs: `<prefix>:file`, `<prefix>:comprobante`
 *   - SessionStorage JSON metadata draft: `<prefix>:draft`
 *   Caller passes the prefix:
 *     - crear.vue passes `stash-key-prefix="cert-crear"`
 *     - [id].vue passes  `:stash-key-prefix="`cert-agregar:${certId}`"`
 *
 * Files are uploaded eagerly (as soon as the user picks one), matching the
 * existing pattern. The parent only needs to read the resulting
 * `archivoUrl` / `comprobantePagoUrl` from v-model when submitting.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useFileStash, useFileStashTitleGuard } from '~/composables/useFileStash'

export interface CertificateUpdateFormValue {
  notas: string
  fechaEmision: string
  fechaVencimiento: string
  archivoUrl: string | null
  comprobantePagoUrl: string | null
}

const props = defineProps<{
  modelValue: CertificateUpdateFormValue
  /** Prefix for the per-row IDB keys and sessionStorage draft. See file header. */
  stashKeyPrefix: string
  /** Optional data-testid prefix; defaults to `stashKeyPrefix`. */
  testIdPrefix?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CertificateUpdateFormValue]
}>()

const { uploadFile } = useFileUpload()
const { stash: stashFile, restore: restoreFile, clear: clearStashedFile } = useFileStash()

const archivoFileGuard = useFileStashTitleGuard('Adjuntar archivo de la actualización')
const comprobanteFileGuard = useFileStashTitleGuard('Adjuntar comprobante de pago')

// Derive keys exactly once per prefix so onMounted / handlers stay stable.
const archivoStashKey = computed(() => `${props.stashKeyPrefix}:file`)
const comprobanteStashKey = computed(() => `${props.stashKeyPrefix}:comprobante`)
const draftKey = computed(() => `${props.stashKeyPrefix}:draft`)
const tid = computed(() => props.testIdPrefix ?? props.stashKeyPrefix)

// ─── Internal state ───────────────────────────────────────────────────────────
const archivoFile = ref<File | null>(null)
const archivoFileInputRef = ref<HTMLInputElement | null>(null)
const archivoUploading = ref(false)
const archivoProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

const comprobanteFile = ref<File | null>(null)
const comprobanteFileInputRef = ref<HTMLInputElement | null>(null)
const comprobanteUploading = ref(false)
const comprobanteProgress = ref<'idle' | 'uploading' | 'done' | 'error'>('idle')

// Child-owned draft. Nested v-model on a computed-of-props never updates the
// parent (staging SPA skipped POST /updates even when the textarea showed text).
const draft = reactive<CertificateUpdateFormValue>({
  notas: props.modelValue.notas,
  fechaEmision: props.modelValue.fechaEmision,
  fechaVencimiento: props.modelValue.fechaVencimiento,
  archivoUrl: props.modelValue.archivoUrl,
  comprobantePagoUrl: props.modelValue.comprobantePagoUrl,
})

function patchModel(patch: Partial<CertificateUpdateFormValue>) {
  Object.assign(draft, patch)
  emit('update:modelValue', { ...draft })
}

function hasContent(): boolean {
  return Boolean(
    draft.archivoUrl ||
      draft.comprobantePagoUrl ||
      draft.notas.trim() ||
      draft.fechaEmision ||
      draft.fechaVencimiento,
  )
}

function hasFileContent(): boolean {
  return hasContent()
}

// ─── File selection ───────────────────────────────────────────────────────────
async function onArchivoChange(event: Event) {
  archivoFileGuard.disarm()
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return
  archivoFile.value = input.files[0]
  patchModel({ archivoUrl: null })
  archivoProgress.value = 'uploading'
  archivoUploading.value = true
  try {
    await stashFile(archivoStashKey.value, archivoFile.value)
    const key = await uploadFile(archivoFile.value, 'certificados')
    if (key) {
      patchModel({ archivoUrl: key })
      archivoProgress.value = 'done'
    } else {
      archivoProgress.value = 'error'
    }
  } catch {
    archivoProgress.value = 'error'
  } finally {
    archivoUploading.value = false
  }
}

function clearArchivo() {
  archivoFile.value = null
  patchModel({ archivoUrl: null })
  archivoProgress.value = 'idle'
  if (archivoFileInputRef.value) archivoFileInputRef.value.value = ''
  clearStashedFile(archivoStashKey.value).catch(() => { /* noop */ })
}

async function onComprobanteChange(event: Event) {
  comprobanteFileGuard.disarm()
  const input = event.target as HTMLInputElement
  if (!input.files?.[0]) return
  comprobanteFile.value = input.files[0]
  patchModel({ comprobantePagoUrl: null })
  comprobanteProgress.value = 'uploading'
  comprobanteUploading.value = true
  try {
    await stashFile(comprobanteStashKey.value, comprobanteFile.value)
    const key = await uploadFile(comprobanteFile.value, 'certificados')
    if (key) {
      patchModel({ comprobantePagoUrl: key })
      comprobanteProgress.value = 'done'
    } else {
      comprobanteProgress.value = 'error'
    }
  } catch {
    comprobanteProgress.value = 'error'
  } finally {
    comprobanteUploading.value = false
  }
}

function clearComprobante() {
  comprobanteFile.value = null
  patchModel({ comprobantePagoUrl: null })
  comprobanteProgress.value = 'idle'
  if (comprobanteFileInputRef.value) comprobanteFileInputRef.value.value = ''
  clearStashedFile(comprobanteStashKey.value).catch(() => { /* noop */ })
}

// ─── SessionStorage draft (metadata only; file bodies live in IDB) ──────────
function readDraft(): {
  notas?: string
  fechaEmision?: string
  fechaVencimiento?: string
} | null {
  if (!import.meta.client) return null
  try {
    const raw = sessionStorage.getItem(draftKey.value)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeDraft() {
  if (!import.meta.client) return
  try {
    sessionStorage.setItem(
      draftKey.value,
      JSON.stringify({
        notas: draft.notas,
        fechaEmision: draft.fechaEmision,
        fechaVencimiento: draft.fechaVencimiento,
        ts: Date.now(),
      })
    )
  } catch { /* sessionStorage may be disabled — silently ignore. */ }
}

function clearDraft() {
  if (!import.meta.client) return
  try { sessionStorage.removeItem(draftKey.value) } catch { /* noop */ }
}

/**
 * QA jul-11 B4a: full reset — files, model, IDB stash AND sessionStorage
 * draft. clearDraft() alone left the IDB blobs behind, so the next mount
 * restored a stale file chip with a null archivoUrl (silent no-op on submit).
 * Parents MUST call this on successful submit and on cancel/dismiss.
 */
function reset() {
  clearArchivo()
  clearComprobante()
  patchModel({ notas: '', fechaEmision: '', fechaVencimiento: '' })
  clearDraft()
}

function getValue(): CertificateUpdateFormValue {
  return { ...draft }
}

defineExpose({
  clearDraft,
  reset,
  hasContent,
  hasFileContent,
  getValue,
  // Expose the reactive draft too — production minify can drop getValue.
  draft,
})

watch(
  () => [draft.notas, draft.fechaEmision, draft.fechaVencimiento],
  () => writeDraft(),
)

onMounted(async () => {
  const saved = readDraft()
  if (saved) {
    patchModel({
      notas: saved.notas ?? draft.notas,
      fechaEmision: saved.fechaEmision ?? draft.fechaEmision,
      fechaVencimiento: saved.fechaVencimiento ?? draft.fechaVencimiento,
    })
  }

  // QA jul-11 B4a: a restored stash entry may predate its upload (Android
  // tab discarded mid-flow) — archivoUrl is NOT part of the draft, so it is
  // null here. Previously we showed the chip anyway, and the user submitted
  // believing the file was attached while nothing was sent. Now: if there is
  // no uploaded key for a restored file, RE-UPLOAD it so the visible chip
  // always corresponds to a persisted S3 key.
  const restoredArchivo = await restoreFile(archivoStashKey.value)
  if (restoredArchivo) {
    archivoFile.value = restoredArchivo
    if (draft.archivoUrl) {
      archivoProgress.value = 'done'
    } else {
      archivoProgress.value = 'uploading'
      archivoUploading.value = true
      const key = await uploadFile(restoredArchivo, 'certificados')
      archivoUploading.value = false
      if (key) {
        patchModel({ archivoUrl: key })
        archivoProgress.value = 'done'
      } else {
        archivoProgress.value = 'error'
      }
    }
  }
  const restoredComp = await restoreFile(comprobanteStashKey.value)
  if (restoredComp) {
    comprobanteFile.value = restoredComp
    if (draft.comprobantePagoUrl) {
      comprobanteProgress.value = 'done'
    } else {
      comprobanteProgress.value = 'uploading'
      comprobanteUploading.value = true
      const key = await uploadFile(restoredComp, 'certificados')
      comprobanteUploading.value = false
      if (key) {
        patchModel({ comprobantePagoUrl: key })
        comprobanteProgress.value = 'done'
      } else {
        comprobanteProgress.value = 'error'
      }
    }
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Archivo dropzone -->
    <div>
      <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
        Archivo <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
      </label>
      <div
        v-if="!archivoFile"
        class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
        @click="() => { archivoFileGuard.arm(); archivoFileInputRef?.click() }"
        :data-testid="`${tid}-file-dropzone`"
      >
        <i class="pi pi-upload text-2xl text-[var(--text-color-secondary)] mb-1 block" />
        <p class="text-xs text-[var(--text-color-secondary)]">Haz clic para seleccionar un archivo</p>
      </div>
      <div
        v-else
        class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)]"
      >
        <i class="pi pi-file text-violet-500 text-lg flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-[var(--text-color)] truncate">{{ archivoFile.name }}</p>
          <p class="text-xs text-[var(--text-color-secondary)]">{{ (archivoFile.size / 1024).toFixed(1) }} KB</p>
        </div>
        <div v-if="archivoProgress === 'uploading'" class="flex-shrink-0">
          <i class="pi pi-spin pi-spinner text-violet-500" />
        </div>
        <div v-else-if="archivoProgress === 'done'" class="flex-shrink-0">
          <i class="pi pi-check-circle text-green-500" />
        </div>
        <div v-else-if="archivoProgress === 'error'" class="flex-shrink-0">
          <i class="pi pi-times-circle text-red-500" />
        </div>
        <Button
          v-if="archivoProgress !== 'uploading'"
          icon="pi pi-times"
          size="small"
          severity="secondary"
          text
          rounded
          @click="clearArchivo"
        />
      </div>
      <input
        ref="archivoFileInputRef"
        type="file"
        class="hidden"
        accept="*/*"
        @change="onArchivoChange"
      />
    </div>

    <!-- Comprobante de pago dropzone -->
    <div>
      <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
        Comprobante de pago <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
      </label>
      <div
        v-if="!comprobanteFile"
        class="border-2 border-dashed border-[var(--surface-border)] rounded-lg p-4 text-center cursor-pointer hover:border-violet-400 transition-colors"
        @click="() => { comprobanteFileGuard.arm(); comprobanteFileInputRef?.click() }"
        :data-testid="`${tid}-comprobante-dropzone`"
      >
        <i class="pi pi-receipt text-2xl text-[var(--text-color-secondary)] mb-1 block" />
        <p class="text-xs text-[var(--text-color-secondary)]">
          Comprobante de pago (caja, Sena, aportes sociales)
        </p>
      </div>
      <div
        v-else
        class="flex items-center gap-3 px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)]"
      >
        <i class="pi pi-file text-violet-500 text-lg flex-shrink-0" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium text-[var(--text-color)] truncate">{{ comprobanteFile.name }}</p>
          <p class="text-xs text-[var(--text-color-secondary)]">{{ (comprobanteFile.size / 1024).toFixed(1) }} KB</p>
        </div>
        <div v-if="comprobanteProgress === 'uploading'" class="flex-shrink-0">
          <i class="pi pi-spin pi-spinner text-violet-500" />
        </div>
        <div v-else-if="comprobanteProgress === 'done'" class="flex-shrink-0">
          <i class="pi pi-check-circle text-green-500" />
        </div>
        <div v-else-if="comprobanteProgress === 'error'" class="flex-shrink-0">
          <i class="pi pi-times-circle text-red-500" />
        </div>
        <Button
          v-if="comprobanteProgress !== 'uploading'"
          icon="pi pi-times"
          size="small"
          severity="secondary"
          text
          rounded
          @click="clearComprobante"
        />
      </div>
      <input
        ref="comprobanteFileInputRef"
        type="file"
        class="hidden"
        accept="*/*"
        @change="onComprobanteChange"
      />
    </div>

    <!-- Notas -->
    <div>
      <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
        Notas <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
      </label>
      <Textarea
        v-model="draft.notas"
        rows="2"
        placeholder="Notas de esta actualización..."
        class="w-full"
        data-testid="cert-update-notas"
        @update:model-value="(v) => patchModel({ notas: String(v ?? '') })"
      />
    </div>

    <!-- Fechas -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div>
        <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
          Fecha Emisión <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
        </label>
        <input
          type="date"
          v-model="draft.fechaEmision"
          class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
          Fecha Vencimiento <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
        </label>
        <input
          type="date"
          v-model="draft.fechaVencimiento"
          class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg bg-[var(--surface-card)] text-[var(--text-color)] text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>
    </div>
  </div>
</template>
