/**
 * fixes-jul-22 — FE smoke: patient `estado` control RBAC (W2-frontend task #10).
 *
 * Per contract §1.2 (create) / §1.3 (edit):
 *
 *   - On `/pacientes/crear`: the `Estado` Select is HIDDEN for CONTRATOS (the
 *     backend forces ACTIVO regardless of body value, so the UI simply omits
 *     the control AND the payload field).
 *
 *   - On `/pacientes/[id]/editar`: the `Estado` Select is shown only for ADMIN
 *     and EMPLEADO + GERONTOLOGA. For CONTRATOS / AUDITOR / OPERADOR the
 *     control is hidden AND the field is omitted from the PUT payload (the
 *     presence of `estado` triggers the 403 PATIENT_STATE_FORBIDDEN rule).
 *
 * This spec is MOCKED — the session is stubbed via route interception of
 * `/auth/me` so we exercise the existing RBAC composable + create/edit pages
 * without a live backend (W3 may re-run against seeded qa-contratos /
 * qa-gerontologa / qa-admin users when W9 is live).
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *     npx playwright test fixes-jul-22/estado-hide.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

type Profile = { rol: string; tipoEmpleado: 'GERONTOLOGA' | 'CONTRATOS' | null }

async function mockSession(page: Page, profile: Profile) {
  const user = {
    id: 99,
    email: 'qa@miempresa.com',
    nombre: 'QA',
    apellido: 'User',
    rol: profile.rol,
    tipoEmpleado: profile.tipoEmpleado,
    activo: true,
  }
  // Catch-all so any unmocked endpoint returns a benign empty success.
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
  await page.route('**/api/v1/empresa', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    }),
  )
  // Patient fetch stub (for editar page hydration)
  await page.route('**/api/v1/patients/1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 1,
          nombre: 'Test Paciente',
          tipoDocumento: 'CC',
          numeroDocumento: '123456',
          fechaNacimiento: '1950-01-01',
          genero: 'Femenino',
          telefono: null,
          email: null,
          direccion: null,
          contactosEmergencia: [],
          estado: 'ACTIVO',
        },
      }),
    }),
  )
}

test.describe('fixes-jul-22 — paciente `estado` control RBAC (MOCKED)', () => {
  test('crear: estado Select VISIBLE for ADMIN, GERONTOLOGA, AUDITOR, OPERADOR', async ({ page }) => {
    for (const profile of [
      { rol: 'ADMIN', tipoEmpleado: null },
      { rol: 'EMPLEADO', tipoEmpleado: 'GERONTOLOGA' },
      { rol: 'AUDITOR', tipoEmpleado: null },
      { rol: 'OPERADOR', tipoEmpleado: null },
    ]) {
      await mockSession(page, profile)
      await page.goto(`${FRONTEND}/pacientes/crear`)
      await expect(page.locator('[data-testid="estado-field"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="estado-select"]')).toBeVisible()
    }
  })

  test('crear: estado Select HIDDEN for CONTRATOS', async ({ page }) => {
    await mockSession(page, { rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS' })
    await page.goto(`${FRONTEND}/pacientes/crear`)
    await expect(page.locator('[data-testid="estado-field"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="estado-select"]')).toHaveCount(0)
  })

  test('editar: estado Select VISIBLE for ADMIN and GERONTOLOGA', async ({ page }) => {
    for (const profile of [
      { rol: 'ADMIN', tipoEmpleado: null },
      { rol: 'EMPLEADO', tipoEmpleado: 'GERONTOLOGA' },
    ]) {
      await mockSession(page, profile)
      await page.goto(`${FRONTEND}/pacientes/1/editar`)
      // Wait for hydration to finish (loading spinner gone)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('[data-testid="estado-field"]')).toHaveCount(1)
      await expect(page.locator('[data-testid="estado-select"]')).toBeVisible()
    }
  })

  test('editar: estado Select HIDDEN for CONTRATOS / AUDITOR / OPERADOR', async ({ page }) => {
    for (const profile of [
      { rol: 'EMPLEADO', tipoEmpleado: 'CONTRATOS' },
      { rol: 'AUDITOR', tipoEmpleado: null },
      { rol: 'OPERADOR', tipoEmpleado: null },
    ]) {
      await mockSession(page, profile)
      await page.goto(`${FRONTEND}/pacientes/1/editar`)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('[data-testid="estado-field"]')).toHaveCount(0)
      await expect(page.locator('[data-testid="estado-select"]')).toHaveCount(0)
    }
  })
})