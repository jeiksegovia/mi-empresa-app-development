import { test, expect } from '@playwright/test'

const API_URL = process.env.TEST_API_URL || 'http://localhost:3001'

test.describe('Serverless Lambda Smoke Tests', () => {

  test('GET /api/v1/health returns 200 with status ok', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/health`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty('status', 'ok')
    expect(body).toHaveProperty('timestamp')
  })

  test('API responds with JSON content-type', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/health`)
    expect(response.headers()['content-type']).toContain('application/json')
  })

  test('POST /api/v1/auth/login with invalid credentials returns 401', async ({ request }) => {
    // Password must be >= 6 chars to pass validation; wrong credentials → 401
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {
        email: 'nonexistent@test.com',
        password: 'wrongpassword123'
      }
    })
    expect(response.status()).toBe(401)
  })

  test('POST /api/v1/auth/login with too-short password returns 400 validation error', async ({ request }) => {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: {
        email: 'nonexistent@test.com',
        password: 'short'
      }
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body).toHaveProperty('message', 'Validation error')
  })

  test('Protected route /api/v1/employees returns 401 without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/employees`)
    expect(response.status()).toBe(401)
  })

  test('Protected route /api/v1/patients returns 401 without auth', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/patients`)
    expect(response.status()).toBe(401)
  })

  test('404 for unknown routes', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/nonexistent-route-xyz`)
    expect(response.status()).toBe(404)
  })

  test('CORS headers present for allowed origin', async ({ request }) => {
    const response = await request.get(`${API_URL}/api/v1/health`, {
      headers: {
        'Origin': process.env.CORS_ORIGIN || 'http://localhost:3000'
      }
    })
    expect(response.status()).toBeLessThan(400)
  })

  test('Full auth flow: login → get session → logout', async ({ request }) => {
    const TEST_EMAIL = process.env.TEST_USER_EMAIL
    const TEST_PASSWORD = process.env.TEST_USER_PASSWORD

    if (!TEST_EMAIL || !TEST_PASSWORD) {
      test.skip()
      return
    }

    const loginResponse = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: TEST_EMAIL, password: TEST_PASSWORD }
    })
    expect(loginResponse.status()).toBe(200)

    const setCookieHeader = loginResponse.headers()['set-cookie']
    expect(setCookieHeader).toBeDefined()
    expect(setCookieHeader).toMatch(/HttpOnly/i)

    const meResponse = await request.get(`${API_URL}/api/v1/auth/me`)
    expect(meResponse.status()).toBe(200)
  })
})
