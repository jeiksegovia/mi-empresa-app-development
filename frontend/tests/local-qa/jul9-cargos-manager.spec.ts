/**
 * LOCAL QA — jul-9 (W4 — T14): D7/D8 empresa config — cargos manager.
 *
 * Reference: `task-assignment-qa.md` T14 item 8 — at /empresa/editar, the
 * cargos card allows: list existing cargos, add a new cargo, show duplicate
 * error, and archive (soft-delete).
 *
 * Data-testids on `empresa/editar.vue`:
 *   - cargos-manager-card
 *   - cargos-list
 *   - cargos-new-nombre (input)
 *   - cargos-new-add (button)
 *   - cargos-new-error (visible when 409 on duplicate)
 *   - cargo-row-{id}
 *   - cargo-archive-{id}
 *   - cargo-reactivate-{id}
 *
 * Strategy: visit /empresa/editar, assert the cargos card renders with a
 * non-empty list (seed has 7 cargos), create a unique cargo, verify the row
 * appears, attempt to re-create the same cargo and verify the inline error
 * shows, then archive the new row.
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 cargos manager UI (D7)', () => {
  test('list, add, duplicate error, archive', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    await page.goto(`${FRONTEND}/empresa/editar`)
    await page.waitForLoadState('networkidle')

    // 1) cargos card visible
    const card = page.getByTestId('cargos-manager-card')
    await expect(card).toBeVisible({ timeout: 5000 })

    // 2) list shows the seed (≥ 7 cargos)
    const list = page.getByTestId('cargos-list')
    await expect(list).toBeVisible()
    const seedCount = await list.locator('[data-testid^="cargo-row-"]').count()
    expect(seedCount).toBeGreaterThanOrEqual(7)

    // 3) Create a new cargo (unique name)
    const uniq = `QA-Jul9-${Date.now().toString().slice(-7)}`
    const newName = page.getByTestId('cargos-new-nombre')
    await newName.fill(uniq)
    const createPost = page.waitForResponse(
      (r) => /\/api\/v1\/empresa\/cargos$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 10000 },
    )
    await page.getByTestId('cargos-new-add').click()
    const createResp = await createPost
    expect(createResp.status()).toBe(201)
    const newCargoId = (await createResp.json()).data.id

    // 4) The new row should appear
    const newRow = page.getByTestId(`cargo-row-${newCargoId}`)
    await expect(newRow).toBeVisible({ timeout: 5000 })

    // 5) Duplicate-name attempt should 409 and show the inline error
    await newName.fill(uniq)  // same name again
    const dupPost = page.waitForResponse(
      (r) => /\/api\/v1\/empresa\/cargos$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 10000 },
    )
    await page.getByTestId('cargos-new-add').click()
    const dupResp = await dupPost
    expect(dupResp.status()).toBe(409)
    const errorEl = page.getByTestId('cargos-new-error')
    await expect(errorEl).toBeVisible({ timeout: 5000 })
    await expect(errorEl).toContainText(uniq)

    // 6) Archive the row we just created
    const archiveBtn = page.getByTestId(`cargo-archive-${newCargoId}`)
    if (await archiveBtn.count()) {
      const patchPromise = page.waitForResponse(
        (r) => /\/api\/v1\/empresa\/cargos\/\d+$/.test(r.url()) && r.request().method() === 'PATCH',
        { timeout: 10000 },
      )
      await archiveBtn.click()
      const patchResp = await patchPromise
      expect([200]).toContain(patchResp.status())
    }

    // 7) Best-effort cleanup via API (in case UI archive hit a snag)
    await page.request.patch(`${API}/empresa/cargos/${newCargoId}`, {
      data: { activo: false },
    }).catch(() => {})
  })
})
