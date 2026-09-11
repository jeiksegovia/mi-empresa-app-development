import { test, expect } from '@playwright/test'

/**
 * qa-sep-2 F1: CONTRATOS certificados = read-only.
 * GERONTOLOGA = create-only (POST 201, PUT/DELETE 403).
 * ADMIN still full write.
 */

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123'
const GERONTOLOGA_EMAIL = 'qa-gerontologa@miempresa.com'
const GERONTOLOGA_PASSWORD = process.env.QA_GERONTOLOGA_PASSWORD || 'password123'

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  expect(resp.status(), `login ${email}`).toBe(200)
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('Certificados CONTRATOS read-only + GERONTOLOGA create-only (qa-sep-2 F1)', () => {
  let adminCookie: string
  let contratosCookie: string
  let gerontoCookie: string
  let certId: number

  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    gerontoCookie = await login(request, GERONTOLOGA_EMAIL, GERONTOLOGA_PASSWORD)

    const list = await request.get(`${API}/api/v1/certificates?limit=1`, {
      headers: { Cookie: adminCookie },
    })
    expect(list.status()).toBe(200)
    const rows = (await list.json()).data || []
    if (rows.length) {
      certId = rows[0].id
    } else {
      const created = await request.post(`${API}/api/v1/certificates`, {
        headers: { Cookie: adminCookie },
        data: { tipoCertificado: 'OTRO', nombre: `QA-F1-${Date.now()}` },
      })
      expect(created.status(), await created.text()).toBe(201)
      certId = (await created.json()).data.id
    }
  })

  test('CONTRATOS GET list + detail → 200', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/certificates?limit=5`, {
      headers: { Cookie: contratosCookie },
    })
    expect(list.status(), await list.text()).toBe(200)
    const detail = await request.get(`${API}/api/v1/certificates/${certId}`, {
      headers: { Cookie: contratosCookie },
    })
    expect(detail.status()).toBe(200)
  })

  test('GERONTOLOGA GET list + detail → 200', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/certificates?limit=5`, {
      headers: { Cookie: gerontoCookie },
    })
    expect(list.status()).toBe(200)
    const detail = await request.get(`${API}/api/v1/certificates/${certId}`, {
      headers: { Cookie: gerontoCookie },
    })
    expect(detail.status()).toBe(200)
  })

  test('CONTRATOS POST → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/certificates`, {
      headers: { Cookie: contratosCookie },
      data: { tipoCertificado: 'OTRO', nombre: 'SHOULD-FAIL' },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('DOMAIN_FORBIDDEN')
  })

  test('GERONTOLOGA POST → 201 create-only', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/certificates`, {
      headers: { Cookie: gerontoCookie },
      data: { tipoCertificado: 'OTRO', nombre: `QA-SEP2-GER-${Date.now()}` },
    })
    expect(r.status(), await r.text()).toBe(201)
  })

  test('GERONTOLOGA POST /certificates/:id/updates → 201 (first-file attach)', async ({ request }) => {
    const created = await request.post(`${API}/api/v1/certificates`, {
      headers: { Cookie: gerontoCookie },
      data: { tipoCertificado: 'OTRO', nombre: `QA-SEP11-UPD-${Date.now()}` },
    })
    expect(created.status(), await created.text()).toBe(201)
    const id = (await created.json()).data.id
    const upd = await request.post(`${API}/api/v1/certificates/${id}/updates`, {
      headers: { Cookie: gerontoCookie },
      data: { archivoUrl: 'certificates/qa-sep11-placeholder.pdf', notas: 'primer archivo' },
    })
    expect(upd.status(), await upd.text()).toBe(201)
  })

  test('CONTRATOS POST /certificates/:id/updates → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/certificates/${certId}/updates`, {
      headers: { Cookie: contratosCookie },
      data: { notas: 'should fail' },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('DOMAIN_FORBIDDEN')
  })

  test('GERONTOLOGA PUT → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const r = await request.put(`${API}/api/v1/certificates/${certId}`, {
      headers: { Cookie: gerontoCookie },
      data: { descripcion: 'no' },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('DOMAIN_FORBIDDEN')
  })

  test('CONTRATOS DELETE → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const r = await request.delete(`${API}/api/v1/certificates/${certId}`, {
      headers: { Cookie: contratosCookie },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('DOMAIN_FORBIDDEN')
  })
})
