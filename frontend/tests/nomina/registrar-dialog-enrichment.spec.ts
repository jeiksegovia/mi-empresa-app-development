/**
 * registrar-dialog-enrichment.spec.ts — Nómina Registrar dialog (Task 10)
 * nomina-asistencia-jul-18 / W2c-nomina-dialog
 *
 * MOCKED session + GET /nomina. Verifies dialog shows:
 *  - name, documento, medio (or warning), contract + valor, asistenciaMes
 *  - editable medias / valor / total (testids from assignment)
 *  - aportes only for FIJO/INDEFINIDO
 *  - existing file slots still present
 *  - Guardar button data-testid=nomina-guardar
 *
 * Run:
 *   TEST_FRONTEND_URL=http://localhost:3100 \
 *     npx playwright test tests/nomina/registrar-dialog-enrichment.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ROWS = [
  {
    empleado: {
      id: 3,
      nombre: 'ANA',
      apellido: 'PEREZ',
      numeroDocumento: '1001',
      medioPagoTipo: 'NEQUI',
      medioPagoNequi: '3001112233',
      bancoNombre: null,
      bancoTipoCuenta: null,
      bancoNumeroCuenta: null,
    },
    contratoActivo: {
      id: 1,
      tipoContrato: 'TERMINO_FIJO',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      archivoUrl: null,
      activo: true,
      valorJornada: 50000,
    },
    entrada: null,
    cargoSalario: null,
    asistenciaMes: { mediasJornadas: 12, horas: 48 },
    sugerido: {
      mediasJornadas: 12,
      valorJornada: 50000,
      subtotalCalculado: 600000,
      aportesSociales: 0,
      totalPagado: 600000,
    },
  },
  {
    empleado: {
      id: 9,
      nombre: 'PEDRO',
      apellido: 'LOPEZ',
      numeroDocumento: '3003',
      medioPagoTipo: null,
      medioPagoNequi: null,
      bancoNombre: null,
      bancoTipoCuenta: null,
      bancoNumeroCuenta: null,
    },
    contratoActivo: {
      id: 2,
      tipoContrato: 'OPS',
      fechaInicio: '2026-01-01',
      fechaFin: '2026-12-31',
      archivoUrl: null,
      activo: true,
      valorJornada: 40000,
    },
    entrada: null,
    cargoSalario: null,
    asistenciaMes: { mediasJornadas: 8, horas: 32 },
    sugerido: {
      mediasJornadas: 8,
      valorJornada: 40000,
      subtotalCalculado: 320000,
      aportesSociales: 0,
      totalPagado: 320000,
    },
  },
]

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
      body: JSON.stringify({ success: true, data: null }),
    }),
  )
  await page.route('**/api/v1/nomina?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: ROWS }),
    }),
  )
  await page.route('**/api/v1/nomina/periodos**', (route) =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { id: 99 } }),
    }),
  )
}

test.describe('Nómina Registrar dialog enrichment — MOCKED', () => {
  test('FIJO: name/doc/medio/asistencia + medias/valor/aportes/total + DESPRENDIBLE + guardar', async ({
    page,
  }) => {
    await mockAdmin(page)
    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-periodo')).toBeVisible({ timeout: 15000 })

    const openBtns = page.getByTestId('nomina-open-dialog')
    await expect(openBtns.first()).toBeVisible({ timeout: 10000 })
    await openBtns.first().click()

    await expect(page.getByTestId('nomina-dialog')).toBeVisible()
    await expect(page.getByTestId('nomina-dialog-summary')).toBeVisible()
    await expect(page.getByTestId('nomina-info-nombre')).toContainText(/ANA/i)
    await expect(page.getByTestId('nomina-info-documento')).toContainText('1001')
    await expect(page.getByTestId('nomina-info-medio')).toContainText(/Nequi/i)
    await expect(page.getByTestId('nomina-info-tipo-contrato')).toContainText(/Término fijo|TERMINO_FIJO/i)
    await expect(page.getByTestId('nomina-info-asistencia')).toContainText('12')

    // Assignment testids
    await expect(page.getByTestId('nomina-medias')).toBeVisible()
    await expect(page.getByTestId('nomina-valor-jornada')).toBeVisible()
    await expect(page.getByTestId('nomina-aportes')).toBeVisible()
    await expect(page.getByTestId('nomina-total')).toBeVisible()
    await expect(page.getByTestId('nomina-guardar')).toBeVisible()

    // DESPRENDIBLE slot still present for FIJO (input is class=hidden → attached, not visible)
    await expect(page.getByTestId('nomina-slot-DESPRENDIBLE')).toBeAttached()
  })

  test('OPS: sin medio warning, no aportes, cuenta-cobro slots unchanged', async ({ page }) => {
    await mockAdmin(page)
    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-periodo')).toBeVisible({ timeout: 15000 })

    const openBtns = page.getByTestId('nomina-open-dialog')
    await expect(openBtns).toHaveCount(2, { timeout: 10000 })
    await openBtns.nth(1).click()

    await expect(page.getByTestId('nomina-dialog')).toBeVisible()
    await expect(page.getByTestId('nomina-medio-warning')).toBeVisible()
    await expect(page.getByTestId('nomina-medio-warning')).toContainText(/Sin medio de pago/i)

    // Aportes NOT for OPS
    await expect(page.getByTestId('nomina-aportes')).toHaveCount(0)

    // Existing OPS slots unchanged (file inputs are class=hidden)
    await expect(page.getByTestId('nomina-slot-CUENTA_COBRO')).toBeAttached()
    await expect(page.getByTestId('nomina-slot-INFORME_ACTIVIDADES')).toBeAttached()
    await expect(page.getByTestId('nomina-slot-COMPROBANTE_APORTES')).toBeAttached()

    await expect(page.getByTestId('nomina-medias')).toBeVisible()
    await expect(page.getByTestId('nomina-total')).toBeVisible()
    await expect(page.getByTestId('nomina-guardar')).toBeVisible()
  })
})
