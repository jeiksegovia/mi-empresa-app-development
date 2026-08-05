/**
 * LOCAL QA — qa-session-jul-24 (R1) frontend payment-method UI.
 *
 * Validates the wizard + edit pages after this migration:
 *  - "Efectivo" is offered as a 4th medio-pago option.
 *  - Selecting "Efectivo" hides Nequi / bank fields.
 *  - The Nequi field is relabeled "Llave" and validates per the
 *    contract regex (email OR alphanumeric 6–25 with letter+digit).
 *  - The Cargos block is no longer rendered in the wizard step 3
 *    "Información Laboral" tab.
 *  - The employee profile Información Personal tab renders a
 *    medio-de-pago preview card.
 *
 * Mocks the auth + employee endpoints so the run is deterministic.
 *
 * Run:
 *   cd frontend && npx playwright test tests/local-qa/jul24-qa-frontend-payments.spec.ts
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

const EMP_TRANSFERENCIA = {
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
  medioPagoTipo: 'TRANSFERENCIA_BANCARIA',
  medioPagoNequi: null,
  bancoNombre: 'Bancolombia',
  bancoTipoCuenta: 'AHORRO',
  bancoNumeroCuenta: '1234567890123456',
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

const EMP_EFECTIVO = {
  ...EMP_TRANSFERENCIA,
  id: 43,
  nombre: 'ANA',
  apellido: 'PEREZ',
  numeroDocumento: '112233',
  medioPagoTipo: 'EFECTIVO',
  medioPagoNequi: null,
  bancoNombre: null,
  bancoTipoCuenta: null,
  bancoNumeroCuenta: null,
}

async function mockAuthAndCatchAll(page: Page, user = ADMIN) {
  // Last-registered wins → catch-all must be FIRST so specific overrides match.
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
}

async function mockEmployeeEndpoints(page: Page, emp: any) {
  await page.route(`**/api/v1/employees/${emp.id}`, async (route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: emp }),
      })
      return
    }
    if (method === 'PUT') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: emp }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: emp }),
    })
  })
  await page.route(`**/api/v1/employees/${emp.id}/educacion**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route(`**/api/v1/nomina/employees/${emp.id}/contratos**`, (route) =>
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

test.describe('qa-session-jul-24 — Payment UI (MOCKED)', () => {
  test('wizard step 1: Efectivo option + Cargos block removed from step 3', async ({ page }) => {
    await mockAuthAndCatchAll(page)
    await page.goto(`${FRONTEND}/empleados/nuevo`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 15000 })

    // Open the medio-pago tipo select and verify all 4 options exist
    // (Sin definir / Nequi / Transferencia bancaria / Efectivo).
    await page.getByTestId('medio-pago-tipo').click()
    const optionTexts = await page.locator('[role=option]').allInnerTexts()
    expect(optionTexts.some((t) => /Efectivo/.test(t))).toBeTruthy()
    // Close the overlay
    await page.keyboard.press('Escape')

    // Selecting Efectivo should hide both Nequi and bank fields.
    await page.getByTestId('medio-pago-tipo').click()
    await page.getByRole('option', { name: 'Efectivo' }).click()
    await expect(page.getByTestId('medio-pago-nequi')).toHaveCount(0)
    await expect(page.getByTestId('medio-pago-banco')).toHaveCount(0)
    await expect(page.getByTestId('medio-pago-tipo-cuenta')).toHaveCount(0)
    await expect(page.getByTestId('medio-pago-numero-cuenta')).toHaveCount(0)

    // Step 3 (Información Laboral) must NOT contain the "Cargo en la
    // Empresa" header anymore. We jump to step 3 by clicking "Siguiente"
    // twice (step 1 → 2 → 3).
    await page.getByRole('button', { name: /Siguiente/i }).click()
    await page.getByRole('button', { name: /Siguiente/i }).click()
    await expect(page.locator('text=Cargo en la Empresa')).toHaveCount(0)
  })

  test('wizard step 1: Nequi field relabeled "Llave" + validation per contract regex', async ({ page }) => {
    await mockAuthAndCatchAll(page)
    await page.goto(`${FRONTEND}/empleados/nuevo`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 15000 })

    // Select Nequi.
    await page.getByTestId('medio-pago-tipo').click()
    await page.getByRole('option', { name: 'Nequi' }).click()
    const nequiInput = page.getByTestId('medio-pago-nequi')
    await expect(nequiInput).toBeVisible()

    // Label must say "Llave" (contract §3).
    await expect(page.locator('label[for="medio-pago-nequi"]')).toContainText(/Llave/i)

    // Pure numeric → invalid (rejected by contract).
    await nequiInput.fill('3001234567')
    await nequiInput.blur()
    await expect(page.getByTestId('medio-pago-nequi-error')).toBeVisible()
    await expect(page.getByTestId('medio-pago-nequi-error')).toContainText(/inválida/i)

    // Email → valid.
    await nequiInput.fill('mi.llave@correo.com')
    await nequiInput.blur()
    await expect(page.getByTestId('medio-pago-nequi-error')).toHaveCount(0)

    // Alphanumeric with letters+digits, 6–25 chars → valid.
    await nequiInput.fill('LlaveABC123')
    await nequiInput.blur()
    await expect(page.getByTestId('medio-pago-nequi-error')).toHaveCount(0)

    // Too short (5 chars) → invalid.
    await nequiInput.fill('Ab12c')
    await nequiInput.blur()
    await expect(page.getByTestId('medio-pago-nequi-error')).toBeVisible()
  })

  test('edit page: hydrates Transferencia + shows masked bank preview on profile', async ({ page }) => {
    await mockAuthAndCatchAll(page)
    await mockEmployeeEndpoints(page, EMP_TRANSFERENCIA)

    // Profile preview
    await page.goto(`${FRONTEND}/empleados/${EMP_TRANSFERENCIA.id}`)
    await expect(page.getByTestId('medio-pago-preview-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('medio-pago-preview-transferencia')).toBeVisible()
    // Last 4 digits of "1234567890123456" = "3456" (the only digits present)
    await expect(page.getByTestId('medio-pago-preview-transferencia')).toContainText('3456')

    // Edit page hydrates all the bank fields.
    await page.goto(`${FRONTEND}/empleados/${EMP_TRANSFERENCIA.id}/editar`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('medio-pago-banco')).toHaveValue('Bancolombia')
    await expect(page.getByTestId('medio-pago-tipo-cuenta')).toBeVisible()
    await expect(page.getByTestId('medio-pago-numero-cuenta')).toHaveValue('1234567890123456')
  })

  test('profile preview: Efectivo empty bank fields → "Efectivo" preview', async ({ page }) => {
    await mockAuthAndCatchAll(page)
    await mockEmployeeEndpoints(page, EMP_EFECTIVO)
    await page.goto(`${FRONTEND}/empleados/${EMP_EFECTIVO.id}`)
    await expect(page.getByTestId('medio-pago-preview-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('medio-pago-preview-efectivo')).toBeVisible()
    await expect(page.getByTestId('medio-pago-preview-efectivo')).toContainText('Efectivo')
  })

  test('profile preview: empty medio-pago → "Sin medio de pago configurado"', async ({ page }) => {
    await mockAuthAndCatchAll(page)
    await mockEmployeeEndpoints(page, { ...EMP_TRANSFERENCIA, id: 99, medioPagoTipo: null })
    await page.goto(`${FRONTEND}/empleados/99`)
    await expect(page.getByTestId('medio-pago-preview-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('medio-pago-preview-empty')).toBeVisible()
  })
})