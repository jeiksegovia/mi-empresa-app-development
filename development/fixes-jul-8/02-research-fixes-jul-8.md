# W1-Research: Fixes Jul 8 — Research Findings

**Project root:** `/Users/jeik/ws/mi-empresa-app-development`
**Read-only research.** Output for W2 (backend) and W3 (frontend) implementation workers.

---

## Domain A — SPA Reload Root Cause (PRIORITY)

### Finding: **No forced reloads exist in the app code**

Exhaustive search across entire `frontend/` (app, plugins, middleware, layouts, stores, nuxt.config.ts) for `location.reload`, `location.href =`, `router.go(0)`, `visibilitychange`, `document.hidden`, `useDocumentVisibility`, `window.location`, `document.addEventListener`:
- **`location.reload`** — **0 hits**
- **`location.href =`** — **0 hits**
- **`router.go(0)`** — **0 hits**
- **`visibilitychange` / `document.hidden` / `useDocumentVisibility`** — **0 hits**
- **`window.location`** — **0 hits in app code**
- **`window.open`** — 1 hit: `app/composables/useFileUpload.ts:34` (opens S3 download URL in new tab — correct)

### 401 handling — only forced navigation

`app/composables/useApi.ts` (full file):
```ts
export const useApi = () => {
  const config = useRuntimeConfig()
  const baseURL = config.public.apiBase
  const apiFetch = $fetch.create({
    baseURL,
    credentials: 'include',
    onResponseError({ response }) {
      if (response.status === 401) {
        const authStore = useAuthStore()
        authStore.user = null
        authStore.isAuthenticated = false
        navigateTo('/login')
      }
    },
  })
  return { apiFetch, baseURL }
}
```

`navigateTo('/login')` is Nuxt SPA-internal navigation (no reload), but its semantics here cause perceived reloads:
- On **any** 401 (token expiry, race condition), user is bounced to login mid-task.
- `authStore.fetchEmpresa()` uses **plain `$fetch`** (no interceptor) precisely "to avoid redirect loops" — comment in `app/stores/auth.ts:67`.
- **No retry / token refresh**.

### Auth middleware (`app/middleware/auth.ts`)
```ts
export default defineNuxtRouteMiddleware(async (to) => {
  const authStore = useAuthStore()
  if (to.path === '/login') {
    if (authStore.isAuthenticated) return navigateTo('/')
    return
  }
  if (authStore.isAuthenticated) return
  const result = await authStore.fetchUser()
  if (result.success) return
  return navigateTo('/login')
})
```

### `nuxt.config.ts` highlights
```ts
export default defineNuxtConfig({
  ssr: false,                          // pure SPA
  modules: ['@pinia/nuxt', '@primevue/nuxt-module'],
  // NO @nuxtjs/auth, NO @nuxtjs/axios, NO PWA, NO service worker
})
```

### Indirect evidence (e2e test comments warn about reload)
- `frontend/tests/e2e/empresa.spec.ts:14` — "Navigate via SPA to avoid full-page reload auth issues"
- `frontend/tests/e2e/empleado-crear-completo.spec.ts:20` — same comment

### Recommendation for W3
1. **Do NOT search for a hard-reload trigger** — none exists.
2. Improve 401 UX: single retry then `navigateTo('/login')`; skip redirect when already on `/login`; show a toast explaining why.
3. Consider switching `navigateTo('/login')` → `await navigateTo('/login', { replace: true })`.

---

## Domain B — Certificados Empresa

