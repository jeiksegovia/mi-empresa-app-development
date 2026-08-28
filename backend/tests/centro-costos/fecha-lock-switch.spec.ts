/**
 * aug-27 F4 — ADMIN "Limitar fechas CONTRATOS" switch against the QA seed.
 *
 * Pattern: backend/tests/asistencia/asistencia-rbac.spec.ts
 *   cookie login, TEST_API_URL, serial, workers:1, restore state in afterAll.
 *
 * Local seed (prisma/seed.ts + seedCentrosCostos):
 *   admin@miempresa.com / password123
 *   qa-contratos@miempresa.com / password123
 *   empresas.limitar_fecha_contratos default false
 *
 * Staging: set TEST_API_URL + ADMIN_EMAIL/PASSWORD + CONTRATOS_EMAIL/PASSWORD
 * from prisma/test-db/get-qa-creds.sh (SSM). F4 is only live if migration
 * 20260828004117_limitar_fecha_contratos is applied.
 *
 * Run:
 *   cd backend && TEST_API_URL=http://localhost:3101 \
 *     npx playwright test tests/centro-costos/fecha-lock-switch.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test'

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@miempresa.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'
const CONTRATOS_EMAIL = process.env.CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.CONTRATOS_PASSWORD || 'password123'

function todayBogota(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  })
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`)
  }
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('F4 fecha-lock switch (QA seed)', () => {
  let adminCookie: string
  let contratosCookie: string
  let empresaId: number
  let egresoCentroId: number
  let createdItemIds: number[] = []
  let originalLock: boolean

  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)

    const emp = await request.get(`${API_BASE}/api/v1/empresa`, {
      headers: { Cookie: adminCookie },
    })
    expect(emp.status(), 'ADMIN GET /empresa (QA seed must have one empresa)').toBe(200)
    const empBody = await emp.json()
    expect(empBody.data?.id).toBeTruthy()
    empresaId = empBody.data.id
    originalLock = !!empBody.data.limitarFechaContratos

    const centros = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=EGRESOS`, {
      headers: { Cookie: adminCookie },
    })
    expect(centros.status()).toBe(200)
    const list = (await centros.json()).data as { id: number; nombre: string }[]
    expect(list.length, 'seeded EGRESOS centros').toBeGreaterThan(0)
    egresoCentroId = list[0].id
  })

  test.afterAll(async ({ request }) => {
    for (const id of createdItemIds) {
      const r = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
        headers: { Cookie: adminCookie },
      })
      if (r.status() !== 204 && r.status() !== 404) {
        throw new Error(`cleanup item ${id}: ${r.status()} ${await r.text()}`)
      }
    }
    if (empresaId) {
      await request.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
        headers: { Cookie: adminCookie },
        data: { limitarFechaContratos: originalLock },
      })
    }
  })

  test('GET /policy is reachable and lists allowed fechas', async ({ request }) => {
    const resp = await request.get(`${API_BASE}/api/v1/centro-costos/policy`, {
      headers: { Cookie: adminCookie },
    })
    expect(resp.status(), 'policy endpoint (migration 31 + GET /policy)').toBe(200)
    const body = await resp.json()
    expect(body.success).toBe(true)
    expect(typeof body.data.limitarFechaContratos).toBe('boolean')
    expect(body.data.today).toBe(todayBogota())
    expect(body.data.allowed).toContain(body.data.today)
    expect(body.data.allowed).toContain(body.data.previousBusinessDay)
  })

  test('lock OFF: CONTRATOS can POST a 1999 fecha (backfill)', async ({ request }) => {
    const off = await request.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
      headers: { Cookie: adminCookie },
      data: { limitarFechaContratos: false },
    })
    expect(off.status()).toBe(200)
    expect((await off.json()).data.limitarFechaContratos).toBe(false)

    const policy = await request.get(`${API_BASE}/api/v1/centro-costos/policy`, {
      headers: { Cookie: contratosCookie },
    })
    expect((await policy.json()).data.limitarFechaContratos).toBe(false)

    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'F4 switch backfill 1999',
        valorUnitario: 1,
        fecha: '1999-01-15',
      },
    })
    expect(resp.status()).toBe(201)
    const id = (await resp.json()).data.id
    createdItemIds.push(id)
  })

  test('lock ON: CONTRATOS POST 1999 → 403 field=fecha; today → 201', async ({ request }) => {
    const on = await request.put(`${API_BASE}/api/v1/empresa/${empresaId}`, {
      headers: { Cookie: adminCookie },
      data: { limitarFechaContratos: true },
    })
    expect(on.status()).toBe(200)
    expect((await on.json()).data.limitarFechaContratos).toBe(true)

    const blocked = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'F4 switch blocked 1999',
        valorUnitario: 1,
        fecha: '1999-01-15',
      },
    })
    expect(blocked.status()).toBe(403)
    const body = await blocked.json()
    expect(body.field).toBe('fecha')
    expect(body.message).toMatch(/día hábil anterior/)

    const today = todayBogota()
    const ok = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: contratosCookie },
      data: {
        nombre: 'F4 switch today ok',
        valorUnitario: 1,
        fecha: today,
      },
    })
    expect(ok.status()).toBe(201)
    createdItemIds.push((await ok.json()).data.id)
  })

  test('CONTRATOS DELETE ítem is always 403 (lock on or off)', async ({ request }) => {
    const today = todayBogota()
    const created = await request.post(`${API_BASE}/api/v1/centro-costos/${egresoCentroId}/items`, {
      headers: { Cookie: adminCookie },
      data: { nombre: 'F4 delete probe', valorUnitario: 1, fecha: today },
    })
    expect(created.status()).toBe(201)
    const id = (await created.json()).data.id
    createdItemIds.push(id)

    const del = await request.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
      headers: { Cookie: contratosCookie },
    })
    expect(del.status()).toBe(403)
  })
})
