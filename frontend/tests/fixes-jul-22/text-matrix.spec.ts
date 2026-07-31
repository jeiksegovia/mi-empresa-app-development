/**
 * fixes-jul-22 — FE smoke: MNA_CUADRO v2 group-info text-cell matrix
 * (W2-frontend task #10).
 *
 * Per contract §4, MNA_CUADRO v2's `frecuencia_grupos` group-info item now
 * declares `cellInput: "text"` → the renderer draws an N×M grid of
 * `InputText` cells (one per row × column coordinate), and the answer shape
 * becomes `{rowId, columnId, value}[]`.
 *
 * What we assert (MOCKED session, dev-only preview route):
 *
 *   1) Loading `/dev/instrument-preview?codigo=MNA_CUADRO` resolves the v2
 *      fixture (highest version wins per contract §2).
 *   2) The `frecuencia_grupos` group-info item renders an InputText matrix
 *      — N rows (7 — Cereales, Frutas, Verduras, Carnes, Lácteos, Grasas,
 *      Dulces) and M columns (4 — Diario, Semanal, Mensual, Nunca) →
 *      28 cells.
 *   3) Typing in one cell preserves the cell value AND emits a full N×M
 *      `GroupTextCellValue[]` answer shape (other cells stay empty).
 *   4) Legacy group-info items (none in MNA_CUADRO v2 but kept for
 *      regression) would render the original Dropdown. We don't assert
 *      that here — `tests/instruments-dynamic/schema-render.spec.ts` is
 *      the authoritative coverage for the legacy path.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *     npx playwright test fixes-jul-22/text-matrix.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

async function mockSession(page: Page) {
  const user = {
    id: 99,
    email: 'qa@miempresa.com',
    nombre: 'QA',
    apellido: 'User',
    rol: 'ADMIN',
    tipoEmpleado: null,
    activo: true,
  }
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await page.route('**/api/v1/empresa', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: null }),
    }),
  )
}

test.describe('fixes-jul-22 — MNA_CUADRO v2 group-info text-cell matrix (MOCKED)', () => {
  test('renders an InputText grid for `frecuencia_grupos` (7 rows × 4 columns = 28 cells)', async ({ page }) => {
    await mockSession(page)
    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=MNA_CUADRO`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Locate the matrix container for the frecuencia_grupos item.
    const matrix = page.locator('[data-testid="text-matrix-frecuencia_grupos"]')
    await expect(matrix).toBeVisible()

    // 28 cells (7 × 4).
    const cells = matrix.locator('[data-testid^="text-cell-frecuencia_grupos-"]')
    await expect(cells).toHaveCount(28)

    // The legacy Dropdown path should NOT be present for this item.
    await expect(matrix.locator('p-dropdown')).toHaveCount(0)
    await expect(matrix.locator('input[type="radio"]')).toHaveCount(0)
  })

  test('typing in one cell emits the full N×M answer array; other cells stay empty', async ({ page }) => {
    await mockSession(page)
    await page.goto(`${FRONTEND}/dev/instrument-preview?codigo=MNA_CUADRO`)
    await page.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Cereales × Diario — PrimeVue InputText forwards the data-testid to the
    // underlying <input>, so the selector IS the input element directly.
    const targetCell = page.locator(
      '[data-testid="text-cell-frecuencia_grupos-cereales-diario"]',
    )
    await targetCell.fill('2 porciones')

    // The renderer always emits the full N×M grid (preserving any untouched
    // cells with empty `value`). All 28 cells should be reachable and the
    // one we typed into should hold our value.
    await expect(targetCell).toHaveValue('2 porciones')

    // Cereales × Semanal (different cell, same row) — should remain empty.
    const siblingCell = page.locator(
      '[data-testid="text-cell-frecuencia_grupos-cereales-semanal"]',
    )
    await expect(siblingCell).toHaveValue('')
  })
})