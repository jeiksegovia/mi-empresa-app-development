/**
 * LOCAL QA — jul-11 B4a regression: certificate create/cancel must leave NO
 * stale file state behind. Previously the IDB stash (`cert-crear:file` /
 * `:comprobante`) survived submit and cancel — the next visit to
 * /certificados/crear restored a file chip with a null archivoUrl, and the
 * user's "attached" file was silently never sent.
 *
 * Flow:
 *   1. crear → attach a first-update file (uploads eagerly) → Crear
 *   2. detail page shows Descargar Archivo (propagation, B4b)
 *   3. back to /certificados/crear → the first-update dropzone is EMPTY
 *   4. attach again → Cancelar → return → dropzone EMPTY again
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul11-cert-stash-clear.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-11 cert create/cancel clears file stash (B4a)', () => {
  test('file fields start clean after create and after cancel', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    const API = await getApiBase(page)
    await loginAsAdmin(page)

    const certName = `JUL11 STASH ${Date.now()}`

    // ── 1. create with a first-update file ──────────────────────────────
    await page.goto(`${FRONTEND}/certificados/crear`)
    await page.waitForLoadState('networkidle')

    await page.getByText('Seleccionar tipo').click()
    await page.getByRole('option', { name: 'Otro' }).click()
    await page.getByPlaceholder('Ej: RUT 2024').fill(certName)

    const dropzone = page.getByTestId('cert-first-update-file-dropzone')
    await expect(dropzone).toBeVisible()
    await dropzone.click()
    await page.locator('input[type="file"]').first().setInputFiles({
      name: `cert-jul11-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from(`%PDF-1.4 jul11 stash regression ${Date.now()}`),
    })
    // Eager upload finishes → green check.
    await expect(page.locator('.pi-check-circle').first()).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Crear Certificado' }).click()
    await page.waitForURL(/\/certificados\/\d+/, { timeout: 15000 })

    // ── 2. B4b: the first update's file surfaces as the current version ──
    await expect(page.getByRole('button', { name: 'Descargar Archivo' }).first())
      .toBeVisible({ timeout: 10000 })

    // ── 3. back to crear: no stale chip, dropzone is pristine ───────────
    await page.goto(`${FRONTEND}/certificados/crear`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600) // give the IDB restore path time to (not) fire
    await expect(page.getByTestId('cert-first-update-file-dropzone')).toBeVisible()

    // ── 4. attach again then cancel → still pristine on return ──────────
    await page.getByTestId('cert-first-update-file-dropzone').click()
    await page.locator('input[type="file"]').first().setInputFiles({
      name: `cert-jul11-cancel-${Date.now()}.pdf`,
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 jul11 cancel path'),
    })
    await expect(page.locator('.pi-check-circle').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancelar' }).last().click()
    await page.waitForURL(/\/certificados$/, { timeout: 10000 })

    await page.goto(`${FRONTEND}/certificados/crear`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(600)
    await expect(page.getByTestId('cert-first-update-file-dropzone')).toBeVisible()
  })
})
