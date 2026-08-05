/**
 * LOCAL QA — qa-session-jul-31 frontend wave (MOCKED).
 *
 * Covers R1, R2 and R3:
 *   R1 — Nequi dropdown label is "Nequi/Bre-B" on all 4 surfaces; the
 *        stored enum value stays `NEQUI`.
 *   R2 — Nómina Registrar dialog branches on contratoActivo.tipoContrato:
 *        OPS keeps medias × valorJornada; OBRA / TERMINO_FIJO /
 *        TERMINO_INDEFINIDO show a Valor Mensual base, hide jornada
 *        inputs, and prefill from `sugerido.valorMensual`.
 *   R3 — `eps` / `fondoPensiones` / `arl` free-text fields exist on
 *        nuevo, edit, and detail; payload uses the camelCase names.
 *
 * All endpoints are mocked so the run is deterministic and does not
 * require backend wiring.
 *
 * Run:
 *   cd frontend && npx playwright test tests/local-qa/jul31-qa-frontend.spec.ts
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

function baseEmpleado(overrides: Record<string, unknown> = {}) {
  return {
    id: 300,
    nombre: 'JUL31',
    apellido: 'QA',
    tipoDocumento: 'CC',
    numeroDocumento: '300300',
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
    // R3 fields default null.
    eps: null,
    fondoPensiones: null,
    arl: null,
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
    ...overrides,
  }
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

async function mockEmployeeEndpoints(page: Page, emp: any) {
  await page.route(`**/api/v1/employees/${emp.id}`, async (route) => {
    const method = route.request().method()
    if (method === 'GET' || method === 'PUT') {
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

// ─── R1 ──────────────────────────────────────────────────────────────────────

test.describe('qa-session-jul-31 — R1 Nequi/Bre-B label (MOCKED)', () => {
  test('wizard: dropdown option text is "Nequi/Bre-B"', async ({ page }) => {
    await mockAuth(page)
    await page.goto(`${FRONTEND}/empleados/nuevo`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('medio-pago-tipo').click()
    const labels = await page.locator('[role=option]').allInnerTexts()
    // The displayed label must include "Bre-B". The old "Nequi" label is
    // no longer rendered as a standalone option (it's been replaced).
    expect(labels.some((t) => /Nequi\/Bre-B/.test(t))).toBeTruthy()
    await page.keyboard.press('Escape')
  })

  test('edit: dropdown option text is "Nequi/Bre-B"', async ({ page }) => {
    const emp = baseEmpleado({ id: 301, medioPagoTipo: 'NEQUI', medioPagoNequi: 'mi.llave@correo.com' })
    await mockAuth(page)
    await mockEmployeeEndpoints(page, emp)
    await page.goto(`${FRONTEND}/empleados/${emp.id}/editar`)
    await expect(page.getByTestId('medio-pago-section')).toBeVisible({ timeout: 20000 })
    await page.getByTestId('medio-pago-tipo').click()
    const labels = await page.locator('[role=option]').allInnerTexts()
    expect(labels.some((t) => /Nequi\/Bre-B/.test(t))).toBeTruthy()
    await page.keyboard.press('Escape')
  })

  test('detail: NEQUI medioPago renders as "Nequi/Bre-B"', async ({ page }) => {
    const emp = baseEmpleado({ id: 302, medioPagoTipo: 'NEQUI', medioPagoNequi: 'mi.llave@correo.com' })
    await mockAuth(page)
    await mockEmployeeEndpoints(page, emp)
    await page.goto(`${FRONTEND}/empleados/${emp.id}`)
    await expect(page.getByTestId('medio-pago-preview-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('medio-pago-preview-nequi')).toBeVisible()
    await expect(page.getByTestId('medio-pago-preview-nequi')).toContainText('Nequi/Bre-B')
  })

  test('nomina dialog summary: NEQUI label shows "Nequi/Bre-B"', async ({ page }) => {
    // Build a single OPS row with NEQUI medio + an entrada so the dialog opens.
    const periodo = '2026-08'
    const emp = baseEmpleado({ id: 303, medioPagoTipo: 'NEQUI', medioPagoNequi: 'llave@test.com' })
    const nominaRow = {
      empleado: {
        id: emp.id,
        nombre: emp.nombre,
        apellido: emp.apellido,
        numeroDocumento: emp.numeroDocumento,
        medioPagoTipo: 'NEQUI',
        medioPagoNequi: 'llave@test.com',
        bancoNombre: null,
        bancoTipoCuenta: null,
        bancoNumeroCuenta: null,
      },
      contratoActivo: {
        id: 1,
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: null,
        archivoUrl: null,
        activo: true,
        valorJornada: 50000,
      },
      entrada: {
        id: 9001,
        periodo,
        tipoContrato: 'OPS',
        salario: 0,
        notas: null,
        archivos: [],
        mediasJornadas: 0,
        valorJornada: 50000,
        subtotalCalculado: 0,
        aportesSociales: 0,
        totalPagado: 0,
      },
      cargoSalario: null,
      asistenciaMes: { mediasJornadas: 0, horas: 0 },
      sugerido: {
        mediasJornadas: 0,
        valorJornada: 50000,
        valorMensual: null,
        subtotalCalculado: 0,
        aportesSociales: 0,
        totalPagado: 0,
      },
    }
    await mockAuth(page)
    await page.route(`**/api/v1/nomina**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [nominaRow] }),
      }),
    )
    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 15000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('nomina-info-medio')).toContainText('Nequi/Bre-B')
  })
})

