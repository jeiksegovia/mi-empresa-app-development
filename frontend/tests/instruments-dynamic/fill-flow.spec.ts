/**
 * T8 — Fill flow smoke (Barthel happy path).
 *
 * This spec has TWO describe blocks:
 *
 *   1. "Mocked preview (local-QA)" — drives the dev-only preview route with
 *      `&mock=1` so no backend is needed. Kept for fast feedback / unit-ish
 *      smoke that exercises the renderer without a network round-trip.
 *
 *   2. "Real-backend fill flow (W6)" — drives the actual patient page
 *      against the real backend (port 3101) with a real session, a real
 *      patient, and the real form dialog. Asserts that:
 *        - The UI submit path (BUG-W5-01 fixed) succeeds: dialog closes,
 *          server-computed result lands back in the patient's ficha list.
 *        - The result dialog (BUG-W5-02 fixed) renders without first
 *          opening the assign dialog: total + classification visible.
 *
 * Acceptance criterion from W6 task #29 step 5:
 *   "Make fill-flow.spec.ts exercise the REAL UI submit path (fill in the
 *    dialog → click form-submit → success), removing the drive-the-API
 *    workaround for BUG-W5-01. Remove the 'open assign dialog first'
 *    workaround for BUG-W5-02 — 'Ver detalle' directly on a COMPLETADO
 *    row must render total + clasificacion."
 *
 * PrimeVue RadioButton trap (W3 documented):
 *   `.check()` and Playwright's actionability check reject
 *   PrimeVue's `p-radiobutton-box` (inner input is display:none). Use
 *   `page.evaluate(() => el.click())` instead.
 *
 * Run:
 *   # mocked (no backend dependency)
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *     npx playwright test fill-flow.spec.ts
 *
 *   # real backend
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test fill-flow.spec.ts -g "Real-backend"
 */

import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginAsAdmin, getFrontendOrigin } from '../helpers/auth'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

// ES module shim — `__dirname` is not defined in Playwright's ESM test runner.
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures', 'instrument-templates')
const barthelPath = path.join(FIXTURES_DIR, 'BARTHEL.v1.json')
const mnaPath = path.join(FIXTURES_DIR, 'MNA_CUADRO.v1.json')

function loadFixture(pathLike: string): any {
  if (!fs.existsSync(pathLike)) {
    throw new Error(`Fixture not found at ${pathLike}. Has it been copied from W1 templates?`)
  }
  return JSON.parse(fs.readFileSync(pathLike, 'utf-8'))
}

