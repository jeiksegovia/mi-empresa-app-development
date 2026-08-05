/**
 * LOCAL QA — qa-session-jul-31 followup (aug-04): empleado "bloqueador" lock UI (MOCKED).
 *
 * Covers:
 *  - Detail (ADMIN): lock toggle button visible; badge shows when bloqueado.
 *  - Detail (ADMIN): clicking toggle calls PUT /employees/:id/lock.
 *  - Editar (CONTRATOS, locked): locked banner shows + Guardar disabled.
 *  - List: lock icon on a bloqueado row.
 *
 * All endpoints mocked — deterministic, no backend.
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ADMIN = { id: 1, email: 'admin@miempresa.com', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN', tipoEmpleado: null, activo: true }
const CONTRATOS = { id: 2, email: 'qa-contratos@miempresa.com', nombre: 'Caro', apellido: 'QA', rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS', activo: true }

function emp(overrides: Record<string, unknown> = {}) {
  return {
    id: 400, nombre: 'LOCK', apellido: 'UI', tipoDocumento: 'CC', numeroDocumento: '400400',
    genero: 'MASCULINO', fechaNacimiento: '1990-01-01', estadoCivil: null, tipoVivienda: null,
    estratoSocioeconomico: null, direccion: null, telefono: null, email: null, permisoTrabajo: false,
    estado: 'ACTIVO', documentoIdentificacionUrl: null, medioPagoTipo: null, medioPagoNequi: null,
    bancoNombre: null, bancoTipoCuenta: null, bancoNumeroCuenta: null, eps: null, fondoPensiones: null, arl: null,
    bloqueado: false, bloqueadoPor: null, bloqueadoEn: null,
    nucleoFamiliar: [], cargos: [], contactosEmergencia: [], experienciasLaborales: [],
    educacionIdiomas: [], educacionEmpleado: [], vehiculos: [], certificados: [], datosMigracion: null, hojaVidaUrl: null,
    ...overrides,
  }
}

async function mockSession(page: Page, user: Record<string, unknown>) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) }))
  for (const p of ['**/api/v1/auth/me', '**/api/v1/auth/login']) {
    await page.route(p, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user }) }))
  }
}

test.describe('qa-jul-31 followup — bloqueador lock UI (MOCKED)', () => {
  test('detail (ADMIN): lock toggle visible; badge shown when bloqueado; clicking calls /lock', async ({ page }) => {
    await mockSession(page, ADMIN)
    let lockCalled = false
    await page.route('**/api/v1/employees/400/lock', async (route) => {
      lockCalled = true
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: emp({ bloqueado: true, bloqueadoPor: 1, bloqueadoEn: new Date().toISOString() }) }) })
    })
    await page.route('**/api/v1/employees/400', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: emp({ bloqueado: false }) }) }))

    await page.goto(`${FRONTEND}/empleados/400`)
    const toggle = page.getByTestId('empleado-lock-toggle')
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await expect(toggle).toContainText('Bloquear')
    await expect(page.getByTestId('empleado-lock-badge')).toHaveCount(0)

    await toggle.click()
    await expect.poll(() => lockCalled, { timeout: 8000 }).toBeTruthy()
    await expect(page.getByTestId('empleado-lock-badge')).toBeVisible()
    await expect(toggle).toContainText('Desbloquear')
  })

  test('editar (CONTRATOS, locked): banner shown + Guardar disabled', async ({ page }) => {
    await mockSession(page, CONTRATOS)
    await page.route('**/api/v1/employees/400', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: emp({ bloqueado: true, bloqueadoPor: 1, bloqueadoEn: new Date().toISOString() }) }) }))

    await page.goto(`${FRONTEND}/empleados/400/editar`)
    await expect(page.getByTestId('empleado-locked-banner')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /Guardar Datos Personales/i })).toBeDisabled()
  })

  test('list: lock icon on a bloqueado row', async ({ page }) => {
    await mockSession(page, ADMIN)
    await page.route(/\/api\/v1\/employees(\?|$)/, (route) => {
      if (route.request().method() !== 'GET') return route.fallback()
      return route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [emp({ id: 400, bloqueado: true }), emp({ id: 401, numeroDocumento: '401401', bloqueado: false })], total: 2, page: 1, limit: 20 }),
      })
    })
    await page.goto(`${FRONTEND}/empleados`)
    await expect(page.getByTestId('empleado-lock-icon').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('empleado-lock-icon')).toHaveCount(1)
  })
})
