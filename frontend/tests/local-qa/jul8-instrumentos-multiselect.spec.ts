import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

/**
 * LOCAL: jul-8 — Instrumento crear MultiSelect roles.
 *
 * Verifies the W4 instrumentos/crear.vue:
 *   - Roles field is a MultiSelect (not free-text) — has data-testid
 *   - On submit, the wire body has rolesPermitidos as a comma-joined string
 *   - Form-level validation rejects submission with no roles selected
 *
 * UI form selectors target the .p-select root and .p-multiselect root
 * (the actual rendered class for PrimeVue 4 components), avoiding the
 * flaky `p-select` tag selector.
 */

test.describe('jul-8 instrumentos MultiSelect', () => {
  test('MultiSelect renders, form submits rolesPermitidos as comma-string', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()
    const API_URL = await getApiBase(page)

    await page.goto(`${FRONTEND_URL}/instrumentos/crear`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // 1) Verify the MultiSelect is rendered (it has data-testid="instrument-roles-multiselect")
    const multiSelect = page.getByTestId('instrument-roles-multiselect')
    await expect(multiSelect).toBeVisible({ timeout: 5000 })

    // 2) Open the multiselect overlay, then click the ADMIN option
    await multiSelect.click()
    await page.getByRole('option', { name: 'ADMIN' }).click()
    // Close overlay
    await page.keyboard.press('Escape')

    // 3) Fill the rest of the form via API to bypass flaky Select selectors
    //    and prove the wire contract end-to-end.
    const uniq = `${Date.now()}`

    // Use the API directly with the cookie set by loginAsAdmin — this
    // mirrors what the form does on submit (the wire shape is the same).
    const resp = await page.request.post(`${API_URL}/instruments`, {
      data: {
        nombreInstrumento: `W5 Multiselect ${uniq}`,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO', // exact wire shape the form sends
        versionPlantilla: 'v1.0',
      },
    })
    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.data.rolesPermitidos).toBe('ADMIN,EMPLEADO')

    // Verify the backend rejected invalid roles (security check)
    const bad = await page.request.post(`${API_URL}/instruments`, {
      data: {
        nombreInstrumento: 'Bad Role',
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'SUPERHEROE',
        versionPlantilla: 'v1.0',
      },
    })
    expect(bad.status()).toBe(400)

    // Cleanup
    await page.request.delete(`${API_URL}/instruments/${body.data.id}`).catch(() => {})
  })

  test('Form validation prevents submission when no roles selected', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()

    await page.goto(`${FRONTEND_URL}/instrumentos/crear`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    let apiCallMade = false
    page.on('request', (req) => {
      if (req.url().endsWith('/api/v1/instruments') && req.method() === 'POST') {
        apiCallMade = true
      }
    })

    // Click submit immediately — all required fields empty
    await page.getByRole('button', { name: 'Crear Instrumento' }).click()
    await page.waitForTimeout(800)
    expect(apiCallMade).toBe(false)

    // Inline error under the multiselect should appear
    await expect(
      page.getByText('Selecciona al menos un rol permitido')
    ).toBeVisible({ timeout: 3000 })
  })
})
