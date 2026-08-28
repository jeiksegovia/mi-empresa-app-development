/**
 * Recibo print layout — 80mm small-format ticket.
 *
 * Existing smoke AC#7 only checks field text. This spec checks:
 *  - habilitarRecibo centros expose reprint
 *  - ticket fields stay inside the 80mm print area
 *  - label left / value right, no overflow, no chrome in print
 *
 * Previews:
 *   frontend/tests/centro-costos/previews/recibo-screen.png
 *   frontend/tests/centro-costos/previews/recibo-print-80mm.png
 *   .playwright-mcp/recibo-*.png
 *
 * Run:
 *   cd frontend && npx playwright test tests/centro-costos/recibo-print.spec.ts --reporter=list
 */

import { test, expect, type Page, type Locator } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const FRONTEND = process.env.TEST_FRONTEND_URL || 'http://localhost:3100'
const PREVIEW_DIR = path.join(process.cwd(), 'tests/centro-costos/previews')
const MCP_DIR = path.join(process.cwd(), '..', '.playwright-mcp')

/** 80mm paper / 4mm margin at 96dpi. */
const PAGE_WIDTH_PX = Math.round((80 / 25.4) * 96)
const MARGIN_PX = Math.round((4 / 25.4) * 96)
const TICKET_WIDTH_PX = PAGE_WIDTH_PX

const ADMIN = {
  id: 1,
  email: 'admin@miempresa.com',
  nombre: 'Admin',
  apellido: 'Sistema',
  rol: 'ADMIN',
  tipoEmpleado: null,
  activo: true,
}

const CENTRO_RECIBO = {
  id: 17,
  nombre: 'Mensualidades completas',
  tipo: 'INGRESOS' as const,
  descripcion: null,
  activo: true,
  orden: 1,
  precioUnitario: '1500000.00',
  habilitarRecibo: true,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
}

const CENTRO_NO_RECIBO = {
  ...CENTRO_RECIBO,
  id: 18,
  nombre: 'Mensualidad por 4 días',
  orden: 2,
  precioUnitario: '500000.00',
  habilitarRecibo: false,
}

const PREVIEW_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())

const CENTRO_LONG = {
  ...CENTRO_RECIBO,
  id: 19,
  nombre: 'Mensualidad por 4 días de atención gerontológica integral con transporte',
  orden: 3,
}

const ITEM_BASE = {
  centroCostosId: 17,
  nombre: 'Mensualidad agosto',
  notas: null as string | null,
  cantidad: 1,
  valorUnitario: '1500000.00',
  valorTotal: '1500000.00',
  fecha: '2026-08-17',
  periodo: '2026-08-01',
  numeroFactura: null,
  proveedor: null,
  fechaFactura: null,
  pagador: 'Familia Pérez Gómez de la Esperanza',
  beneficiarioClienteId: 42 as number | null,
  medioPago: 'EFECTIVO' as const,
  createdAt: '2026-08-05T00:00:00.000Z',
  updatedAt: '2026-08-05T00:00:00.000Z',
}

const VARIATIONS: Record<number, { slug: string; item: any; centro: typeof CENTRO_RECIBO; beneficiario: { id: number; nombre: string } | null }> = {
  117: {
    slug: 'con-beneficiario-nota-larga',
    centro: CENTRO_RECIBO,
    beneficiario: { id: 42, nombre: 'Juan Cliente Demo' },
    item: {
      ...ITEM_BASE,
      id: 117,
      nombre: 'Mensualidad agosto — pensión completa',
      notas: 'Pago puntual de agosto. Incluye refrigerio y transporte interno del centro.',
    },
  },
  119: {
    slug: 'sin-beneficiario-nota-corta',
    centro: CENTRO_RECIBO,
    beneficiario: null,
    item: {
      ...ITEM_BASE,
      id: 119,
      nombre: 'Mensualidad agosto',
      notas: 'Pago agosto',
      beneficiarioClienteId: null,
    },
  },
  120: {
    slug: 'concepto-largo-con-beneficiario',
    centro: CENTRO_LONG,
    beneficiario: { id: 42, nombre: 'Juan Cliente Demo' },
    item: {
      ...ITEM_BASE,
      id: 120,
      centroCostosId: 19,
      nombre: 'Cuota agosto',
      notas: null,
    },
  },
  121: {
    slug: 'concepto-largo-sin-beneficiario-nota-larga',
    centro: CENTRO_LONG,
    beneficiario: null,
    item: {
      ...ITEM_BASE,
      id: 121,
      centroCostosId: 19,
      nombre: 'Cuota agosto — pensión y transporte 4 días',
      notas: 'Pago puntual de agosto. Incluye refrigerio y transporte interno del centro.',
      beneficiarioClienteId: null,
    },
  },
}

