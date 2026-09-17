# Improvements #3.1 - Phase 2 Implementation Plan

## Context

Phase 1 completed 5/8 tasks with 1 critical bug discovered. This phase focuses on:
1. Fixing the login redirect bug (blocking all E2E tests)
2. Completing remaining features (note creation, ficha updates)
3. Comprehensive testing and validation

---

## Task 30: Fix Login Redirect Bug

### Problem Analysis

E2E tests revealed that after successful login, the page stays on `/login` instead of redirecting to `/`. All 5 sidebar role visibility tests failed with timeout waiting for navigation.

### Root Cause Investigation

**Files to inspect**:
1. `frontend/app/pages/login.vue` — Login form submit handler
2. `frontend/app/middleware/auth.ts` — Auth middleware redirect logic
3. `frontend/app/stores/auth.ts` — isAuthenticated state management
4. `frontend/app/layouts/auth.vue` — Auth layout logic

### Expected Behavior

```typescript
// login.vue
const handleSubmit = async () => {
  const result = await authStore.login(email, password)
  if (result.success) {
    await navigateTo('/') // Should redirect to dashboard
  }
}

// middleware/auth.ts
export default defineNuxtRouteMiddleware((to, from) => {
  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    return navigateTo('/login')
  }
  // Allow authenticated users through
})
```

### Implementation Steps

1. Read current login.vue and check redirect logic
2. Read auth.ts middleware and verify it's not blocking redirects
3. Add debug logging to trace the issue
4. Fix the redirect logic
5. Re-run sidebar tests to verify fix

---

## Task 31: Add Note Creation to Patient

### Backend Implementation

#### 31a. Create Note Endpoint
**File**: `backend/src/routes/patients.routes.ts`

Add after existing routes:

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
    if (error.message === 'Patient not found') {
      res.status(404).json({ success: false, message: 'Patient not found' })
      return
    }
    res.status(500).json({ success: false, message: 'Error creating note' })
  }
})

const createNoteSchema = z.object({
  tipo: z.string().min(1),
  prioridad: z.enum(['ALTA', 'MEDIA', 'BAJA']),
  contenido: z.string().min(1),
})
```

#### 31b. Create Service Function
**File**: `backend/src/services/patientService.ts`

```typescript
export async function createNote(
  clienteId: number,
  usuarioId: number,
  input: { tipo: string; prioridad: string; contenido: string }
) {
  const prisma = getPrisma()

  // Verify patient exists
  const patient = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!patient) {
    throw new Error('Patient not found')
  }

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

#### 31c. Backend Tests
**File**: `backend/tests/patients/patient-notes.spec.ts`

```typescript
test.describe('Patient Notes API', () => {
  test('should create note for patient', async ({ request }) => {
    // Login, get patient ID, create note, verify response
  })

  test('should return 404 for non-existent patient', async ({ request }) => {
    // Try to create note for invalid patient ID
  })

  test('should require authentication', async ({ request }) => {
    // Try without session cookie
  })
})
```

### Frontend Implementation

#### 31d. Add Dialog to Patient Detail Page
**File**: `frontend/app/pages/pacientes/[id]/index.vue`

Add reactive state:
```typescript
const showNoteDialog = ref(false)
const noteForm = reactive({
  tipo: '',
  prioridad: 'MEDIA' as 'ALTA' | 'MEDIA' | 'BAJA',
  contenido: '',
})
```

Add dialog component in template Tab 2 section.

#### 31e. Frontend E2E Tests
**File**: `frontend/tests/e2e/paciente-notas.spec.ts`

Test opening dialog, filling form, submitting, verifying note appears in list.

---

## Task 32: Add Ficha Update Dialog

### Frontend Implementation

#### 32a. Add Dialog State
**File**: `frontend/app/pages/pacientes/[id]/index.vue`

```typescript
const showFichaDialog = ref(false)
const selectedFicha = ref<RegistroFicha | null>(null)
const fichaForm = reactive({
  estado: '' as 'COMPLETADO' | 'EN_PROGRESO' | 'PENDIENTE' | 'VENCIDO',
  fechaCompletado: '',
  observaciones: '',
})
```

