/**
 * LOCAL QA — jul-9 (W4 — T14): A1–A3 Cert create form simplification.
 *
 * Reference: `task-assignment-qa.md` T14 item 1 — the create form should show
 * ONLY 4 metadata fields (Tipo, Nombre, Descripción, Periodicidad) and the
 * previously inline date/file inputs must be GONE. The "Primera actualización"
 * card exposes 2 dropzones (archivo + comprobante) via the shared
 * CertificateUpdateForm component.
 *
 * Strategy: navigate to /certificados/crear, then:
 *   - assert the 4 metadata field labels are present
 *   - assert the page has NO <input type=date> for fechaEmision/fechaVencimiento
 *     at the top level (the update card may still have one — accept that)
 *   - assert the 2 dropzones (archivo + comprobante) are visible inside the
 *     first-update Card (cert-first-update-file-dropzone +
 *     cert-first-update-comprobante-dropzone)
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test jul9-cert-crear-simplified.spec.ts
 */

import { test, expect } from '@playwright/test'
import { loginAsAdmin, getFrontendOrigin } from '../helpers/auth'

test.describe('jul-9 cert crear — simplified form (A1–A3)', () => {
  test('create form shows only 4 metadata fields + first-update card with 2 dropzones', async ({ page }) => {
    const FRONTEND = getFrontendOrigin()
    await loginAsAdmin(page)

    await page.goto(`${FRONTEND}/certificados/crear`)
    await page.waitForLoadState('networkidle')

    // 1) The 4 metadata fields must be present. We look for the textbox /
    //    combobox by accessible name (PrimeVue renders placeholders as the
    //    accessible name via aria).
    await expect(page.getByText('Tipo de Certificado')).toBeVisible({ timeout: 5000 })
    // Nombre input has placeholder "Ej: RUT 2024"
    await expect(page.getByPlaceholder('Ej: RUT 2024')).toBeVisible({ timeout: 5000 })
    // Descripción input has placeholder "Descripción adicional del certificado..."
    await expect(page.getByPlaceholder('Descripción adicional del certificado...')).toBeVisible()
    // Periodicidad is a Select (combobox) with default label "Única"
    await expect(page.locator('.p-select').filter({ hasText: /[ÚU]nica/ }).first()).toBeAttached()

    // 2) Removed inputs MUST be absent at the top of the form. The old
    //    emit/exp date pair lived inside the metadata card. After W2 the page
    //    intentionally has no metadata-level date inputs.
    const pageHtml = await page.content()
    expect(pageHtml).not.toContain('Fecha de emisión')
    expect(pageHtml).not.toContain('Fecha de vencimiento')
    // The legacy "Periodo" picker (one for MENSUAL/etc.) was also removed
    expect(pageHtml).not.toContain('Periodo (YYYY-MM)')

    // 3) The first-update card with the shared form must be present
    await expect(page.getByText('Primera actualización').first()).toBeVisible({ timeout: 5000 })

    // 4) The 2 dropzones (archivo + comprobante) inside the first-update Card
    await expect(page.getByTestId('cert-first-update-file-dropzone')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cert-first-update-comprobante-dropzone')).toBeVisible({ timeout: 5000 })
  })
})
