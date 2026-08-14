import { test, expect } from '@playwright/test'

/**
 * Staging QA — qa-session-aug-6 followup (API against live staging).
 *
 * Confirms:
 *  1. qa-contratos can create/edit contratos for an UNLOCKED empleado.
 *  2. After ADMIN locks the empleado, qa-contratos cannot modify contratos
 *     (403 EMPLOYEE_LOCKED).
 *  3. Active SIGNOS_VITALES + BOLETIN_ANUAL definitions have NO patient
 *     personal fields (cédula/nombre/edad/sexo) — those live on paciente.
 *
 * Env:
 *   TEST_API_URL=https://miempresa-api-stg.disruptiveexp.com/api/v1
 *   QA_ADMIN_PASSWORD / QA_CONTRATOS_PASSWORD (or defaults via SSM export)
 */

const API = process.env.TEST_API_URL || 'https://miempresa-api-stg.disruptiveexp.com/api/v1'
const ADMIN_EMAIL = process.env.QA_ADMIN_EMAIL || 'qa-admin@miempresa.com'
const ADMIN_PASSWORD = process.env.QA_ADMIN_PASSWORD || process.env.QA_USER_PASSWORD || ''
const CONTRATOS_EMAIL = process.env.QA_CONTRATOS_EMAIL || 'qa-contratos@miempresa.com'
const CONTRATOS_PASSWORD = process.env.QA_CONTRATOS_PASSWORD || ''

const PERSONAL_FIELD_IDS = [
  'paciente_tipo_documento',
  'paciente_documento_otro',
  'paciente_nombre_completo',
  'paciente_edad',
  'paciente_sexo',
  'boletin_tipo_documento',
  'boletin_documento_otro',
  'boletin_numero_documento',
  'boletin_nombre_apellido',
  'boletin_edad',
  'boletin_sexo',
]

let adminCookie: string
let contratosCookie: string
let empId: number
let cargoId: number
let contratoId: number

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API}/auth/login`, { data: { email, password } })
  expect(resp.status(), `login ${email}`).toBe(200)
  return resp.headers()['set-cookie']
}

function itemIds(definition: any): string[] {
  return (definition?.sections || []).flatMap((s: any) =>
    (s.items || []).map((i: any) => i.id),
  )
}

function sectionIds(definition: any): string[] {
  return (definition?.sections || []).map((s: any) => s.id)
}

test.describe.configure({ mode: 'serial' })

test.describe('Staging QA — aug-6 followup (contratos role + instrument v2)', () => {
  test.beforeAll(async ({ request }) => {
    test.skip(!ADMIN_PASSWORD || !CONTRATOS_PASSWORD, 'QA passwords required (export from get-qa-creds.sh / SSM)')
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, CONTRATOS_PASSWORD)

    const create = await request.post(`${API}/employees`, {
      headers: { Cookie: adminCookie },
      data: {
        nombre: 'STG',
        apellido: 'QAUG6',
        tipoDocumento: 'CC',
        numeroDocumento: `88${Date.now().toString().slice(-8)}`,
        genero: 'M',
        fechaNacimiento: '1990-01-15',
      },
    })
    expect(create.status(), await create.text()).toBe(201)
    empId = (await create.json()).data.id

    // Ensure unlocked for baseline.
    await request.put(`${API}/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})

    const cargos = await request.get(`${API}/empresa/cargos`, {
      headers: { Cookie: adminCookie },
    })
    expect(cargos.status()).toBe(200)
    const list = (await cargos.json()).data
    expect(list?.length).toBeGreaterThan(0)
    cargoId = list[0].id
  })

  test.afterAll(async ({ request }) => {
    if (!adminCookie || !empId) return
    await request.put(`${API}/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
    await request.delete(`${API}/employees/${empId}`, {
      headers: { Cookie: adminCookie },
    }).catch(() => {})
  })

  test('1) qa-contratos can POST a contrato on unlocked employee', async ({ request }) => {
    const r = await request.post(`${API}/nomina/employees/${empId}/contratos`, {
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

  test('1b) qa-contratos can PUT (edit) that contrato while unlocked', async ({ request }) => {
    const r = await request.put(`${API}/nomina/employees/${empId}/contratos/${contratoId}`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 55000,
        activo: true,
      },
    })
    expect(r.status(), await r.text()).toBe(200)
    expect(Number((await r.json()).data.valorJornada)).toBe(55000)
  })

  test('2) admin locks employee → qa-contratos cannot POST/PUT contratos', async ({ request }) => {
    const lock = await request.put(`${API}/employees/${empId}/lock`, {
      headers: { Cookie: adminCookie },
    })
    expect(lock.status()).toBe(200)
    expect((await lock.json()).data.bloqueado).toBe(true)

    const post = await request.post(`${API}/nomina/employees/${empId}/contratos`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-03-01',
        fechaFin: '2026-06-30',
        cargoId,
        valorJornada: 40000,
        activo: true,
      },
    })
    expect(post.status()).toBe(403)
    expect((await post.json()).code).toBe('EMPLOYEE_LOCKED')

    const put = await request.put(`${API}/nomina/employees/${empId}/contratos/${contratoId}`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 60000,
        activo: true,
      },
    })
    expect(put.status()).toBe(403)
    expect((await put.json()).code).toBe('EMPLOYEE_LOCKED')
  })

  test('2b) after unlock, qa-contratos can edit contratos again', async ({ request }) => {
    const unlock = await request.put(`${API}/employees/${empId}/unlock`, {
      headers: { Cookie: adminCookie },
    })
    expect(unlock.status()).toBe(200)

    const r = await request.put(`${API}/nomina/employees/${empId}/contratos/${contratoId}`, {
      headers: { Cookie: contratosCookie },
      data: {
        tipoContrato: 'OPS',
        fechaInicio: '2026-01-01',
        fechaFin: '2026-12-31',
        cargoId,
        valorJornada: 52000,
        activo: true,
      },
    })
    expect(r.status(), await r.text()).toBe(200)
  })

  test('3) SIGNOS_VITALES active definition has no patient personal fields', async ({ request }) => {
    const r = await request.get(`${API}/instruments/SIGNOS_VITALES/definition`, {
      headers: { Cookie: adminCookie },
    })
    expect(r.status(), await r.text()).toBe(200)
    const body = await r.json()
    const def =
      body?.data?.version?.definition ||
      body?.data?.definition ||
      body?.data
    expect(def?.version ?? def?.codigo).toBeTruthy()
    // Prefer version field if present; structure check is the main goal.
    const secs = sectionIds(def)
    const ids = itemIds(def)
    expect(secs, 'paciente section must be gone').not.toContain('paciente')
    for (const bad of PERSONAL_FIELD_IDS) {
      expect(ids, `must not include ${bad}`).not.toContain(bad)
    }
    expect(ids).toContain('mediciones')
  })

  test('3b) BOLETIN_ANUAL active definition has no patient personal fields', async ({ request }) => {
    const r = await request.get(`${API}/instruments/BOLETIN_ANUAL/definition`, {
      headers: { Cookie: adminCookie },
    })
    expect(r.status(), await r.text()).toBe(200)
    const body = await r.json()
    const def =
      body?.data?.version?.definition ||
      body?.data?.definition ||
      body?.data
    const secs = sectionIds(def)
    const ids = itemIds(def)
    expect(secs).not.toContain('paciente')
    for (const bad of PERSONAL_FIELD_IDS) {
      expect(ids, `must not include ${bad}`).not.toContain(bad)
    }
    expect(ids).toContain('boletin_periodo_anio')
    expect(ids).toContain('boletin_psicologia')
  })
})
