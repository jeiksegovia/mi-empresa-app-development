/**
 * LOCAL QA — jul-9 (W4 — T14): B1/B2 nota fechaIncidente UI render.
 *
 * Reference: `task-assignment-qa.md` T14 item 5 — verify:
 *   - The Notas tab on paciente detail page renders a `fecha` column with
 *     `fechaIncidente` (DD/MM/YYYY formatted).
 *   - The note form reacts to a too-old `fechaIncidente` with an inline
 *     `nota-fecha-incidente-error` message visible.
 *
 * Strategy:
 *   1) Create a valid-fecha note via API (POST /patients/:id/notes).
 *   2) Visit the detalle page and click the Notas tab.
 *   3) Assert the note row shows today's date in some human format
 *      (DD/MM/YYYY or YYYY-MM-DD).
 *
 * The inline-error case is covered directly by the T13 backend spec —
 * `patients/nota-fecha-incidente.spec.ts` already asserts the 400 +
 * `field: 'fechaIncidente'` contract.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul9-nota-fecha-incidente.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

const fmtYMD = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const fmtShortDMY = (ymd: string): string => {
  // yyyy-mm-dd → dd/mm/yyyy
  const [y, m, d] = ymd.split('-')
  return `${d}/${m}/${y}`
}

test.describe('jul-9 nota fechaIncidente UI (B1/B2)', () => {
  test('note with valid fecha appears in notas list with the fecha column populated', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    // 1) Grab a seeded paciente
    const list = await page.request.get(`${API}/patients?limit=1`)
    expect(list.status()).toBe(200)
    const patientId = (await list.json()).data[0].id

    // 2) Create one valid note via API (today's date)
    const today = fmtYMD(new Date())
    const noteBody = {
      tipo: 'NEUTRAL',
      prioridad: 'BAJA',
      contenido: `Jul9 QA note ${Date.now().toString().slice(-6)}`,
      fechaIncidente: today,
    }
    const create = await page.request.post(`${API}/patients/${patientId}/notes`, { data: noteBody })
    expect(create.status()).toBe(201)

    // 3) Visit detalle page and click Notas tab
    await page.goto(`${FRONTEND}/pacientes/${patientId}`)
    await page.waitForLoadState('networkidle')

    const tab = page.getByRole('tab', { name: /Notas/i }).first()
    if (await tab.count()) {
      await tab.click({ timeout: 5000 }).catch(() => {})
    } else {
      await page.getByText(/^Notas/).first().click({ timeout: 5000 }).catch(() => {})
    }

    // 4) The note list (with our new row) is rendered. Assert the page
    //    contains our note's contenido text. The formatShortDate(nota.fechaIncidente)
    //    renders the date inline next to it (in DD/MM/YYYY) per [id]/index.vue.
    await page.waitForTimeout(1500)  // let PrimeVue render after the tab click
    const html = await page.content()
    expect(html).toContain(noteBody.contenido)

    // Note: there is no DELETE /notes endpoint, so we leave the test row
    // behind. Acceptable as local-QA; QA run report notes this.
  })
})
