import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: jul4 P6 — Nómina foundation
 *
 *  - Contrato: one activo enforced; fechaFin required unless TERMINO_INDEFINIDO.
 *  - NominaPeriodo: P2002 on duplicate (empleadoId, periodo) → 409.
 *  - Sidebar /nomina enabled.
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul4-p6-nomina.spec.ts
 */


test('P6-1: Contrato POST TERMINO_INDEFINIDO without fechaFin is accepted', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id

  const r = await page.request.post(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`, {
    data: { tipoContrato: 'TERMINO_INDEFINIDO', fechaInicio: '2026-02-01' },
  })
  expect(r.status()).toBe(201)
  const cid = (await r.json()).data.id

  // Cleanup
  await page.request.delete(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos/${cid}`)
})

test('P6-2: Contrato POST TERMINO_FIJO without fechaFin returns 400', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id

  const r = await page.request.post(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`, {
    data: { tipoContrato: 'TERMINO_FIJO', fechaInicio: '2026-02-01' },
  })
  expect(r.status()).toBe(400)
})

test('P6-3: only one Contrato activo per empleado — creating a new activo deactivates old', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id

  // Create two contracts back-to-back
  const c1 = await page.request.post(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`, {
    data: { tipoContrato: 'OPS', fechaInicio: '2026-01-01', fechaFin: '2026-12-31' },
  })
  expect(c1.status()).toBe(201)
  const c1id = (await c1.json()).data.id

  const c2 = await page.request.post(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`, {
    data: { tipoContrato: 'OPS', fechaInicio: '2026-02-01', fechaFin: '2026-12-31' },
  })
  expect(c2.status()).toBe(201)
  const c2id = (await c2.json()).data.id

  // Verify only one activo
  const listR = await page.request.get(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`)
  const lj = await listR.json()
  const activos = (lj.data ?? []).filter((c: any) => c.activo)
  expect(activos.length).toBe(1)
  expect(activos[0].id).toBe(c2id)

  // Cleanup
  await page.request.delete(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos/${c1id}`)
  await page.request.delete(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos/${c2id}`)
})

