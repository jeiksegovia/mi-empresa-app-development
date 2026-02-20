<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
  layout: 'default',
})

const { apiFetch } = useApi()
const toast = useToast()

// ─── Form state ──────────────────────────────────────────────────────────────
const form = reactive({
  nombreInstrumento: '',
  codigo: '',
  descripcion: '',
  tipo: '',
  periodicidad: '',
  rolesPermitidos: '',
  versionPlantilla: '',
})

const errors = reactive<Record<string, string>>({})
const saving = ref(false)

// ─── Select options ───────────────────────────────────────────────────────────
const tipoOptions = [
  { label: 'Valoración', value: 'VALORACION' },
  { label: 'Nutrición', value: 'NUTRICION' },
  { label: 'Matrícula', value: 'MATRICULA' },
  { label: 'Admisión', value: 'ADMISION' },
]

const periodicidadOptions = [
  { label: 'Única', value: 'UNICA' },
  { label: 'Anual', value: 'ANUAL' },
  { label: 'Mensual', value: 'MENSUAL' },
  { label: 'Trimestral', value: 'TRIMESTRAL' },
  { label: 'Semestral', value: 'SEMESTRAL' },
]

// ─── Validation ───────────────────────────────────────────────────────────────
function validate(): boolean {
  Object.keys(errors).forEach((k) => delete errors[k])

  if (!form.nombreInstrumento.trim())
    errors.nombreInstrumento = 'El nombre del instrumento es requerido'
  if (!form.tipo)
    errors.tipo = 'El tipo es requerido'
  if (!form.periodicidad)
    errors.periodicidad = 'La periodicidad es requerida'
  if (!form.rolesPermitidos.trim())
    errors.rolesPermitidos = 'Los roles permitidos son requeridos'
  if (!form.versionPlantilla.trim())
    errors.versionPlantilla = 'La versión de la plantilla es requerida'

  return Object.keys(errors).length === 0
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function onSubmit() {
  if (!validate()) return

  saving.value = true
  try {
    const payload: Record<string, string> = {
      nombreInstrumento: form.nombreInstrumento.trim(),
      tipo: form.tipo,
      periodicidad: form.periodicidad,
      rolesPermitidos: form.rolesPermitidos.trim(),
      versionPlantilla: form.versionPlantilla.trim(),
    }
    if (form.codigo.trim()) payload.codigo = form.codigo.trim()
    if (form.descripcion.trim()) payload.descripcion = form.descripcion.trim()

    const res = await apiFetch<{ success: boolean; data: { id: number } }>('/instruments', {
      method: 'POST',
      body: payload,
    })

    toast.add({
      severity: 'success',
      summary: 'Instrumento creado',
      detail: 'El instrumento fue creado exitosamente.',
      life: 3500,
    })

    await navigateTo(`/instrumentos/${res.data.id}`)
  } catch (e: any) {
    const detail =
      e?.data?.message || e?.message || 'Ocurrió un error al crear el instrumento.'
    toast.add({
      severity: 'error',
      summary: 'Error al crear',
      detail,
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AppPageHeader title="Nuevo Instrumento" subtitle="Registrar un nuevo instrumento de evaluación">
      <template #actions>
        <Button
          label="Cancelar"
          icon="pi pi-times"
          severity="secondary"
          outlined
          @click="navigateTo('/instrumentos')"
        />
      </template>
    </AppPageHeader>

    <Toast />

    <div class="max-w-2xl">
      <Card>
        <template #header>
          <div class="px-6 pt-5 pb-0">
            <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
              <i class="pi pi-clipboard text-violet-500" /> Información del Instrumento
            </h3>
          </div>
        </template>
        <template #content>
          <form class="space-y-5" @submit.prevent="onSubmit">

            <!-- Nombre del Instrumento -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Nombre del Instrumento <span class="text-red-500">*</span>
              </label>
              <InputText
                v-model="form.nombreInstrumento"
                placeholder="Ej: Ficha de Valoración Inicial"
                class="w-full"
                :invalid="!!errors.nombreInstrumento"
              />
              <p v-if="errors.nombreInstrumento" class="mt-1 text-xs text-red-500">
                {{ errors.nombreInstrumento }}
              </p>
            </div>

            <!-- Código -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Código <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <InputText
                v-model="form.codigo"
                placeholder="Ej: FICHA-VAL-001"
                class="w-full font-mono"
              />
            </div>

            <!-- Tipo y Periodicidad (side by side) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Tipo <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model="form.tipo"
                  :options="tipoOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar tipo"
                  class="w-full"
                  :invalid="!!errors.tipo"
                />
                <p v-if="errors.tipo" class="mt-1 text-xs text-red-500">
                  {{ errors.tipo }}
                </p>
              </div>

              <div>
                <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                  Periodicidad <span class="text-red-500">*</span>
                </label>
                <Select
                  v-model="form.periodicidad"
                  :options="periodicidadOptions"
                  option-label="label"
                  option-value="value"
                  placeholder="Seleccionar periodicidad"
                  class="w-full"
                  :invalid="!!errors.periodicidad"
                />
                <p v-if="errors.periodicidad" class="mt-1 text-xs text-red-500">
                  {{ errors.periodicidad }}
                </p>
              </div>
            </div>

            <!-- Roles Permitidos -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Roles Permitidos <span class="text-red-500">*</span>
              </label>
              <InputText
                v-model="form.rolesPermitidos"
                placeholder="Ej: ADMIN,EMPLEADO"
                class="w-full"
                :invalid="!!errors.rolesPermitidos"
              />
              <p v-if="errors.rolesPermitidos" class="mt-1 text-xs text-red-500">
                {{ errors.rolesPermitidos }}
              </p>
              <p class="mt-1 text-xs text-[var(--text-color-secondary)]">
                Ingrese los roles separados por coma (sin espacios).
              </p>
            </div>

            <!-- Versión Plantilla -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Versión Plantilla <span class="text-red-500">*</span>
              </label>
              <InputText
                v-model="form.versionPlantilla"
                placeholder="Ej: v1.0"
                class="w-full font-mono"
                :invalid="!!errors.versionPlantilla"
              />
              <p v-if="errors.versionPlantilla" class="mt-1 text-xs text-red-500">
                {{ errors.versionPlantilla }}
              </p>
            </div>

            <!-- Descripción -->
            <div>
              <label class="block text-sm font-medium text-[var(--text-color)] mb-1">
                Descripción <span class="text-xs text-[var(--text-color-secondary)]">(opcional)</span>
              </label>
              <textarea
                v-model="form.descripcion"
                rows="3"
                placeholder="Descripción general del instrumento..."
                class="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-ground)] text-[var(--text-color)] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-[var(--text-color-secondary)]"
              />
            </div>

            <Divider />

            <!-- Actions -->
            <div class="flex justify-end gap-3">
              <Button
                type="button"
                label="Cancelar"
                icon="pi pi-times"
                severity="secondary"
                outlined
                @click="navigateTo('/instrumentos')"
              />
              <Button
                type="submit"
                label="Crear Instrumento"
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
