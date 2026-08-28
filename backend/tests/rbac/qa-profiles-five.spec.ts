/**
 * qa-profiles-five.spec.ts — canonical 5 QA accounts (aug-27).
 *
 * Asserts the shared seed-qa.ts / prisma/seed.ts identities work locally:
 *   qa-admin       ADMIN / null
 *   qa-gerontologa EMPLEADO / GERONTOLOGA
 *   qa-contratos   EMPLEADO / CONTRATOS
 *   qa-profesor    EMPLEADO / PROFESORES  (linked empleado)
 *   qa-auxiliar    EMPLEADO / AUXILIARES  (linked empleado)
 *
 * Matrix smoke for the two new profiles (PROFESORES / AUXILIARES):
 *   pacientes read-only, empleados forbidden, actividades create-only today.
 *
 * Local passwords default to password123 (db:seed / seed-qa.ts). Staging
 * overrides via QA_*_PASSWORD from SSM (get-qa-creds.sh).
 */

import { test, expect } from '@playwright/test'

const API = process.env.TEST_API_URL || 'http://localhost:3101'

const ADMIN = {
  email: process.env.QA_ADMIN_EMAIL || 'qa-admin@miempresa.com',
  password: process.env.QA_ADMIN_PASSWORD || 'password123',
}
const GERONTO = {
  email: process.env.QA_GERONTOLOGA_EMAIL || 'qa-gerontologa@miempresa.com',
  password: process.env.QA_GERONTOLOGA_PASSWORD || 'password123',
}
const CONTRATOS = {
  email: process.env.QA_CONTRATOS_EMAIL || 'qa-contratos@miempresa.com',
  password: process.env.QA_CONTRATOS_PASSWORD || 'password123',
}
const PROFESOR = {
  email: process.env.QA_PROFESOR_EMAIL || 'qa-profesor@miempresa.com',
  password: process.env.QA_PROFESOR_PASSWORD || 'password123',
}
const AUXILIAR = {
  email: process.env.QA_AUXILIAR_EMAIL || 'qa-auxiliar@miempresa.com',
  password: process.env.QA_AUXILIAR_PASSWORD || 'password123',
}

async function login(request: any, email: string, password: string): Promise<{ cookie: string; user: any }> {
  const resp = await request.post(`${API}/api/v1/auth/login`, { data: { email, password } })
  expect(resp.status(), `login ${email}: ${await resp.text()}`).toBe(200)
  const body = await resp.json()
  return { cookie: resp.headers()['set-cookie'], user: body.user }
}

function todayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

test.describe.configure({ mode: 'serial' })

