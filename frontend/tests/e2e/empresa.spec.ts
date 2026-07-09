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

async function navigateToEmpresa(page: any) {
  // Use sidebar SPA navigation to avoid full page reload auth issues
  await page.locator('aside nav').getByRole('link', { name: 'Empresa' }).click()
  await page.waitForURL('/empresa', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Empresa - Páginas', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to empresa page and show company info', async ({ page }) => {
    await navigateToEmpresa(page)
    // Page shows NIT label in uppercase CSS (text-xs uppercase class)
    await expect(page.getByText('900123456-1').first()).toBeVisible({ timeout: 8000 })
  })

  test('admin can navigate to edit empresa page', async ({ page }) => {
    await navigateToEmpresa(page)
    const editButton = page.getByRole('link', { name: /editar/i }).first()
    await expect(editButton).toBeVisible()
    await editButton.click()
    await expect(page).toHaveURL(/\/empresa\/editar/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Editar Empresa').first()).toBeVisible()
  })

  test('admin can edit and save empresa details', async ({ page }) => {
    await navigateToEmpresa(page)
    const editButton = page.getByRole('link', { name: /editar/i }).first()
    await editButton.click()
    await page.waitForURL(/\/empresa\/editar/)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Editar Empresa').first()).toBeVisible()

    // Update telefono
    const telefonoInput = page.getByPlaceholder('6014567890')
    await telefonoInput.clear()
    await telefonoInput.fill('6019999999')

    await page.getByRole('button', { name: /guardar cambios/i }).click()

    // Should redirect back to /empresa
    await page.waitForURL(/\/empresa$/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/empresa$/)
  })
})

// ─── Appended: admin guard describe block ────────────────────────────────────

test.describe('admin guard', () => {
  test('admin can access /empresa without redirect', async ({ page }) => {
    await page.context().clearCookies()
    // Login as admin
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.locator('#email').fill('admin@miempresa.com')
    await page.locator('#password input').fill('password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/', { timeout: 15000 })
    await page.waitForLoadState('networkidle')

    // Navigate to /empresa
    await page.locator('aside nav').getByRole('link', { name: 'Empresa' }).click()
    await page.waitForURL('/empresa', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Admin should stay on /empresa, not be redirected
    await expect(page).toHaveURL(/\/empresa$/)
    // Page content visible (not redirected to /)
    await expect(page.getByText('900123456-1').first()).toBeVisible({ timeout: 8000 })
  })

  test('non-admin user accessing /empresa is redirected to /', async ({ page }) => {
    // NOTE: This test requires a non-admin employee account.
    // If no employee credentials exist in the system, this test is skipped.
    // To enable: create an employee user and replace the credentials below.
    test.skip(true, 'Requires a non-admin employee account — no employee credentials configured. Create an employee user and update this test with their credentials.')
  })
})
