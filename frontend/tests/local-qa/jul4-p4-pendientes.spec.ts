import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: jul4 P4 — Sección Pendientes
 *
 *  - GET /employees/:id/pendientes returns manuales + derivados + openCount
 *  - POST creates a manual pendiente (ADMIN) — persisted to DB
 *  - PATCH transitions a manual pendiente to RESUELTO
 *  - DELETE removes a manual pendiente
 *  - UI: /empleados/[id] shows a Pendientes tab with derived items + manual add/resolve
 *  - Derived VENCIDO badge: when an empleado has a cert with fechaVencimiento in
 *    the past, the pendientes tab surfaces "vencido hace N días".
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul4-p4-pendientes.spec.ts
 */


test('P4-1: derived pendiente surfaces a "vencido hace" item when empleado has a cert with past fechaVencimiento', async ({ page }) => {
  await loginAsAdmin(page)
  // Create empleado, then PUT cert with fechaVencimiento in the past
  const uniq = `pendientes-test-${Date.now()}`
  const empCreate = await page.request.post('http://localhost:3101/api/v1/employees', {
    data: {
      nombre: 'PendJul4',
      apellido: 'TestVencido',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      genero: 'MASCULINO',
      fechaNacimiento: '1990-01-01',
      cargos: [],
      contactosEmergencia: [],
      nucleoFamiliar: [],
      experienciasLaborales: [],
      educacionIdiomas: [],
      vehiculos: [],
    },
  })
  expect(empCreate.status()).toBe(201)
  const id = (await empCreate.json()).data.id

  // Add a cert in the past
  const past = '2025-01-01'
  const exp = '2024-01-01'
  await page.request.put(`http://localhost:3101/api/v1/employees/${id}/certificados`, {
    data: {
      certificados: [
        {
          tipo: 'ALTURAS',
          fechaExpedicion: exp,
          fechaVencimiento: past,
        },
      ],
    },
  })

  // GET pendientes — derived should include a CERT_VENCIDO item
  const pend = await page.request.get(`http://localhost:3101/api/v1/employees/${id}/pendientes`)
  const pj = await pend.json()
  expect(pj.success).toBe(true)
  const derivado = (pj?.derivados ?? []).find((d: any) => d.tipo === 'CERT_VENCIDO')
  expect(derivado, 'expected derived CERT_VENCIDO for past-dated cert').toBeTruthy()
  expect(derivado.descripcion).toContain('vencido hace')

  // Cleanup: delete the empleado (cascade removes the cert + pendientes)
  await page.request.delete(`http://localhost:3101/api/v1/employees/${id}`).catch(() => {})
})

test('P4-2: full CRUD on manual pendientes — POST/PATCH/DELETE', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id
  expect(id).toBeTruthy()

  // Create
  const desc = `PendJul4-test-${Date.now()}`
  const create = await page.request.post(`http://localhost:3101/api/v1/employees/${id}/pendientes`, {
    data: { descripcion: desc },
  })
  expect(create.status()).toBe(201)
  const pid = (await create.json()).data.id

  // Read back from GET
  const list1 = await page.request.get(`http://localhost:3101/api/v1/employees/${id}/pendientes`)
  const lj = await list1.json()
  expect(lj?.manuales?.some((m: any) => m.id === pid && m.descripcion === desc)).toBe(true)

  // Resolve
  const patch = await page.request.patch(`http://localhost:3101/api/v1/employees/${id}/pendientes/${pid}`, {
    data: { estado: 'RESUELTO' },
  })
  expect(patch.status()).toBe(200)

  // Delete
  const del = await page.request.delete(`http://localhost:3101/api/v1/employees/${id}/pendientes/${pid}`)
  expect(del.status()).toBe(200)
})

test('P4-3: /empleados/[id] shows the new Pendientes tab + add manual pendiente through UI', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id
  if (!id) {
    test.skip(true, 'no empleado rows')
    return
  }

  await page.goto(`/empleados/${id}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800) // let pendientes fetch resolve

  // Click the Pendientes tab
  await page.locator('button').filter({ hasText: 'Pendientes' }).first().click({ timeout: 5000 })
  await page.waitForTimeout(500)

  // The pendientes panel is visible
  const pendientesPanel = page.getByTestId('pendientes-tab')
  await expect(pendientesPanel).toBeVisible({ timeout: 5000 })

  // Click Add pendiente
  const addBtn = page.getByTestId('pendiente-add-btn')
  await expect(addBtn).toBeVisible({ timeout: 5000 })
  await addBtn.click()
  await page.waitForTimeout(300)

  // Fill the dialog
  const uniq = `ui-pend-${Date.now()}`
  await page.getByTestId('pendiente-new-descripcion').fill(uniq)
  await page.getByTestId('pendiente-save').click()
  await page.waitForTimeout(800)

  // The new manual pendiente appears in the list
  const manuals = pendientesPanel.locator('[data-testid="pendiente-manual"]')
  const count = await manuals.filter({ hasText: uniq }).count()
  expect(count, 'new manual pendiente must appear in the panel').toBeGreaterThan(0)

  // Cleanup
  const idText = await manuals.filter({ hasText: uniq }).first().locator('[data-testid^="pendiente-resolve-"]').getAttribute('data-testid')
  if (idText) {
    const pid = idText.replace('pendiente-resolve-', '')
    await page.request.delete(`http://localhost:3101/api/v1/employees/${id}/pendientes/${pid}`)
  }
})
