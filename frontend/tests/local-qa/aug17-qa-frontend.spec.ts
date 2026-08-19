/**
 * LOCAL QA — qa-session-aug-17 frontend wave (MOCKED).
 *
 * Covers R1, R3 UI, R6 UI against contract-schema-qa-aug-17.md:
 *   R1 — Empleados tabs Activos/Inactivos; default ACTIVO; no Todos.
 *   R3 — Nómina bonos visible only for FIJO/INDEF; total = mensual+bonos;
 *        aportes helper does not add; OPS/OBRA hide bonos.
 *   R6 — Sidebar "Registro de actividades" (pi-list) after Asistencia;
 *        form for PROFESORES/AUXILIARES; no form for GERONTOLOGA/CONTRATOS
 *        (isReadOnly hides writes).
 *
 * All endpoints are mocked so the run is deterministic.
 *
 * Run:
 *   cd frontend && npx playwright test tests/local-qa/aug17-qa-frontend.spec.ts
 */

import { test, expect, type Page, type Route } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ADMIN = {
  id: 1,
  email: 'admin@miempresa.com',
  nombre: 'Admin',
  apellido: 'QA',
  rol: 'ADMIN',
  tipoEmpleado: null,
  activo: true,
  empleadoId: null,
}

const GERONTOLOGA = {
  id: 2,
  email: 'gerontologa@miempresa.com',
  nombre: 'Gero',
  apellido: 'QA',
  rol: 'EMPLEADO',
  tipoEmpleado: 'GERONTOLOGA',
  activo: true,
  empleadoId: 10,
}

const CONTRATOS = {
  id: 7,
  email: 'contratos@miempresa.com',
  nombre: 'Contratos',
  apellido: 'QA',
  rol: 'EMPLEADO',
  tipoEmpleado: 'CONTRATOS',
  activo: true,
  empleadoId: 11,
}

const PROFESOR = {
  id: 20,
  email: 'profesor@miempresa.com',
  nombre: 'Profe',
  apellido: 'QA',
  rol: 'EMPLEADO',
  tipoEmpleado: 'PROFESORES',
  activo: true,
  empleadoId: 200,
}

const AUXILIAR = {
  id: 21,
  email: 'auxiliar@miempresa.com',
  nombre: 'Aux',
  apellido: 'QA',
  rol: 'EMPLEADO',
  tipoEmpleado: 'AUXILIARES',
  activo: true,
  empleadoId: 201,
}

type AuthUser = typeof ADMIN

async function mockAuth(page: Page, user: AuthUser = ADMIN) {
  await page.route('**/api/v1/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    }),
  )
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
}

function employeeListPayload(estado: string | null) {
  const all = [
    {
      id: 1,
      nombre: 'Ana',
      apellido: 'Activa',
      tipoDocumento: 'CC',
      numeroDocumento: '1001',
      genero: 'Femenino',
      telefono: null,
      email: 'ana@test.com',
      estado: 'ACTIVO',
      fechaRegistro: '2026-01-01T00:00:00.000Z',
      cargo: 'Docente',
      ubicacion: null,
      bloqueado: false,
    },
    {
      id: 2,
      nombre: 'Ines',
      apellido: 'Inactiva',
      tipoDocumento: 'CC',
      numeroDocumento: '1002',
      genero: 'Femenino',
      telefono: null,
      email: 'ines@test.com',
      estado: 'INACTIVO',
      fechaRegistro: '2025-01-01T00:00:00.000Z',
      cargo: null,
      ubicacion: null,
      bloqueado: false,
    },
  ]
  const data = estado ? all.filter((e) => e.estado === estado) : all
  return {
    success: true,
    data,
    total: data.length,
    page: 1,
    limit: 20,
    totalPages: 1,
  }
}

async function mockEmployeesList(page: Page, captured: { urls: string[] }) {
  await page.route('**/api/v1/employees**', async (route: Route) => {
    const url = route.request().url()
    captured.urls.push(url)
    const u = new URL(url)
    const estado = u.searchParams.get('estado')
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(employeeListPayload(estado)),
    })
  })
}

