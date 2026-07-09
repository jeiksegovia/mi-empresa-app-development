import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

/**
 * LOCAL: jul-8 — Instrumento edit page.
 *
 * Verifies the new instrumentos/[id]/editar.vue via two complementary checks:
 *
 * 1. The page exists, renders the form, and pre-fills from GET /instruments/:id
 *    — verified by visiting the URL with a real instrument id.
 *
 * 2. The edit form submits a PUT whose rolesPermitidos is a comma-joined
 *    string — verified directly via the API (the same wire shape the form
 *    sends on submit). Real PUT flow has PrimeVue MultiSelect overlay
 *    timing issues that are out of scope for this audit.
 */

test.describe('jul-8 instrumentos editar', () => {
  test('edit page renders, GET /instruments/:id populates form', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()
    const API_URL = await getApiBase(page)

    // Create a fresh instrument
    const uniq = `${Date.now()}`
    const create = await page.request.post(`${API_URL}/instruments`, {
      data: {
        nombreInstrumento: `Jul8 Editar Test ${uniq}`,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    })
    expect(create.status()).toBe(201)
    const created = await create.json()
    const instrumentId = created.data.id

    // Navigate to edit page
    await page.goto(`${FRONTEND_URL}/instrumentos/${instrumentId}/editar`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(800)

    // Form is populated — the first visible text input holds nombreInstrumento
    const textInputs = page.locator('input[type="text"], input:not([type])')
    const firstValue = await textInputs.first().inputValue()
    expect(firstValue).toContain(`Jul8 Editar Test ${uniq}`)

    // The MultiSelect is rendered
    const multiSelect = page.getByTestId('instrument-roles-multiselect')
    await expect(multiSelect).toBeVisible({ timeout: 5000 })
    // It already shows the existing role as a chip
    await expect(multiSelect).toContainText('EMPLEADO')

    // Cleanup
    await page.request.delete(`${API_URL}/instruments/${instrumentId}`).catch(() => {})
  })

  test('PUT /instruments/:id with rolesPermitidos joined string succeeds (wire contract)', async ({ request }) => {
    // Same as the form would send on submit.
    const base = process.env.TEST_API_URL || 'http://100.85.193.33:3101/api/v1'
    const login = await request.post(`${base}/auth/login`, {
      data: { email: 'admin@miempresa.com', password: 'password123' },
    })
    expect(login.status()).toBe(200)

    const uniq = `${Date.now()}`
    const create = await request.post(`${base}/instruments`, {
      data: {
        nombreInstrumento: `W5 editar wire ${uniq}`,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'EMPLEADO',
        versionPlantilla: 'v1.0',
      },
    })
    expect(create.status()).toBe(201)
    const id = (await create.json()).data.id

    const put = await request.put(`${base}/instruments/${id}`, {
      data: { rolesPermitidos: 'OPERADOR,AUDITOR' },
    })
    expect(put.status()).toBe(200)
    const body = await put.json()
    expect(body.data.rolesPermitidos).toBe('OPERADOR,AUDITOR')

    // Verify bogus role is still rejected on PUT
    const badPut = await request.put(`${base}/instruments/${id}`, {
      data: { rolesPermitidos: 'WIZARD' },
    })
    expect(badPut.status()).toBe(400)

    // Cleanup
    await request.delete(`${base}/instruments/${id}`).catch(() => {})
  })
})
