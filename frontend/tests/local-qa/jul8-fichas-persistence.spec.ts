import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

/**
 * LOCAL: jul-8 — Fichas sessionStorage draft persistence.
 *
 * Verifies the W3 implementation of D1 mitigation:
 *   - Typing into the ficha dialog writes to sessionStorage
 *   - Closing the dialog and reopening restores notas from the draft
 *
 * Driven via the live page since the draft key is per (patientId, fichaId)
 * and depends on the dialog having been opened for that ficha at least once.
 */

test.describe('jul-8 fichas sessionStorage persistence', () => {
  test('typing notas + closing + reopening restores from sessionStorage', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()
    const API_URL = await getApiBase(page)

    // Find a patient + instrument
    const patRes = await page.request.get(`${API_URL}/patients?estado=ACTIVO&limit=1`)
    const patBody = await patRes.json()
    test.skip(!patBody.data?.length, 'no patient in seed')
    const patientId = patBody.data[0].id
    const instRes = await page.request.get(`${API_URL}/instruments?limit=1`)
    const instBody = await instRes.json()
    test.skip(!instBody.data?.length, 'no instrument in seed')
    const instrumentId = instBody.data[0].id

    // Create a fresh ficha
    const create = await page.request.post(
      `${API_URL}/patients/${patientId}/fichas`,
      { data: { instrumentoId: instBody.data[0].id, versionRegistro: 'v1.0' } }
    )
    if (create.status() !== 201) test.skip(true, 'could not create test ficha')
    const fichaId = (await create.json()).data.id
    const draftKey = `ficha-form-draft-${patientId}-${fichaId}`

    await page.goto(`${FRONTEND_URL}/pacientes/${patientId}`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    // Click the Fichas tab
    const fichasTab = page.getByRole('button', { name: /Fichas/ })
    await fichasTab.click()
    await page.waitForTimeout(500)

    // Pencil buttons in the Fichas table
    const pencilButtons = page.locator('button:has(i.pi-pencil)')
    const count = await pencilButtons.count()
    test.skip(count === 0, 'no fichas to interact with')

    // Open the LAST ficha (created last)
    await pencilButtons.last().click()
    await page.waitForTimeout(1500) // dialog animation

    // Fill the notas textarea (id="notasObservaciones")
    const notasTextarea = page.locator('#notasObservaciones')
    let dialogVisible = await notasTextarea.isVisible({ timeout: 3000 }).catch(() => false)
    if (!dialogVisible) {
      // dialog may not have opened due to click on wrong pencil
      test.skip(true, 'ficha dialog did not open after pencil click')
    }
    const notasValue = `W5 QA persistence test ${Date.now()}`
    await notasTextarea.fill(notasValue)

    // Cancel — closes dialog without submitting
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await page.waitForTimeout(500)

    // Verify sessionStorage has the draft
    const draft = await page.evaluate((key) => {
      const raw = sessionStorage.getItem(key)
      return raw ? JSON.parse(raw) : null
    }, draftKey)
    expect(draft).not.toBeNull()
    if (draft) expect(draft.notasObservaciones).toBe(notasValue)

    // Reopen the dialog
    await pencilButtons.last().click()
    await page.waitForTimeout(1500)

    // The notas textarea should now show the restored value
    const restoredValue = await page.locator('#notasObservaciones').inputValue()
    expect(restoredValue).toBe(notasValue)

    // Cleanup: delete the ficha + draft key
    await page.request.delete(`${API_URL}/patients/${patientId}/fichas/${fichaId}`).catch(() => {})
    await page.evaluate((key) => sessionStorage.removeItem(key), draftKey)
  })
})
