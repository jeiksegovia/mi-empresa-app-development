import { getPrisma } from '../config/database.js'

export interface InstrumentListParams {
  page?: number
  limit?: number
  search?: string
  tipo?: string
  estado?: 'ACTIVO' | 'INACTIVO'
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
  versionPlantilla: string
  fechaCreacion: Date
  totalRegistros: number
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
  plantillaArchivo: string | null
  versionPlantilla: string
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
}

export interface CreateInstrumentInput {
  nombreInstrumento: string
  codigo?: string
  descripcion?: string
  tipo: 'VALORACION' | 'NUTRICION' | 'MATRICULA' | 'ADMISION'
  periodicidad: 'UNICA' | 'ANUAL' | 'MENSUAL' | 'TRIMESTRAL' | 'SEMESTRAL'
  rolesPermitidos: string
  plantillaArchivo?: string
  versionPlantilla: string
  estado?: 'ACTIVO' | 'INACTIVO'
}

export type UpdateInstrumentInput = Partial<CreateInstrumentInput>

export interface RecordDetail {
  id: number
  clienteId: number
  instrumentoId: number
  estado: string
  fechaCompletado: Date | null
  fechaVencimiento: Date | null
  versionRegistro: string
  responsable: number
  archivoCompletado: string | null
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
  archivoCompletado?: string
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
      },
    }),
    prisma.instrumento.count({ where }),
  ])

  const data: InstrumentSummary[] = instruments.map((inst) => ({
    id: inst.id,
    nombreInstrumento: inst.nombreInstrumento,
    codigo: inst.codigo,
    descripcion: inst.descripcion,
    tipo: inst.tipo,
    periodicidad: inst.periodicidad,
    rolesPermitidos: inst.rolesPermitidos,
    estado: inst.estado,
    versionPlantilla: inst.versionPlantilla,
    fechaCreacion: inst.fechaCreacion,
    totalRegistros: inst._count.registros,
  }))

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
    plantillaArchivo: inst.plantillaArchivo,
    versionPlantilla: inst.versionPlantilla,
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

export async function createInstrument(input: CreateInstrumentInput, userId: number): Promise<InstrumentDetail> {
  const prisma = getPrisma()

  const inst = await prisma.instrumento.create({
    data: {
      nombreInstrumento: input.nombreInstrumento,
      codigo: input.codigo,
      descripcion: input.descripcion,
      tipo: input.tipo as any,
      periodicidad: input.periodicidad as any,
      rolesPermitidos: input.rolesPermitidos,
      plantillaArchivo: input.plantillaArchivo,
      versionPlantilla: input.versionPlantilla,
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
    plantillaArchivo: inst.plantillaArchivo,
    versionPlantilla: inst.versionPlantilla,
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
    plantillaArchivo: inst.plantillaArchivo,
    versionPlantilla: inst.versionPlantilla,
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
      archivoCompletado: input.archivoCompletado,
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
    archivoCompletado: r.archivoCompletado,
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