### B.1 Prisma model (verbatim, `schema.prisma:673-699`)
```prisma
model CertificadoEmpresa {
  id                Int                        @id @default(autoincrement()) @map("cert_empresa_id")
  empresaId         Int                        @map("empresa_id")
  tipoCertificado   TipoCertificadoEmpresa     @map("tipo_certificado")
  nombre            String                     @db.VarChar(200)
  descripcion       String?                    @db.Text
  estado            EstadoCertificadoEmpresa   @default(PENDIENTE)
  fechaEmision      DateTime?                  @map("fecha_emision") @db.Date
  fechaVencimiento  DateTime?                  @map("fecha_vencimiento") @db.Date
  archivoUrl        String?                    @map("archivo_url") @db.VarChar(500)
  periodicidad      PeriodicidadCertificado     @default(UNICA)
  periodo           DateTime?                  @map("periodo") @db.Date
  comprobantePagoUrl String?                   @map("comprobante_pago_url") @db.VarChar(500)
  creadoPor         Int                        @map("creado_por")
  createdAt         DateTime                   @default(now()) @map("created_at")
  updatedAt         DateTime                   @updatedAt @map("updated_at")
  empresa          Empresa  @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  creador          Usuario  @relation("CertificadoEmpresaCreador", fields: [creadoPor], references: [id])
  @@index([empresaId]) @@index([estado]) @@index([fechaVencimiento]) @@index([periodicidad])
  @@map("certificados_empresa")
}
```

**No dedicated Update/Historial model** — audit trail is `createdAt`/`updatedAt` only. There is no `modificadoPor`.

Enums (`schema.prisma:864-890`):
```prisma
enum TipoCertificadoEmpresa { ALCALDIA GOBERNACION SECRETARIAS TRIBUTARIOS REGISTRO_MERCANTIL OTRO }
enum EstadoCertificadoEmpresa { VIGENTE VENCIDO PENDIENTE }
enum PeriodicidadCertificado { UNICA MENSUAL ANUAL }
```

### B.2 Backend service (`backend/src/services/certificateService.ts`)
- `listCertificates({ page, limit, tipo, estado })`, `getCertificate(id)`
- `getDefaultEmpresaId()` — derives empresaId server-side when client omits
- `duplicateCertificate(sourceId, userId, periodoOverride?)` — copies tipo/nombre/descripcion/periodicidad, forces estado=PENDIENTE
- `createCertificate(input, userId)` — accepts `duplicateFromId` short-circuit
- `updateCertificate(id, input)` — **already exists**, normalizes empty-string→null for dates
- `deleteCertificate(id)`, `getMissingMonthlyAlerts()`, `getCertificateStats()`
- `UpdateCertificateInput = Partial<Omit<CreateCertificateInput, 'duplicateFromId'>>`

### B.3 Backend route (`backend/src/routes/certificates.routes.ts`)

⚠️ **PUT endpoint already exists** (line ~140):
```ts
router.put('/:id', requireRole('ADMIN'), validate(updateCertificateSchema), async (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    if (isNaN(id)) { res.status(400).json({ success: false, message: 'Invalid certificate ID' }); return }
    const cert = await certificateService.updateCertificate(id, req.body)
    res.json({ success: true, data: cert })
  } catch (error: any) {
    if (error.message === 'Certificate not found') { res.status(404).json({ success: false, message: 'Certificate not found' }); return }
    res.status(500).json({ success: false, message: 'Error updating certificate' })
  }
})
```
`updateCertificateSchema = z.object(baseCertificateFields).partial()` — every field optional.

`baseCertificateFields` includes: `empresaId, tipoCertificado, nombre, descripcion, estado, fechaEmision, fechaVencimiento, archivoUrl, periodicidad, periodo, comprobantePagoUrl, duplicateFromId`. The service **ignores `duplicateFromId` on update** (only used by `createCertificate`).

### B.4 Frontend pages
| Path | Role |
|---|---|
| `certificados/index.vue` (526 lines) | List + stats + missing-month alert |
| `certificados/crear.vue` (508 lines) | Create form (admin) |
| `certificados/[id].vue` (521 lines) | Detail + inline edit mode |

- **"Nuevo Certificado" button exists**: `certificados/index.vue:252-257` (admin-only) → navigates to `/certificados/crear`.
- **Detail page exists with inline Edit mode** (`editMode`, `enterEditMode`, `saveEdit`).
- **No `/certificados/[id]/editar.vue`** — edit happens inline.

