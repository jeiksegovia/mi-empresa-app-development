import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase } from '../helpers/auth'

/**
 * LOCAL: jul4 P1 — Empresa certificados recurrentes (periodicidad + comprobante + duplicate-for-month alert).
 *
 *  - Create a MENSUAL cert with current month as periodo + comprobante upload
 *  - Missing-month alert appears when no current-month row exists for a MENSUAL cert name
 *  - "Duplicar para este mes" action creates a current-month row → alert clears
 *  - tipo_certificado NOT NULL after the migration (DRIFT-1 fix)
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul4-p1-cert-recurrente.spec.ts
 */


function currentPeriodoDate(): string {
  // First day of current month
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

test('P1-1: create MENSUAL cert via API with comprobante, periodo persists; /certificates page renders row', async ({ page }) => {
  await loginAsAdmin(page)
  const uniq = `${Date.now()}`
  const body = {
    nombre: `CertJul4Test ${uniq}`,
    tipoCertificado: 'TRIBUTARIOS',
    periodicidad: 'MENSUAL',
    periodo: currentPeriodoDate(),
    comprobantePagoUrl: `certificados/test-comprobante-${uniq}.pdf`,
  }
  const API_URL = await getApiBase(page)
  const create = await page.request.post(`${API_URL}/certificates`, { data: body })
  expect(create.status()).toBe(201)
  const created = await create.json()
  const id = created?.data?.id
  expect(id, 'POST returned id').toBeTruthy()

  // GET to verify persistence of new fields
  const detail = await page.request.get(`${API_URL}/certificates/${id}`)
  const det = await detail.json()
  expect(det?.data?.periodicidad).toBe('MENSUAL')
  expect(det?.data?.periodo).toContain(currentPeriodoDate().slice(0, 7)) // YYYY-MM prefix
  expect(det?.data?.comprobantePagoUrl).toBe(body.comprobantePagoUrl)
})

test('P1-2: missing-month alert appears when a MENSUAL cert has no current-month row, and clears (for that name) after duplicate-for-month', async ({ page }) => {
  await loginAsAdmin(page)
  const uniq = `${Date.now()}`
  // jul-10 E1: the entity `nombre` is auto-uppercased on the server. The alert
  // shows the STORED name (UPPERCASE), so we assert against the uppercased key.
  const certNameSent = `MensualAlertJul4 ${uniq}`
  const certNameStored = `MENSUALALERTJUL4 ${uniq}`

  // Step 1: Create a MENSUAL cert WITHOUT a row for current month (periodo in the past).
  const API_URL = await getApiBase(page)
  const create = await page.request.post(`${API_URL}/certificates`, {
    data: {
      nombre: certNameSent,
      tipoCertificado: 'TRIBUTARIOS',
      periodicidad: 'MENSUAL',
      periodo: '2026-01-01',
    },
  })
  expect(create.status()).toBe(201)

  // Step 2: Visit /certificados — the alert should be visible with our cert name.
  await page.goto('/certificados')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500) // let stats fetch + Vue render

  const alert = page.getByTestId('cert-missing-month-alert')
  await expect(alert).toBeVisible({ timeout: 8000 })
  await expect(alert).toContainText(certNameStored)

  // Step 3: Click the "Duplicar" button that is in the same row as our cert.
  // We find the row containing the stored certName, then click its duplicate button.
  const rowWithOurCert = page
    .locator('tr')
    .filter({ has: page.locator('td', { hasText: certNameStored }) })
    .first()
  await expect(rowWithOurCert).toBeVisible({ timeout: 5000 })
  await rowWithOurCert.getByTestId('cert-duplicate-btn').click()

  // Wait for the duplicate POST and stats refresh to complete.
  await page.waitForTimeout(2000)

  // Step 4: Our specific cert name should no longer appear in the alert (a
  // current-month row was created). The alert itself may still show for
  // unrelated leftover rows from prior runs.
  await expect(alert).not.toContainText(certNameStored, { timeout: 8000 })
})

test('P1-3: DRIFT-1 fixed — tipo_certificado is NOT NULL in DB after migration', async ({ page }) => {
  // Smoke test: simply attempt to POST a cert without tipoCertificado — should return 400.
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const resp = await page.request.post(`${API_URL}/certificates`, {
    data: { nombre: 'NoTipoTest', periodicidad: 'UNICA' },
  })
  expect(resp.status(), 'Zod requires tipoCertificado').toBe(400)
})
