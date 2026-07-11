import { test, expect } from '@playwright/test'

const API_URL = `${process.env.TEST_API_URL || 'http://localhost:3101'}/api/v1`

test.describe.configure({ mode: 'serial' })

test.describe('Auth - Usuario-Empleado Link', () => {
  let cookieValue: string

  test('should return empleadoId when logging in as empleado user', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'empleado@miempresa.com',
        password: 'password123',
      },
    })

    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.email).toBe('empleado@miempresa.com')
    expect(json.user.empleadoId).toBeDefined()
    expect(typeof json.user.empleadoId).toBe('number')

    // Extract session cookie from Set-Cookie header
    const setCookieHeader = res.headers()['set-cookie']
    if (Array.isArray(setCookieHeader)) {
      cookieValue = setCookieHeader[0].split(';')[0].split('=')[1]
    } else if (typeof setCookieHeader === 'string') {
      cookieValue = setCookieHeader.split(';')[0].split('=')[1]
    }

    console.log(`✅ Empleado user logged in with empleadoId: ${json.user.empleadoId}`)
  })

  test('should return empleadoId in GET /auth/me for empleado user', async ({ request }) => {
    const res = await request.get(`${API_URL}/auth/me`, {
      headers: {
        Cookie: `session=${cookieValue}`,
      },
    })

    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.empleadoId).toBeDefined()
    expect(typeof json.user.empleadoId).toBe('number')

    console.log(`✅ GET /auth/me returned empleadoId: ${json.user.empleadoId}`)
  })

  test('should NOT return empleadoId for admin user (no link)', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'admin@miempresa.com',
        password: 'password123',
      },
    })

    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.email).toBe('admin@miempresa.com')
    // empleadoId should be undefined for admin user
    expect(json.user.empleadoId).toBeUndefined()

    console.log(`✅ Admin user logged in WITHOUT empleadoId (as expected)`)
  })

  test('should NOT return empleadoId for auditor user (no link)', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'auditor@miempresa.com',
        password: 'password123',
      },
    })

    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.email).toBe('auditor@miempresa.com')
    expect(json.user.empleadoId).toBeUndefined()

    console.log(`✅ Auditor user logged in WITHOUT empleadoId (as expected)`)
  })

  test('should NOT return empleadoId for operador user (no link)', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      data: {
        email: 'operador@miempresa.com',
        password: 'password123',
      },
    })

    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json.user).toBeDefined()
    expect(json.user.email).toBe('operador@miempresa.com')
    expect(json.user.empleadoId).toBeUndefined()

    console.log(`✅ Operador user logged in WITHOUT empleadoId (as expected)`)
  })
})
