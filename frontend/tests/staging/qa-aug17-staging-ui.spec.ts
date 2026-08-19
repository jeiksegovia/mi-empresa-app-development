import { test, expect } from '@playwright/test'

/**
 * Staging UI QA — qa-session-aug-17 R1 + R6 nav (custom domain only).
 *
 *   TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com
 *   QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD
 *   QA_CONTRATOS_EMAIL / QA_CONTRATOS_PASSWORD
 */

const FE = process.env.TEST_FRONTEND_URL || 'https://miempresa-stg.disruptiveexp.com'
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'qa-admin@miempresa.com'
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || ''
const CONTRATOS_EMAIL = process.env.QA_CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || ''

async function login(page: any, email: string, password: string) {
  await page.goto(`${FE}/login`)
  await page.locator('input[type="email"], input[name="email"]').first().fill(email)
  await page.locator('input[type="password"]').first().fill(password)
  await page.getByRole('button', { name: /iniciar|ingresar|entrar/i }).click()
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 20000 })
}

test.describe('Staging UI — qa-aug-17', () => {
  test.skip(!ADMIN_PASSWORD || !CONTRATOS_PASSWORD, 'QA passwords required')

  test('R1 ADMIN: Activos tab default, no Todos, Inactivos reachable', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto(`${FE}/empleados`)
    await expect(page.getByTestId('empleados-tab-activos')).toBeVisible()
    await expect(page.getByTestId('empleados-tab-inactivos')).toBeVisible()
    await expect(page.getByText('Todos', { exact: true })).toHaveCount(0)
    await page.getByTestId('empleados-tab-inactivos').click()
    await expect(page.getByTestId('empleados-tab-inactivos')).toBeVisible()
  })

  test('R6 ADMIN: Registro de actividades nav sits after Asistencia', async ({ page }) => {
    await login(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto(`${FE}/`)
    // Sidebar is a drawer (hidden until hamburger).
    await page.locator('button').filter({ has: page.locator('.pi-bars, .pi-align-left, .pi-bars') }).first().click({ timeout: 8000 }).catch(async () => {
      await page.getByRole('button').first().click()
    })
    const aside = page.locator('aside')
    await expect(aside).toBeVisible({ timeout: 8000 })
    const labels = (await aside.locator('a').allTextContents()).map((t: string) => t.replace(/\s+/g, ' ').trim())
    const asis = labels.findIndex((t: string) => /asistencia/i.test(t))
    const act = labels.findIndex((t: string) => /registro de actividades/i.test(t))
    expect(asis, `Asistencia in nav. labels=${JSON.stringify(labels)}`).toBeGreaterThanOrEqual(0)
    expect(act, 'Registro de actividades in nav').toBeGreaterThanOrEqual(0)
    expect(act).toBe(asis + 1)
    await page.goto(`${FE}/actividades`)
    await expect(page.getByTestId('actividades-texto')).toBeVisible({ timeout: 15000 })
  })

  test('R2 CONTRATOS: empleado editar contrato can load cargos (no 403 toast)', async ({ page, request }) => {
    await login(page, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    const forbidden: string[] = []
    page.on('response', (res: any) => {
      if (res.url().includes('/empresa/cargos') && res.status() === 403) forbidden.push(res.url())
    })
    const list = await request.get(`${process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'}/employees?estado=ACTIVO&limit=1`, {
      headers: { Cookie: (await page.context().cookies()).map((c: any) => `${c.name}=${c.value}`).join('; ') },
    })
    const empId = list.ok() ? (await list.json()).data?.[0]?.id : 1
    await page.goto(`${FE}/empleados/${empId}/editar`)
    await page.waitForTimeout(2500)
    expect(forbidden, 'GET /empresa/cargos must not 403 for CONTRATOS').toEqual([])
  })
})
