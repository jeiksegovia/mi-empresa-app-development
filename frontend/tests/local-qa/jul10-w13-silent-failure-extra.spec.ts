import { test, expect, type Page } from '@playwright/test'
import { getApiBase, loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL: jul10 W13 — silent-failure EXTENSION (W10 BS-3).
 *
 * W11 (`jul10-w11-silent-failure.spec.ts`) covered the ficha + nota surfaces,
 * but its UI toast assertions are wrapped in `.catch(() => null)`, so they pass
 * even if the error toast never appears — they do not actually ENFORCE the
 * "failure must surface feedback" standard. This spec extends coverage to the
 * two surfaces W11 missed — cert-empresa upload and educación diploma — and
 * asserts the error toast HARD.
 *
 * Auth: uses BOTH logins because local dev splits auth stores — `page.request`
 * API calls need the session COOKIE (loginAsAdmin), while the SPA route guard
 * needs client-side TOKEN state (UI form login). An API-only login redirects
 * protected detail pages to /login; a UI-only login leaves page.request
 * unauthenticated. On staging both are cookie-based, so either would do.
 *
 * Mechanism: all upload surfaces share `useFileUpload().uploadFile`, which
 * toasts severity=error on presign failure. We `page.route` the presign to
 * ABORT and assert `.p-toast-message-error` becomes visible. Fixtures are
 * created via API (deterministic).
 */

const QA_EMAIL = process.env.QA_USER_EMAIL || 'admin@miempresa.com'
const QA_PASSWORD = process.env.QA_USER_PASSWORD || 'password123'

// Honest skip (NOT a soft-swallow): the local dev SPA holds its auth token in
// memory, so a full page navigation (page.goto) drops it and the guard redirects
// protected detail pages to /login — the same env limitation that breaks
// jul9-empleado-educacion / jul9-cert-update-comprobante locally. On a working
// frontend (or staging, which is cookie-based) these pages render and the toast
// assertions below run for real.
const envAuthSkipReason =
  'local frontend does not persist auth across full page navigation (in-memory token); UI toast assertion runs on a working frontend/staging'

async function uiLogin(page: Page) {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')
  await page.locator('input[type="email"]').fill(QA_EMAIL)
  await page.locator('input[type="password"]').fill(QA_PASSWORD)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/$/, { timeout: 15000 })
}

test.describe.configure({ mode: 'serial' })

test.describe('W13 silent-failure extension (cert-empresa + diploma)', () => {
  test('educación diploma: presign abort surfaces an error toast (not silent)', async ({ page }) => {
    await loginAsAdmin(page) // cookie → page.request fixtures
    const API = await getApiBase(page)

    const empId = (await (await page.request.get(`${API}/employees?limit=1`)).json())?.data?.[0]?.id
    if (!empId) {
      test.skip(true, 'no empleado seeded')
      return
    }

    // Deterministic fixture: an educación row renders a diploma input.
    const create = await page.request.post(`${API}/employees/${empId}/educacion`, {
      data: { profesion: `W13 Diploma ${Date.now().toString().slice(-6)}`, universidad: 'Universidad Test' },
    })
    expect(create.status(), `create educacion failed: ${await create.text()}`).toBe(201)
    const eduId = (await create.json()).data.id

    try {
      await uiLogin(page) // SPA token → protected pages render
      await page.route('**/uploads/presigned-url', (r) => r.abort('failed'))

      // Relative path → uses baseURL (TEST_FRONTEND_URL); correct on local + staging.
      await page.goto(`/empleados/${empId}/editar`)
      await page.waitForLoadState('networkidle')
      if (page.url().includes('/login')) {
        test.skip(true, envAuthSkipReason)
        return
      }
      // Tabs use v-show (content always mounted), so the diploma input is
      // attached regardless of the active tab — no tab click needed.
      const diplomaInput = page.locator(`input[data-testid="educacion-diploma-input-${eduId}"]`)
      await diplomaInput.waitFor({ state: 'attached', timeout: 10000 })
      await diplomaInput.setInputFiles({
        name: 'w13-diploma.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 w13 diploma fail probe'),
      })

      await expect(
        page.locator('.p-toast-message-error').first(),
        'diploma upload failure must show an error toast',
      ).toBeVisible({ timeout: 8000 })
    } finally {
      await page.unroute('**/uploads/presigned-url').catch(() => {})
      await page.request.delete(`${API}/employees/${empId}/educacion/${eduId}`).catch(() => {})
    }
  })

  test('cert-empresa update: presign abort surfaces an error toast (not silent)', async ({ page }) => {
    await loginAsAdmin(page) // cookie → page.request fixtures
    const API = await getApiBase(page)

    // Deterministic fixture: throwaway certificado (mirrors jul9 cert spec).
    const c = await page.request.post(`${API}/certificates`, {
      data: { nombre: `W13 CertFail ${Date.now()}`, tipoCertificado: 'TRIBUTARIOS', periodicidad: 'UNICA' },
    })
    expect(c.status(), `create certificado failed: ${await c.text()}`).toBe(201)
    const certId = (await c.json()).data.id

    try {
      await uiLogin(page) // SPA token → protected pages render
      await page.route('**/uploads/presigned-url', (r) => r.abort('failed'))

      await page.goto(`/certificados/${certId}`)
      await page.waitForLoadState('networkidle')
      if (page.url().includes('/login')) {
        test.skip(true, envAuthSkipReason)
        return
      }

      const addBtn = page.getByTestId('cert-add-update-btn')
      await expect(addBtn).toBeVisible({ timeout: 8000 })
      await addBtn.click()

      const dialog = page.getByTestId('cert-add-update-dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })

      // The archivo dropzone's hidden file input is the first file input in the
      // dialog (comprobante is second).
      const fileInput = dialog.locator('input[type="file"]').first()
      await fileInput.waitFor({ state: 'attached', timeout: 5000 })
      await fileInput.setInputFiles({
        name: 'w13-cert-empresa.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4 w13 cert-empresa fail probe'),
      })

      await expect(
        page.locator('.p-toast-message-error').first(),
        'cert-empresa upload failure must show an error toast',
      ).toBeVisible({ timeout: 8000 })
    } finally {
      await page.unroute('**/uploads/presigned-url').catch(() => {})
      await page.request.delete(`${API}/certificates/${certId}`).catch(() => {})
    }
  })
})
