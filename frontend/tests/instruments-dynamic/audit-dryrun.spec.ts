/**
 * audit-dryrun.spec.ts — §4 InstrumentAuditView + "Probar sin guardar" dry-run.
 * Task #36 (W10).
 *
 * ── MOCKED ─────────────────────────────────────────────────────────────────
 * Session + instrument detail + definition are MOCKED (admin session; the
 * BARTHEL & MNA_CUADRO fixtures are served as the active definition). The
 * dry-run's zero-write guarantee is asserted with request interception, which
 * is authoritative regardless of the mocked read path. W11 re-runs against the
 * live backend — see completion-report.md "mocked-vs-live".
 *
 * Run:
 *   TEST_FRONTEND_URL=http://localhost:3100 \
 *     npx playwright test instruments-dynamic/audit-dryrun.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'
function fixture(name: string) {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`../fixtures/instrument-templates/${name}`, import.meta.url)), 'utf-8'))
}
const barthel = fixture('BARTHEL.v1.json')
const mna = fixture('MNA_CUADRO.v1.json')

const ADMIN = { id: 1, email: 'admin@x.com', nombre: 'Admin', apellido: 'User', rol: 'ADMIN', tipoEmpleado: null, activo: true }
function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/** Mock an instrument detail + its active definition. */
async function mockInstrument(page: Page, id: number, codigo: string, def: unknown) {
  await page.route('**/api/v1/**', (r) => r.fulfill(json({ success: true, data: [] })))
  await page.route('**/api/v1/auth/me', (r) => r.fulfill(json({ success: true, user: ADMIN })))
  await page.route('**/api/v1/empresa', (r) => r.fulfill(json({ success: true, data: null })))
  await page.route(`**/api/v1/instruments/${id}`, (r) =>
    r.fulfill(json({
      success: true,
      data: {
        id, nombreInstrumento: codigo, codigo, descripcion: null, tipo: 'VALORACION',
        periodicidad: 'SEMESTRAL', rolesPermitidos: 'ADMIN', estado: 'ACTIVO',
        fechaCreacion: '2026-07-17T00:00:00.000Z', creadoPor: 1, registros: [],
      },
    })),
  )
  await page.route(`**/api/v1/instruments/${codigo}/definition`, (r) =>
    r.fulfill(json({ success: true, data: { version: { definition: def } } })),
  )
}

test.describe('§4 audit view + dry-run — MOCKED', () => {
  test('BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table', async ({ page }) => {
    await mockInstrument(page, 1, 'BARTHEL', barthel)
    await page.goto(`${FRONTEND}/instrumentos/1`)
    await page.getByTestId('audit-expand').waitFor({ state: 'visible', timeout: 10000 })

    const view = page.getByTestId('instrument-audit-view')
    await expect(view.locator('[data-audit-item]')).toHaveCount(10)

    // Spot-check Comida option scores.
    const comida = view.locator('[data-audit-item="comida"]')
    await expect(comida).toContainText('Independiente')
    const scores = comida.locator('[data-audit-option] td:last-child')
    await expect(scores.nth(0)).toHaveText('10')
    await expect(scores.nth(1)).toHaveText('5')
    await expect(scores.nth(2)).toHaveText('0')

    // Global ranges table present with the 4 Barthel bands.
    const globalRows = view.locator('[data-audit-global-ranges] tbody tr')
    await expect(globalRows).toHaveCount(4)
    await expect(view.locator('[data-audit-global-ranges]')).toContainText('Dependencia ligera')
  })

  test('MNA audit: skip rule text + cribaje section ranges', async ({ page }) => {
    await mockInstrument(page, 2, 'MNA_CUADRO', mna)
    await page.goto(`${FRONTEND}/instrumentos/2`)
    await page.getByTestId('audit-expand').waitFor({ state: 'visible', timeout: 10000 })
    // Expand the collapsible audit panel.
    await page.getByTestId('audit-expand').evaluate((d: any) => { d.open = true })
    const view = page.getByTestId('instrument-audit-view')

    // evaluación section has the skip rule referencing cribaje ≥ 12.
    const skip = view.locator('[data-audit-skiprule="evaluacion"]')
    await expect(skip).toBeVisible()
    await expect(skip).toContainText('Se omite')
    await expect(skip).toContainText('≥ 12')

    // cribaje section-level ranges (3 bands) rendered.
    const cribajeRanges = view.locator('[data-audit-section-ranges="cribaje"] tbody tr')
    await expect(cribajeRanges).toHaveCount(3)
    await expect(view.locator('[data-audit-section-ranges="cribaje"]')).toContainText('Estado nutricional normal')
  })

  test('dry-run: fill Barthel all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH', async ({ page }) => {
    await mockInstrument(page, 1, 'BARTHEL', barthel)

    // Track any write request during the dialog session.
    const writes: string[] = []
    page.on('request', (req) => {
      const m = req.method()
      if ((m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') && /\/api\/v1\//.test(req.url())) {
        writes.push(`${m} ${req.url()}`)
      }
    })

    await page.goto(`${FRONTEND}/instrumentos/1`)
    await page.getByTestId('dry-run-button').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByTestId('dry-run-button').click()
    await page.getByTestId('dry-run-dialog').waitFor({ state: 'visible' })
    await expect(page.getByTestId('dry-run-banner')).toContainText('no se guarda')

    // Fill all 10 items with the max-score option (RadioButton trap: click the
    // hidden <input> directly via page.evaluate).
    const dialog = page.getByTestId('dry-run-dialog')
    await dialog.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })
    for (const section of barthel.sections) {
      for (const item of section.items) {
        const best = [...item.options].sort((a: any, b: any) => b.score - a.score)[0]
        const sel = `[data-testid="dry-run-dialog"] [data-item-id="${item.id}"] input[type="radio"][value="${best.value}"]`
        await page.evaluate((s: string) => {
          const el = document.querySelector(s) as HTMLInputElement | null
          if (!el) throw new Error('radio not found: ' + s)
          el.click()
        }, sel)
      }
    }

    // Live client scoring: total 100 + "Dependencia ligera".
    await expect(dialog.getByTestId('classification-tentative')).toHaveText('Dependencia ligera')
    await expect(dialog).toContainText('100')

    // Close dialog, then assert nothing was written.
    await dialog.getByRole('button', { name: 'Cerrar' }).click()
    expect(writes, `unexpected write requests: ${writes.join(', ')}`).toHaveLength(0)
  })
})