// ─── R2 ──────────────────────────────────────────────────────────────────────

function nominaRowForTipo(
  tipoContrato: 'OPS' | 'OBRA_O_LABOR' | 'TERMINO_FIJO' | 'TERMINO_INDEFINIDO',
  overrides: Record<string, any> = {},
) {
  const isOps = tipoContrato === 'OPS'
  const baseRow: any = {
    empleado: {
      id: 310,
      nombre: 'R2',
      apellido: tipoContrato,
      numeroDocumento: `310-${tipoContrato}`,
      medioPagoTipo: null,
      medioPagoNequi: null,
      bancoNombre: null,
      bancoTipoCuenta: null,
      bancoNumeroCuenta: null,
    },
    contratoActivo: {
      id: 1,
      tipoContrato,
      fechaInicio: '2026-01-01',
      fechaFin: tipoContrato === 'TERMINO_INDEFINIDO' ? null : '2026-12-31',
      archivoUrl: null,
      activo: true,
      valorJornada: isOps ? 50000 : null,
      valorMensual: isOps ? null : 2500000,
    },
    entrada: null,
    cargoSalario: null,
    asistenciaMes: { mediasJornadas: 0, horas: 0 },
    sugerido: {
      mediasJornadas: isOps ? 0 : null,
      valorJornada: isOps ? 50000 : null,
      valorMensual: isOps ? null : 2500000,
      subtotalCalculado: isOps ? 0 : null,
      aportesSociales: 0,
      totalPagado: isOps ? 0 : 2500000,
    },
  }
  return { ...baseRow, ...overrides }
}

