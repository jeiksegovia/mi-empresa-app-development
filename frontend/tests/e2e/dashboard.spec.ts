import { test, expect } from '@playwright/test'

async function login(page: any) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill('admin@miempresa.com')
  await page.locator('#password input').fill('password123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/', { timeout: 15000 })
}

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies()
    await login(page)
  })

  test('should display welcome title', async ({ page }) => {
    await expect(page.locator('h2').filter({ hasText: 'Bienvenido a Mi Empresa App' })).toBeVisible()
  })

  test('should display 4 module cards', async ({ page }) => {
    const grid = page.locator('.grid').first()
    await expect(grid.getByText('Certificación Empresarial')).toBeVisible()
    await expect(grid.getByText('Gestión de Personal')).toBeVisible()
    await expect(grid.getByText('Gestión de Clientes')).toBeVisible()
    await expect(grid.getByText('Nómina y Finanzas')).toBeVisible()
  })

  test('should display Ir al modulo links in each card', async ({ page }) => {
    const links = page.getByText('Ir al módulo')
    await expect(links).toHaveCount(4)
  })

  test('should navigate to empleados when clicking Gestion de Personal card', async ({ page }) => {
    await page.getByText('Gestión de Personal').click()
    await expect(page).toHaveURL('/empleados')
  })

  test('should navigate to pacientes when clicking Gestion de Clientes card', async ({ page }) => {
    await page.getByText('Gestión de Clientes').click()
    await expect(page).toHaveURL('/pacientes')
  })

  test('should display recent activity section', async ({ page }) => {
    await expect(page.getByText('Actividad Reciente')).toBeVisible()
    await expect(page.getByText('Nuevo empleado registrado')).toBeVisible()
    await expect(page.getByText('Certificado próximo a vencer')).toBeVisible()
    await expect(page.getByText('Contrato renovado exitosamente')).toBeVisible()
    await expect(page.getByText('Nueva nota agregada a cliente')).toBeVisible()
  })
})
