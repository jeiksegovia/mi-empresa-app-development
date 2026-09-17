# Implementation Plan: Improvements #3.1

## Context

This plan addresses the remaining improvements for the Mi Empresa App after completing improvements #2 and #3. The project currently has 126 frontend E2E tests and 123 backend tests passing. This plan focuses on:

1. **Backend**: Usuario-Empleado relationship for employee role users
2. **Frontend UI**: Search input padding, desktop menu button visibility, role-based sidebar navigation
3. **Frontend Pacientes**: Complete CRUD flows (create, edit, add notes, update fichas)

---

## Task 1: Backend — Usuario-Empleado Relationship

### Problem
Currently, `Usuario` (user account) and `Empleado` (employee record) are completely separate entities with no relationship. Users with `rol: 'EMPLEADO'` cannot be linked to their employee master data. This prevents:
- Getting employee-specific data from auth context
- Role/position-based permissions from employee records
- Linking user actions to employee profiles

### Current State
- **Usuario model**: Has `rol` enum (ADMIN, EMPLEADO, AUDITOR, OPERADOR) but no FK to Empleado
- **Empleado model**: Has no FK to Usuario
- **authService**: Returns only Usuario data, never includes Empleado
- **Auth middleware**: Sets `req.user` with Usuario data only

### Implementation

#### 1a. Prisma Schema Update
**File**: `backend/prisma/schema.prisma`

Add optional `empleadoId` FK to Usuario model:

```prisma
model Usuario {
  id        Int      @id @default(autoincrement())
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)
  rol       RolUsuario
  nombre    String   @db.VarChar(100)
  apellido  String   @db.VarChar(100)
  activo    Boolean  @default(true)
  empleadoId Int?    @map("empleado_id")  // NEW: optional FK
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  empleado                      Empleado?  @relation(fields: [empleadoId], references: [id], onDelete: SetNull)  // NEW
  sesiones                      Sesion[]
  instrumentosCreados           Instrumento[]  @relation("InstrumentoCreador")
  instrumentosModificados       Instrumento[]  @relation("InstrumentoModificador")
  registrosResponsables         RegistroFichaCompletada[] @relation("RegistroResponsable")
  notasCliente                  NotaCliente[]

  @@map("usuarios")
}

model Empleado {
  id                   Int       @id @default(autoincrement()) @map("empleado_id")
  // ... existing fields ...

  // Relations
  usuarios                     Usuario[]  // NEW: one employee can have multiple user accounts
  nucleoFamiliar               NucleoFamiliar[]
  // ... rest of existing relations ...

  @@map("empleados")
}
```

**Migration**:
```bash
cd backend && npx prisma migrate dev --name add-usuario-empleado-relationship
```

#### 1b. Update Auth Service
**File**: `backend/src/services/authService.ts`

Modify `loginUser()` to include empleado data if user has empleadoId:

```typescript
// Update LoginResult interface (lines 20-28)
export interface LoginResult {
  user: {
    id: number
    email: string
    rol: string
    nombre: string
    apellido: string
    empleadoId?: number  // NEW
  }
  sessionToken: string
}

// Update loginUser function (around line 93-105)
const session = await prisma.sesion.create({
  data: { usuarioId: usuario.id, ip, userAgent, expiraEn },
  include: {
    usuario: {
      include: { empleado: true },  // NEW: include empleado relation
    },
  },
})

// ... create JWT ...

return {
  user: {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    empleadoId: usuario.empleadoId || undefined,  // NEW
  },
  sessionToken,
}
```

#### 1c. Update Seed Data
**File**: `backend/prisma/seed.ts`

Link the `empleado@miempresa.com` user to an existing Empleado record:

```typescript
// After creating empleados (around line 259), link one user to one employee
const empleadoUser = await prisma.usuario.findUnique({
  where: { email: 'empleado@miempresa.com' },
})

const carlosEmpleado = await prisma.empleado.findFirst({
  where: { numeroDocumento: '1001234567' },  // Carlos Rodríguez
})

if (empleadoUser && carlosEmpleado) {
  await prisma.usuario.update({
    where: { id: empleadoUser.id },
    data: { empleadoId: carlosEmpleado.id },
  })
  console.log('✓ Linked empleado@miempresa.com → Carlos Rodríguez')
}
```

