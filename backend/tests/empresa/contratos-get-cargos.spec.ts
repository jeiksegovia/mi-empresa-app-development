/**
 * qa-session-aug-17 R2 / contract §2 —
 * CONTRATOS GET /empresa/cargos route-level exception.
 *
 * Matrix cell DOMAIN_ACCESS.CONTRATOS.empresa stays **false**.
 * Only GET /api/v1/empresa/cargos is allowed for EMPLEADO+CONTRATOS.
 * POST/PATCH/DELETE remain 403 DOMAIN_FORBIDDEN.
 * GERONTOLOGA still 403 on GET cargos (no exception).
 */

import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123'
const GERONTOLOGA_EMAIL = 'qa-gerontologa@miempresa.com'
const GERONTOLOGA_PASSWORD = process.env.QA_GERONTOLOGA_PASSWORD || 'password123'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DOMAIN_ACCESS_PATH = path.resolve(__dirname, '..', '..', 'src', 'middleware', 'domainAccess.ts')

let adminCookie: string
let contratosCookie: string
let gerontoCookie: string
let sampleCargoId: number

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  if (resp.status() !== 200) throw new Error(`Login failed for ${email}: ${resp.status()}`)
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('CONTRATOS GET /empresa/cargos exception (qa-aug-17 R2)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    gerontoCookie = await login(request, GERONTOLOGA_EMAIL, GERONTOLOGA_PASSWORD)

    const cargos = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    })
    expect(cargos.status(), 'admin can list cargos for fixture').toBe(200)
    const list = (await cargos.json()).data
    expect(Array.isArray(list) && list.length > 0).toBeTruthy()
    sampleCargoId = list[0].id
  })

  test.afterAll(async ({ request }) => {
    for (const c of [adminCookie, contratosCookie, gerontoCookie]) {
      await request.post(`${API}/api/v1/auth/logout`, { headers: { Cookie: c } }).catch(() => {})
    }
  })

  test('matrix cell CONTRATOS.empresa stays false (exception is route-level only)', () => {
    const src = readFileSync(DOMAIN_ACCESS_PATH, 'utf-8')
    // Extract CONTRATOS block and assert empresa: false (not true / read-only).
    const m = src.match(/CONTRATOS:\s*{([\s\S]*?)\n\s{2}\}/)
    expect(m, 'CONTRATOS block present').toBeTruthy()
    const empresaLine = m![1]
      .split('\n')
      .map((l) => l.replace(/\s*\/\/.*$/, '').trim())
      .find((l) => l.startsWith('empresa:'))
    expect(empresaLine, 'empresa cell present').toBeTruthy()
    expect(empresaLine).toMatch(/empresa:\s*false,?/)
  })

  test('qa-contratos GET /empresa/cargos → 200', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: contratosCookie },
    })
    expect(res.status(), await res.text()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('qa-contratos POST /empresa/cargos → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const res = await request.post(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: `CTR-DENIED-${Date.now()}` },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
  })

  test('qa-contratos PATCH /empresa/cargos/:id → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const res = await request.patch(`${API}/api/v1/empresa/cargos/${sampleCargoId}`, {
      headers: { Cookie: contratosCookie },
      data: { activo: true },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
  })

  test('qa-contratos DELETE /empresa/cargos/:id → 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const res = await request.delete(`${API}/api/v1/empresa/cargos/${sampleCargoId}`, {
      headers: { Cookie: contratosCookie },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
  })

  test('GERONTOLOGA GET /empresa/cargos → 403 (no exception)', async ({ request }) => {
    const res = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: gerontoCookie },
    })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
  })
})
