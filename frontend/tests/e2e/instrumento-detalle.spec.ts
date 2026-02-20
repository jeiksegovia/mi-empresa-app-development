import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToInstrumentos(page: any) {
  if (page.url().includes('/instrumentos')) return
  await page.locator('aside nav').getByRole('link', { name: 'Instrumentos' }).click()
  await page.waitForURL('/instrumentos', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

async function goToFirstInstrumentDetail(page: any) {
  await goToInstrumentos(page)
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.pi-eye').first().click()
  await page.waitForURL(/\/instrumentos\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

test.describe('Instrument Create Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to /instrumentos/crear', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()
    await expect(page).toHaveURL('/instrumentos/crear', { timeout: 5000 })
  })

  test('should display create form with required fields', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()
    await expect(page.getByPlaceholder(/Ficha de Valoración/i)).toBeVisible()
    await expect(page.getByPlaceholder(/ADMIN,EMPLEADO/i)).toBeVisible()
    await expect(page.getByPlaceholder(/v1\.0/i)).toBeVisible()
  })

  test('should show validation errors on empty submit', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()
    await page.getByRole('button', { name: /crear instrumento/i }).click()
    await expect(page.getByText(/nombre del instrumento es requerido/i)).toBeVisible()
  })

  test('should have Cancelar button that navigates back', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()
    await page.getByRole('button', { name: /cancelar/i }).first().click()
    await expect(page).toHaveURL('/instrumentos', { timeout: 5000 })
  })

  test('should create instrument and redirect to detail page', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()

    const uniqueName = `Instrumento Test ${Date.now()}`
    await page.getByPlaceholder(/Ficha de Valoración/i).fill(uniqueName)
    await page.getByPlaceholder(/FICHA-VAL-001/i).fill(`TEST-${Date.now()}`)

    // Select tipo
    const tipoSelect = page.locator('.p-select').filter({ hasText: /seleccionar tipo/i }).first()
    await tipoSelect.click()
    await page.getByRole('option', { name: 'Valoración' }).click()

    // Select periodicidad
    const perSelect = page.locator('.p-select').filter({ hasText: /seleccionar periodicidad/i }).first()
    await perSelect.click()
    await page.getByRole('option', { name: 'Anual' }).click()

    await page.getByPlaceholder(/ADMIN,EMPLEADO/i).fill('ADMIN')
    await page.getByPlaceholder(/v1\.0/i).fill('v1.0')

    await page.getByRole('button', { name: /crear instrumento/i }).click()
    await page.waitForURL(/\/instrumentos\/\d+$/, { timeout: 10000 })
    expect(page.url()).toMatch(/\/instrumentos\/\d+$/)
  })
})

test.describe('Instrument Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to instrument detail from list', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    expect(page.url()).toMatch(/\/instrumentos\/\d+/)
  })

  test('should display instrument name in header', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    const header = page.locator('h1, h2').first()
    await expect(header).toBeVisible()
    const headerText = await header.textContent()
    expect(headerText).toBeTruthy()
  })

  test('should display tipo tag', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    const tag = page.locator('.p-tag').first()
    await expect(tag).toBeVisible()
  })

  test('should display status badge', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    const badge = page.locator('.p-badge, [class*="badge"]').first()
    await expect(badge).toBeVisible()
  })

  test('should show 2 tabs', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    const tabs = page.locator('button').filter({ has: page.locator('.pi-info-circle, .pi-list') })
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(2)
  })

  test('should show Información tab by default', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await expect(page.getByText('Información')).toBeVisible()
    await expect(page.getByText('Datos Generales')).toBeVisible()
  })

  test('should display Tipo and Periodicidad fields in Información tab', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await expect(page.getByText('Tipo').first()).toBeVisible()
    await expect(page.getByText('Periodicidad').first()).toBeVisible()
  })

  test('should switch to Registros tab', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await page.getByRole('button', { name: /registros/i }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Registros del Instrumento')).toBeVisible()
  })

  test('should display action buttons', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await expect(page.getByRole('button', { name: /volver/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /editar/i })).toBeVisible()
  })

  test('should navigate back to list when clicking Volver', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await page.getByRole('button', { name: /volver/i }).click()
    await expect(page).toHaveURL('/instrumentos', { timeout: 5000 })
  })

  test('should show Roles Permitidos section', async ({ page }) => {
    await goToFirstInstrumentDetail(page)
    await expect(page.getByText('Roles Permitidos')).toBeVisible()
  })
})
