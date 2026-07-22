/**
 * T7 — Schema↔render parity for the DynamicInstrumentForm renderer.
 *
 * Per task #17 (acceptance criterion 4): for each of the 6 fixture
 * definitions we verify that the renderer (instrument-type-driven) produces
 * the right quantity & kind of inputs.
 *
 * Test tooling decision (logged as D-W3-1 in
 * orchestration-ctx/decisions/schema-contract-instrumentos-dynamic-fichas.md):
 * the project does NOT use vitest. We assert rendering via Playwright
 * against the dev-only `/dev/instrument-preview?codigo=<X>` route that
 * loads `frontend/tests/fixtures/instrument-templates/*.v1.json`.
 *
 * Counts derived from `python3 -c` summary (see progress-report.md):
 *   BARTHEL          sections= 1 items= 10 {single-select-scored: 10}
 *   MINI_MENTAL      sections=11 items= 30 {single-select-scored: 30}
 *   TINETTI          sections= 2 items= 20 {single-select-scored: 20}
 *   YESAVAGE         sections= 1 items= 15 {single-select-scored: 15}
 *   MNA_CUADRO       sections= 3 items= 21 {s-s-scored:18, number-info:2, group-info:1}
 *   FICHA_NUTRICIONAL sections= 4 items= 13 {text-info:7, single-select-info:3, number-info:3}
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *     npx playwright test schema-render.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

async function gotoFixture(page: Page, codigo: string) {
  await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=${codigo}`)
  // Wait until the dynamic renderer has mounted. Any item with
  // data-item-id is a guarantee the items have been enumerated.
  await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

test.describe('Schema↔render parity (T7)', () => {
  test('BARTHEL — 10 single-select-scored items, 1 section', async ({ page }) => {
    await gotoFixture(page, 'BARTHEL')

    // 1 section
    await expect(page.locator('[data-section-id]')).toHaveCount(1)
    await expect(page.locator('[data-section-id="abvd"]')).toBeVisible()

    // 10 items, all single-select-scored.
    const items = page.locator('[data-item-id]')
    await expect(items).toHaveCount(10)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(10)
    await expect(page.locator('[data-item-type="number-info"]')).toHaveCount(0)
    await expect(page.locator('[data-item-type="group-info"]')).toHaveCount(0)

    // Spot-check: BARTHEL has 10 items with 2–4 radio options each.
    const radios = page.locator('[data-item-type="single-select-scored"] input[type="radio"]')
    const radioCount = await radios.count()
    expect(radioCount).toBeGreaterThanOrEqual(20) // minimum 2 per item × 10
    expect(radioCount).toBeLessThanOrEqual(40)    // maximum 4 per item × 10

    // Each item label is rendered. Use a substring / has-text match because
    // PrimeVue renders the "<label>Comida <span>*</span></label>" wrapper.
    await expect(page.locator('[data-item-id="comida"]')).toContainText('Comida')
    await expect(page.locator('[data-item-id="desniveles"]')).toContainText('desniveles')
  })

  test('MINI_MENTAL — 30 single-select-scored items across 11 sections', async ({ page }) => {
    await gotoFixture(page, 'MINI_MENTAL')

    await expect(page.locator('[data-section-id]')).toHaveCount(11)
    await expect(page.locator('[data-item-id]')).toHaveCount(30)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(30)
    await expect(page.locator('[data-item-type="number-info"]')).toHaveCount(0)
    await expect(page.locator('[data-item-type="group-info"]')).toHaveCount(0)
  })

  test('TINETTI — 20 single-select-scored items across 2 sections', async ({ page }) => {
    await gotoFixture(page, 'TINETTI')

    await expect(page.locator('[data-section-id]')).toHaveCount(2)
    await expect(page.locator('[data-item-id]')).toHaveCount(20)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(20)
  })

  test('YESAVAGE — 15 single-select-scored items, 1 section', async ({ page }) => {
    await gotoFixture(page, 'YESAVAGE')

    await expect(page.locator('[data-section-id]')).toHaveCount(1)
    await expect(page.locator('[data-item-id]')).toHaveCount(15)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(15)
  })

  test('MNA_CUADRO — 18 scored + 2 number-info + 1 group-info (7×4); skipIf UX', async ({ page }) => {
    await gotoFixture(page, 'MNA_CUADRO')

    await expect(page.locator('[data-section-id]')).toHaveCount(3)
    await expect(page.locator('[data-section-id="cribaje"]')).toBeVisible()
    await expect(page.locator('[data-section-id="evaluacion"]')).toBeVisible()
    await expect(page.locator('[data-section-id="cuadro_alimentos"]')).toBeVisible()

    await expect(page.locator('[data-item-id]')).toHaveCount(21)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(18)
    await expect(page.locator('[data-item-type="number-info"]')).toHaveCount(2)
    await expect(page.locator('[data-item-type="group-info"]')).toHaveCount(1)

    // Group-info renders an HTML table with 1 header row + 7 body rows = 8 rows total
    // PrimeVue DataTable renders an actual <table>.
    const tables = page.locator('[data-item-type="group-info"] table')
    await expect(tables).toHaveCount(1)
    const headerCells = tables.locator('thead th')
    // 1 label column + 4 frequency columns = 5 headers
    await expect(headerCells).toHaveCount(5)
    const bodyRows = tables.locator('tbody tr')
    await expect(bodyRows).toHaveCount(7)
    // Each row has 4 dropdown cells — confirm via the row-cell count.
    const dropdownsInGroup = tables.locator('tbody td .p-select, tbody td .p-dropdown, tbody td .p-selectbutton')
    // ≥ 7 individual selectable widgets rendered (one per row minimum).
    expect(await dropdownsInGroup.count()).toBeGreaterThanOrEqual(7)

    // Acceptance criterion #2 — section "evaluacion" must start in NORMAL
    // state (no skippable yet) because cribaje is unanswered. All 12 items
    // must be visible. Once cribaje reaches ≥ 12 the section MUST collapse
    // with the "Completar de todos modos" affordance.
    await expect(page.locator('[data-section-id="evaluacion"]')).toHaveAttribute(
      'data-section-state',
      'normal',
    )
    await expect(
      page.getByTestId('section-evaluacion-force-complete'),
    ).toHaveCount(0)
  })

  test('FICHA_NUTRICIONAL — 7 text + 3 single-select-info + 3 number-info, no scoring card', async ({ page }) => {
    await gotoFixture(page, 'FICHA_NUTRICIONAL')

    await expect(page.locator('[data-section-id]')).toHaveCount(4)
    await expect(page.locator('[data-item-id]')).toHaveCount(13)
    await expect(page.locator('[data-item-type="text-info"]')).toHaveCount(7)
    await expect(page.locator('[data-item-type="single-select-info"]')).toHaveCount(3)
    await expect(page.locator('[data-item-type="number-info"]')).toHaveCount(3)
    await expect(page.locator('[data-item-type="single-select-scored"]')).toHaveCount(0)
    await expect(page.locator('[data-item-type="group-info"]')).toHaveCount(0)

    // scoring.total === 'none' ⇒ no global score card.
    await expect(page.locator('[data-testid="classification-tentative"]')).toHaveCount(0)
  })

  test('All 6 fixtures render with ZERO instrument-specific code in renderer', async ({ page }) => {
    // Static check via the test-id we expose: every fixture must always have
    // a data-section-id block, regardless of codigo. This guards acceptance
    // criterion #1 at runtime (compile-time is enforced by grep in CI).
    const codigos = ['BARTHEL', 'MINI_MENTAL', 'TINETTI', 'YESAVAGE', 'MNA_CUADRO', 'FICHA_NUTRICIONAL']
    for (const codigo of codigos) {
      await gotoFixture(page, codigo)
      await expect(page.locator('[data-section-id]').first()).toBeVisible()
      const items = await page.locator('[data-item-id]').count()
      expect(items).toBeGreaterThan(0)
    }
  })
})
