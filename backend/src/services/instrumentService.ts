import { getPrisma } from '../config/database.js'
import type { InstrumentDefinition } from './instrumentScoringService.js'

export interface InstrumentListParams {
  page?: number
  limit?: number
  search?: string
  tipo?: string
  estado?: 'ACTIVO' | 'INACTIVO'
}

export interface ActiveVersionSummary {
  id: number
  version: number
  activo: boolean
  createdAt: Date
}

export interface InstrumentSummary {
  id: number
  nombreInstrumento: string
  codigo: string | null
  descripcion: string | null
  tipo: string
  periodicidad: string
  rolesPermitidos: string
  estado: string
  /** W4: versionPlantilla REMOVED (file-flow gone, replaced by activeVersion). */
  fechaCreacion: Date
  totalRegistros: number
  /** W4 (§4.1): active version metadata — null if no activo=true version exists. */
  activeVersion: ActiveVersionSummary | null
}

export interface InstrumentListResult {
  data: InstrumentSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface InstrumentDetail {
  id: number
  nombreInstrumento: string
  codigo: string | null
  descripcion: string | null
  tipo: string
  periodicidad: string
  rolesPermitidos: string
  estado: string
  /** W4: plantillaArchivo REMOVED. */
  fechaCreacion: Date
  creadoPor: number
  registros: Array<{
    id: number
    clienteId: number
    estado: string
    fechaCompletado: Date | null
    fechaVencimiento: Date | null
    versionRegistro: string
    notasObservaciones: string | null
    cliente: {
      id: number
      nombre: string
      numeroDocumento: string
    }
  }>
  /** fixes-jul17-2 §3.1: present when createInstrument used templateCodigo. */
  activeVersion?: ActiveVersionSummary | null
}

export interface CreateInstrumentInput {
  nombreInstrumento: string
  codigo?: string
  descripcion?: string
  tipo: 'VALORACION' | 'NUTRICION' | 'MATRICULA' | 'ADMISION'
  periodicidad: 'UNICA' | 'ANUAL' | 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL'
  rolesPermitidos: string
  estado?: 'ACTIVO' | 'INACTIVO'
  // fixes-jul17-2 §3.1: optional template deep-copy.
  templateCodigo?: 'BARTHEL' | 'MINI_MENTAL' | 'TINETTI' | 'YESAVAGE' | 'MNA_CUADRO' | 'FICHA_NUTRICIONAL'
}

export type UpdateInstrumentInput = Partial<Omit<CreateInstrumentInput, 'templateCodigo'>>

/**
 * fixes-jul17-2 §3.1: structured error codes the route layer maps to HTTP.
 */
export type CreateFromTemplateError =
  | 'TEMPLATE_NOT_FOUND'
  | 'NO_ACTIVE_VERSION'

export class CreateInstrumentError extends Error {
  readonly code: CreateFromTemplateError
  constructor(code: CreateFromTemplateError, message: string) {
    super(message)
    this.name = 'CreateInstrumentError'
    this.code = code
  }
}

export interface RecordDetail {
  id: number
  clienteId: number
  instrumentoId: number
  estado: string
  fechaCompletado: Date | null
  fechaVencimiento: Date | null
  versionRegistro: string
  responsable: number
  /** W4: archivoCompletado REMOVED. */
  notasObservaciones: string | null
  fechaCreacionRegistro: Date
  cliente: {
    id: number
    nombre: string
    numeroDocumento: string
  }
  instrumento: {
    id: number
    nombreInstrumento: string
    tipo: string
    periodicidad: string
  }
}

export interface CreateRecordInput {
  clienteId: number
  instrumentoId: number
  estado?: 'COMPLETADO' | 'PENDIENTE' | 'VENCIDO'
  fechaCompletado?: string | Date
  fechaVencimiento?: string | Date
  versionRegistro: string
  responsable: number
  notasObservaciones?: string
}

export type UpdateRecordInput = Partial<Omit<CreateRecordInput, 'clienteId' | 'instrumentoId'>>

function calcularFechaVencimiento(periodicidad: string, desde: Date): Date | null {
  const d = new Date(desde)
  switch (periodicidad) {
    case 'MENSUAL':
      d.setMonth(d.getMonth() + 1)
      return d
    case 'TRIMESTRAL':
      d.setMonth(d.getMonth() + 3)
      return d
    case 'SEMESTRAL':
      d.setMonth(d.getMonth() + 6)
      return d
    case 'ANUAL':
      d.setFullYear(d.getFullYear() + 1)
      return d
    case 'UNICA':
    default:
      return null
  }
}

const RECORD_INCLUDE = {
  cliente: {
    select: {
      id: true,
      nombre: true,
      numeroDocumento: true,
    },
  },
  instrumento: {
    select: {
      id: true,
      nombreInstrumento: true,
      tipo: true,
      periodicidad: true,
    },
  },
}

export async function listInstruments(params: InstrumentListParams): Promise<InstrumentListResult> {
  const prisma = getPrisma()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (params.estado) {
    where.estado = params.estado
  }

  if (params.tipo) {
    where.tipo = params.tipo
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim()
    where.OR = [
      { nombreInstrumento: { contains: term, mode: 'insensitive' } },
      { codigo: { contains: term, mode: 'insensitive' } },
      { descripcion: { contains: term, mode: 'insensitive' } },
    ]
  }

  const [instruments, total] = await Promise.all([
    prisma.instrumento.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaCreacion: 'desc' },
      include: {
        _count: {
          select: { registros: true },
        },
        versiones: {
          where: { activo: true },
          select: {
            id: true,
            version: true,
            activo: true,
            createdAt: true,
          },
          take: 1,
        },
      },
    }),
    prisma.instrumento.count({ where }),
  ])

  const data: InstrumentSummary[] = instruments.map((inst) => {
    const activeVersion = inst.versiones[0] ?? null
    return {
      id: inst.id,
      nombreInstrumento: inst.nombreInstrumento,
      codigo: inst.codigo,
      descripcion: inst.descripcion,
      tipo: inst.tipo,
      periodicidad: inst.periodicidad,
      rolesPermitidos: inst.rolesPermitidos,
      estado: inst.estado,
      fechaCreacion: inst.fechaCreacion,
      totalRegistros: inst._count.registros,
      activeVersion: activeVersion
        ? {
            id: activeVersion.id,
            version: activeVersion.version,
            activo: activeVersion.activo,
            createdAt: activeVersion.createdAt,
          }
        : null,
    }
  })

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) }
}

