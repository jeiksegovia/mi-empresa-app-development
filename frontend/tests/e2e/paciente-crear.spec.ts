import { test, expect } from '@playwright/test'

test.describe('Paciente - Crear', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'admin@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    await page.waitForURL('http://localhost:3000/')
  })

  test('should navigate to crear page from list', async ({ page }) => {
    // Go to pacientes list
    await page.goto('http://localhost:3000/pacientes')

    // Click "Nuevo Paciente" button
    await page.click('button:has-text("Nuevo Paciente")')

    // Should navigate to crear page
    await page.waitForURL('http://localhost:3000/pacientes/crear')
    await expect(page.locator('h1:has-text("Nuevo Paciente")')).toBeVisible()

    console.log('✅ Navigation to crear page works')
  })

  test('should display form with required fields', async ({ page }) => {
    await page.goto('http://localhost:3000/pacientes/crear')

    // Check required fields are present
    await expect(page.locator('input[placeholder="Nombre completo"]')).toBeVisible()
    await expect(page.locator('input[placeholder="123456789"]')).toBeVisible()
    await expect(page.locator('input[type="date"]')).toBeVisible()
    await expect(page.locator('input[placeholder*="Masculino"]')).toBeVisible()

    console.log('✅ Form fields are visible')
  })

  test('should show validation errors for empty required fields', async ({ page }) => {
    await page.goto('http://localhost:3000/pacientes/crear')

    // Try to submit without filling required fields
    await page.click('button:has-text("Guardar")')

    // Should show error toast
    await expect(page.locator('.p-toast-message-error')).toBeVisible()

    console.log('✅ Validation errors shown')
  })

  test('should create patient with required fields only', async ({ page }) => {
    await page.goto('http://localhost:3000/pacientes/crear')

    // Fill required fields
    await page.fill('input[placeholder="Nombre completo"]', 'Test Paciente E2E')
    await page.fill('input[placeholder="123456789"]', '9999888877')
    await page.fill('input[type="date"]', '1990-05-15')
    await page.fill('input[placeholder*="Masculino"]', 'Masculino')

    // Submit
    await page.click('button:has-text("Guardar")')

    // Should show success toast
    await expect(page.locator('.p-toast-message-success')).toBeVisible({ timeout: 10000 })

    // Should navigate to detail page
    await expect(page.url()).toContain('/pacientes/')
    await expect(page.locator('h1:has-text("Test Paciente E2E")')).toBeVisible()

    console.log('✅ Patient created successfully')
  })

  test('should create patient with all fields including emergency contact', async ({ page }) => {
    await page.goto('http://localhost:3000/pacientes/crear')

    // Fill required fields
    await page.fill('input[placeholder="Nombre completo"]', 'Test Completo E2E')
    await page.fill('input[placeholder="123456789"]', '8888777766')
    await page.fill('input[type="date"]', '1985-03-20')
    await page.fill('input[placeholder*="Masculino"]', 'Femenino')

    // Fill optional fields
    await page.fill('input[placeholder="+57 300 123 4567"]', '+57 310 555 1234')
    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[placeholder="Calle 123 # 45-67"]', 'Calle 10 # 20-30')

    // Add emergency contact
    await page.click('button:has-text("Agregar")')
    await page.fill('input[placeholder="Nombre completo"]', 'Contacto Emergencia')
    await page.fill('input[placeholder="+57 300 123 4567"]', '+57 320 999 8888')
    await page.fill('input[placeholder="Padre, Madre, etc."]', 'Hermano')

    // Submit
    await page.click('button:has-text("Guardar")')

    // Should show success toast
    await expect(page.locator('.p-toast-message-success')).toBeVisible({ timeout: 10000 })

    // Should navigate to detail page
    await expect(page.url()).toContain('/pacientes/')
    await expect(page.locator('h1:has-text("Test Completo E2E")')).toBeVisible()

    console.log('✅ Patient with all fields created successfully')
  })

  test('should cancel and return to list', async ({ page }) => {
    await page.goto('http://localhost:3000/pacientes/crear')

    // Click cancel button
    await page.click('button:has-text("Cancelar")')

    // Should navigate back to list
    await page.waitForURL('http://localhost:3000/pacientes')
    await expect(page.locator('h1:has-text("Pacientes")')).toBeVisible()

    console.log('✅ Cancel navigation works')
  })
})
