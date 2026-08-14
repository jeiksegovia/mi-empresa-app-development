/**
 * crear-template.spec.ts — §3.2 crear-from-template selector + sin-definición
 * states. Task #35 (W10).
 *
 * ── MOCKED ─────────────────────────────────────────────────────────────────
 * Session + all API endpoints are MOCKED via route interception (admin
 * session; instruments list / definition / create POST). W9's backend is live,
 * but mocking keeps this deterministic and independent of DB seed state. W11
 * re-runs the create+fillable path against the real backend — see
 * completion-report.md "mocked-vs-live".
 *
 * Run:
 *   TEST_FRONTEND_URL=http://localhost:3100 \
 *     npx playwright test instruments-dynamic/crear-template.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const barthel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../fixtures/instrument-templates/BARTHEL.v1.json', import.meta.url)), 'utf-8'),
)

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ADMIN = { id: 1, email: 'admin@x.com', nombre: 'Admin', apellido: 'User', rol: 'ADMIN', tipoEmpleado: null, activo: true }

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) }
}

/** Base stubs shared by all tests (catch-all first so specifics win). */
async function baseStubs(page: Page) {
  await page.route('**/api/v1/**', (r) => r.fulfill(json({ success: true, data: [] })))
  await page.route('**/api/v1/auth/me', (r) => r.fulfill(json({ success: true, user: ADMIN })))
  await page.route('**/api/v1/empresa', (r) => r.fulfill(json({ success: true, data: null })))
  // cargo roles for the MultiSelect
  await page.route('**/api/v1/**/cargos**', (r) => r.fulfill(json({ success: true, data: [] })))
}

