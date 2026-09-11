/**
 * sep-11: CONTRATOS POST /patients must succeed with leftover/blank email.
 * Prod 15:51–16:19: six 400 Zod invalid_string on email (not DOMAIN_FORBIDDEN).
 */

import { test, expect } from '@playwright/test'

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const CONTRATOS_EMAIL = process.env.QA_CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123'

async function login(request: any): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, {
    data: { email: CONTRATOS_EMAIL, password: CONTRATOS_PASSWORD },
  })
  expect(resp.status(), `login ${CONTRATOS_EMAIL}`).toBe(200)
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('CONTRATOS create patient — email coercion (sep-11)', () => {
  let cookie: string
  const created: number[] = []

  test.beforeAll(async ({ request }) => {
    cookie = await login(request)
  })

  test.afterAll(async ({ request }) => {
    const admin = await request.post(`${API}/api/v1/auth/login`, {
      data: { email: 'admin@miempresa.com', password: 'password123' },
    })
    const adminCookie = admin.headers()['set-cookie']
    for (const id of created) {
      await request.delete(`${API}/api/v1/patients/${id}`, { headers: { Cookie: adminCookie } }).catch(() => {})
    }
  })

  test('POST with email leftover "correo" → 201, email omitted', async ({ request }) => {
    const doc = `91${String(Date.now()).slice(-8)}`
    const r = await request.post(`${API}/api/v1/patients`, {
      headers: { Cookie: cookie },
      data: {
        nombre: 'Contratos Email',
        tipoDocumento: 'CC',
        numeroDocumento: doc,
        genero: 'M',
        fechaNacimiento: '1950-01-01',
        email: 'correo',
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const body = await r.json()
    created.push(body.data.id)
    expect(body.data.email == null || body.data.email === '').toBeTruthy()
  })

  test('POST with whitespace email → 201', async ({ request }) => {
    const doc = `92${String(Date.now()).slice(-8)}`
    const r = await request.post(`${API}/api/v1/patients`, {
      headers: { Cookie: cookie },
      data: {
        nombre: 'Contratos Blank',
        tipoDocumento: 'CC',
        numeroDocumento: doc,
        genero: 'F',
        fechaNacimiento: '1951-01-01',
        email: '   ',
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    created.push((await r.json()).data.id)
  })

  test('POST with valid email → 201 keeps email', async ({ request }) => {
    const doc = `93${String(Date.now()).slice(-8)}`
    const r = await request.post(`${API}/api/v1/patients`, {
      headers: { Cookie: cookie },
      data: {
        nombre: 'Contratos Valid',
        tipoDocumento: 'CC',
        numeroDocumento: doc,
        genero: 'F',
        fechaNacimiento: '1952-01-01',
        email: 'paciente.ok@test.com',
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const body = await r.json()
    created.push(body.data.id)
    expect(String(body.data.email).toLowerCase()).toContain('paciente.ok@test.com')
  })
})