export async function getInstrument(id: number): Promise<InstrumentDetail | null> {
  const prisma = getPrisma()
  const inst = await prisma.instrumento.findUnique({
    where: { id },
    include: {
      registros: {
        include: {
          cliente: {
            select: { id: true, nombre: true, numeroDocumento: true },
          },
        },
        orderBy: { fechaCreacionRegistro: 'desc' },
      },
    },
  })

  if (!inst) return null

  return {
    id: inst.id,
    nombreInstrumento: inst.nombreInstrumento,
    codigo: inst.codigo,
    descripcion: inst.descripcion,
    tipo: inst.tipo,
    periodicidad: inst.periodicidad,
    rolesPermitidos: inst.rolesPermitidos,
    estado: inst.estado,
    fechaCreacion: inst.fechaCreacion,
    creadoPor: inst.creadoPor,
    registros: inst.registros.map((r) => ({
      id: r.id,
      clienteId: r.clienteId,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      versionRegistro: r.versionRegistro,
      notasObservaciones: r.notasObservaciones,
      cliente: {
        id: r.cliente.id,
        nombre: r.cliente.nombre,
        numeroDocumento: r.cliente.numeroDocumento,
      },
    })),
  }
}

/**
 * Deep-clone via JSON round-trip. Definition JSON contains only JSON-safe values
 * (strings, numbers, booleans, arrays, plain objects) — safe to clone this way.
 */
