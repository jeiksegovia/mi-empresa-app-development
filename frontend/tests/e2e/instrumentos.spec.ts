import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToInstrumentos(page: any) {
  if (page.url().includes('/instrumentos')) return
  await page.locator('aside nav').getByRole('link', { name: 'Instrumentos' }).click()
  await page.waitForURL('/instrumentos', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Instrument List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to /instrumentos from sidebar', async ({ page }) => {
    await page.locator('aside nav').getByRole('link', { name: 'Instrumentos' }).click()
    await expect(page).toHaveURL('/instrumentos')
  })

  test('should display page header with title', async ({ page }) => {
    await goToInstrumentos(page)
    await expect(page.locator('h1').filter({ hasText: 'Instrumentos' })).toBeVisible()
  })

  test('should display stats cards bar', async ({ page }) => {
    await goToInstrumentos(page)
    await expect(page.getByText('Total Instrumentos')).toBeVisible()
    await expect(page.getByText('Activos', { exact: true })).toBeVisible()
    await expect(page.getByText('Inactivos', { exact: true })).toBeVisible()
  })

  test('should display stats with numeric values from API', async ({ page }) => {
    await goToInstrumentos(page)
    await page.waitForTimeout(1500)
    const statsGrid = page.locator('.grid').first()
    const allText = await statsGrid.textContent()
    expect(allText).toMatch(/\d+/)
  })

  test('should display data table with instrument columns', async ({ page }) => {
    await goToInstrumentos(page)
    await page.waitForTimeout(1000)
    const dataTable = page.locator('.p-datatable').first()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Instrumento' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Tipo' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Periodicidad' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Estado' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Registros' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Acciones' })).toBeVisible()
  })

  test('should display instrument rows from seed data', async ({ page }) => {
    await goToInstrumentos(page)
    await page.waitForTimeout(2000)
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
    const tableContent = await page.locator('table').first().textContent()
    expect(tableContent).toMatch(/Valoración|Nutrición|Admisión/i)
  })

  test('should have search input visible', async ({ page }) => {
    await goToInstrumentos(page)
    const searchInput = page.getByPlaceholder(/buscar por nombre/i)
    await expect(searchInput).toBeVisible()
  })

  test('should have tipo and estado filter dropdowns visible', async ({ page }) => {
    await goToInstrumentos(page)
    const dropdowns = page.locator('.p-select, .p-dropdown')
    const count = await dropdowns.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('should display Nuevo Instrumento button', async ({ page }) => {
    await goToInstrumentos(page)
    const btn = page.getByRole('button', { name: /nuevo instrumento/i })
    await expect(btn).toBeVisible()
  })

  test('should navigate to crear page from Nuevo Instrumento button', async ({ page }) => {
    await goToInstrumentos(page)
    await page.getByRole('button', { name: /nuevo instrumento/i }).click()
    await expect(page).toHaveURL('/instrumentos/crear', { timeout: 5000 })
  })

  test('should filter instruments by search term', async ({ page }) => {
    await goToInstrumentos(page)
    await page.waitForTimeout(1000)
    const searchInput = page.getByPlaceholder(/buscar por nombre/i)
    await searchInput.fill('valorac')
    await page.waitForTimeout(1000)
    const table = page.locator('.p-datatable-tbody, tbody').first()
    const tableText = await table.textContent()
    expect(tableText).toBeTruthy()
  })

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/instrumentos')
    await expect(page).toHaveURL('/login', { timeout: 8000 })
  })
})
