import { test, expect } from '@playwright/test'

/**
 * qa-session-aug-6: CONTRATOS must create/edit contratos when empleado is unlocked.
 *
 * Root cause fixed: POST/PUT/DELETE /nomina/employees/:id/contratos used
 * requireRole('ADMIN'), which blocked EMPLEADO+CONTRATOS despite
 * DOMAIN_ACCESS.nomina = true. Now uses requireEmployeeUnlocked only
 * (requireDomain('nomina') already applied at router level).
 */

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123'

let adminCookie: string
let contratosCookie: string
let empId: number
let cargoId: number
let contratoId: number

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  if (resp.status() !== 200) throw new Error(`Login failed for ${email}: ${resp.status()}`)
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('CONTRATOS role — contratos CRUD when unlocked (qa-aug-6)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)

    const create = await request.post(`${API}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'CTR',
        apellido: 'ROLE',
        tipoDocumento: 'CC',
        numeroDocumento: `7${Date.now().toString().slice(-8)}C`,
        genero: 'M',
        fechaNacimiento: '1990-01-15',
      },
    })
    expect(create.status()).toBe(201)
    empId = (await create.json()).data.id

    // Need a real cargo for contrato create (cargoId).
    const cargos = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    })
    expect(cargos.status(), 'empresa/cargos must be available for fixture setup').toBe(200)
    const body = await cargos.json()
    const list = body.data || body
    expect(Array.isArray(list) && list.length > 0, 'at least one cargo required').toBeTruthy()
    cargoId = list[0].id
  })

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/api/v1/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
    await request.delete(`${API}/api/v1/employees/${empId}`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
    for (const c of [adminCookie, contratosCookie]) {
      await request.post(`${API}/api/v1/auth/logout`, { headers: { Cookie: c } }).catch(() => {})
    }
  })

  test('unlocked: CONTRATOS can POST a contrato', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 50000,
        activo: true,
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const data = (await r.json()).data
    contratoId = data.id
    expect(data.tipoContrato).toBe('OPS')
  })

  test('unlocked: CONTRATOS can PUT (edit) the contrato', async ({ request }) => {
    const r = await request.put(
      `${API}/api/v1/nomina/employees/${empId}/contratos/${contratoId}`,
      {
        headers: { Cookie: contratosCookie },
        data: {
          tipoContrato: 'OPS',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          cargoId,
          valorJornada: 55000,
          activo: true,
        },
      },
    )
    expect(r.status(), await r.text()).toBe(200)
    expect(Number((await r.json()).data.valorJornada)).toBe(55000)
  })

  test('locked: CONTRATOS POST contrato → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const lock = await request.put(`${API}/api/v1/employees/${empId}/lock`, {
      headers: { Cookie: adminCookie },
    })
    expect(lock.status()).toBe(200)

    const r = await request.post(`${API}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-02-01',
        fechaFin: '2026-06-30',
        cargoId,
        valorJornada: 40000,
        activo: true,
      },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED')
  })

  test('locked: CONTRATOS PUT contrato → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const r = await request.put(
      `${API}/api/v1/nomina/employees/${empId}/contratos/${contratoId}`,
      {
        headers: { Cookie: contratosCookie },
        data: {
          tipoContrato: 'OPS',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          cargoId,
          valorJornada: 60000,
          activo: true,
        },
      },
    )
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED')
  })

  test('after unlock: CONTRATOS can edit again', async ({ request }) => {
    const unlock = await request.put(`${API}/api/v1/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    })
    expect(unlock.status()).toBe(200)

    const r = await request.put(
      `${API}/api/v1/nomina/employees/${empId}/contratos/${contratoId}`,
      {
        headers: { Cookie: contratosCookie },
        data: {
          tipoContrato: 'OPS',
          fechaInicio: '2026-01-01',
          fechaFin: '2026-12-31',
          cargoId,
          valorJornada: 52000,
          activo: true,
        },
      },
    )
    expect(r.status(), await r.text()).toBe(200)
  })
})
