/**
 * medio-pago.spec.ts — Empleado create/edit medio de pago UI smoke
 * (nomina-asistencia-jul-18).
 *
 * MOCKED session + employee endpoints. Verifies:
 *  - Create wizard step 1 shows Medio de pago section
 *  - Nequi reveals número field; Transferencia reveals banco fields
 *  - Edit page hydrates and posts medio fields on save
 *
 * Run:
 *   TEST_FRONTEND_URL=http://localhost:3100 \
 *     npx playwright test tests/empleados/medio-pago.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const EMP = {
  id: 42,
  nombre: 'CARLOS',
  apellido: 'RUIZ',
  tipoDocumento: 'CC',
  numeroDocumento: '998877',
  genero: 'MASCULINO',
  fechaNacimiento: '1990-05-01',
  estadoCivil: null,
  tipoVivienda: null,
  estratoSocioeconomico: null,
  direccion: null,
  telefono: null,
  email: null,
  permisoTrabajo: false,
  estado: 'ACTIVO',
  documentoIdentificacionUrl: null,
  medioPagoTipo: 'NEQUI',
  medioPagoNequi: '3001234567',
  bancoNombre: null,
  bancoTipoCuenta: null,
  bancoNumeroCuenta: null,
  nucleoFamiliar: [],
  cargos: [],
  contactosEmergencia: [],
  experienciasLaborales: [],
  educacionIdiomas: [],
  vehiculos: [],
  certificados: [],
  datosMigracion: null,
  hojaVidaUrl: null,
}

async function mockAdmin(page: Page) {
  const user = {
    id: 1,
    email: 'admin@miempresa.com',
    nombre: 'Admin',
    apellido: 'QA',
    rol: 'ADMIN',
    tipoEmpleado: null,
    activo: true,
  }
  // Catch-all first (Playwright last-registered wins for specifics below).
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await page.route('**/api/v1/empresa**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/employees/42/educacion**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/nomina/employees/42/contratos**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/employees/42', async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: EMP }),
      })
      return
    }
    if (method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: EMP }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: EMP }),
    })
  })
}

test.describe('Medio de pago UI — MOCKED', () => {
  test('create wizard: section + Nequi / Transferencia conditional fields', async ({ page }) => {
    await mockAdmin(page)
    await page.goto(`${FRONTEND}/empleados/nuevo`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('medio-pago-tipo')).toBeVisible()

    // Default Sin definir → no Nequi / bank fields
    await expect(page.getByTestId('medio-pago-nequi')).toHaveCount(0)
    await expect(page.getByTestId('medio-pago-banco')).toHaveCount(0)

    // Select Nequi via the Select overlay
    await page.getByTestId('medio-pago-tipo').click()
    await page.getByRole('option', { name: 'Nequi' }).click()
    await expect(page.getByTestId('medio-pago-nequi')).toBeVisible()
    await expect(page.getByTestId('medio-pago-banco')).toHaveCount(0)

    // Switch to Transferencia
    await page.getByTestId('medio-pago-tipo').click()
    await page.getByRole('option', { name: 'Transferencia bancaria' }).click()
    await expect(page.getByTestId('medio-pago-nequi')).toHaveCount(0)
    await expect(page.getByTestId('medio-pago-banco')).toBeVisible()
    await expect(page.getByTestId('medio-pago-tipo-cuenta')).toBeVisible()
    await expect(page.getByTestId('medio-pago-numero-cuenta')).toBeVisible()
  })

  test('edit page: hydrates Nequi and sends medio on save', async ({ page }) => {
    await mockAdmin(page)
    let putBody: any = null
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/employees\/42(?:\?|$)/.test(req.url())) {
        putBody = req.postDataJSON()
      }
    })

    await page.goto(`${FRONTEND}/empleados/42/editar`)
    // Wait for form to load (spinner gone → section visible)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 20000 })
    // Hydrated Nequi number
    await expect(page.getByTestId('medio-pago-nequi')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('medio-pago-nequi')).toHaveValue('3001234567')

    await page.getByTestId('medio-pago-nequi').fill('3009998877')
    await page.getByRole('button', { name: /Guardar Datos Personales/i }).click()

    await expect.poll(() => putBody != null, { timeout: 8000 }).toBeTruthy()
    expect(putBody.medioPagoTipo).toBe('NEQUI')
    expect(putBody.medioPagoNequi).toBe('3009998877')
  })
})
