import { test, expect } from '@playwright/test'

/**
 * Staging QA — qa-session-aug-17 stories (live API).
 *
 * Env:
 *   TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1
 *   QA_ADMIN_PASSWORD / QA_CONTRATOS_PASSWORD / QA_GERONTOLOGA_PASSWORD
 */

const API = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'qa-admin@miempresa.com'
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || ''
const CONTRATOS_EMAIL = process.env.QA_CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || ''
const GERONTO_EMAIL = process.env.QA_GERONTOLOGA_EMAIL || 'qa-gerontologa@miempresa.com'
const GERONTO_PASSWORD = process.env.QA_GERONTOLOGA_PASSWORD || ''

const PERSONAL_FIELD_IDS = [
  'paciente_tipo_documento',
  'paciente_nombre_completo',
  'paciente_edad',
  'paciente_sexo',
  'boletin_nombre_apellido',
  'boletin_edad',
  'boletin_sexo',
]

let adminCookie: string
let contratosCookie: string
let gerontoCookie: string
let cargoId: number
let empId: number
let periodoId: number
let createdEmp = false

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/auth/login`, { data: { email, password } })
  expect(resp.status(), `login ${email}`).toBe(200)
  return resp.headers()['set-cookie']
}

function itemIds(definition: any): string[] {
  return (definition?.sections || []).flatMap((s: any) => (s.items || []).map((i: any) => i.id))
}

test.describe.configure({ mode: 'serial' })

test.describe('Staging QA — qa-session-aug-17', () => {
  test.beforeAll(async ({ request }) => {
    test.skip(!ADMIN_PASSWORD || !CONTRATOS_PASSWORD || !GERONTO_PASSWORD, 'QA passwords required')
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)
    gerontoCookie = await login(request, GERONTO_EMAIL, GERONTO_PASSWORD)

    const cargos = await request.get(`${API}/empresa/cargos`, { headers: { Cookie: adminCookie } })
    expect(cargos.status()).toBe(200)
    cargoId = (await cargos.json()).data[0].id

    const create = await request.post(`${API}/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'STG',
        apellido: 'QAUG17',
        tipoDocumento: 'CC',
        numeroDocumento: `91${Date.now().toString().slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1990-01-15',
      },
    })
    expect(create.status(), await create.text()).toBe(201)
    empId = (await create.json()).data.id
    createdEmp = true

    const contrato = await request.post(`${API}/nomina/employees/${empId}/contratos`, {
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
    expect(contrato.status(), await contrato.text()).toBe(201)
  })

  test.afterAll(async ({ request }) => {
    if (!adminCookie || !empId || !createdEmp) return
    await request.put(`${API}/employees/${empId}/unlock`, { headers: { Cookie: adminCookie } }).catch(() => {})
    await request.delete(`${API}/employees/${empId}`, { headers: { Cookie: adminCookie } }).catch(() => {})
  })

  test('R1) GET /employees?estado=ACTIVO returns only ACTIVO', async ({ request }) => {
    const r = await request.get(`${API}/employees?estado=ACTIVO&limit=50`, {
      headers: { Cookie: contratosCookie },
    })
    expect(r.status()).toBe(200)
    const body = await r.json()
    for (const e of body.data || []) {
      expect(e.estado).toBe('ACTIVO')
    }
  })

  test('R2) CONTRATOS GET cargos 200; POST 403; GERONTOLOGA GET 403', async ({ request }) => {
    const get = await request.get(`${API}/empresa/cargos`, { headers: { Cookie: contratosCookie } })
    expect(get.status()).toBe(200)
    expect((await get.json()).data.length).toBeGreaterThan(0)

    const post = await request.post(`${API}/empresa/cargos`, {
      headers: { Cookie: contratosCookie },
      data: { nombre: 'QA-SHOULD-FAIL' },
    })
    expect(post.status()).toBe(403)
    expect((await post.json()).code).toBe('DOMAIN_FORBIDDEN')

    const g = await request.get(`${API}/empresa/cargos`, { headers: { Cookie: gerontoCookie } })
    expect(g.status()).toBe(403)
  })

  test('R3) FIJO POST stores bonos; total = V+B; aportes not added', async ({ request }) => {
    const r = await request.post(`${API}/nomina/periodos`, {
      headers: { Cookie: contratosCookie },
      data: {
        empleadoId: empId,
        periodo: '2026-10',
        tipoContrato: 'TERMINO_FIJO',
        valorMensual: 2000000,
        bonos: 150000,
        aportesSociales: 100000,
      },
    })
    expect(r.status(), await r.text()).toBe(201)
    const data = (await r.json()).data
    periodoId = data.id
    expect(Number(data.bonos)).toBe(150000)
    expect(Number(data.aportesSociales)).toBe(100000)
    expect(Number(data.totalPagado)).toBe(2150000)
    expect(Number(data.subtotalCalculado)).toBe(2150000)
  })

  test('R3) bonos > 0 on OBRA periodo → 400 field bonos', async ({ request }) => {
    const emp2 = await request.post(`${API}/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'STG',
        apellido: 'OBRA17',
        tipoDocumento: 'CC',
        numeroDocumento: `92${Date.now().toString().slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1991-02-02',
      },
    })
    expect(emp2.status()).toBe(201)
    const id2 = (await emp2.json()).data.id
    const ctr = await request.post(`${API}/nomina/employees/${id2}/contratos`, {
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
    expect(ctr.status(), await ctr.text()).toBe(201)
    const r = await request.post(`${API}/nomina/periodos`, {
      headers: { Cookie: adminCookie },
      data: {
        empleadoId: id2,
        periodo: '2026-10',
        tipoContrato: 'OBRA_O_LABOR',
        valorMensual: 1800000,
        bonos: 10000,
        archivos: [{ tipoArchivo: 'CUENTA_COBRO', nombre: 'cc.pdf', url: 'https://example.com/cc.pdf' }],
      },
    })
    expect(r.status(), await r.text()).toBe(400)
    expect((await r.json()).field).toBe('bonos')
    await request.delete(`${API}/employees/${id2}`, { headers: { Cookie: adminCookie } }).catch(() => {})
  })

  test('R4) locked empleado → CONTRATOS POST periodos 403 EMPLOYEE_LOCKED', async ({ request }) => {
    const lock = await request.put(`${API}/employees/${empId}/lock`, { headers: { Cookie: adminCookie } })
    expect(lock.status()).toBe(200)
    const r = await request.post(`${API}/nomina/periodos`, {
      headers: { Cookie: contratosCookie },
      data: {
        empleadoId: empId,
        periodo: '2026-11',
        tipoContrato: 'TERMINO_FIJO',
        valorMensual: 2000000,
      },
    })
    expect(r.status()).toBe(403)
    expect((await r.json()).code).toBe('EMPLOYEE_LOCKED')
    await request.put(`${API}/employees/${empId}/unlock`, { headers: { Cookie: adminCookie } })
  })

  test('R5) SIGNOS + BOLETIN v2 have no patient personal fields', async ({ request }) => {
    for (const codigo of ['SIGNOS_VITALES', 'BOLETIN_ANUAL']) {
      const r = await request.get(`${API}/instruments/${codigo}/definition`, {
        headers: { Cookie: adminCookie },
      })
      expect(r.status(), codigo).toBe(200)
      const body = await r.json()
      const def = body?.data?.version?.definition || body?.data?.definition || body?.data
      const ids = itemIds(def)
      for (const bad of PERSONAL_FIELD_IDS) {
        expect(ids, `${codigo} must not include ${bad}`).not.toContain(bad)
      }
    }
  })

  test('R6) ADMIN GET actividades 200; GERONTOLOGA/CONTRATOS POST 403', async ({ request }) => {
    const g = await request.get(`${API}/actividades`, { headers: { Cookie: adminCookie } })
    expect(g.status()).toBe(200)

    const ger = await request.post(`${API}/actividades`, {
      headers: { Cookie: gerontoCookie },
      data: { fecha: '2026-08-18', texto: 'no' },
    })
    expect(ger.status()).toBe(403)

    const ctr = await request.post(`${API}/actividades`, {
      headers: { Cookie: contratosCookie },
      data: { fecha: '2026-08-18', texto: 'no' },
    })
    expect(ctr.status()).toBe(403)
  })

  test('R6) POST /users PROFESORES + linked empleado can POST own today activity', async ({ request }) => {
    const stamp = Date.now()
    const emp = await request.post(`${API}/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'STG',
        apellido: 'PROF17',
        tipoDocumento: 'CC',
        numeroDocumento: `93${String(stamp).slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1992-03-03',
      },
    })
    expect(emp.status(), await emp.text()).toBe(201)
    const linkedEmpId = (await emp.json()).data.id
    const email = `qa-profesor-tmp-${stamp}@miempresa.com`
    const u = await request.post(`${API}/users`, {
      headers: { Cookie: adminCookie },
      data: {
        email,
        password: 'password123',
        rol: 'EMPLEADO',
        nombre: 'QA',
        apellido: 'Profesor',
        tipoEmpleado: 'PROFESORES',
        empleadoId: linkedEmpId,
      },
    })
    expect(u.status(), await u.text()).toBe(201)
    const user = (await u.json()).data
    expect(user.tipoEmpleado).toBe('PROFESORES')
    const cookie = await login(request, email, 'password123')
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
    const post = await request.post(`${API}/actividades`, {
      headers: { Cookie: cookie },
      data: { fecha: today, texto: 'QA staging activity' },
    })
    expect(post.status(), await post.text()).toBe(201)
    expect(Number((await post.json()).data.empleadoId)).toBe(linkedEmpId)
    const past = await request.post(`${API}/actividades`, {
      headers: { Cookie: cookie },
      data: { fecha: '2026-01-01', texto: 'past' },
    })
    expect(past.status()).toBe(403)
    await request.delete(`${API}/employees/${linkedEmpId}`, { headers: { Cookie: adminCookie } }).catch(() => {})
  })
})
