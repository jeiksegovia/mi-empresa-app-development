/**
 * LOCAL QA — jul-11 B2/B3 regression: create a patient nota THROUGH THE UI
 * dialog, driving the PrimeVue DatePicker for real.
 *
 * Why this spec exists: `jul9-nota-fecha-incidente.spec.ts` created the note
 * via `page.request.post` (API) and only asserted rendering, so the
 * DatePicker Date-object serialization bug (ISO timestamp → backend 400) was
 * invisible to QA. Rule adopted jul-11: every save/POST button gets at least
 * one spec that drives the actual form controls, DatePickers included.
 *
 * Also asserts the toast feedback is VISIBLE (B3 — the page previously had
 * no <Toast /> outlet, so failures were silent).
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul11-notas-ui-create.spec.ts
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
    // Fallback: click today's day number in the visible month grid.
    await panel
      .locator('.p-datepicker-day:not(.p-datepicker-other-month)')
      .filter({ hasText: new RegExp(`^${new Date().getDate()}$`) })
      .first()
      .click()
  }
}

test.describe('jul-11 nota via UI dialog (B2/B3)', () => {
  test('Nueva Nota → DatePicker + contenido → Guardar persists and toasts', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    const patients = await page.request.get(`${API}/patients?limit=1`)
    expect(patients.status()).toBe(200)
    const patientId = (await patients.json()).data?.[0]?.id
    if (!patientId) { test.skip(true, 'No patients seeded'); return }

    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Notas', { exact: false }).first().click()
    await page.getByRole('button', { name: 'Nueva Nota' }).click()

    const contenido = `jul11 UI nota regression ${Date.now()}`

    // Drive the REAL DatePicker (this is what produced the Date-object bug).
    await page.getByTestId('nota-fecha-incidente').locator('input').click()
    await pickTodayInOpenDatepicker(page)

    await page.locator('#contenido').fill(contenido)

    const saveBtn = page.getByRole('button', { name: 'Guardar Nota' })
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // B3: visible success feedback (global <Toast /> outlet in the layout).
    await expect(page.locator('.p-toast-message')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.p-toast-message')).toContainText(/Nota guardada/i)

    // The note is rendered in the list after the refetch.
    await expect(page.getByText(contenido)).toBeVisible({ timeout: 8000 })

    // And it survives a reload (persisted server-side, not just local state).
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.getByText('Notas', { exact: false }).first().click()
    await expect(page.getByText(contenido)).toBeVisible({ timeout: 8000 })
  })
})