test.describe('Canonical 5 QA profiles (login + PROFESORES/AUXILIARES ACL)', () => {
  let adminCookie: string
  let profesorCookie: string
  let auxiliarCookie: string
  let contratosCookie: string
  let profesorEmpId: number
  let auxiliarEmpId: number

  test('login: 5 profiles return expected rol + tipoEmpleado', async ({ request }) => {
    const admin = await login(request, ADMIN.email, ADMIN.password)
    expect(admin.user.rol).toBe('ADMIN')
    expect(admin.user.tipoEmpleado ?? null).toBeNull()
    adminCookie = admin.cookie

    const geronto = await login(request, GERONTO.email, GERONTO.password)
    expect(geronto.user.rol).toBe('EMPLEADO')
    expect(geronto.user.tipoEmpleado).toBe('GERONTOLOGA')

    const contratos = await login(request, CONTRATOS.email, CONTRATOS.password)
    expect(contratos.user.rol).toBe('EMPLEADO')
    expect(contratos.user.tipoEmpleado).toBe('CONTRATOS')
    contratosCookie = contratos.cookie

    const profesor = await login(request, PROFESOR.email, PROFESOR.password)
    expect(profesor.user.rol).toBe('EMPLEADO')
    expect(profesor.user.tipoEmpleado).toBe('PROFESORES')
    expect(profesor.user.empleadoId, 'qa-profesor must be linked to an empleado').toBeTruthy()
    profesorCookie = profesor.cookie
    profesorEmpId = Number(profesor.user.empleadoId)

    const auxiliar = await login(request, AUXILIAR.email, AUXILIAR.password)
    expect(auxiliar.user.rol).toBe('EMPLEADO')
    expect(auxiliar.user.tipoEmpleado).toBe('AUXILIARES')
    expect(auxiliar.user.empleadoId, 'qa-auxiliar must be linked to an empleado').toBeTruthy()
    auxiliarCookie = auxiliar.cookie
    auxiliarEmpId = Number(auxiliar.user.empleadoId)
  })

  test('PROFESORES: pacientes GET 200, POST 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/patients?limit=1`, {
      headers: { Cookie: profesorCookie },
    })
    expect(list.status(), await list.text()).toBe(200)

    const create = await request.post(`${API}/api/v1/patients`, {
      headers: { Cookie: profesorCookie },
      data: {
        nombre: 'PROFE-BLOCKED',
        tipoDocumento: 'CC',
        numeroDocumento: `88${Date.now()}`.slice(0, 12),
        fechaNacimiento: '1950-01-01',
        genero: 'M',
      },
    })
    expect(create.status()).toBe(403)
    expect((await create.json()).code).toBe('DOMAIN_FORBIDDEN')
  })

  test('AUXILIARES: pacientes GET 200, POST 403 DOMAIN_FORBIDDEN', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/patients?limit=1`, {
      headers: { Cookie: auxiliarCookie },
    })
    expect(list.status(), await list.text()).toBe(200)

    const create = await request.post(`${API}/api/v1/patients`, {
      headers: { Cookie: auxiliarCookie },
      data: {
        nombre: 'AUX-BLOCKED',
        tipoDocumento: 'CC',
        numeroDocumento: `89${Date.now()}`.slice(0, 12),
        fechaNacimiento: '1950-01-01',
        genero: 'M',
      },
    })
    expect(create.status()).toBe(403)
    expect((await create.json()).code).toBe('DOMAIN_FORBIDDEN')
  })

  test('PROFESORES + AUXILIARES: empleados / certificados → 403', async ({ request }) => {
    for (const [label, cookie] of [
      ['profesor', profesorCookie],
      ['auxiliar', auxiliarCookie],
    ] as const) {
      for (const path of ['/employees?limit=1', '/certificates?limit=1']) {
        const r = await request.get(`${API}/api/v1${path}`, { headers: { Cookie: cookie } })
        expect(r.status(), `${label} GET ${path}`).toBe(403)
        expect((await r.json()).code).toBe('DOMAIN_FORBIDDEN')
      }
    }
  })

  // aug-28: GET /empresa (root) is open to every authenticated role now —
  // PROFESORES/AUXILIARES get 200 with the public subset (nombre/nit/direccion),
  // not the ADMIN-only telefono/email/limitarFechaContratos fields.
  test('PROFESORES + AUXILIARES: GET /empresa → 200, public fields only', async ({ request }) => {
    for (const [label, cookie] of [
      ['profesor', profesorCookie],
      ['auxiliar', auxiliarCookie],
    ] as const) {
      const r = await request.get(`${API}/api/v1/empresa`, { headers: { Cookie: cookie } })
      expect(r.status(), `${label} GET /empresa`).toBe(200)
      const body = await r.json()
      if (body.data === null) continue
      expect(body.data, `${label} data`).toHaveProperty('nombre')
      expect(body.data, `${label} must not see telefono`).not.toHaveProperty('telefono')
      expect(body.data, `${label} must not see email`).not.toHaveProperty('email')
    }
  })

  test('PROFESORES: POST own today actividad → 201; past date → 403', async ({ request }) => {
    const today = todayBogota()
    const post = await request.post(`${API}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: today, texto: `qa-profesor ${Date.now()}` },
    })
    // 201 first time today; 409 if a leftover row exists from a prior run.
    const status = post.status()
    expect([201, 409], await post.text()).toContain(status)
    if (status === 201) {
      expect(Number((await post.json()).data.empleadoId)).toBe(profesorEmpId)
    }
    const past = await request.post(`${API}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: '2026-01-01', texto: 'past' },
    })
    expect(past.status()).toBe(403)
  })

  test('AUXILIARES: POST own today actividad → 201 or 409', async ({ request }) => {
    const today = todayBogota()
    const post = await request.post(`${API}/api/v1/actividades`, {
      headers: { Cookie: auxiliarCookie },
      data: { fecha: today, texto: `qa-auxiliar ${Date.now()}` },
    })
    const status = post.status()
    expect([201, 409], await post.text()).toContain(status)
    if (status === 201) {
      expect(Number((await post.json()).data.empleadoId)).toBe(auxiliarEmpId)
    }
  })

  test('CONTRATOS certificados remain GET-ok (F1 read-only, not this matrix row)', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/certificates?limit=1`, {
      headers: { Cookie: contratosCookie },
    })
    expect(list.status(), await list.text()).toBe(200)
  })

  test('ADMIN can still list users (sanity)', async ({ request }) => {
    const list = await request.get(`${API}/api/v1/users`, {
      headers: { Cookie: adminCookie },
    })
    expect(list.status(), await list.text()).toBe(200)
    const emails = ((await list.json()).data || []).map((u: any) => u.email)
    for (const email of [ADMIN.email, GERONTO.email, CONTRATOS.email, PROFESOR.email, AUXILIAR.email]) {
      expect(emails, `missing ${email}`).toContain(email)
    }
  })
})
