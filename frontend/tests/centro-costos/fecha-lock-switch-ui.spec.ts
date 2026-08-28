/**
 * aug-27 F4 — ADMIN "Limitar fechas CONTRATOS" switch on the live SPA.
 *
 * Uses the login form (custom domain) so the session cookie is same-site.
 * Staging: TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com
 *          ADMIN_EMAIL/PASSWORD + CONTRATOS_EMAIL/PASSWORD from SSM.
 *
 * Run:
 *   cd frontend && TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com \
 *     ADMIN_EMAIL=qa-admin@miempresa.com ADMIN_PASSWORD=… \
 *     CONTRATOS_EMAIL=qa-contratos@miempresa.com CONTRATOS_PASSWORD=… \
 *     npx playwright test tests/centro-costos/fecha-lock-switch-ui.spec.ts --reporter=list
 */

import { test, expect, type Page } from '@playwright/test'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@miempresa.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'
const CONTRATOS_EMAIL = process.env.CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.CONTRATOS_PASSWORD || 'password123'

async function login(page: Page, email: string, password: string) {
  await page.context().clearCookies()
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('#email').fill(email)
  const pw = page.locator('#password input')
  if (await pw.count()) {
    await pw.fill(password)
  } else {
    await page.locator('#password').fill(password)
  }
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

test.describe.configure({ mode: 'serial' })

test.describe('F4 fecha-lock switch UI', () => {
  test('ADMIN sees the Limitar fechas CONTRATOS switch', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/centro-costos')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('centro-costos-fecha-lock')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Limitar fechas CONTRATOS')).toBeVisible()
    await expect(page.getByTestId('centro-costos-fecha-lock-switch')).toBeVisible()
  })

  test('CONTRATOS does not see the switch; month picker visible while lock is off', async ({ page }) => {
    await login(page, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    await page.goto('/centro-costos')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Centro de Costos').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('centro-costos-fecha-lock')).toHaveCount(0)
    await expect(page.getByTestId('centro-costos-periodo')).toBeVisible()
  })
})