const ITEM = VARIATIONS[117].item

function json(data: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  }
}

async function mockRecibo(page: Page) {
  await page.context().addInitScript(() => {
    ;(window as any).__printCount = 0
    window.print = () => { (window as any).__printCount += 1 }
    const origClose = window.close.bind(window)
    ;(window as any).__reciboCloseCalled = false
    window.close = () => {
      ;(window as any).__reciboCloseCalled = true
      origClose()
    }
  })

  // Context-level so a recibo tab opened via window.open inherits the mocks.
  await page.context().route('**/api/v1/**', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()

    if (url.includes('/auth/me') || (url.includes('/auth/login') && method === 'POST')) {
      await route.fulfill(json({ success: true, user: ADMIN }))
      return
    }
    if (url.includes('/empresa') && method === 'GET') {
      await route.fulfill(json({
        success: true,
        data: {
          id: 1,
          nombre: 'Centro Día Los Almendros',
          nit: '900123456-1',
          direccion: 'Calle 10 #20-30, Bogotá',
          telefono: '6014567890',
          email: 'demo@miempresa.com',
          activa: true,
          limitarFechaContratos: false,
        },
      }))
      return
    }
    if (url.includes('/centro-costos/policy')) {
      await route.fulfill(json({
        success: true,
        data: {
          limitarFechaContratos: false,
          today: '2026-08-27',
          previousBusinessDay: '2026-08-26',
          allowed: ['2026-08-27', '2026-08-26'],
        },
      }))
      return
    }
    if (/\/centro-costos\/items\/\d+/.test(url) && method === 'GET' && !url.includes('?')) {
      const id = Number(url.split('/').pop())
      const v = VARIATIONS[id] ?? VARIATIONS[117]
      await route.fulfill(json({
        success: true,
        data: {
          ...v.item,
          centro: v.centro,
          beneficiario: v.beneficiario,
        },
      }))
      return
    }
    if (url.includes('/centro-costos/items') && method === 'GET') {
      const periodo = new URL(url).searchParams.get('periodo') ?? '2026-08'
      await route.fulfill(json({
        success: true,
        data: {
          periodo: `${periodo}-01`,
          grupos: [
            { centro: CENTRO_RECIBO, items: [ITEM], subtotal: ITEM.valorTotal },
            { centro: CENTRO_NO_RECIBO, items: [{ ...ITEM, id: 118, centroCostosId: 18 }], subtotal: '0.00' },
          ],
        },
      }))
      return
    }
    if (url.includes('/centro-costos/balance')) {
      await route.fulfill(json({
        success: true,
        data: {
          periodo: '2026-08-01',
          porCentro: [],
          totalIngresos: '1500000.00',
          totalEgresos: '0.00',
          balance: '1500000.00',
        },
      }))
      return
    }
    if (url.endsWith('/centro-costos') || url.endsWith('/centro-costos/') || /\/centro-costos(\?|$)/.test(url)) {
      await route.fulfill(json({ success: true, data: [CENTRO_RECIBO, CENTRO_NO_RECIBO] }))
      return
    }

    await route.fulfill(json({ success: true, data: null }))
  })
}

function assertNoOverflow(box: { x: number; y: number; width: number; height: number }, maxWidth: number, label: string) {
  expect(box.width, `${label} width`).toBeGreaterThan(0)
  expect(box.height, `${label} height`).toBeGreaterThan(0)
  expect(box.x, `${label} left`).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width, `${label} right`).toBeLessThanOrEqual(maxWidth + 2)
}

async function savePreview(page: Page, locator: Locator, basename: string) {
  fs.mkdirSync(PREVIEW_DIR, { recursive: true })
  fs.mkdirSync(MCP_DIR, { recursive: true })
  const name = `recibo-${PREVIEW_DATE}-${basename}`
  const pngA = path.join(PREVIEW_DIR, `${name}.png`)
  const pngB = path.join(MCP_DIR, `${name}.png`)
  await locator.screenshot({ path: pngA })
  fs.copyFileSync(pngA, pngB)
}

