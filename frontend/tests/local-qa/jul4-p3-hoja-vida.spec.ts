import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase } from '../helpers/auth'

/**
 * LOCAL: jul4 P3 — Hoja de vida
 *
 *  - PUT /employees/:id accepts hojaVidaUrl and persists it on Empleado.
 *  - /empleados/[id]/editar tab 3 (Info. Laboral) shows a "Hoja de Vida" card
 *    with an upload control + "Guardar Hoja de Vida" button.
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul4-p3-hoja-vida.spec.ts
 */


test('P3-1: PUT /employees/:id persists hojaVidaUrl on Empleado', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const lj = await list.json()
  const id = lj?.data?.[0]?.id
  expect(id, 'need an existing empleado').toBeTruthy()

  const key = `hojas-vida/jul4-test-${Date.now()}.pdf`
  const put = await page.request.put(`${API_URL}/employees/${id}`, {
    data: { hojaVidaUrl: key },
  })
  expect(put.status(), 'PUT status').toBe(200)

  const detail = await page.request.get(`${API_URL}/employees/${id}`)
  const det = await detail.json()
  expect(det?.data?.hojaVidaUrl, 'hojaVidaUrl persisted').toBe(key)
})

test('P3-2: /empleados/[id]/editar tab 3 shows the Hoja de Vida upload card', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const lj = await list.json()
  const id = lj?.data?.[0]?.id
  if (!id) {
    test.skip(true, 'no empleado rows')
    return
  }

  await page.goto(`/empleados/${id}/editar`)
  await page.waitForLoadState('networkidle')

  // Switch to tab 3 (Info. Laboral) — the tabs are plain <button>s with text
  await page.getByRole('button', { name: /Info\. Laboral/ }).click({ timeout: 5000 })
  await page.waitForTimeout(600)

  // The new "Hoja de Vida" card heading — loose match (icon glyph may precede text)
  const hojaVidaCard = page
    .locator('h3')
    .filter({ hasText: /hoja de vida/i })
    .first()
  await expect(hojaVidaCard).toBeVisible({ timeout: 5000 })

  // Either the upload input is present (no hojaVidaUrl yet)
  // or the download button is visible (already set).
  const uploadInput = page.getByTestId('hoja-vida-input')
  const downloadBtn = page.getByTestId('hoja-vida-download')
  const either = (await uploadInput.count()) > 0 || (await downloadBtn.count()) > 0
  expect(either, 'either upload-input or download-btn must be present').toBeTruthy()

  // Save button is in the card
  const saveBtn = page.getByTestId('hoja-vida-save')
  await expect(saveBtn).toBeVisible({ timeout: 5000 })
})
