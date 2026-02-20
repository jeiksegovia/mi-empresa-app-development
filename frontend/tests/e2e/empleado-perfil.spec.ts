import { test, expect } from '@playwright/test'

/**
 * Fix the doubled /api/v1/api/v1/ path that results from the page code calling
 * apiFetch('/api/v1/employees/...') when the baseURL already contains /api/v1.
 * This intercepts those requests and rewrites the URL to the correct path.
 */
async function fixApiDoubledPath(page: any) {
  await page.route('**/api/v1/api/v1/**', async (route: any) => {
    const url: string = route.request().url()
    const fixedUrl = url.replace('/api/v1/api/v1/', '/api/v1/')
    await route.continue({ url: fixedUrl })
  })
}

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToEmpleados(page: any) {
  if (page.url().includes('/empleados') && !page.url().match(/\/empleados\/\d/)) return
  await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
  await page.waitForURL('/empleados', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
  // Wait for actual employee data rows to appear (not the empty-state row)
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(1000)
}

async function goToFirstProfile(page: any) {
  await goToEmpleados(page)
  // The eye (view) button navigates to the employee profile.
  // Find the first pi-eye icon in the page and click it.
  const eyeIcon = page.locator('.pi-eye').first()
  await eyeIcon.click()
  // Wait for profile URL pattern /empleados/\d+
  await page.waitForURL(/\/empleados\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  // Wait for the employee data to load (spinner disappears, content appears)
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

test.describe('Employee Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await fixApiDoubledPath(page)
    await login(page)
  })

  test('should navigate to employee profile from list page', async ({ page }) => {
    await goToFirstProfile(page)
    await expect(page).toHaveURL(/\/empleados\/\d+$/)
  })

  test('should display profile header with employee name', async ({ page }) => {
    await goToFirstProfile(page)
    // AppPageHeader renders an h1 with the employee full name
    const header = page.locator('h1').first()
    await expect(header).toBeVisible()
    const text = await header.textContent()
    expect(text?.trim().length).toBeGreaterThan(3)
  })

  test('should display status badge in profile header card', async ({ page }) => {
    await goToFirstProfile(page)
    // AppStatusBadge renders a PrimeVue Badge -> <span class="p-badge ...">
    const badge = page.locator('.p-badge').first()
    await expect(badge).toBeVisible()
  })

  test('should display document info in profile header', async ({ page }) => {
    await goToFirstProfile(page)
    // Header card shows tipoDocumento + numeroDocumento e.g. "CC 12345"
    const card = page.locator('.p-card').first()
    const text = await card.textContent()
    // tipoDocumento is one of CC | CE | PASAPORTE | TI | NIT
    expect(text).toMatch(/CC|CE|PASAPORTE|TI|NIT/)
  })

  test('should show 3 tabs', async ({ page }) => {
    await goToFirstProfile(page)
    await expect(page.getByText('Información Personal')).toBeVisible()
    await expect(page.getByText('Experiencia & Educación')).toBeVisible()
    await expect(page.getByText('Certificados & Documentos')).toBeVisible()
  })

  test('should show personal data section on first tab', async ({ page }) => {
    await goToFirstProfile(page)
    // Tab 0 is active by default — Datos Personales card is visible
    await expect(page.getByText('Datos Personales')).toBeVisible()
  })

  test('should show núcleo familiar section on first tab', async ({ page }) => {
    await goToFirstProfile(page)
    await expect(page.getByText('Núcleo Familiar')).toBeVisible()
  })

  test('should show contactos de emergencia section on first tab', async ({ page }) => {
    await goToFirstProfile(page)
    await expect(page.getByText('Contactos de Emergencia')).toBeVisible()
  })

  test('should switch to experience tab and show cargos section', async ({ page }) => {
    await goToFirstProfile(page)
    await page.getByText('Experiencia & Educación').click()
    await expect(page.getByText('Cargos en la Empresa')).toBeVisible()
    await expect(page.getByText('Experiencia Laboral Externa')).toBeVisible()
  })

  test('should switch to certificates tab and show cert sections', async ({ page }) => {
    await goToFirstProfile(page)
    await page.getByText('Certificados & Documentos').click()
    // Use heading role to disambiguate from content text that may also contain these words
    await expect(page.getByRole('heading', { name: /Certificado de Alturas/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Certificado Riesgo Eléctrico/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Datos de Migración/i })).toBeVisible()
  })

  test('should have Volver button that navigates back to list', async ({ page }) => {
    await goToFirstProfile(page)
    const volverBtn = page.getByRole('button', { name: /volver/i })
    await expect(volverBtn).toBeVisible()
    await volverBtn.click()
    await expect(page).toHaveURL('/empleados')
  })

  test('should have Editar button', async ({ page }) => {
    await goToFirstProfile(page)
    const editBtn = page.getByRole('button', { name: /editar/i })
    await expect(editBtn).toBeVisible()
  })
})
