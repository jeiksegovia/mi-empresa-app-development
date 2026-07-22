import { test, expect, request as pwRequest } from '@playwright/test'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../src/generated/prisma/index.js'

/**
 * fixes-jul17-2 §3.1 — POST /instruments with optional `templateCodigo`.
 *
 * Verifies:
 *   - Create from BARTHEL → new instrument has active v1 with 10 items + rewritten
 *     codigo/nombre; source BARTHEL v1 definition byte-identical pre/post
 *     (checksum).
 *   - POST a ficha against the NEW instrument → scored correctly (total=100 path).
 *   - templateCodigo absent → legacy metadata-only creation still works
 *     (activeVersion absent or null in response).
 *   - TEMPLATE_NOT_FOUND 404 when an unknown codigo is passed.
 *   - Source template rows NEVER mutated (independent checksum diff).
 */

const API_BASE = process.env.TEST_API_URL || 'http://localhost:3101'
const connectionString = process.env.DATABASE_URL ?? 'postgresql://miempresa:miempresa123@localhost:15432/miempresa_dev'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function loginAdmin(): Promise<string> {
  const ctx = await pwRequest.newContext({ baseURL: API_BASE })
  const res = await ctx.post('/api/v1/auth/login', {
    data: { email: 'admin@miempresa.com', password: 'password123' },
  })
  expect(res.status()).toBe(200)
  return res.headers()['set-cookie']!
}

