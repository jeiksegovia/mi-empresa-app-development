import { getPrisma } from '../config/database.js'

/**
 * jul-10 C4 (decision D-C4): lazy PENDIENTE → VENCIDO flip.
 * No cron — fired inside read paths that surface ficha estado (getPatient,
 * listFichasVencimientos). Idempotent; runs in ONE bulk updateMany (not per-row).
 *
 * @param prisma   the Prisma client (any — passed so callers can share their tx or keep no-op elsewhere)
 * @param clienteId optional — flip only one patient's fichas; otherwise flip across all patients
 * @param now     override for testability (defaults to wall clock)
 * @returns       number of rows flipped
 */
export async function flipExpiredFichas(
  prisma: ReturnType<typeof getPrisma>,
  clienteId?: number,
  now: Date = new Date()
): Promise<number> {
  const where: Record<string, unknown> = {
    estado: 'PENDIENTE',
    fechaVencimiento: { lt: now },
  }
  if (clienteId !== undefined) where.clienteId = clienteId

  const result = await prisma.registroFichaCompletada.updateMany({
    where,
    data: { estado: 'VENCIDO' },
  })

  return result.count
}

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
  // jul-9 B3/B4/B5
  fechaCumpleanos: Date | null
  tipoSangre: string | null
  eps: string | null
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
    // jul-9 B1
    fechaIncidente: Date
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
  // jul-9 B3/B4/B5
  fechaCumpleanos?: string | Date
  tipoSangre?: 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG'
  eps?: string
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

  // jul-10 C4: lazy flip PENDIENTE→VENCIDO before reading this patient's fichas.
  // One extra bulk updateMany; then read normally — the relation include
  // now reflects the flipped estado.
  await flipExpiredFichas(prisma, id)

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
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
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
      fechaIncidente: n.fechaIncidente,
    })),
  }
}

