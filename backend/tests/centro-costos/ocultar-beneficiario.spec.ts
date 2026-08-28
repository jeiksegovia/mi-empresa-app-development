/**
 * aug-28 — Centro config `ocultarBeneficiario`.
 *
 * Valoraciones (seed) hides beneficiario and skips the required check.
 * Other INGRESOS centros still require beneficiarioClienteId.
 *
 * Run:
 *   cd backend && TEST_API_URL=http://localhost:3101 \
 *     npx playwright test tests/centro-costos/ocultar-beneficiario.spec.ts --reporter=list
 */

import { test, expect } from '@playwright/test'

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@miempresa.com'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'password123'

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

test.describe('aug-28 ocultarBeneficiario', () => {
  let adminCookie: string
  let valoracionesId: number
  let createdCentroId: number | null = null
  let createdItemIds: number[] = []

  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    const centros = await request.get(`${API_BASE}/api/v1/centro-costos?tipo=INGRESOS`, {
      headers: { Cookie: adminCookie },
    })
    expect(centros.status()).toBe(200)
    const list = (await centros.json()).data as {
      id: number
      nombre: string
      ocultarBeneficiario: boolean
      precioUnitario: string | null
    }[]
    const val = list.find((c) => c.nombre === 'Valoraciones')
    expect(val, 'seeded Valoraciones centro').toBeTruthy()
    valoracionesId = val!.id
    expect(val!.ocultarBeneficiario).toBe(true)
  })

  test.afterAll(async ({ request }) => {
    for (const id of createdItemIds) {
      await request.delete(`${API_BASE}/api/v1/centro-costos/items/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {})
    }
    if (createdCentroId) {
      await request.delete(`${API_BASE}/api/v1/centro-costos/${createdCentroId}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {})
    }
  })

  test('Valoraciones POST without beneficiarioClienteId → 201, field null', async ({ request }) => {
    // Ensure a price so INGRESOS copy does not 400 on precioUnitario.
    const put = await request.put(`${API_BASE}/api/v1/centro-costos/${valoracionesId}`, {
      headers: { Cookie: adminCookie },
      data: { precioUnitario: 70000, ocultarBeneficiario: true },
    })
    expect(put.status()).toBe(200)
    expect((await put.json()).data.ocultarBeneficiario).toBe(true)

    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${valoracionesId}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Valoración sin beneficiario',
        pagador: 'Familia Pérez',
        fecha: todayBogota(),
      },
    })
    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.data.beneficiarioClienteId).toBeNull()
    expect(body.data.pagador).toBe('Familia Pérez')
    createdItemIds.push(body.data.id)
  })

  test('custom INGRESOS with ocultarBeneficiario=true skips required check', async ({ request }) => {
    const created = await request.post(`${API_BASE}/api/v1/centro-costos`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: `QA-hide-benef-${Date.now()}`,
        tipo: 'INGRESOS',
        precioUnitario: 1000,
        ocultarBeneficiario: true,
      },
    })
    expect(created.status()).toBe(201)
    const centro = (await created.json()).data
    createdCentroId = centro.id
    expect(centro.ocultarBeneficiario).toBe(true)

    const resp = await request.post(`${API_BASE}/api/v1/centro-costos/${centro.id}/items`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'Item without beneficiario',
        pagador: 'Alguien',
        fecha: todayBogota(),
      },
    })
    expect(resp.status()).toBe(201)
    const body = await resp.json()
    expect(body.data.beneficiarioClienteId).toBeNull()
    createdItemIds.push(body.data.id)
  })
})