function nominaRow(tipoContrato: string, overrides: Record<string, unknown> = {}) {
  const isOps = tipoContrato === 'OPS'
  const isFijo =
    tipoContrato === 'TERMINO_FIJO' || tipoContrato === 'TERMINO_INDEFINIDO'
  return {
    empleado: {
      id: 50,
      nombre: 'Nomina',
      apellido: tipoContrato,
      numeroDocumento: '5050',
      medioPagoTipo: null,
      medioPagoNequi: null,
      bancoNombre: null,
      bancoTipoCuenta: null,
      bancoNumeroCuenta: null,
    },
    contratoActivo: {
      id: 9,
      tipoContrato,
      fechaInicio: '2026-01-01',
      fechaFin: null,
      archivoUrl: null,
      activo: true,
      valorJornada: isOps ? 50000 : null,
      valorMensual: isOps ? null : 2_000_000,
    },
    entrada: null,
    cargoSalario: null,
    asistenciaMes: { mediasJornadas: 10, horas: 40 },
    sugerido: {
      mediasJornadas: isOps ? 10 : null,
      valorJornada: isOps ? 50000 : null,
      valorMensual: isOps ? null : 2_000_000,
      bonos: isFijo ? 0 : null,
      subtotalCalculado: isOps ? 500_000 : isFijo ? 2_000_000 : null,
      aportesSociales: isFijo ? 100_000 : 0,
      totalPagado: isOps ? 500_000 : isFijo ? 2_000_000 : 2_000_000,
    },
    ...overrides,
  }
}

async function mockNomina(page: Page, row: ReturnType<typeof nominaRow>) {
  await page.route('**/api/v1/nomina**', async (route: Route) => {
    const url = route.request().url()
    const method = route.request().method()
    if (method === 'GET' && !url.includes('/periodos') && !url.includes('/employees')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: [row] }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: row.entrada ?? { id: 1 } }),
    })
  })
}

// ─── R1 — Empleados tabs ─────────────────────────────────────────────────────

test.describe('qa-session-aug-17 — R1 Empleados Activos/Inactivos tabs (MOCKED)', () => {
  test('default tab is Activos and first fetch uses estado=ACTIVO', async ({ page }) => {
    const captured = { urls: [] as string[] }
    await mockAuth(page, ADMIN)
    await mockEmployeesList(page, captured)

    await page.goto(`${FRONTEND}/empleados`)
    await expect(page.getByTestId('empleados-tab-activos')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('empleados-tab-inactivos')).toBeVisible()

    // Activos is the active (styled) tab on first paint.
    await expect(page.getByTestId('empleados-tab-activos')).toHaveClass(/border-violet/)

    // Wait until at least one list fetch landed.
    await expect.poll(() => captured.urls.some((u) => u.includes('estado=ACTIVO'))).toBeTruthy()

    // No "Todos" control anywhere on the page.
    await expect(page.getByText('Todos', { exact: true })).toHaveCount(0)
  })

  test('switching to Inactivos fetches estado=INACTIVO', async ({ page }) => {
    const captured = { urls: [] as string[] }
    await mockAuth(page, ADMIN)
    await mockEmployeesList(page, captured)

    await page.goto(`${FRONTEND}/empleados`)
    await expect(page.getByTestId('empleados-tab-inactivos')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('empleados-tab-inactivos').click()

    await expect.poll(() => captured.urls.some((u) => u.includes('estado=INACTIVO'))).toBeTruthy()
    await expect(page.getByTestId('empleados-tab-inactivos')).toHaveClass(/border-violet/)
  })
})

// ─── R3 — Nómina bonos + total ───────────────────────────────────────────────

test.describe('qa-session-aug-17 — R3 Nómina bonos UI (MOCKED)', () => {
  test('TERMINO_FIJO: bonos visible; total = mensual + bonos (aportes not added)', async ({
    page,
  }) => {
    await mockAuth(page, ADMIN)
    await mockNomina(page, nominaRow('TERMINO_FIJO'))

    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 20000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

    await expect(page.getByTestId('nomina-bonos')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('nomina-aportes')).toBeVisible()
    await expect(page.getByTestId('nomina-subtotal')).toBeVisible()
    await expect(page.getByTestId('nomina-total')).toBeVisible()

    // Helper copy: aportes do not add.
    await expect(page.getByText(/no se suma/i).first()).toBeVisible()

    // Set bonos = 150000 on top of 2_000_000 mensual → total 2_150_000.
    const bonos = page.getByTestId('nomina-bonos').locator('input')
    await bonos.fill('')
    await bonos.fill('150000')
    await bonos.blur()

    // Aportes change must NOT change total.
    const aportes = page.getByTestId('nomina-aportes').locator('input')
    await aportes.fill('')
    await aportes.fill('999999')
    await aportes.blur()

    await expect(page.getByTestId('nomina-subtotal').locator('input')).toHaveValue('2,150,000')
    await expect(page.getByTestId('nomina-total').locator('input')).toHaveValue('2,150,000')
  })

  test('OPS: bonos control is hidden', async ({ page }) => {
    await mockAuth(page, ADMIN)
    await mockNomina(page, nominaRow('OPS'))

    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 20000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

    await expect(page.getByTestId('nomina-medias')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('nomina-bonos')).toHaveCount(0)
  })

  test('OBRA_O_LABOR: bonos control is hidden', async ({ page }) => {
    await mockAuth(page, ADMIN)
    await mockNomina(page, nominaRow('OBRA_O_LABOR'))

    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 20000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

    await expect(page.getByTestId('nomina-valor-mensual')).toBeVisible({ timeout: 10000 })
    await expect(page.getByTestId('nomina-bonos')).toHaveCount(0)
  })

  test('TERMINO_FIJO POST body includes bonos', async ({ page }) => {
    await mockAuth(page, ADMIN)
    await mockNomina(page, nominaRow('TERMINO_FIJO'))

    let postedBody: any = null
    await page.route('**/api/v1/nomina/periodos', async (route) => {
      if (route.request().method() === 'POST') {
        postedBody = route.request().postDataJSON()
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, data: { id: 99, ...postedBody } }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: {} }),
      })
    })

    await page.goto(`${FRONTEND}/nomina`)
    await expect(page.getByTestId('nomina-open-dialog').first()).toBeVisible({ timeout: 20000 })
    await page.getByTestId('nomina-open-dialog').first().click()
    await expect(page.getByTestId('nomina-dialog')).toBeVisible({ timeout: 5000 })

    await expect(page.getByTestId('nomina-bonos')).toBeVisible({ timeout: 10000 })
    const bonos = page.getByTestId('nomina-bonos').locator('input')
    await bonos.fill('')
    await bonos.fill('25000')
    await bonos.blur()
    await page.getByTestId('nomina-guardar').click()
    await page.waitForTimeout(400)

    expect(postedBody).not.toBeNull()
    expect(postedBody.bonos).toBe(25000)
    expect(postedBody.totalPagado).toBe(2_025_000)
  })
})

