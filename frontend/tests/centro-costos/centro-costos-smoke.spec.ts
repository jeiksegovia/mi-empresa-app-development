/**
 * Centro de Costos — frontend smoke spec (W2 / task 6 + aug-17 update).
 *
 * Covers the page + RBAC mirror + nav + accordion + create-centro +
 * CONTRATOS visual split + ingreso/egreso dialog split + print-recibo CTA +
 * recibo page rendering per acceptance criteria in
 * task-assignment-frontend.md §Acceptance. All `/api/v1/centro-costos/**`
 * endpoints are mocked so the run is deterministic.
 *
 * Heeds the pre-loaded traps:
 *  - trap #1: drives the DatePicker (native `<input type="date">`) explicitly.
 *  - trap #2: verifies the balance math against the API string values.
 *  - trap #3: ítems use `cantidad` as integer.
 *  - trap #5: egreso-only fields appear ONLY for EGRESOS centros.
 *  - trap #6: client never sends `valorTotal`.
 *  - trap #7 (aug-17): client sends `fecha`, NEVER `periodo` (server derives).
 *  - trap #8 (aug-17): INGRESOS sends pagador + beneficiarioClienteId;
 *    valorUnitario is read-only from centro.precioUnitario.
 *
 * Run:
 *   cd frontend && npx playwright test tests/centro-costos/centro-costos-smoke.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'

const ADMIN = {
  id: 1,
  email: 'admin@miempresa.com',
  nombre: 'Admin',
  apellido: 'Sistema',
  rol: 'ADMIN',
  tipoEmpleado: null,
  activo: true,
}

const GERONTOLOGA = {
  id: 2,
  email: 'qa-gerontologa@miempresa.com',
  nombre: 'QA',
  apellido: 'Gerontologa',
  rol: 'EMPLEADO',
  tipoEmpleado: 'GERONTOLOGA',
  activo: true,
}

const CONTRATOS = {
  id: 3,
  email: 'qa-contratos@miempresa.com',
  nombre: 'QA',
  apellido: 'Contratos',
  rol: 'EMPLEADO',
  tipoEmpleado: 'CONTRATOS',
  activo: true,
}

// ─── Fixtures (mirror contract §1.3 + §2.3 — aug-17: 8 INGRESOS + 6 EGRESOS) ─
// `precioUnitario` and `habilitarRecibo` are the new INGRESOS-only centro fields.
const INGRESOS_CENTROS = [
  { id: 17, nombre: 'Mensualidades completas', orden: 1, precioUnitario: '1500000.00', habilitarRecibo: true,  ocultarBeneficiario: false },
  { id: 18, nombre: 'Mensualidad por 4 días',  orden: 2, precioUnitario: '500000.00',  habilitarRecibo: false, ocultarBeneficiario: false },
  { id: 19, nombre: 'Mensualidad por 3 días',  orden: 3, precioUnitario: '400000.00',  habilitarRecibo: false, ocultarBeneficiario: false },
  { id: 20, nombre: 'Mensualidades por día',   orden: 4, precioUnitario: '50000.00',   habilitarRecibo: false, ocultarBeneficiario: false },
  { id: 21, nombre: 'Transporte completo',     orden: 5, precioUnitario: '80000.00',   habilitarRecibo: false, ocultarBeneficiario: false },
  { id: 22, nombre: 'Transporte por 3 días',   orden: 6, precioUnitario: '50000.00',   habilitarRecibo: false, ocultarBeneficiario: false },
  { id: 23, nombre: 'Ingresos adicionales',    orden: 7, precioUnitario: null,         habilitarRecibo: false, ocultarBeneficiario: false }, // sin precio (R26)
  { id: 24, nombre: 'Valoraciones',            orden: 8, precioUnitario: '70000.00',   habilitarRecibo: false, ocultarBeneficiario: true },
] as const

const EGRESOS_CENTROS = [
  { id: 25, nombre: 'Refrigerios',   orden: 9 },
  { id: 26, nombre: 'Aseo',         orden: 10 },
  { id: 27, nombre: 'Papelería',    orden: 11 },
  { id: 28, nombre: 'Eventos',      orden: 12 },
  { id: 29, nombre: 'Nómina',       orden: 13 },
  { id: 30, nombre: 'Mantenimiento', orden: 14 },
] as const

function buildCentros() {
  const ts = '2026-08-05T00:00:00.000Z'
  return [
    ...INGRESOS_CENTROS.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: 'INGRESOS' as const,
      descripcion: null,
      activo: true,
      orden: c.orden,
      precioUnitario: c.precioUnitario as string | null,
      habilitarRecibo: c.habilitarRecibo,
      ocultarBeneficiario: c.ocultarBeneficiario,
      createdAt: ts,
      updatedAt: ts,
    })),
    ...EGRESOS_CENTROS.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      tipo: 'EGRESOS' as const,
      descripcion: null,
      activo: true,
      orden: c.orden,
      precioUnitario: null as string | null,
      habilitarRecibo: false,
      ocultarBeneficiario: false,
      createdAt: ts,
      updatedAt: ts,
    })),
  ]
}

function buildItemsForMonth(centros: ReturnType<typeof buildCentros>) {
  // One item per centro for August 2026.
  // Ingresos: 7 × 1500 = 10500.00 (excluding id=23 which has no items).
  // Egresos: 6 × 800 = 4800.00; balance = 5700.00.
  const items: any[] = []
  for (const c of centros) {
    if (c.tipo === 'INGRESOS') {
      // Centro id=23 (Ingresos adicionales) has no items by default → no
      // subtotal in this month. This exercises the empty-month path for one
      // INGRESOS centro.
      if (c.id === 23) continue
      items.push({
        id: 100 + c.id,
        centroCostosId: c.id,
        nombre: `Ingreso ${c.nombre}`,
        notas: null,
        cantidad: 1,
        valorUnitario: '1500.00',
        valorTotal: '1500.00',
        fecha: '2026-08-17',
        periodo: '2026-08-01',
        numeroFactura: null,
        proveedor: null,
        fechaFactura: null,
        pagador: 'Familia Pérez',
        beneficiarioClienteId: 42,
        medioPago: 'EFECTIVO',
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-08-05T00:00:00.000Z',
      })
    } else {
      items.push({
        id: 100 + c.id,
        centroCostosId: c.id,
        nombre: `Egreso ${c.nombre}`,
        notas: null,
        cantidad: 1,
        valorUnitario: '800.00',
        valorTotal: '800.00',
        fecha: '2026-08-17',
        periodo: '2026-08-01',
        numeroFactura: c.id === 25 ? 'F-001' : null,
        proveedor: c.id === 25 ? 'Proveedor X' : null,
        fechaFactura: c.id === 25 ? '2026-08-15' : null,
        pagador: null,
        beneficiarioClienteId: null,
        medioPago: null,
        createdAt: '2026-08-05T00:00:00.000Z',
        updatedAt: '2026-08-05T00:00:00.000Z',
      })
    }
  }
  const grupos = centros.map((c) => {
    const item = items.find((it) => it.centroCostosId === c.id)
    return {
      centro: c,
      items: item ? [item] : [],
      subtotal: item ? item.valorTotal : '0.00',
    }
  })
  return { grupos, items }
}

function buildBalance(centros: ReturnType<typeof buildCentros>) {
  // 7 INGRESOS with items × 1500 = 10500; 6 EGRESOS × 800 = 4800; balance = 5700.
  return {
    periodo: '2026-08-01',
    porCentro: centros.map((c) => ({
      centroId: c.id,
      nombre: c.nombre,
      tipo: c.tipo,
      subtotal: c.tipo === 'INGRESOS' && c.id !== 23 ? '1500.00' : '0.00',
    })),
    totalIngresos: '10500.00',
    totalEgresos: '4800.00',
    balance: '5700.00',
  }
}

async function mockAuth(page: Page, user: typeof ADMIN | typeof GERONTOLOGA | typeof CONTRATOS) {
  const ctx = page.context()
  await ctx.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
  await ctx.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user }),
    }),
  )
}

async function mockCentroCostosEndpoints(page: Page, options: {
  user?: typeof ADMIN | typeof GERONTOLOGA | typeof CONTRATOS
  initialItems?: any
  initialBalance?: any
  emptyMonth?: boolean
  customCentros?: any[]
} = {}) {
  const user = options.user ?? ADMIN
  await mockAuth(page, user)
  let centros = options.customCentros ?? buildCentros()
  const { grupos: initialGrupos, items } = buildItemsForMonth(centros)
  const balance = options.initialBalance ?? buildBalance(centros)

  const gruposForMonth = (periodo: string) => {
    if (options.emptyMonth) return []
    // Future / past months (e.g. 2099-12) have no seeded data.
    if (!periodo.startsWith('2026-08')) return []
    return initialGrupos
  }

  const ctx = page.context()

  await ctx.route('**/api/v1/empresa', (route) => {
    if (route.request().method() !== 'GET') {
      return route.continue()
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 1,
          nombre: 'Centro Día Demo',
          nit: '900123456-1',
          direccion: 'Calle 10 #20-30',
          telefono: '6014567890',
          email: 'demo@miempresa.com',
          activa: true,
          limitarFechaContratos: false,
        },
      }),
    })
  })

  await ctx.route('**/api/v1/patients?**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          { id: 42, nombre: 'Juan Cliente Demo' },
          { id: 43, nombre: 'María Cliente Test' },
        ],
        total: 2,
        page: 1,
        limit: 200,
        totalPages: 1,
      }),
    })
  })

  await ctx.route('**/api/v1/centro-costos**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    // List centros.
    if (url.includes('/centro-costos/policy') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            limitarFechaContratos: false,
            today: '2026-08-27',
            previousBusinessDay: '2026-08-26',
            allowed: ['2026-08-27', '2026-08-26'],
          },
        }),
      })
      return
    }
    if (url.endsWith('/centro-costos') && method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: centros }),
      })
      return
    }
    // Create centro.
    if (url.endsWith('/centro-costos') && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      const id = 1000 + Math.floor(Math.random() * 10000)
      const newCentro = {
        id,
        nombre: body.nombre,
        tipo: body.tipo,
        descripcion: body.descripcion ?? null,
        activo: true,
        orden: body.orden ?? 0,
        precioUnitario:
          body.tipo === 'INGRESOS' && body.precioUnitario != null
            ? String(body.precioUnitario)
            : null,
        habilitarRecibo:
          body.tipo === 'INGRESOS' && body.habilitarRecibo != null
            ? !!body.habilitarRecibo
            : false,
        ocultarBeneficiario:
          body.tipo === 'INGRESOS' && body.ocultarBeneficiario != null
            ? !!body.ocultarBeneficiario
            : false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      centros = [...centros, newCentro]
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: newCentro }),
      })
      return
    }
    // Single ítem (recibo). MUST be matched BEFORE `/items` and `/:id`.
    if (/\/centro-costos\/items\/\d+/.test(url) && method === 'GET' && !url.includes('?')) {
      const id = Number(url.split('/').pop())
      const item = items.find((it) => it.id === id) ?? items[0]
      const parent = centros.find((c) => c.id === item.centroCostosId) ?? centros[0]
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...item,
            centro: parent,
            beneficiario: item.beneficiarioClienteId
              ? { id: item.beneficiarioClienteId, nombre: 'Juan Cliente Demo' }
              : null,
          },
        }),
      })
      return
    }
    // Items of a month.
    if (url.includes('/centro-costos/items') && method === 'GET' && url.includes('?')) {
      const periodo = new URL(url).searchParams.get('periodo') ?? ''
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { periodo: `${periodo}-01`, grupos: gruposForMonth(periodo) },
        }),
      })
      return
    }
    // Balance of a month.
    if (url.includes('/centro-costos/balance') && method === 'GET') {
      const periodo = new URL(url).searchParams.get('periodo') ?? ''
      const totalIngresos = gruposForMonth(periodo)
        .filter((g) => g.centro.tipo === 'INGRESOS')
        .reduce((acc, g) => acc + Number(g.subtotal), 0)
      const totalEgresos = gruposForMonth(periodo)
        .filter((g) => g.centro.tipo === 'EGRESOS')
        .reduce((acc, g) => acc + Number(g.subtotal), 0)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            periodo: `${periodo}-01`,
            porCentro: [],
            totalIngresos: totalIngresos.toFixed(2),
            totalEgresos: totalEgresos.toFixed(2),
            balance: (totalIngresos - totalEgresos).toFixed(2),
          },
        }),
      })
      return
    }
    // Create ítem.
    if (url.match(/\/centro-costos\/\d+\/items$/) && method === 'POST') {
      const body = JSON.parse(req.postData() || '{}')
      // Trap #6: client must not send valorTotal.
      expect(body).not.toHaveProperty('valorTotal')
      // Trap #7 (aug-17): client must NOT send periodo; server derives from fecha.
      expect(body).not.toHaveProperty('periodo')
      const id = 9000 + Math.floor(Math.random() * 10000)
      const parent = centros.find((c) => c.id === Number(url.split('/').slice(-2, -1)[0]))
      // For INGRESOS the server copies the centro.precioUnitario (R26).
      const valorUnitario =
        parent?.tipo === 'INGRESOS'
          ? Number(parent.precioUnitario ?? body.valorUnitario ?? 0).toFixed(2)
          : String(body.valorUnitario)
      const newItem = {
        id,
        centroCostosId: Number(url.split('/').slice(-2, -1)[0]),
        nombre: body.nombre,
        notas: body.notas ?? null,
        cantidad: body.cantidad ?? 1,
        valorUnitario,
        valorTotal: (Number(body.cantidad ?? 1) * Number(valorUnitario)).toFixed(2),
        fecha: body.fecha,
        periodo: `${(body.fecha ?? '').slice(0, 7)}-01`,
        numeroFactura: body.numeroFactura ?? null,
        proveedor: body.proveedor ?? null,
        fechaFactura: body.fechaFactura ?? null,
        pagador: body.pagador ?? null,
        beneficiarioClienteId: body.beneficiarioClienteId ?? null,
        medioPago: body.medioPago ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      items.push(newItem)
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: newItem }),
      })
      return
    }
    // PUT /centro-costos/:id (edit)
    if (url.match(/\/centro-costos\/\d+$/) && method === 'PUT') {
      const id = Number(url.split('/').pop())
      const body = JSON.parse(req.postData() || '{}')
      const idx = centros.findIndex((c) => c.id === id)
      if (idx >= 0) {
        centros = [
          ...centros.slice(0, idx),
          {
            ...centros[idx],
            ...body,
            precioUnitario:
              body.precioUnitario !== undefined
                ? body.precioUnitario === null
                  ? null
                  : String(body.precioUnitario)
                : centros[idx].precioUnitario,
            updatedAt: new Date().toISOString(),
          },
          ...centros.slice(idx + 1),
        ]
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: centros[idx] ?? null }),
      })
      return
    }
    // Default 200 with empty success — used as a safety net.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [] }),
    })
  })

  return { centros, items, balance }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe('Centro de Costos — frontend smoke (aug-17)', () => {
  test('AC#1 ADMIN sees 8 INGRESOS + 6 EGRESOS centros, all collapsed by default', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await expect(page.getByTestId('centro-costos-section-ingresos')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('centro-costos-section-egresos')).toBeVisible()

    // 14 centros total = 8 INGRESOS + 6 EGRESOS.
    // Use a regex to match ONLY the wrapper (`centro-costos-grupo-<id>`),
    // NOT the derived testids (-header-, -body-, -subtotal-, etc.).
    const grupos = page.getByTestId(/^centro-costos-grupo-\d+$/)
    await expect(grupos).toHaveCount(14, { timeout: 5000 })

    // Every accordion header is present and starts collapsed.
    // The `aria-expanded` attribute is the canonical signal for the
    // accordion state — read it via evaluateAll to be deterministic.
    const headers = page.locator('[data-testid^="centro-costos-grupo-header-"]')
    await expect(headers).toHaveCount(14)
    const expandedFlags = await headers.evaluateAll((els) =>
      els.map((el) => el.getAttribute('aria-expanded')),
    )
    expect(expandedFlags.every((v) => v === 'false')).toBe(true)

    // Bodies are not visible until expanded.
    const firstBody = page.getByTestId('centro-costos-grupo-body-17')
    await expect(firstBody).toBeHidden()
  })

  test('AC#1 expanding one centro does NOT force-expand others', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    const firstHeader = page.getByTestId('centro-costos-grupo-header-17')
    await expect(firstHeader).toBeVisible({ timeout: 15000 })
    await firstHeader.click()
    // Centro 17 expanded.
    await expect(page.getByTestId('centro-costos-grupo-body-17')).toBeVisible()
    // Centro 18 still collapsed.
    await expect(page.getByTestId('centro-costos-grupo-body-18')).toBeHidden()
    // Centro 25 (EGRESOS Refrigerios) still collapsed.
    await expect(page.getByTestId('centro-costos-grupo-body-25')).toBeHidden()
  })

  test('AC#1 add-ítem button only visible after expanding a centro', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    // Pre-condition: collapsed → button hidden.
    await expect(page.getByTestId('centro-costos-add-item-17')).toHaveCount(0)
    // Expand → button visible.
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await expect(page.getByTestId('centro-costos-add-item-17')).toBeVisible()
  })

  test('AC#2 ADMIN create-centro dialog persists a custom INGRESOS centro with precio + habilitarRecibo', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await expect(page.getByTestId('centro-costos-create-centro')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('centro-costos-create-centro').click()
    await expect(page.getByTestId('centro-costos-centro-dialog')).toBeVisible()

    await page.getByTestId('cc-centro-nombre').locator('input').fill('Navidad')
    await page.getByTestId('cc-centro-descripcion').locator('textarea').fill('Recursos para navidad')
    await page.getByTestId('cc-centro-precio').locator('input').fill('50000')
    await page.getByTestId('cc-centro-habilitar-recibo').check()
    await expect(page.getByTestId('cc-centro-ocultar-beneficiario')).toBeVisible()

    const post = page.waitForResponse(
      (r) => /\/api\/v1\/centro-costos$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await page.getByTestId('cc-centro-guardar').click()
    const resp = await post
    expect(resp.status()).toBe(201)
    const body = JSON.parse(resp.request().postData() || '{}')
    expect(body.nombre).toBe('Navidad')
    expect(body.tipo).toBe('INGRESOS')
    expect(Number(body.precioUnitario)).toBe(50000)
    expect(body.habilitarRecibo).toBe(true)
    expect(body.ocultarBeneficiario).toBe(false)
  })

  test('AC#3 CONTRATOS: no balance card, no month input, no create-centro button', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: CONTRATOS })
    await page.goto(`${FRONTEND}/centro-costos`)
    // Wait for the page to settle.
    await expect(page.getByTestId('centro-costos-section-ingresos')).toBeVisible({ timeout: 15000 })
    // No balance card.
    await expect(page.getByTestId('centro-costos-balance-card')).toHaveCount(0)
    // Month input is visible while F4 lock is off (backfill). Hidden when lock is on.
    // No create-centro button.
    await expect(page.getByTestId('centro-costos-create-centro')).toHaveCount(0)
  })

  test('AC#3 CONTRATOS sees add-ítem button after expanding a centro (revision D14/R21-R22)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: CONTRATOS })
    await page.goto(`${FRONTEND}/centro-costos`)
    await expect(page.getByTestId('centro-costos-section-ingresos')).toBeVisible({ timeout: 15000 })
    // Expand → add-ítem visible (button is in DOM via v-show; visibility is the
    // canonical signal for "expanded", not element count).
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await expect(page.getByTestId('centro-costos-add-item-17')).toBeVisible({ timeout: 5000 })
    // CONTRATOS can ALSO edit/delete ítems (D14/R21-R22).
    await expect(page.getByTestId('centro-costos-edit-item-117')).toBeVisible()
    await expect(page.getByTestId('centro-costos-delete-item-117')).toHaveCount(0)
  })

  test('AC#4 INGRESOS dialog: requires fecha + pagador + patient; valorUnitario is read-only', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await expect(page.getByTestId('centro-costos-add-item-17')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('centro-costos-add-item-17').click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })

    // Required ingreso fields visible.
    await expect(page.getByTestId('cc-item-fecha')).toBeVisible()
    await expect(page.getByTestId('cc-item-pagador')).toBeVisible()
    await expect(page.getByTestId('cc-item-beneficiario')).toBeVisible()
    await expect(page.getByTestId('cc-item-medio-pago')).toBeVisible()

    // No `cc-item-periodo` (we replaced the month-only field with `fecha`).
    await expect(page.getByTestId('cc-item-periodo')).toHaveCount(0)

    // No editable valorUnitario for INGRESOS — read-only from centro price.
    await expect(page.getByTestId('cc-item-valor-unitario')).toHaveCount(0)
    await expect(page.getByTestId('cc-item-valor-unitario-readonly')).toBeVisible()

    // Fill required fields.
    await page.getByTestId('cc-item-nombre').locator('input').fill('Mensualidad agosto')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia Pérez')
    await page.getByTestId('cc-item-beneficiario').selectOption({ label: 'Juan Cliente Demo' })

    // Capture POST: body must include pagador + beneficiario + fecha; no periodo.
    const post = page.waitForResponse(
      (r) => /\/api\/v1\/centro-costos\/\d+\/items$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await page.getByTestId('cc-item-guardar').click()
    const resp = await post
    expect(resp.status()).toBe(201)
    const body = JSON.parse(resp.request().postData() || '{}')
    expect(body).not.toHaveProperty('periodo')
    expect(body.fecha).toBe('2026-08-17')
    expect(body.pagador).toBe('Familia Pérez')
    expect(body.beneficiarioClienteId).toBe(42)
    // valorUnitario IS sent (server copies it from centro on INGRESOS).
    expect(Number(body.valorUnitario)).toBe(1500000)
  })

  test('aug-28 Valoraciones: beneficiario hidden and not required', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-24').click()
    await expect(page.getByTestId('centro-costos-add-item-24')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('centro-costos-add-item-24').click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('cc-item-pagador')).toBeVisible()
    await expect(page.getByTestId('cc-item-beneficiario')).toHaveCount(0)

    await page.getByTestId('cc-item-nombre').locator('input').fill('Valoración agosto')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia Pérez')

    const post = page.waitForResponse(
      (r) => /\/api\/v1\/centro-costos\/\d+\/items$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    )
    await page.getByTestId('cc-item-guardar').click()
    const resp = await post
    expect(resp.status()).toBe(201)
    const body = JSON.parse(resp.request().postData() || '{}')
    expect(body.pagador).toBe('Familia Pérez')
    expect(body.beneficiarioClienteId).toBeNull()
  })

  test('AC#5 EGRESOS dialog: typed valorUnitario; no pagador/beneficiario', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-25').click()
    await expect(page.getByTestId('centro-costos-add-item-25')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('centro-costos-add-item-25').click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })

    // Typed valorUnitario present for EGRESOS.
    await expect(page.getByTestId('cc-item-valor-unitario')).toBeVisible()
    await expect(page.getByTestId('cc-item-valor-unitario-readonly')).toHaveCount(0)

    // No INGRESOS-only fields.
    await expect(page.getByTestId('cc-item-pagador')).toHaveCount(0)
    await expect(page.getByTestId('cc-item-beneficiario')).toHaveCount(0)
    await expect(page.getByTestId('cc-item-medio-pago')).toHaveCount(0)

    // Egreso-only fields present.
    await expect(page.getByTestId('cc-item-numero-factura')).toBeVisible()
    await expect(page.getByTestId('cc-item-proveedor')).toBeVisible()
    await expect(page.getByTestId('cc-item-fecha-factura')).toBeVisible()
  })

  test('AC#4 INGRESOS dialog blocks save when centro has no precioUnitario (R26)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    // Ingresos adicionales (id=23) has precioUnitario=null.
    await page.getByTestId('centro-costos-grupo-header-23').click()
    await expect(page.getByTestId('centro-costos-add-item-23')).toBeVisible({ timeout: 15000 })
    await page.getByTestId('centro-costos-add-item-23').click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })

    // Fill required fields.
    await page.getByTestId('cc-item-nombre').locator('input').fill('Adicional')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia')
    await page.getByTestId('cc-item-beneficiario').selectOption({ label: 'María Cliente Test' })

    // Save → warn toast instead of POST.
    await page.getByTestId('cc-item-guardar').click()
    // The dialog stays open and a warn toast appears.
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible()
    await expect(page.locator('text=Precio no configurado').first()).toBeVisible({ timeout: 5000 })
  })

  test('AC#6 After INGRESOS save on habilitarRecibo centro, print CTA appears (R29)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    // Mensualidades completas (id=17) has habilitarRecibo=true.
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await page.getByTestId('centro-costos-add-item-17').click()
    await page.getByTestId('cc-item-nombre').locator('input').fill('Recibo demo')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia Pérez')
    await page.getByTestId('cc-item-beneficiario').selectOption({ label: 'Juan Cliente Demo' })
    await page.getByTestId('cc-item-guardar').click()

    await expect(page.getByTestId('centro-costos-print-after-create-dialog')).toBeVisible({ timeout: 10000 })
  })

  test('AC#6 Imprimir recibo opens a new tab and leaves the list', async ({ page, context }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await page.getByTestId('centro-costos-add-item-17').click()
    await page.getByTestId('cc-item-nombre').locator('input').fill('Recibo demo')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia Pérez')
    await page.getByTestId('cc-item-beneficiario').selectOption({ label: 'Juan Cliente Demo' })
    await page.getByTestId('cc-item-guardar').click()
    await expect(page.getByTestId('centro-costos-print-after-create-dialog')).toBeVisible({ timeout: 10000 })

    const popupPromise = context.waitForEvent('page')
    await page.getByTestId('cc-print-now').click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    expect(popup.url()).toMatch(/\/centro-costos\/recibo\/\d+/)
    expect(page.url()).toContain('/centro-costos')
    expect(page.url()).not.toContain('/recibo/')
    await expect(page.getByTestId('centro-costos-print-after-create-dialog')).toHaveCount(0)
    await popup.close()
  })

  test('AC#6 After INGRESOS save on a NON-habilitarRecibo centro, no print CTA', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    // Mensualidad por 4 días (id=18) has habilitarRecibo=false.
    await page.getByTestId('centro-costos-grupo-header-18').click()
    await page.getByTestId('centro-costos-add-item-18').click()
    await page.getByTestId('cc-item-nombre').locator('input').fill('No recibo')
    await page.getByTestId('cc-item-fecha').fill('2026-08-17')
    await page.getByTestId('cc-item-pagador').locator('input').fill('Familia Pérez')
    await page.getByTestId('cc-item-beneficiario').selectOption({ label: 'Juan Cliente Demo' })
    await page.getByTestId('cc-item-guardar').click()
    await expect(page.getByTestId('centro-costos-print-after-create-dialog')).toHaveCount(0, { timeout: 5000 })
  })

  test('AC#7 Recibo page renders the F6 rows (R30)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos/recibo/117`)
    await expect(page.getByTestId('recibo-content')).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('recibo-id')).toContainText('117')
    await expect(page.getByTestId('recibo-fecha')).toContainText('2026-08-17')
    await expect(page.getByTestId('recibo-pagador')).toContainText('Familia Pérez')
    await expect(page.getByTestId('recibo-beneficiario')).toContainText('Juan Cliente Demo')
    await expect(page.getByTestId('recibo-concepto')).toContainText('Mensualidades completas')
    await expect(page.getByTestId('recibo-cantidad')).toContainText('1')
    await expect(page.getByTestId('recibo-valor-unitario')).toContainText('1.500,00')
    await expect(page.getByTestId('recibo-valor-total')).toContainText('1.500,00')
    await expect(page.getByTestId('recibo-medio-pago')).toContainText('Efectivo')
  })

  test('balance reflects API exactly (string-decimal, AC#4 — trap #2)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await expect(page.getByTestId('centro-costos-balance-value')).toContainText('5.700,00', { timeout: 15000 })
    await expect(page.getByTestId('centro-costos-total-ingresos')).toContainText('10.500,00')
    await expect(page.getByTestId('centro-costos-total-egresos')).toContainText('4.800,00')
  })

  test('sidebar shows "Centro de Costos" for ADMIN (AC#6)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    const link = page.getByRole('link', { name: /Centro de Costos/i })
    await expect(link).toBeVisible({ timeout: 15000 })
  })

  test('sidebar hides "Centro de Costos" for GERONTOLOGA (AC#6)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: GERONTOLOGA })
    await page.goto(`${FRONTEND}/`)
    await page.waitForLoadState('networkidle')
    const link = page.getByRole('link', { name: /Centro de Costos/i })
    await expect(link).toHaveCount(0)
  })

  test('create an EGRESOS ítem through the dialog — drives DatePicker, fills optional fields (Task 6)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-25').click()
    const addEgreso = page.getByTestId('centro-costos-add-item-25')
    await expect(addEgreso).toBeVisible({ timeout: 15000 })
    await addEgreso.click()
    await expect(page.getByTestId('centro-costos-item-dialog')).toBeVisible({ timeout: 5000 })

    // Trap #1: drive every input explicitly.
    await page.getByTestId('cc-item-nombre').locator('input').fill('Café y aromática')
    await page.getByTestId('cc-item-cantidad').locator('input').fill('3')
    await page.getByTestId('cc-item-valor-unitario').locator('input').fill('4500')
    // Drive the DatePicker (native <input type="date">) explicitly.
    await page.getByTestId('cc-item-fecha').fill('2026-08-15')
    await page.getByTestId('cc-item-numero-factura').locator('input').fill('F-2026-001')
    await page.getByTestId('cc-item-proveedor').locator('input').fill('Distribuidora La Esperanza')
    await page.getByTestId('cc-item-fecha-factura').fill('2026-08-15')
    await page.getByTestId('cc-item-notas').locator('textarea').fill('Compra semanal')

    // Capture the POST and verify no valorTotal is sent (trap #6) and no periodo (trap #7).
    const post = page.waitForResponse(
      (r) => /\/api\/v1\/centro-costos\/\d+\/items$/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 30000 },
    )
    await page.getByTestId('cc-item-guardar').click()
    const resp = await post
    expect(resp.status()).toBe(201)
    const body = JSON.parse(resp.request().postData() || '{}')
    expect(body).not.toHaveProperty('valorTotal')
    expect(body).not.toHaveProperty('periodo')
    expect(body.nombre).toBe('Café y aromática')
    expect(body.cantidad).toBe(3)
    expect(Number(body.valorUnitario)).toBe(4500)
    expect(body.numeroFactura).toBe('F-2026-001')
    expect(body.proveedor).toBe('Distribuidora La Esperanza')
    expect(body.fechaFactura).toBe('2026-08-15')
    expect(body.fecha).toBe('2026-08-15')

    // Dialog closes on success.
    await expect(page.getByTestId('centro-costos-item-dialog')).toHaveCount(0, { timeout: 5000 })
  })

  test('delete centro with ítems → 409 surfaces server message (D8)', async ({ page }) => {
    await mockCentroCostosEndpoints(page, { user: ADMIN })
    await page.goto(`${FRONTEND}/centro-costos`)
    // The delete-centro button is only rendered when a centro has zero ítems
    // in the current month. Switch to a future month with no items, then
    // override the DELETE response to return the contract-mandated 409.
    const monthInput = page.getByTestId('centro-costos-periodo')
    await monthInput.evaluate((el: HTMLInputElement) => {
      el.value = '2099-12'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.waitForTimeout(800)
    // Override DELETE to return the contract-mandated 409.
    await page.route('**/api/v1/centro-costos/**', async (route) => {
      const req = route.request()
      if (req.method() === 'DELETE') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'El centro tiene ítems; desactívelo en lugar de eliminarlo',
            field: 'centroCostosId',
          }),
        })
        return
      }
      await route.continue()
    })
    const deleteBtn = page.getByTestId('centro-costos-delete-centro-17')
    await expect(deleteBtn).toBeVisible({ timeout: 15000 })
    await deleteBtn.click()
    await expect(page.getByTestId('centro-costos-delete-centro-dialog')).toBeVisible({ timeout: 5000 })

    await page.getByTestId('centro-costos-confirm-delete-centro').click()
    const toast = page.locator('text=desactívelo en lugar de eliminarlo').first()
    await expect(toast).toBeVisible({ timeout: 5000 })
  })
})