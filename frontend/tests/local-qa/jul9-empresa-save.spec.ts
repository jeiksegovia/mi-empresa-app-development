/**
 * LOCAL QA — jul-9 (W4 — T14): A6 empresa save regression.
 *
 * Reference: `task-assignment-qa.md` T14 item 3 — W2 fixed the empresa save
 * bug. This spec is a regression guard: edit any writable field via the UI,
 * save, then reload and assert the edit persisted.
 *
 * The form uses PrimeVue InputText components with placeholders, NOT
 * label-associated inputs. We target fields by placeholder.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul9-empresa-save.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 empresa save (A6 regression)', () => {
  test('editing empresa telefono via UI persists across reload', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // 1) Snapshot current telefono + id for cleanup
    const before = await page.request.get(`${API}/empresa`)
    expect(before.status()).toBe(200)
    const beforeData = (await before.json()).data
    const original = (beforeData.telefono as string | null) ?? ''
    const empresaId = beforeData.id

    // 2) Visit empresa edit page
    await page.goto(`${FRONTEND}/empresa/editar`)
    await page.waitForLoadState('networkidle')

    // 3) Edit telefono via placeholder-targeted InputText (PrimeVue does
    //    not associate label→id so getByLabel fails)
    const sentinel = `601${Date.now().toString().slice(-7)}`
    const telefonoInput = page.getByPlaceholder('6014567890')
    await expect(telefonoInput).toBeVisible({ timeout: 5000 })
    await telefonoInput.fill(sentinel)

    // 4) Capture PUT /empresa/:id from the moment we click save
    const putPromise = page.waitForResponse(
      (r) => /\/api\/v1\/empresa\/\d+$/.test(r.url()) && r.request().method() === 'PUT',
      { timeout: 15000 },
    )

    // 5) Click the guardar button (data-testid: empresa-guardar)
    await page.getByTestId('empresa-guardar').click()
    const putResp = await putPromise
    expect([200]).toContain(putResp.status())

    // 6) Reload the page and read the value via API (most robust check).
    //    The empresa router only exposes GET / (no GET /:id), so we use that.
    await page.reload()
    await page.waitForLoadState('networkidle')
    const after = await page.request.get(`${API}/empresa`)
    expect(after.status()).toBe(200)
    const afterData = (await after.json()).data
    expect(afterData.id).toBe(empresaId)
    expect(afterData.telefono).toBe(sentinel)

    // 7) Restore the original value
    await page.request.put(`${API}/empresa/${empresaId}`, {
      data: { telefono: original || null },
    }).catch(() => {})
  })
})
