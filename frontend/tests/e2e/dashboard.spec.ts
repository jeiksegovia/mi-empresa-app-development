import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should display dashboard page with page header', async ({ page }) => {
    await expect(page.locator('h1, h2').filter({ hasText: 'Dashboard' })).toBeVisible()
  })

  test('should display 4 stats cards', async ({ page }) => {
    const statsGrid = page.locator('.grid').first()
    await expect(statsGrid.getByText('Empleados')).toBeVisible()
    await expect(statsGrid.getByText('Pacientes')).toBeVisible()
    await expect(statsGrid.getByText('Instrumentos')).toBeVisible()
    await expect(statsGrid.getByText('Certificados')).toBeVisible()
  })

  test('should display numeric values in stats cards (from API)', async ({ page }) => {
    // Wait for API response - stats should load
    await page.waitForTimeout(2000)
    const statsGrid = page.locator('.grid').first()
    // Check that a number is displayed (any number >= 0)
    const allText = await statsGrid.textContent()
    expect(allText).toMatch(/\d+/)
  })

  test('should navigate to empleados when clicking stats card', async ({ page }) => {
    const statsGrid = page.locator('.grid').first()
    await statsGrid.getByText('Empleados').click()
    await expect(page).toHaveURL('/empleados')
  })

  test('should navigate to pacientes when clicking stats card', async ({ page }) => {
    const statsGrid = page.locator('.grid').first()
    await statsGrid.getByText('Pacientes').click()
    await expect(page).toHaveURL('/pacientes')
  })

  test('should display quick access cards section', async ({ page }) => {
    // Second grid has quick-access cards with module descriptions
    const quickCards = page.locator('.grid').nth(1)
    await expect(quickCards.getByText('Gestión de personal y nómina')).toBeVisible()
    await expect(quickCards.getByText('Gestión de pacientes y fichas')).toBeVisible()
    await expect(quickCards.getByText('Plantillas de evaluación')).toBeVisible()
    await expect(quickCards.getByText('Certificaciones y vencimientos')).toBeVisible()
  })
})
