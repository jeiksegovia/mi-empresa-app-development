import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

async function goToCrear(page: any) {
  await page.goto('/certificados/crear')
  await page.waitForLoadState('networkidle')
}

test.describe('Certificado - Create Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to crear page and show form', async ({ page }) => {
    await goToCrear(page)
    await expect(page.getByText('Nuevo Certificado')).toBeVisible({ timeout: 8000 })
    await expect(page.getByText('Registrar un nuevo certificado de empresa')).toBeVisible()
  })

  test('should show nombre input field', async ({ page }) => {
    await goToCrear(page)
    // InputText with placeholder "Ej: RUT 2024"
    const nombreInput = page.getByPlaceholder('Ej: RUT 2024')
    await expect(nombreInput).toBeVisible()
  })

  test('should show tipoCertificado select dropdown', async ({ page }) => {
    await goToCrear(page)
    // PrimeVue Select with placeholder "Seleccionar tipo"
    const tipoSelect = page.locator('.p-select').filter({ hasText: /seleccionar tipo/i })
    await expect(tipoSelect).toBeVisible()
  })

  test('should show submit button', async ({ page }) => {
    await goToCrear(page)
    const submitBtn = page.getByRole('button', { name: /crear certificado/i })
    await expect(submitBtn).toBeVisible()
  })

  test('should show Cancelar button', async ({ page }) => {
    await goToCrear(page)
    const cancelBtn = page.getByRole('button', { name: /cancelar/i })
    await expect(cancelBtn).toBeVisible()
  })

  test('should show validation error when submitting empty nombre field', async ({ page }) => {
    await goToCrear(page)
    // Leave nombre empty, click submit
    await page.click('button[type="submit"]')
    // Validation error message: "El nombre es requerido"
    await expect(page.getByText('El nombre es requerido')).toBeVisible({ timeout: 5000 })
    // URL should remain on create page (no redirect)
    await expect(page).toHaveURL(/\/certificados\/crear/)
  })

  test('should show validation error when submitting without tipo', async ({ page }) => {
    await goToCrear(page)
    // Fill nombre but leave tipo empty
    await page.getByPlaceholder('Ej: RUT 2024').fill('Test Certificado')
    await page.click('button[type="submit"]')
    await expect(page.getByText('El tipo es requerido')).toBeVisible({ timeout: 5000 })
  })

  test('Cancelar button navigates back to /certificados', async ({ page }) => {
    await goToCrear(page)
    await page.getByRole('button', { name: /cancelar/i }).first().click()
    await expect(page).toHaveURL('/certificados', { timeout: 8000 })
  })
})