`saveEdit` (`certificados/[id].vue:166-197`) sends:
```ts
const payload = {
  nombre, tipoCertificado, estado: editForm.estado || undefined,
  ...(editForm.descripcion.trim() && { descripcion }),
  ...(editForm.fechaEmision && { fechaEmision }),
  ...(editForm.fechaVencimiento && { fechaVencimiento }),
}
```
→ **Missing**: `archivoUrl`, `comprobantePagoUrl`, `periodicidad`, `periodo`. `editForm` does not include them.

### B.5 Components & composables
- `app/components/certificate/` is **empty**. No `useCertificate.ts` composable. Upload uses generic `useFileUpload`.

### Recommendation for W2/W3
- **W2**: PUT + Zod already correctly `.partial()`. No backend rewrite needed unless you want to forbid `duplicateFromId` on update.
- **W3**: Add `archivoUrl` (PDF re-upload), `comprobantePagoUrl`, `periodicidad`, `periodo` to inline edit form on `certificados/[id].vue`. Use `useFileUpload().uploadFile(file, 'certificados')`.

---

## Domain C — Instrumentos

### C.1 Prisma model (verbatim, `schema.prisma:508-532`)
```prisma
model Instrumento {
  id                  Int                   @id @default(autoincrement()) @map("instrumento_id")
  nombreInstrumento   String                @map("nombre_instrumento") @db.VarChar(200)
  codigo              String?               @db.VarChar(50)
  descripcion         String?               @db.Text
  tipo                TipoInstrumento
  periodicidad        PeriodicidadInstrumento
  rolesPermitidos     String                @map("roles_permitidos") @db.VarChar(255)
  estado              EstadoInstrumento     @default(ACTIVO)
  plantillaArchivo    String?               @map("plantilla_archivo") @db.VarChar(500)
  fechaCreacion       DateTime              @default(now()) @map("fecha_creacion")
  creadoPor           Int                   @map("creado_por")
  fechaModificacion   DateTime?             @updatedAt @map("fecha_modificacion")
  modificadoPor       Int?                  @map("modificado_por")
  versionPlantilla    String                @map("version_plantilla") @db.VarChar(20)
  creador     Usuario  @relation("InstrumentoCreador", fields: [creadoPor], references: [id])
  modificador Usuario? @relation("InstrumentoModificador", fields: [modificadoPor], references: [id])
  registros   RegistroFichaCompletada[]
  @@index([estado]) @@index([tipo])
  @@map("instrumentos")
}
```

**`rolesPermitidos` is `String @db.VarChar(255)` — comma-separated string, NOT an enum, NOT a relation.** No `InstrumentoRol` enum exists.

### C.2 Backend service (`backend/src/services/instrumentService.ts`)
- `rolesPermitidos: string` on `CreateInstrumentInput` and `UpdateInstrumentInput`.
- **No validation** that comma-split values are real `RolUsuario` enum members.
- Service passes raw string to Prisma.
- `deleteInstrument` = soft delete (sets `estado = 'INACTIVO'`).

### C.3 Backend route Zod (`backend/src/routes/instruments.routes.ts:18-26`)
```ts
const createInstrumentSchema = z.object({
  nombreInstrumento: z.string().min(1).max(200),
  codigo: z.string().max(50).optional(),
  descripcion: z.string().optional(),
  tipo: z.enum(['VALORACION', 'NUTRICION', 'MATRICULA', 'ADMISION']),
  periodicidad: z.enum(['UNICA', 'ANUAL', 'MENSUAL', 'TRIMESTRAL', 'SEMESTRAL']),
  rolesPermitidos: z.string().min(1),
  plantillaArchivo: z.string().optional(),
  versionPlantilla: z.string().min(1).max(20),
  estado: z.enum(['ACTIVO', 'INACTIVO']).optional(),
})
const updateInstrumentSchema = createInstrumentSchema.partial()
```

### C.4 Frontend pages
| Path | Role |
|---|---|
| `instrumentos/index.vue` | List |
| `instrumentos/crear.vue` | Create form |
| `instrumentos/[id]/index.vue` | Detail page — **read-only, no edit mode** |

**No `/instrumentos/[id]/editar.vue`** route exists.

