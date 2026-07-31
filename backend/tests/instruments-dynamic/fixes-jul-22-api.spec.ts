import { test, expect } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'
import bcrypt from 'bcryptjs'

/**
 * fixes-jul-22 R8–R16 API smoke.
 *
 * Prerequisite: apply `npm run instruments:upgrade` to the local dev DB, then
 * run the backend on TEST_API_URL.
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const connectionString = process.env.DATABASE_URL
  ?? 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev'
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const EMAIL = 'qa-fixes-jul-22-instruments@miempresa.local'
const PASSWORD = 'qa-fixes-jul-22-instruments'

interface Definition {
  codigo: string
  version: number
  sections: Array<{
    id: string
    subtotal?: { max?: number }
    items: Array<{
      id: string
      type: string
      required: boolean
      cellInput?: string
      options?: Array<{ value: string; score: number | null }>
      constraints?: { min?: number; max?: number }
      rows?: Array<{ id: string }>
      columns?: Array<{ id: string }>
    }>
  }>
  scoring: { total: 'sum' | 'none'; resultEvaluation: unknown[] }
}

function authHeaders(token: string): Record<string, string> {
  return { Cookie: token }
}

function findItem(definition: Definition, itemId: string) {
  return definition.sections.flatMap((section) => section.items)
    .find((item) => item.id === itemId)
}

function maxScoredAnswers(definition: Definition): Record<string, string> {
  const respuestas: Record<string, string> = {}
  for (const item of definition.sections.flatMap((section) => section.items)) {
    if (item.type !== 'single-select-scored') continue
    const options = item.options?.filter(
      (option): option is { value: string; score: number } => typeof option.score === 'number',
    ) ?? []
    const maximum = options.reduce((best, option) => (
      option.score > best.score ? option : best
    ))
    respuestas[item.id] = maximum.value
  }
  return respuestas
}

function requiredInfoAnswers(definition: Definition): Record<string, string | number> {
  const respuestas: Record<string, string | number> = {}
  for (const item of definition.sections.flatMap((section) => section.items)) {
    if (!item.required) continue
    if (item.type === 'text-info') {
      respuestas[item.id] = 'Dato de prueba'
    } else if (item.type === 'number-info') {
      respuestas[item.id] = item.constraints?.min ?? 0
    } else if (item.type === 'single-select-info') {
      respuestas[item.id] = item.options?.[0]?.value ?? ''
    }
  }
  return respuestas
}

function mnaTextPayload(definition: Definition): Record<string, unknown> {
  const cribaje = definition.sections.find((section) => section.id === 'cribaje')!
  const respuestas: Record<string, unknown> = {}
  for (const item of cribaje.items) {
    if (item.type === 'number-info') {
      respuestas[item.id] = item.id === 'f1_peso' ? 70 : 165
      continue
    }
    if (item.type === 'single-select-scored') {
      const options = item.options?.filter(
        (option): option is { value: string; score: number } => typeof option.score === 'number',
      ) ?? []
      respuestas[item.id] = options.reduce((best, option) => (
        option.score > best.score ? option : best
      )).value
    }
  }

  const frequency = findItem(definition, 'frecuencia_grupos')!
  respuestas.frecuencia_grupos = frequency.rows!.flatMap((row) => (
    frequency.columns!.map((column) => ({
      rowId: row.id,
      columnId: column.id,
      value: column.id === 'diario' ? `${row.id}: 2 porciones` : '',
    }))
  ))
  return respuestas
}

test.describe.configure({ mode: 'serial' })

test.describe('fixes-jul-22 — instrument API smokes', () => {
  let token: string
  let userId: number | undefined
  let patientId: number | undefined
  let clonedInstrumentId: number | undefined
  const fichaIds: number[] = []
  const instrumentIds: Record<string, number> = {}
  const definitions: Record<string, Definition> = {}

  test.beforeAll(async ({ request }) => {
    const password = await bcrypt.hash(PASSWORD, 10)
    const user = await prisma.usuario.upsert({
      where: { email: EMAIL },
      update: { password, rol: 'ADMIN', tipoEmpleado: null, activo: true },
      create: {
        email: EMAIL,
        password,
        rol: 'ADMIN',
        tipoEmpleado: null,
        nombre: 'QA',
        apellido: 'Fixes Jul 22',
        activo: true,
      },
    })
    userId = user.id

    const login = await request.post(`${API_BASE}/api/v1/auth/login`, {
      data: { email: EMAIL, password: PASSWORD },
    })
    expect(login.status()).toBe(200)
    token = login.headers()['set-cookie']
    expect(token).toBeTruthy()

    const patient = await request.post(`${API_BASE}/api/v1/patients`, {
      headers: authHeaders(token),
      data: {
        nombre: 'QA INSTRUMENTOS JUL 22',
        tipoDocumento: 'CC',
        numeroDocumento: `J22I-${Date.now()}`,
        fechaNacimiento: '1950-01-01',
        genero: 'FEMENINO',
      },
    })
    expect(patient.status()).toBe(201)
    patientId = (await patient.json()).data.id

    for (const codigo of ['TINETTI', 'MNA_CUADRO', 'VALORACION_INTEGRAL']) {
      const row = await prisma.instrumento.findUnique({
        where: { codigo },
        include: {
          versiones: { where: { activo: true }, take: 1, orderBy: { version: 'desc' } },
        },
      })
      expect(row, `${codigo} Instrumento row`).toBeTruthy()
      expect(row!.versiones, `${codigo} active version`).toHaveLength(1)
      instrumentIds[codigo] = row!.id
      definitions[codigo] = row!.versiones[0].definition as unknown as Definition
    }
  })

  test.afterAll(async () => {
    if (fichaIds.length > 0) {
      await prisma.registroFichaCompletada.deleteMany({ where: { id: { in: fichaIds } } })
    }
    if (clonedInstrumentId !== undefined) {
      await prisma.instrumentoVersion.deleteMany({ where: { instrumentoId: clonedInstrumentId } })
      await prisma.instrumento.deleteMany({ where: { id: clonedInstrumentId } })
    }
    if (patientId !== undefined) {
      await prisma.cliente.deleteMany({ where: { id: patientId } })
    }
    if (userId !== undefined) {
      await prisma.sesion.deleteMany({ where: { usuarioId: userId } })
      await prisma.usuario.deleteMany({ where: { id: userId } })
    }
    await prisma.$disconnect()
  })

  test('definition endpoints expose TINETTI v2, MNA v2, and VALORACION v1', async ({ request }) => {
    const expectedVersions: Record<string, number> = {
      TINETTI: 2,
      MNA_CUADRO: 2,
      VALORACION_INTEGRAL: 1,
    }
    for (const codigo of Object.keys(expectedVersions)) {
      const response = await request.get(
        `${API_BASE}/api/v1/instruments/${codigo}/definition`,
        { headers: authHeaders(token) },
      )
      expect(response.status(), codigo).toBe(200)
      const body = await response.json()
      expect(body.data.version.version, codigo).toBe(expectedVersions[codigo])
      expect(body.data.version.definition.codigo, codigo).toBe(codigo)
    }

    expect(findItem(definitions.TINETTI, 'eq_vuelta_360')?.options).toHaveLength(4)
    expect(findItem(definitions.TINETTI, 'ma_pie_derecho')?.options).toHaveLength(4)
    expect(findItem(definitions.TINETTI, 'ma_pie_izquierdo')?.options).toHaveLength(4)
    expect(findItem(definitions.MNA_CUADRO, 'frecuencia_grupos')?.cellInput).toBe('text')
    expect(definitions.VALORACION_INTEGRAL.scoring.total).toBe('none')
  })

  test('templateCodigo VALORACION_INTEGRAL creates an active informational copy', async ({ request }) => {
    const codigo = `QA_VAL_INT_${Date.now()}`
    const response = await request.post(`${API_BASE}/api/v1/instruments`, {
      headers: authHeaders(token),
      data: {
        nombreInstrumento: 'QA valoración integral copiada',
        codigo,
        descripcion: 'Copia de prueba Jul-22',
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO',
        templateCodigo: 'VALORACION_INTEGRAL',
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    clonedInstrumentId = body.data.id
    expect(body.data.activeVersion).toMatchObject({ version: 1, activo: true })

    const created = await prisma.instrumento.findUnique({
      where: { id: clonedInstrumentId },
      include: { versiones: { where: { activo: true } } },
    })
    expect(created?.versiones).toHaveLength(1)
    const definition = created!.versiones[0].definition as unknown as Definition
    expect(definition.codigo).toBe(codigo)
    expect(definition.version).toBe(1)
    expect(definition.sections).toHaveLength(11)
    expect(definition.scoring.total).toBe('none')
  })

  test('TINETTI v2 max answers persist total 27', async ({ request }) => {
    const response = await request.post(
      `${API_BASE}/api/v1/patients/${patientId}/fichas`,
      {
        headers: authHeaders(token),
        data: {
          instrumentoId: instrumentIds.TINETTI,
          respuestas: maxScoredAnswers(definitions.TINETTI),
        },
      },
    )

    expect(response.status()).toBe(201)
    const body = await response.json()
    fichaIds.push(body.data.id)
    expect(body.data).toMatchObject({
      estado: 'COMPLETADO',
      puntajeTotal: 27,
      clasificacion: 'Riesgo bajo',
      subtotales: { equilibrio: 15, marcha: 12 },
    })
  })

  test('MNA v2 persists 28 free-text frequency cells', async ({ request }) => {
    const respuestas = mnaTextPayload(definitions.MNA_CUADRO)
    const response = await request.post(
      `${API_BASE}/api/v1/patients/${patientId}/fichas`,
      {
        headers: authHeaders(token),
        data: {
          instrumentoId: instrumentIds.MNA_CUADRO,
          respuestas,
        },
      },
    )

    expect(response.status()).toBe(201)
    const body = await response.json()
    fichaIds.push(body.data.id)
    expect(body.data.estado).toBe('COMPLETADO')
    expect(body.data.instrumentoVersionId).toBeTruthy()
    expect(body.data.skippedSections).toContain('evaluacion')
    expect(body.data.clasificacion).toBe('Estado nutricional normal')
    expect(body.data.respuestas.frecuencia_grupos).toHaveLength(28)
    expect(body.data.respuestas.frecuencia_grupos).toEqual(respuestas.frecuencia_grupos)

    const detail = await request.get(
      `${API_BASE}/api/v1/patients/${patientId}/fichas/${body.data.id}`,
      { headers: authHeaders(token) },
    )
    expect(detail.status()).toBe(200)
    const detailBody = await detail.json()
    expect(detailBody.data.respuestas.frecuencia_grupos).toEqual(respuestas.frecuencia_grupos)
  })

  test('VALORACION_INTEGRAL completes with informational null scoring', async ({ request }) => {
    const respuestas = requiredInfoAnswers(definitions.VALORACION_INTEGRAL)
    const response = await request.post(
      `${API_BASE}/api/v1/patients/${patientId}/fichas`,
      {
        headers: authHeaders(token),
        data: {
          instrumentoId: instrumentIds.VALORACION_INTEGRAL,
          respuestas,
        },
      },
    )

    expect(response.status()).toBe(201)
    const body = await response.json()
    fichaIds.push(body.data.id)
    expect(body.data.estado).toBe('COMPLETADO')
    expect(body.data.puntajeTotal).toBeNull()
    expect(body.data.clasificacion).toBeNull()
    expect(body.data.respuestas.diagnostico_integral).toBe('Dato de prueba')
  })
})
