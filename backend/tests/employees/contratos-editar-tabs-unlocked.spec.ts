import { test, expect } from '@playwright/test'

/**
 * qa-aug-27 3rd pass: CONTRATOS mutates every editar tab when unlocked;
 * locked → 403 EMPLOYEE_LOCKED. cargoId required on contrato create.
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

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  if (resp.status() !== 200) throw new Error(`Login failed for ${email}: ${resp.status()}`)
  return resp.headers()['set-cookie']
}

test.describe.configure({ mode: 'serial' })

test.describe('CONTRATOS editar tabs + cargo required (qa-aug-27)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)

    const create = await request.post(`${API}/api/v1/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'EDT',
        apellido: 'TABS',
        tipoDocumento: 'CC',
        numeroDocumento: `8${Date.now().toString().slice(-8)}T`,
        genero: 'M',
        fechaNacimiento: '1990-01-15',
      },
    })
    expect(create.status(), await create.text()).toBe(201)
    empId = (await create.json()).data.id

    const cargos = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    })
    expect(cargos.status()).toBe(200)
    cargoId = (await cargos.json()).data[0].id
  })

  test.afterAll(async ({ request }) => {
    await request.put(`${API}/api/v1/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
    await request.delete(`${API}/api/v1/employees/${empId}`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
  })

  test('unlocked: CONTRATOS PUT nucleo-familiar → 200', async ({ request }) => {
    const r = await request.put(`${API}/api/v1/employees/${empId}/nucleo-familiar`, {
      headers: { Cookie: contratosCookie },
      data: {
        nucleoFamiliar: [
          {
            nombre: 'Ana',
            apellido: 'Test',
            tipoDocumento: 'CC',
            fechaNacimiento: '2010-01-01',
            genero: 'F',
            parentesco: 'Hija',
          },
        ],
      },
    })
    expect(r.status(), await r.text()).toBe(200)
  })

  test('unlocked: contrato POST without cargoId → 400', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        valorJornada: 50000,
        activo: true,
      },
    })
    expect(r.status()).toBe(400)
  })

  test('unlocked: contrato POST with cargoId → 201', async ({ request }) => {
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
  })

  test('locked: CONTRATOS PUT nucleo-familiar → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const lock = await request.put(`${API}/api/v1/employees/${empId}/lock`, {
      headers: { Cookie: adminCookie },
    })
    expect(lock.status()).toBe(200)
    const r = await request.put(`${API}/api/v1/employees/${empId}/nucleo-familiar`, {
      headers: { Cookie: contratosCookie },
      data: { nucleoFamiliar: [] },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED')
  })

  test('locked: CONTRATOS POST contrato → 403 EMPLOYEE_LOCKED', async ({ request }) => {
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
})
