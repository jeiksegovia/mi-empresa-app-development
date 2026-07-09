import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: P3 — TipoVivienda enum (PROPIA/ARRENDADA/FAMILIAR) + Salario on Cargo
 *
 *  - /empleados/nuevo step 1: TipoVivienda Select lists 3 new options
 *  - /empleados/nuevo step 3: Salario field visible (scoped via data-step="3")
 *  - API: PUT /employees/:id/cargos accepts `salario` and persists it
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/p3-empleado-fields.spec.ts
 */


test('P3-1: TipoVivienda Select in /empleados/nuevo lists PROPIA / ARRENDADA / FAMILIAR', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/empleados/nuevo')
  await page.waitForLoadState('networkidle')

  // Find the TipoVivienda Select — it's the one whose label is "Tipo Vivienda"
  const viviendaLabel = page.locator('label', { hasText: /tipo vivienda/i }).first()
  await viviendaLabel.waitFor()
  await viviendaLabel.locator('xpath=following::div[contains(@class,"p-select")][1]').click()

  await page.waitForTimeout(300)
  const overlayText = await page.locator('body').textContent()
  for (const expected of ['Propia', 'Arrendada', 'Familiar']) {
    expect(overlayText).toContain(expected)
  }
  // Make sure the OLD values are gone (use word boundaries to avoid false positives)
  expect(overlayText).not.toMatch(/^Casa\b|\bCasa\b/)
  expect(overlayText).not.toMatch(/^Apartamento\b|\bApartamento\b/)
  expect(overlayText).not.toMatch(/^Lote\b|\bLote\b/)
})

test('P3-2: Salario field is rendered on cargo row in /empleados/nuevo step 3', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/empleados/nuevo')
  await page.waitForLoadState('networkidle')

  // Fill step 1 minimum required fields using placeholders.
  await page.getByPlaceholder('Nombres').fill('P3')
  await page.getByPlaceholder('Apellidos').fill('Test')
  await page.getByPlaceholder('Número de documento').fill(`${Date.now()}`)
  // Genero is a Select on step 1
  await page.locator('label', { hasText: /^género/i }).first().locator('xpath=following::div[contains(@class,"p-select")][1]').click()
  await page.waitForTimeout(200)
  await page.locator('li[role="option"]').first().click()
  // Fecha Nacimiento
  await page.locator('input[type="date"]').first().fill('1990-01-01')

  // Click "Siguiente" button to advance
  const nextBtn = page.locator('button', { hasText: /siguiente/i }).first()
  await nextBtn.click()
  await page.waitForTimeout(400)
  await nextBtn.click()
  await page.waitForTimeout(400)

  // Now we should be on step 3 — click "Agregar" to add a cargo row.
  const step3 = page.locator('[data-step="3"]')
  const agregarBtn = step3.locator('button', { hasText: /^agregar$/i }).first()
  await expect(agregarBtn).toBeVisible({ timeout: 5000 })
  await agregarBtn.click()

  // After click, the cargo row renders and contains "Salario" label.
  await expect(step3.locator('label', { hasText: /^salario/i }).first()).toBeVisible({ timeout: 5000 })

  const step3Text = await step3.textContent()
  expect(step3Text, 'salario help text should be visible in step 3').toMatch(/se extraer[áa] de n[óo]mina/i)
})

test('P3-3: PUT /employees/:id/cargos accepts salario and persists it', async ({ page, request }) => {
  // Use the page.request (which inherits the auth cookie from a prior login flow
  // if the same page is used). To keep this test self-contained, hit the public
  // listing endpoint via login + then PUT. Simpler: login first to set the cookie.
  await loginAsAdmin(page)

  const listResp = await page.request.get('http://localhost:3101/api/v1/employees?limit=1')
  expect(listResp.status()).toBe(200)
  const listBody = await listResp.json()
  const empId = listBody?.data?.[0]?.id
  expect(empId, 'must have at least one employee').toBeTruthy()

  const today = new Date().toISOString().slice(0, 10)
  const cargoName = `P3 cargo ${Date.now()}`
  const r = await page.request.put(`http://localhost:3101/api/v1/employees/${empId}/cargos`, {
    data: {
      cargos: [
        {
          nombreCargo: cargoName,
          ubicacion: 'P3 test location',
          fechaIngreso: today,
          salario: 2500000.5,
        },
      ],
    },
  })
  expect(r.status(), `PUT failed: ${await r.text()}`).toBe(200)

  // Re-fetch to confirm persistence
  const verify = await page.request.get(`http://localhost:3101/api/v1/employees/${empId}`)
  expect(verify.status()).toBe(200)
  const detail = await verify.json()
  const persisted = (detail.data.cargos ?? []).find((c: any) => c.nombreCargo === cargoName)
  expect(persisted, 'cargo should be persisted with salario').toBeTruthy()
  expect(Number(persisted.salario)).toBe(2500000.5)
})
test('P3-4: FIX-5 — POST /employees with cargo salario persists it on the create path', async ({ page }) => {
  await loginAsAdmin(page)
  const uniq = `FIX5-${Date.now()}`
  const today = new Date().toISOString().slice(0, 10)
  const r = await page.request.post('http://localhost:3101/api/v1/employees', {
    data: {
      nombre: 'FIX5',
      apellido: 'CreateSalario',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      genero: 'MASCULINO',
      fechaNacimiento: '1990-01-01',
      cargos: [
        {
          nombreCargo: 'FIX-5 cargo',
          ubicacion: 'FIX-5 location',
          fechaIngreso: today,
          salario: 3000000.0,
        },
      ],
    },
  })
  expect(r.status(), `POST failed: ${await r.text()}`).toBe(201)
  const created = (await r.json()).data
  expect(Number(created?.cargos?.[0]?.salario)).toBe(3000000.0)
})