async function assertSingleTotalRule(ticket: Locator) {
  const unitario = ticket.getByTestId('recibo-valor-unitario').locator('xpath=..')
  const total = ticket.locator('.recibo-row-total')
  const unitarioBottom = await unitario.evaluate((el) => getComputedStyle(el).borderBottomWidth)
  const totalTop = await total.evaluate((el) => getComputedStyle(el).borderTopWidth)
  expect(unitarioBottom, 'V. unitario must not keep a line under it').toBe('0px')
  expect(totalTop, 'TOTAL keeps one dashed top rule').not.toBe('0px')
}

test.describe('recibo 80mm print layout', () => {
  test('reprint button only on habilitarRecibo centros', async ({ page }) => {
    await mockRecibo(page)
    await page.goto(`${FRONTEND}/centro-costos`)
    await expect(page.getByTestId('centro-costos-grupo-header-17')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('centro-costos-grupo-header-18').click()
    await expect(page.getByTestId('centro-costos-add-item-18')).toBeVisible()
    await expect(page.getByTestId('centro-costos-print-item-118')).toHaveCount(0)

    await page.getByTestId('centro-costos-grupo-header-17').click()
    await expect(page.getByTestId('centro-costos-print-item-117')).toBeVisible()
  })

  test('print opens a new tab and Volver closes it; list stays', async ({ page, context }) => {
    await mockRecibo(page)
    await page.goto(`${FRONTEND}/centro-costos`)
    await page.getByTestId('centro-costos-grupo-header-17').click()
    await expect(page.getByTestId('centro-costos-print-item-117')).toBeVisible()

    const popupPromise = context.waitForEvent('page')
    await page.getByTestId('centro-costos-print-item-117').click()
    const popup = await popupPromise
    await popup.waitForLoadState('domcontentloaded')
    await expect(popup.getByTestId('recibo-content')).toBeVisible({ timeout: 15000 })
    await expect(popup.getByTestId('recibo-id')).toHaveText('117')
    expect(page.url()).toContain('/centro-costos')
    expect(page.url()).not.toContain('/recibo/')
    await expect(page.getByTestId('centro-costos-print-item-117')).toBeVisible()

    expect(popup.url()).toContain('popup=1')
    const closed = popup.waitForEvent('close', { timeout: 5000 }).then(() => true).catch(() => false)
    await popup.getByTestId('recibo-back').click()
    const didClose = await closed
    if (!didClose && !popup.isClosed()) {
      const flagged = await popup.evaluate(() => (window as any).__reciboCloseCalled).catch(() => false)
      expect(flagged, 'Volver must call window.close() on a popup tab').toBe(true)
      await popup.close()
    }
    expect(didClose || popup.isClosed()).toBe(true)
    await expect(page.getByTestId('centro-costos-print-item-117')).toBeVisible()
  })

  test('Imprimir can fire again after cooldown; double-click is ignored', async ({ page }) => {
    await mockRecibo(page)
    await page.goto(`${FRONTEND}/centro-costos/recibo/117`)
    await expect(page.getByTestId('recibo-content')).toBeVisible({ timeout: 15000 })
    await expect.poll(async () => page.evaluate(() => (window as any).__printCount)).toBeGreaterThanOrEqual(1)
    const afterAuto = await page.evaluate(() => (window as any).__printCount)
    const btn = page.getByTestId('recibo-print')
    await expect(btn).toBeDisabled()

    await btn.click({ force: true })
    await btn.click({ force: true })
    await page.waitForTimeout(200)
    expect(await page.evaluate(() => (window as any).__printCount)).toBe(afterAuto)

    await expect(btn).toBeEnabled({ timeout: 2500 })
    await btn.click()
    await expect.poll(async () => page.evaluate(() => (window as any).__printCount)).toBe(afterAuto + 1)
  })

  test('screen ticket is compact, aligned, and stays in 80mm', async ({ page }) => {
    await mockRecibo(page)
    await page.setViewportSize({ width: TICKET_WIDTH_PX + 80, height: 900 })
    await page.goto(`${FRONTEND}/centro-costos/recibo/117`)
    const ticket = page.getByTestId('recibo-content')
    await expect(ticket).toBeVisible({ timeout: 15000 })

    await expect(page.getByTestId('recibo-empresa')).toContainText('Centro Día Los Almendros')
    await expect(page.getByTestId('recibo-id')).toHaveText('117')
    await expect(page.getByTestId('recibo-fecha')).toHaveText('2026-08-17')
    await expect(page.getByTestId('recibo-pagador')).toContainText('Familia Pérez')
    await expect(page.getByTestId('recibo-beneficiario')).toContainText('Juan Cliente Demo')
    await expect(page.getByTestId('recibo-concepto')).toContainText('Mensualidades completas')
    await expect(page.getByTestId('recibo-cantidad')).toHaveText('1')
    await expect(page.getByTestId('recibo-valor-total')).toContainText('1.500.000,00')
    await expect(page.getByTestId('recibo-medio-pago')).toHaveText('Efectivo')
    await expect(page.getByTestId('recibo-print')).toBeVisible()

    const ticketBox = await ticket.boundingBox()
    expect(ticketBox).toBeTruthy()
    expect(ticketBox!.width).toBeLessThanOrEqual(TICKET_WIDTH_PX + 8)

    const overflow = await ticket.evaluate((el) => ({
      clientWidth: (el as HTMLElement).clientWidth,
      scrollWidth: (el as HTMLElement).scrollWidth,
      clientHeight: (el as HTMLElement).clientHeight,
      scrollHeight: (el as HTMLElement).scrollHeight,
    }))
    expect(overflow.scrollWidth, 'no horizontal bleed').toBeLessThanOrEqual(overflow.clientWidth + 1)

    const rows = ticket.locator('.recibo-row')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThanOrEqual(8)
    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i)
      const label = row.locator('dt')
      const value = row.locator('dd')
      const lb = await label.boundingBox()
      const vb = await value.boundingBox()
      expect(lb && vb, `row ${i} boxes`).toBeTruthy()
      expect(lb!.x, `row ${i} label left of value`).toBeLessThan(vb!.x)
      expect(lb!.y + lb!.height, `row ${i} label inside ticket`).toBeLessThanOrEqual(ticketBox!.y + ticketBox!.height + 1)
      expect(vb!.y + vb!.height, `row ${i} value inside ticket`).toBeLessThanOrEqual(ticketBox!.y + ticketBox!.height + 1)
      assertNoOverflow(vb!, ticketBox!.x + ticketBox!.width + 2, `row ${i} value`)
    }

    const ink = await ticket.evaluate((el) => {
      const nodes = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[]
      return nodes.map((n) => getComputedStyle(n).color)
    })
    for (const c of ink) {
      expect(c === 'rgb(0, 0, 0)' || c === 'rgba(0, 0, 0, 1)', `ink ${c}`).toBe(true)
    }

    await assertSingleTotalRule(ticket)
    await savePreview(page, ticket, 'con-beneficiario-nota-larga')
  })

  test('empty beneficiario omits the row and still prints', async ({ page }) => {
    await mockRecibo(page)
    await page.setViewportSize({ width: TICKET_WIDTH_PX + 80, height: 900 })
    await page.goto(`${FRONTEND}/centro-costos/recibo/119`)
    const ticket = page.getByTestId('recibo-content')
    await expect(ticket).toBeVisible({ timeout: 15000 })
    await expect(page.getByTestId('recibo-id')).toHaveText('119')
    await expect(page.getByTestId('recibo-pagador')).toContainText('Familia Pérez')
    await expect(page.getByTestId('recibo-beneficiario')).toHaveCount(0)
    await expect(page.getByTestId('recibo-valor-total')).toContainText('1.500.000,00')
    await expect(ticket.getByText('Beneficiario')).toHaveCount(0)
    await expect(page.getByTestId('recibo-notas')).toHaveText('Pago agosto')

    const overflow = await ticket.evaluate((el) => ({
      clientWidth: (el as HTMLElement).clientWidth,
      scrollWidth: (el as HTMLElement).scrollWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

    await assertSingleTotalRule(ticket)
    await savePreview(page, ticket, 'sin-beneficiario-nota-corta')
  })

  test('variation previews: long concepto, long note, with/without beneficiario', async ({ page }) => {
    await mockRecibo(page)
    await page.setViewportSize({ width: TICKET_WIDTH_PX + 80, height: 1100 })

    for (const id of [117, 119, 120, 121]) {
      const v = VARIATIONS[id]
      await page.goto(`${FRONTEND}/centro-costos/recibo/${id}`)
      const ticket = page.getByTestId('recibo-content')
      await expect(ticket).toBeVisible({ timeout: 15000 })
      await expect(page.getByTestId('recibo-id')).toHaveText(String(id))
      await expect(page.getByTestId('recibo-concepto')).toContainText(v.centro.nombre.split(' ')[0])
      if (v.beneficiario) {
        await expect(page.getByTestId('recibo-beneficiario')).toHaveText(v.beneficiario.nombre)
      } else {
        await expect(page.getByTestId('recibo-beneficiario')).toHaveCount(0)
      }
      if (v.item.notas) {
        await expect(page.getByTestId('recibo-notas')).toBeVisible()
      } else {
        await expect(page.getByTestId('recibo-notas')).toHaveCount(0)
      }
      await assertSingleTotalRule(ticket)
      const overflow = await ticket.evaluate((el) => ({
        clientWidth: (el as HTMLElement).clientWidth,
        scrollWidth: (el as HTMLElement).scrollWidth,
      }))
      expect(overflow.scrollWidth, v.slug).toBeLessThanOrEqual(overflow.clientWidth + 1)
      await savePreview(page, ticket, v.slug)
    }
  })

  test('print media hides chrome and keeps content in the 80mm page', async ({ page }) => {
    await mockRecibo(page)
    // Viewport wider than the sheet so the capture is the 80mm page, not a clipped 302px window.
    await page.setViewportSize({ width: PAGE_WIDTH_PX + 120, height: 900 })
    await page.goto(`${FRONTEND}/centro-costos/recibo/117`)
    await expect(page.getByTestId('recibo-content')).toBeVisible({ timeout: 15000 })

    await page.emulateMedia({ media: 'print' })
    await expect(page.getByTestId('recibo-print')).toBeHidden()
    await expect(page.getByTestId('recibo-back')).toBeHidden()
    await expect(page.getByTestId('recibo-content')).toBeVisible()
    await expect(page.locator('aside')).toBeHidden()
    await expect(page.locator('header.sticky')).toBeHidden()

    const sheet = page.getByTestId('recibo-print-page')
    const ticket = page.getByTestId('recibo-content')
    const sheetBox = await sheet.boundingBox()
    const ticketBox = await ticket.boundingBox()
    expect(sheetBox).toBeTruthy()
    expect(ticketBox).toBeTruthy()

    expect(sheetBox!.width, 'sheet is 80mm').toBeGreaterThan(PAGE_WIDTH_PX - 8)
    expect(sheetBox!.width, 'sheet is 80mm').toBeLessThanOrEqual(PAGE_WIDTH_PX + 8)
    expect(ticketBox!.x, 'left 4mm margin').toBeGreaterThanOrEqual(sheetBox!.x + MARGIN_PX - 2)
    expect(ticketBox!.x + ticketBox!.width, 'right 4mm margin').toBeLessThanOrEqual(
      sheetBox!.x + sheetBox!.width - MARGIN_PX + 2,
    )
    expect(ticketBox!.y, 'top 4mm margin').toBeGreaterThanOrEqual(sheetBox!.y + MARGIN_PX - 2)
    expect(sheetBox!.height, 'sheet hugs ticket, no leftover page').toBeLessThan(ticketBox!.height + MARGIN_PX * 2 + 16)

    const overflow = await ticket.evaluate((el) => ({
      clientWidth: (el as HTMLElement).clientWidth,
      scrollWidth: (el as HTMLElement).scrollWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1)

    const rows = ticket.locator('.recibo-row')
    const rowCount = await rows.count()
    for (let i = 0; i < rowCount; i++) {
      const lb = await rows.nth(i).locator('dt').boundingBox()
      const vb = await rows.nth(i).locator('dd').boundingBox()
      expect(lb && vb).toBeTruthy()
      expect(lb!.x).toBeLessThan(vb!.x)
      expect(vb!.x + vb!.width).toBeLessThanOrEqual(ticketBox!.x + ticketBox!.width + 2)
      expect(vb!.y + vb!.height).toBeLessThanOrEqual(ticketBox!.y + ticketBox!.height + 2)
    }

    const ink = await ticket.evaluate((el) => {
      const nodes = [el, ...Array.from(el.querySelectorAll('*'))] as HTMLElement[]
      return nodes.map((n) => getComputedStyle(n).color)
    })
    for (const c of ink) {
      expect(c === 'rgb(0, 0, 0)' || c === 'rgba(0, 0, 0, 1)', `print ink ${c}`).toBe(true)
    }

    await savePreview(page, ticket, 'print-80mm')
    await savePreview(page, sheet, 'print-page')
  })
})
