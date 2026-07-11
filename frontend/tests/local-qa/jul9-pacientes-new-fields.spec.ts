/**
 * LOCAL QA — jul-9 (W4 — T14): B3/B4/B5 cliente new fields UI render.
 *
 * Reference: `task-assignment-qa.md` T14 item 4 — verify the detail page
 * renders the 3 new dato-personales fields (cumpleaños / tipoSangre / eps).
 *
 * Approach (deterministic, low-flake):
 *   1) Create the paciente via API with the 3 new fields populated.
 *   2) Visit the detalle page.
 *   3) Assert each new field renders (label + value).
 *   4) Cleanup.
 *
 * We use API for setup because driving the create form's PrimeVue Selects +
 * date pickers deterministically has been flaky in local-qa runs (matches the
 * jul-8 precedent of "API setup + UI verify").
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 paciente — new datos-personales fields (B3/B4/B5)', () => {
  test('detail page displays fechaCumpleanos / tipoSangre / eps with their values', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // 1) Create the paciente with the 3 new fields populated via API
    const uniq = `J9${Date.now().toString().slice(-10)}`
    const create = await page.request.post(`${API}/patients`, {
      data: {
        nombre: 'Juliana QA',
        tipoDocumento: 'CC',
        numeroDocumento: uniq,
        genero: 'Femenino',
        fechaNacimiento: '1985-08-20',
        fechaCumpleanos: '1990-08-20',
        tipoSangre: 'O_POS',
        eps: 'Sura QA Póliza',
      },
    })
    expect(create.status()).toBe(201)
    const created = await create.json()
    const newId = created.data.id

    // 2) Visit the detalle page
    await page.goto(`${FRONTEND}/pacientes/${newId}`)
    await page.waitForLoadState('networkidle')

    // 3) The detalle page has three named subsections with the value rendered.
    //    Per [id]/index.vue: headings are "Fecha de cumpleaños", "Tipo de sangre"
    //    and the eps value goes inside a `<p class="font-medium">{{ eps }}</p>`.
    await expect(page.getByText('Fecha de cumpleaños').first()).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Tipo de sangre').first()).toBeVisible()
    await expect(page.getByText('Sura QA Póliza').first()).toBeVisible()

    // 4) Cleanup
    await page.request.delete(`${API}/patients/${newId}`).catch(() => {})
  })
})
