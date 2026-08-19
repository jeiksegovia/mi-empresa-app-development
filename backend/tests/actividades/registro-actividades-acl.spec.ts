/**
 * registro-actividades-acl.spec.ts — qa-session-aug-17 R6 / contract §4.
 *
 * Spec-self-contained; same pattern as asistencia-rbac.spec.ts and
 * contratos-get-cargos.spec.ts. Backs the contract acceptance:
 *
 *   - ADMIN full CRUD (POST / PUT / DELETE on /actividades)
 *   - PROFESORES / AUXILIARES: own GET + POST only;
 *     today-only (America/Bogotá); PUT/DELETE 403; foreign empleadoId 403.
 *   - GERONTOLOGA / CONTRATOS: GET all allowed (read-only); POST 403.
 *   - Writer with no Usuario.empleadoId → 400 EMPLEADO_REQUIRED.
 *   - Second POST same (empleadoId, fecha) → 409 DUPLICATE_DAY.
 *
 * Idempotency: prisma in beforeAll wipes `registro_actividades` rows for the
 * two seeded empleados (Pedro id=395, Ana id=396) so the today-only POSTs
 * don't collide with rows left by previous runs / manual probes.
 */

import { test, expect } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const ADMIN_EMAIL = 'admin@miempresa.com'
const ADMIN_PASSWORD = 'password123'
const PROFESOR_EMAIL = 'profesor@miempresa.com'
const AUXILIAR_EMAIL = 'auxiliar@miempresa.com'
const GERONTOLOGA_EMAIL = 'qa-gerontologa@miempresa.com'
const CONTRATOS_EMAIL = 'qa-contratos@miempresa.com'
const SHARED_PASSWORD = 'password123'

// Cached across beforeAll
let adminCookie: string
let profesorCookie: string
let auxiliarCookie: string
let gerontologaCookie: string
let contratosCookie: string
let noEmpCookie: string

// empleadoId from seed (Pedro=395, Ana=396). Hard-coded so the test stays
// hermetic — seed.ts owns these ids.
const PROFESOR_EMPLEADO_ID = 395
const AUXILIAR_EMPLEADO_ID = 396

// One throw-away PROFESORES user with no empleadoId (for EMPLEADO_REQUIRED).
const NO_EMP_EMAIL = 'qa-profesor-no-empleado@miempresa.local'
const NO_EMP_PASSWORD = 'qa-actividades-no-emp-2026-08-18'

async function login(request: any, email: string, password: string): Promise<string> {
  const resp = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password },
  })
  if (resp.status() !== 200) {
    throw new Error(`Login failed for ${email}: ${resp.status()} ${await resp.text()}`)
  }
  return resp.headers()['set-cookie']
}

function serverTodayBogota(): string {
  return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
}

function ymdOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

test.describe.configure({ mode: 'serial' })

