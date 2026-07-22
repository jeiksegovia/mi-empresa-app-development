/**
 * audit-dryrun-live.spec.ts — fixes-jul17-2 W11 QA validation, Step 5.
 *
 * LIVE audit-view + dry-run ("Probar sin guardar") against the real backend
 * + frontend with a real seeded admin user. Covers contract §4:
 *
 *   1. Audit view on BARTHEL: 10 items, option scores for "Comida" (10/5/0),
 *      global ranges table with the 4 bands incl. "Dependencia ligera".
 *   2. Audit view on MNA_CUADRO: skip-rule text + cribaje section-level
 *      ranges table with the 3 bands incl. "Estado nutricional normal".
 *   3. Dry-run: fill BARTHEL all-max → total=100 + "Dependencia ligera",
 *      ZERO POST/PATCH/PUT/DELETE intercepted, NO new ficha row in the DB.
 *
 * ── LIVE (no mocking) ──────────────────────────────────────────────────────
 * W10's audit-dryrun.spec.ts mocked all endpoints for determinism; this is
 * the authoritative live re-run against the real seeded BARTHEL/MNA
 * templates and the live SPA. The dry-run zero-write assertion is
 * authoritative regardless of mocking because it uses request interception.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test instruments-dynamic/audit-dryrun-live.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://100.85.193.33:3100'
const API = process.env.TEST_API_URL || 'http://100.85.193.33:3101/api/v1'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'

const connectionString =
  process.env.DATABASE_URL || 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev'
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

// Load seeded templates from the repo so the test doesn't rely on fixture
// drift between /tests/fixtures and the live /instrument-templates JSON.
const TEMPLATES_DIR = path.resolve(
  fileURLToPath(import.meta.url),
  '..',
  '..',
  '..',
  '..',
  'backend',
  'prisma',
  'instrument-templates',
)
function loadTemplate(codigo: string): any {
  return JSON.parse(readFileSync(path.join(TEMPLATES_DIR, `${codigo}.v1.json`), 'utf-8'))
}

async function loginAdmin(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'session' }).catch(() => {})
  const resp = await page.request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(resp.status(), 'admin login').toBe(200)
}

test.describe.configure({ mode: 'serial' })

test.describe('Live audit + dry-run (fixes-jul17-2 §4)', () => {
  let barthel: any
  let mna: any
  let barthelId: number
  let mnaId: number
  let patientId: number
  let fichasBefore: number

  test.beforeAll(async () => {
    barthel = loadTemplate('BARTHEL')
    mna = loadTemplate('MNA_CUADRO')

    // Find the live IDs for the seeded instruments.
    const barthelRow = await prisma.instrumento.findUnique({ where: { codigo: 'BARTHEL' } })
    const mnaRow = await prisma.instrumento.findUnique({ where: { codigo: 'MNA_CUADRO' } })
    expect(barthelRow, 'BARTHEL seeded').toBeTruthy()
    expect(mnaRow, 'MNA_CUADRO seeded').toBeTruthy()
    barthelId = barthelRow!.id
    mnaId = mnaRow!.id
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
    const patientsResp = await page.request.get(`${API}/patients?limit=1`)
    expect(patientsResp.status()).toBe(200)
    const patientsBody = await patientsResp.json()
    expect(patientsBody.data?.length).toBeTruthy()
    patientId = patientsBody.data[0].id

    // Count existing fichas so the dry-run zero-write assertion can also
    // verify "no new ficha row".
    const detail = await page.request.get(`${API}/patients/${patientId}`)
    const detailBody = await detail.json()
    fichasBefore = (detailBody.data?.registrosFichas ?? []).length
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('BARTHEL audit: 10 items, option scores (Comida 10/5/0), global ranges table', async ({ page }) => {
    await page.goto(`${FRONTEND}/instrumentos/${barthelId}`)
    await page.getByTestId('audit-expand').waitFor({ state: 'visible', timeout: 15000 })
    // Expand the audit panel.
    await page.getByTestId('audit-expand').evaluate((d: any) => {
      d.open = true
    })

    const view = page.getByTestId('instrument-audit-view')
    await expect(view.locator('[data-audit-item]')).toHaveCount(10)

    const comida = view.locator('[data-audit-item="comida"]')
    await expect(comida).toContainText('Independiente')
    const scores = comida.locator('[data-audit-option] td:last-child')
    await expect(scores.nth(0)).toHaveText('10')
    await expect(scores.nth(1)).toHaveText('5')
    await expect(scores.nth(2)).toHaveText('0')

    const globalRows = view.locator('[data-audit-global-ranges] tbody tr')
    await expect(globalRows).toHaveCount(4)
    await expect(view.locator('[data-audit-global-ranges]')).toContainText('Dependencia ligera')
  })

  test('MNA audit: skip rule text + cribaje section ranges', async ({ page }) => {
    await page.goto(`${FRONTEND}/instrumentos/${mnaId}`)
    await page.getByTestId('audit-expand').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('audit-expand').evaluate((d: any) => {
      d.open = true
    })
    const view = page.getByTestId('instrument-audit-view')

    const skip = view.locator('[data-audit-skiprule="evaluacion"]')
    await expect(skip).toBeVisible()
    await expect(skip).toContainText('Se omite')
    await expect(skip).toContainText('≥ 12')

    const cribajeRanges = view.locator('[data-audit-section-ranges="cribaje"] tbody tr')
    await expect(cribajeRanges).toHaveCount(3)
    await expect(view.locator('[data-audit-section-ranges="cribaje"]')).toContainText(
      'Estado nutricional normal',
    )
  })

  test('dry-run: fill BARTHEL all-max → total 100 + "Dependencia ligera", ZERO POST/PATCH/PUT/DELETE', async ({ page }) => {
    // Track any write request during the dialog session.
    const writes: string[] = []
    page.on('request', (req) => {
      const m = req.method()
      if ((m === 'POST' || m === 'PATCH' || m === 'PUT' || m === 'DELETE') && /\/api\/v1\//.test(req.url())) {
        writes.push(`${m} ${req.url()}`)
      }
    })

    await page.goto(`${FRONTEND}/instrumentos/${barthelId}`)
    await page.getByTestId('dry-run-button').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('dry-run-button').click()
    await page.getByTestId('dry-run-dialog').waitFor({ state: 'visible' })
    await expect(page.getByTestId('dry-run-banner')).toContainText('no se guarda')

    // Fill all 10 items with the max-score option (PrimeVue RadioButton trap:
    // click the hidden <input type="radio"> directly via page.evaluate).
    const dialog = page.getByTestId('dry-run-dialog')
    await dialog.locator('[data-item-id]').first().waitFor({ state: 'visible', timeout: 15000 })
    for (const section of barthel.sections) {
      for (const item of section.items) {
        const best = [...item.options].sort((a: any, b: any) => b.score - a.score)[0]
        const sel = `[data-testid="dry-run-dialog"] [data-item-id="${item.id}"] input[type="radio"][value="${best.value}"]`
        await page.evaluate((s: string) => {
          const el = document.querySelector(s) as HTMLInputElement | null
          if (!el) throw new Error('radio not found: ' + s)
          el.click()
        }, sel)
      }
    }

    await expect(dialog.getByTestId('classification-tentative')).toHaveText('Dependencia ligera')
    await expect(dialog).toContainText('100')

    // Close dialog, then assert nothing was written.
    await dialog.getByRole('button', { name: 'Cerrar' }).click()
    expect(writes, `unexpected write requests: ${writes.join(', ')}`).toHaveLength(0)

    // Also assert no new ficha row appeared for the patient.
    const after = await page.request.get(`${API}/patients/${patientId}`)
    const afterBody = await after.json()
    const fichasAfter = (afterBody.data?.registrosFichas ?? []).length
    expect(fichasAfter, 'no new ficha row created by dry-run').toBe(fichasBefore)
  })
})