export async function createPatient(input: CreatePatientInput): Promise<PatientDetail> {
  const prisma = getPrisma()

  const { contactosEmergencia, fechaCumpleanos, tipoSangre, eps, ...baseFields } = input

  const cliente = await prisma.cliente.create({
    data: {
      ...baseFields,
      fechaNacimiento: new Date(baseFields.fechaNacimiento),
      tipoDocumento: baseFields.tipoDocumento as any,
      estado: (baseFields.estado ?? 'ACTIVO') as any,
      ...(fechaCumpleanos ? { fechaCumpleanos: new Date(fechaCumpleanos) } : {}),
      ...(tipoSangre ? { tipoSangre: tipoSangre as any } : {}),
      ...(eps ? { eps } : {}),
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
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
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
      fechaIncidente: n.fechaIncidente,
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

  if (input.fechaCumpleanos) {
    updateData.fechaCumpleanos = new Date(input.fechaCumpleanos)
  }

  if (input.tipoDocumento) {
    updateData.tipoDocumento = input.tipoDocumento as any
  }

  if (input.estado) {
    updateData.estado = input.estado as any
  }

  if (input.tipoSangre) {
    updateData.tipoSangre = input.tipoSangre as any
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
    fechaCumpleanos: cliente.fechaCumpleanos,
    tipoSangre: cliente.tipoSangre,
    eps: cliente.eps,
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
      fechaIncidente: n.fechaIncidente,
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

// jul-10 C7: weekly vencimientos report
export interface FichaVencimientoSummary {
  id: number
  clienteId: number
  clienteNombre: string
  instrumentoId: number
  instrumentoNombre: string
  instrumentoTipo: string
  estado: string
  fechaVencimiento: Date
  fechaCompletado: Date | null
  diasHastaVencimiento: number
}

export interface FichasVencimientoResult {
  generatedAt: Date
  windowDays: number
  total: number
  data: FichaVencimientoSummary[]
}

/**
 * jul-10 C4 + C7: list fiches due/overdue within `days`.
 *  - Runs the lazy flip first so estados are truthful (VENCIDO, not stale PENDIENTE).
 *  - Returns fichas with estado ∈ {PENDIENTE, VENCIDO} AND fechaVencimiento <= today+days.
 *  - Ordered by fechaVencimiento asc (most overdue first).
 */
export async function listFichasVencimientos(days: number = 7): Promise<FichasVencimientoResult> {
  const prisma = getPrisma()
  const now = new Date()
  const horizon = new Date(now)
  horizon.setDate(horizon.getDate() + Math.max(0, days))

  // jul-10 C4: lazy flip BEFORE the read so the report never carries stale PENDIENTE rows.
  await flipExpiredFichas(prisma, undefined, now)

  const records = await prisma.registroFichaCompletada.findMany({
    where: {
      estado: { in: ['PENDIENTE', 'VENCIDO'] },
      fechaVencimiento: { lte: horizon },
    },
    orderBy: { fechaVencimiento: 'asc' },
    include: {
      cliente: { select: { id: true, nombre: true } },
      instrumento: {
        select: { id: true, nombreInstrumento: true, tipo: true },
      },
    },
  })

  const data: FichaVencimientoSummary[] = records.map((r) => {
    const due = r.fechaVencimiento!
    const diffMs = due.getTime() - now.getTime()
    const diasHastaVencimiento = Math.round(diffMs / (1000 * 60 * 60 * 24))
    return {
      id: r.id,
      clienteId: r.clienteId,
      clienteNombre: r.cliente.nombre,
      instrumentoId: r.instrumento.id,
      instrumentoNombre: r.instrumento.nombreInstrumento,
      instrumentoTipo: r.instrumento.tipo,
      estado: r.estado,
      fechaVencimiento: due,
      fechaCompletado: r.fechaCompletado,
      diasHastaVencimiento,
    }
  })

  return {
    generatedAt: now,
    windowDays: days,
    total: data.length,
    data,
  }
}

// jul-10 C1: atomic single-step ficha create-or-complete
export interface CreateFichaInput {
  instrumentoId: number
  versionRegistro: string
  archivoCompletado?: string
  notasObservaciones?: string
  fechaVencimiento?: string
}

export interface FichaCreated {
  id: number
  clienteId: number
  instrumentoId: number
  estado: 'PENDIENTE' | 'COMPLETADO'
  archivoCompletado: string | null
  fechaCompletado: Date | null
  fechaVencimiento: Date | null
  versionRegistro: string
  notasObservaciones: string | null
  singleStepCompleted: boolean
  instrumento: { id: number; nombreInstrumento: string; tipo: string }
}

/**
 * jul-10 C1: atomic assign + first update (single Prisma `$transaction`).
 * If `archivoCompletado` is provided, the ficha is created as COMPLETADO
 * with archivoCompletado + fechaCompletado set in one txn. Otherwise the
 * legacy flow runs (PENDIENTE, no fechaCompletado).
 *
 * The renewal flow (legacy PENDIENTE → PATCH → COMPLETADO) is preserved by
 * patients.routes.ts' PATCH /:id/fichas/:fichaId/status endpoint.
 */
export async function createFichaAtomic(
  patientId: number,
  responsableId: number,
  input: CreateFichaInput
): Promise<FichaCreated> {
  const prisma = getPrisma()

  const singleStep = Boolean(input.archivoCompletado && input.archivoCompletado.trim().length > 0)

  return await prisma.$transaction(async (tx) => {
    const ficha = await tx.registroFichaCompletada.create({
      data: {
        clienteId: patientId,
        instrumentoId: input.instrumentoId,
        estado: singleStep ? 'COMPLETADO' : 'PENDIENTE',
        versionRegistro: input.versionRegistro,
        responsable: responsableId,
        ...(singleStep
          ? {
              archivoCompletado: input.archivoCompletado!,
              fechaCompletado: new Date(),
            }
          : {}),
        ...(input.notasObservaciones ? { notasObservaciones: input.notasObservaciones } : {}),
        ...(input.fechaVencimiento ? { fechaVencimiento: new Date(input.fechaVencimiento) } : {}),
      },
      include: {
        instrumento: { select: { id: true, nombreInstrumento: true, tipo: true } },
      },
    })

    return {
      id: ficha.id,
      clienteId: ficha.clienteId,
      instrumentoId: ficha.instrumentoId,
      estado: ficha.estado as 'PENDIENTE' | 'COMPLETADO',
      archivoCompletado: ficha.archivoCompletado,
      fechaCompletado: ficha.fechaCompletado,
      fechaVencimiento: ficha.fechaVencimiento,
      versionRegistro: ficha.versionRegistro,
      notasObservaciones: ficha.notasObservaciones,
      singleStepCompleted: singleStep,
      instrumento: {
        id: ficha.instrumento.id,
        nombreInstrumento: ficha.instrumento.nombreInstrumento,
        tipo: ficha.instrumento.tipo,
      },
    }
  })
}

export interface CreateNoteInput {
  tipo: 'POSITIVA' | 'NEGATIVA' | 'NEUTRAL' | 'ALERTA'
  prioridad: 'ALTA' | 'MEDIA' | 'BAJA'
  contenido: string
  // jul-9 B1: required, must satisfy L3 2-business-day rule (validated upstream in route)
  fechaIncidente: string
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
      fechaIncidente: new Date(input.fechaIncidente),
    },
  })
}