test.describe('§3.2 crear-from-template + sin-definición — MOCKED', () => {
  test('selector renders the 8 templates + "Sin plantilla" (9 options)', async ({ page }) => {
    await baseStubs(page)
    // Each template definition → summary. Return the BARTHEL fixture for all
    // (summary text is not asserted; option count is).
    await page.route('**/api/v1/instruments/*/definition', (r) =>
      r.fulfill(json({ success: true, data: { version: { definition: barthel } } })),
    )
    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.getByTestId('template-selector').waitFor({ state: 'visible', timeout: 10000 })
    await page.getByTestId('template-selector').click()
    // Options render in the PrimeVue overlay with [data-template-option].
    // fixes-features-aug-6 §5 added SIGNOS_VITALES + BOLETIN_ANUAL →
    // 8 templates total + "Sin plantilla" = 9 options.
    const options = page.locator('[data-template-option]')
    await expect(options).toHaveCount(9)
    await expect(page.locator('[data-template-option="__none__"]')).toContainText('Sin plantilla')
    await expect(page.locator('[data-template-option="BARTHEL"]')).toContainText('BARTHEL')
    await expect(page.locator('[data-template-option="SIGNOS_VITALES"]')).toHaveCount(1)
    await expect(page.locator('[data-template-option="BOLETIN_ANUAL"]')).toHaveCount(1)
  })

  test('creating with BARTHEL template sends templateCodigo and yields a fillable instrument', async ({ page }) => {
    await baseStubs(page)
    await page.route('**/api/v1/instruments/*/definition', (r) =>
      r.fulfill(json({ success: true, data: { version: { definition: barthel } } })),
    )

    let postBody: any = null
    await page.route('**/api/v1/instruments', (r) => {
      if (r.request().method() === 'POST') {
        postBody = r.request().postDataJSON()
        return r.fulfill(json({
          success: true,
          data: { id: 900, codigo: 'NUEVO_BARTHEL', activeVersion: { id: 1, version: 1, activo: true } },
        }))
      }
      return r.fulfill(json({ success: true, data: [], total: 0 }))
    })
    // Created instrument detail + its (copied) definition → fillable, no badge.
    await page.route('**/api/v1/instruments/900', (r) =>
      r.fulfill(json({
        success: true,
        data: {
          id: 900, nombreInstrumento: 'NUEVO BARTHEL', codigo: 'NUEVO_BARTHEL', descripcion: null,
          tipo: 'VALORACION', periodicidad: 'SEMESTRAL', rolesPermitidos: 'ADMIN', estado: 'ACTIVO',
          fechaCreacion: '2026-07-17T00:00:00.000Z', creadoPor: 1, registros: [],
        },
      })),
    )
    await page.route('**/api/v1/instruments/NUEVO_BARTHEL/definition', (r) =>
      r.fulfill(json({ success: true, data: { version: { definition: barthel } } })),
    )

    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.getByTestId('template-selector').waitFor({ state: 'visible', timeout: 10000 })

    // Fill required metadata.
    await page.locator('input').first().fill('Nuevo Barthel')
    // Tipo select
    await selectOption(page, 'Tipo', 'Valoración')
    // Periodicidad select
    await selectOption(page, 'Periodicidad', 'Semestral')
    // Template = BARTHEL
    await page.getByTestId('template-selector').click()
    await page.locator('[data-template-option="BARTHEL"]').click()
    // fixes-features-aug-6 T15: when a template is selected, codigo is
    // REQUIRED (otherwise the detail page's loadDefinition short-circuits
    // on `if (!codigo)` and renders "Sin definición — no llenable").
    await page.getByTestId('instrument-codigo-input').fill('NUEVO_BARTHEL')

    await page.getByRole('button', { name: 'Crear Instrumento' }).click()

    // Wait for navigation to the new instrument.
    await page.waitForURL(`${FRONTEND}/instrumentos/900`, { timeout: 10000 })
    expect(postBody?.templateCodigo).toBe('BARTHEL')
    // Fillable ⇒ no "sin definición" badge.
    await expect(page.getByTestId('sin-definicion-badge')).toHaveCount(0)
  })

  test('sin-definición instrument shows badge in list and is disabled in the assign picker', async ({ page }) => {
    await baseStubs(page)
    const list = [
      { id: 1, nombreInstrumento: 'Barthel Real', codigo: 'BARTHEL', descripcion: null, tipo: 'VALORACION', periodicidad: 'SEMESTRAL', rolesPermitidos: 'ADMIN', estado: 'ACTIVO', versionPlantilla: 'v1', fechaCreacion: '2026-01-01', totalRegistros: 0, activeVersion: { id: 7, version: 1, activo: true } },
      { id: 2, nombreInstrumento: 'Legacy Sin Def', codigo: 'LEGACY', descripcion: null, tipo: 'VALORACION', periodicidad: 'UNICA', rolesPermitidos: 'ADMIN', estado: 'ACTIVO', versionPlantilla: 'v0', fechaCreacion: '2026-01-01', totalRegistros: 0, activeVersion: null },
    ]
    await page.route('**/api/v1/instruments?**', (r) =>
      r.fulfill(json({ success: true, data: list, total: 2, page: 1, limit: 20, totalPages: 1 })),
    )

    // ── List: exactly one sin-definición badge ──
    await page.goto(`${FRONTEND}/instrumentos`)
    await expect(page.getByTestId('sin-definicion-badge')).toHaveCount(1)

    // ── Picker: legacy option disabled + annotated ──
    await page.route('**/api/v1/patients/1', (r) =>
      r.fulfill(json({
        success: true,
        data: {
          id: 1, nombre: 'Paciente Prueba', tipoDocumento: 'CC', numeroDocumento: '1', fechaNacimiento: '1950-01-01',
          genero: 'F', telefono: null, email: null, direccion: null, estado: 'ACTIVO', fechaIngreso: '2026-01-01',
          informacionSeguro: null, fechaCumpleanos: null, tipoSangre: null, eps: null, observacionesEspeciales: null,
          contactosEmergencia: [], registrosFichas: [], notasCliente: [],
        },
      })),
    )
    await page.goto(`${FRONTEND}/pacientes/1`)
    await page.getByRole('button', { name: /Fichas & Evaluaciones/ }).click()
    await page.getByTestId('ficha-instrumento-select').click()
    // The legacy (sin definición) option shows the warn tag and is disabled.
    await expect(page.getByTestId('picker-sin-definicion')).toHaveCount(1)
    const legacyOpt = page.locator('li[aria-label="Legacy Sin Def"], li:has-text("Legacy Sin Def")').first()
    await expect(legacyOpt).toHaveAttribute('aria-disabled', 'true')
  })

  /**
   * fixes-features-aug-6 convergence (T15): when a template is selected and
   * `codigo` is blank, the FE must block submission. Without codigo, the
   * instrument is created with `codigo=null` and the detail page's
   * `loadDefinition()` short-circuits at `if (!codigo)`, surfacing
   * "Sin definición — no llenable" even though the BE deep-copied a real
   * definition into v1. Close that hole on the FE.
   */
  test('create from template WITHOUT codigo is blocked by FE validation (no POST)', async ({ page }) => {
    await baseStubs(page)
    await page.route('**/api/v1/instruments/*/definition', (r) =>
      r.fulfill(json({ success: true, data: { version: { definition: barthel } } })),
    )

    let postCount = 0
    await page.route('**/api/v1/instruments', (r) => {
      if (r.request().method() === 'POST') {
        postCount++
        return r.fulfill(json({
          success: true,
          data: { id: 901, codigo: 'SHOULD_NOT_HAPPEN', activeVersion: { id: 1, version: 1, activo: true } },
        }))
      }
      return r.fulfill(json({ success: true, data: [], total: 0 }))
    })

    await page.goto(`${FRONTEND}/instrumentos/crear`)
    await page.getByTestId('template-selector').waitFor({ state: 'visible', timeout: 10000 })

    // Fill everything EXCEPT codigo, then choose a template.
    await page.locator('input').first().fill('Barthel Sin Codigo')
    await selectOption(page, 'Tipo', 'Valoración')
    await selectOption(page, 'Periodicidad', 'Semestral')

    await page.getByTestId('template-selector').click()
    await page.locator('[data-template-option="BARTHEL"]').click()

    // codigo field is intentionally left blank.
    await expect(page.getByTestId('instrument-codigo-input')).toHaveValue('')

    // Submit — FE validation must block the POST and surface the error.
    await page.getByRole('button', { name: 'Crear Instrumento' }).click()

    // No POST was sent.
    await page.waitForTimeout(500)
    expect(postCount).toBe(0)

    // The codigo error message is visible.
    await expect(
      page.getByText('El código es requerido al usar una plantilla'),
    ).toBeVisible()

    // We are still on /instrumentos/crear (no navigation to detail).
    expect(new URL(page.url()).pathname).toBe('/instrumentos/crear')
  })
})

/** Pick an option in a PrimeVue Select identified by its field label. */
async function selectOption(page: Page, labelText: string, optionText: string) {
  const field = page.locator('div', { has: page.locator(`label:text-is("${labelText}")`) }).filter({ has: page.locator('.p-select') }).last()
  await field.locator('.p-select').click()
  await page.locator('.p-select-option', { hasText: optionText }).first().click()
}
