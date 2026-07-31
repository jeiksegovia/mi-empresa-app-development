import { test, expect } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

/**
 * fixes-jul-22 R3/R4 — patient estado API smoke.
 *
 * Run against the local backend:
 *   TEST_API_URL=http://localhost:3101 npx playwright test \
 *     tests/patients/patient-estado-rbac.spec.ts
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const connectionString = process.env.DATABASE_URL
  ?? 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const PASSWORD = 'qa-patient-estado-2026-07-22'
const USERS = {
  admin: 'qa-patient-estado-admin@miempresa.local',
  gerontologa: 'qa-patient-estado-gerontologa@miempresa.local',
  contratos: 'qa-patient-estado-contratos@miempresa.local',
  plainEmpleado: 'qa-patient-estado-empleado@miempresa.local',
} as const

async function ensureUser(
  email: string,
  rol: 'ADMIN' | 'EMPLEADO',
  tipoEmpleado: 'GERONTOLOGA' | 'CONTRATOS' | null,
): Promise<void> {
  const password = await bcrypt.hash(PASSWORD, 10)
  await prisma.usuario.upsert({
    where: { email },
    update: { password, rol, tipoEmpleado, activo: true },
    create: {
      email,
      password,
      rol,
      tipoEmpleado,
      nombre: 'QA',
      apellido: 'Estado Paciente',
      activo: true,
    },
  })
}

async function login(request: any, email: string): Promise<string> {
  const response = await request.post(`${API_BASE}/api/v1/auth/login`, {
    data: { email, password: PASSWORD },
  })
  expect(response.status(), `login ${email}`).toBe(200)
  const cookie = response.headers()['set-cookie']
  expect(cookie, `session cookie ${email}`).toBeTruthy()
  return cookie
}

function authHeaders(token: string): Record<string, string> {
  return { Cookie: token }
}

test.describe.configure({ mode: 'serial' })

test.describe('fixes-jul-22 — patient estado RBAC', () => {
  let adminCookie: string
  let gerontologaCookie: string
  let contratosCookie: string
  let plainEmpleadoCookie: string
  let patientId: number | undefined

  test.beforeAll(async ({ request }) => {
    await ensureUser(USERS.admin, 'ADMIN', null)
    await ensureUser(USERS.gerontologa, 'EMPLEADO', 'GERONTOLOGA')
    await ensureUser(USERS.contratos, 'EMPLEADO', 'CONTRATOS')
    await ensureUser(USERS.plainEmpleado, 'EMPLEADO', null)

    adminCookie = await login(request, USERS.admin)
    gerontologaCookie = await login(request, USERS.gerontologa)
    contratosCookie = await login(request, USERS.contratos)
    plainEmpleadoCookie = await login(request, USERS.plainEmpleado)
  })

  test.afterAll(async () => {
    if (patientId !== undefined) {
      await prisma.cliente.deleteMany({ where: { id: patientId } })
    }
    const emails = Object.values(USERS)
    const userRows = await prisma.usuario.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    })
    await prisma.sesion.deleteMany({
      where: { usuarioId: { in: userRows.map((user) => user.id) } },
    })
    await prisma.usuario.deleteMany({ where: { email: { in: emails } } })
    await prisma.$disconnect()
  })

  test('CONTRATOS create ignores INACTIVO and persists ACTIVO', async ({ request }) => {
    const documentNumber = `J22-${Date.now()}`
    const response = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: authHeaders(contratosCookie),
      data: {
        nombre: 'QA ESTADO CONTRATOS',
        tipoDocumento: 'CC',
        numeroDocumento: documentNumber,
        fechaNacimiento: '1950-01-01',
        genero: 'FEMENINO',
        estado: 'INACTIVO',
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.data.estado).toBe('ACTIVO')
    patientId = body.data.id

    const persisted = await prisma.cliente.findUnique({ where: { id: patientId } })
    expect(persisted?.estado).toBe('ACTIVO')
  })

  test('CONTRATOS cannot update estado (create-only domain)', async ({ request }) => {
    expect(patientId).toBeDefined()
    const response = await request.put(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: authHeaders(contratosCookie),
      data: { estado: 'INACTIVO' },
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('DOMAIN_FORBIDDEN')
  })

  test('plain EMPLEADO receives exact PATIENT_STATE_FORBIDDEN envelope without modifying patient', async ({ request }) => {
    expect(patientId).toBeDefined()
    const before = await prisma.cliente.findUniqueOrThrow({ where: { id: patientId } })
    const response = await request.put(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: authHeaders(plainEmpleadoCookie),
      data: { nombre: 'SHOULD NOT PERSIST', estado: before.estado },
    })

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body).toEqual({
      success: false,
      message: 'Solo ADMIN o GERONTOLOGA pueden cambiar el estado del paciente',
      code: 'PATIENT_STATE_FORBIDDEN',
    })
    const after = await prisma.cliente.findUniqueOrThrow({ where: { id: patientId } })
    expect(after.nombre).toBe(before.nombre)
    expect(after.estado).toBe(before.estado)
  })

  test('GERONTOLOGA can set estado INACTIVO', async ({ request }) => {
    expect(patientId).toBeDefined()
    const response = await request.put(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: authHeaders(gerontologaCookie),
      data: { estado: 'INACTIVO' },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.data.estado).toBe('INACTIVO')
  })

  test('ADMIN can set estado ACTIVO', async ({ request }) => {
    expect(patientId).toBeDefined()
    const response = await request.put(`${API_BASE}/api/v1/patients/${patientId}`, {
      headers: authHeaders(adminCookie),
      data: { estado: 'ACTIVO' },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.data.estado).toBe('ACTIVO')
  })
})
