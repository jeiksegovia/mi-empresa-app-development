import { test, expect, request as pwRequest } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

/**
 * fixes-jul17-2 §1 RBAC — domain-access matrix smoke spec.
 *
 * Verifies:
 *   - GERONTOLOGA: full access on {pacientes, fichas, instrumentos, notas},
 *     403 on {empleados, nomina, certificados, empresa}.
 *   - CONTRATOS: full access on {empleados, nomina, certificados},
 *     create-only on pacientes (GET list/detail + POST 2xx, PUT/PATCH/DELETE 403),
 *     403 on {fichas, instrumentos, notas, empresa}.
 *   - EMPLEADO + tipoEmpleado null: legacy zero-regression — all routes allowed.
 *
 * Users are upserted via prisma in beforeAll (idempotent — re-runnable).
 * No fixtures; auth is done via the existing /auth/login flow.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const connectionString = process.env.DATABASE_URL!
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const GERONTO_EMAIL = 'qa-gerontologa-rbac@miempresa.local'
const CONTRATOS_EMAIL = 'qa-contratos-rbac@miempresa.local'
const NULL_EMP_EMAIL = 'qa-null-empleado-rbac@miempresa.local'
const SHARED_PASSWORD = 'qa-rbac-pwd-2026-07-17'

// captured across beforeAll
let gerontoCookie: string
let contratosCookie: string
let nullEmpCookie: string
let seededPatientId: number
let seededInstrumentCodigo: string

async function login(email: string): Promise<string> {
  const r = await pwRequest.newContext({ baseURL: API_BASE })
  const res = await r.post('/api/v1/auth/login', {
    data: { email, password: SHARED_PASSWORD },
  })
  expect(res.status(), `login ${email}`).toBe(200)
  // The route sets the cookie as `session=` (the actual Set-Cookie name in
  // the response is `session`, even though the route code passes `sessionToken`
  // — pre-existing inconsistency; the middleware reads `req.cookies?.session`
  // so that's what we need to echo). Pass the whole setCookie back as the
  // Cookie header so all attrs (Max-Age, Path, HttpOnly, SameSite) are honored.
  const setCookie = res.headers()['set-cookie']
  expect(setCookie, `set-cookie for ${email}`).toBeDefined()
  return setCookie!
}

async function api(method: string, path: string, cookie: string, body?: unknown) {
  const r = await pwRequest.newContext({ baseURL: API_BASE })
  const headers: Record<string, string> = { Cookie: cookie }
  if (body) headers['Content-Type'] = 'application/json'
  return r.fetch(`${API_BASE}${path}`, {
    method,
    headers,
    data: body ? JSON.stringify(body) : undefined,
  })
}

async function ensureUser(email: string, rol: 'EMPLEADO' | 'ADMIN', tipoEmpleado: string | null) {
  const passwordHash = await bcrypt.hash(SHARED_PASSWORD, 10)
  const u = await prisma.usuario.upsert({
    where: { email },
    update: {
      password: passwordHash,
      rol,
      tipoEmpleado: tipoEmpleado as any,
      activo: true,
    },
    create: {
      email,
      password: passwordHash,
      rol,
      tipoEmpleado: tipoEmpleado as any,
      nombre: email.split('@')[0],
      apellido: 'rbac-test',
      activo: true,
    },
  })
  return u
}

async function getSeededPatient(): Promise<number> {
  // Admin login (uses the seeded dev password, not the qa-rbac SHARED_PASSWORD)
  const ctx = await pwRequest.newContext({ baseURL: API_BASE })
  const loginRes = await ctx.post('/api/v1/auth/login', {
    data: { email: 'admin@miempresa.com', password: 'password123' },
  })
  expect(loginRes.status(), 'admin login').toBe(200)
  const cookie = loginRes.headers()['set-cookie']!
  expect(cookie, 'admin cookie').toBeDefined()

  const res = await api('GET', '/api/v1/patients?limit=1', cookie)
  expect(res.status()).toBe(200)
  const body = await res.json()
  if (body.data && body.data.length > 0) return body.data[0].id
  // None — create one
  const create = await api('POST', '/api/v1/patients', cookie, {
    nombre: 'QA-RBAC-FIXTURE',
    tipoDocumento: 'CC',
    numeroDocumento: `111${Date.now()}`,
    fechaNacimiento: '1950-01-01',
    genero: 'F',
  })
  expect(create.status(), 'seed patient create').toBe(201)
  const cb = await create.json()
  return cb.data.id
}

async function getSeededInstrumentCodigo(): Promise<string> {
  // Find any instrument with an active version (one of the 6 dynamic ones).
  // BARTHEL is always seeded by db:seed.
  const r = await prisma.instrumento.findUnique({ where: { codigo: 'BARTHEL' } })
  if (!r) throw new Error('BARTHEL template not seeded — run npm run db:seed first')
  return 'BARTHEL'
}

test.describe.configure({ mode: 'serial' })

test.describe('RBAC domain-access matrix (fixes-jul17-2 §1)', () => {
  test.beforeAll(async () => {
    // 1. Ensure 3 test users (idempotent)
    await ensureUser(GERONTO_EMAIL, 'EMPLEADO', 'GERONTOLOGA')
    await ensureUser(CONTRATOS_EMAIL, 'EMPLEADO', 'CONTRATOS')
    await ensureUser(NULL_EMP_EMAIL, 'EMPLEADO', null)

    // 2. Login each
    gerontoCookie = await login(GERONTO_EMAIL)
    contratosCookie = await login(CONTRATOS_EMAIL)
    nullEmpCookie = await login(NULL_EMP_EMAIL)

    // 3. Discover fixtures (a seeded patient + a dynamic instrument codigo)
    seededPatientId = await getSeededPatient()
    seededInstrumentCodigo = await getSeededInstrumentCodigo()
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  // -------------------------------------------------------------------------
  // GERONTOLOGA — full access on pacientes/fichas/instrumentos/notas,
  // 403 on the rest.
  // -------------------------------------------------------------------------
  test('GERONTOLOGA: allowed on pacientes/fichas/instrumentos/notas', async () => {
    const checks: Array<[string, string, string?]> = [
      ['GET', '/api/v1/patients'],
      ['GET', `/api/v1/patients/${seededPatientId}`],
      ['GET', '/api/v1/instruments'],
      ['GET', `/api/v1/instruments/${seededInstrumentCodigo}/definition`],
      ['GET', '/api/v1/patients/fichas/vencimientos?days=7'],
    ]
    for (const [method, path] of checks) {
      const res = await api(method, path, gerontoCookie)
      expect([200, 201], `${method} ${path} for GERONTOLOGA`).toContain(res.status())
    }
  })

  test('GERONTOLOGA: forbidden on empleados/nomina/certificados/empresa', async () => {
    const checks: Array<[string, string]> = [
      ['GET', '/api/v1/employees'],
      ['GET', '/api/v1/nomina'],
      ['GET', '/api/v1/nomina/periodos/1'],
      ['GET', '/api/v1/certificates'],
      ['GET', '/api/v1/empresa'],
      ['GET', '/api/v1/empresa/cargos'],
    ]
    for (const [method, path] of checks) {
      const res = await api(method, path, gerontoCookie)
      expect(res.status(), `${method} ${path} for GERONTOLOGA`).toBe(403)
      const body = await res.json()
      expect(body.code, `${method} ${path} code`).toBe('DOMAIN_FORBIDDEN')
    }
  })

  // -------------------------------------------------------------------------
  // CONTRATOS — full access on empleados/nomina/certificados, create-only on
  // pacientes (GET + POST allowed; PUT/PATCH/DELETE 403).
  // -------------------------------------------------------------------------
  test('CONTRATOS: allowed on empleados/nomina/certificados', async () => {
    const checks: Array<[string, string]> = [
      ['GET', '/api/v1/employees'],
      ['GET', '/api/v1/nomina?periodo=2026-07'],
      ['GET', '/api/v1/certificates'],
    ]
    for (const [method, path] of checks) {
      const res = await api(method, path, contratosCookie)
      expect([200, 201], `${method} ${path} for CONTRATOS`).toContain(res.status())
    }
  })

  test('CONTRATOS: forbidden on fichas/instrumentos/notas/empresa', async () => {
    const checks: Array<[string, string]> = [
      ['GET', '/api/v1/instruments'],
      ['GET', `/api/v1/instruments/${seededInstrumentCodigo}/definition`],
      ['GET', '/api/v1/patients/fichas/vencimientos?days=7'],
      ['POST', `/api/v1/patients/${seededPatientId}/notes`],
      ['GET', '/api/v1/empresa'],
    ]
    for (const [method, path] of checks) {
      const res = await api(method, path, contratosCookie, {
        tipo: 'NEUTRAL',
        prioridad: 'BAJA',
        contenido: 'should 403',
        fechaIncidente: new Date().toISOString().slice(0, 10),
      })
      expect(res.status(), `${method} ${path} for CONTRATOS`).toBe(403)
    }
  })

  test('CONTRATOS: create-only on pacientes — GET list/detail + POST allowed, PUT/DELETE 403', async () => {
    // GET list/detail
    const list = await api('GET', '/api/v1/patients', contratosCookie)
    expect(list.status()).toBe(200)

    const detail = await api('GET', `/api/v1/patients/${seededPatientId}`, contratosCookie)
    expect(detail.status()).toBe(200)

    // POST allowed
    const doc = `9${Date.now()}`.slice(0, 12)
    const create = await api('POST', '/api/v1/patients', contratosCookie, {
      nombre: 'CONTRATOS-CREATED',
      tipoDocumento: 'CC',
      numeroDocumento: doc,
      fechaNacimiento: '1950-01-01',
      genero: 'M',
    })
    expect(create.status(), `POST /patients for CONTRATOS`).toBe(201)
    const created = await create.json()
    const newId: number = created.data.id

    // PUT 403 (create-only)
    const put = await api('PUT', `/api/v1/patients/${newId}`, contratosCookie, {
      nombre: 'CONTRATOS-UPDATED',
    })
    expect(put.status(), `PUT /patients/${newId} for CONTRATOS`).toBe(403)
    const putBody = await put.json()
    expect(putBody.code).toBe('DOMAIN_FORBIDDEN')

    // DELETE 403
    const del = await api('DELETE', `/api/v1/patients/${newId}`, contratosCookie)
    expect(del.status(), `DELETE /patients/${newId} for CONTRATOS`).toBe(403)

    // Cleanup (admin can hard-delete via deactivate is the existing soft-delete; skip
    // and leave a CONTRATOS-CREATED row — it's a test fixture, acceptable in dev).
    void del
  })

  // -------------------------------------------------------------------------
  // LEGACY: EMPLEADO + tipoEmpleado null — every route today still works.
  // This is the §1.3 step-4 zero-regression guarantee.
  // -------------------------------------------------------------------------
  test('EMPLEADO + null tipoEmpleado: zero regression — all routes allowed', async () => {
    const checks: Array<[string, string]> = [
      ['GET', '/api/v1/nomina?periodo=2026-07'],
      ['GET', '/api/v1/employees'],
      ['GET', '/api/v1/patients'],
      ['GET', '/api/v1/instruments'],
    ]
    for (const [method, path] of checks) {
      const res = await api(method, path, nullEmpCookie)
      expect([200, 201], `${method} ${path} for null-EMPLEADO`).toContain(res.status())
    }
  })

  // -------------------------------------------------------------------------
  // Session shape (contract §1.4) — tipoEmpleado is present in login + /me.
  // -------------------------------------------------------------------------
  test('Session payload includes tipoEmpleado (contract §1.4)', async () => {
    // /auth/me for the GERONTOLOGA user
    const me = await api('GET', '/api/v1/auth/me', gerontoCookie)
    expect(me.status()).toBe(200)
    const meBody = await me.json()
    expect(meBody.user, 'user object').toBeDefined()
    expect(meBody.user.tipoEmpleado, 'tipoEmpleado present').toBe('GERONTOLOGA')

    // And for CONTRATOS
    const me2 = await api('GET', '/api/v1/auth/me', contratosCookie)
    expect(me2.status()).toBe(200)
    const me2Body = await me2.json()
    expect(me2Body.user.tipoEmpleado).toBe('CONTRATOS')
  })
})
