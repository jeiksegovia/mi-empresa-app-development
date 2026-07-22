/**
 * Smoke: Asistencia Registrar hoy
 * Login admin → /asistencia → toggle AM on first row → save → reload → assert checked
 * (API assert is source of truth; UI re-check is best-effort).
 *
 * Run (local):
 *   cd frontend && npx playwright test tests/asistencia/registrar-hoy.spec.ts
 */
import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

function todayYMD(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

test.describe('Asistencia — Registrar hoy', () => {
  test('loads page, toggles AM, saves, and persists', async ({ page }) => {
    await loginAsAdmin(page)
    const FRONTEND_URL = getFrontendOrigin()
    const API = await getApiBase(page)
    const fecha = todayYMD()

    // Seed baseline via API so the toggle is a real flip (AM starts false).
    const listResp = await page.request.get(`${API}/asistencia?fecha=${fecha}`)
    expect(listResp.status(), `GET /asistencia?fecha=${fecha}`).toBe(200)
    const listBody = await listResp.json()
    expect(listBody.success).toBe(true)
    const board: Array<{
      empleadoId: number
      jornadaAm: boolean
      jornadaPm: boolean
      notas: string | null
    }> = listBody.data ?? []

    test.skip(board.length === 0, 'No ACTIVO employees — cannot exercise matrix')

    const target = board[0]
    const targetId = target.empleadoId

    await page.request.put(`${API}/asistencia/dia`, {
      data: {
        fecha,
        items: [
          {
            empleadoId: targetId,
            jornadaAm: false,
            jornadaPm: !!target.jornadaPm,
            notas: target.notas ?? null,
          },
        ],
      },
    })

    await page.goto(`${FRONTEND_URL}/asistencia`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1').filter({ hasText: /Asistencia de empleados/i })).toBeVisible({
      timeout: 15000,
    })
    await expect(page.getByTestId('asistencia-fecha')).toBeVisible()
    await expect(page.getByTestId('asistencia-buscar')).toBeVisible()
    await expect(page.getByTestId('asistencia-guardar')).toBeVisible()
    await expect(page.getByTestId('asistencia-hoy')).toBeVisible()

    const amBox = page.getByTestId(`asistencia-am-${targetId}`)
    await expect(amBox).toBeVisible({ timeout: 10000 })
    await expect(amBox).toHaveAttribute('aria-checked', 'false')

    // Toggle AM via large checkbox button.
    await amBox.click()
    await expect(amBox).toHaveAttribute('aria-checked', 'true')

    const putWait = page.waitForResponse(
      (r) => /\/api\/v1\/asistencia\/dia/.test(r.url()) && r.request().method() === 'PUT',
      { timeout: 20000 },
    )
    await page.getByTestId('asistencia-guardar').click()
    const putResp = await putWait
    expect(putResp.status()).toBe(200)

    // Reload page and assert AM stays checked for that employee.
    await page.reload()
    await page.waitForLoadState('networkidle')
    const amAfter = page.getByTestId(`asistencia-am-${targetId}`)
    await expect(amAfter).toBeVisible({ timeout: 10000 })
    await expect(amAfter).toHaveAttribute('aria-checked', 'true')

    // API truth for persistence.
    const after = await page.request.get(`${API}/asistencia?fecha=${fecha}`)
    expect(after.status()).toBe(200)
    const afterBody = await after.json()
    const row = (afterBody.data ?? []).find((r: { empleadoId: number }) => r.empleadoId === targetId)
    expect(row, `row for empleadoId=${targetId}`).toBeTruthy()
    expect(row.jornadaAm).toBe(true)
  })
})