function deepCloneDefinition<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export async function createInstrument(input: CreateInstrumentInput, userId: number): Promise<InstrumentDetail> {
  const prisma = getPrisma()

  // fixes-jul17-2 §3.1: when templateCodigo is present, resolve template + active
  // version + deep-copy the definition in a single transaction. The source template
  // rows are NEVER mutated (VERSION_LOCKED semantics).
  if (input.templateCodigo) {
    return await prisma.$transaction(async (tx) => {
      const template = await tx.instrumento.findUnique({
        where: { codigo: input.templateCodigo! },
        include: {
          versiones: {
            where: { activo: true },
            take: 1,
            orderBy: { version: 'desc' },
          },
        },
      })
      if (!template) {
        throw new CreateInstrumentError(
          'TEMPLATE_NOT_FOUND',
          `No existe un instrumento-plantilla con código ${input.templateCodigo}`,
        )
      }
      const sourceVersion = template.versiones[0]
      if (!sourceVersion) {
        throw new CreateInstrumentError(
          'NO_ACTIVE_VERSION',
          `El instrumento-plantilla ${input.templateCodigo} no tiene una versión activa`,
        )
      }

      // Deep-copy + rewrite codigo/nombre/version per §3.1 step 2.
      const newDefinition = deepCloneDefinition(sourceVersion.definition as any) as Record<string, any>
      newDefinition.codigo = input.codigo ?? null
      newDefinition.nombre = input.nombreInstrumento
      newDefinition.version = 1

      const inst = await tx.instrumento.create({
        data: {
          nombreInstrumento: input.nombreInstrumento,
          codigo: input.codigo,
          descripcion: input.descripcion,
          tipo: input.tipo as any,
          periodicidad: input.periodicidad as any,
          rolesPermitidos: input.rolesPermitidos,
          estado: (input.estado ?? 'ACTIVO') as any,
          creadoPor: userId,
        },
      })

      const newVersion = await tx.instrumentoVersion.create({
        data: {
          instrumentoId: inst.id,
          version: 1,
          definition: newDefinition as any,
          activo: true,
          createdBy: userId,
        },
      })

      return {
        id: inst.id,
        nombreInstrumento: inst.nombreInstrumento,
        codigo: inst.codigo,
        descripcion: inst.descripcion,
        tipo: inst.tipo,
        periodicidad: inst.periodicidad,
        rolesPermitidos: inst.rolesPermitidos,
        estado: inst.estado,
        fechaCreacion: inst.fechaCreacion,
        creadoPor: inst.creadoPor,
        registros: [],
        activeVersion: {
          id: newVersion.id,
          version: newVersion.version,
          activo: newVersion.activo,
          createdAt: newVersion.createdAt,
        },
      }
    })
  }

  // Legacy metadata-only creation (instrument is "sin definición" until a
  // definition is uploaded through the editor flow).
  const inst = await prisma.instrumento.create({
    data: {
      nombreInstrumento: input.nombreInstrumento,
      codigo: input.codigo,
      descripcion: input.descripcion,
      tipo: input.tipo as any,
      periodicidad: input.periodicidad as any,
      rolesPermitidos: input.rolesPermitidos,
      estado: (input.estado ?? 'ACTIVO') as any,
      creadoPor: userId,
    },
    include: {
      registros: {
        include: {
          cliente: {
            select: { id: true, nombre: true, numeroDocumento: true },
          },
        },
      },
    },
  })

  return {
    id: inst.id,
    nombreInstrumento: inst.nombreInstrumento,
    codigo: inst.codigo,
    descripcion: inst.descripcion,
    tipo: inst.tipo,
    periodicidad: inst.periodicidad,
    rolesPermitidos: inst.rolesPermitidos,
    estado: inst.estado,
    fechaCreacion: inst.fechaCreacion,
    creadoPor: inst.creadoPor,
    registros: [],
  }
}