#### 1d. Write Backend Tests
**File**: `backend/tests/auth/auth-empleado-link.spec.ts`

New test suite:
- Login as `empleado@miempresa.com` and verify response includes `empleadoId`
- Verify `GET /auth/me` returns empleado data
- Test login for users without empleadoId (admin, auditor) — empleadoId should be undefined

**Test Command**: `cd backend && npx playwright test tests/auth/auth-empleado-link.spec.ts`

---

## Task 2: Frontend UI — Search Input Padding Fix

### Problem
Search inputs across list pages have `pl-9` (36px left padding) but the search icon at `left-3` (12px) + icon width (16px) = 28px, leaving only 8px gap. Text overlaps the icon.

### Implementation

**Files to modify**:
- `frontend/app/pages/empleados/index.vue` (line ~145)
- `frontend/app/pages/pacientes/index.vue` (line ~145)
- `frontend/app/pages/instrumentos/index.vue` (line ~120)

**Change**: Replace `pl-9` with `pl-10` on the `<InputText>` search field.

**Before**:
```vue
<InputText
  v-model="search"
  placeholder="Buscar por nombre, apellido o documento..."
  class="w-full pl-9"
  @input="onSearchInput"
/>
```

**After**:
```vue
<InputText
  v-model="search"
  placeholder="Buscar por nombre, apellido o documento..."
  class="w-full pl-10"
  @input="onSearchInput"
/>
```

**Visual Test**: Run frontend, navigate to empleados/pacientes/instrumentos and verify search icon doesn't overlap text.

---

## Task 3: Frontend UI — Hide Desktop Menu Button

### Problem
The hamburger menu button (`pi-bars`) in AppHeader is only needed for mobile. Currently visible on desktop.

### Implementation

**File**: `frontend/app/components/AppHeader.vue` (lines 50-57)

**Current code**:
```vue
<Button
  icon="pi pi-bars"
  severity="secondary"
  text
  rounded
  class="md:hidden"
  @click="emit('toggle-sidebar')"
/>
```

**Analysis**: The button already has `md:hidden` class, which hides it on screens ≥768px. **No changes needed — this is already correct.**

**Verification**: If the button is still visible on desktop, check if Tailwind CSS is loaded correctly and `md:hidden` is working.

---

## Task 4: Frontend UI — Role-Based Sidebar Navigation

### Problem
All navigation items are visible to all users regardless of role. The "Empresa" menu item should only be visible to ADMIN users.

### Implementation

#### 4a. Update Auth Store
**File**: `frontend/app/stores/auth.ts`

Add helper methods for role checking:

```typescript
export const useAuthStore = defineStore('auth', () => {
  // ... existing state ...

  const isAdmin = computed(() => role.value === 'ADMIN')
  const isEmpleado = computed(() => role.value === 'EMPLEADO')
  const isAuditor = computed(() => role.value === 'AUDITOR')
  const isOperador = computed(() => role.value === 'OPERADOR')

  return {
    // ... existing returns ...
    isAdmin,
    isEmpleado,
    isAuditor,
    isOperador,
  }
})
```

#### 4b. Update Sidebar Component
**File**: `frontend/app/components/AppSidebar.vue`

Add conditional rendering for menu items based on role:

**Approach 1: Filter in template**
```vue
<template v-for="item in filteredMenuItems" :key="item.to">
  <!-- existing menu item rendering -->
</template>

<script setup>
const authStore = useAuthStore()
const appConfig = useAppConfig()

const filteredMenuItems = computed(() => {
  return appConfig.sidebar.items.filter(item => {
    // Hide "Empresa" for non-admin users
    if (item.to === '/empresa' && !authStore.isAdmin) {
      return false
    }
    return true
  })
})
</script>
```