async function openNominaDialogAndAssertLayout(
  page: Page,
  row: any,
  expectValorMensual: boolean,
) {
  await mockAuth(page)
  await page.route(`**/api/v1/nomina**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [row] }),
    }),
  )
  await page.goto(`${FRONTEND}/nomina`)
  await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 15000 })
  await page.getByTestId('nomina-open-dialog').first().click()
  await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

  if (expectValorMensual) {
    await expect(page.getByTestId('nomina-valor-mensual')).toBeVisible()
    // OPS-specific inputs must be absent in the non-OPS branch.
    await expect(page.getByTestId('nomina-medias')).toHaveCount(0)
    await expect(page.getByTestId('nomina-valor-jornada')).toHaveCount(0)
    // Aportes shown only when the contrato is FIJO/INDEF.
    const aportes = page.getByTestId('nomina-aportes')
    if (row.contratoActivo.tipoContrato === 'TERMINO_FIJO' || row.contratoActivo.tipoContrato === 'TERMINO_INDEFINIDO') {
      await expect(aportes).toBeVisible()
    } else {
      await expect(aportes).toHaveCount(0)
    }
  } else {
    await expect(page.getByTestId('nomina-medias')).toBeVisible()
    await expect(page.getByTestId('nomina-valor-jornada')).toBeVisible()
    await expect(page.getByTestId('nomina-valor-mensual')).toHaveCount(0)
  }
}

test.describe('qa-session-jul-31 — R2 nómina Valor-Mensual branch (MOCKED)', () => {
  test('OPS dialog keeps medias + valorJornada inputs (no valorMensual)', async ({ page }) => {
    await openNominaDialogAndAssertLayout(page, nominaRowForTipo('OPS'), false)
  })

  test('OBRA_O_LABOR dialog shows valorMensual base + no jornada inputs + no aportes', async ({ page }) => {
    await openNominaDialogAndAssertLayout(page, nominaRowForTipo('OBRA_O_LABOR'), true)
  })

  test('TERMINO_FIJO dialog shows valorMensual base + no jornada inputs + aportes visible', async ({ page }) => {
    await openNominaDialogAndAssertLayout(page, nominaRowForTipo('TERMINO_FIJO'), true)
  })

  test('TERMINO_INDEFINIDO dialog shows valorMensual base + no jornada inputs + aportes visible', async ({ page }) => {
    await openNominaDialogAndAssertLayout(page, nominaRowForTipo('TERMINO_INDEFINIDO'), true)
  })

  test('OBRA dialog: editing valorMensual updates subtotal + total (no aportes)', async ({ page }) => {
    const row = nominaRowForTipo('OBRA_O_LABOR')
    await mockAuth(page)
    let savedBody: any = null
    await page.route(`**/api/v1/nomina**`, (route) => {
      const req = route.request()
      const url = req.url()
      if (req.method() === 'POST' && url.includes('/nomina/periodos')) {
        savedBody = req.postDataJSON()
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: 9999, ...savedBody } }),
        })
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [row] }),
      })
    })
    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 15000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

    // OBRA defaults: valorMensual from sugerido, total = valorMensual.
    const valorMensual = page.getByTestId('nomina-valor-mensual').locator('input')
    await valorMensual.fill('')
    await valorMensual.fill('3000000')
    await valorMensual.blur()
    // Subtotal must mirror valorMensual (no formulas in play).
    // InputNumber uses the es-CO locale → comma-grouped.
    await expect(page.getByTestId('nomina-subtotal').locator('input')).toHaveValue('3,000,000')
    // Total mirrors subtotal (aportes hidden for OBRA).
    await expect(page.getByTestId('nomina-total').locator('input')).toHaveValue('3,000,000')

    // Save and check the payload carries valorMensual + aportesSociales=0.
    await page.getByTestId('nomina-guardar').click()
    await page.waitForTimeout(400)
    expect(savedBody).not.toBeNull()
    expect(savedBody.valorMensual).toBe(3000000)
    expect(savedBody.aportesSociales).toBe(0)
    // OPS-only fields absent on the wire for OBRA.
    expect(savedBody.mediasJornadas).toBeNull()
    expect(savedBody.valorJornada).toBeNull()
  })
})

// ─── R3 ──────────────────────────────────────────────────────────────────────

test.describe('qa-session-jul-31 — R3 EPS / Fondo / ARL (MOCKED)', () => {
  test('wizard step 1: inputs present and free-text, no catalog', async ({ page }) => {
    await mockAuth(page)
    await page.goto(`${FRONTEND}/empleados/nuevo`)
    await expect(page.getByTestId('seguridad-social-section')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('eps-input').fill('Sura')
    await page.getByTestId('fondoPensiones-input').fill('Porvenir')
    await page.getByTestId('arl-input').fill('Positiva')

    // Inputs are free text — no Select bound to a catalog.
    const epsEl = page.getByTestId('eps-input')
    expect(await epsEl.evaluate((el) => el.tagName)).toBe('INPUT')
  })

  test('detail: Seguridad Social card hidden when all fields are null', async ({ page }) => {
    const emp = baseEmpleado({ id: 320, eps: null, fondoPensiones: null, arl: null })
    await mockAuth(page)
    await mockEmployeeEndpoints(page, emp)
    await page.goto(`${FRONTEND}/empleados/${emp.id}`)
    await expect(page.getByTestId('medio-pago-preview-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('seguridad-social-card')).toHaveCount(0)
  })

  test('detail: Seguridad Social card renders when fields are set', async ({ page }) => {
    const emp = baseEmpleado({
      id: 321,
      eps: 'Sura',
      fondoPensiones: 'Porvenir',
      arl: 'Positiva',
    })
    await mockAuth(page)
    await mockEmployeeEndpoints(page, emp)
    await page.goto(`${FRONTEND}/empleados/${emp.id}`)
    await expect(page.getByTestId('seguridad-social-card')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('seguridad-social-eps')).toContainText('Sura')
    await expect(page.getByTestId('seguridad-social-fondoPensiones')).toContainText('Porvenir')
    await expect(page.getByTestId('seguridad-social-arl')).toContainText('Positiva')
  })

  test('edit: hydrates the R3 fields and the PUT payload uses eps/fondoPensiones/arl', async ({ page }) => {
    const emp = baseEmpleado({
      id: 322,
      eps: 'Sanitas',
      fondoPensiones: 'Colfondos',
      arl: 'Sura ARL',
    })
    await mockAuth(page)
    let putBody: any = null
    await page.route(`**/api/v1/employees/${emp.id}`, async (route) => {
      const method = route.request().method()
      if (method === 'PUT') {
        putBody = route.request().postDataJSON()
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { ...emp, ...putBody } }),
        })
      }
      return route.fulfill({
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

    await page.goto(`${FRONTEND}/empleados/${emp.id}/editar`)
    await expect(page.getByTestId('seguridad-social-section')).toBeVisible({ timeout: 20000 })
    await expect(page.getByTestId('eps-input')).toHaveValue('Sanitas')
    await expect(page.getByTestId('fondoPensiones-input')).toHaveValue('Colfondos')
    await expect(page.getByTestId('arl-input')).toHaveValue('Sura ARL')

    // Change one field, then save.
    await page.getByTestId('eps-input').fill('Nueva EPS')
    await page.getByRole('button', { name: /Guardar Datos Personales/i }).click()
    await page.waitForTimeout(400)

    expect(putBody).not.toBeNull()
    expect(putBody.eps).toBe('Nueva EPS')
    expect(putBody.fondoPensiones).toBe('Colfondos')
    expect(putBody.arl).toBe('Sura ARL')
  })
})