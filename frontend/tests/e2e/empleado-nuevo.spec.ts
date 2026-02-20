import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToNuevo(page: any) {
  await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
  await page.waitForURL('/empleados', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  const btn = page.getByRole('button', { name: /nuevo empleado/i })
  await expect(btn).toBeVisible()
  await btn.click()
  await page.waitForURL('/empleados/nuevo', { timeout: 8000 })
  await page.waitForLoadState('networkidle')
}

/**
 * Fill step 1 required fields and advance to step 2.
 */
async function fillStep1AndAdvance(page: any, nombre = 'Test', apellido = 'Test', doc = '99887766') {
  const step1 = page.locator('[data-step="1"]')
  await step1.getByPlaceholder('Nombres').fill(nombre)
  await step1.getByPlaceholder('Apellidos').fill(apellido)
  await step1.getByPlaceholder('Número de documento').fill(doc)
  // Género select — first .p-select showing placeholder "Seleccionar"
  const generoSelect = step1.locator('.p-select').filter({ hasText: /seleccionar/i }).first()
  await generoSelect.click()
  await page.getByRole('option', { name: 'Masculino' }).click()
  // Date of birth
  await step1.locator('input[type="date"]').first().fill('1990-01-15')
  await page.getByRole('button', { name: /siguiente/i }).click()
}

test.describe('Employee Create Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to /empleados/nuevo from list page', async ({ page }) => {
    await goToNuevo(page)
    await expect(page).toHaveURL('/empleados/nuevo')
  })

  test('should display page header with title', async ({ page }) => {
    await goToNuevo(page)
    await expect(page.locator('h1').filter({ hasText: /nuevo empleado/i })).toBeVisible()
  })

  test('should display step progress bar with 5 steps', async ({ page }) => {
    await goToNuevo(page)
    // Progress bar renders 5 numbered circles — check them by their step numbers
    const progressCard = page.locator('.p-card').first()
    // Step 1 circle is active (violet), others show numbers 2-5
    await expect(progressCard.getByText('2')).toBeVisible()
    await expect(progressCard.getByText('3')).toBeVisible()
    await expect(progressCard.getByText('4')).toBeVisible()
    await expect(progressCard.getByText('5')).toBeVisible()
  })

  test('should show step 1 form fields', async ({ page }) => {
    await goToNuevo(page)
    const step1 = page.locator('[data-step="1"]')
    await expect(step1.getByPlaceholder('Nombres')).toBeVisible()
    await expect(step1.getByPlaceholder('Apellidos')).toBeVisible()
    await expect(step1.getByPlaceholder('Número de documento')).toBeVisible()
  })

  test('should validate required fields before advancing', async ({ page }) => {
    await goToNuevo(page)
    await page.getByRole('button', { name: /siguiente/i }).click()
    await expect(page.getByText('Requerido').first()).toBeVisible()
    await expect(page.locator('[data-step="1"]')).toBeVisible()
  })

  test('should advance to step 2 after filling required fields', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page)
    await expect(page.locator('[data-step="2"]')).toBeVisible()
  })

  test('should show Núcleo Familiar step with add button', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page)
    await expect(page.locator('[data-step="2"]').getByRole('button', { name: /agregar/i })).toBeVisible()
  })

  test('should add a family member in step 2', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page)
    await page.locator('[data-step="2"]').getByRole('button', { name: /agregar/i }).click()
    await expect(page.getByText('Miembro 1')).toBeVisible()
  })

  test('should navigate through all 5 steps', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page, 'Ana', 'Martínez', '11223344')
    // Step 2
    await expect(page.locator('[data-step="2"]')).toBeVisible()
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 3
    await expect(page.locator('[data-step="3"]')).toBeVisible()
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 4
    await expect(page.locator('[data-step="4"]')).toBeVisible()
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 5
    await expect(page.locator('[data-step="5"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /guardar empleado/i })).toBeVisible()
  })

  test('should show Anterior button on steps > 1', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page)
    await expect(page.getByRole('button', { name: /anterior/i })).toBeVisible()
  })

  test('should go back to previous step with Anterior button', async ({ page }) => {
    await goToNuevo(page)
    await fillStep1AndAdvance(page)
    await page.getByRole('button', { name: /anterior/i }).click()
    await expect(page.locator('[data-step="1"]')).toBeVisible()
    // Form values should be preserved
    await expect(page.locator('[data-step="1"]').getByPlaceholder('Nombres')).toHaveValue('Test')
  })

  test('should submit and create employee with valid data', async ({ page }) => {
    await goToNuevo(page)
    const docNum = `PLAYWRIGHT${Date.now()}`
    await fillStep1AndAdvance(page, 'Prueba', 'Automatica', docNum)
    // Step 2 - skip
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 3 - skip
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 4 - skip
    await page.getByRole('button', { name: /siguiente/i }).click()
    // Step 5 - submit
    await expect(page.getByRole('button', { name: /guardar empleado/i })).toBeVisible()
    await page.getByRole('button', { name: /guardar empleado/i }).click()
    await page.waitForURL(/\/empleados\/\d+$/, { timeout: 15000 })
    await expect(page).toHaveURL(/\/empleados\/\d+$/)
  })

  test('should show Cancelar button that navigates back', async ({ page }) => {
    await goToNuevo(page)
    const cancelBtn = page.getByRole('button', { name: /cancelar/i })
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()
    await expect(page).toHaveURL('/empleados')
  })
})
