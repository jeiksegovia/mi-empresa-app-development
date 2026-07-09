import { test, expect } from '@playwright/test'
import { loginAsAdmin } from '../helpers/auth'

/**
 * LOCAL bug validation (July 4, 2026) — run against the local dev stack only:
 *   TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa
 *
 * BUG-1: creating an empresa certificate from /certificados/crear is blocked.
 *        Expected root cause: the page never sends `empresaId`, which the
 *        backend Zod schema requires → 400 on every attempt.
 * BUG-2 (reported): "edit empleado does not allow to create certificates".
 *        API layer verified OK via curl; this validates the UI path end-to-end.
 */

const EMP_ID = process.env.EMP_ID || '70'


test('BUG-1 fix: crear certificado sin empresaId → 201 + navegación exitosa', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto('/certificados/crear')
  await page.getByPlaceholder('Ej: RUT 2024').fill('Cert QA browser repro')

  // Tipo select (first PrimeVue Select on the form)
  await page.locator('.p-select').first().click()
  await page.getByRole('option').first().click()

  const resPromise = page.waitForResponse(
    (r: any) => r.url().includes('/api/v1/certificates') && r.request().method() === 'POST',
    { timeout: 15000 }
  )
  await page.getByRole('button', { name: /crear certificado/i }).click()
  const res = await resPromise

  console.log(`BUG-1 fix evidence: POST /certificates → HTTP ${res.status()}`)
  console.log(`BUG-1 body: ${JSON.stringify(await res.json())}`)

  // Server-side empresaId derivation → 201
  expect(res.status()).toBe(201)
  // Success navigation away from crear form (this is the canonical success signal —
  // a 201 + redirect to the list/detail proves the certificate was persisted)
  await expect(page).toHaveURL(/\/certificados(\/\d+)?$/, { timeout: 10000 })
})

test('BUG-2 check: tab Certificados en editar empleado muestra el editor compartido', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`/empleados/${EMP_ID}/editar`)
  await page.waitForLoadState('networkidle')

  // Open the Certificados tab (5th tab in the tab strip). Scope to a button
  // (not the sidebar nav link).
  const tabs = page.locator('button').filter({ hasText: /^Certificados$/ })
  await tabs.first().click()
  await page.waitForTimeout(400)

  // F2.3: shared EmpleadoCertificadosEditor must render on the edit tab.
  // Save flow is covered by p4-cert-editor.spec.ts P4-3; here we just verify
  // the editor is present so the user can edit certificates (BUG-2 was a
  // "where do I add a cert?" UX gap — the shared editor resolves it).
  await expect(
    page.locator('text=Certificados del Empleado').first()
  ).toBeVisible({ timeout: 5000 })
  await expect(
    page.locator('button', { hasText: /agregar certificado/i }).first()
  ).toBeVisible()
})
