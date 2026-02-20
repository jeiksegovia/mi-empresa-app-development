import { test, expect } from '@playwright/test'

// Helper: login and wait for dashboard
async function login(page: any) {
  await page.goto('/login')
  // Wait for Nuxt to fully hydrate the page before interacting
  await page.waitForLoadState('networkidle')

  // Target by id (PrimeVue InputText renders id on the native input)
  const emailInput = page.locator('#email')
  await emailInput.waitFor({ state: 'visible' })
  await emailInput.click()
  await emailInput.fill('admin@miempresa.com')

  // PrimeVue Password wraps input; target inner input by placeholder
  const passwordInput = page.locator('#password input')
  await passwordInput.waitFor({ state: 'visible' })
  await passwordInput.click()
  await passwordInput.fill('password123')

  // Verify values are set before submitting
  await expect(emailInput).toHaveValue('admin@miempresa.com')

  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

test.describe('Layout Components', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  // ─── TEST 1: Sidebar navigation items ────────────────────────────────────────
  test('should display sidebar with navigation items', async ({ page }) => {
    // sidebar is always in DOM; on desktop (1280px default) translate-x-0
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeAttached()

    // Scope nav links strictly inside the aside to avoid ambiguity with dashboard cards
    const nav = sidebar.locator('nav')
    await expect(nav.getByRole('link', { name: 'Inicio' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Empleados' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Pacientes' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Instrumentos' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Certificados' })).toBeVisible()
  })

  // ─── TEST 2: Header renders with app name and theme button ───────────────────
  test('should display header with user info', async ({ page }) => {
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // App name from appConfig.app.name
    await expect(header.getByText('Mi Empresa')).toBeVisible()

    // Theme button identified by aria-label (set on the Button component)
    const themeBtn = header.getByRole('button', { name: 'Toggle theme' })
    await expect(themeBtn).toBeVisible()

    // User full name shown in header (hidden on mobile, visible on md+)
    // We are at default 1280px viewport so it should be visible
    await expect(header.getByText('Admin Sistema')).toBeVisible()
  })

  // ─── TEST 3: Theme toggle switches dark class ─────────────────────────────────
  test('should toggle theme when clicking theme button', async ({ page }) => {
    const html = page.locator('html')
    const themeBtn = page.locator('header').getByRole('button', { name: 'Toggle theme' })

    const initialDark = await html.evaluate((el) => el.classList.contains('dark'))

    await themeBtn.click()

    // Wait for DOM update
    await page.waitForTimeout(300)

    const afterDark = await html.evaluate((el) => el.classList.contains('dark'))
    expect(afterDark).not.toBe(initialDark)

    // Toggle back to restore state
    await themeBtn.click()
    await page.waitForTimeout(300)
    const restoredDark = await html.evaluate((el) => el.classList.contains('dark'))
    expect(restoredDark).toBe(initialDark)
  })

  // ─── TEST 4: Sidebar links navigate correctly ─────────────────────────────────
  test('should navigate using sidebar links', async ({ page }) => {
    const nav = page.locator('aside nav')

    // Navigate to Empleados
    await nav.getByRole('link', { name: 'Empleados' }).click()
    await expect(page).toHaveURL('/empleados')

    // Navigate to Pacientes
    await nav.getByRole('link', { name: 'Pacientes' }).click()
    await expect(page).toHaveURL('/pacientes')

    // Navigate back to Inicio
    await nav.getByRole('link', { name: 'Inicio' }).click()
    await expect(page).toHaveURL('/')
  })

  // ─── TEST 5: Dashboard stats cards render ────────────────────────────────────
  test('should display stats cards on dashboard', async ({ page }) => {
    // Already on dashboard from beforeEach
    // AppStatsCard titles are inside the stats grid; scope to avoid nav link clash
    const statsGrid = page.locator('.grid').first()

    await expect(statsGrid.getByText('Empleados')).toBeVisible()
    await expect(statsGrid.getByText('Pacientes')).toBeVisible()
    await expect(statsGrid.getByText('Instrumentos')).toBeVisible()
    await expect(statsGrid.getByText('Certificados')).toBeVisible()
  })

  // ─── TEST 6: Mobile sidebar toggle ───────────────────────────────────────────
  test('should toggle sidebar on mobile', async ({ page }) => {
    // Switch to mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(300)

    const sidebar = page.locator('aside')

    // On mobile the sidebar has -translate-x-full, so it's off-screen.
    // Check the class rather than visibility (transform hides it visually but it's in DOM).
    const isHiddenInitially = await sidebar.evaluate((el) => {
      return el.classList.contains('-translate-x-full') ||
        getComputedStyle(el).transform.includes('matrix') &&
        getComputedStyle(el).transform !== 'matrix(1, 0, 0, 1, 0, 0)'
    })
    expect(isHiddenInitially).toBe(true)

    // Click the hamburger menu (aria-label set on Button in AppHeader)
    const menuToggle = page.locator('header').getByRole('button', { name: 'Toggle menu' })
    await expect(menuToggle).toBeVisible()
    await menuToggle.click()
    await page.waitForTimeout(300)

    // After click sidebar should have translate-x-0 (visible prop = true)
    const isVisibleAfterToggle = await sidebar.evaluate((el) => {
      return el.classList.contains('translate-x-0') &&
        !el.classList.contains('-translate-x-full')
    })
    expect(isVisibleAfterToggle).toBe(true)

    // Overlay appears; click the part NOT covered by the sidebar (sidebar is 280px wide,
    // viewport is 375px wide — click at x=330 which is in the overlay-only area)
    const overlay = page.locator('div.fixed.inset-0')
    await expect(overlay).toBeVisible()
    await overlay.click({ position: { x: 330, y: 333 }, force: true })
    await page.waitForTimeout(300)

    // Sidebar should be hidden again
    const isHiddenAfterClose = await sidebar.evaluate((el) => {
      return el.classList.contains('-translate-x-full') ||
        getComputedStyle(el).transform.includes('matrix') &&
        getComputedStyle(el).transform !== 'matrix(1, 0, 0, 1, 0, 0)'
    })
    expect(isHiddenAfterClose).toBe(true)
  })

  // ─── TEST 7: Logout from sidebar button ──────────────────────────────────────
  test('should logout when clicking logout button', async ({ page }) => {
    // Sidebar logout button identified by text
    const logoutBtn = page.locator('aside').getByRole('button', { name: /Cerrar Sesión/i })
    await expect(logoutBtn).toBeVisible()
    await logoutBtn.click()

    // Should redirect to login
    await expect(page).toHaveURL('/login', { timeout: 5000 })
  })
})
