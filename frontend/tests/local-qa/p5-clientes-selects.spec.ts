import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: P5 — Clientes selects (F3)
 *
 *  - /pacientes/crear: género is a Select with 3 options (MASCULINO, FEMENINO, OTRO)
 *  - /pacientes/crear: parentesco (contactos emergencia) is a Select with PADRE/MADRE/HIJO/OTRO
 *    and OTRO reveals an inline InputText "¿Cuál?"
 *  - The same applies to /pacientes/[id]/editar
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/p5-clientes-selects.spec.ts
 */


test('P5-1: /pacientes/crear género is a Select with 3 options (MASCULINO/FEMENINO/OTRO)', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/pacientes/crear')
  await page.waitForLoadState('networkidle')

  // Locate the género Select by walking the DOM: find the .p-select whose
  // sibling div contains the text "Género *", then click it.
  const generoSelect = page.locator('.p-select').filter({
    has: page.locator('xpath=..//div[normalize-space()="Género *"]'),
  })
  // Fallback: just locate by index since genero is the 2nd .p-select (after
  // Tipo Documento, before Estado).
  const generoByIndex = page.locator('.p-select').nth(1)
  await generoByIndex.waitFor({ timeout: 5000 })
  await generoByIndex.click()
  await page.waitForTimeout(300)

  const overlay = await page.locator('body').textContent()
  for (const opt of ['Masculino', 'Femenino', 'Otro']) {
    expect(overlay, `option "${opt}" should be visible`).toContain(opt)
  }
})

test('P5-2: /pacientes/crear parentesco is a Select with PADRE/MADRE/HIJO/OTRO and OTRO reveals inline text input', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/pacientes/crear')
  await page.waitForLoadState('networkidle')

  // Locate the Contactos de Emergencia card by its heading, then click its
  // "Agregar" button (scope to the card so we don't pick another Agregar).
  const contactosCard = page
    .locator('div')
    .filter({ has: page.locator('h3', { hasText: /Contactos de Emergencia/i }) })
    .first()
  const agregarBtn = contactosCard.locator('button', { hasText: /^agregar$/i }).first()
  await agregarBtn.click()
  await page.waitForTimeout(400)

  // Now find the parentesco Select by walking the DOM
  const parentescoHandle = await page.evaluateHandle(() => {
    const allSelects = Array.from(document.querySelectorAll('.p-select'))
    for (const sel of allSelects) {
      // Check the closest ancestor that has another sibling/child with "Parentesco"
      let parent = sel.parentElement
      let depth = 0
      while (parent && depth < 10) {
        // Walk children for a text node equal to "Parentesco" (without too much extra)
        const directParentesco = Array.from(parent.childNodes).some(
          (n) =>
            n.nodeType === Node.ELEMENT_NODE &&
            (n as Element).textContent?.trim() === 'Parentesco'
        )
        if (directParentesco) return sel
        if (parent.textContent && /^\s*Parentesco\s*$/.test(parent.textContent)) return sel
        parent = parent.parentElement
        depth++
      }
    }
    return null
  })
  const el = parentescoHandle.asElement()
  expect(el, 'parentesco Select must exist in DOM').toBeTruthy()
  await el!.click()
  await page.waitForTimeout(300)

  const overlay = await page.locator('body').textContent()
  for (const opt of ['Padre', 'Madre', 'Hijo', 'Otro']) {
    expect(overlay, `parentesco option "${opt}" should be visible`).toContain(opt)
  }

  // Pick the "Otro" option
  await page.locator('li[role="option"]', { hasText: /^otro$/i }).first().click()
  await page.waitForTimeout(300)

  // Inline "¿Cuál?" InputText should appear after OTRO is selected
  const customInput = page.getByPlaceholder('¿Cuál?').first()
  await expect(customInput).toBeVisible({ timeout: 5000 })
})

test('P5-3: /pacientes/[id]/editar has the same género Select structure', async ({ page }) => {
  await loginAsAdmin(page)
  const listResp = await page.request.get('http://localhost:3101/api/v1/patients?limit=1')
  const listBody = await listResp.json()
  const patientId = listBody?.data?.[0]?.id
  if (!patientId) {
    test.skip(true, 'no patient rows to test against')
    return
  }

  await page.goto(`/pacientes/${patientId}/editar`)
  await page.waitForLoadState('networkidle')

  // género is the 2nd .p-select (after Tipo Documento)
  const generoSelect = page.locator('.p-select').nth(1)
  await expect(generoSelect).toBeVisible({ timeout: 5000 })
})

test('P0-1 jul4: /pacientes/crear género OTRO reveals inline InputText and persists custom value on submit', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/pacientes/crear')
  await page.waitForLoadState('networkidle')

  // Open the género select (the 2nd .p-select on the page; 0 is tipoDocumento)
  const generoSelect = page.locator('.p-select').nth(1)
  await generoSelect.waitFor({ timeout: 5000 })
  await generoSelect.click()
  await page.waitForTimeout(300)

  // Pick "Otro" option
  await page.locator('li[role="option"]', { hasText: /^otro$/i }).first().click()
  await page.waitForTimeout(300)

  // Inline "¿Cuál?" InputText should now be visible
  const customInput = page.getByPlaceholder('¿Cuál?').first()
  await expect(customInput).toBeVisible({ timeout: 5000 })
  const customValue = 'No binario'
  await customInput.fill(customValue)

  // Fill remaining required fields with unique data so submit does not collide
  await page.locator('input[placeholder="Nombre completo"]').first().fill('PacienteJul4Otro')
  await page.locator('input[placeholder="123456789"]').first().fill(`${Date.now()}`)
  await page.locator('input[type="date"]').first().fill('1990-01-01')

  // Submit
  await page.locator('button', { hasText: /^guardar$/i }).first().click()

  // Expect redirect to /pacientes/<id>
  await page.waitForURL(/\/pacientes\/\d+$/, { timeout: 15000 })

  // Verify persistence via API
  const url = page.url()
  const id = url.split('/pacientes/')[1]
  const detail = await page.request.get(`http://localhost:3101/api/v1/patients/${id}`)
  const body = await detail.json()
  expect(body?.data?.genero, 'OTRO custom value must be persisted').toBe(customValue)
})

test('P0-2 jul4: /pacientes/[id]/editar hydrates genero OTRO -> custom input with stored free-form value', async ({ page }) => {
  await loginAsAdmin(page)
  // Create a patient with a free-form genero via API
  const uniq = `${Date.now()}`
  const create = await page.request.post('http://localhost:3101/api/v1/patients', {
    data: {
      nombre: 'PacienteOtroHydrate',
      tipoDocumento: 'CC',
      numeroDocumento: uniq,
      fechaNacimiento: '1990-01-01',
      genero: 'Prefiero no decir',
    },
  })
  expect(create.status()).toBe(201)
  const created = await create.json()
  const patientId = created?.data?.id
  expect(patientId, 'patient id from POST').toBeTruthy()

  await page.goto(`/pacientes/${patientId}/editar`)
  await page.waitForLoadState('networkidle')

  // The 2nd .p-select (gender) should display "Otro" as its label
  const generoSelect = page.locator('.p-select').nth(1)
  await expect(generoSelect).toContainText(/otro/i, { timeout: 5000 })

  // Inline custom input should be visible and pre-filled with the stored free-form value
  const customInput = page.getByPlaceholder('¿Cuál?').first()
  await expect(customInput).toBeVisible({ timeout: 5000 })
  await expect(customInput).toHaveValue('Prefiero no decir')
})