### C.5 Roles input widget — `instrumentos/crear.vue:198-214`
```vue
<label>Roles Permitidos <span class="text-red-500">*</span></label>
<InputText v-model="form.rolesPermitidos" placeholder="Ej: ADMIN,EMPLEADO" class="w-full" />
<p class="mt-1 text-xs text-[var(--text-color-secondary)]">
  Ingrese los roles separados por coma (sin espacios).
</p>
```
→ Plain `<InputText>` collecting comma-separated string. No MultiSelect.

Display side (`instrumentos/[id]/index.vue:281-287`):
```vue
<span v-for="rol in instrument.rolesPermitidos.split(',')" :key="rol.trim()" ...>
  {{ rol.trim() }}
</span>
```

### C.6 Plantilla (template file)
- Schema field `plantillaArchivo` exists (VarChar(500)).
- Service accepts it.
- Zod accepts it.
- **Frontend `crear.vue` does NOT render a file input for it.**
- **Frontend `[id]/index.vue` has no edit UI at all** → no way to upload/replace template post-create.

### Recommendation for W2/W3
- **W2**: Add `.refine()` on Zod requiring each comma-split value of `rolesPermitidos` ∈ `RolUsuario` enum (`ADMIN, EMPLEADO, AUDITOR, OPERADOR`).
- **W3**:
  1. Replace `<InputText>` for roles with `<MultiSelect>` sourced from `['ADMIN','EMPLEADO','AUDITOR','OPERADOR']`. Backend still gets comma-joined string.
  2. Create `instrumentos/[id]/editar.vue` OR add inline edit to `[id]/index.vue` to update plantilla + roles + other fields.
  3. Add file-upload control for `plantillaArchivo` via `useFileUpload().uploadFile(file, 'instrumentos')`.

---

## Domain D — Paciente Historial de Fichas

### D.1 Page that renders the historial
**There is NO `pacientes/[id]/historial.vue`.** The historial is rendered inline as **Tab 1** (`activeTab === 1`) of `frontend/app/pages/pacientes/[id]/index.vue` (866 lines). Tab content: lines **541–663**.

### D.2 Ficha-row component
**No dedicated ficha-row component.** Inline `<DataTable>` at `pacientes/[id]/index.vue:595-660`. Field that renders instrumento name — `data.instrumentoNombre` (string) and `data.instrumentoTipo` (string):

```vue
<!-- pacientes/[id]/index.vue:601-608 -->
<Column header="Instrumento" style="min-width: 200px">
  <template #body="{ data }">
    <div>
      <p class="font-medium text-[var(--text-color)]">{{ data.instrumentoNombre }}</p>
      <p class="text-xs text-[var(--text-color-secondary)]">{{ data.instrumentoTipo }}</p>
    </div>
  </template>
</Column>
```
Type: `interface RegistroFicha { instrumentoNombre: string; instrumentoTipo: string; ... }` (line 18).