export async function updateInstrument(id: number, input: UpdateInstrumentInput, userId: number): Promise<InstrumentDetail> {
  const prisma = getPrisma()

  const existing = await prisma.instrumento.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Instrument not found')
  }

  const updateData: Record<string, unknown> = {
    ...input,
    modificadoPor: userId,
  }

  if (input.tipo) updateData.tipo = input.tipo as any
  if (input.periodicidad) updateData.periodicidad = input.periodicidad as any
  if (input.estado) updateData.estado = input.estado as any

  const inst = await prisma.instrumento.update({
    where: { id },
    data: updateData,
    include: {
      registros: {
        include: {
          cliente: {
            select: { id: true, nombre: true, numeroDocumento: true },
          },
        },
        orderBy: { fechaCreacionRegistro: 'desc' },
      },
    },
  })

  return {
    id: inst.id,
    nombreInstrumento: inst.nombreInstrumento,
    codigo: inst.codigo,
    descripcion: inst.descripcion,
    tipo: inst.tipo,
    periodicidad: inst.periodicidad,
    rolesPermitidos: inst.rolesPermitidos,
    estado: inst.estado,
    fechaCreacion: inst.fechaCreacion,
    creadoPor: inst.creadoPor,
    registros: inst.registros.map((r) => ({
      id: r.id,
      clienteId: r.clienteId,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      versionRegistro: r.versionRegistro,
      notasObservaciones: r.notasObservaciones,
      cliente: {
        id: r.cliente.id,
        nombre: r.cliente.nombre,
        numeroDocumento: r.cliente.numeroDocumento,
      },
    })),
  }
}

export async function deleteInstrument(id: number): Promise<void> {
  const prisma = getPrisma()

  const existing = await prisma.instrumento.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Instrument not found')
  }

  await prisma.instrumento.update({
    where: { id },
    data: { estado: 'INACTIVO' as any },
  })
}

// ---- Records ----

// ---------------------------------------------------------------------------
// W4 §4.2: GET /instruments/:codigo/definition
// Returns the active version metadata + full definition. Throws structured
// error codes that the route layer maps to HTTP 404/403.
// ---------------------------------------------------------------------------

export type GetInstrumentDefinitionError =
  | 'INSTRUMENT_NOT_FOUND'
  | 'NO_ACTIVE_VERSION'
  | 'ROLE_NOT_ALLOWED'

export class InstrumentDefinitionError extends Error {
  readonly code: GetInstrumentDefinitionError
  constructor(code: GetInstrumentDefinitionError, message: string) {
    super(message)
    this.name = 'InstrumentDefinitionError'
    this.code = code
  }
}

export interface InstrumentDefinitionResult {
  instrumento: {
    id: number
    codigo: string
    nombre: string
    tipo: string
  }
  version: {
    id: number
    version: number
    definition: InstrumentDefinition
  }
}

export async function getInstrumentDefinition(
  codigo: string,
  callerRolesCsv: string | null,
): Promise<InstrumentDefinitionResult> {
  const prisma = getPrisma()
  const inst = await prisma.instrumento.findUnique({ where: { codigo } })
  if (!inst) {
    throw new InstrumentDefinitionError(
      'INSTRUMENT_NOT_FOUND',
      `No existe un instrumento con código ${codigo}`,
    )
  }

  // §4.2: 403 ROLE_NOT_ALLOWED via rolesPermitidos CSV check.
  // Caller's role must appear in the CSV (case-insensitive trimmed match).
  // ADMIN bypass is implicit because ADMIN is typically in rolesPermitidos;
  // callers can pre-add ADMIN to the list if needed.
  if (callerRolesCsv !== null && inst.rolesPermitidos) {
    const allowed = inst.rolesPermitidos
      .split(',')
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)
    const callerRoles = callerRolesCsv
      .split(',')
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean)
    const intersect = callerRoles.some((r) => allowed.includes(r))
    if (!intersect) {
      throw new InstrumentDefinitionError(
        'ROLE_NOT_ALLOWED',
        `Su rol no tiene acceso al instrumento ${codigo}`,
      )
    }
  }

  const version = await prisma.instrumentoVersion.findFirst({
    where: { instrumentoId: inst.id, activo: true },
  })
  if (!version) {
    throw new InstrumentDefinitionError(
      'NO_ACTIVE_VERSION',
      `El instrumento ${codigo} no tiene una versión activa`,
    )
  }

  return {
    instrumento: {
      id: inst.id,
      codigo: inst.codigo ?? codigo,
      nombre: inst.nombreInstrumento,
      tipo: inst.tipo,
    },
    version: {
      id: version.id,
      version: version.version,
      definition: version.definition as unknown as InstrumentDefinition,
    },
  }
}

