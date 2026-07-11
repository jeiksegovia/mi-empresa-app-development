/**
 * LOCAL QA — jul-9 (W4 — T14): A4-UI — comprobante on CertificadoUpdate UI.
 *
 * Reference: `task-assignment-qa.md` T14 item 2 — verify the Agregar
 * actualización dialog carries a comprobante dropzone + that the historial
 * list shows a comprobante download button once an update has a
 * comprobantePagoUrl.
 *
 * Strategy:
 *   1) Create a throwaway cert via API.
 *   2) Verify the Agregar dialog renders the `cert-update-comprobante-dropzone`
 *      testid when opened (UI affordance).
 *   3) Attach an update with comprobantePagoUrl via API.
 *   4) Reload the page; assert the historial list now shows
 *      `cert-update-comprobante-download` testid.
 *   5) Cleanup.
 *
 * We bypass the actual file-upload because PrimeVue's hidden input + dropzone
 * interactions are flaky in local-qa. The API + UI assertion pattern proves
 * the contract on the wire + the UI rendering side.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul9-cert-update-comprobante.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 cert update — comprobante UI (A4-UI)', () => {
  test('Agregar dialog exposes comprobante dropzone; historial shows comprobante download after update', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // 1) Create a throwaway cert
    const uniq = `${Date.now()}`
    const create = await page.request.post(`${API}/certificates`, {
      data: {
        nombre: `Jul9 Comp ${uniq}`,
        tipoCertificado: 'TRIBUTARIOS',
        periodicidad: 'UNICA',
      },
    })
    expect(create.status()).toBe(201)
    const certId = (await create.json()).data.id

    // 2) Visit cert detail and open the Agregar dialog
    await page.goto(`${FRONTEND}/certificados/${certId}`)
    await page.waitForLoadState('networkidle')

    const addBtn = page.getByTestId('cert-add-update-btn')
    await expect(addBtn).toBeVisible({ timeout: 5000 })
    await addBtn.click()

    // 3) Assert the comprobante dropzone is present in the dialog UI
    const dialog = page.getByTestId('cert-add-update-dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })
    await expect(page.getByTestId('cert-update-comprobante-dropzone')).toBeVisible({ timeout: 3000 })

    // 4) Close the dialog (cancel button is inside the dialog)
    const cancelBtn = dialog.locator('button').filter({ hasText: /Cancelar/i }).first()
    if (await cancelBtn.count()) {
      await cancelBtn.click({ timeout: 3000 }).catch(() => {})
    }

    // 5) Append an update with comprobantePagoUrl via API (deterministic)
    const update = await page.request.post(`${API}/certificates/${certId}/updates`, {
      data: {
        notas: `Jul9 Comp ${uniq}`,
        comprobantePagoUrl: `https://files.example.com/cert-updates/comprobante-${uniq}.pdf`,
      },
    })
    expect(update.status()).toBe(201)

    // 6) Reload to let the page refetch updates; assert the historial list
    //    shows a comprobante download button.
    await page.reload()
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('cert-update-comprobante-download').first()).toBeVisible({ timeout: 8000 })

    // 7) Cleanup
    await page.request.delete(`${API}/certificates/${certId}`).catch(() => {})
  })
})
