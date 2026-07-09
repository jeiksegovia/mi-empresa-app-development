import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

/**
 * LOCAL: jul-8 — Certificate Agregar actualización flow.
 *
 * Verifies the W4 frontend on certificados/[id].vue:
 *   - "Historial de actualizaciones" card renders GET /:id/updates
 *   - "Agregar actualización" button opens dialog
 *   - Submit POSTs to /:id/updates and refreshes the history list
 */

test.describe('jul-8 cert updates', () => {
  test('historial renders empty state, Agregar dialog POSTs and refreshes list', async ({ page }) => {
    const FRONTEND_URL = getFrontendOrigin()
    await loginAsAdmin(page)
    const API_URL = await getApiBase(page)

    // 1) Create a fresh cert via API to ensure we have an id to work with
    const uniq = `${Date.now()}`
    const create = await page.request.post(`${API_URL}/certificates`, {
      data: {
        nombre: `Jul8 Updates Test ${uniq}`,
        tipoCertificado: 'TRIBUTARIOS',
        periodicidad: 'UNICA',
      },
    })
    expect(create.status()).toBe(201)
    const created = await create.json()
    const certId = created.data.id

    // 2) Visit the cert detail page
    await page.goto(`${FRONTEND_URL}/certificados/${certId}`)
    await page.waitForLoadState('networkidle')

    // 3) Historial card present
    const historyCard = page.getByText('Historial de actualizaciones')
    await expect(historyCard).toBeVisible({ timeout: 5000 })

    // 4) Empty state visible (we just created the cert, no updates yet)
    const emptyState = page.getByTestId('cert-updates-empty')
    await expect(emptyState).toBeVisible({ timeout: 5000 })

    // 5) Click Agregar actualización
    const addBtn = page.getByTestId('cert-add-update-btn')
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    // 6) Dialog opens
    const dialog = page.getByTestId('cert-add-update-dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // 7) Fill the notas field + a future expiration date
    await page.locator('textarea').last().fill(`W5 QA add update ${uniq}`)
    const futureDate = '2030-12-31'
    // The date input is the last <input type=date> in the dialog
    const dateInputs = dialog.locator('input[type=date]')
    await dateInputs.last().fill(futureDate)

    // 8) Capture the POST request so we can verify payload + 201
    const updatePostPromise = page.waitForResponse(
      (r) => r.url().includes(`/api/v1/certificates/${certId}/updates`) && r.request().method() === 'POST'
    )

    await page.getByTestId('cert-add-update-submit').click()
    const updateResp = await updatePostPromise
    expect(updateResp.status()).toBe(201)
    const updateBody = await updateResp.json()
    expect(updateBody.data.update.notas).toContain(uniq)
    expect(updateBody.data.certificate.estado).toBe('VIGENTE')

    // 9) Dialog should be closed + history list should now show the row
    await expect(dialog).toBeHidden({ timeout: 5000 })
    const list = page.getByTestId('cert-updates-list')
    await expect(list).toBeVisible({ timeout: 5000 })
    await expect(list).toContainText(uniq)

    // 10) Cleanup (best-effort)
    await page.request.delete(`${API_URL}/certificates/${certId}`).catch(() => {})
  })
})
