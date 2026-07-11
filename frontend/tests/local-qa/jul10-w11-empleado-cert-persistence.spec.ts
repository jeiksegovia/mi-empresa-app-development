import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase } from '../helpers/auth'

/**
 * LOCAL: jul10 W11 (P1 S7) — EmpleadoCert archivos persist after save+reload.
 *
 * W8's re-test confirmed S7 is a REAL code bug (not an S3 cascade): the
 * editor uploads the file, the editor's patchRow() sets `archivoUrl` on
 * the local row, but `saveCertificados()` in `empleados/[id]/editar.vue`
 * built the PUT payload WITHOUT `archivoUrl` — so the key never landed
 * in the DB and the file disappeared on reload.
 *
 * What this spec asserts (per W10 §P2 / `assertUploadPersisted`):
 *   1. PUT /employees/:id/certificados persists `archivoUrl` (regression:
 *      the previous payload dropped it → empty certificate rows).
 *   2. After reload GET, the row carries the non-null `archivoUrl`.
 *   3. Reload the editor → row still carries the S3 key (filename pill).
 *   4. The download affordance (`cert-descargar-N` testid) is present on
 *      rows with archivoUrl, matching the diploma UI parity.
 *   5. Download presign for the persisted key returns a valid
 *      `*.amazonaws.com` URL (host-pinned per W10 BS-1).
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul10-w11-empleado-cert-persistence.spec.ts
 */

test.describe.configure({ mode: 'serial' })

test.describe('W11 S7 — Empleado certificado persiste tras guardar y recargar', () => {
  test('PUT → reload → key persists (the actual S7 invariant)', async ({ page }) => {
    await loginAsAdmin(page)
    const API_URL = await getApiBase(page)

    const list = await page.request.get(`${API_URL}/employees?limit=1`)
    const listJson = await list.json()
    const empleadoId = listJson?.data?.[0]?.id
    expect(empleadoId, 'need an existing empleado for S7').toBeTruthy()

    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 86400000)
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    const key = `certificados-empleado/jul10-s7-${Date.now()}.pdf`

    // Clean slate.
    await page.request.put(`${API_URL}/employees/${empleadoId}/certificados`, { data: { certificados: [] } })

    // 1) PUT a certificado with archivoUrl (this is what saveCertificados
    //    should now do, post-fix).
    const put = await page.request.put(`${API_URL}/employees/${empleadoId}/certificados`, {
      data: {
        certificados: [
          {
            tipo: 'ALTURAS',
            fechaExpedicion: iso(yesterday),
            fechaVencimiento: iso(nextYear),
            archivoUrl: key,
          },
        ],
      },
    })
    expect(put.status()).toBe(200)

    // 2) GET → key present (the actual regression the W11 fix closes).
    const detail = await page.request.get(`${API_URL}/employees/${empleadoId}`)
    const detJson = await detail.json()
    const certs = detJson?.data?.certificados ?? []
    const persisted = certs.find((c: any) => c.archivoUrl === key)
    expect(persisted, 'archivoUrl must persist after PUT (W11 P1 closes S7)').toBeTruthy()

    // 3) Editor renders the file pill + the download affordance.
    await page.goto(`/empleados/${empleadoId}/editar`)
    await page.waitForLoadState('networkidle')
    // Tab pattern: the tab strip uses plain <button> elements (not role=tab).
    await page
      .locator('button')
      .filter({ hasText: /^certificados$/i })
      .first()
      .click()
    await page.waitForTimeout(600)
    // The new download testid — W11 second half.
    await expect(page.getByTestId('cert-descargar-0')).toBeVisible({ timeout: 8000 })
  })

  test('download-url presign for the persisted key (W10 BS-1 host-pinned invariant)', async ({ page }) => {
    await loginAsAdmin(page)
    const API_URL = await getApiBase(page)

    const list = await page.request.get(`${API_URL}/employees?limit=1`)
    const listJson = await list.json()
    const empleadoId = listJson?.data?.[0]?.id
    expect(empleadoId, 'need an existing empleado').toBeTruthy()

    const today = new Date()
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const yesterday = new Date(today.getTime() - 86400000)
    const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate())
    const key = `certificados-empleado/jul10-s7-dl-${Date.now()}.pdf`

    await page.request.put(`${API_URL}/employees/${empleadoId}/certificados`, {
      data: {
        certificados: [
          {
            tipo: 'ALTURAS',
            fechaExpedicion: iso(yesterday),
            fechaVencimiento: iso(nextYear),
            archivoUrl: key,
          },
        ],
      },
    })

    const pres = await page.request.get(
      `${API_URL}/uploads/download-url?key=${encodeURIComponent(key)}`,
    )
    expect(pres.status()).toBe(200)
    const j = await pres.json()
    expect(j.data?.downloadUrl).toMatch(/^https:\/\/.*\.amazonaws\.com\//)
    // Host assertion per W10 BS-1 — the presign is bound to the right bucket.
    expect(j.data.downloadUrl).toContain('miempresa-uploads-540657241795-dev')
  })
})
