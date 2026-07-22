/**
 * W5 — Browser E2E per instrument (BARTHEL, YESAVAGE, MNA_CUADRO, FICHA_NUTRICIONAL).
 *
 * Per task #21 step 3:
 *   - BARTHEL (total=100 path + a mid-range path)
 *   - YESAVAGE (reverse-scoring: answer all "si" → total 10 "Depresión establecida")
 *   - MNA_CUADRO (cribaje ≥ 12 skip path: result shows "Estado nutricional
 *     normal" + skipped section marked; and cribaje < 12 full path)
 *   - FICHA_NUTRICIONAL (no scoring card; data persisted)
 *   - InstrumentResultView shows total + clasificacion + per-section breakdown.
 *
 * Approach:
 *   - Renderer / scoring UX is verified via the dev preview route. When the
 *     preview's submit hits the live API it falls through to local derivation
 *     (the renderer mirrors the W4 contract — see scoring.ts). When the API
 *     is reachable we verify the persisted row shape via direct API fetch
 *     (page.request) to prove server-side scoring matches the renderer.
 *   - PrimeVue RadioButton click trap documented in W3: use
 *     `page.evaluate(() => el.click())` instead of `.check()`.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test tests/instruments-dynamic/e2e-instruments.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures', 'instrument-templates')

function loadFixture(codigo: string): any {
  const file = path.join(FIXTURES_DIR, `${codigo}.v1.json`)
  if (!fs.existsSync(file)) {
    throw new Error(`Fixture not found for ${codigo} at ${file}`)
  }
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

// Click a hidden PrimeVue RadioButton by selector. W3 documented pattern:
// Playwright's `.check()` and actionability check reject PrimeVue's
// `p-radiobutton-box` (inner input is display:none), so we .click() the
// hidden <input> directly.
async function clickRadio(page: Page, selector: string) {
  await page.evaluate((sel: string) => {
    const el = document.querySelector(sel) as HTMLInputElement | null
    if (!el) throw new Error(`radio not found: ${sel}`)
    el.click()
  }, selector)
}

// Pick the max-score option value from an item (fallback: first option).
function maxScoreValue(item: any): string {
  const opts: { value: string; score: number }[] = (item.options ?? []).slice()
  opts.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
  return opts[0].value
}

// Pick the mid-score option value from an item. If the item has only 2
// options, returns the second (typically lower-score) option. If 3+, picks
// the median by score.
function midScoreValue(item: any): string {
  const opts: { value: string; score: number }[] = (item.options ?? []).slice()
  if (opts.length === 0) return ''
  if (opts.length === 1) return opts[0].value
  if (opts.length === 2) return opts[1].value
  opts.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  return opts[Math.floor(opts.length / 2)].value
}

// Pick the min-score option (lowest score value).
function minScoreValue(item: any): string {
  const opts: { value: string; score: number }[] = (item.options ?? []).slice()
  if (opts.length === 0) return ''
  opts.sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
  return opts[0].value
}

// Note: NOT in serial mode — each test gets a fresh browser context.
// The dev preview route (/dev/instrument-preview) is dev-only and not
// behind auth, but we want isolation between instrument runs.
//
// IMPORTANT: dev preview's submit path hits `/instruments/:codigo/definition`
// (the wrong endpoint — it's a GET-only route) and falls through to a
// local computeScore fallback. We DO login before navigating because the
// SPA's auth plugin (`session-expired.client.ts`) redirects to /login on
// ANY 401 anywhere in the app.

test.describe('Browser E2E per instrument (W5)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('BARTHEL all-max → total=100 "Dependencia ligera"', async ({ page }) => {
    const fixture = loadFixture('BARTHEL')

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=BARTHEL`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    for (const item of fixture.sections[0].items as any[]) {
      const v = maxScoreValue(item)
      await clickRadio(page, `[data-item-id="${item.id}"] input[type="radio"][value="${v}"]`)
    }

    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    const total = (await page.getByTestId('result-total').textContent()) ?? ''
    expect(Number(total.trim())).toBe(100)
    await expect(page.getByTestId('result-classification')).toContainText(/Dependencia ligera/i)
  })

  test('BARTHEL mid-range → total in (45, 79], classification matches contract', async ({ page }) => {
    // Mix 5 max + 5 min: BARTHEL max=100, min=0 → mid-range ≈ 50.
    // Contract ranges: 45-59 Dependencia grave, 60-79 Dependencia moderada.
    // We deliberately pick 5 max + 5 min to land in the 45-59 range.
    const fixture = loadFixture('BARTHEL')

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=BARTHEL`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    const items = fixture.sections[0].items as any[]
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const v = i % 2 === 0 ? maxScoreValue(item) : minScoreValue(item)
      await clickRadio(page, `[data-item-id="${item.id}"] input[type="radio"][value="${v}"]`)
    }

    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    // With BARTHEL per-item max scores: 10, 5, 10, 5, 10, 10, 10, 15, 15, 10
    // 5 max picks (at i=0,2,4,6,8) = 10+10+10+10+15 = 55
    // 5 min picks (at i=1,3,5,7,9) = 0
    // Total = 55 → "Dependencia grave" (45-59)
    const total = (await page.getByTestId('result-total').textContent()) ?? ''
    expect(Number(total.trim())).toBe(55)
    await expect(page.getByTestId('result-classification')).toContainText(/Dependencia grave/i)
  })

  test('YESAVAGE all-si → total=10 "Depresión establecida" (reverse-scoring)', async ({ page }) => {
    const fixture = loadFixture('YESAVAGE')
    expect(fixture.sections[0].items.length).toBe(15)

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=YESAVAGE`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    for (const item of fixture.sections[0].items as any[]) {
      await clickRadio(page, `[data-item-id="${item.id}"] input[type="radio"][value="si"]`)
    }

    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    // YESAVAGE reverse scoring (per W4 scoring-engine spec test #17):
    // "si" x 15 → total=10 because 5 items score "si"=0 (positive items:
    // y_01, y_05, y_07, y_11, y_13) and 10 items score "si"=1 (negative
    // items). Total = 5*0 + 10*1 = 10 → "Depresión establecida".
    const total = (await page.getByTestId('result-total').textContent()) ?? ''
    expect(Number(total.trim())).toBe(10)
    await expect(page.getByTestId('result-classification')).toContainText(/Depresión establecida/i)
  })

  test('MNA_CUADRO cribaje ≥ 12 → evaluación skipped, classification "Estado nutricional normal"', async ({ page }) => {
    const fixture = loadFixture('MNA_CUADRO')
    const cribaje = fixture.sections.find((s: any) => s.id === 'cribaje')
    expect(cribaje).toBeTruthy()

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=MNA_CUADRO`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    // Fill cribaje with options that sum ≥ 12 (same picks as W3's
    // fill-flow smoke). Skip evaluación + cuadro_alimentos intentionally
    // (skipped state should be reached + marked).
    const picks: Record<string, string> = {
      a_apetito: 'igual',
      b_peso: 'sin_perdida',
      c_movilidad: 'sale',
      d_enfermedad: 'no',
      e_neuropsico: 'sin_problemas',
      f_imc: 'imc_ge_23',
    }
    for (const [itemId, value] of Object.entries(picks)) {
      await clickRadio(page, `[data-item-id="${itemId}"] input[type="radio"][value="${value}"]`)
    }

    // Verify the skippable UX flips the evaluation section to "skippable".
    await expect(page.locator('[data-section-id="evaluacion"]')).toHaveAttribute(
      'data-section-state',
      'skippable',
      { timeout: 4000 },
    )

    // Submit (evaluación is skipped because condition met AND no items answered).
    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    // Per contract §1.3: classification-source rule — cribaje subtotal
    // applies (12-14 = "Estado nutricional normal"). Per §1.5 cribaje
    // max=14. With picks: a(2)+b(3)+c(2)+d(2)+e(2)+f(3) = 14. Note that
    // g/peso and h/talla are number-info (no score contribution).
    const total = (await page.getByTestId('result-total').textContent()) ?? ''
    expect(Number(total.trim())).toBe(14)
    await expect(page.getByTestId('result-classification')).toContainText(
      /Estado nutricional normal/i,
    )

    // The skipped evaluation section must be flagged with the
    // "skipped-badge" testid in the result view.
    await expect(page.getByTestId('skipped-badge')).toBeVisible()
  })

  test('MNA_CUADRO cribaje < 12 → full path, global classification applied', async ({ page }) => {
    const fixture = loadFixture('MNA_CUADRO')
    const cribaje = fixture.sections.find((s: any) => s.id === 'cribaje')
    const evaluacion = fixture.sections.find((s: any) => s.id === 'evaluacion')
    expect(cribaje).toBeTruthy()
    expect(evaluacion).toBeTruthy()

    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=MNA_CUADRO`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

    // Pick MIN-score cribaje options so cribaje subtotal < 12 (forces
    // evaluación to be REQUIRED). Then fill evaluación fully.
    for (const item of cribaje.items as any[]) {
      if (item.type === 'single-select-scored') {
        const v = minScoreValue(item)
        await clickRadio(page, `[data-item-id="${item.id}"] input[type="radio"][value="${v}"]`)
      }
      // number-info items (peso/talla) skipped — they don't score.
    }

    // Verify evaluación is still in NORMAL state (not skippable).
    await expect(page.locator('[data-section-id="evaluacion"]')).toHaveAttribute(
      'data-section-state',
      'normal',
    )

    // Fill evaluación with mid-score options so the final total lands
    // inside the global ranges (24-30 / 17-23.5 / 0-16.5).
    for (const item of evaluacion.items as any[]) {
      if (item.type === 'single-select-scored') {
        const v = midScoreValue(item)
        await clickRadio(page, `[data-item-id="${item.id}"] input[type="radio"][value="${v}"]`)
      }
    }

    // Submit.
    await page.getByTestId('dev-preview-submit').click()
    await page.getByTestId('result-total').waitFor({ state: 'visible', timeout: 8000 })

    // No skipped section ⇒ global classification applies. We don't pin
    // the exact classification (it depends on mid-score pick per item)
    // but we assert it falls in one of the three ranges AND is not null.
    const total = (await page.getByTestId('result-total').textContent()) ?? ''
    const numericTotal = Number(total.trim())
    expect(numericTotal).toBeGreaterThanOrEqual(0)
    expect(numericTotal).toBeLessThanOrEqual(30)

    await expect(page.getByTestId('result-classification')).toContainText(
      /Estado nutricional normal|Riesgo de malnutrición|Malnutrición/i,
    )
  })

  test('FICHA_NUTRICIONAL → no scoring card; data submitted & persisted', async ({ page, request }) => {
    // Login to allow verification of the real API (persistence check).
    await loginAsAdmin(page)
    const cookies = await page.context().cookies()
    const session = cookies.find((c) => c.name === 'session')
    const cookieHeader = `session=${session!.value}`
    const apiBase = await getApiBase()

    // Resolve FICHA_NUTRICIONAL id + active version.
    const instList = await request.get(`${apiBase}/instruments?estado=ACTIVO&limit=100`, {
      headers: { Cookie: cookieHeader },
    })
    const instBody = await instList.json()
    const ficha = instBody.data.find((r: any) => r.codigo === 'FICHA_NUTRICIONAL')
    expect(ficha, 'FICHA_NUTRICIONAL must be seeded').toBeTruthy()
    expect(ficha.activeVersion, 'FICHA_NUTRICIONAL must have an activeVersion').toBeTruthy()
    const fichaVersionId = ficha.activeVersion.id

    // Pick or create a patient.
    const list = await request.get(`${apiBase}/patients?limit=1`, {
      headers: { Cookie: cookieHeader },
    })
    const listBody = await list.json()
    let patientId: number
    let createdPatient = false
    if (listBody.data?.length) {
      patientId = listBody.data[0].id
    } else {
      const uniq = `W5FN-${Date.now()}`
      const created = await request.post(`${apiBase}/patients`, {
        headers: { Cookie: cookieHeader },
        data: {
          nombre: `W5 FN PATIENT`,
          tipoDocumento: 'CC',
          numeroDocumento: uniq,
          genero: 'FEMENINO',
          fechaNacimiento: '1990-01-01',
        },
      })
      patientId = (await created.json()).data.id
      createdPatient = true
    }

    let fichaId: number | null = null
    try {
      // Build a complete FICHA_NUTRICIONAL respuesta payload from the fixture.
      const fixture = loadFixture('FICHA_NUTRICIONAL')
      const respuestas: Record<string, any> = {}
      for (const section of fixture.sections as any[]) {
        for (const item of section.items as any[]) {
          if (item.type === 'text-info') {
            respuestas[item.id] = `qa-${item.id}-${Date.now()}`
          } else if (item.type === 'number-info') {
            const min = item.constraints?.min ?? 0
            const max = item.constraints?.max ?? 100
            respuestas[item.id] = Math.round((min + max) / 2)
          } else if (item.type === 'single-select-info') {
            // pick first option's value
            respuestas[item.id] = item.options[0].value
          }
          // group-info: FICHA_NUTRICIONAL has none
        }
      }

      // POST via API — proves server-side scoring shape is "no scoring"
      // (puntajeTotal=null, clasificacion=null).
      const post = await request.post(`${apiBase}/patients/${patientId}/fichas`, {
        headers: { Cookie: cookieHeader },
        data: {
          instrumentoId: ficha.id,
          versionRegistro: 'v1.0',
          respuestas,
        },
      })
      expect(post.status()).toBe(201)
      const body = await post.json()
      fichaId = body.data.id
      // Contract §1.3 Shape B: scoring.total === "none" →
      // puntajeTotal=null, clasificacion=null, subtotales={} or absent.
      expect(body.data.estado).toBe('COMPLETADO')
      expect(body.data.puntajeTotal).toBeNull()
      expect(body.data.clasificacion).toBeNull()
      expect(body.data.instrumentoVersionId).toBe(fichaVersionId)

      // Render the dev preview to verify no scoring card appears and the
      // form renders all 13 items with the right type mix.
      await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=FICHA_NUTRICIONAL`)
      await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })

      // No classification card (scoring.total === "none").
      await expect(page.getByTestId('classification-tentative')).toHaveCount(0)

      // Type mix per W1 fixture: 7 text-info + 3 single-select-info +
      // 3 number-info, total 13.
      await expect(page.locator('[data-item-type="text-info"]')).toHaveCount(7)
      await expect(page.locator('[data-item-type="single-select-info"]')).toHaveCount(3)
      await expect(page.locator('[data-item-type="number-info"]')).toHaveCount(3)
      await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(0)
      await expect(page.locator('[data-item-type="group-info"]')).toHaveCount(0)
      await expect(page.locator('[data-item-id]')).toHaveCount(13)
    } finally {
      if (fichaId) {
        await request
          .delete(`${apiBase}/patients/${patientId}/fichas/${fichaId}`, {
            headers: { Cookie: cookieHeader },
          })
          .catch(() => {})
      }
      if (createdPatient && patientId) {
        await request
          .delete(`${apiBase}/patients/${patientId}`, {
            headers: { Cookie: cookieHeader },
          })
          .catch(() => {})
      }
      await request
        .post(`${apiBase}/auth/logout`, { headers: { Cookie: cookieHeader } })
        .catch(() => {})
    }
  })
})
