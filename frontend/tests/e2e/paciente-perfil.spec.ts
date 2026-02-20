import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

async function goToPacientes(page: any) {
  if (page.url().includes('/pacientes')) return
  await page.locator('aside nav').getByRole('link', { name: 'Pacientes' }).click()
  await page.waitForURL('/pacientes', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

async function goToFirstPatientProfile(page: any) {
  await goToPacientes(page)
  await page.locator('tbody tr').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.pi-eye').first().click()
  await page.waitForURL(/\/pacientes\/\d+$/, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  // Wait for spinner to disappear
  await page.locator('.pi-spin').waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(500)
}

test.describe('Patient Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should navigate to patient profile from list', async ({ page }) => {
    await goToFirstPatientProfile(page)
    expect(page.url()).toMatch(/\/pacientes\/\d+/)
  })

  test('should display profile header with patient name', async ({ page }) => {
    await goToFirstPatientProfile(page)
    const header = page.locator('h1, h2').first()
    await expect(header).toBeVisible()
    const headerText = await header.textContent()
    expect(headerText).toBeTruthy()
  })

  test('should display status badge', async ({ page }) => {
    await goToFirstPatientProfile(page)
    const badge = page.locator('.p-badge, [class*="badge"]').first()
    await expect(badge).toBeVisible()
  })

  test('should show 3 tabs', async ({ page }) => {
    await goToFirstPatientProfile(page)
    const tabs = page.locator('button').filter({ has: page.locator('.pi-user, .pi-file-check, .pi-book') })
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(3)
  })

  test('should show Información Básica tab by default', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await expect(page.getByText('Información Básica')).toBeVisible()
    await expect(page.getByText('Datos Personales')).toBeVisible()
  })

  test('should show personal data section on first tab', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await expect(page.getByText('Datos Personales')).toBeVisible()
    await expect(page.getByText('Tipo de Documento')).toBeVisible()
  })

  test('should show emergency contacts section', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await expect(page.getByText('Contactos de Emergencia')).toBeVisible()
  })

  test('should switch to Fichas & Evaluaciones tab', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await page.getByText('Fichas & Evaluaciones').click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Historial de Fichas')).toBeVisible()
  })

  test('should switch to Notas tab', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await page.getByRole('button', { name: /notas/i }).click()
    await page.waitForTimeout(500)
    await expect(page.getByText('Notas del Cliente')).toBeVisible()
  })

  test('should show avatar with initials', async ({ page }) => {
    await goToFirstPatientProfile(page)
    const avatar = page.locator('[class*="p-avatar"]').first()
    await expect(avatar).toBeVisible()
  })

  test('should display action buttons in header', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await expect(page.getByRole('button', { name: /volver/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /editar/i })).toBeVisible()
  })

  test('should navigate back to list when clicking Volver button', async ({ page }) => {
    await goToFirstPatientProfile(page)
    await page.getByRole('button', { name: /volver/i }).click()
    await expect(page).toHaveURL('/pacientes', { timeout: 5000 })
  })

  test('should show contact chips in profile header', async ({ page }) => {
    await goToFirstPatientProfile(page)
    const profileCard = page.locator('.p-card').first()
    await expect(profileCard.locator('.pi-id-card')).toBeVisible()
  })
})