export async function listRecordsByInstrument(instrumentId: number): Promise<RecordDetail[]> {
  const prisma = getPrisma()
  const records = await prisma.registroFichaCompletada.findMany({
    where: { instrumentoId: instrumentId },
    include: RECORD_INCLUDE,
    orderBy: { fechaCreacionRegistro: 'desc' },
  })

  return records.map((r) => mapRecord(r))
}

export async function createRecord(input: CreateRecordInput): Promise<RecordDetail> {
  const prisma = getPrisma()

  // Verify instrument exists and get periodicidad for auto-expiration
  const instrument = await prisma.instrumento.findUnique({ where: { id: input.instrumentoId } })
  if (!instrument) {
    throw new Error('Instrument not found')
  }

  // Verify patient exists
  const patient = await prisma.cliente.findUnique({ where: { id: input.clienteId } })
  if (!patient) {
    throw new Error('Patient not found')
  }

  const completado = input.fechaCompletado ? new Date(input.fechaCompletado) : null
  const vencimiento =
    input.fechaVencimiento
      ? new Date(input.fechaVencimiento)
      : completado
      ? calcularFechaVencimiento(instrument.periodicidad, completado)
      : null

  const record = await prisma.registroFichaCompletada.create({
    data: {
      clienteId: input.clienteId,
      instrumentoId: input.instrumentoId,
      estado: (input.estado ?? 'PENDIENTE') as any,
      fechaCompletado: completado,
      fechaVencimiento: vencimiento,
      versionRegistro: input.versionRegistro,
      responsable: input.responsable,
      notasObservaciones: input.notasObservaciones,
    },
    include: RECORD_INCLUDE,
  })

  return mapRecord(record)
}

export async function updateRecord(id: number, input: UpdateRecordInput): Promise<RecordDetail> {
  const prisma = getPrisma()

  const existing = await prisma.registroFichaCompletada.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Record not found')
  }

  // State transition validation
  if (input.estado && input.estado !== existing.estado) {
    const currentState = existing.estado as string
    const nextState = input.estado as string

    // VENCIDO is a terminal state - no transitions allowed out of it
    if (currentState === 'VENCIDO') {
      throw new Error(`Invalid state transition: cannot transition from VENCIDO to ${nextState}`)
    }

    // COMPLETADO cannot go back to PENDIENTE
    if (currentState === 'COMPLETADO' && nextState === 'PENDIENTE') {
      throw new Error('Invalid state transition: cannot transition from COMPLETADO to PENDIENTE')
    }
  }

  const updateData: Record<string, unknown> = { ...input }

  if (input.fechaCompletado) {
    updateData.fechaCompletado = new Date(input.fechaCompletado)
  }

  if (input.fechaVencimiento) {
    updateData.fechaVencimiento = new Date(input.fechaVencimiento)
  }

  if (input.estado) {
    updateData.estado = input.estado as any
  }

  const record = await prisma.registroFichaCompletada.update({
    where: { id },
    data: updateData,
    include: RECORD_INCLUDE,
  })

  return mapRecord(record)
}

function mapRecord(r: any): RecordDetail {
  return {
    id: r.id,
    clienteId: r.clienteId,
    instrumentoId: r.instrumentoId,
    estado: r.estado,
    fechaCompletado: r.fechaCompletado,
    fechaVencimiento: r.fechaVencimiento,
    versionRegistro: r.versionRegistro,
    responsable: r.responsable,
    notasObservaciones: r.notasObservaciones,
    fechaCreacionRegistro: r.fechaCreacionRegistro,
    cliente: {
      id: r.cliente.id,
      nombre: r.cliente.nombre,
      numeroDocumento: r.cliente.numeroDocumento,
    },
    instrumento: {
      id: r.instrumento.id,
      nombreInstrumento: r.instrumento.nombreInstrumento,
      tipo: r.instrumento.tipo,
      periodicidad: r.instrumento.periodicidad,
    },
  }
}