#### 32b. Update Button Handler
Enable "Ver detalles" buttons in Tab 1 DataTable.

#### 32c. Dialog Component
Add PrimeVue Dialog with form fields.

### Backend Verification

Check if `PUT /instruments/records/:id` endpoint exists. If not, add to `backend/src/routes/instruments.routes.ts`.

### Tests

**File**: `frontend/tests/e2e/paciente-fichas.spec.ts`

---

## Task 33: Comprehensive Testing & Validation

### Testing Phases

#### Phase A: Backend Tests
```bash
cd backend
npm run dev & # Start server
sleep 5
npx playwright test
# Expected: All tests pass (128+)
```

#### Phase B: Frontend Tests
```bash
cd frontend
npm run dev & # Start server
sleep 8
npx playwright test
# Expected: All tests pass (133+)
```

#### Phase C: Manual Smoke Tests

Test with each user role:
1. **Admin**: Login → See Empresa menu → Create patient → Add note
2. **Empleado**: Login → No Empresa menu → Edit patient → Update ficha
3. **Auditor**: Login → View only access
4. **Operador**: Login → Limited access

#### Phase D: Regression Testing

Verify no existing functionality broken:
- Empleados CRUD (existing tests: 94)
- Instrumentos CRUD (existing tests: 28)
- Patient list/detail (existing tests)
- Auth flows (existing tests)

---

## Execution Strategy

### Sub-Agent Breakdown

**Sub-Agent 1: Debug Login Bug** (Output < 50k tokens)
- Read login.vue, auth middleware, auth store
- Identify root cause
- Implement fix
- Test with manual login
- Re-run sidebar tests

**Sub-Agent 2: Patient Notes Backend** (Output < 40k tokens)
- Implement route handler
- Implement service function
- Write API tests (3 tests)
- Run tests and verify

**Sub-Agent 3: Patient Notes Frontend** (Output < 50k tokens)
- Add dialog to patient detail
- Implement submit handler
- Write E2E tests (4 tests)
- Manual test with running servers

**Sub-Agent 4: Ficha Update Dialog** (Output < 40k tokens)
- Add dialog component
- Verify backend endpoint
- Write E2E tests (3 tests)
- Manual test

**Sub-Agent 5: Comprehensive Testing** (Output < 60k tokens)
- Run full backend suite
- Run full frontend suite
- Execute manual smoke tests
- Document any failures
- Iterate fixes up to 5 times

**Sub-Agent 6: Final Consolidation** (Output < 30k tokens)
- Write implementation summary
- Update all task completion reports
- Create deployment checklist
- Final cleanup

---

## Success Criteria

- [ ] Login redirect bug fixed (sidebar tests pass)
- [ ] Patient note creation working (backend + frontend)
- [ ] Ficha update dialog working
- [ ] Backend tests: 131+ passing (128 existing + 3 note tests)
- [ ] Frontend tests: 140+ passing (126 existing + 14 new tests)
- [ ] Manual smoke tests pass for all roles
- [ ] All servers stopped
- [ ] Documentation complete

---

## Estimated Effort

- **Sub-Agent 1 (Login bug)**: 30 mins
- **Sub-Agent 2 (Notes backend)**: 20 mins
- **Sub-Agent 3 (Notes frontend)**: 30 mins
- **Sub-Agent 4 (Ficha dialog)**: 25 mins
- **Sub-Agent 5 (Testing)**: 45 mins
- **Sub-Agent 6 (Consolidation)**: 15 mins

**Total**: ~2.5 hours

---

## Risk Mitigation

### Known Risks

1. **Login bug complexity** — May require more investigation than estimated
2. **Test environment setup** — Port conflicts, server startup issues
3. **Backend endpoint missing** — Ficha update endpoint may not exist

### Mitigation Strategies

1. **Early testing** — Test login fix immediately before proceeding
2. **Parallel execution** — Run backend/frontend work in parallel where possible
3. **Incremental verification** — Test each feature as implemented, not at the end
