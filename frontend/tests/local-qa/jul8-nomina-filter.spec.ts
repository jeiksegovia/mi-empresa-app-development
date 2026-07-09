import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

/**
 * LOCAL: jul-8 — Nomina filtro tipoContrato.
 *
 * Verifies the W3 nomina/index.vue:
 *   - Default filter = with-contract (no SIN_CONTRATO) — verified via the
 *     page-load /nomina call's query params (no tipoContrato param,
 *     or tipoContrato set to only 'with contract' tipos).
 *   - MultiSelect includes SIN_CONTRATO option (wire = NONE) — verified
 *     by waiting for that label to be present in the overlay.
 *
 * Avoids driving the PrimeVue MultiSelect overlay (flaky cross-version);
 * verifies the wire behavior end-to-end via the API.
 */

test.describe('jul-8 nomina filter', () => {
  test('default filter on page load does NOT include tipoContrato=NONE', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()
    const API_URL = await getApiBase(page)

    // Capture the initial /nomina request from the page
    const initialGet = page.waitForResponse(
      (r) => /\/api\/v1\/nomina/.test(r.url()) && r.request().method() === 'GET',
      { timeout: 30000 }
    )

    await page.goto(`${FRONTEND_URL}/nomina`)
    await page.waitForLoadState('networkidle')

    const resp = await initialGet
    expect(resp.status()).toBe(200)
    const url = resp.url()
    // Per D5: default (no param) returns only empleados with active contract.
    // If tipoContrato IS sent, it must NOT contain NONE.
    expect(url).toContain('periodo=')
    if (url.includes('tipoContrato=')) {
      expect(url).not.toContain('NONE')
    }
  })

  test('the filter MultiSelect is rendered with the SIN_CONTRATO option available', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()

    await page.goto(`${FRONTEND_URL}/nomina`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    const filter = page.getByTestId('nomina-tipo-filter')
    await expect(filter).toBeVisible({ timeout: 5000 })

    // Open the dropdown — the option "Sin contrato" must be present
    await filter.click()
    await page.waitForTimeout(300)
    const sinContrato = page.getByText('Sin contrato').first()
    await expect(sinContrato).toBeVisible({ timeout: 3000 })
    await page.keyboard.press('Escape')
  })

  test('API contract: tipoContrato=NONE returns only contract-less empleados', async ({ request }) => {
    // Wire-level proof of the user requirement: filtering by NONE on the wire
    // returns only contract-less rows. Mirrors what the filter UI submits.
    const base = process.env.TEST_API_URL || 'http://100.85.193.33:3101/api/v1'
    const login = await request.post(`${base}/auth/login`, {
      data: { email: 'admin@miempresa.com', password: 'password123' },
    })
    expect(login.status()).toBe(200)

    const resp = await request.get(`${base}/nomina?periodo=2099-01&tipoContrato=NONE`)
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    expect(body.success).toBe(true)
    for (const row of body.data) {
      // Every row in the NONE filter must have contratoActivo = null
      expect(row.contratoActivo).toBeNull()
    }
  })
})
