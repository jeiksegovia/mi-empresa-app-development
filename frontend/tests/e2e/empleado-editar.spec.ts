import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

/**
 * Navigate to first employee's profile via sidebar SPA navigation.
 */
async function goToFirstProfile(page: any) {
  await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
  await page.waitForURL('/empleados', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.pi-eye').first().click()
  await page.waitForURL(/\/empleados\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
}

async function goToEdit(page: any) {
  await goToFirstProfile(page)
  await page.getByRole('button', { name: /editar/i }).click()
  await page.waitForURL(/\/empleados\/\d+\/editar$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  // Wait for form to load (loading spinner gone)
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function goToHistorial(page: any) {
  await goToFirstProfile(page)
  // Click the Historial button on the profile page (SPA client-side navigation)
  await page.getByRole('button', { name: /historial/i }).click()
  await page.waitForURL(/\/empleados\/\d+\/historial$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
}

test.describe('Employee Edit Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to edit page from profile', async ({ page }) => {
    await goToEdit(page)
    await expect(page).toHaveURL(/\/empleados\/\d+\/editar$/)
  })

  test('should display page header with title containing Editar', async ({ page }) => {
    await goToEdit(page)
    await expect(page.locator('h1').filter({ hasText: /editar/i })).toBeVisible()
  })

  test('should pre-populate form fields with employee data', async ({ page }) => {
    await goToEdit(page)
    // Nombre and apellido fields should have values
    const nombre = page.getByPlaceholder('Nombres')
    await expect(nombre).toBeVisible()
    const value = await nombre.inputValue()
    expect(value.length).toBeGreaterThan(0)
  })

  test('should show Guardar Cambios button', async ({ page }) => {
    await goToEdit(page)
    await expect(page.getByRole('button', { name: /guardar cambios/i }).first()).toBeVisible()
  })

  test('should show Cancelar button that navigates back to profile', async ({ page }) => {
    await goToEdit(page)
    const cancelBtn = page.getByRole('button', { name: /cancelar/i }).first()
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()
    await expect(page).toHaveURL(/\/empleados\/\d+$/)
  })

  test('should validate required fields', async ({ page }) => {
    await goToEdit(page)
    // Clear nombre field
    const nombreInput = page.getByPlaceholder('Nombres')
    await nombreInput.clear()
    await page.getByRole('button', { name: /guardar cambios/i }).first().click()
    await expect(page.getByText('Requerido').first()).toBeVisible()
  })

  test('should save changes and redirect to profile', async ({ page }) => {
    await goToEdit(page)
    const nombreInput = page.getByPlaceholder('Nombres')
    const currentName = await nombreInput.inputValue()
    // Update the phone field (safe non-breaking change)
    const telefonoInput = page.getByPlaceholder('Número de teléfono')
    await telefonoInput.fill('3001234567')
    await page.getByRole('button', { name: /guardar cambios/i }).first().click()
    await page.waitForURL(/\/empleados\/\d+$/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/empleados\/\d+$/)
  })
})

test.describe('Employee History Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to historial page', async ({ page }) => {
    await goToHistorial(page)
    await expect(page).toHaveURL(/\/empleados\/\d+\/historial$/)
  })

  test('should display page header with Historial title', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.locator('h1').filter({ hasText: /historial/i })).toBeVisible()
  })

  test('should display summary stat cards', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.getByText('Cargos internos')).toBeVisible()
    await expect(page.getByText('Exp. externas')).toBeVisible()
    await expect(page.getByText('Cargo activo')).toBeVisible()
    await expect(page.getByText('Estado actual')).toBeVisible()
  })

  test('should display Cargos en la Empresa section', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.getByText('Cargos en la Empresa')).toBeVisible()
  })

  test('should display Experiencia Laboral Externa section', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.getByText('Experiencia Laboral Externa')).toBeVisible()
  })

  test('should display Línea de Tiempo Completa section', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.getByText('Línea de Tiempo Completa')).toBeVisible()
  })

  test('should show Ver Perfil button that navigates to profile', async ({ page }) => {
    await goToHistorial(page)
    const verPerfilBtn = page.getByRole('button', { name: /ver perfil/i })
    await expect(verPerfilBtn).toBeVisible()
    await verPerfilBtn.click()
    await expect(page).toHaveURL(/\/empleados\/\d+$/)
  })

  test('should show Editar button on historial page', async ({ page }) => {
    await goToHistorial(page)
    await expect(page.getByRole('button', { name: /editar/i })).toBeVisible()
  })
})

// ─── Appended: 5-tab edit describe block ─────────────────────────────────────
// Tab labels from /app/pages/empleados/[id]/editar.vue:
//   Tab 0: 'Datos Personales'
//   Tab 1: 'Núcleo Familiar'
//   Tab 2: 'Info. Laboral'
//   Tab 3: 'Educación'
//   Tab 4: 'Certificados'

test.describe('5-tab edit', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('all 5 tab buttons are visible on edit page', async ({ page }) => {
    await goToEdit(page)

    // Tab labels rendered as button text by the tab-switching loop in the template
    await expect(page.getByRole('button', { name: 'Datos Personales' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Núcleo Familiar' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Info. Laboral' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Educación' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Certificados' })).toBeVisible()
  })

  test('clicking second tab (Núcleo Familiar) switches visible content', async ({ page }) => {
    await goToEdit(page)

    // First tab (Datos Personales) is active by default — Nombres input visible
    const nombreInput = page.getByPlaceholder('Nombres')
    await expect(nombreInput).toBeVisible()

    // Click second tab: Núcleo Familiar
    await page.getByRole('button', { name: 'Núcleo Familiar' }).click()
    await page.waitForTimeout(300)

    // Datos Personales section should now be hidden
    // Núcleo Familiar section has "Agregar Miembro" or shows family form
    // Check that the first tab content is no longer the focused section
    // and that the second tab-specific UI is present
    const addFamilyBtn = page.getByRole('button', { name: /agregar miembro/i })
    await expect(addFamilyBtn).toBeVisible({ timeout: 5000 })
  })

  test('first tab (Datos Personales) has a save button', async ({ page }) => {
    await goToEdit(page)
    // Tab 1 save action: "Guardar Cambios" button
    await expect(page.getByRole('button', { name: /guardar cambios/i }).first()).toBeVisible()
  })

  test('second tab (Núcleo Familiar) has a save button', async ({ page }) => {
    await goToEdit(page)
    await page.getByRole('button', { name: 'Núcleo Familiar' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /guardar/i }).first()).toBeVisible()
  })

  test('third tab (Info. Laboral) has a save button', async ({ page }) => {
    await goToEdit(page)
    await page.getByRole('button', { name: 'Info. Laboral' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /guardar/i }).first()).toBeVisible()
  })

  test('fourth tab (Educación) has a save button', async ({ page }) => {
    await goToEdit(page)
    await page.getByRole('button', { name: 'Educación' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /guardar/i }).first()).toBeVisible()
  })

  test('fifth tab (Certificados) has a save button', async ({ page }) => {
    await goToEdit(page)
    await page.getByRole('button', { name: 'Certificados' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('button', { name: /guardar/i }).first()).toBeVisible()
  })
})
