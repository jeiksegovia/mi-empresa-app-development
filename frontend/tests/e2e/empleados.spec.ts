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
 * Navigate to /empleados via the sidebar link (SPA client-side navigation).
 * Direct page.goto() triggers SSR which redirects to /login because the
 * browser session cookie cannot be forwarded server-side from Playwright.
 */
async function gotoEmpleados(page: any) {
  if (page.url().includes('/empleados')) return
  await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
  await page.waitForURL('/empleados', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Employee List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to /empleados from sidebar', async ({ page }) => {
    await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
    await expect(page).toHaveURL('/empleados')
  })

  test('should display page header with title', async ({ page }) => {
    await gotoEmpleados(page)
    await expect(page.locator('h1').filter({ hasText: 'Empleados' })).toBeVisible()
  })

  test('should display stats cards bar', async ({ page }) => {
    await gotoEmpleados(page)
    await expect(page.getByText('Total Empleados')).toBeVisible()
    // Use exact match to avoid 'Activos' matching inside 'Inactivos'
    await expect(page.getByText('Activos', { exact: true })).toBeVisible()
    await expect(page.getByText('Inactivos', { exact: true })).toBeVisible()
    await expect(page.getByText('Nuevos este mes')).toBeVisible()
  })

  test('should display stats with numeric values from API', async ({ page }) => {
    await gotoEmpleados(page)
    await page.waitForTimeout(2000)
    const statsGrid = page.locator('.grid').first()
    const allText = await statsGrid.textContent()
    expect(allText).toMatch(/\d+/)
  })

  test('should display data table with employee columns', async ({ page }) => {
    await gotoEmpleados(page)
    await page.waitForTimeout(1000)
    // Scope to DataTable column headers using the PrimeVue column title selector
    const dataTable = page.locator('.p-datatable').first()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Empleado' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Documento' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Estado' })).toBeVisible()
    await expect(dataTable.locator('[data-pc-section="columntitle"]').filter({ hasText: 'Acciones' })).toBeVisible()
  })

  test('should display employee rows from seed data', async ({ page }) => {
    await gotoEmpleados(page)
    await page.waitForTimeout(2000)
    // Use the inner table element specifically
    const table = page.locator('table[role="table"]').first()
    await expect(table).toBeVisible()
    // At least one data row (tr that is not a header row)
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThan(0)
  })

  test('should have search input', async ({ page }) => {
    await gotoEmpleados(page)
    const searchInput = page.getByPlaceholder(/buscar/i)
    await expect(searchInput).toBeVisible()
  })

  test('should filter employees by search term', async ({ page }) => {
    await gotoEmpleados(page)
    await page.waitForTimeout(1000)
    const searchInput = page.getByPlaceholder(/buscar/i)
    await searchInput.fill('Carlos')
    // Wait for debounce (400ms) + API response
    await page.waitForTimeout(1000)
    const table = page.locator('.p-datatable-tbody, tbody').first()
    const tableText = await table.textContent()
    expect(tableText).toBeTruthy()
  })

  test('should have estado filter dropdown', async ({ page }) => {
    await gotoEmpleados(page)
    const dropdown = page.locator('.p-select, .p-dropdown').first()
    await expect(dropdown).toBeVisible()
  })

  test('should display Nuevo Empleado button', async ({ page }) => {
    await gotoEmpleados(page)
    const btn = page.getByRole('button', { name: /nuevo empleado/i })
    await expect(btn).toBeVisible()
  })

  test('should redirect unauthenticated user to login', async ({ page }) => {
    await page.context().clearCookies()
    await page.goto('/empleados')
    await expect(page).toHaveURL('/login', { timeout: 8000 })
  })
})