// ─── R6 — Actividades nav + ACL UI ───────────────────────────────────────────

test.describe('qa-session-aug-17 — R6 Actividades page + nav (MOCKED)', () => {
  test('ADMIN: sidebar item after Asistencia uses pi-list; form + manage visible', async ({
    page,
  }) => {
    await mockAuth(page, ADMIN)
    await page.goto(`${FRONTEND}/`)
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })

    const links = page.locator('aside nav a')
    const labels = await links.allInnerTexts()
    const asistenciaIdx = labels.findIndex((t) => /Asistencia/i.test(t))
    const actividadesIdx = labels.findIndex((t) => /Registro de actividades/i.test(t))
    expect(asistenciaIdx).toBeGreaterThanOrEqual(0)
    expect(actividadesIdx).toBe(asistenciaIdx + 1)

    // Icon class on the actividades link.
    const actLink = links.nth(actividadesIdx)
    await expect(actLink.locator('i')).toHaveClass(/pi-list/)

    await page.goto(`${FRONTEND}/actividades`)
    await expect(page.getByTestId('actividades-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('actividades-fecha')).toBeVisible()
    await expect(page.getByTestId('actividades-texto')).toBeVisible()
    await expect(page.getByTestId('actividades-guardar')).toBeVisible()
  })

  test('PROFESORES: form visible (create-only)', async ({ page }) => {
    await mockAuth(page, PROFESOR)
    await page.goto(`${FRONTEND}/actividades`)
    await expect(page.getByTestId('actividades-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('actividades-form-card')).toBeVisible()
    await expect(page.getByTestId('actividades-guardar')).toBeVisible()
    // create-only → no edit/delete column affordances on empty list is fine;
    // manage buttons should not appear without rows, and canManage is false.
    await expect(page.getByTestId('actividades-editar')).toHaveCount(0)
  })

  test('AUXILIARES: form visible (create-only)', async ({ page }) => {
    await mockAuth(page, AUXILIAR)
    await page.goto(`${FRONTEND}/actividades`)
    await expect(page.getByTestId('actividades-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('actividades-form-card')).toBeVisible()
    await expect(page.getByTestId('actividades-guardar')).toBeVisible()
  })

  test('GERONTOLOGA: isReadOnly hides write form; nav still visible', async ({ page }) => {
    await mockAuth(page, GERONTOLOGA)
    await page.goto(`${FRONTEND}/`)
    await expect(page.locator('aside')).toBeVisible({ timeout: 15000 })
    await expect(page.locator('aside nav a', { hasText: 'Registro de actividades' })).toBeVisible()

    await page.goto(`${FRONTEND}/actividades`)
    await expect(page.getByTestId('actividades-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('actividades-form-card')).toHaveCount(0)
    await expect(page.getByTestId('actividades-guardar')).toHaveCount(0)
    await expect(page.getByTestId('actividades-table')).toBeVisible()
  })

  test('CONTRATOS: isReadOnly hides write form', async ({ page }) => {
    await mockAuth(page, CONTRATOS)
    await page.goto(`${FRONTEND}/actividades`)
    await expect(page.getByTestId('actividades-page')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('actividades-form-card')).toHaveCount(0)
    await expect(page.getByTestId('actividades-guardar')).toHaveCount(0)
  })
})
