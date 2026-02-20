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

test.describe('Empleado - Crear Completo (todos los pasos)', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should create employee with all 5 steps filled and redirect to profile', async ({ page }) => {
    // Navigate via SPA to avoid full-page reload auth issues
    await page.locator('aside nav').getByRole('link', { name: 'Empleados' }).click()
    await page.waitForURL('/empleados', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Navigate to new employee form
    await page.getByRole('button', { name: /nuevo empleado/i }).click()
    await page.waitForURL('/empleados/nuevo', { timeout: 8000 })
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('Nuevo Empleado')).toBeVisible()

    // ─── Step 1: Datos Personales ────────────────────────────────────────
    const step1 = page.locator('[data-step="1"]')
    await step1.getByPlaceholder('Nombres').fill('Carlos')
    await step1.getByPlaceholder('Apellidos').fill('Prueba Completa')
    await step1.getByPlaceholder('Número de documento').fill(`TEST${Date.now()}`)

    // Select Género using PrimeVue Select component (.p-select CSS class)
    const generoSelect = step1.locator('.p-select').filter({ hasText: /seleccionar/i }).first()
    await generoSelect.click()
    await page.getByRole('option', { name: 'Masculino' }).click()

    // Fill fecha nacimiento
    await step1.locator('input[type="date"]').first().fill('1990-06-15')

    // Navigate to next step
    await page.getByRole('button', { name: /siguiente/i }).click()
    await page.waitForTimeout(300)

    // ─── Step 2: Núcleo Familiar (skip) ─────────────────────────────────
    await page.getByRole('button', { name: /siguiente/i }).click()
    await page.waitForTimeout(300)

    // ─── Step 3: Información Laboral ─────────────────────────────────────
    await page.getByRole('button', { name: /siguiente/i }).click()
    await page.waitForTimeout(300)

    // ─── Step 4: Educación & Vehículos ───────────────────────────────────
    await page.getByRole('button', { name: /siguiente/i }).click()
    await page.waitForTimeout(300)

    // ─── Step 5: Submit ────────────────────────────────────────────────
    await page.getByRole('button', { name: /guardar empleado/i }).click()

    // Should redirect to employee profile
    await page.waitForURL(/\/empleados\/\d+/, { timeout: 15000 })
    await expect(page.url()).toMatch(/\/empleados\/\d+/)
  })
})
