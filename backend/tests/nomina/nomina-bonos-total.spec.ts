/**
 * qa-session-aug-17 R3 + R4 — nómina bonos + periodos auth.
 *
 * Contract §3:
 *   - BONOS_ALLOWED = TERMINO_FIJO | TERMINO_INDEFINIDO
 *   - FIJO/INDEF: totalPagado = valorMensual + bonos; aportes stored NOT added
 *   - OPS/OBRA: bonos > 0 → 400 field bonos
 *   - POST/PUT periodos: requireEmployeeUnlocked (not ADMIN-only)
 *   - Locked empleado → 403 EMPLOYEE_LOCKED for CONTRATOS
 *   - OPS still requires valorJornada on contrato create (unchanged)
 */

import { test, expect } from '@playwright/test'

const API = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || 'password123'

let adminCookie: string
let contratosCookie: string
let cargoId: number
let fijoEmpId: number
let opsEmpId: number
let obraEmpId: number
let lockEmpId: number
const createdPeriodoIds: number[] = []
const createdEmpIds: number[] = []

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  if (resp.status() !== 200) throw new Error(`Login failed for ${email}: ${resp.status()}`)
  return resp.headers()['set-cookie']
}

async function createEmployee(request: any, tag: string): Promise<number> {
  const doc = `8${Date.now().toString().slice(-8)}${tag}`.slice(0, 15)
  const r = await request.post(`${API}/api/v1/employees`, {
    headers: { Cookie: adminCookie },
    data: {
      nombre: 'BONOS',
      apellido: tag,
      tipoDocumento: 'CC',
      numeroDocumento: doc,
      genero: 'M',
      fechaNacimiento: '1990-01-01',
    },
  })
  expect(r.status(), await r.text()).toBe(201)
  const id = (await r.json()).data.id
  createdEmpIds.push(id)
  return id
}

test.describe.configure({ mode: 'serial' })

test.describe('Nómina bonos + periodos auth (qa-aug-17 R3/R4)', () => {
  test.beforeAll(async ({ request }) => {
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)

    const cargos = await request.get(`${API}/api/v1/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    })
    expect(cargos.status()).toBe(200)
    cargoId = (await cargos.json()).data[0].id

    fijoEmpId = await createEmployee(request, 'FJ')
    const fijoCtr = await request.post(`${API}/api/v1/nomina/employees/${fijoEmpId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_FIJO',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorMensual: 2000000,
        activo: true,
      },
    })
    expect(fijoCtr.status(), await fijoCtr.text()).toBe(201)

    opsEmpId = await createEmployee(request, 'OP')
    const opsCtr = await request.post(`${API}/api/v1/nomina/employees/${opsEmpId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 50000,
        activo: true,
      },
    })
    expect(opsCtr.status(), await opsCtr.text()).toBe(201)

    obraEmpId = await createEmployee(request, 'OB')
    const obraCtr = await request.post(`${API}/api/v1/nomina/employees/${obraEmpId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'OBRA_O_LABOR',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorMensual: 1800000,
        activo: true,
      },
    })
    expect(obraCtr.status(), await obraCtr.text()).toBe(201)

    lockEmpId = await createEmployee(request, 'LK')
    const lockCtr = await request.post(`${API}/api/v1/nomina/employees/${lockEmpId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'TERMINO_INDEFINIDO',
        fechaInicio: '2026-01-01',
        cargoId,
        valorMensual: 1700000,
        activo: true,
      },
    })
    expect(lockCtr.status(), await lockCtr.text()).toBe(201)
  })

  test.afterAll(async ({ request }) => {
    for (const id of createdPeriodoIds) {
      await request.delete(`${API}/api/v1/nomina/periodos/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {})
    }
    await request.put(`${API}/api/v1/employees/${lockEmpId}/unlock`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
    for (const id of createdEmpIds) {
      await request.delete(`${API}/api/v1/employees/${id}`, {
        headers: { Cookie: adminCookie },
      }).catch(() => {})
    }
    for (const c of [adminCookie, contratosCookie]) {
      await request.post(`${API}/api/v1/auth/logout`, { headers: { Cookie: c } }).catch(() => {})
    }
  })

  test('FIJO/INDEF POST without valorJornada/medias → 201; stores bonos; total = V+B; aportes not added', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: fijoEmpId,
        periodo: '2099-01',
        valorMensual: 2000000,
        bonos: 150000,
        aportesSociales: 200000,
        // intentionally omit valorJornada / mediasJornadas
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const data = (await r.json()).data
    createdPeriodoIds.push(data.id)
    expect(Number(data.bonos)).toBe(150000)
    expect(Number(data.aportesSociales)).toBe(200000)
    expect(Number(data.totalPagado)).toBe(2150000)
    expect(Number(data.subtotalCalculado)).toBe(2150000)
    expect(Number(data.salario)).toBe(2150000)
    expect(data.mediasJornadas ?? null).toBeNull()
    expect(data.valorJornada ?? null).toBeNull()
  })

  test('bonos > 0 on OPS → 400 field bonos', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: opsEmpId,
        periodo: '2099-02',
        bonos: 10000,
        mediasJornadas: 2,
        valorJornada: 50000,
        archivos: [
          { tipoArchivo: 'CUENTA_COBRO', nombre: 'cc.pdf', url: '/uploads/cc-test.pdf' },
        ],
      },
    })
    expect(r.status()).toBe(400)
    const body = await r.json()
    expect(body.field).toBe('bonos')
  })

  test('bonos > 0 on OBRA → 400 field bonos', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: obraEmpId,
        periodo: '2099-03',
        bonos: 5000,
        archivos: [
          { tipoArchivo: 'CUENTA_COBRO', nombre: 'cc.pdf', url: '/uploads/cc-test.pdf' },
        ],
      },
    })
    expect(r.status()).toBe(400)
    const body = await r.json()
    expect(body.field).toBe('bonos')
  })

  test('qa-contratos POST unlocked empleado → 201', async ({ request }) => {
    const r = await request.post(`${API}/api/v1/nomina/periodos`, {
      headers: { Cookie: contratosCookie },
      data: {
        empleadoId: lockEmpId,
        periodo: '2099-04',
        bonos: 25000,
        aportesSociales: 10000,
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const data = (await r.json()).data
    createdPeriodoIds.push(data.id)
    expect(Number(data.bonos)).toBe(25000)
    expect(Number(data.totalPagado)).toBe(1725000) // 1700000 + 25000
    expect(Number(data.aportesSociales)).toBe(10000)
  })

  test('qa-contratos POST locked empleado → 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const lock = await request.put(`${API}/api/v1/employees/${lockEmpId}/lock`, {
      headers: { Cookie: adminCookie },
    })
    expect(lock.status()).toBe(200)

    const r = await request.post(`${API}/api/v1/nomina/periodos`, {
      headers: { Cookie: contratosCookie },
      data: {
        empleadoId: lockEmpId,
        periodo: '2099-05',
        bonos: 1000,
      },
    })
    expect(r.status()).toBe(403)
    const body = await r.json()
    expect(body.code).toBe('EMPLOYEE_LOCKED')

    await request.put(`${API}/api/v1/employees/${lockEmpId}/unlock`, {
      headers: { Cookie: adminCookie },
    })
  })

  test('OPS contrato create still requires valorJornada', async ({ request }) => {
    const empId = await createEmployee(request, 'OV')
    const r = await request.post(`${API}/api/v1/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: adminCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        activo: true,
        // omit valorJornada
      },
    })
    expect(r.status()).toBe(400)
    const body = await r.json()
    expect(body.field).toBe('valorJornada')
  })
})