// ────────────────────────────────────────────────────────────────────────────
// 1) MOCKED PREVIEW (fast, no backend) — preserved from W3 for renderer smoke
// ────────────────────────────────────────────────────────────────────────────
test.describe('Fill flow smoke (T8) — mocked preview', () => {
  test('BARTHEL happy path: fill 10 radio items → submit → result view with total=100', async ({ page }) => {
    const fixture = loadFixture(barthelPath)
    expect(fixture.codigo).toBe('BARTHEL')
    expect(fixture.sections).toHaveLength(1)
    expect(fixture.sections[0].items).toHaveLength(10)

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=BARTHEL&mock=1`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    // PrimeVue RadioButton trick (documented in W3): use page.evaluate to
    // .click() the hidden <input type="radio"> directly. .check() trips
    // on the actionability check because the input is display:none.
    const itemIds = fixture.sections[0].items.map((i: any) => i.id)
    for (const itemId of itemIds) {
      const item = fixture.sections[0].items.find((i: any) => i.id === itemId)
      const options: { value: string; score: number }[] = (item.options ?? []).slice()
      options.sort((a, b) => b.score - a.score)
      const pickValue = options[0].value
      const selector = `[data-item-id="${itemId}"] input[type="radio"][value="${pickValue}"]`
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | null
        if (!el) throw new Error('radio not found: ' + sel)
        el.click()
      }, selector)
    }

    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    const total = await page.getByTestId('result-total').textContent()
    expect(Number((total ?? '').trim())).toBe(100)
    await expect(page.getByTestId('result-classification')).toContainText(/Dependencia ligera/i)
  })

  test('MNA_CUADRO — cribaje ≥ 12 triggers skippable evaluación state', async ({ page }) => {
    const fixture = loadFixture(mnaPath)
    const cribaje = fixture.sections.find((s: any) => s.id === 'cribaje')
    const evaluacion = fixture.sections.find((s: any) => s.id === 'evaluacion')
    expect(cribaje).toBeTruthy()
    expect(evaluacion.condition?.skipIf?.sectionId).toBe('cribaje')

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=MNA_CUADRO&mock=1`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    // Same cribaje >= 12 selection as W3 — picks high-score options that
    // sum well past the skipIf threshold.
    const itemMap: Record<string, string> = {
      a_apetito: 'igual',
      b_peso: 'sin_perdida',
      c_movilidad: 'sale',
      d_enfermedad: 'no',
      e_neuropsico: 'sin_problemas',
      f_imc: 'imc_ge_23',
    }
    for (const [itemId, value] of Object.entries(itemMap)) {
      const selector = `[data-item-id="${itemId}"] input[type="radio"][value="${value}"]`
      await page.evaluate((sel: string) => {
        const el = document.querySelector(sel) as HTMLInputElement | null
        if (el) el.click()
      }, selector)
    }

    await expect(page.locator('[data-section-id="evaluacion"]')).toHaveAttribute(
      'data-section-state',
      'skippable',
      { timeout: 4000 },
    )
    await expect(page.getByTestId('section-evaluacion-force-complete')).toBeVisible()
  })

  test('Renderer emits clean respuestas payload (contract §5.1)', async ({ page }) => {
    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=BARTHEL&mock=1`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible' })

    await page.evaluate(() => {
      const el = document.querySelector(
        `[data-item-id="comida"] input[type="radio"][value="independiente"]`,
      ) as HTMLInputElement | null
      el?.click()
    })

    await expect(page.getByTestId('classification-tentative')).toContainText(
      /Dependencia severa/i,
    )

    const formHtml = (await page
      .locator('[data-dev-preview-form]')
      .first()
      .innerHTML()).toLowerCase()
    expect(formHtml).not.toMatch(/barthel/i)
    expect(formHtml).not.toMatch(/mna/i)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2) REAL-BACKEND FILL FLOW (W6) — drives the actual patient page UI
// ────────────────────────────────────────────────────────────────────────────
//
// What this proves:
//   - W3's frontend form dialog wires up against the W4 API correctly
//     (no `mock=1`, no dev-preview, no local derivation, no API-POST
//     workaround for BUG-W5-01).
//   - The server-computed scoring reaches the result view: total=100 +
//     "Dependencia ligera" for BARTHEL all-max.
//   - The ficha persists (visible in patient.registrosFichas) with the
//     real DB id, COMPLETADO estado, and matching puntaje/clasificacion.
//   - The result dialog (BUG-W5-02 fixed) renders WITHOUT first opening
//     the assign dialog. We click "Ver detalle" directly on the COMPLETADO
//     row.

test.describe('Real-backend fill flow (W6)', () => {
  // Serial mode: every test in this block touches the same patient.
  test.describe.configure({ mode: 'serial' })

  // Drive the REAL UI submit path end-to-end:
  //   - select instrument → dialog opens → fill radios → click form-submit
  //   - dialog closes, ficha persists, result dialog renders total+clasificacion
  //
  // Removed W5 workarounds:
  //   - BUG-W5-01: drive-the-API POST. Now the dialog submits itself.
  //   - BUG-W5-02: "open assign dialog first" priming. We click "Ver detalle"
  //     directly on the just-created COMPLETADO row.
  test('BARTHEL real-backend: UI submit path → result dialog renders persisted total', async ({ page }) => {
    await loginAsAdmin(page)

    const frontendOrigin = getFrontendOrigin()

    // 1) Pick or create a patient via API (the patient page itself can
    //    create one, but we want a stable id for cleanup). We can also just
    //    pick the first existing patient.
    const list = await page.request.get(`${frontendOrigin.replace(':3100', ':3101')}/api/v1/patients?limit=1`)
    const listBody = await list.json()
    expect(listBody.data?.length, 'need at least one patient to drive UI').toBeTruthy()
    const patientId: number = listBody.data[0].id

    let fichaId: number | null = null

    try {
      // 2) Navigate to the patient page → Fichas tab.
      await page.goto(`${frontendOrigin}/pacientes/${patientId}`)
      await page.getByRole('button', { name: /Fichas & Evaluaciones/i }).click()

      // 3) Open the assign+complete dialog for BARTHEL (drives the REAL UI path).
      await page.getByTestId('ficha-instrumento-select').click()
      await page.getByRole('option', { name: /Barthel/i }).first().click()

      // 4) Wait for the form dialog. Definition fetch + render happens in parallel.
      await page.getByTestId('ficha-form-dialog').waitFor({ state: 'visible' })
      await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

      // 5) Fill all 10 BARTHEL items with the max-score option ("independiente"
      //    for the activity items, "continente" for the continent items). PrimeVue
      //    RadioButton trap: click the hidden <input> directly.
      const fixture = loadFixture(barthelPath)
      const itemIds = fixture.sections[0].items.map((i: any) => i.id)
      for (const itemId of itemIds) {
        const item = fixture.sections[0].items.find((i: any) => i.id === itemId)
        const options: { value: string; score: number }[] = (item.options ?? []).slice()
        options.sort((a, b) => b.score - a.score)
        const pickValue = options[0].value
        const selector = `[data-item-id="${itemId}"] input[type="radio"][value="${pickValue}"]`
        await page.evaluate((sel: string) => {
          const el = document.querySelector(sel) as HTMLInputElement | null
          if (!el) throw new Error('radio not found: ' + sel)
          el.click()
        }, selector)
      }

      // 6) Click form-submit — the dialog submits and closes on success.
      await page.getByTestId('form-submit').click()
      // Wait for the dialog to disappear (it hides after successful submit).
      await page.getByTestId('ficha-form-dialog').waitFor({ state: 'hidden', timeout: 10000 })

      // 7) Confirm the new COMPLETADO row appeared. Capture fichaId for cleanup
      //    by reading the row's Ver-detalle button's data attribute if present,
      //    or by listing the patient detail. We can read the fichaId via API
      //    after the submit so we can DELETE it in cleanup.
      const detailAfter = await page.request.get(
        `${frontendOrigin.replace(':3100', ':3101')}/api/v1/patients/${patientId}`,
      )
      const detailBody = await detailAfter.json()
      const barthelFicha = (detailBody.data.registrosFichas as any[])
        .find((f: any) => f.instrumento?.nombreInstrumento?.match(/Barthel/i) && f.estado === 'COMPLETADO')
      expect(barthelFicha, 'newly created BARTHEL ficha must be COMPLETADO').toBeTruthy()
      fichaId = barthelFicha.id

      // 8) Click "Ver detalle" DIRECTLY on the COMPLETADO row — no prior
      //    assign-dialog priming (BUG-W5-02 fixed). The result dialog must
      //    render total + classification.
      await page.getByTestId('ficha-view-result').first().click()
      await page.getByTestId('ficha-result-dialog').waitFor({ state: 'visible' })
      await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 10000 })
      const total = await page.getByTestId('result-total').textContent()
      expect(Number((total ?? '').trim())).toBe(100)
      await expect(page.getByTestId('result-classification')).toContainText(/Dependencia ligera/i)
    } finally {
      if (fichaId) {
        await page.request
          .delete(`${frontendOrigin.replace(':3100', ':3101')}/api/v1/patients/${patientId}/fichas/${fichaId}`)
          .catch(() => {})
      }
      await page.request
        .post(`${frontendOrigin.replace(':3100', ':3101')}/api/v1/auth/logout`)
        .catch(() => {})
    }
  })
})

// BARTHEL all-max helper kept for backwards-compat / future tests that need
// to skip the UI and POST directly. Not used by the current real-backend
// describe (which exercises the REAL UI submit path after BUG-W5-01 was
// fixed). Kept here so any future test can drop in `barthelMaxAnswer()`.
function barthelMaxAnswer(): Record<string, string> {
  return {
    comida: 'independiente',
    lavado: 'independiente',
    vestido: 'independiente',
    arreglo: 'independiente',
    deposicion: 'continente',
    miccion: 'continente',
    retrete: 'independiente',
    transferencia: 'independiente',
    deambulacion: 'independiente',
    desniveles: 'independiente',
  }
}
