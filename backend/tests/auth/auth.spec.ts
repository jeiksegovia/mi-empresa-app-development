import { test, expect } from '@playwright/test'

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3001'

// Run serially so shared session cookie is set before dependent tests
test.describe.configure({ mode: 'serial' })

async function loginAndGetCookie(request: any): Promise<string> {
  // Logout any stale session first to avoid 409 conflicts when suites run together
  await request.post(`${API_BASE}/api/v1/auth/logout`).catch(() => {})

  const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email: 'admin@miempresa.com', password: 'password123' },
  })
  expect(res.status()).toBe(200)
  const setCookie = res.headers()['set-cookie']
  expect(setCookie).toBeDefined()
  const match = setCookie.match(/session=([^;]+)/)
  expect(match).toBeTruthy()
  return setCookie
}

test.describe('Authentication API', () => {
  let sessionCookie: string

  // ─── POST /api/v1/auth/login ───────────────────────────────────────────────

  test.describe('POST /api/v1/auth/login', () => {
    test('should login successfully with valid credentials', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: 'admin@miempresa.com', password: 'password123' },
      })
      expect(res.status()).toBe(200)

      const body = await res.json()
      // Actual response shape: { user: { id, email, rol, nombre, apellido } }
      expect(body).toHaveProperty('user')
      expect(body.user).toHaveProperty('email', 'admin@miempresa.com')
      expect(body.user).toHaveProperty('nombre')
      expect(body.user).not.toHaveProperty('password')

      // Session is set via HTTP-only cookie, not in body
      const cookies = res.headers()['set-cookie']
      expect(cookies).toBeDefined()
      expect(cookies).toContain('session=')
    })

    test('should fail with invalid credentials', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: 'admin@miempresa.com', password: 'wrongpassword' },
      })
      expect(res.status()).toBe(401)

      const body = await res.json()
      // Auth error responses use { error } or { success, message }
      expect(body.error || body.message).toBeTruthy()
    })

    test('should fail with missing password', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: 'admin@miempresa.com' },
      })
      expect(res.status()).toBe(400)

      const body = await res.json()
      expect(body).toHaveProperty('success', false)
    })

    test('should fail with missing email', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { password: 'password123' },
      })
      expect(res.status()).toBe(400)
    })

    test('should fail with invalid email format', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: 'notanemail', password: 'password123' },
      })
      expect(res.status()).toBe(400)
    })

    test('should fail with non-existent user', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: 'nonexistent@example.com', password: 'SomePassword123!' },
      })
      expect(res.status()).toBe(401)
    })
  })

  // ─── GET /api/v1/auth/me ───────────────────────────────────────────────────

  test.describe('GET /api/v1/auth/me', () => {
    test.beforeAll(async ({ request }) => {
      sessionCookie = await loginAndGetCookie(request)
    })

    test('should get current user with valid session cookie', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/auth/me`, {
        headers: { Cookie: sessionCookie },
      })
      expect(res.status()).toBe(200)

      const body = await res.json()
      // /me response shape: { user: { id, email, rol, nombre, apellido, activo } }
      const user = body.user || body
      expect(user).toHaveProperty('id')
      expect(user).toHaveProperty('email', 'admin@miempresa.com')
      expect(user).toHaveProperty('nombre')
      expect(user).toHaveProperty('apellido')
      expect(user).toHaveProperty('rol')
      expect(user).not.toHaveProperty('password')
    })

    test('should fail without session cookie', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/auth/me`)
      expect(res.status()).toBe(401)
    })

    test('should fail with invalid token', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/auth/me`, {
        headers: { Cookie: 'session=invalid.token.here' },
      })
      expect(res.status()).toBe(401)
    })

    test('should fail with malformed authorization header', async ({ request }) => {
      const res = await request.get(`${API_BASE}/api/v1/auth/me`, {
        headers: { Authorization: 'InvalidFormat token' },
      })
      expect(res.status()).toBe(401)
    })
  })

  // ─── POST /api/v1/auth/refresh ─────────────────────────────────────────────

  test.describe('POST /api/v1/auth/refresh', () => {
    test.beforeAll(async ({ request }) => {
      sessionCookie = await loginAndGetCookie(request)
    })

    test('should refresh token with valid session cookie', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/refresh`, {
        headers: { Cookie: sessionCookie },
      })
      expect(res.status()).toBe(200)

      const body = await res.json()
      // Refresh sets a new cookie and returns a message
      expect(body).toHaveProperty('message')
    })

    test('should fail without session cookie', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/refresh`)
      expect(res.status()).toBe(401)
    })
  })

  // ─── POST /api/v1/auth/logout ──────────────────────────────────────────────

  test.describe('POST /api/v1/auth/logout', () => {
    test.beforeAll(async ({ request }) => {
      sessionCookie = await loginAndGetCookie(request)
    })

    test('should logout successfully with valid session cookie', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/logout`, {
        headers: { Cookie: sessionCookie },
      })
      expect(res.status()).toBe(200)

      const body = await res.json()
      expect(body).toHaveProperty('message')
    })

    test('should fail to access protected route after logout', async ({ request }) => {
      // The session was just invalidated above
      const res = await request.get(`${API_BASE}/api/v1/auth/me`, {
        headers: { Cookie: sessionCookie },
      })
      expect(res.status()).toBe(401)
    })
  })

  // ─── Edge cases ────────────────────────────────────────────────────────────

  test.describe('Edge cases and validation', () => {
    test('should handle empty request body for login', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: {},
      })
      expect(res.status()).toBe(400)
    })

    test('should handle very long email', async ({ request }) => {
      const longEmail = 'a'.repeat(300) + '@example.com'
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: longEmail, password: 'password123' },
      })
      expect([400, 401]).toContain(res.status())
    })

    test('should handle SQL injection attempt in email', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: "admin@miempresa.com' OR '1'='1", password: 'password123' },
      })
      expect([400, 401]).toContain(res.status())
    })

    test('should handle XSS attempt in email', async ({ request }) => {
      const res = await request.post(`${API_BASE}/api/v1/auth/login`, {
        data: { email: '<script>alert("xss")</script>@example.com', password: 'password123' },
      })
      expect([400, 401]).toContain(res.status())
    })
  })
})
