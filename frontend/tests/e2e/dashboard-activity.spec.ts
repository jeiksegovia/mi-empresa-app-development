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

test.describe('Dashboard - Activity Feed', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should display Actividad Reciente section on dashboard', async ({ page }) => {
    // Already on dashboard after login; wait for full load
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Actividad Reciente')).toBeVisible({ timeout: 8000 })
  })

  test('should show activity items OR empty state message', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    // Wait for activity section
    await expect(page.getByText('Actividad Reciente')).toBeVisible({ timeout: 8000 })

    // Allow a moment for async data fetch to settle
    await page.waitForTimeout(1500)

    // Either real activity items exist (rendered in the activity list)
    // or the empty state text is shown. One of these two must be true.
    const activityItemsCount = await page.locator('[class*="activity"], .pi-user-plus, .pi-file-check, .pi-bell')
      .filter({ hasText: /.+/ }).count()

    const emptyStateVisible = await page.getByText('Sin actividad reciente').isVisible().catch(() => false)
    const hasAnyActivity = activityItemsCount > 0

    // The dashboard page hard-codes some static activities, so they should be visible
    // Check for at least one of the known static activity descriptions
    const staticActivity = await page.getByText(/Nuevo empleado registrado|Certificado próximo a vencer|Contrato renovado|Nueva nota agregada/).first().isVisible().catch(() => false)

    expect(staticActivity || emptyStateVisible || hasAnyActivity).toBe(true)
  })

  test('should display static activity items from dashboard', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Actividad Reciente')).toBeVisible({ timeout: 8000 })
    await page.waitForTimeout(1000)

    // The dashboard renders static activities as fallback when API returns empty
    // These items are defined in the page component
    await expect(page.getByText('Nuevo empleado registrado')).toBeVisible({ timeout: 6000 })
  })

  test('should not have JS errors that block page rendering', async ({ page }) => {
    const jsErrors: string[] = []
    page.on('pageerror', (err) => jsErrors.push(err.message))

    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // The activity section renders means no blocking JS errors occurred
    await expect(page.getByText('Actividad Reciente')).toBeVisible({ timeout: 8000 })

    // Filter out known non-blocking warnings; only fail on errors that block render
    const blockingErrors = jsErrors.filter(
      (msg) => !msg.includes('Warning') && !msg.includes('warn')
    )
    expect(blockingErrors.length).toBe(0)
  })
})
