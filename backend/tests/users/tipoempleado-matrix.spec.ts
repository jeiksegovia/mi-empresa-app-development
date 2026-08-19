import { test, expect } from '@playwright/test'

/**
 * qa-session-aug-17 followup: POST /users must accept all MATRIX_TIPOS.
 * Previously Zod only allowed GERONTOLOGA, so PROFESORES/AUXILIARES could
 * not be provisioned via the product API (R6 writers blocked on staging).
 */

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  expect(resp.status(), `login ${email}`).toBe(200)
  return resp.headers()['set-cookie']
}

test('POST /users accepts PROFESORES and AUXILIARES tipoEmpleado', async ({ request }) => {
  const cookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
  const stamp = Date.now()
  const ids: number[] = []
  for (const tipo of ['PROFESORES', 'AUXILIARES'] as const) {
    const r = await request.post(`${API}/api/v1/users`, {
      headers: { Cookie: cookie },
      data: {
        email: `qa-${tipo.toLowerCase()}-${stamp}@miempresa.local`,
        password: 'password123',
        rol: 'EMPLEADO',
        nombre: 'QA',
        apellido: tipo,
        tipoEmpleado: tipo,
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const data = (await r.json()).data
    expect(data.tipoEmpleado).toBe(tipo)
    ids.push(data.id)
  }
  for (const id of ids) {
    await request.delete(`${API}/api/v1/users/${id}`, { headers: { Cookie: cookie } }).catch(() => {})
  }
})
