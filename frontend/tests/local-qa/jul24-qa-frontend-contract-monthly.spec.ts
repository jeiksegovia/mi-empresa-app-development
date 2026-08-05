/**
 * LOCAL QA — qa-session-jul-24 (R7) frontend contract form salary toggle.
 *
 * Validates:
 *  - OPS contratos show "Valor media jornada (4h)" and hide valorMensual.
 *  - OBRA_O_LABOR / TERMINO_FIJO / TERMINO_INDEFINIDO show "Valor
 *    mensual" and hide valorJornada.
 *  - On save, only the matching salary field is sent in the payload.
 *
 * Mocks the auth + employee + nomina endpoints so the run is
 * deterministic and does not require backend wiring.
 *
 * Run:
 *   cd frontend && npx playwright test tests/local-qa/jul24-qa-frontend-contract-monthly.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ADMIN = {
  id: 1,
  email: 'admin@miempresa.com',
  nombre: 'Admin',
  apellido: 'QA',
  rol: 'ADMIN',
  tipoEmpleado: null,
  activo: true,
}

const EMP = {
  id: 200,
  nombre: 'CONTRATO',
  apellido: 'TEST',
  tipoDocumento: 'CC',
  numeroDocumento: '555555',
  genero: 'MASCULINO',
  fechaNacimiento: '1990-01-01',
  estadoCivil: null,
  tipoVivienda: null,
  estratoSocioeconomico: null,
  direccion: null,
  telefono: null,
  email: null,
  permisoTrabajo: false,
  estado: 'ACTIVO',
  documentoIdentificacionUrl: null,
  medioPagoTipo: null,
  medioPagoNequi: null,
  bancoNombre: null,
  bancoTipoCuenta: null,
  bancoNumeroCuenta: null,
  nucleoFamiliar: [],
  cargos: [],
  contactosEmergencia: [],
  experienciasLaborales: [],
  educacionIdiomas: [],
  educacionEmpleado: [],
  vehiculos: [],
  certificados: [],
  datosMigracion: null,
  hojaVidaUrl: null,
}

async function mockAuth(page: Page) {
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
      body: JSON.stringify({ success: true, user: ADMIN }),
    }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: ADMIN }),
    }),
  )
}

async function mockEmployeeEndpoints(page: Page) {
  await page.route(`**/api/v1/employees/${EMP.id}`, async (route) => {
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
  await page.route(`**/api/v1/employees/${EMP.id}/educacion**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route(`**/api/v1/nomina/employees/${EMP.id}/contratos**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/empresa/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
}

async function gotoContratoTab(page: Page) {
  await page.goto(`${FRONTEND}/empleados/${EMP.id}/editar`)
  await page.waitForLoadState('networkidle')
  // Open the Contrato laboral tab.
  const tabBtn = page.getByRole('tab', { name: /Contrato/i }).first()
  if (await tabBtn.count()) {
    await tabBtn.click({ timeout: 5000 }).catch(() => {})
  } else {
    await page.getByText(/Contrato laboral/i).first().click({ timeout: 5000 }).catch(() => {})
  }
  const addBtn = page.getByTestId('contrato-add-btn')
  await expect(addBtn).toBeVisible({ timeout: 10000 })
  await addBtn.click()
  await expect(page.getByTestId('contrato-tipo')).toBeVisible({ timeout: 5000 })
}

async function pickTipo(page: Page, label: string) {
  await page.getByTestId('contrato-tipo').click()
  await page.getByRole('option', { name: new RegExp(label, 'i') }).click()
}

test.describe('qa-session-jul-24 — Contrato salary toggle (MOCKED)', () => {
  test('OPS shows valorJornada and hides valorMensual', async ({ page }) => {
    await mockAuth(page)
    await mockEmployeeEndpoints(page)
    await gotoContratoTab(page)
    await pickTipo(page, 'OPS')
    await expect(page.getByTestId('contrato-valor-jornada')).toBeVisible()
    await expect(page.getByTestId('contrato-valor-mensual')).toHaveCount(0)
  })

  test('OBRA_O_LABOR shows valorMensual and hides valorJornada', async ({ page }) => {
    await mockAuth(page)
    await mockEmployeeEndpoints(page)
    await gotoContratoTab(page)
    await pickTipo(page, 'Obra o labor')
    await expect(page.getByTestId('contrato-valor-mensual')).toBeVisible()
    await expect(page.getByTestId('contrato-valor-jornada')).toHaveCount(0)
  })

  test('TERMINO_FIJO shows valorMensual and hides valorJornada', async ({ page }) => {
    await mockAuth(page)
    await mockEmployeeEndpoints(page)
    await gotoContratoTab(page)
    await pickTipo(page, 'Término fijo')
    await expect(page.getByTestId('contrato-valor-mensual')).toBeVisible()
    await expect(page.getByTestId('contrato-valor-jornada')).toHaveCount(0)
  })

  test('TERMINO_INDEFINIDO shows valorMensual and hides valorJornada', async ({ page }) => {
    await mockAuth(page)
    await mockEmployeeEndpoints(page)
    await gotoContratoTab(page)
    await pickTipo(page, 'Término indefinido')
    await expect(page.getByTestId('contrato-valor-mensual')).toBeVisible()
    await expect(page.getByTestId('contrato-valor-jornada')).toHaveCount(0)
  })

  test('Saving an OBRA_O_LABOR contrato sends valorMensual (and clears valorJornada)', async ({ page }) => {
    await mockAuth(page)
    await mockEmployeeEndpoints(page)
    await gotoContratoTab(page)
    await pickTipo(page, 'Obra o labor')

    // OBRA_O_LABOR requires a fecha fin (only TERMINO_INDEFINIDO may omit it);
    // saveContrato() short-circuits with a "Fecha fin requerida" toast and fires
    // NO request when it is blank. fechaInicio defaults to today in the form.
    await page.getByTestId('contrato-fecha-fin').fill('2027-12-31')

    // Fill valorMensual (the InputNumber renders a child <input>).
    const valorMensual = page.getByTestId('contrato-valor-mensual').locator('input')
    await valorMensual.fill('2500000')

    let postBody: any = null
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/nomina\/employees\/\d+\/contratos$/.test(req.url())) {
        postBody = req.postDataJSON()
      }
    })

    await page.getByTestId('contrato-save').click()

    await expect.poll(() => postBody != null, { timeout: 8000 }).toBeTruthy()
    expect(postBody.tipoContrato).toBe('OBRA_O_LABOR')
    expect(postBody.valorMensual).toBe(2500000)
    // The contract spec says "OPPOSITE field as null" so a switched tipo
    // doesn't leave a stale column.
    expect(postBody.valorJornada).toBeNull()
  })
})