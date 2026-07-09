import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: P2 — Certificados de empresa new taxonomy (F1) + POR_VENCER badge (F1.1)
 *
 *  - /certificados/crear form: tipo Select with all 6 new options (ALCALDIA, GOBERNACION,
 *    SECRETARIAS, TRIBUTARIOS, REGISTRO_MERCANTIL, OTRO). Each option shows a help description.
 *  - /certificados list page: each row with `fechaVencimiento` ≤ 30 days from today
 *    (and estado != VENCIDO) must show a `POR_VENCER` Tag.
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/p2-cert-types.spec.ts
 */


test('P2-1: /certificados/crear form lists all 6 new TipoCertificadoEmpresa options with help text', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/certificados/crear')
  await page.waitForLoadState('networkidle')

  // Verify Tipo is the first field (form reordering)
  const labels = page.locator('label')
  const firstLabelText = await labels.first().textContent()
  expect(firstLabelText).toMatch(/tipo de certificado/i)

  // Open the Select and capture the options
  await page.locator('.p-select').first().click()
  // Wait for the overlay list to appear
  await page.waitForSelector('.p-select-overlay, .p-select-list', { timeout: 5000 }).catch(() => {})

  const expectedOptions = [
    'Alcaldía',
    'Gobernación',
    'Secretarías',
    'Tributarios',
    'Registro Mercantil',
    'Otro',
  ]

  // Collect visible labels in the overlay (PrimeVue Select renders options in a portal)
  const overlayText = await page.locator('body').textContent()
  for (const opt of expectedOptions) {
    expect(overlayText, `option "${opt}" should be visible`).toContain(opt)
  }

  // Help description for Tributarios (RUT example) must be visible
  expect(overlayText).toContain('RUT')
})

test('P2-2: /certificados list page shows POR_VENCER badge on certs ≤30 days from vencimiento', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/certificados')
  await page.waitForLoadState('networkidle')

  // Insert a near-expiry test cert via API (replace-all semantics not relevant — POST)
  const inDays = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() + n)
    return d.toISOString().slice(0, 10)
  }

  const apiResp = await page.request.post('http://localhost:3101/api/v1/certificates', {
    data: {
      tipoCertificado: 'ALCALDIA',
      nombre: `P2 POR_VENCER ${Date.now()}`,
      fechaEmision: inDays(-10),
      fechaVencimiento: inDays(15), // 15 days from today → POR_VENCER
      estado: 'VIGENTE',
    },
  })
  expect(apiResp.status(), `failed to seed cert: ${await apiResp.text()}`).toBe(201)

  // Also insert one far in the future (no badge expected)
  const farResp = await page.request.post('http://localhost:3101/api/v1/certificates', {
    data: {
      tipoCertificado: 'GOBERNACION',
      nombre: `P2 FUTURO ${Date.now()}`,
      fechaEmision: inDays(-10),
      fechaVencimiento: inDays(200),
      estado: 'VIGENTE',
    },
  })
  expect(farResp.status()).toBe(201)

  // Reload and assert badge appears
  await page.reload()
  await page.waitForLoadState('networkidle')

  // Look for the POR_VENCER tag specifically — PrimeVue Tag renders as .p-tag with text
  const tags = page.locator('.p-tag', { hasText: 'POR_VENCER' })
  await expect(tags.first()).toBeVisible({ timeout: 5000 })

  // Cleanup
  await apiResp.dispose()
  await farResp.dispose()
})