async function api(method: string, path: string, cookie: string, body?: unknown) {
  const r = await pwRequest.newContext({ baseURL: API_BASE })
  const headers: Record<string, string> = { Cookie: cookie }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return r.fetch(`${API_BASE}${path}`, {
    method,
    headers,
    data: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

interface VersionDef {
  id: number
  version: number
  activo: boolean
  definition: any
}

function checksum(def: any): string {
  // Stable structural checksum (JSONB normalizes key order, so JSON.stringify
  // round-trip is unreliable). Sort object keys before hashing.
  return JSON.stringify(def, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {}
      for (const k of Object.keys(v).sort()) sorted[k] = (v as any)[k]
      return sorted
    }
    return v
  })
}

function barthelMaxAnswers(): Record<string, string> {
  return {
    comida: 'independiente',         // 10
    lavado: 'independiente',         //  5
    vestido: 'independiente',        // 10
    arreglo: 'independiente',        //  5
    deposicion: 'continente',        // 10
    miccion: 'continente',           // 10
    retrete: 'independiente',        // 10
    transferencia: 'independiente',  // 15
    deambulacion: 'independiente',   // 15
    desniveles: 'independiente',     // 10
  }
}

test.describe.configure({ mode: 'serial' })

test.describe('POST /instruments from template (fixes-jul17-2 §3.1)', () => {
  let adminCookie: string
  let barthelSourceId: number
  let barthelSourceVersionId: number
  let barthelSourceChecksum: string
  let seededPatientId: number

  test.beforeAll(async () => {
    adminCookie = await loginAdmin()

    // Capture BARTHEL source state BEFORE the create call.
    const source = await prisma.instrumento.findUnique({
      where: { codigo: 'BARTHEL' },
      include: {
        versiones: {
          where: { activo: true },
          take: 1,
          orderBy: { version: 'desc' },
        },
      },
    })
    expect(source, 'BARTHEL template seeded').toBeTruthy()
    barthelSourceId = source!.id
    const srcVer = source!.versiones[0]
    expect(srcVer, 'BARTHEL active v1').toBeTruthy()
    barthelSourceVersionId = srcVer!.id
    barthelSourceChecksum = checksum(srcVer!.definition)

    // Pick any active patient.
    const patients = await api('GET', '/api/v1/patients?limit=1', adminCookie)
    expect(patients.status()).toBe(200)
    const pbody = await patients.json()
    if (pbody.data && pbody.data.length > 0) {
      seededPatientId = pbody.data[0].id
    } else {
      const create = await api('POST', '/api/v1/patients', adminCookie, {
        nombre: 'QA-CREATE-FROM-TPL',
        tipoDocumento: 'CC',
        numeroDocumento: `7${Date.now()}`.slice(0, 12),
        fechaNacimiento: '1950-01-01',
        genero: 'F',
      })
      expect(create.status()).toBe(201)
      const cbody = await create.json()
      seededPatientId = cbody.data.id
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('TEMPLATE_NOT_FOUND when codigo does not exist (transient BARTHEL delete + restore)', async () => {
    // Zod rejects unknown codigos (e.g. 'DOES_NOT_EXIST') at the validation
    // layer with 400, so the only way to exercise the service-level
    // TEMPLATE_NOT_FOUND path is to point at a valid templateCodigo enum
    // value whose row is currently missing. Temporarily move BARTHEL's
    // codigo to a unique placeholder so the lookup misses, then restore.
    const tmpCodigo = `__TMP_BARTHEL_${Date.now()}`
    const updated = await prisma.instrumento.update({
      where: { id: barthelSourceId },
      data: { codigo: tmpCodigo },
    })
    try {
      const res = await api('POST', '/api/v1/instruments', adminCookie, {
        nombreInstrumento: 'NO-TEMPLATE',
        codigo: 'NO_TEMPLATE_X',
        tipo: 'VALORACION',
        periodicidad: 'UNICA',
        rolesPermitidos: 'ADMIN,EMPLEADO',
        templateCodigo: 'BARTHEL',
      })
      expect(res.status()).toBe(404)
      const body = await res.json()
      expect(body.code).toBe('TEMPLATE_NOT_FOUND')
    } finally {
      // Restore (regardless of test outcome)
      await prisma.instrumento.update({
        where: { id: barthelSourceId },
        data: { codigo: 'BARTHEL' },
      })
      void updated
    }
  })

  test('Create from BARTHEL → active v1 with 10 items + rewritten codigo/nombre', async () => {
    const codigo = `QA_TPL_${Date.now()}`
    const res = await api('POST', '/api/v1/instruments', adminCookie, {
      nombreInstrumento: 'QA-TPL-COPY',
      codigo,
      tipo: 'VALORACION',
      periodicidad: 'SEMESTRAL',
      rolesPermitidos: 'ADMIN,EMPLEADO',
      templateCodigo: 'BARTHEL',
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    const data = body.data

    // Response carries activeVersion
    expect(data.activeVersion).toBeDefined()
    expect(data.activeVersion.version).toBe(1)
    expect(data.activeVersion.activo).toBe(true)

    // DB invariants
    const created = await prisma.instrumento.findUnique({
      where: { id: data.id },
      include: {
        versiones: {
          where: { activo: true },
          take: 1,
          orderBy: { version: 'desc' },
        },
      },
    })
    expect(created, 'created instrumento').toBeTruthy()
    expect(created!.codigo).toBe(codigo)
    expect(created!.nombreInstrumento).toBe('QA-TPL-COPY')
    expect(created!.versiones.length).toBe(1)
    const v = created!.versiones[0]
    expect(v.version).toBe(1)
    expect(v.activo).toBe(true)
    // 10 items in BARTHEL's single section
    expect(Array.isArray(v.definition.sections)).toBe(true)
    expect(v.definition.sections.length).toBe(1)
    expect(v.definition.sections[0].items.length).toBe(10)
    // codigo / nombre / version rewritten per §3.1 step 2
    expect(v.definition.codigo).toBe(codigo)
    expect(v.definition.nombre).toBe('QA-TPL-COPY')
    expect(v.definition.version).toBe(1)
    // subtotal preserved from template
    expect(v.definition.sections[0].subtotal.max).toBe(100)
  })

  test('POST a ficha against the NEW instrument → scored 100/100', async () => {
    // Find the just-created instrument from the previous test.
    const created = await prisma.instrumento.findFirst({
      where: { codigo: { startsWith: 'QA_TPL_' } },
      orderBy: { id: 'desc' },
    })
    expect(created, 'previous instrument exists').toBeTruthy()

    const res = await api('POST', `/api/v1/patients/${seededPatientId}/fichas`, adminCookie, {
      instrumentoId: created!.id,
      versionRegistro: 'v1',
      respuestas: barthelMaxAnswers(),
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.data.estado).toBe('COMPLETADO')
    expect(body.data.puntajeTotal).toBe(100)
    expect(body.data.clasificacion).toBe('Dependencia ligera')
  })

  test('Source BARTHEL v1 definition is byte-identical (checksum unchanged)', async () => {
    const after = await prisma.instrumento.findUnique({
      where: { id: barthelSourceId },
      include: {
        versiones: {
          where: { id: barthelSourceVersionId },
          take: 1,
        },
      },
    })
    expect(after, 'source still exists').toBeTruthy()
    const v = after!.versiones[0]
    expect(v, 'source version still exists').toBeTruthy()
    expect(v.activo).toBe(true)
    expect(v.version).toBe(1)
    const afterChecksum = checksum(v.definition)
    expect(afterChecksum, 'source definition untouched').toBe(barthelSourceChecksum)
  })

  test('Without templateCodigo: legacy metadata-only creation works (no activeVersion)', async () => {
    const codigo = `QA_LEGACY_${Date.now()}`
    const res = await api('POST', '/api/v1/instruments', adminCookie, {
      nombreInstrumento: 'QA-LEGACY-NO-TPL',
      codigo,
      tipo: 'VALORACION',
      periodicidad: 'UNICA',
      rolesPermitidos: 'ADMIN,EMPLEADO',
      // no templateCodigo
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    const data = body.data

    // No activeVersion in response
    expect(data.activeVersion).toBeUndefined()

    // DB: no active InstrumentoVersion row exists
    const versions = await prisma.instrumentoVersion.findMany({
      where: { instrumentoId: data.id, activo: true },
    })
    expect(versions.length).toBe(0)
  })

  test('Cleanup: deactivate the QA_TPL_* test instruments', async () => {
    // Soft-delete (set INACTIVO) so we don't pollute future seed runs.
    const stale = await prisma.instrumento.findMany({
      where: { codigo: { startsWith: 'QA_TPL_' } },
    })
    for (const s of stale) {
      await prisma.instrumento.update({ where: { id: s.id }, data: { estado: 'INACTIVO' } })
    }
    const legacy = await prisma.instrumento.findMany({
      where: { codigo: { startsWith: 'QA_LEGACY_' } },
    })
    for (const s of legacy) {
      await prisma.instrumento.update({ where: { id: s.id }, data: { estado: 'INACTIVO' } })
    }
    // Cleanup the previous manual TEST_BARTHEL_COPY_1 we created via curl above.
    const manual = await prisma.instrumento.findMany({
      where: { codigo: { startsWith: 'TEST_BARTHEL_COPY' } },
    })
    for (const s of manual) {
      await prisma.instrumento.update({ where: { id: s.id }, data: { estado: 'INACTIVO' } })
    }
  })
})
