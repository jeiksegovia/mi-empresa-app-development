/**
 * Staging UI — sep-11 GERONTOLOGA create cert + first update.
 *
 * Confirms the prod hole is closed:
 *   POST /certificates 201 then POST /certificates/:id/updates 201
 *   (was 403 requireRole ADMIN → empty cert).
 *
 * Notas-only first update (no S3) is enough: crear.vue posts /updates whenever
 * any first-update field is set.
 *
 *   TEST_FRONTEND_URL=https://miempresa-stg.disruptiveexp.com
 *   QA_GERONTOLOGA_EMAIL / QA_GERONTOLOGA_PASSWORD
 */

import { test, expect } from '@playwright/test'

const FE = process.env.TEST_FRONTEND_URL || 'https://miempresa-stg.disruptiveexp.com'
const EMAIL = process.env.QA_GERONTOLOGA_EMAIL || 'qa-gerontologa@miempresa.com'
const PASSWORD = process.env.QA_GERONTOLOGA_PASSWORD || ''

test.describe.configure({ mode: 'serial' })

test.describe('sep-11 GERONTOLOGA cert create + first update (staging UI)', () => {
  test.skip(!PASSWORD, 'QA_GERONTOLOGA_PASSWORD required')

  test('login → Nuevo Certificado → crear with primera actualización notas → no 403 on /updates', async ({
    page,
  }) => {
    const posts: { url: string; status: number }[] = []
    page.on('response', (res) => {
      const url = res.url()
      if (url.includes('/api/v1/certificates') && res.request().method() === 'POST') {
        posts.push({ url, status: res.status() })
      }
    })

    await page.goto(`${FE}/login`)
    await page.locator('#email').fill(EMAIL)
    await page.locator('#password input').fill(PASSWORD)
    await page.getByRole('button', { name: /iniciar sesión/i }).click()
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 20000 })

    await page.goto(`${FE}/certificados?cb=${Date.now()}`, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('cert-nuevo')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('cert-nuevo').click()
    await page.waitForURL(/\/certificados\/crear/, { timeout: 15000 })
    await expect(page.getByTestId('cert-crear-submit')).toBeVisible({ timeout: 15000 })

    await page.getByText('Tipo de Certificado', { exact: false }).first().waitFor({ timeout: 10000 })
    await page.locator('.p-select, [role="combobox"]').first().click()
    await page.getByRole('option', { name: /Otro/i }).click()

    const stamp = Date.now()
    await page.getByPlaceholder('Ej: RUT 2024').fill(`STG SEP11 UI ${stamp}`)

    const notas = page.getByPlaceholder('Notas de esta actualización...')
    await notas.click()
    await notas.pressSequentially(`primera actualizacion ui ${stamp}`, { delay: 15 })

    const updatesResp = page.waitForResponse(
      (res) => res.request().method() === 'POST' && /\/certificates\/\d+\/updates/.test(res.url()),
      { timeout: 20000 },
    )
    await page.getByTestId('cert-crear-submit').click()

    await expect.poll(() => posts.some((p) => /\/certificates$/.test(p.url.split('?')[0]) && p.status === 201), {
      timeout: 20000,
    }).toBeTruthy()

    const debug = await page.evaluate(() => sessionStorage.getItem('sep11-cert-debug'))
    const updateRes = await updatesResp
    posts.push({ url: updateRes.url(), status: updateRes.status() })
    expect(
      updateRes.status(),
      `first update must not 403. posts=${JSON.stringify(posts)} debug=${debug}`,
    ).toBe(201)

    await expect(page).not.toHaveURL(/\/certificados\/crear/)
    await expect(page.getByText(/falló la primera actualización/i)).toHaveCount(0)
  })
})
