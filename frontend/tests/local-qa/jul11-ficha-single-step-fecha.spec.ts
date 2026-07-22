/**
 * LOCAL QA — jul-11 B1 regression: single-step "asignar y completar" WITH the
 * fechaVencimiento DatePicker actually filled.
 *
 * Why this spec exists: `jul10-ficha-single-step.spec.ts` submitted with the
 * optional DatePicker left EMPTY, so the conditional spread omitted the field
 * and the Date-object → ISO-timestamp → 400 regression passed QA unseen.
 * This spec fills every optional field (jul-11 rule: at least one variant of
 * each form spec fills ALL optional fields).
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul11-ficha-single-step-fecha.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

async function pickTodayInOpenDatepicker(page: import('@playwright/test').Page) {
  const panel = page.locator('.p-datepicker-panel')
  await expect(panel).toBeVisible({ timeout: 5000 })
  const today = panel.locator('.p-datepicker-today, td[data-p-today="true"]').first()
  if (await today.count()) {
    await today.click()
  } else {
    await panel
      .locator('.p-datepicker-day:not(.p-datepicker-other-month)')
      .filter({ hasText: new RegExp(`^${new Date().getDate()}$`) })
      .first()
      .click()
  }
}

test.describe('jul-11 single-step ficha WITH fecha (B1)', () => {
  test('attach file + notas + fechaVencimiento → submit creates a COMPLETADO ficha', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

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

    const countBefore = await page.locator('table tbody tr').count()

    await page.getByTestId('ficha-instrumento-select').click()
    await page.getByRole('option', { name: instrument.nombreInstrumento, exact: true }).first().click()
    const dialog = page.getByTestId('ficha-single-step-dialog')
    await expect(dialog).toBeVisible({ timeout: 6000 })

    await page.getByTestId('ficha-single-step-file-input').setInputFiles({
      name: `eval-jul11-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 jul11 single-step con fecha ${Date.now()}`),
    })
    await page.getByTestId('ficha-single-step-notas').fill('jul11 single-step con fechaVencimiento')

    // THE regression trigger: pick a date in the real DatePicker.
    await page.getByTestId('ficha-single-step-vencimiento').locator('input').click()
    await pickTodayInOpenDatepicker(page)

    await expect(page.getByTestId('ficha-single-step-submit')).toBeEnabled()
    await page.getByTestId('ficha-single-step-submit').click()

    // Dialog closes, a COMPLETADO row was added, and feedback is visible.
    await expect(dialog).toBeHidden({ timeout: 10000 })
    await expect(page.locator('.p-toast-message')).toContainText(/Ficha completada/i, { timeout: 8000 })
    await page.waitForTimeout(800)
    const countAfter = await page.locator('table tbody tr').count()
    expect(countAfter).toBe(countBefore + 1)
    await expect(page.locator('table tbody tr').filter({ hasText: 'COMPLETADO' }).first()).toBeVisible()
  })
})
