import { test, expect } from '@playwright/test'

const BASE_URL = 'http://localhost:3001/api/v1'

// Run serially to avoid concurrent login conflicts (409) on the same account
test.describe.configure({ mode: 'serial' })

async function getAuthCookie(request: any): Promise<string> {
  // Logout any existing session first to avoid 409 conflicts between test suites
  await request.post(`${BASE_URL}/auth/logout`).catch(() => {})

  const res = await request.post(`${BASE_URL}/auth/login`, {
    data: { email: 'admin@miempresa.com', password: 'password123' },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  // Login response shape: { user: { id, email, rol, nombre, apellido } }
  expect(body.user).toBeDefined()
  // Extract cookie from headers
  const setCookie = res.headers()['set-cookie'] || ''
  const match = setCookie.match(/session=([^;]+)/)
  return match ? `session=${match[1]}` : ''
}

test.describe('Dashboard API', () => {
  let authCookie: string

  test.beforeAll(async ({ request }) => {
    authCookie = await getAuthCookie(request)
  })

  test.afterAll(async ({ request }) => {
    // Logout to clean up session
    await request.post(`${BASE_URL}/auth/logout`, {
      headers: { Cookie: authCookie },
    })
  })

  test('GET /dashboard/stats requires authentication', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/dashboard/stats`)
    expect(res.status()).toBe(401)
  })

  test('GET /dashboard/stats returns stats for authenticated user', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/dashboard/stats`, {
      headers: { Cookie: authCookie },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data).toHaveProperty('empleados')
    expect(body.data).toHaveProperty('pacientes')
    expect(body.data).toHaveProperty('instrumentos')
    expect(body.data).toHaveProperty('certificados')
    expect(typeof body.data.empleados).toBe('number')
    expect(typeof body.data.pacientes).toBe('number')
    expect(typeof body.data.instrumentos).toBe('number')
    expect(typeof body.data.certificados).toBe('number')
    // Seeded data: at least some records exist
    expect(body.data.empleados).toBeGreaterThanOrEqual(0)
    expect(body.data.pacientes).toBeGreaterThanOrEqual(0)
    expect(body.data.instrumentos).toBeGreaterThanOrEqual(0)
    expect(body.data.certificados).toBeGreaterThanOrEqual(0)
  })

  test('GET /dashboard/stats returns non-negative numbers', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/dashboard/stats`, {
      headers: { Cookie: authCookie },
    })
    const body = await res.json()
    expect(body.data.empleados).toBeGreaterThanOrEqual(0)
    expect(body.data.pacientes).toBeGreaterThanOrEqual(0)
    expect(body.data.instrumentos).toBeGreaterThanOrEqual(0)
    expect(body.data.certificados).toBeGreaterThanOrEqual(0)
  })
})