test.describe('Registro de actividades — ACL + behavior (qa-session-aug-17 R6)', () => {
  test.beforeAll(async ({ request }) => {
    // 1. Prisma: idempotent cleanup of any leftover rows for the seeded
    //    empleados so today-only POSTs can rerun. Also ensure the throw-away
    //    PROFESORES user with no empleadoId exists.
    const connectionString = process.env.DATABASE_URL!
    const adapter = new PrismaPg({ connectionString })
    const prisma = new PrismaClient({ adapter })
    try {
      await prisma.registroActividad.deleteMany({
        where: { empleadoId: { in: [PROFESOR_EMPLEADO_ID, AUXILIAR_EMPLEADO_ID] } },
      })
      const passwordHash = await bcrypt.hash(NO_EMP_PASSWORD, 10)
      await prisma.usuario.upsert({
        where: { email: NO_EMP_EMAIL },
        update: {
          password: passwordHash,
          rol: 'EMPLEADO',
          tipoEmpleado: 'PROFESORES',
          activo: true,
          // Explicitly NULL empleadoId so service-layer EMPLEADO_REQUIRED fires.
          empleadoId: null,
        },
        create: {
          email: NO_EMP_EMAIL,
          password: passwordHash,
          rol: 'EMPLEADO',
          tipoEmpleado: 'PROFESORES',
          nombre: 'NoEmpleado',
          apellido: 'ActivQA',
          activo: true,
          empleadoId: null,
        },
      })
    } finally {
      await prisma.$disconnect()
    }

    // 2. Login all roles. profesor/auxiliar use seeded password123.
    adminCookie = await login(request, ADMIN_EMAIL, ADMIN_PASSWORD)
    profesorCookie = await login(request, PROFESOR_EMAIL, SHARED_PASSWORD)
    auxiliarCookie = await login(request, AUXILIAR_EMAIL, SHARED_PASSWORD)
    gerontologaCookie = await login(request, GERONTOLOGA_EMAIL, SHARED_PASSWORD)
    contratosCookie = await login(request, CONTRATOS_EMAIL, SHARED_PASSWORD)
    noEmpCookie = await login(request, NO_EMP_EMAIL, NO_EMP_PASSWORD)
  })

  test.afterAll(async ({ request }) => {
    for (const cookie of [
      adminCookie,
      profesorCookie,
      auxiliarCookie,
      gerontologaCookie,
      contratosCookie,
      noEmpCookie,
    ]) {
      if (!cookie) continue
      await request.post(`${API_BASE}/api/v1/auth/logout`, {
        headers: { Cookie: cookie },
      }).catch(() => {})
    }
  })

  // -------------------------------------------------------------------------
  // ADMIN — full CRUD
  // -------------------------------------------------------------------------
  test('ADMIN: full CRUD on /actividades', async ({ request }) => {
    const today = serverTodayBogota()

    // POST for AUXILIAR (any date, any empleadoId)
    const create = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: adminCookie },
      data: { fecha: today, texto: 'admin note', empleadoId: AUXILIAR_EMPLEADO_ID },
    })
    expect(create.status(), 'ADMIN POST').toBe(201)
    const created = await create.json()
    const id: number = created.data.id
    expect(created.data.empleadoId).toBe(AUXILIAR_EMPLEADO_ID)
    expect(created.data.texto).toBe('admin note')

    // GET — should include the created row
    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: adminCookie },
    })
    expect(list.status()).toBe(200)
    const listBody = await list.json()
    expect(listBody.data.find((r: any) => r.id === id)).toBeTruthy()

    // PUT — update texto
    const update = await request.put(`${API_BASE}/api/v1/actividades/${id}`, {
      headers: { Cookie: adminCookie },
      data: { texto: 'admin updated' },
    })
    expect(update.status(), 'ADMIN PUT').toBe(200)
    const updated = await update.json()
    expect(updated.data.texto).toBe('admin updated')

    // DELETE — 204
    const del = await request.delete(`${API_BASE}/api/v1/actividades/${id}`, {
      headers: { Cookie: adminCookie },
    })
    expect(del.status(), 'ADMIN DELETE').toBe(204)
  })

  // -------------------------------------------------------------------------
  // PROFESORES — own GET + POST only; today-only; no PUT/DELETE
  // -------------------------------------------------------------------------
  test('PROFESORES: own GET + POST today 201; foreign empleadoId 403; past 403; PUT/DELETE 403', async ({
    request,
  }) => {
    const today = serverTodayBogota()
    const past = ymdOffset(-1)

    // POST today with own row → 201
    const ok = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: today, texto: 'profesor today' },
    })
    expect(ok.status(), 'PROFESORES POST today').toBe(201)
    const okBody = await ok.json()
    expect(okBody.data.empleadoId).toBe(PROFESOR_EMPLEADO_ID)

    // Duplicate POST same day → 409 DUPLICATE_DAY
    const dup = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: today, texto: 'duplicate' },
    })
    expect(dup.status(), 'PROFESORES POST duplicate').toBe(409)
    const dupBody = await dup.json()
    expect(dupBody.code).toBe('DUPLICATE_DAY')

    // POST past → 403 today-only
    const pastResp = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: past, texto: 'past' },
    })
    expect(pastResp.status(), 'PROFESORES POST past').toBe(403)
    const pastBody = await pastResp.json()
    expect(pastBody.code).toBe('DOMAIN_FORBIDDEN')

    // POST foreign empleadoId → 403
    const foreign = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
      data: { fecha: today, texto: 'foreign', empleadoId: AUXILIAR_EMPLEADO_ID },
    })
    expect(foreign.status(), 'PROFESORES POST foreign empleadoId').toBe(403)
    const foreignBody = await foreign.json()
    expect(foreignBody.code).toBe('DOMAIN_FORBIDDEN')

    // GET — must only see own rows (force filter to caller.empleadoId)
    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: profesorCookie },
    })
    expect(list.status()).toBe(200)
    const listBody = await list.json()
    for (const row of listBody.data) {
      expect(row.empleadoId, 'PROFESORES GET own-item').toBe(PROFESOR_EMPLEADO_ID)
    }

    // PUT 403 (create-only writers cannot edit)
    const put = await request.put(`${API_BASE}/api/v1/actividades/${okBody.data.id}`, {
      headers: { Cookie: profesorCookie },
      data: { texto: 'should 403' },
    })
    expect(put.status(), 'PROFESORES PUT').toBe(403)
    const putBody = await put.json()
    expect(putBody.code).toBe('DOMAIN_FORBIDDEN')

    // DELETE 403
    const del = await request.delete(`${API_BASE}/api/v1/actividades/${okBody.data.id}`, {
      headers: { Cookie: profesorCookie },
    })
    expect(del.status(), 'PROFESORES DELETE').toBe(403)
  })

  // -------------------------------------------------------------------------
  // AUXILIARES — same shape as PROFESORES
  // -------------------------------------------------------------------------
  test('AUXILIARES: own GET + POST today 201; PUT/DELETE 403', async ({ request }) => {
    const today = serverTodayBogota()

    const ok = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: auxiliarCookie },
      data: { fecha: today, texto: 'auxiliar today' },
    })
    expect(ok.status(), 'AUXILIARES POST today').toBe(201)
    const okBody = await ok.json()
    expect(okBody.data.empleadoId).toBe(AUXILIAR_EMPLEADO_ID)

    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: auxiliarCookie },
    })
    expect(list.status()).toBe(200)
    const listBody = await list.json()
    for (const row of listBody.data) {
      expect(row.empleadoId, 'AUXILIARES GET own-item').toBe(AUXILIAR_EMPLEADO_ID)
    }

    const put = await request.put(`${API_BASE}/api/v1/actividades/${okBody.data.id}`, {
      headers: { Cookie: auxiliarCookie },
      data: { texto: 'should 403' },
    })
    expect(put.status(), 'AUXILIARES PUT').toBe(403)

    const del = await request.delete(`${API_BASE}/api/v1/actividades/${okBody.data.id}`, {
      headers: { Cookie: auxiliarCookie },
    })
    expect(del.status(), 'AUXILIARES DELETE').toBe(403)
  })

  // -------------------------------------------------------------------------
  // GERONTOLOGA + CONTRATOS — read-only on /actividades
  // -------------------------------------------------------------------------
  test('GERONTOLOGA: GET 200 (all); POST 403', async ({ request }) => {
    const today = serverTodayBogota()

    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: gerontologaCookie },
    })
    expect(list.status(), 'GERONTOLOGA GET').toBe(200)
    // GERONTOLOGA is read-only — no own-item filter; should see all rows.
    const listBody = await list.json()
    expect(Array.isArray(listBody.data)).toBe(true)

    const post = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: gerontologaCookie },
      data: { fecha: today, texto: 'should 403' },
    })
    expect(post.status(), 'GERONTOLOGA POST').toBe(403)
    const postBody = await post.json()
    expect(postBody.code).toBe('DOMAIN_FORBIDDEN')
  })

  test('CONTRATOS: GET 200 (all); POST 403', async ({ request }) => {
    const today = serverTodayBogota()

    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: contratosCookie },
    })
    expect(list.status(), 'CONTRATOS GET').toBe(200)

    const post = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: contratosCookie },
      data: { fecha: today, texto: 'should 403' },
    })
    expect(post.status(), 'CONTRATOS POST').toBe(403)
    const postBody = await post.json()
    expect(postBody.code).toBe('DOMAIN_FORBIDDEN')
  })

  // -------------------------------------------------------------------------
  // EMPLEADO_REQUIRED — writer with no empleadoId → 400
  // -------------------------------------------------------------------------
  test('PROFESORES with no empleadoId: POST → 400 EMPLEADO_REQUIRED', async ({ request }) => {
    const today = serverTodayBogota()
    const resp = await request.post(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: noEmpCookie },
      data: { fecha: today, texto: 'no empleado' },
    })
    expect(resp.status(), 'POST no empleadoId').toBe(400)
    const body = await resp.json()
    expect(body.code).toBe('EMPLEADO_REQUIRED')
  })

  // -------------------------------------------------------------------------
  // GET matrix cells — sanity: GERONTOLOGA returns rows from both
  // PROFESORES and AUXILIARES seeded arriba.
  // -------------------------------------------------------------------------
  test('GERONTOLOGA GET sees both seeded empleado rows (no own-item filter)', async ({
    request,
  }) => {
    const list = await request.get(`${API_BASE}/api/v1/actividades`, {
      headers: { Cookie: gerontologaCookie },
    })
    expect(list.status()).toBe(200)
    const listBody = await list.json()
    const empleadoIds = new Set(listBody.data.map((r: any) => r.empleadoId))
    expect(empleadoIds.has(PROFESOR_EMPLEADO_ID), 'sees PROFESOR row').toBe(true)
    expect(empleadoIds.has(AUXILIAR_EMPLEADO_ID), 'sees AUXILIAR row').toBe(true)
  })
})