**Approach 2: Add v-if directly**
```vue
<template v-for="item in appConfig.sidebar.items" :key="item.to">
  <NuxtLink
    v-if="shouldShowMenuItem(item)"
    :to="item.to"
    :class="[
      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
      // ... rest of classes
    ]"
  >
    <!-- existing content -->
  </NuxtLink>
</template>

<script setup>
const authStore = useAuthStore()

function shouldShowMenuItem(item: any) {
  if (item.to === '/empresa' && !authStore.isAdmin) {
    return false
  }
  return true
}
</script>
```

**Choose Approach 1** (cleaner, more maintainable).

#### 4c. Write E2E Test
**File**: `frontend/tests/e2e/sidebar-role-visibility.spec.ts`

Test suite:
- Login as admin → verify "Empresa" item visible
- Login as empleado@miempresa.com → verify "Empresa" item NOT visible
- Login as auditor → verify "Empresa" item NOT visible
- Login as operador → verify "Empresa" item NOT visible

**Test Command**: `cd frontend && npx playwright test tests/e2e/sidebar-role-visibility.spec.ts`

---

## Task 5: Frontend Pacientes — Create Patient Page

### Problem
"Nuevo Paciente" button has no handler. No `/pacientes/crear` page exists.

### Implementation

#### 5a. Create Page
**File**: `frontend/app/pages/pacientes/crear.vue`

**Form fields** (from Prisma schema `Cliente` model):
- **Required**: nombre*, tipoDocumento* (CC/CE/PASAPORTE/TI), numeroDocumento*, fechaNacimiento*, genero*
- **Optional**: telefono, email, direccion, informacionSeguro, observacionesEspeciales, estado (ACTIVO/INACTIVO)
- **Nested relations** (optional):
  - contactosEmergencia: nombre, apellido, telefono, parentesco (array, dynamic add/remove)

**Structure**: Single-page form (not wizard, simpler than empleado form).

**Submit logic**:
- POST `/patients` with payload
- Toast success message
- Navigate to `/pacientes/:id` on success

#### 5b. Update List Page
**File**: `frontend/app/pages/pacientes/index.vue` (line ~132)

Add click handler to "Nuevo Paciente" button:

```vue
<Button
  label="Nuevo Paciente"
  icon="pi pi-plus"
  @click="navigateTo('/pacientes/crear')"
/>
```

#### 5c. Backend Route Check
**File**: `backend/src/routes/patients.routes.ts`

Verify `POST /patients` endpoint exists and handles nested relations. If not, add similar to empleados routes.

#### 5d. Write E2E Test
**File**: `frontend/tests/e2e/paciente-crear.spec.ts`

Test:
- Navigate to `/pacientes/crear`
- Fill required fields only → submit → verify redirect to detail page
- Fill all fields including emergency contacts → submit → verify data persists

**Test Command**: `cd frontend && npx playwright test tests/e2e/paciente-crear.spec.ts`

---

## Task 6: Frontend Pacientes — Edit Patient Page

### Problem
"Editar" button on detail page is not functional. No `/pacientes/:id/editar` page exists.

### Implementation

#### 6a. Create Page
**File**: `frontend/app/pages/pacientes/[id]/editar.vue`

**Structure**:
- Pre-populate form with patient data from `GET /patients/:id`
- Same fields as crear.vue but with existing data loaded
- Update button label: "Guardar Cambios"
- PUT `/patients/:id` on submit

**Nested relations handling**:
- Show existing emergency contacts with remove button
- Allow adding new contacts
- Send full contact list on update (not diffs)

#### 6b. Update Detail Page
**File**: `frontend/app/pages/pacientes/[id]/index.vue` (line ~126)

Enable the "Editar" button:

```vue
<Button
  label="Editar"
  icon="pi pi-pencil"
  severity="info"
  @click="navigateTo(`/pacientes/${patient.id}/editar`)"
/>
```

#### 6c. Backend Route Check
**File**: `backend/src/routes/patients.routes.ts`

Verify `PUT /patients/:id` endpoint exists. If not, add it.

#### 6d. Write E2E Test
**File**: `frontend/tests/e2e/paciente-editar.spec.ts`

Test:
- Navigate to patient detail → click Editar
- Verify form pre-populated
- Change nombre → submit → verify updated on detail page
- Add new emergency contact → submit → verify shows in list

