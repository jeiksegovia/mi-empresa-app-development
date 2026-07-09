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

async function goToCertificados(page: any) {
  await page.locator('aside nav').getByRole('link', { name: 'Certificados' }).click()
  await page.waitForURL('/certificados', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Certificados - List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to certificados page and show page title', async ({ page }) => {
    await goToCertificados(page)
    await expect(page.getByText('Certificados de empresa')).toBeVisible({ timeout: 8000 })
  })

  test('should display stats cards with certificate counts', async ({ page }) => {
    await goToCertificados(page)
    // AppStatsCard renders titles: Vigentes, Vencidos, Pendientes, Total
    await expect(page.getByText('Vigentes')).toBeVisible()
    await expect(page.getByText('Vencidos')).toBeVisible()
    await expect(page.getByText('Pendientes')).toBeVisible()
    await expect(page.getByText('Total')).toBeVisible()
  })

  test('should display DataTable', async ({ page }) => {
    await goToCertificados(page)
    // DataTable renders a <table> element
    const table = page.locator('table').first()
    await expect(table).toBeVisible({ timeout: 8000 })
  })

  test('should display Tipo filter dropdown', async ({ page }) => {
    await goToCertificados(page)
    // PrimeVue Select renders with placeholder "Tipo"
    const tipoFilter = page.getByRole('combobox').filter({ hasText: /tipo/i })
    // Alternatively check by placeholder text content in the Select
    const tipoSelect = page.locator('.p-select').filter({ hasText: /tipo/i })
    const found = (await tipoFilter.count()) > 0 || (await tipoSelect.count()) > 0
    expect(found).toBe(true)
  })

  test('should display Estado filter dropdown', async ({ page }) => {
    await goToCertificados(page)
    const estadoSelect = page.locator('.p-select').filter({ hasText: /estado/i })
    await expect(estadoSelect.first()).toBeVisible()
  })

  test('admin should see Nuevo Certificado button', async ({ page }) => {
    await goToCertificados(page)
    await expect(page.getByRole('button', { name: /nuevo certificado/i })).toBeVisible()
  })

  test('should display table headers', async ({ page }) => {
    await goToCertificados(page)
    await expect(page.getByText('Nombre')).toBeVisible()
    await expect(page.getByText('Tipo')).toBeVisible()
    await expect(page.getByText('Estado')).toBeVisible()
  })
})
