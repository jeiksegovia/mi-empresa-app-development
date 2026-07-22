/**
 * crear-template-live.spec.ts — fixes-jul17-2 W11 QA validation, Step 4.
 *
 * LIVE crear-from-template e2e against the real backend + frontend with a
 * real seeded admin user. Covers contract §3.1 + §3.2:
 *
 *   1. Crear page → select BARTHEL template → POST with templateCodigo.
 *   2. New instrument: response carries activeVersion{version:1, activo:true}.
 *   3. Source BARTHEL definition is byte-identical before/after (GET
 *      definition checksum compare).
 *   4. New instrument detail page → fillable (no sin-definición badge).
 *   5. Assign+fill from a patient → server returns total=100 +
 *      clasificacion "Dependencia ligera".
 *   6. Legacy sin-definición instrument shows badge + is excluded in the
 *      patient assign/llenar picker.
 *   7. Cleanup of the created test instruments (no DB pollution).
 *
 * ── LIVE (no mocking) ──────────────────────────────────────────────────────
 * W10's crear-template.spec.ts mocked all endpoints for determinism; this is
 * the authoritative live re-run against the real admin user and the live
 * seeded BARTHEL template.
 *
 * Run:
 *   TEST_FRONTEND_URL=http://100.85.193.33:3100 \
 *   TEST_API_URL=http://100.85.193.33:3101/api/v1 \
 *     npx playwright test instruments-dynamic/crear-template-live.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://100.85.193.33:3100'
const API = process.env.TEST_API_URL || 'http://100.85.193.33:3101/api/v1'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'

const connectionString =
  process.env.DATABASE_URL || 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function loginAdmin(page: Page): Promise<void> {
  await page.context().clearCookies({ name: 'session' }).catch(() => {})
  const resp = await page.request.post(`${API}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  })
  expect(resp.status(), 'admin login').toBe(200)
}

function checksum(def: unknown): string {
  return JSON.stringify(def, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(v).sort()) sorted[k] = (v as any)[k]
      return sorted
    }
    return v
  })
}

/** BARTHEL all-max answers → total=100, clasificacion "Dependencia ligera". */
function barthelMaxAnswers(): Record<string, string> {
  return {
    comida: 'independiente',
    lavado: 'independiente',
    vestido: 'independiente',
    arreglo: 'independiente',
    deposicion: 'continente',
    miccion: 'continente',
    retrete: 'independiente',
    transferencia: 'independiente',
    deambulacion: 'independiente',
    desniveles: 'independiente',
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('Live crear-from-template (fixes-jul17-2 §3)', () => {
  let barthelSourceId: number
  let barthelSourceVersionId: number
  let barthelSourceChecksum: string
  let createdCodigo: string

  test.beforeAll(async () => {
    // 1) Capture source BARTHEL state for the checksum compare.
    const source = await prisma.instrumento.findUnique({
      where: { codigo: 'BARTHEL' },
      include: {
        versiones: { where: { activo: true }, take: 1, orderBy: { version: 'desc' } },
      },
    })
    expect(source, 'BARTHEL template seeded').toBeTruthy()
    barthelSourceId = source!.id
    const srcVer = source!.versiones[0]
    expect(srcVer, 'BARTHEL active v1').toBeTruthy()
    barthelSourceVersionId = srcVer!.id
    barthelSourceChecksum = checksum(srcVer!.definition)

    createdCodigo = `QA_TPL_LIVE_${Date.now()}`
  })

  test.beforeEach(async ({ page }) => {
    await loginAdmin(page)
  })

  test.afterAll(async () => {
    try {
      const stale = await prisma.instrumento.findMany({ where: { codigo: createdCodigo } })
      for (const s of stale) {
        await prisma.instrumento.update({ where: { id: s.id }, data: { estado: 'INACTIVO' } })
      }
    } finally {
      await prisma.$disconnect()
    }
  })

  test('Crear page → select BARTHEL template → POST with templateCodigo; new instrument is fillable', async ({ page }) => {
    const patientsResp = await page.request.get(`${API}/patients?limit=1`)
    expect(patientsResp.status()).toBe(200)
    const patientsBody = await patientsResp.json()
    const patientId: number = patientsBody.data[0].id

    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.getByTestId('template-selector').waitFor({ state: 'visible', timeout: 15000 })

    // Pick BARTHEL.
    await page.getByTestId('template-selector').click()
    await page.locator('[data-template-option="BARTHEL"]').click()

    await page.locator('input').first().fill('QA-TPL-LIVE')
    // Codigo is the SECOND input on the form (after nombre).
    await page.locator('input').nth(1).fill(createdCodigo)
    await pickSelectOption(page, 'Tipo', 'Valoración')
    await pickSelectOption(page, 'Periodicidad', 'Semestral')

    const postPromise = page.waitForResponse(
      (r) => r.url().includes('/api/v1/instruments') && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await page.getByRole('button', { name: 'Crear Instrumento' }).click()
    const postResp = await postPromise
    expect(postResp.status(), 'POST /instruments').toBe(201)
    const postBody = await postResp.json()
    expect(postBody.data.activeVersion, 'response carries activeVersion').toBeDefined()
    expect(postBody.data.activeVersion.version).toBe(1)
    expect(postBody.data.activeVersion.activo).toBe(true)
    expect(postBody.data.codigo).toBe(createdCodigo)

    await page.waitForURL(/\/instrumentos\/\d+/, { timeout: 15000 })
    await expect(page.getByTestId('sin-definicion-badge')).toHaveCount(0)
  })

  test('Source BARTHEL v1 definition is byte-identical after crear-from-template (GET before/after compare)', async ({ page }) => {
    const resp = await page.request.get(`${API}/instruments/BARTHEL/definition`)
    expect(resp.status()).toBe(200)
    const body = await resp.json()
    const def = body.data.version.definition
    const afterChecksum = checksum(def)
    expect(afterChecksum, 'BARTHEL v1 definition untouched').toBe(barthelSourceChecksum)
  })

  test('New instrument is fillable end-to-end: assign + fill BARTHEL → total=100 + "Dependencia ligera"', async ({ page }) => {
    const patientsResp = await page.request.get(`${API}/patients?limit=1`)
    const patientId: number = (await patientsResp.json()).data[0].id

    const created = await prisma.instrumento.findFirst({
      where: { codigo: createdCodigo },
      include: {
        versiones: { where: { activo: true }, take: 1, orderBy: { version: 'desc' } },
      },
    })
    expect(created, 'just-created instrument exists').toBeTruthy()
    expect(created!.versiones.length).toBe(1)
    const v = created!.versiones[0]
    expect(v.definition.sections[0].items.length).toBe(10)
    expect(v.definition.codigo).toBe(createdCodigo)
    expect(v.definition.nombre).toBe('QA-TPL-LIVE')
    expect(v.definition.version).toBe(1)

    const fichaResp = await page.request.post(`${API}/patients/${patientId}/fichas`, {
      data: {
        instrumentoId: created!.id,
        respuestas: barthelMaxAnswers(),
      },
    })
    expect(fichaResp.status(), 'POST ficha').toBe(201)
    const fichaBody = await fichaResp.json()
    expect(fichaBody.data.estado).toBe('COMPLETADO')
    expect(fichaBody.data.puntajeTotal).toBe(100)
    expect(fichaBody.data.clasificacion).toBe('Dependencia ligera')

    // Best-effort cleanup; if DELETE is not allowed (some routes only PATCH
    // estado), we don't fail the test — the fixture is acceptable noise.
    if (fichaBody.data?.id) {
      await page.request
        .delete(`${API}/patients/${patientId}/fichas/${fichaBody.data.id}`)
        .catch(() => {})
    }
  })

  test('Legacy sin-definición instrument shows badge in list + is disabled in the patient assign picker', async ({ page }) => {
    const patientsResp = await page.request.get(`${API}/patients?limit=1`)
    const patientId: number = (await patientsResp.json()).data[0].id

    const legacyCodigo = `QA_LEGACY_LIVE_${Date.now()}`
    const createResp = await page.request.post(`${API}/instruments`, {
      data: {
        nombreInstrumento: 'QA-LEGACY-LIVE',
        codigo: legacyCodigo,
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO',
      },
    })
    expect(createResp.status()).toBe(201)
    const createBody = await createResp.json()
    expect(createBody.data.activeVersion).toBeUndefined()

    let newInstrumentId: number | null = null
    try {
      newInstrumentId = createBody.data.id

      await page.goto(`${FRONTEND}/instrumentos`)
      await expect(page.getByTestId('sin-definicion-badge').first()).toBeVisible({ timeout: 15000 })
      const badgeCount = await page.getByTestId('sin-definicion-badge').count()
      expect(badgeCount, 'at least one sin-definición badge in list').toBeGreaterThanOrEqual(1)

      await page.goto(`${FRONTEND}/pacientes/${patientId}`)
      await page.getByRole('button', { name: /Fichas & Evaluaciones/ }).click()
      await page.getByTestId('ficha-instrumento-select').click()
      const legacyOpt = page.locator(`li:has-text("QA-LEGACY-LIVE")`).first()
      await legacyOpt.waitFor({ state: 'visible', timeout: 10000 })
      // Picker options may be PrimeVue <li> with role=option; the legacy
      // option must be aria-disabled.
      await expect(legacyOpt).toHaveAttribute('aria-disabled', 'true')
    } finally {
      if (newInstrumentId) {
        await prisma.instrumento
          .update({ where: { id: newInstrumentId }, data: { estado: 'INACTIVO' } })
          .catch(() => {})
      }
    }
  })
})

/** Pick an option in a PrimeVue Select identified by its field label. */
async function pickSelectOption(page: Page, labelText: string, optionText: string) {
  const field = page
    .locator('div', { has: page.locator(`label:text-is("${labelText}")`) })
    .filter({ has: page.locator('.p-select') })
    .last()
  await field.locator('.p-select').click()
  await page.locator('.p-select-option', { hasText: optionText }).first().click()
}