**Test Command**: `cd frontend && npx playwright test tests/e2e/paciente-editar.spec.ts`

---

## Task 7: Frontend Pacientes — Add Note to Patient

### Problem
Notas tab is read-only. No create/edit functionality exists.

### Implementation

#### 7a. Add Note Button to Detail Page
**File**: `frontend/app/pages/pacientes/[id]/index.vue` (Tab 2, line ~358)

Add "Nueva Nota" button in the Notas card header:

```vue
<template #header>
  <div class="px-6 pt-5 pb-0 flex items-center justify-between">
    <h3 class="text-base font-semibold text-[var(--text-color)] flex items-center gap-2">
      <i class="pi pi-book text-violet-500" /> Notas del Cliente
      <span class="ml-auto text-xs font-normal text-[var(--text-color-secondary)]">
        {{ patient.notasCliente.length }} nota(s)
      </span>
    </h3>
    <Button
      label="Nueva Nota"
      icon="pi pi-plus"
      size="small"
      @click="showNoteDialog = true"
    />
  </div>
</template>
```

#### 7b. Add Note Dialog
**File**: Same file, add dialog component

Add reactive state:
```typescript
const showNoteDialog = ref(false)
const noteForm = reactive({
  tipo: '',
  prioridad: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
  contenido: '',
})

const tipoOptions = ['Consulta', 'Seguimiento', 'Incidencia', 'Observación']
const prioridadOptions = [
  { label: 'Alta', value: 'ALTA' },
  { label: 'Media', value: 'MEDIA' },
  { label: 'Baja', value: 'BAJA' },
]

async function submitNote() {
  try {
    await apiFetch(`/patients/${patient.value!.id}/notes`, {
      method: 'POST',
      body: {
        tipo: noteForm.tipo,
        prioridad: noteForm.prioridad,
        contenido: noteForm.contenido,
      },
    })
    toast.add({ severity: 'success', summary: 'Nota agregada', life: 3000 })
    showNoteDialog.value = false
    Object.assign(noteForm, { tipo: '', prioridad: 'MEDIA', contenido: '' })
    await fetchPatient()  // Reload patient data
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al agregar nota', life: 5000 })
  }
}
```

Add dialog template:
```vue
<Dialog
  v-model:visible="showNoteDialog"
  header="Nueva Nota"
  :modal="true"
  :style="{ width: '32rem' }"
>
  <div class="space-y-4">
    <div>
      <label class="block text-sm font-medium mb-2">Tipo</label>
      <Select
        v-model="noteForm.tipo"
        :options="tipoOptions"
        placeholder="Seleccionar tipo"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Prioridad</label>
      <Select
        v-model="noteForm.prioridad"
        :options="prioridadOptions"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Contenido</label>
      <Textarea
        v-model="noteForm.contenido"
        rows="5"
        class="w-full"
        placeholder="Escribir nota..."
      />
    </div>
  </div>
  <template #footer>
    <Button label="Cancelar" severity="secondary" @click="showNoteDialog = false" />
    <Button label="Guardar" @click="submitNote" :disabled="!noteForm.tipo || !noteForm.contenido" />
  </template>
</Dialog>
```

#### 7c. Backend Route
**File**: `backend/src/routes/patients.routes.ts`

Add new endpoint:
```typescript
// POST /patients/:id/notes
router.post('/:id/notes', validate(createNoteSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = parseInt(req.params.id)
    const userId = req.user!.id
    const note = await patientService.createNote(patientId, userId, req.body)
    res.status(201).json({ success: true, data: note })
  } catch (error: any) {
    logger.error('Create note error:', error)
    res.status(500).json({ success: false, message: 'Error creating note' })
  }
})

// Zod schema
const createNoteSchema = z.object({
  tipo: z.string().min(1),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  contenido: z.string().min(1),
})
```

#### 7d. Backend Service
**File**: `backend/src/services/patientService.ts`

Add function:
```typescript
export async function createNote(
  clienteId: number,
  usuarioId: number,
  input: { tipo: string; prioridad: string; contenido: string }
) {
  const prisma = getPrisma()
  return await prisma.notaCliente.create({
    data: {
      clienteId,
      usuarioId,
      tipo: input.tipo,
      prioridad: input.prioridad as any,
      contenido: input.contenido,
    },
  })
}
```