### D.3 "Actualizar estado" modal — `handleFichaSubmit` (FULL BODY, `pacientes/[id]/index.vue:312-379`)
```ts
async function handleFichaSubmit() {
  if (!fichaForm.id || !fichaForm.newEstado || !patient.value) return

  submittingFicha.value = true
  try {
    let archivoCompletado: string | undefined

    // Upload file when transitioning to COMPLETADO
    if (fichaForm.newEstado === 'COMPLETADO') {
      if (!uploadedFile.value) {
        toast.add({ severity: 'warn', summary: 'Debes adjuntar un archivo para marcar como completado', life: 4000 })
        submittingFicha.value = false
        return
      }

      uploadingFile.value = true
      try {
        // Step 1: Get presigned URL
        const presignedRes = await apiFetch<{ success: boolean; data: { uploadUrl: string; key: string } }>(
          '/uploads/presigned-url',
          { method: 'POST', body: { contentType: uploadedFile.value.type, folder: 'fichas' } }
        )
        const { uploadUrl, key } = presignedRes.data

        // Step 2: Upload directly to S3
        const uploadResponse = await fetch(uploadUrl, {
          method: 'PUT', body: uploadedFile.value, headers: { 'Content-Type': uploadedFile.value.type },
        })
        if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`)
        archivoCompletado = key
      } finally { uploadingFile.value = false }
    }

    // Step 3: Update ficha status
    await apiFetch(`/patients/${patient.value.id}/fichas/${fichaForm.id}/status`, {
      method: 'PATCH',
      body: {
        estado: fichaForm.newEstado,
        ...(archivoCompletado ? { archivoCompletado } : {}),
      },
    })

    await fetchPatient()
    showFichaDialog.value = false
    toast.add({ severity: 'success', summary: 'Estado actualizado', life: 3000 })
  } catch (e: any) {
    console.error('Error updating ficha status:', e)
    const msg = e?.data?.message || 'Error al actualizar el estado'
    toast.add({ severity: 'error', summary: msg, life: 4000 })
  } finally { submittingFicha.value = false }
}
```

**⚠️ W3 bug**: handler never sends `notasObservaciones` or `fechaVencimiento` even though backend supports them. Also: inline presigned-URL flow duplicates `useFileUpload().uploadFile()` composable.

### D.4 Disabled condition on pencil / edit button — VERBATIM (`pacientes/[id]/index.vue:635-644`)
```vue
<!-- View / update status button -->
<Button
  icon="pi pi-pencil"
  size="small"
  severity="secondary"
  text
  rounded
  v-tooltip.top="'Cambiar estado'"
  :disabled="data.estado === 'VENCIDO'"
  @click="openFichaDialog(data)"
/>
```
**Exact condition: `:disabled="data.estado === 'VENCIDO'"`** — disabled when status is exactly `VENCIDO`.

Available transitions map (`pacientes/[id]/index.vue:105-109`):
```ts
const validTransitions: Record<string, Array<'COMPLETADO' | 'VENCIDO'>> = {
  PENDIENTE: ['COMPLETADO', 'VENCIDO'],
  COMPLETADO: ['VENCIDO'],
  VENCIDO: [],
}
```
VENCIDO is terminal — frontend disables button, backend **rejects** any transition out with 400.

"Guardar Cambios" disabled condition (`pacientes/[id]/index.vue:850-859`):
```vue
<Button label="Guardar Cambios" icon="pi pi-save"
  :loading="submittingFicha || uploadingFile"
  :disabled="availableTransitions.length === 0 || !fichaForm.newEstado || (requiresFileUpload && !uploadedFile)"
  @click="handleFichaSubmit" />
```

### D.5 Backend endpoint — `PATCH /api/v1/patients/:id/fichas/:fichaId/status` (`backend/src/routes/patients.routes.ts:222-269`)
**There is NO Zod schema on this PATCH** — manual destructuring + validation:
```ts
const { estado, archivoCompletado, notasObservaciones, fechaVencimiento } = req.body
if (!estado) { res.status(400).json({ success: false, message: 'estado is required' }); return }

const ficha = await prisma.registroFichaCompletada.findFirst({ where: { id: fichaId, clienteId: patientId } })
if (!ficha) { res.status(404).json({ success: false, message: 'Ficha not found' }); return }

const validTransitions: Record<string, string[]> = {
  PENDIENTE: ['COMPLETADO', 'VENCIDO'],
  COMPLETADO: ['VENCIDO'],
  VENCIDO: [],
}
const allowed = validTransitions[ficha.estado] ?? []
if (!allowed.includes(estado)) {
  res.status(400).json({ success: false, message: `Cannot transition from ${ficha.estado} to ${estado}` }); return
}
if (estado === 'COMPLETADO' && !archivoCompletado) {
  res.status(400).json({ success: false, message: 'archivoCompletado is required when transitioning to COMPLETADO' }); return
}

