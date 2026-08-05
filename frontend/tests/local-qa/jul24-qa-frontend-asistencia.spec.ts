/**
 * LOCAL QA — qa-session-jul-24 (R6) frontend asistencia date-lock.
 *
 * Validates:
 *  - ADMIN role: date picker is free (no min/max), "Hoy" button visible.
 *  - EMPLEADO + CONTRATOS sub-role: date picker is read-only with
 *    min=max=today (America/Bogota), "Hoy" button hidden, lock
 *    indicator visible.
 *  - Notas column accepts free text and is included in the PUT body.
 *
 * Mocks the auth endpoint so the run is deterministic.
 *
 * Run:
 *   cd frontend && npx playwright test tests/local-qa/jul24-qa-frontend-asistencia.spec.ts
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

const CONTRATOS = {
  id: 7,
  email: 'contratos@miempresa.com',
  nombre: 'CONTRATOS',
  apellido: 'EMP',
  rol: 'EMPLEADO',
  tipoEmpleado: 'CONTRATOS',
  activo: true,
}

// Match the page's own todayYMD() so we can assert the min/max attrs.
function todayYMD(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

async function mockAuth(page: Page, user: typeof ADMIN) {
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

test.describe('qa-session-jul-24 — Asistencia date-lock (MOCKED)', () => {
  test('ADMIN: free date picker + "Hoy" button visible', async ({ page }) => {
    await mockAuth(page, ADMIN)
    await page.goto(`${FRONTEND}/asistencia`)
    await expect(page.getByTestId('asistencia-fecha')).toBeVisible({ timeout: 15000 })
    const dateInput = page.getByTestId('asistencia-fecha')
    // No min/max for ADMIN.
    await expect(dateInput).not.toHaveAttribute('min', todayYMD())
    // "Hoy" button visible.
    await expect(page.getByTestId('asistencia-hoy')).toBeVisible()
    // Lock indicator absent.
    await expect(page.getByTestId('asistencia-fecha-locked')).toHaveCount(0)
  })

  test('CONTRATOS: date input locked to today + "Hoy" hidden + lock indicator', async ({ page }) => {
    await mockAuth(page, CONTRATOS)
    await page.goto(`${FRONTEND}/asistencia`)
    await expect(page.getByTestId('asistencia-fecha')).toBeVisible({ timeout: 15000 })
    const dateInput = page.getByTestId('asistencia-fecha')
    const today = todayYMD()
    await expect(dateInput).toHaveAttribute('min', today)
    await expect(dateInput).toHaveAttribute('max', today)
    await expect(dateInput).toHaveValue(today)
    await expect(dateInput).toHaveAttribute('readonly', '')
    // "Hoy" button hidden for CONTRATOS (already at today).
    await expect(page.getByTestId('asistencia-hoy')).toHaveCount(0)
    // Lock indicator visible.
    await expect(page.getByTestId('asistencia-fecha-locked')).toBeVisible()
  })

  test('CONTRATOS: attempts to type a different date snaps back to today', async ({ page }) => {
    await mockAuth(page, CONTRATOS)
    await page.goto(`${FRONTEND}/asistencia`)
    await expect(page.getByTestId('asistencia-fecha')).toBeVisible({ timeout: 15000 })
    const dateInput = page.getByTestId('asistencia-fecha')
    // Forcefully set value to yesterday and dispatch change — should snap back.
    await dateInput.evaluate((el: any) => {
      el.value = '2026-01-01'
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(dateInput).toHaveValue(todayYMD())
  })

  test('ADMIN: Notas input is submitted in PUT /asistencia/dia body', async ({ page }) => {
    await mockAuth(page, ADMIN)

    // First seed a single ACTIVO employee via the mocked GET, then we
    // can toggle + write a nota + click save and confirm the wire body.
    await page.route('**/api/v1/asistencia**', async (route) => {
      const url = route.request().url()
      const method = route.request().method()
      if (method === 'GET' && /\/asistencia\?fecha=/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                empleadoId: 100,
                jornadaAm: false,
                jornadaPm: false,
                notas: null,
                empleado: {
                  id: 100,
                  nombre: 'NOTAS',
                  apellido: 'TEST',
                  numeroDocumento: 'X1',
                },
              },
            ],
          }),
        })
        return
      }
      if (method === 'PUT' && /\/asistencia\/dia/.test(url)) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [] }),
      })
    })

    let putBody: any = null
    page.on('request', (req) => {
      if (req.method() === 'PUT' && /\/api\/v1\/asistencia\/dia/.test(req.url())) {
        putBody = req.postDataJSON()
      }
    })

    await page.goto(`${FRONTEND}/asistencia`)
    await expect(page.getByTestId('asistencia-fecha')).toBeVisible({ timeout: 15000 })

    // Wait for the row to render, then type into the nota field.
    const notasInput = page.getByTestId('asistencia-notas-100')
    await expect(notasInput).toBeVisible({ timeout: 15000 })
    await notasInput.fill('Justificación de prueba')

    // Trigger save.
    await page.getByTestId('asistencia-guardar').click()

    await expect.poll(() => putBody != null, { timeout: 8000 }).toBeTruthy()
    expect(putBody.fecha).toBe(todayYMD())
    expect(Array.isArray(putBody.items)).toBeTruthy()
    const item = putBody.items.find((i: any) => i.empleadoId === 100)
    expect(item).toBeTruthy()
    expect(item.notas).toBe('Justificación de prueba')
  })
})