#### 7e. Write Tests
**Backend**: `backend/tests/patients/patient-notes.spec.ts` — API test for POST /patients/:id/notes
**Frontend**: `frontend/tests/e2e/paciente-notas.spec.ts` — E2E test for dialog flow

---

## Task 8: Frontend Pacientes — Update Ficha (Record)

### Problem
Fichas in Tab 1 are read-only with non-functional "Ver detalles" buttons. Need to add ability to update pending fichas.

### Implementation

#### 8a. Add Update Ficha Dialog
**File**: `frontend/app/pages/pacientes/[id]/index.vue` (Tab 1, lines ~292-340)

Enable "Ver detalles" button and add dialog:

```typescript
const showFichaDialog = ref(false)
const selectedFicha = ref<RegistroFicha | null>(null)
const fichaForm = reactive({
  estado: '' as 'COMPLETADO' | 'EN_PROGRESO' | 'PENDIENTE' | 'VENCIDO',
  fechaCompletado: '',
  observaciones: '',
})

function openFichaDialog(ficha: RegistroFicha) {
  selectedFicha.value = ficha
  Object.assign(fichaForm, {
    estado: ficha.estado,
    fechaCompletado: ficha.fechaCompletado || '',
    observaciones: '',
  })
  showFichaDialog.value = true
}

async function updateFicha() {
  try {
    await apiFetch(`/patients/${patient.value!.id}/fichas/${selectedFicha.value!.id}`, {
      method: 'PUT',
      body: fichaForm,
    })
    toast.add({ severity: 'success', summary: 'Ficha actualizada', life: 3000 })
    showFichaDialog.value = false
    await fetchPatient()
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Error', detail: e?.data?.message || 'Error al actualizar ficha', life: 5000 })
  }
}
```

Update button:
```vue
<Button
  icon="pi pi-eye"
  size="small"
  severity="secondary"
  text
  rounded
  v-tooltip.top="'Ver detalles'"
  @click="openFichaDialog(data)"
/>
```

Add dialog:
```vue
<Dialog
  v-model:visible="showFichaDialog"
  header="Actualizar Ficha"
  :modal="true"
  :style="{ width: '28rem' }"
>
  <div v-if="selectedFicha" class="space-y-4">
    <div>
      <p class="text-sm font-medium mb-1">Instrumento</p>
      <p class="text-sm text-[var(--text-color-secondary)]">{{ selectedFicha.instrumentoNombre }}</p>
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Estado</label>
      <Select
        v-model="fichaForm.estado"
        :options="['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'VENCIDO']"
        class="w-full"
      />
    </div>
    <div v-if="fichaForm.estado === 'COMPLETADO'">
      <label class="block text-sm font-medium mb-2">Fecha Completado</label>
      <input
        type="date"
        v-model="fichaForm.fechaCompletado"
        class="w-full px-3 py-2 border border-[var(--surface-border)] rounded-lg"
      />
    </div>
    <div>
      <label class="block text-sm font-medium mb-2">Observaciones</label>
      <Textarea
        v-model="fichaForm.observaciones"
        rows="3"
        class="w-full"
        placeholder="Observaciones opcionales..."
      />
    </div>
  </div>
  <template #footer>
    <Button label="Cancelar" severity="secondary" @click="showFichaDialog = false" />
    <Button label="Guardar" @click="updateFicha" />
  </template>
</Dialog>
```

#### 8b. Backend Route
**File**: `backend/src/routes/patients.routes.ts` or `backend/src/routes/instruments.routes.ts` (records are RegistroFichaCompletada, linked to instruments)

Check if endpoint exists: `PUT /instruments/records/:id`

If not, add:
```typescript
// PUT /instruments/records/:id
router.put('/records/:id', validate(updateRecordSchema), async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id)
    const record = await instrumentService.updateRecord(id, req.body)
    res.json({ success: true, data: record })
  } catch (error: any) {
    logger.error('Update record error:', error)
    if (error.message === 'Record not found') {
      res.status(404).json({ success: false, message: 'Record not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error updating record' })
  }
})

const updateRecordSchema = z.object({
  estado: z.enum(['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO', 'VENCIDO']).optional(),
  fechaCompletado: z.string().optional(),
  observaciones: z.string().optional(),
})
```

