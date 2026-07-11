import { test, expect } from '@playwright/test'
import { loginAsAdmin, getApiBase } from '../helpers/auth'

/**
 * LOCAL: jul4 P5 — Módulo Novedades
 *
 *  - POST /employees/:id/novedades creates a novedad with archivos + nested replace on PUT
 *  - /empleados/[id] has a "Novedades" tab (index 4) listing items newest-first with
 *    a colored tag per tipo.
 *
 * Run: TEST_FRONTEND_URL=http://localhost:3100 npx playwright test tests/local-qa/jul4-p5-novedades.spec.ts
 */


test('P5-1: POST /employees/:id/novedades creates a MEMORANDO with adjunto + GET reflects it', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const id = (await list.json()).data[0].id
  expect(id).toBeTruthy()

  const input = {
    tipo: 'MEMORANDO',
    titulo: `Memorando Jul4 ${Date.now()}`,
    descripcion: 'Recordatorio de políticas internas.',
    fechaInicio: '2026-07-05',
    fechaFin: '2026-07-05',
    archivos: [{ nombre: 'memo.pdf', url: `novedades/memo-${Date.now()}.pdf` }],
  }
  const create = await page.request.post(`${API_URL}/employees/${id}/novedades`, {
    data: input,
  })
  expect(create.status()).toBe(201)
  const created = (await create.json()).data

  const get = await page.request.get(`${API_URL}/employees/${id}/novedades`)
  const gj = await get.json()
  expect(gj?.data?.some((n: any) => n.id === created.id && n.archivos?.[0]?.nombre === 'memo.pdf')).toBe(true)

  // Cleanup
  await page.request.delete(`${API_URL}/employees/${id}/novedades/${created.id}`)
})

test('P5-2: VACACIONES novedad with date range persists fechaFin', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const id = (await list.json()).data[0].id

  const input = {
    tipo: 'VACACIONES',
    titulo: `Vacaciones Jul4 ${Date.now()}`,
    fechaInicio: '2026-08-01',
    fechaFin: '2026-08-15',
  }
  const create = await page.request.post(`${API_URL}/employees/${id}/novedades`, {
    data: input,
  })
  expect(create.status()).toBe(201)
  const created = (await create.json()).data
  expect(created.tipo).toBe('VACACIONES')
  expect(created.fechaFin).toBeTruthy()

  await page.request.delete(`${API_URL}/employees/${id}/novedades/${created.id}`)
})

test('P5-3: /empleados/[id] shows the Novedades tab + timeline', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const id = (await list.json()).data[0].id

  // Seed a PERMISO novedad via API so it shows up in the timeline
  const seed = await page.request.post(`${API_URL}/employees/${id}/novedades`, {
    data: {
      tipo: 'PERMISO',
      titulo: `Permiso Jul4 ${Date.now()}`,
      fechaInicio: '2026-07-10',
    },
  })
  const sid = (await seed.json()).data.id

  await page.goto(`/empleados/${id}`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(800)

  // Click the Novedades tab (it is at index 4 — after Personal/Exp/Cert/Pendientes)
  await page.locator('button').filter({ hasText: 'Novedades' }).first().click()
  await page.waitForTimeout(500)

  // The seeded novedad appears in the panel
  const timeline = page.getByTestId('novedades-timeline')
  await expect(timeline).toBeVisible({ timeout: 5000 })

  const hasItem = (await timeline.getByText(`Permiso Jul4 `).count()) > 0
  expect(hasItem, 'seeded PERMISO novedad must appear').toBe(true)

  // Cleanup
  await page.request.delete(`${API_URL}/employees/${id}/novedades/${sid}`)
})

test('P5-4: FIX-1 — PUT /employees/:id/novedades/:nid without archivos preserves adjuntos', async ({ page }) => {
  await loginAsAdmin(page)
  const API_URL = await getApiBase(page)
  const list = await page.request.get(`${API_URL}/employees?limit=1`)
  const id = (await list.json()).data[0].id

  // Create a novedad with 1 adjunto
  const create = await page.request.post(`${API_URL}/employees/${id}/novedades`, {
    data: {
      tipo: 'MEMORANDO',
      titulo: `FIX-1 Adjuntos ${Date.now()}`,
      fechaInicio: '2026-07-05',
      archivos: [{ nombre: 'adjunto-fijo.pdf', url: `novedades/fijo-${Date.now()}.pdf` }],
    },
  })
  expect(create.status()).toBe(201)
  const nid = (await create.json()).data.id

  // PUT without `archivos` key — only update titulo
  const upd = await page.request.put(`${API_URL}/employees/${id}/novedades/${nid}`, {
    data: { tipo: 'MEMORANDO', titulo: `FIX-1 Edited ${Date.now()}`, fechaInicio: '2026-07-05' },
  })
  expect(upd.status()).toBe(200)

  // GET — adjunto must still be present (regression for FIX-1)
  const get = await page.request.get(`${API_URL}/employees/${id}/novedades`)
  expect(get.status()).toBe(200)
  const items = (await get.json()).data ?? []
  const updated = items.find((n: any) => n.id === nid)
  expect(updated, 'created novedad should still be in the list after PUT without archivos').toBeTruthy()
  expect(updated.archivos?.[0]?.nombre).toBe('adjunto-fijo.pdf')

  // Cleanup
  await page.request.delete(`${API_URL}/employees/${id}/novedades/${nid}`)
})
