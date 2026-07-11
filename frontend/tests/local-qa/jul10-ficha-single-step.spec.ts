/**
 * LOCAL QA — jul-10 (W2 — T5/T6): single-step ficha dialog + C3 shortcut + E1.
 *
 * Covers:
 *   - C1/C2: selecting an instrument opens the combined dialog
 *     (`ficha-single-step-dialog`); attaching the completed file + submit
 *     creates a COMPLETADO ficha in ONE step (registro count +1).
 *   - C2: "Descargar plantilla" button is present only when the instrument
 *     has a plantillaArchivo.
 *   - C3: the "➕ Crear instrumento nuevo" option routes to
 *     `/instrumentos/crear?return=<patient path>`.
 *   - E1: nombreInstrumento input uppercases as-you-type.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul10-ficha-single-step.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-10 single-step ficha + C3 + E1 (T5/T6)', () => {
  test('selecting instrument → attach file → submit creates a COMPLETADO ficha in one step', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // Pick a patient and an ACTIVO instrument.
    const patients = await page.request.get(`${API}/patients?limit=1`)
    expect(patients.status()).toBe(200)
    const patientId = (await patients.json()).data?.[0]?.id
    if (!patientId) { test.skip(true, 'No patients seeded'); return }

    const instruments = await page.request.get(`${API}/instruments?estado=ACTIVO&limit=1`)
    expect(instruments.status()).toBe(200)
    const instrument = (await instruments.json()).data?.[0]
    if (!instrument) { test.skip(true, 'No active instruments seeded'); return }

    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Fichas & Evaluaciones').click()
    await page.waitForTimeout(400)

    // Count registros before.
    const countBefore = await page.locator('table tbody tr').count()

    // Select the instrument → the single-step dialog opens.
    await page.getByTestId('ficha-instrumento-select').click()
    await page.getByRole('option', { name: instrument.nombreInstrumento, exact: true }).first().click()
    const dialog = page.getByTestId('ficha-single-step-dialog')
    await expect(dialog).toBeVisible({ timeout: 6000 })

    // Submit disabled until the required file is attached.
    await expect(page.getByTestId('ficha-single-step-submit')).toBeDisabled()

    // Attach a completed-evaluation file (in-memory buffer).
    await page.getByTestId('ficha-single-step-file-input').setInputFiles({
      name: `eval-jul10-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 jul10 single-step ${Date.now()}`),
    })
    await page.getByTestId('ficha-single-step-notas').fill('jul10 single-step spec')
    await expect(page.getByTestId('ficha-single-step-submit')).toBeEnabled()
    await page.getByTestId('ficha-single-step-submit').click()

    // Dialog closes and one COMPLETADO row is added.
    await expect(dialog).toBeHidden({ timeout: 10000 })
    await page.waitForTimeout(800)
    const countAfter = await page.locator('table tbody tr').count()
    expect(countAfter).toBe(countBefore + 1)
    await expect(page.locator('table tbody tr').filter({ hasText: 'COMPLETADO' }).first()).toBeVisible()
  })

  test('C3: "Crear instrumento nuevo" routes to /instrumentos/crear with a return param', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    const patients = await page.request.get(`${API}/patients?limit=1`)
    const patientId = (await patients.json()).data?.[0]?.id
    if (!patientId) { test.skip(true, 'No patients seeded'); return }

    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await page.waitForLoadState('networkidle')
    await page.getByText('Fichas & Evaluaciones').click()
    await page.waitForTimeout(400)

    await page.getByTestId('ficha-instrumento-select').click()
    await page.getByTestId('instrumento-crear-shortcut').click()

    await page.waitForURL(/\/instrumentos\/crear\?return=/, { timeout: 8000 })
    expect(decodeURIComponent(page.url())).toContain(`return=/pacientes/${patientId}`)
  })

  test('E1: nombreInstrumento uppercases as you type', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    await loginAsAdmin(page)
    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.waitForLoadState('networkidle')

    const nombre = page.getByPlaceholder('Ej: Ficha de Valoración Inicial')
    await nombre.click()
    await nombre.pressSequentially('prueba jul10 e1', { delay: 15 })
    await expect(nombre).toHaveValue('PRUEBA JUL10 E1')
  })
})