#### 8c. Write Tests
**Backend**: Update existing `backend/tests/instruments/instruments.spec.ts` to test record updates
**Frontend**: `frontend/tests/e2e/paciente-fichas.spec.ts` — E2E test for update dialog

---

## Execution Order & Dependencies

```
Task 1 (Usuario-Empleado backend) ─── no dependencies
Task 2 (Search padding)           ─── no dependencies (parallel)
Task 3 (Desktop menu)             ─── no dependencies (already done)
Task 4 (Role-based sidebar)       ─── depends on Task 1 (auth store update)
Task 5 (Create patient)           ─── no dependencies (parallel)
Task 6 (Edit patient)             ─── depends on Task 5 (reuses form structure)
Task 7 (Add note)                 ─── no dependencies (parallel)
Task 8 (Update ficha)             ─── no dependencies (parallel)
```

Optimal execution:
1. **Phase 1**: Tasks 1, 2, 5, 7 in parallel
2. **Phase 2**: Tasks 4, 6, 8
3. **Phase 3**: Comprehensive testing and iteration

---

## Testing Strategy

### Test Sequence
After each task:
1. Run task-specific test
2. If fails, spawn sub-agent with context to fix
3. Iterate up to 10 times until green

After all tasks:
1. **Backend full suite**: `cd backend && npx playwright test` — all tests pass
2. **Frontend full suite**: `cd frontend && npx playwright test` — all tests pass
3. **Manual smoke test**: Login as different roles, verify UI, test CRUD flows
4. **Iterate up to 10 times** on any failures

### New Test Files Created
**Backend**:
- `backend/tests/auth/auth-empleado-link.spec.ts` (Task 1)
- `backend/tests/patients/patient-notes.spec.ts` (Task 7)

**Frontend**:
- `frontend/tests/e2e/sidebar-role-visibility.spec.ts` (Task 4)
- `frontend/tests/e2e/paciente-crear.spec.ts` (Task 5)
- `frontend/tests/e2e/paciente-editar.spec.ts` (Task 6)
- `frontend/tests/e2e/paciente-notas.spec.ts` (Task 7)
- `frontend/tests/e2e/paciente-fichas.spec.ts` (Task 8)

### Test Commands
```bash
# Task 1
cd backend && npx playwright test tests/auth/auth-empleado-link.spec.ts

# Task 2 (visual verification, no automated test)
cd frontend && npm run dev  # manually check search inputs

# Task 4
cd frontend && npx playwright test tests/e2e/sidebar-role-visibility.spec.ts

# Task 5
cd frontend && npx playwright test tests/e2e/paciente-crear.spec.ts

# Task 6
cd frontend && npx playwright test tests/e2e/paciente-editar.spec.ts

# Task 7
cd backend && npx playwright test tests/patients/patient-notes.spec.ts
cd frontend && npx playwright test tests/e2e/paciente-notas.spec.ts

# Task 8
cd frontend && npx playwright test tests/e2e/paciente-fichas.spec.ts

# Full suites
cd backend && npx playwright test
cd frontend && npx playwright test
```

---

## Completion Criteria

All tasks complete when:
- ✅ Backend tests: 126+ passing (current 123 + new 3)
- ✅ Frontend tests: 133+ passing (current 126 + new 7)
- ✅ All new features manually verified
- ✅ No regressions in existing functionality
- ✅ Dev servers shutdown
- ✅ Completion report written to `context/implementation-plan/improvements-3.1-completion.md`

---

## Task Completion Reporting

After each task, update `context/implementation-plan/TASK_XX_COMPLETION.md` with:
- Summary of changes
- Files modified/created
- Test results (pass/fail counts)
- Issues encountered and resolutions
- Screenshots (if UI changes)

Final report at `context/implementation-plan/improvements-3.1-completion.md` consolidates all task reports.
