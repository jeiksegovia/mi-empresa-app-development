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

/**
 * Navigate to the first certificate detail page by clicking the eye icon on the first row.
 * Returns false if no certificates found (list is empty).
 */
async function goToFirstDetail(page: any): Promise<boolean> {
  await goToCertificados(page)

  // Wait a moment for the table to render data
  await page.waitForTimeout(1000)

  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()

  if (rowCount === 0) {
    return false
  }

  // The first row's "Ver detalle" button uses pi-eye icon
  const eyeBtn = rows.first().locator('button .pi-eye').first()
  const eyeBtnCount = await eyeBtn.count()

  if (eyeBtnCount === 0) {
    // Fallback: click the first eye icon on the page
    const firstEye = page.locator('.pi-eye').first()
    const firstEyeCount = await firstEye.count()
    if (firstEyeCount === 0) return false
    await firstEye.click()
  } else {
    await eyeBtn.click()
  }

  await page.waitForURL(/\/certificados\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  // Wait for spinner to disappear
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
  return true
}

test.describe('Certificado - Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate from list to certificate detail page', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list — skipping detail page tests')
      return
    }
    expect(page.url()).toMatch(/\/certificados\/\d+/)
  })

  test('should display certificate name and subtitle', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    // AppPageHeader renders title + subtitle
    await expect(page.getByText('Detalle del certificado')).toBeVisible()
  })

  test('should display Estado tag badge on detail page', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    // Tag component renders the estado value (VIGENTE / VENCIDO / PENDIENTE)
    const tag = page.locator('.p-tag').first()
    await expect(tag).toBeVisible()
    const tagText = await tag.textContent()
    expect(['VIGENTE', 'VENCIDO', 'PENDIENTE']).toContain(tagText?.trim())
  })

  test('should display Tipo field in details card', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    // Details card has a "Tipo" label
    await expect(page.getByText('Tipo')).toBeVisible()
  })

  test('should display date fields in details card', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    await expect(page.getByText('Fecha de Emisión')).toBeVisible()
    await expect(page.getByText('Fecha de Vencimiento')).toBeVisible()
  })

  test('admin should see Editar button', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    await expect(page.getByRole('button', { name: /editar/i })).toBeVisible()
  })

  test('should display Volver button that navigates back to /certificados', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    const volverBtn = page.getByRole('button', { name: /volver/i })
    await expect(volverBtn).toBeVisible()
    await volverBtn.click()
    await expect(page).toHaveURL('/certificados', { timeout: 8000 })
  })

  test('admin can enter edit mode and see Guardar cambios button', async ({ page }) => {
    const hasData = await goToFirstDetail(page)
    if (!hasData) {
      test.skip(true, 'No certificates found in the list')
      return
    }
    await page.getByRole('button', { name: /editar/i }).click()
    await page.waitForTimeout(300)
    // Edit mode shows "Editar Certificado" form header
    await expect(page.getByText('Editar Certificado')).toBeVisible()
    await expect(page.getByRole('button', { name: /guardar cambios/i })).toBeVisible()
  })
})
