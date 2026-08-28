/**
 * aug-28 — live-SPA UI checks for two centro-costos fixes:
 *
 *  1. `ocultarBeneficiario`: Valoraciones hides Beneficiario on the ítem
 *     dialog (ADMIN checkbox "Ocultar campo beneficiario"); other INGRESOS
 *     centros keep it required.
 *  2. GET /empresa permission fix: the recibo header (nombre/nit/direccion)
 *     now renders for CONTRATOS, not just ADMIN — this was the root cause
 *     of the "missing header" bug. We fetch GET /empresa ourselves (as
 *     whichever role is logged in) and assert the recibo page shows the
 *     SAME values, so the check works unmodified against local or staging.
 *
 * Uses the login form (custom domain on staging) so the session cookie is
 * same-site — same pattern as fecha-lock-switch-ui.spec.ts.
 *
 * Run (staging):
 *   cd frontend && TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com \
 *     TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com \
 *     ADMIN_EMAIL=qa-admin@miempresa.com ADMIN_PASSWORD=… \
 *     CONTRATOS_EMAIL=qa-contratos@miempresa.com CONTRATOS_PASSWORD=… \
 *     npx playwright test tests/centro-costos/ocultar-beneficiario-empresa-ui.spec.ts --reporter=list
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'
const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@miempresa.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'
const CONTRATOS_EMAIL = process.env.CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.CONTRATOS_PASSWORD || 'password123'

async function loginUI(page: Page, email: string, password: string) {
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

async function apiLogin(request: APIRequestContext, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, { data: { email, password } })
  expect(resp.status(), `API login ${email}`).toBe(200)
  const cookie = resp.headers()['set-cookie']
  expect(cookie, `cookie for ${email}`).toBeTruthy()
  return cookie!
}

test.describe.configure({ mode: 'serial' })

test.describe('aug-28 ocultarBeneficiario + empresa-header UI (live SPA)', () => {
  test('ADMIN: Valoraciones item dialog hides Beneficiario; other INGRESOS keep it', async ({ page, request }) => {
    const adminCookie = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const centrosResp = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=INGRESOS`, {
      headers: { Cookie: adminCookie },
    })
    const centros = (await centrosResp.json()).data as Array<{
      id: number
      nombre: string
      ocultarBeneficiario: boolean
    }>
    const valoraciones = centros.find((c) => c.nombre === 'Valoraciones')
    expect(valoraciones, 'seeded Valoraciones centro').toBeTruthy()
    expect(valoraciones!.ocultarBeneficiario, 'Valoraciones.ocultarBeneficiario').toBe(true)
    const otherIngreso = centros.find((c) => c.id !== valoraciones!.id && !c.ocultarBeneficiario)
    expect(otherIngreso, 'another INGRESOS centro with beneficiario required').toBeTruthy()

    await loginUI(page, ADMIN_EMAIL, ADMIN_PASSWORD)
    await page.goto('/centro-costos')
    await page.waitForLoadState('networkidle')

    // Valoraciones: no Beneficiario field.
    await page.getByTestId(`centro-costos-grupo-header-${valoraciones!.id}`).click()
    await page.getByTestId(`centro-costos-add-item-${valoraciones!.id}`).click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cc-item-pagador')).toBeVisible()
    await expect(page.getByTestId('cc-item-beneficiario')).toHaveCount(0)
    await page.getByTestId('cc-item-cancelar').click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toHaveCount(0, { timeout: 5000 })

    // Another INGRESOS centro: Beneficiario stays required.
    await page.getByTestId(`centro-costos-grupo-header-${otherIngreso!.id}`).click()
    await page.getByTestId(`centro-costos-add-item-${otherIngreso!.id}`).click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cc-item-beneficiario')).toBeVisible()
    await page.getByTestId('cc-item-cancelar').click()
  })

  test('CONTRATOS recibo page renders the real empresa header (GET /empresa public fields)', async ({ page, request }) => {
    // 1. Fetch the public empresa record the way the recibo page will.
    const contratosCookie = await apiLogin(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    const empResp = await request.get(`${API_BASE}/api/v1/empresa`, { headers: { Cookie: contratosCookie } })
    expect(empResp.status(), 'CONTRATOS GET /empresa').toBe(200)
    const empBody = await empResp.json()
    expect(empBody.data, 'empresa must be bootstrapped').toBeTruthy()
    expect(empBody.data).not.toHaveProperty('telefono')
    const { nombre, nit, direccion } = empBody.data as { nombre: string; nit: string; direccion: string | null }

    // 2. Find (or create) a habilitarRecibo INGRESOS centro + a printable item.
    const adminCookie = await apiLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const centrosResp = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=INGRESOS`, {
      headers: { Cookie: adminCookie },
    })
    const centros = (await centrosResp.json()).data as Array<{
      id: number
      nombre: string
      habilitarRecibo: boolean
      precioUnitario: string | null
    }>
    const priced = centros.find((c) => c.precioUnitario != null) ?? centros[0]
    expect(priced, 'at least one INGRESOS centro').toBeTruthy()

    let restoreHabilitarRecibo = priced.habilitarRecibo
    if (!priced.habilitarRecibo) {
      const put = await request.put(`${API_BASE}/api/v1/centro-costos/${priced.id}`, {
        headers: { Cookie: adminCookie },
        data: { habilitarRecibo: true },
      })
      expect(put.status()).toBe(200)
    }

    const patientsResp = await request.get(`${API_BASE}/api/v1/patients?limit=1`, {
      headers: { Cookie: adminCookie },
    })
    const beneficiarioId = ((await patientsResp.json()).data ?? [])[0]?.id ?? null

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    const created = await request.post(`${API_BASE}/api/v1/centro-costos/${priced.id}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'QA UI recibo empresa header',
        fecha: today,
        pagador: 'QA UI Pagador',
        beneficiarioClienteId: beneficiarioId,
        medioPago: 'EFECTIVO',
      },
    })
    expect(created.status(), await created.text()).toBe(201)
    const itemId = (await created.json()).data.id as number

    try {
      // 3. Load the recibo page as CONTRATOS and assert the header matches.
      await loginUI(page, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
      await page.addInitScript(() => { window.print = () => {} })
      await page.goto(`/centro-costos/recibo/${itemId}`)
      await expect(page.getByTestId('recibo-content')).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('recibo-empresa')).toHaveText(nombre)
      await expect(page.locator('.recibo-meta').first()).toContainText(nit)
      if (direccion) {
        await expect(page.locator('.recibo-meta').nth(1)).toContainText(direccion)
      }
      await expect(page.getByTestId('recibo-pagador')).toContainText('QA UI Pagador')
    } finally {
      await request.delete(`${API_BASE}/api/v1/centro-costos/items/${itemId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {})
      if (!restoreHabilitarRecibo) {
        await request.put(`${API_BASE}/api/v1/centro-costos/${priced.id}`, {
          headers: { Cookie: adminCookie },
          data: { habilitarRecibo: false },
        }).catch(() => {})
      }
    }
  })
})
