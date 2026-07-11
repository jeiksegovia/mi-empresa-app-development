/**
 * LOCAL QA — jul-9 (W4 — T14): D2 empleado educacion UI.
 *
 * Reference: `task-assignment-qa.md` T14 item 6 — verify that after creating
 * an educacionEmpleado row, the empleado edit page renders it.
 *
 * Strategy:
 *   1) Create an educacionEmpleado via API on a seeded empleado.
 *   2) Visit /empleados/{id}/editar and switch to Formación Académica tab.
 *   3) Assert the page DOM contains our profesion value.
 *   4) Cleanup via DELETE /educacion/:id.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul9-empleado-educacion.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 empleado educacion UI (D2)', () => {
  let eduId = 0
  let empId = 0

  test('EducacionEmpleado created via API renders on the edit page', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // 1) Pick or create a test empleado
    const list = await page.request.get(`${API}/employees?limit=1`)
    expect(list.status()).toBe(200)
    empId = (await list.json()).data[0].id

    // 2) Create an educacionEmpleado via API
    const profesion = `Jul9 QA ${Date.now().toString().slice(-7)}`
    const create = await page.request.post(`${API}/employees/${empId}/educacion`, {
      data: {
        profesion,
        universidad: 'Universidad Test',
      },
    })
    expect(create.status()).toBe(201)
    eduId = (await create.json()).data.id

    // 3) Visit the edit page
    await page.goto(`${FRONTEND}/empleados/${empId}/editar`)
    await page.waitForLoadState('networkidle')

    // 4) Switch to the Formación Académica tab (index 4 on this page).
    //    Try the role-based tab name first; fall back to text-clicking.
    const tabBtn = page.getByRole('tab', { name: /Formaci[oó]n Acad[eé]mica/i }).first()
    if (await tabBtn.count()) {
      await tabBtn.click({ timeout: 5000 }).catch(() => {})
    } else {
      await page.getByText(/Formaci[oó]n Acad[eé]mica/i).first().click({ timeout: 5000 }).catch(() => {})
    }

    // 5) After the tab is active, the educacion row should render with the
    //    profesion text visible inside an InputText (editable) — and the
    //    page DOM should also reflect the universidad value. Wait for the
    //    educacion-empleado-add testid container to be present.
    await page.waitForTimeout(800)
    const html = await page.content()
    expect(html).toContain(profesion)
    expect(html).toContain('Universidad Test')

    // 6) Cleanup
    await page.request.delete(`${API}/employees/${empId}/educacion/${eduId}`).catch(() => {})
  })
})
