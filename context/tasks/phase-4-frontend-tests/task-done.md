# Phase 4 Frontend Tests — Task Done

## Summary

Wrote 5 new Playwright E2E test files and appended new `test.describe` blocks to 3 existing files.
All tests follow the established project pattern: `login()` helper, `test.beforeEach` with `clearCookies`, SPA navigation via sidebar `aside nav` links, and `waitForLoadState('networkidle')`.

---

## Files Created

### 1. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/certificados.spec.ts`
Tests the `/certificados` list page:
- Page loads with subtitle "Certificados de empresa"
- Stats cards render: Vigentes, Vencidos, Pendientes, Total
- DataTable `<table>` element is present
- Tipo filter dropdown present (`.p-select` with text "Tipo")
- Estado filter dropdown present
- Admin sees "Nuevo Certificado" button
- Table column headers visible

### 2. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/certificado-crear.spec.ts`
Tests the `/certificados/crear` form page:
- Page loads with "Nuevo Certificado" heading
- Nombre `InputText` with placeholder "Ej: RUT 2024" is visible
- Tipo `Select` with placeholder "Seleccionar tipo" is visible
- Submit button "Crear Certificado" present
- Cancelar button present and navigates to `/certificados`
- Submitting empty nombre shows "El nombre es requerido" error and URL stays on crear
- Submitting with nombre but no tipo shows "El tipo es requerido" error

### 3. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/certificado-detalle.spec.ts`
Tests `/certificados/:id` detail page:
- Navigates from list via `pi-eye` icon click
- Uses `test.skip()` guard when list is empty (no certificates)
- Subtitle "Detalle del certificado" visible
- `.p-tag` badge with valid estado value visible
- Tipo, Fecha de Emisión, Fecha de Vencimiento labels visible
- Admin sees Editar button
- Volver button navigates back to `/certificados`
- Edit mode: clicking Editar shows "Editar Certificado" form with "Guardar cambios" button

### 4. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/dashboard-activity.spec.ts`
Tests the dashboard activity feed:
- "Actividad Reciente" section heading visible after login
- Static activity items (hardcoded in dashboard page) OR empty state visible
- Checks for "Nuevo empleado registrado" static item
- `pageerror` listener verifies no blocking JS errors

### 5. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/paciente-fichas.spec.ts`
Tests patient detail Fichas & Evaluaciones tab (index 1):
- Uses `test.skip()` guard when patient list is empty
- "Fichas & Evaluaciones" tab button visible
- Instrument `Select` with placeholder "Seleccionar instrumento" visible
- "Asignar Instrumento" button visible
- "Historial de Fichas" section heading visible
- DataTable or "No hay fichas registradas" empty state present
- PENDIENTE fichas have `pi-trash` delete button (conditional `v-if`)
- Clicking pencil (`pi-pencil`) on non-VENCIDO ficha opens dialog with "Actualizar Estado" header
- Dialog Cancelar button closes dialog

---

## Files Updated (Appended)

### 6. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/empleado-editar.spec.ts`
Appended `test.describe('5-tab edit', ...)`:
- All 5 tab buttons visible: 'Datos Personales', 'Núcleo Familiar', 'Info. Laboral', 'Educación', 'Certificados'
- Clicking Núcleo Familiar tab reveals "Agregar Miembro" button
- Each tab has a Guardar button

### 7. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/empresa.spec.ts`
Appended `test.describe('admin guard', ...)`:
- Admin navigates to `/empresa` and stays (not redirected)
- Non-admin test is skipped with explanation comment (no employee credentials configured)

### 8. `/Users/jeik/ws/mi-empresa-app-development/frontend/tests/e2e/layout.spec.ts`
Appended `test.describe('desktop sidebar behavior', ...)` with `setViewportSize({ width: 1280, height: 800 })`:
- Hamburger "Toggle menu" button visible
- Sidebar initially has `-translate-x-full` (off-screen)
- Clicking hamburger switches sidebar to `translate-x-0`
- Clicking overlay (`div.fixed.inset-0`) at x=600 (beyond sidebar width) closes sidebar

---

## Selector Strategies

| Element | Strategy | Source Reference |
|---|---|---|
| Sidebar nav links | `page.locator('aside nav').getByRole('link', { name })` | layout.spec.ts pattern |
| PrimeVue InputText | `page.getByPlaceholder(...)` | placeholder attr on rendered `<input>` |
| PrimeVue Select | `page.locator('.p-select').filter({ hasText: /placeholder/ })` | PrimeVue renders `.p-select` wrapper |
| PrimeVue Tag | `page.locator('.p-tag')` | PrimeVue component class |
| PrimeVue Dialog | `page.locator('[role="dialog"]')` | ARIA role on Dialog |
| Tab buttons | `page.getByRole('button', { name: 'Tab Label' })` | `tabs` array in editar.vue |
| Eye icon button | `page.locator('.pi-eye').first().click()` | PrimeVue icon class |
| Pencil button | `page.locator('button').filter({ has: page.locator('.pi-pencil') })` | icon class inside Button |
| Trash button | `page.locator('.pi-trash')` | icon class |
| Sidebar translate | `sidebar.evaluate(el => el.classList.contains('-translate-x-full'))` | Tailwind class inspection |
| Overlay | `page.locator('div.fixed.inset-0')` | Tailwind classes on overlay div |
| Stats cards | `page.getByText('Vigentes')` etc. | `title` prop on `AppStatsCard` |

---

## Key Page Source Findings

- **certificados/index.vue**: Stats card titles are 'Vigentes', 'Vencidos', 'Pendientes', 'Total'. Filters use PrimeVue `Select` with placeholders "Tipo" and "Estado". DataTable uses `<DataTable>` which renders `<table>`.
- **certificados/crear.vue**: Validation errors stored in `errors` reactive object; displayed with `v-if="errors.nombre"`. Form has `@submit.prevent="onSubmit"`.
- **certificados/[id].vue**: Edit mode toggled via `editMode` ref. Editar button only visible when `authStore.isAdmin && !editMode`.
- **pacientes/[id]/index.vue**: `tabs` array has 3 entries: index 0 = Información Básica, index 1 = Fichas & Evaluaciones, index 2 = Notas. Instrument assign uses `Select` with option-label="nombreInstrumento". Status dialog header = `Actualizar Estado: ${fichaForm.instrumentoNombre}`.
- **empleados/[id]/editar.vue**: 5 tabs rendered from `tabs` array via `v-for`; tab labels exactly: 'Datos Personales', 'Núcleo Familiar', 'Info. Laboral', 'Educación', 'Certificados'. Each tab has its own save function.
- **index.vue (dashboard)**: Activity section heading = 'Actividad Reciente'. Has hardcoded static activities as fallback.

---

## Run Instructions

```bash
cd /Users/jeik/ws/mi-empresa-app-development/frontend && npx playwright test tests/e2e/
```

Run a specific file:
```bash
npx playwright test tests/e2e/certificados.spec.ts
npx playwright test tests/e2e/certificado-crear.spec.ts
npx playwright test tests/e2e/certificado-detalle.spec.ts
npx playwright test tests/e2e/dashboard-activity.spec.ts
npx playwright test tests/e2e/paciente-fichas.spec.ts
```

Run with UI mode for debugging:
```bash
npx playwright test tests/e2e/ --ui
```

Run headed for visual inspection:
```bash
npx playwright test tests/e2e/ --headed
```