const updateData: any = {
  estado,
  ...(estado === 'COMPLETADO' && { fechaCompletado: new Date() }),
  ...(archivoCompletado && { archivoCompletado }),
  ...(notasObservaciones && { notasObservaciones }),
  ...(fechaVencimiento && { fechaVencimiento: new Date(fechaVencimiento) }),
}
const updated = await prisma.registroFichaCompletada.update({ where: { id: fichaId }, data: updateData, include: { instrumento: { select: { id: true, nombreInstrumento: true, tipo: true } } } })
res.json({ success: true, data: updated })
```

### Recommendation for W3
- Refactor `handleFichaSubmit` to use `useFileUpload().uploadFile(file, 'fichas')` instead of inline presigned-URL flow.
- Add `notasObservaciones` + `fechaVencimiento` inputs to dialog and include them in PATCH body.
- **Open question**: should admin override VENCIDO? Backend rejects any transition out — un-disabling frontend button alone will not work. W2/W3 must align.

---

## Domain E — Nómina

### E.1 Frontend pages
| Path | Role |
|---|---|
| `nomina/index.vue` (~340 lines) | Period picker + table + register/edit dialog |

**No `/nomina/crear.vue` or `/nomina/[id].vue`** — entire CRUD UI is in `index.vue`.

### E.2 "Registrar" modal — `saveEntrada` full body (`nomina/index.vue:148-180`)
```ts
async function saveEntrada() {
  if (!editingRow.value) return
  const id = editingRow.value.empleado.id
  const isUpdate = !!editingRow.value.entrada
  try {
    if (isUpdate) {
      await apiFetch(`/nomina/periodos/${editingRow.value.entrada!.id}`, {
        method: 'PUT',
        body: {
          salario: dialogForm.salario,
          notas: dialogForm.notas.trim() || null,
          archivos: dialogForm.archivos,
        },
      })
    } else {
      await apiFetch('/nomina/periodos', {
        method: 'POST',
        body: {
          empleadoId: id,
          periodo: periodRef.value,
          salario: dialogForm.salario,
          notas: dialogForm.notas.trim() || null,
          archivos: dialogForm.archivos,
        },
      })
    }
    closeDialog()
    await fetchRows()
  } catch (e: any) {
    const detail = e?.data?.message || e?.message || 'Error al guardar la entrada'
    toast.add({ severity: 'error', summary: 'Error', detail, life: 5000 })
  }
}
```

**Cuenta-de-cobro is NOT a top-level field** — it is one of many `archivos[]` entries with `tipoArchivo: 'CUENTA_COBRO'`. Stored in `ArchivoNominaPeriodo.url` (S3 key).

### E.3 Required slots by contract type (frontend, `nomina/index.vue:56-66`)
```ts
const requiredSlotsForTipo = (tipo: string) => {
  if (tipo === 'OPS' || tipo === 'OBRA_O_LABOR') {
    return ['CUENTA_COBRO', 'INFORME_ACTIVIDADES', 'COMPROBANTE_APORTES'] as const
  }
  if (tipo === 'TERMINO_FIJO' || tipo === 'TERMINO_INDEFINIDO') {
    return ['DESPRENDIBLE'] as const
  }
  return [] as const
}
```
Dialog renders the slot list but **does NOT enforce "all slots filled before save"** — only checks `archivos.length` per slot. User can save with empty cuenta-de-cobro.

### E.4 Backend Zod schema (`backend/src/routes/nomina.routes.ts:30-41`)
```ts
const nominaPeriodoSchema = z.object({
  empleadoId: z.number().int().positive(),
  periodo: z.string().regex(/^\d{4}-\d{2}$/),
  salario: z.number().nonnegative().optional(),
  notas: z.string().optional(),
  archivos: z.array(z.object({
    tipoArchivo: z.enum(['CUENTA_COBRO', 'INFORME_ACTIVIDADES', 'COMPROBANTE_APORTES', 'DESPRENDIBLE', 'OTRO']),
    nombre: z.string().min(1).max(200),
    url: z.string().min(1),
  })).optional(),
})
```
**`archivos` is `.optional()`** — backend does NOT require cuenta-de-cobro to be present. On Zod validation failure, response is `400 { success: false, message: "Validation failed" }` — frontend catch shows only `e?.data?.message` ("Validation failed"), **no field-level errors** rendered.

### E.5 Nomina list fetch (`nomina/index.vue:88-99`)
```ts
async function fetchRows() {
  if (!periodRef.value) return
  loading.value = true
  try {
    const res = await apiFetch<{ success: boolean; data: NominaRow[] }>(
      `/nomina?periodo=${periodRef.value}`
    )
    rows.value = res.data ?? []
  } catch (e) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'No se pudo cargar la nómina' })
  } finally { loading.value = false }
}
```
Frontend fetches **all `ACTIVO` empleados** for the period from `GET /api/v1/nomina?periodo=YYYY-MM`. Backend (`nominaService.getNominaMonth`) returns each active empleado + their active contrato + their entry for that period + cargo salario — **no client-side filter by empleado**. No search/filter input on the page.

### Recommendation for W2/W3
- **W2**: Add `.superRefine()` on `nominaPeriodoSchema` requiring `archivos.some(a => a.tipoArchivo === 'CUENTA_COBRO')` when `tipoContrato ∈ {OPS, OBRA_O_LABOR}`. Note: backend resolves `tipoContrato` from active contrato **inside** the transaction (in `nominaService.createNominaPeriodo`), so validation should happen in the service after resolving contrato, OR require `tipoContrato` from client. Improve error response to include `errors: [{path, message}]`.
- **W3**: Disable "Guardar" button (or show inline error) when `requiredSlotsForTipo(tipo)` has any empty slot. Render Zod `errors[]` inline next to the field (or as a toast listing).

---

## Cross-Cutting Summary

| Domain | Backend status | Frontend status | Critical gap |
|---|---|---|---|
| **A. SPA Reload** | n/a | No reload trigger exists | Improve 401 UX (retry + toast) |
| **B. Certificados** | PUT + Zod already exist | Inline edit exists | Add `archivoUrl`, `comprobantePagoUrl`, `periodicidad`, `periodo` to edit form |
| **C. Instrumentos** | Schema/service OK | No edit page; plain text roles | Replace `<InputText>` with `<MultiSelect>`; add plantilla upload; create `[id]/editar.vue` |
| **D. Fichas** | PATCH endpoint exists, no Zod | `handleFichaSubmit` misses `notasObservaciones`/`fechaVencimiento` | Refactor to `useFileUpload`; add inputs; align VENCIDO-disable policy |
| **E. Nomina** | Schema accepts missing cuenta-de-cobro | No client-side validation | Enforce cuenta-de-cobro (superRefine) or disable save |

---

## File index

### Backend
- `backend/prisma/schema.prisma` — all models (CertificadoEmpresa, Instrumento, Nomina, NominaPeriodo, ArchivoNominaPeriodo, RegistroFichaCompletada)
- `backend/src/services/certificateService.ts` — certificado CRUD
- `backend/src/services/instrumentService.ts` — instrumento + record CRUD
- `backend/src/services/nominaService.ts` — nomina period CRUD + contrato CRUD
- `backend/src/routes/certificates.routes.ts` — `/api/v1/certificates/*` (POST + PUT already exist)
- `backend/src/routes/instruments.routes.ts` — `/api/v1/instruments/*` + records
- `backend/src/routes/patients.routes.ts` — `/api/v1/patients/:id/fichas/*` (incl. PATCH status, no Zod)
- `backend/src/routes/nomina.routes.ts` — `/api/v1/nomina/*` + `/nomina/periodos/*`

### Frontend
- `frontend/nuxt.config.ts` — SPA config (no PWA, no SSR)
- `frontend/app/middleware/auth.ts` — route guard
- `frontend/app/composables/useApi.ts` — 401 interceptor → `navigateTo('/login')`
- `frontend/app/composables/useFileUpload.ts` — reusable presigned URL upload
- `frontend/app/stores/auth.ts` — login/logout/fetchUser/fetchEmpresa
- `frontend/app/pages/certificados/{index,crear,[id]}.vue`
- `frontend/app/pages/instrumentos/{index,crear,[id]/index}.vue` (no editar)
- `frontend/app/pages/pacientes/[id]/index.vue` — tabbed detail with historial + ficha status dialog
- `frontend/app/pages/nomina/index.vue` — period table + registrar/editar dialog