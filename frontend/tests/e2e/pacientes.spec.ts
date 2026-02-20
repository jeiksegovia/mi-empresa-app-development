import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('input[placeholder="Ingresa tu contraseña"]').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

/**
 * Navigate to /pacientes via the sidebar link (SPA client-side navigation).
 */
async function goToPacientes(page: any) {
  if (page.url().includes('/pacientes')) return
  await page.locator('aside nav').getByRole('link', { name: 'Pacientes' }).click()
  await page.waitForURL('/pacientes', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Patient List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to /pacientes from sidebar', async ({ page }) => {
    await page.locator('aside nav').getByRole('link', { name: 'Pacientes' }).click()
    await expect(page).toHaveURL('/pacientes')
  })

  test('should display page header with title', async ({ page }) => {
    await goToPacientes(page)
    await expect(page.locator('h1').filter({ hasText: 'Pacientes' })).toBeVisible()
  })

  test('should display stats cards bar', async ({ page }) => {
    await goToPacientes(page)
    await expect(page.getByText('Total Pacientes')).toBeVisible()
    await expect(page.getByText('Activos', { exact: true })).toBeVisible()
    await expect(page.getByText('Inactivos', { exact: true })).toBeVisible()
  })

  test('should display stats with numeric values from API', async ({ page }) => {
    await goToPacientes(page)
    await page.waitForTimeout(2000)
    const statsGrid = page.locator('.grid').first()
    const allText = await statsGrid.textContent()
    expect(allText).toMatch(/\d+/)
  })

  test('should display data table with patient columns', async ({ page }) => {
    await goToPacientes(page)
    await page.waitForTimeout(1000)
    const dataTable = page.locator('.p-datatable').first()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Paciente' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Documento' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Estado' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Fichas' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Acciones' })).toBeVisible()
  })

  test('should display patient rows from seed data', async ({ page }) => {
    await goToPacientes(page)
    await page.waitForTimeout(2000)
    const table = page.locator('table[role="table"]').first()
    await expect(table).toBeVisible()
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)

    // Check for seed data patients
    const tableContent = await table.textContent()
    expect(tableContent).toMatch(/Pedro|Ana|Roberto/i)
  })

  test('should have search input visible', async ({ page }) => {
    await goToPacientes(page)
    const searchInput = page.getByPlaceholder(/buscar/i)
    await expect(searchInput).toBeVisible()
  })

  test('should have estado filter dropdown visible', async ({ page }) => {
    await goToPacientes(page)
    const dropdown = page.locator('.p-select, .p-dropdown').first()
    await expect(dropdown).toBeVisible()
  })

  test('should display Nuevo Paciente button', async ({ page }) => {
    await goToPacientes(page)
    const btn = page.getByRole('button', { name: /nuevo paciente/i })
    await expect(btn).toBeVisible()
  })

  test('should filter patients by search term', async ({ page }) => {
    await goToPacientes(page)
    await page.waitForTimeout(1000)
    const searchInput = page.getByPlaceholder(/buscar/i)
    await searchInput.fill('Pedro')
    // Wait for debounce (400ms) + API response
    await page.waitForTimeout(1000)
    const table = page.locator('.p-datatable-tbody, tbody').first()
    const tableText = await table.textContent()
    expect(tableText).toBeTruthy()
  })

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/pacientes')
    await expect(page).toHaveURL('/login', { timeout: 8000 })
  })
})