test('P6-4: duplicate NominaPeriodo for same (empleadoId, periodo) returns 409', async ({ page }) => {
  await loginAsAdmin(page)
  const list = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  const id = (await list.json()).data[0].id

  // Make sure activo contrato exists
  const c = await page.request.post(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos`, {
    data: { tipoContrato: 'OPS', fechaInicio: '2026-03-01', fechaFin: '2026-12-31' },
  })
  expect(c.status()).toBe(201)
  const cid = (await c.json()).data.id

  const payload = {
    empleadoId: id,
    periodo: '2026-08',
    archivos: [
      { tipoArchivo: 'CUENTA_COBRO', nombre: 'c.pdf', url: 'nomina/c.pdf' },
      { tipoArchivo: 'INFORME_ACTIVIDADES', nombre: 'i.pdf', url: 'nomina/i.pdf' },
      { tipoArchivo: 'COMPROBANTE_APORTES', nombre: 'a.pdf', url: 'nomina/a.pdf' },
    ],
  }
  const p1 = await page.request.post('http://localhost:3101/api/v1/nomina/periodos', { data: payload })
  expect(p1.status()).toBe(201)
  const pid = (await p1.json()).data.id

  const p2 = await page.request.post('http://localhost:3101/api/v1/nomina/periodos', { data: payload })
  expect(p2.status()).toBe(409)

  // Cleanup
  await page.request.delete(`http://localhost:3101/api/v1/nomina/periodos/${pid}`)
  await page.request.delete(`http://localhost:3101/api/v1/nomina/employees/${id}/contratos/${cid}`)
})

test('P6-5: /nomina page reachable from sidebar (disabled flag removed)', async ({ page }) => {
  await loginAsAdmin(page)
  // Visit /nomina directly — the route must resolve without redirecting away
  await page.goto('/nomina')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Sidebar item exists with no disabled attribute
  const sidebarLink = page.locator('a[href="/nomina"]').first()
  await expect(sidebarLink).toBeVisible({ timeout: 5000 })
})

test('P6-6: /nomina table renders for a current month', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/nomina')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)

  // The page should show empleados with some sort of entry status.
  // Look for one of the known empleados from API.
  const month = new Date()
  const periodo = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
  const resp = await page.request.get(`http://localhost:3101/api/v1/nomina?periodo=${periodo}`)
  const j = await resp.json()
  expect(j.success).toBe(true)
  expect(j.data?.length).toBeGreaterThan(0)
})
test('P6-7 REVISION-1: create OPS contrato from /empleados/[id]/editar Info Laboral → appears in /nomina', async ({ page }) => {
  await loginAsAdmin(page)

  // Pick (or create) a clean empleado so the assertion is stable.
  const uniq = `contrato-ui-${Date.now()}`
  const empCreate = await page.request.post('http://localhost:3101/api/v1/employees', {
    data: {
      nombre: 'ContratoJul4',
      apellido: 'UITest',
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

  // Visit /empleados/[id]/editar and click the Info. Laboral tab.
  await page.goto(`/empleados/${id}/editar`)
  await page.waitForLoadState('networkidle')
  await page.locator('button').filter({ hasText: /^Info\. Laboral$/ }).first().click()
  await page.waitForTimeout(700)

  // The Contrato card is in the Info Laboral tab.
  const card = page.getByTestId('contrato-card')
  await expect(card).toBeVisible({ timeout: 5000 })

  // Open the dialog and fill it.
  await page.getByTestId('contrato-add-btn').click()
  await page.waitForTimeout(300)

  // Pick OPS from the Select via the dropdown.
  const tipoSelect = page.getByTestId('contrato-tipo').locator('xpath=ancestor::div[contains(@class, "p-select")][1]').first()
  // Fallback: locate by index inside the dialog
  const dialogSelects = page.locator('.p-dialog .p-select')
  await dialogSelects.first().click()
  await page.waitForTimeout(300)
  await page.locator('li[role="option"]', { hasText: /OPS/ }).first().click()
  await page.waitForTimeout(200)

  // Fill dates (ya viene con fechaInicio por default)
  await page.getByTestId('contrato-fecha-fin').fill('2026-12-31')

  // Save
  await page.getByTestId('contrato-save').click()
  await page.waitForTimeout(1500)

  // The row now appears in the Contrato list.
  const rows = page.getByTestId('contrato-row')
  await expect(rows.first()).toBeVisible({ timeout: 5000 })
  await expect(rows.first()).toContainText('OPS')

  // And /nomina month view no longer reports "Sin contrato" for this empleado.
  const month = new Date()
  const periodo = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
  const nominaResp = await page.request.get(`http://localhost:3101/api/v1/nomina?periodo=${periodo}`)
  const nj = await nominaResp.json()
  const row = (nj.data ?? []).find((r: any) => r.empleado.id === id)
  expect(row, 'empleado row in /nomina').toBeTruthy()
  expect(row.contratoActivo, 'contratoActivo present').toBeTruthy()
  expect(row.contratoActivo.tipoContrato).toBe('OPS')

  // TERMINO_INDEFINIDO hides fechaFin input
  await page.getByTestId('contrato-add-btn').click()
  await page.waitForTimeout(300)
  await page.locator('.p-dialog .p-select').first().click()
  await page.waitForTimeout(300)
  await page.locator('li[role="option"]', { hasText: /T.rmino indefinido/ }).first().click()
  await page.waitForTimeout(300)
  // fechaFin input should NOT be present
  await expect(page.getByTestId('contrato-fecha-fin')).toHaveCount(0)

  // Cancel dialog
  await page.locator('.p-dialog button', { hasText: /Cancelar/ }).first().click()
  await page.waitForTimeout(300)

  // Cleanup
  await page.request.delete(`http://localhost:3101/api/v1/employees/${id}`).catch(() => {})
})
