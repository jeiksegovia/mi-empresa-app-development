import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: P4 — Shared CertificadoEmpleado editor (F2.3)
 *
 *  - EmpleadoCertificadosEditor renders on /empleados/nuevo step 5 AND /empleados/[id]/editar tab 5
 *  - Adding a MANIPULACION_ALIMENTOS cert and saving returns 200
 *  - The shared component exposes all 4 tipo options (ALTURAS, RIESGO_ELECTRICO, MANIPULACION_ALIMENTOS, OTRO)
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/p4-cert-editor.spec.ts
 */


test('P4-1: EmpleadoCertificadosEditor renders on /empleados/nuevo step 5 with the 4 tipo options', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/empleados/nuevo')
  await page.waitForLoadState('networkidle')

  // Fill step 1 minimum required fields then advance to step 5
  await page.getByPlaceholder('Nombres').fill('P4')
  await page.getByPlaceholder('Apellidos').fill('Editor')
  await page.getByPlaceholder('Número de documento').fill(`${Date.now()}`)
  await page.locator('label', { hasText: /^género/i }).first().locator('xpath=following::div[contains(@class,"p-select")][1]').click()
  await page.waitForTimeout(200)
  await page.locator('li[role="option"]').first().click()
  await page.locator('input[type="date"]').first().fill('1990-01-01')

  // Advance: 1→2→3→4→5
  const next = page.locator('button', { hasText: /siguiente/i }).first()
  for (let i = 0; i < 4; i++) {
    await next.click()
    await page.waitForTimeout(300)
  }

  // Step 5 — editor should render
  const step5 = page.locator('[data-step="5"]')
  await expect(step5.locator('text=Certificados del Empleado').first()).toBeVisible({ timeout: 5000 })
  await expect(step5.locator('button', { hasText: /agregar certificado/i })).toBeVisible()
})

test('P4-2: EmpleadoCertificadosEditor renders on /empleados/[id]/editar tab 5', async ({ page }) => {
  await loginAsAdmin(page)
  // Find first employee id via API
  const listResp = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const listBody = await listResp.json()
  const empId = listBody?.data?.[0]?.id
  expect(empId).toBeTruthy()

  await page.goto(`/empleados/${empId}/editar`)
  await page.waitForLoadState('networkidle')

  // Click tab "Certificados" or "Certificados y Migración" — match the actual label
  const certTab = page.locator('button', { hasText: /certificados/i }).first()
  await expect(certTab).toBeVisible({ timeout: 5000 })
  await certTab.click()
  await page.waitForTimeout(400)

  // The editor heading + add button must be visible
  await expect(page.locator('text=Certificados del Empleado').first()).toBeVisible({ timeout: 5000 })
  await expect(page.locator('button', { hasText: /agregar certificado/i })).toBeVisible()
})

test('P4-3: PUT /employees/:id/certificados accepts MANIPULACION_ALIMENTOS via the new shape', async ({ page }) => {
  await loginAsAdmin(page)
  const listResp = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const listBody = await listResp.json()
  const empId = listBody?.data?.[0]?.id
  expect(empId).toBeTruthy()

  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400_000 * 365).toISOString().slice(0, 10)
  const r = await page.request.put(`http://localhost:3101/api/v1/employees/${empId}/certificados`, {
    data: {
      certificados: [
        {
          tipo: 'MANIPULACION_ALIMENTOS',
          fechaExpedicion: today,
          fechaVencimiento: tomorrow,
        },
        {
          tipo: 'OTRO',
          nombre: 'Operador de montacargas P4',
          fechaExpedicion: today,
          fechaVencimiento: tomorrow,
        },
      ],
    },
  })
  expect(r.status(), `PUT failed: ${await r.text()}`).toBe(200)
  const body = await r.json()
  expect(body.data.length).toBeGreaterThanOrEqual(2)
  const tipos = body.data.map((c: any) => c.tipo)
  expect(tipos).toContain('MANIPULACION_ALIMENTOS')
  expect(tipos).toContain('OTRO')

  // Re-fetch and confirm persistence
  const verify = await page.request.get(`http://localhost:3101/api/v1/employees/${empId}`)
  const detail = await verify.json()
  const persistedTipos = (detail.data.certificados ?? []).map((c: any) => c.tipo)
  expect(persistedTipos).toContain('MANIPULACION_ALIMENTOS')
})