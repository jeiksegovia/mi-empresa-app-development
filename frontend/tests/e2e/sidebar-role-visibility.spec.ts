import { test, expect } from '@playwright/test'

test.describe('Sidebar Role-Based Visibility', () => {
  test('should show Empresa menu item for admin user', async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'admin@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3000/')

    // Check if Empresa menu item is visible in sidebar
    const empresaLink = page.locator('aside nav a[href="/empresa"]')
    await expect(empresaLink).toBeVisible()

    console.log('✅ Admin user can see Empresa menu item')
  })

  test('should NOT show Empresa menu item for empleado user', async ({ page }) => {
    // Login as empleado
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'empleado@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3000/')

    // Check if Empresa menu item is NOT visible in sidebar
    const empresaLink = page.locator('aside nav a[href="/empresa"]')
    await expect(empresaLink).not.toBeVisible()

    console.log('✅ Empleado user cannot see Empresa menu item')
  })

  test('should NOT show Empresa menu item for auditor user', async ({ page }) => {
    // Login as auditor
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'auditor@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3000/')

    // Check if Empresa menu item is NOT visible in sidebar
    const empresaLink = page.locator('aside nav a[href="/empresa"]')
    await expect(empresaLink).not.toBeVisible()

    console.log('✅ Auditor user cannot see Empresa menu item')
  })

  test('should NOT show Empresa menu item for operador user', async ({ page }) => {
    // Login as operador
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'operador@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3000/')

    // Check if Empresa menu item is NOT visible in sidebar
    const empresaLink = page.locator('aside nav a[href="/empresa"]')
    await expect(empresaLink).not.toBeVisible()

    console.log('✅ Operador user cannot see Empresa menu item')
  })

  test('should show all other menu items for empleado user', async ({ page }) => {
    // Login as empleado
    await page.goto('http://localhost:3000/login')
    await page.fill('input[type="email"]', 'empleado@miempresa.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('http://localhost:3000/')

    // Check that other menu items ARE visible
    const dashboardLink = page.locator('aside nav a[href="/"]')
    await expect(dashboardLink).toBeVisible()

    const empleadosLink = page.locator('aside nav a[href="/empleados"]')
    await expect(empleadosLink).toBeVisible()

    const pacientesLink = page.locator('aside nav a[href="/pacientes"]')
    await expect(pacientesLink).toBeVisible()

    const instrumentosLink = page.locator('aside nav a[href="/instrumentos"]')
    await expect(instrumentosLink).toBeVisible()

    console.log('✅ Empleado user can see all other menu items')
  })
})
