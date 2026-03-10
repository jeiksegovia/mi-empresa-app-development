import { getPrisma } from '../config/database.js'

export interface PatientListParams {
  page?: number
  limit?: number
  search?: string
  estado?: 'ACTIVO' | 'INACTIVO'
}

export interface PatientSummary {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: Date
  genero: string
  telefono: string | null
  email: string | null
  estado: string
  fechaIngreso: Date
  totalFichas: number
  fichasPendientes: number
}

export interface PatientListResult {
  data: PatientSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PatientDetail {
  id: number
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  fechaNacimiento: Date
  genero: string
  telefono: string | null
  email: string | null
  estado: string
  fechaIngreso: Date
  notas: string | null
  informacionSeguro: string | null
  observacionesEspeciales: string | null
  contactosEmergencia: Array<{
    id: number
    nombre: string
    telefono: string
    parentesco: string
  }>
  registrosFichas: Array<{
    id: number
    estado: string
    fechaCompletado: Date | null
    fechaVencimiento: Date | null
    instrumento: {
      id: number
      nombreInstrumento: string
      tipo: string
    }
  }>
  notasCliente: Array<{
    id: number
    contenido: string
    tipo: string
    prioridad: string
    fechaCreacion: Date
  }>
}

export interface CreatePatientInput {
  nombre: string
  tipoDocumento: 'CC' | 'CE' | 'PASAPORTE' | 'REGISTRO_CIVIL'
  numeroDocumento: string
  fechaNacimiento: string | Date
  genero: string
  telefono?: string
  email?: string
  estado?: 'ACTIVO' | 'INACTIVO'
  notas?: string
  informacionSeguro?: string
  observacionesEspeciales?: string
  contactosEmergencia?: Array<{
    nombre: string
    telefono: string
    parentesco: string
  }>
}

export type UpdatePatientInput = Partial<Omit<CreatePatientInput, 'contactosEmergencia'>>

const ALL_RELATIONS = {
  contactosEmergencia: true,
  registrosFichas: {
    include: {
      instrumento: {
        select: {
          id: true,
          nombreInstrumento: true,
          tipo: true,
        },
      },
    },
  },
  notasCliente: {
    orderBy: { fecha: 'desc' as const },
  },
}

export async function listPatients(params: PatientListParams): Promise<PatientListResult> {
  const prisma = getPrisma()
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(100, Math.max(1, params.limit ?? 20))
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}

  if (params.estado) {
    where.estado = params.estado
  }

  if (params.search && params.search.trim()) {
    const term = params.search.trim()
    where.OR = [
      { nombre: { contains: term, mode: 'insensitive' } },
      { numeroDocumento: { contains: term, mode: 'insensitive' } },
    ]
  }

  const [clientes, total] = await Promise.all([
    prisma.cliente.findMany({
      where,
      skip,
      take: limit,
      orderBy: { fechaIngreso: 'desc' },
      include: {
        _count: {
          select: {
            registrosFichas: true,
          },
        },
        registrosFichas: {
          where: { estado: 'PENDIENTE' },
          select: { id: true },
        },
      },
    }),
    prisma.cliente.count({ where }),
  ])

  const data: PatientSummary[] = clientes.map((cliente) => ({
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    totalFichas: cliente._count.registrosFichas,
    fichasPendientes: cliente.registrosFichas.length,
  }))

  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getPatient(id: number): Promise<PatientDetail | null> {
  const prisma = getPrisma()
  const cliente = await prisma.cliente.findUnique({
    where: { id },
    include: ALL_RELATIONS,
  })

  if (!cliente) return null

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
    })),
  }
}

export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const prisma = getPrisma()

  const { contactosEmergencia, ...baseFields } = input

  const cliente = await prisma.cliente.create({
    data: {
      ...baseFields,
      fechaNacimiento: new Date(baseFields.fechaNacimiento),
      tipoDocumento: baseFields.tipoDocumento as any,
      estado: (baseFields.estado ?? 'ACTIVO') as any,
      ...(contactosEmergencia && contactosEmergencia.length > 0
        ? {
            contactosEmergencia: {
              create: contactosEmergencia,
            },
          }
        : {}),
    },
    include: ALL_RELATIONS,
  })

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
    })),
  }
}

export async function updatePatient(id: number, input: UpdatePatientInput): Promise<PatientDetail> {
  const prisma = getPrisma()

  const existing = await prisma.cliente.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Patient not found')
  }

  const updateData: Record<string, unknown> = { ...input }

  if (input.fechaNacimiento) {
    updateData.fechaNacimiento = new Date(input.fechaNacimiento)
  }

  if (input.tipoDocumento) {
    updateData.tipoDocumento = input.tipoDocumento as any
  }

  if (input.estado) {
    updateData.estado = input.estado as any
  }

  const cliente = await prisma.cliente.update({
    where: { id },
    data: updateData,
    include: ALL_RELATIONS,
  })

  return {
    id: cliente.id,
    nombre: cliente.nombre,
    tipoDocumento: cliente.tipoDocumento,
    numeroDocumento: cliente.numeroDocumento,
    fechaNacimiento: cliente.fechaNacimiento,
    genero: cliente.genero,
    telefono: cliente.telefono,
    email: cliente.email,
    estado: cliente.estado,
    fechaIngreso: cliente.fechaIngreso,
    notas: cliente.notas,
    informacionSeguro: cliente.informacionSeguro,
    observacionesEspeciales: cliente.observacionesEspeciales,
    contactosEmergencia: cliente.contactosEmergencia.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono,
      parentesco: c.parentesco,
    })),
    registrosFichas: (cliente.registrosFichas as any[]).map((r) => ({
      id: r.id,
      estado: r.estado,
      fechaCompletado: r.fechaCompletado,
      fechaVencimiento: r.fechaVencimiento,
      instrumento: {
        id: r.instrumento.id,
        nombreInstrumento: r.instrumento.nombreInstrumento,
        tipo: r.instrumento.tipo,
      },
    })),
    notasCliente: cliente.notasCliente.map((n) => ({
      id: n.id,
      contenido: n.contenido,
      tipo: n.tipoNota,
      prioridad: n.prioridad,
      fechaCreacion: n.fecha,
    })),
  }
}

export async function deletePatient(id: number): Promise<void> {
  const prisma = getPrisma()

  const existing = await prisma.cliente.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Patient not found')
  }

  await prisma.cliente.update({
    where: { id },
    data: { estado: 'INACTIVO' },
  })
}

export interface CreateNoteInput {
  tipo: 'POSITIVA' | 'NEGATIVA' | 'NEUTRAL' | 'ALERTA'
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
  contenido: string
}

export async function createNote(
  clienteId: number,
  usuarioId: number,
  input: CreateNoteInput
) {
  const prisma = getPrisma()

  // Verify patient exists
  const patient = await prisma.cliente.findUnique({ where: { id: clienteId } })
  if (!patient) {
    throw new Error('Patient not found')
  }

  return await prisma.notaCliente.create({
    data: {
      clienteId,
      autor: usuarioId,
      tipoNota: input.tipo,
      prioridad: input.prioridad,
      contenido: input.contenido,
    },
  })
}
